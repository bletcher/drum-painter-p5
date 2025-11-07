/**
 * Drum Helper Functions
 * Functions for accessing drum settings and properties
 */

import { SCALING_CURVES } from '../config/constants.js';
import { applyScalingCurve } from './scaling.js';

/**
 * Find which drum ID is mapped to a given MIDI note from a specific device
 * @param {number} midiNote - MIDI note number
 * @param {string} deviceId - MIDI device ID
 * @param {Object} drumSettings - Current drum settings object
 * @returns {string|null} - Drum ID or null if not found
 */
export function findDrumByMidiNote(midiNote, deviceId, drumSettings) {
  console.log(`🔍 Looking for: Note ${midiNote} from device ${deviceId}`);

  // First try to find exact device+note match
  for (let drumId in drumSettings) {
    const drum = drumSettings[drumId];
    console.log(`  Checking ${drumId}: midiNote=${drum.midiNote}, midiDevice=${drum.midiDevice}`);
    if (drum.midiNote === midiNote && drum.midiDevice === deviceId) {
      console.log(`  ✓ Exact match found: ${drumId}`);
      return drumId;
    }
  }

  // If no device-specific mapping found, check for "any device" mappings (midiDevice is null/undefined)
  // This provides backward compatibility and allows global mappings
  for (let drumId in drumSettings) {
    const drum = drumSettings[drumId];
    if (drum.midiNote === midiNote && !drum.midiDevice) {
      console.log(`  ✓ "Any device" match found: ${drumId}`);
      return drumId;
    }
  }

  console.log(`  ✗ No match found`);
  return null;
}

/**
 * Get drum color with optional hue variation
 * @param {number} note - MIDI note number
 * @param {string} deviceId - MIDI device ID
 * @param {number} velocityNorm - Normalized velocity (0-1)
 * @param {Object} drumSettings - Current drum settings object
 * @returns {p5.Color|null} - Color object or null if not mapped
 */
export function getDrumColor(note, deviceId, velocityNorm = 1.0, drumSettings) {
  const drumId = findDrumByMidiNote(note, deviceId, drumSettings);
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
  // Return null if no mapping found - don't paint!
  return null;
}

/**
 * Get drum shape
 * @param {number} note - MIDI note number
 * @param {string} deviceId - MIDI device ID
 * @param {Object} drumSettings - Current drum settings object
 * @returns {string|null} - Shape name or null if not mapped
 */
export function getDrumShape(note, deviceId, drumSettings) {
  const drumId = findDrumByMidiNote(note, deviceId, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].shape;
  }
  return null;
}

/**
 * Get drum opacity multiplier
 * @param {number} note - MIDI note number
 * @param {string} deviceId - MIDI device ID
 * @param {Object} drumSettings - Current drum settings object
 * @returns {number|null} - Opacity multiplier (0-1) or null if not mapped
 */
export function getDrumOpacity(note, deviceId, drumSettings) {
  const drumId = findDrumByMidiNote(note, deviceId, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].opacity;
  }
  return null;
}

/**
 * Get drum size multiplier
 * @param {number} note - MIDI note number
 * @param {string} deviceId - MIDI device ID
 * @param {Object} drumSettings - Current drum settings object
 * @returns {number|null} - Size multiplier or null if not mapped
 */
export function getDrumSize(note, deviceId, drumSettings) {
  const drumId = findDrumByMidiNote(note, deviceId, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].size;
  }
  return null;
}

/**
 * Get drum stroke settings
 * @param {number} note - MIDI note number
 * @param {string} deviceId - MIDI device ID
 * @param {Object} drumSettings - Current drum settings object
 * @returns {Object|null} - Stroke settings {enabled, weight, color} or null if not mapped
 */
export function getDrumStroke(note, deviceId, drumSettings) {
  const drumId = findDrumByMidiNote(note, deviceId, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return {
      enabled: drumSettings[drumId].strokeEnabled,
      weight: drumSettings[drumId].strokeWeight,
      color: drumSettings[drumId].strokeColor
    };
  }
  return null;
}

/**
 * Get drum rotation angle
 * @param {number} note - MIDI note number
 * @param {string} deviceId - MIDI device ID
 * @param {Object} drumSettings - Current drum settings object
 * @returns {number|null} - Rotation angle in degrees or null if not mapped
 */
export function getDrumRotation(note, deviceId, drumSettings) {
  const drumId = findDrumByMidiNote(note, deviceId, drumSettings);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].rotation;
  }
  return null;
}
