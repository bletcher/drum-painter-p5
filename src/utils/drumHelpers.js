/**
 * Drum Helper Functions
 * Functions for accessing drum settings and properties
 */

import { IGNORE_MIDI_DEVICE_ID } from '../config/constants.js';
import { debugLog } from './debug.js';

/**
 * Find which drum ID is mapped to a given MIDI note from a specific device.
 *
 * Match priority (single pass over the kit):
 *   1. Same note on the exact device (volatile Web MIDI port id)
 *   2. Same note on the same physical device after a reconnect (stable name::manufacturer key)
 *   3. Same note with no device assigned ("any device")
 * A drum mapped to a *different* device never matches.
 *
 * @param {number} midiNote - MIDI note number
 * @param {string} deviceId - Volatile MIDI device ID
 * @param {Object} drumSettings - Current drum settings object
 * @param {Object} midiManager - Optional MIDI manager for stable key lookup
 * @returns {string|null} - Drum ID or null if not found
 */
export function findDrumByMidiNote(midiNote, deviceId, drumSettings, midiManager = null) {
  const currentStableKey = midiManager?.deviceRegistry?.getStableKey(deviceId) || null;

  let stableMatch = null;
  let anyDeviceMatch = null;

  for (const drumId in drumSettings) {
    const drum = drumSettings[drumId];
    if (drum.midiNote !== midiNote) continue;

    if (IGNORE_MIDI_DEVICE_ID) return drumId;

    if (drum.midiDevice === deviceId) {
      return drumId;
    }
    if (!stableMatch && currentStableKey && drum.midiDeviceStable === currentStableKey) {
      stableMatch = drumId;
    }
    if (!anyDeviceMatch && !drum.midiDevice && !drum.midiDeviceStable) {
      anyDeviceMatch = drumId;
    }
  }

  if (stableMatch) {
    // The device reconnected with a new port id — remember it for next time
    const drum = drumSettings[stableMatch];
    debugLog(`🔄 Auto-updating device ID for ${stableMatch}: ${drum.midiDevice} -> ${deviceId}`);
    drum.midiDevice = deviceId;
    return stableMatch;
  }

  return anyDeviceMatch;
}
