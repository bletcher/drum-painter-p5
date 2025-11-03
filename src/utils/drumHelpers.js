/**
 * Drum Helper Functions
 * Functions for accessing drum settings and properties
 */

import { SCALING_CURVES } from '../config/constants.js';
import { applyScalingCurve } from './scaling.js';

/**
 * Find which drum ID is mapped to a given MIDI note
 * @param {number} midiNote - MIDI note number
 * @param {Object} drumSettings - Current drum settings object
 * @returns {string|null} - Drum ID or null if not found
 */
export function findDrumByMidiNote(midiNote, drumSettings) {
  for (let drumId in drumSettings) {
    if (drumSettings[drumId].midiNote === midiNote) {
      return drumId;
    }
  }
  return null;
}

/**
 * Get drum color with optional hue variation
 * @param {number} note - MIDI note number
 * @param {number} velocityNorm - Normalized velocity (0-1)
 * @param {Object} drumSettings - Current drum settings object
 * @returns {p5.Color} - Color object
 */
export function getDrumColor(note, velocityNorm = 1.0, drumSettings) {
  const drumId = findDrumByMidiNote(note, drumSettings);
  if (drumId && drumSettings[drumId]) {
    const settings = drumSettings[drumId];
    // color is a p5.js function
    let col = color(settings.color);

    // Apply hue variation if set (CC already modifies settings.hueVariation)
    if (settings.hueVariation > 0) {
      push();
      colorMode(HSB, 360, 100, 100);
      let h = hue(col);
      let s = saturation(col);
      let b = brightness(col);

      // Apply scaling curve to hue variation based on velocity
      let scaledVariation = applyScalingCurve(velocityNorm, settings.hueScaling || SCALING_CURVES.LINEAR);

      // Add random hue shift (scaled by velocity)
      let maxShift = settings.hueVariation * scaledVariation;
      let hueShift = random(-maxShift, maxShift);
      h = (h + hueShift + 360) % 360;

      col = color(h, s, b);
      pop();
    }

    return col;
  }
  // Default color
  return color(255, 0, 0);
}

/**
 * Get drum shape
 * @param {number} note - MIDI note number
 * @param {Object} drumSettings - Current drum settings object
 * @returns {string} - Shape name
 */
export function getDrumShape(note, drumSettings) {
  const drumId = findDrumByMidiNote(note, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].shape;
  }
  return 'circle';
}

/**
 * Get drum opacity multiplier
 * @param {number} note - MIDI note number
 * @param {Object} drumSettings - Current drum settings object
 * @returns {number} - Opacity multiplier (0-1)
 */
export function getDrumOpacity(note, drumSettings) {
  const drumId = findDrumByMidiNote(note, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].opacity;
  }
  return 1.0;
}

/**
 * Get drum size multiplier
 * @param {number} note - MIDI note number
 * @param {Object} drumSettings - Current drum settings object
 * @returns {number} - Size multiplier
 */
export function getDrumSize(note, drumSettings) {
  const drumId = findDrumByMidiNote(note, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].size;
  }
  return 1.0;
}

/**
 * Get drum stroke settings
 * @param {number} note - MIDI note number
 * @param {Object} drumSettings - Current drum settings object
 * @returns {Object} - Stroke settings {enabled, weight, color}
 */
export function getDrumStroke(note, drumSettings) {
  const drumId = findDrumByMidiNote(note, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return {
      enabled: drumSettings[drumId].strokeEnabled,
      weight: drumSettings[drumId].strokeWeight,
      color: drumSettings[drumId].strokeColor
    };
  }
  return { enabled: false, weight: 2, color: '#000000' };
}

/**
 * Get drum rotation angle
 * @param {number} note - MIDI note number
 * @param {Object} drumSettings - Current drum settings object
 * @returns {number} - Rotation angle in degrees
 */
export function getDrumRotation(note, drumSettings) {
  const drumId = findDrumByMidiNote(note, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].rotation;
  }
  return 0;
}
