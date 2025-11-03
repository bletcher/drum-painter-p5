/**
 * Base class for all paint modes
 * Provides common interface and utilities for mode implementations
 */

export class ModeBase {
  constructor(name, baseSize, velocityMult) {
    this.name = name;
    this.baseSize = baseSize;
    this.velocityMult = velocityMult;
  }

  /**
   * Main paint function - must be implemented by subclasses
   * @param {number} note - MIDI note number
   * @param {number} velocity - MIDI velocity (0-1 normalized)
   * @param {Object} context - Painting context with all necessary references
   */
  paint(note, velocity, context) {
    throw new Error(`paint() must be implemented by ${this.name}`);
  }

  /**
   * Get the base size for this mode
   * @returns {number}
   */
  getBaseSize() {
    return this.baseSize;
  }

  /**
   * Get the velocity multiplier for this mode
   * @returns {number}
   */
  getVelocityMult() {
    return this.velocityMult;
  }

  /**
   * Optional initialization when mode is activated
   * @param {Object} context - Painting context
   */
  onActivate(context) {
    // Override if needed
  }

  /**
   * Optional cleanup when mode is deactivated
   * @param {Object} context - Painting context
   */
  onDeactivate(context) {
    // Override if needed
  }
}
