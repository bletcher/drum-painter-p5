/**
 * Scaling Utilities
 * Functions for applying different velocity scaling curves
 */

import { SCALING_CURVES } from '../config/constants.js';

/**
 * Apply scaling curve to a value (0-1 range)
 * @param {number} value - Input value (0-1)
 * @param {string} scaling - Scaling type (linear, log, exp, quad)
 * @returns {number} - Scaled value (0-1)
 */
export function applyScalingCurve(value, scaling) {
  // Note: constrain is a p5.js function, will be available globally
  value = constrain(value, 0, 1);

  switch (scaling) {
    case SCALING_CURVES.LOGARITHMIC:
      // Log curve: more sensitivity at lower values
      // Using log10(1 + 9x) to map 0->0 and 1->1
      return Math.log10(1 + 9 * value);

    case SCALING_CURVES.EXPONENTIAL:
      // Exponential curve: more sensitivity at higher values
      return Math.pow(value, 2.5);

    case SCALING_CURVES.QUADRATIC:
      // Smooth quadratic curve
      return value * value;

    case SCALING_CURVES.LINEAR:
    default:
      return value;
  }
}
