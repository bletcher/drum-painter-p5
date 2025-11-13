/**
 * Scaling Utilities
 * Functions for applying different velocity scaling curves
 */

import { SCALING_CURVES } from '../config/constants.js';

/**
 * Apply scaling curve to a value (0-1 range)
 * @param {number} value - Input value (0-1)
 * @param {string} scaling - Scaling type (1:1, boost-soft, gate-soft, gate-loud)
 * @returns {number} - Scaled value (0-1)
 */
export function applyScalingCurve(value, scaling) {
  // Note: constrain is a p5.js function, will be available globally
  value = constrain(value, 0, 1);

  switch (scaling) {
    case SCALING_CURVES.FIXED:
      // Fixed: always return 1, ignoring velocity (use full slider value)
      return 1;

    case SCALING_CURVES.BOOST_SOFT:
    case 'log': // Backwards compatibility
    case 'logarithmic':
      // Boost soft: more sensitivity at lower values
      // Using log10(1 + 9x) to map 0->0 and 1->1
      return Math.log10(1 + 9 * value);

    case SCALING_CURVES.GATE_SOFT:
    case 'exp': // Backwards compatibility
    case 'exponential':
      // Gate soft: more sensitivity at higher values, suppresses soft hits
      return Math.pow(value, 2.5);

    case SCALING_CURVES.GATE_LOUD:
    case 'quad': // Backwards compatibility
    case 'quadratic':
      // Gate loud: smooth quadratic curve
      return value * value;

    case SCALING_CURVES.ONE_TO_ONE:
    case 'linear': // Backwards compatibility
    default:
      return value;
  }
}
