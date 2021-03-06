/**
 * T'MediaArt library for Javascript
 *  - MajVj extension - frame plugin - shadertoy -
 * @param options options (See MajVj.prototype.create)
 */
MajVj.frame.shadertoy = function (options) {
    this._screen = options.screen;
    this._width = options.width;
    this._height = options.height;
    this._aspect = options.aspect;
    this._controller = options.controller;
    this._textures = options.textures;
    this._time = 0.0;
    this._program = null;
    if (options.shader)
        this.setShader(options.shader);
    this._copy = this._screen.createProgram(
            this._screen.compileShader(Tma3DScreen.VERTEX_SHADER,
                    MajVj.frame.shadertoy._vertexShader),
            this._screen.compileShader(Tma3DScreen.FRAGMENT_SHADER,
                    MajVj.frame.shadertoy._fragmentShader));
    this._coords = this._screen.createBuffer([-1, -1, -1, 1, 1, 1, 1, -1]);
    var waveTableWidth = this._controller.sound.wave.length || 1;
    var textureHeight = 2;
    var rgbaSize = 4;
    this._waveData =
            new Float32Array(waveTableWidth * rgbaSize * textureHeight);
    this._waveTexture = this._screen.createFloatTexture(
            this._waveData, waveTableWidth, 2, true);
    this._mouse = { x: 0.0, y: 0.0, cx: 0.0, cy: 0.0 };
    this._fbo = [
            this._screen.createFrameBuffer(this._width, this._height),
            this._screen.createFrameBuffer(this._width, this._height)];
};

// Shader programs.
MajVj.frame.shadertoy._vertexShader = null;
MajVj.frame.shadertoy._fragmentShader = null;
MajVj.frame.shadertoy._shadertoyHeader = null;
MajVj.frame.shadertoy._shadertoyFooter = null;

/**
 * Loads resource asynchronously.
 * @return a Promise object
 */
MajVj.frame.shadertoy.load = function () {
    return new Promise(function (resolve, reject) {
        Promise.all([
            MajVj.loadShader('frame', 'shadertoy', 'shaders.html', 'vertex'),
            MajVj.loadShader('frame', 'shadertoy', 'shaders.html', 'fragment'),
            MajVj.loadShader(
                'frame', 'shadertoy', 'shaders.html', 'fragment_head'),
            MajVj.loadShader(
                'frame', 'shadertoy', 'shaders.html', 'fragment_foot')
        ]).then(function (results) {
            MajVj.frame.shadertoy._vertexShader = results[0];
            MajVj.frame.shadertoy._fragmentShader = results[1];
            MajVj.frame.shadertoy._shadertoyHeader = results[2];
            MajVj.frame.shadertoy._shadertoyFooter = results[3];
            resolve();
        }, function (error) { tma.log(error); });
    });
};

/**
 * Handles screen resize.
 * @param aspect screen aspect ratio
 */
MajVj.frame.shadertoy.prototype.onresize = function (aspect) {
    this._aspect = aspect;
};

/**
 * Draws a frame.
 * @param delta delta time from the last rendering
 */
MajVj.frame.shadertoy.prototype.draw = function (delta) {
    var lastFbo = this._fbo[0];
    var currentFbo = this._fbo[1];
    this._fbo = [currentFbo, lastFbo];
    var fbo = currentFbo.bind();
    this._screen.pushAlphaMode();
    this._screen.setAlphaMode(false);
    this._screen.fillColor(0.0, 0.0, 0.0, 1.0);
    this._screen.setAlphaMode(true, this._screen.gl.ONE, this._screen.gl.ONE);

    var ratio =
        this._controller.sound.fft.length / this._controller.sound.wave.length;
    var rgbSize = 4;
    var width = this._controller.sound.wave.length;
    var fftOffset = width * rgbSize;
    for (var x = 0; x < width; ++x) {
      this._waveData[x * rgbSize] = this._controller.sound.wave[x];
      this._waveData[fftOffset + x * rgbSize] =
              this._controller.sound.fft[(x * ratio)|0] / 255;
    }
    this._waveTexture.update(this._waveData);

    // Set shadertoy compatible uniforms.
    this._time += delta / 1000.0;
    this._program.setAttributeArray('aCoord', this._coords, 0, 2, 0);
    this._program.setUniformVector(
        'iResolution', [this._width, this._height, 1.0]);
    this._program.setUniformVector('iGlobalTime', [this._time]);
    this._program.setUniformVector(
        'iChannelTime', [this._time, this._time, this._time, this._time]);
    var mouse = this._screen.mouse();
    if (mouse.over) {
        var click = mouse.click.on ? 1.0 : -1.0;
        this._mouse = {
            x: (mouse.x / mouse.width) * this._width,
            y: (1.0 - mouse.y / mouse.height) * this._height,
            cx: click * mouse.click.x / mouse.width * this._width,
            cy: click * (1.0 - mouse.click.y / mouse.height) * this._height
        };
    }
    this._program.setUniformVector(
        'iMouse',
        [this._mouse.x, this._mouse.y, this._mouse.cx, this._mouse.cy]);
    if (this._textures) {
        for (var i = 0; i < 3; ++i) {
            if (!this._textures[i])
                continue;
            if (this._textures[i] == 'audio') {
                this._program.setTexture('iChannel' + i, this._waveTexture);
                this._program.setUniformVector(
                        'iChannelResolution[' + i + ']',
                        [this._controller.sound.wave.length, 2.0, 1.0]);
            } else if (this._textures[i] == 'previous-frame') {
                this._program.setTexture('iChannel' + i, lastFbo.texture);
                this._program.setUniformVector(
                        'iChannelResolution[' + i + ']',
                        [this._width, this._height, 1.0]);
            }
        }
    }
    this._program.setUniformVector('iDate', [Date.now()]);

    // Set shadertone compatible uniforms.
    this._program.setUniformVector(
        'iOvertoneVolume', [this._controller.sound.volume]);

    this._program.drawArrays(Tma3DScreen.MODE_TRIANGLE_FAN, 0, 4);

    fbo.bind();
    this._screen.setAlphaMode(true, this._screen.gl.ONE, this._screen.gl.ZERO);
    this._screen.fillColor(0.0, 0.0, 0.0, 1.0);

    this._copy.setAttributeArray('aCoord', this._coords, 0, 2, 0);
    this._copy.setTexture('uTexture', currentFbo.texture);
    this._copy.setUniformVector('uWidth', [this._width]);
    this._copy.setUniformVector('uHeight', [this._height]);
    this._copy.drawArrays(Tma3DScreen.MODE_TRIANGLE_FAN, 0, 4);

    this._screen.popAlphaMode();
};

/**
 * Sets a controller.
 * @param controller a controller object
 */
MajVj.frame.shadertoy.prototype.setController = function (controller) {
    this._controller = controller;
};

/**
 * Sets a fragment shader.
 * @param shader a fragment shader
 */
MajVj.frame.shadertoy.prototype.setShader = function (shader) {
    this._program = this._screen.createProgram(
            this._screen.compileShader(Tma3DScreen.VERTEX_SHADER,
                    MajVj.frame.shadertoy._vertexShader),
            this._screen.compileShader(Tma3DScreen.FRAGMENT_SHADER,
                    MajVj.frame.shadertoy._shadertoyHeader + shader +
                    MajVj.frame.shadertoy._shadertoyFooter));
};

