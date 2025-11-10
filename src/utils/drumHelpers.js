/**
 * Drum Helper Functions
 * Functions for accessing drum settings and properties
 */

import { SCALING_CURVES, IGNORE_MIDI_DEVICE_ID } from '../config/constants.js';
import { applyScalingCurve } from './scaling.js';

/**
 * Find which drum ID is mapped to a given MIDI note from a specific device
 * Uses stable device keys (name::manufacturer) for robust device matching
 * @param {number} midiNote - MIDI note number
 * @param {string} deviceId - Volatile MIDI device ID
 * @param {Object} drumSettings - Current drum settings object
 * @param {Object} midiManager - Optional MIDI manager for stable key lookup
 * @returns {string|null} - Drum ID or null if not found
 */
export function findDrumByMidiNote(midiNote, deviceId, drumSettings, midiManager = null) {
  // If IGNORE_MIDI_DEVICE_ID is true, just match by note
  if (IGNORE_MIDI_DEVICE_ID) {
    for (let drumId in drumSettings) {
      const drum = drumSettings[drumId];
      if (drum.midiNote === midiNote) {
        return drumId;
      }
    }
    return null;
  }

  // Get stable device key for current device
  let currentStableKey = null;
  if (midiManager && midiManager.deviceRegistry) {
    currentStableKey = midiManager.deviceRegistry.getStableKey(deviceId);
  }

  // PRIORITY 1: Try exact volatile device ID + note match (fastest)
  for (let drumId in drumSettings) {
    const drum = drumSettings[drumId];
    if (drum.midiNote === midiNote && drum.midiDevice === deviceId) {
      return drumId;
    }
  }

  // PRIORITY 2: Try stable device key + note match (handles reconnects)
  if (currentStableKey) {
    for (let drumId in drumSettings) {
      const drum = drumSettings[drumId];
      if (drum.midiNote === midiNote && drum.midiDeviceStable === currentStableKey) {
        // Found match by stable key! Auto-update the volatile device ID
        if (drum.midiDevice !== deviceId) {
          console.log(`🔄 Auto-updating device ID for ${drumId}: ${drum.midiDevice} -> ${deviceId} (stable: ${currentStableKey})`);
          drum.midiDevice = deviceId;
        }
        return drumId;
      }
    }
  }

  // PRIORITY 3: "Any device" mappings (midiDevice and midiDeviceStable are null)
  // This provides backward compatibility and allows global mappings
  for (let drumId in drumSettings) {
    const drum = drumSettings[drumId];
    if (drum.midiNote === midiNote && !drum.midiDevice && !drum.midiDeviceStable) {
      return drumId;
    }
  }

  // PRIORITY 4: Last resort fallback - match by note only (legacy behavior)
  // ONLY match drums without stable keys (true "any device" mode)
  // Do NOT match drums with mismatched stable keys - those are mapped to other devices!
  for (let drumId in drumSettings) {
    const drum = drumSettings[drumId];
    if (drum.midiNote === midiNote && !drum.midiDeviceStable && !drum.midiDevice) {
      // Only log if device tracking is enabled (to help debug missing stable keys)
      if (midiManager && currentStableKey) {
        console.log(`ℹ️ Note-only match for Note ${midiNote}: ${drumId} (no device assigned - works with any device)`);
      }
      return drumId;
    }
  }

  // If we get here, we found a note match but it's assigned to a different device
  // Log this clearly so user knows to remap or remove the old drum
  if (midiManager && currentStableKey) {
    for (let drumId in drumSettings) {
      const drum = drumSettings[drumId];
      if (drum.midiNote === midiNote && drum.midiDeviceStable && drum.midiDeviceStable !== currentStableKey) {
        console.warn(`⚠️ Note ${midiNote} is mapped to ${drumId}, but it's assigned to device "${drum.midiDeviceStable}", not current device "${currentStableKey}"`);
        console.warn(`   → Please remap ${drumId} or remove it from your drum kit`);
      }
    }
  }

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
