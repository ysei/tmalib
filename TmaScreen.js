/**
 * T'MediaArt library for JavaScript.
 */

/**
 * TmaScreen prototype
 *
 * This prototype provides canvas operations.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 * @param width screen width
 * @param height screen height
 */
function TmaScreen (width, height) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.onmousemove = this._onmousemove.bind(this);
    this.canvas.onmouseout = this._onmouseout.bind(this);
    this.context = this.canvas.getContext("2d");
    this._image = this.context.getImageData(0, 0, this.width, this.height);
    this._offscreenCanvas = document.createElement("canvas");
    this._offscreenCanvas.width = width;
    this._offscreenCanvas.height = height;
    this._offscreenContext = this._offscreenCanvas.getContext("2d");
    this._offscreenImage = this.createImageData();
    this._afterimage = 0;
    this._blurCanvas = document.createElement("canvas");
    this._blurCanvas.width = width;
    this._blurCanvas.height = height;
    this._blurContext = this._blurCanvas.getContext("2d");
    this._blurRatio = 0;
    this._blurAlpha = 0;
    this._blurWidth = 0;
    this._blurHeight = 0;
    this._blurSource = { x: 0, y: 0, w: 0, h: 0 };
    this._blurDestination = { x: 0, y: 0, w: 0, h: 0 };
    this._blurSync = true;
    this._mouse = false;
    this._mouseX = 0;
    this._mouseY = 0;
}

/**
 * Prototype variables.
 */
TmaScreen.BODY = document.getElementsByTagName("body")[0];
// Locks screen to get offscreen ImageData object.
TmaScreen.LOCK = 1;
// Locks screen to get ImageData object containing screen.
TmaScreen.LOCK_WITH_SCREEN = 2;

/**
 * Attaches to a DOMElement. TmaScreen.BODY is useful predefined DOMElement
 * which represents the <body> DOMElement.
 * @param element DOMElement
 */
TmaScreen.prototype.attachTo = function (element) {
    element.appendChild(this.canvas);
};

/**
 * Detaches from a DOMElement.
 * @param element DOMElement
 */
TmaScreen.prototype.detachFrom = function (element) {
    element.removeChild(this.canvas);
};

/**
 * Creates ImageData object with current screen size.
 */
TmaScreen.prototype.createImageData = function () {
    return this.context.createImageData(this.width, this.height);
};

/**
 * Sets pixel data to specified point, color, and alpha blending parameters.
 * This operation is applied to locked image data.
 * @param x X position to set pixel
 * @param y Y position to set pixel
 * @param r Red (from 0 to 255)
 * @param g Green (from 0 to 255)
 * @param b Blue (from 0 to 255)
 * @param a Alpha (from 0 to 255)
 */
TmaScreen.prototype.setPixel = function (x, y, r, g, b, a) {
    var offset = (y * this.width + x) * 4;
    var data = this._image.data;
    data[offset + 0] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = a;
};

/**
 * Composites pixel data to specified point, color, and alpha blending
 * parameters. This operation is applied to locked image data.
 * @param x X position to set pixel
 * @param y Y position to set pixel
 * @param r Red (from 0 to 255)
 * @param g Green (from 0 to 255)
 * @param b Blue (from 0 to 255)
 * @param a Alpha (from 0 to 255)
 */
TmaScreen.prototype.addPixel = function (x, y, r, g, b, a) {
    var offset = (y * this.width + x) * 4;
    var data = this._image.data;
    data[offset + 0] += r;
    data[offset + 1] += g;
    data[offset + 2] += b;
    data[offset + 3] += a;
};

/**
 * Locks screen to get ImageData object to update screen. If |method| is
 * TmaScreen.LOCK_WITH_SCREEN, returning ImageData contains the current showing
 * screen image. Otherwise, it returns offscreen ImageData which contains an
 * undefined image.
 * @param method TmaScreen.LOCK or TmaScreen.LOCK_WITH_SCREEN
 */
TmaScreen.prototype.lock = function (method) {
    if (TmaScreen.LOCK_WITH_SCREEN == method)
        this._image = this.context.getImageData(0, 0, this.width, this.height);
    else
        this._image = this._offscreenImage;
    return this._image;
};

/**
 * Unlocks screen to apply effects. This function must be called after |lock|.
 */
TmaScreen.prototype.unlock = function () {
    if (this._blurRatio && this._blurSync)
        this._offscreenContext.putImageData(this._image, 0, 0);
    else
        this.context.putImageData(this._image, 0, 0);
    this.applyEffects();
};

/**
 * Sets afterimage parameter. |rgba| will be drawn over all pixels at the last
 * stage of screen update. Calling without |rgba| disables afterimage effect.
 * @param rgba Color and alpha parameter (E.g., "rgba(255, 0, 0, 1.0)")
 */
TmaScreen.prototype.afterimage = function (rgba) {
    this._afterimage = rgba;
};

/**
 * Sets blur parameters. Blur effect will be applied at screen update. Calling
 * without any parameters or with |ratio| being 0 disables blur effect.
 * @param ratio Blur sharpness (from +0.0 to 1.0: no blur)
 * @param alpha Alpha blending parameter for blur effect (from 0.0 to 1.0)
 * @param zoom Zoom ratio of blur effect (> 1.0)
 * @param x X motion parameter (from -width to +width makes sense)
 * @param y Y motion parameter (from -height to +height makes sense)
 * @param sync Applies effects offscreen
 */
TmaScreen.prototype.blur = function (ratio, alpha, zoom, x, y, sync) {
    this._blurRatio = ratio;
    this._blurAlpha = alpha;
    this._blurWidth = ~~(this.width * ratio);
    this._blurHeight = ~~(this.height * ratio);
    var bx = ~~((this._blurWidth - (this._blurWidth / zoom)) / 2);
    var by = ~~((this._blurHeight - (this._blurHeight / zoom)) / 2);
    this._blurSource.x = bx;
    this._blurSource.y = by;
    this._blurSource.w = this._blurWidth - bx - bx;
    this._blurSource.h = this._blurHeight - by - by;
    this._blurDestination.x = 0;
    this._blurDestination.y = 0;
    this._blurDestination.w = this.width;
    this._blurDestination.h = this.height;
    var dx = (x >= 0) ? x : -x;
    var dy = (y >= 0) ? y : -y;
    var sx = ~~(dx * this._blurSource.w / this._blurDestination.w);
    var sy = ~~(dy * this._blurSource.h / this._blurDestination.h);
    this._blurSource.w -= sx;
    this._blurDestination.w -= dx;
    this._blurSource.h -= sy;
    this._blurDestination.h -= dy;
    if (x > 0)
        this._blurSource.x += sx;
    else if (x < 0)
        this._blurDestination.x += sx;
    if (y > 0)
        this._blurSource.y += sy;
    else if (y < 0)
        this._blurDestination.y += sy;
    this._blurSync = sync;
};

/**
 * Fills screen with |rgba|.
 * @param rgba Color and alpha parameter (E.g., "rgba(255, 0, 0, 1.0)")
 */
TmaScreen.prototype.fill = function (rgba) {
    this.context.strokeStyle = rgba;
    this.context.fillStyle = rgba;
    this.context.fillRect(0, 0, this.width, this.height);
};

/**
 * Applies effects.
 */
TmaScreen.prototype.applyEffects = function () {
    this._applyBlur();
    this._applyAfterimage();
};

/**
 * Gets mouse information.
 * @return an object containing
 *      over: true if mouse is currently over this screen
 *      x: mouse x position if |over| is true
 *      y: mouse y position if |over| is true
 */
TmaScreen.prototype.mouse = function () {
    if (!this._mouse)
        return { over: this._mouse };
    return {
        over: this._mouse,
        x: this._mouseX,
        y: this._mouseY
    };
};

/**
 * Private implementation to apply afterimage effect.
 */
TmaScreen.prototype._applyAfterimage = function () {
    if (!this._afterimage)
        return;
    this.fill(this._afterimage);
};

/**
 * Private implementation to apply blur effect.
 */
TmaScreen.prototype._applyBlur = function () {
    if (!this._blurRatio)
        return;
    var canvas;
    var context;
    if (this._blurSync) {
        canvas = this._offscreenCanvas;
        context = this._offscreenContext;
    } else {
        canvas = this.canvas;
        context = this.context;
    }
    this._blurContext.drawImage(canvas, 0, 0, this.width, this.height,
        0, 0, this._blurWidth, this._blurHeight);
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = this._blurAlpha;
    context.drawImage(this._blurCanvas, this._blurSource.x,
        this._blurSource.y, this._blurSource.w, this._blurSource.h,
        this._blurDestination.x, this._blurDestination.y,
        this._blurDestination.w, this._blurDestination.h);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    if (this._blurSync)
        this.context.drawImage(canvas, 0, 0);
};

/**
 * Private implementation to update mouse state.
 * @param e DOM MouseEvent
 */
TmaScreen.prototype._onmousemove = function (e) {
    this._mouse = true;
    var rect = e.target.getBoundingClientRect();
    this._mouseX = e.clientX - rect.left;
    this._mouseY = e.clientY - rect.top;
};

/**
 * Private implementation to update mouse state.
 * @param e DOM MouseEvent
 */
TmaScreen.prototype._onmouseout = function (e) {
    this._mouse = false;
};

// node.js compatible export.
exports.TmaScreen = TmaScreen;