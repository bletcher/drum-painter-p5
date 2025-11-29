/**
 * Debug Logging Utility
 * Conditional logging based on DEBUG_MODE flag
 */

import { DEBUG_MODE } from '../config/constants.js';

/**
 * Debug log - only outputs when DEBUG_MODE is true
 * @param {...any} args - Arguments to log
 */
export function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

/**
 * Debug warn - only outputs when DEBUG_MODE is true
 * @param {...any} args - Arguments to warn
 */
export function debugWarn(...args) {
  if (DEBUG_MODE) {
    console.warn(...args);
  }
}

/**
 * Debug error - always outputs (errors should always be visible)
 * @param {...any} args - Arguments to error
 */
export function debugError(...args) {
  console.error(...args);
}

/**
 * Info log - always outputs (important information)
 * @param {...any} args - Arguments to log
 */
export function infoLog(...args) {
  console.log(...args);
}
