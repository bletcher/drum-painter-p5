/**
 * Color utility for getting drum color with hue variation applied.
 * Uses the already-resolved settings object to avoid redundant drum lookups.
 */

import { applyScalingCurve } from './scaling.js';

/**
 * Get a p5 color from drum settings with hue variation applied.
 * @param {Object} settings - The drum settings object (drumSettings[drumId])
 * @param {number} velocityNorm - Normalized velocity (0-1) for hue scaling
 * @returns {p5.Color} - Color with hue variation applied
 */
export function getColorWithHueVariation(settings, velocityNorm) {
  let col = color(settings.color);

  if (settings.hueVariation > 0) {
    push();
    colorMode(HSB, 360, 100, 100);
    let h = hue(col);
    let s = saturation(col);
    let b = brightness(col);

    let scaledVelocity = applyScalingCurve(velocityNorm, settings.hueScaling || 'linear');
    let hueShift = settings.hueVariation * scaledVelocity;
    h = (h + hueShift) % 360;

    col = color(h, s, b);
    pop();
  }

  return col;
}
