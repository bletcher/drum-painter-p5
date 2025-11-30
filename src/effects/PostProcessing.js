/**
 * Post-Processing Effects
 * Canvas 2D-based effects applied after painting (no WebGL)
 */

import { debugLog } from '../utils/debug.js';

export class PostProcessing {
  constructor() {
    this.currentEffect = 'none';
    this.bloomIntensity = 0.5;
    this.bloomThreshold = 180; // Brightness threshold (0-255)
    this.bloomRadius = 15; // Blur radius in pixels
  }

  /**
   * Set the current effect
   * @param {string} effect - 'none', 'bloom'
   */
  setEffect(effect) {
    this.currentEffect = effect;
    debugLog(`Post-processing effect: ${effect}`);
  }

  /**
   * Apply post-processing effect to canvas
   * @param {p5.Graphics} canvas - The paint canvas to process
   */
  apply(canvas) {
    if (this.currentEffect === 'none') return;

    switch (this.currentEffect) {
      case 'bloom':
        this.applyBloom(canvas);
        break;
      default:
        break;
    }
  }

  /**
   * Apply bloom/glow effect
   * Creates a glowing halo around bright areas
   */
  applyBloom(canvas) {
    // Get canvas context
    const ctx = canvas.drawingContext;

    // Save current state
    ctx.save();

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Create temporary canvas for bloom layer
    const bloomCanvas = document.createElement('canvas');
    bloomCanvas.width = canvas.width;
    bloomCanvas.height = canvas.height;
    const bloomCtx = bloomCanvas.getContext('2d', { willReadFrequently: true });

    // Extract bright pixels (threshold-based)
    const bloomData = bloomCtx.createImageData(canvas.width, canvas.height);
    const bloomPixels = bloomData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Calculate brightness (luminance)
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

      // Only keep pixels brighter than threshold
      if (brightness > this.bloomThreshold) {
        bloomPixels[i] = r;
        bloomPixels[i + 1] = g;
        bloomPixels[i + 2] = b;
        bloomPixels[i + 3] = a;
      } else {
        bloomPixels[i] = 0;
        bloomPixels[i + 1] = 0;
        bloomPixels[i + 2] = 0;
        bloomPixels[i + 3] = 0;
      }
    }

    // Put extracted bright pixels on bloom canvas
    bloomCtx.putImageData(bloomData, 0, 0);

    // Apply blur to bloom layer using Canvas 2D filter
    bloomCtx.filter = `blur(${this.bloomRadius}px)`;
    bloomCtx.drawImage(bloomCanvas, 0, 0);

    // Composite bloom layer back onto original with additive blending
    ctx.globalCompositeOperation = 'lighter'; // Additive blend
    ctx.globalAlpha = this.bloomIntensity;
    ctx.drawImage(bloomCanvas, 0, 0);

    // Restore state
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
   * Set bloom threshold (brightness cutoff)
   * @param {number} threshold - 0 to 255
   */
  setBloomThreshold(threshold) {
    this.bloomThreshold = Math.max(0, Math.min(255, threshold));
  }

  /**
   * Set bloom radius (blur amount)
   * @param {number} radius - pixels
   */
  setBloomRadius(radius) {
    this.bloomRadius = Math.max(1, Math.min(50, radius));
  }
}
