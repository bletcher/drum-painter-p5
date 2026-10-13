/**
 * Post-Processing Effects
 * Display-time effects layered over the paint canvas (the painting itself is
 * never modified, so effects don't accumulate frame after frame).
 */

import { debugLog } from '../utils/debug.js';

// The glow is computed at reduced resolution — it's blurred anyway
const GLOW_DOWNSCALE = 4;
// Rebuild the glow at most this often (ms); compositing it is cheap every frame
const GLOW_REFRESH_MS = 100;

const supportsCanvasFilter = typeof CanvasRenderingContext2D !== 'undefined' &&
  'filter' in CanvasRenderingContext2D.prototype;

export class PostProcessing {
  constructor() {
    this.currentEffect = 'none';
    this.bloomIntensity = 0.5;
    this.bloomRadius = 15; // Blur radius in display pixels

    this.glowCanvas = null;
    this.glowCtx = null;
    this.lastGlowBuild = 0;
  }

  /**
   * Set the current effect
   * @param {string} effect - 'none', 'bloom'
   */
  setEffect(effect) {
    this.currentEffect = effect;
    this.lastGlowBuild = 0;
    debugLog(`Post-processing effect: ${effect}`);
  }

  get isActive() {
    return this.currentEffect !== 'none';
  }

  /**
   * Draw the effect over a region of the display.
   * Arguments match ctx.drawImage's 9-argument form: a source rectangle of the
   * paint canvas (device pixels) and where it was drawn on screen.
   * @param {CanvasRenderingContext2D} ctx - Display context
   * @param {HTMLCanvasElement} source - Paint canvas element
   */
  drawOver(ctx, source, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (this.currentEffect !== 'bloom' || sw <= 0 || sh <= 0) return;

    const gw = Math.max(1, Math.round(dw / GLOW_DOWNSCALE));
    const gh = Math.max(1, Math.round(dh / GLOW_DOWNSCALE));

    if (!this.glowCanvas) {
      this.glowCanvas = document.createElement('canvas');
      this.glowCtx = this.glowCanvas.getContext('2d');
    }

    const now = performance.now();
    const sizeChanged = this.glowCanvas.width !== gw || this.glowCanvas.height !== gh;
    if (sizeChanged || now - this.lastGlowBuild > GLOW_REFRESH_MS) {
      if (sizeChanged) {
        this.glowCanvas.width = gw;
        this.glowCanvas.height = gh;
      }
      const g = this.glowCtx;
      g.clearRect(0, 0, gw, gh);
      if (supportsCanvasFilter) {
        // Push darks toward black so mostly the bright areas glow, then blur
        g.filter = `brightness(1.1) contrast(1.8) blur(${Math.max(1, this.bloomRadius / GLOW_DOWNSCALE)}px)`;
      }
      g.drawImage(source, sx, sy, sw, sh, 0, 0, gw, gh);
      g.filter = 'none';
      this.lastGlowBuild = now;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.bloomIntensity;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.glowCanvas, dx, dy, dw, dh);
    ctx.restore();
  }

  /**
   * Set bloom intensity
   * @param {number} intensity - 0.0 to 1.0
   */
  setBloomIntensity(intensity) {
    this.bloomIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Set bloom radius
   * @param {number} radius - Blur radius in pixels
   */
  setBloomRadius(radius) {
    this.bloomRadius = Math.max(1, radius);
  }
}
