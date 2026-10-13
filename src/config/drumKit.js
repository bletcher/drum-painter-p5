/**
 * Drum Kit Configuration
 * Define your drum kit setup here
 */

import { SCALING_CURVES } from './constants.js';

// ═══════════════════════════════════════════════════════════════
// 🥁 DRUM KIT CONFIGURATION - EASY CUSTOMIZATION!
// ═══════════════════════════════════════════════════════════════
//
// HOW TO CUSTOMIZE YOUR DRUM KIT:
//
// 1. ADD A DRUM: Copy a line and add to the array below
//    { id: 'new_drum', name: 'My Drum', defaultMidiNote: 60, defaultColor: '#FF00FF' }
//
// 2. REMOVE A DRUM: Delete or comment out the line
//
// 3. RENAME A DRUM: Change the 'name' field (or use UI after loading)
//
// 4. REORDER DRUMS: Change the order in this array
//    - Timeline mode uses this order top-to-bottom
//    - Mouse mode cycles through this order with [ ]
//
// FIELD REFERENCE:
// - id: Unique identifier (no spaces, letters/numbers/_)
// - name: Display name (can be changed in UI later)
// - defaultMidiNote: MIDI note number (0-127, use Learn button in UI)
// - defaultColor: Hex color code (#RRGGBB)
//
// EXAMPLES:
// Full kit: Add hi-hat, crash, ride, multiple toms
// Minimal: Keep just 2-3 drums
// Electronic kit: Map to your specific MIDI notes
//
// ═══════════════════════════════════════════════════════════════

// Default notes follow the General MIDI drum map, which most electronic kits
// (Roland, Alesis, Yamaha, …) send out of the box. Use Kit Setup to re-learn
// any pad that sends something different.
export const DRUM_KIT_CONFIG = [
  { id: 'kick', name: 'Kick', defaultMidiNote: 36, defaultColor: '#141E50' },
  { id: 'snare', name: 'Snare', defaultMidiNote: 38, defaultColor: '#C82832' },
  { id: 'snare_rim', name: 'Snare Rim', defaultMidiNote: 40, defaultColor: '#DC8C64' },
  { id: 'hihat_closed', name: 'Hi-Hat', defaultMidiNote: 42, defaultColor: '#E0A800' },
  { id: 'hihat_open', name: 'Open Hi-Hat', defaultMidiNote: 46, defaultColor: '#F2C94C' },
  { id: 'tom_high', name: 'High Tom', defaultMidiNote: 48, defaultColor: '#2D9C8F' },
  { id: 'tom_mid', name: 'Mid Tom', defaultMidiNote: 45, defaultColor: '#3A7CA5' },
  { id: 'floor_tom', name: 'Floor Tom', defaultMidiNote: 43, defaultColor: '#DC6428' },
  { id: 'crash', name: 'Crash', defaultMidiNote: 49, defaultColor: '#8E44AD' },
  { id: 'ride', name: 'Ride', defaultMidiNote: 51, defaultColor: '#6C8E3E' }
];

// Generate DRUM_IDS object from config (for backwards compatibility)
export const DRUM_IDS = {};
DRUM_KIT_CONFIG.forEach(drum => {
  DRUM_IDS[drum.id.toUpperCase()] = drum.id;
});

/**
 * Generate factory default settings from drum kit config
 * @returns {Object} Default settings for all drums
 */
export function generateFactorySettings() {
  const settings = {};
  DRUM_KIT_CONFIG.forEach(drum => {
    settings[drum.id] = createDrumSettings(drum.name, drum.defaultMidiNote, drum.defaultColor);
  });
  return settings;
}

/**
 * Default settings for one drum
 * @param {string} name
 * @param {number|null} midiNote
 * @param {string} color - '#rrggbb'
 */
export function createDrumSettings(name, midiNote, color) {
  return {
    name,
    midiNote,
    midiDevice: null, // Volatile device ID (auto-updated on reconnect)
    midiDeviceStable: null, // Stable device key (name::manufacturer) - persists across reconnects
    color,
    shape: 'circle',
    opacity: 1.0,
    opacityScaling: SCALING_CURVES.ONE_TO_ONE,
    size: 1.0,
    sizeScaling: SCALING_CURVES.ONE_TO_ONE,
    strokeEnabled: false,
    strokeWeight: 2,
    strokeColor: '#000000',
    hueVariation: 0,
    hueScaling: SCALING_CURVES.ONE_TO_ONE,
    rotation: 0,
    // MIDI CC live control mappings (min/max match slider display ranges)
    midiCC: {
      size: { cc: null, min: 30, max: 300, ccMin: 0, ccMax: 127 },           // 30% to 300% (slider range)
      opacity: { cc: null, min: 10, max: 100, ccMin: 0, ccMax: 127 },        // 10% to 100% (slider range)
      hueVariation: { cc: null, min: 0, max: 60, ccMin: 0, ccMax: 127 },     // 0° to 60°
      rotation: { cc: null, min: 0, max: 360, ccMin: 0, ccMax: 127 },        // 0° to 360°
      strokeWeight: { cc: null, min: 1, max: 10, ccMin: 0, ccMax: 127 }      // 1px to 10px
    }
  };
}

/**
 * Generate timeline lane mappings from drum kit config
 * @returns {Object} Mapping of drum IDs to timeline lanes
 */
export function generateTimelineLanes() {
  const lanes = {};
  DRUM_KIT_CONFIG.forEach((drum, index) => {
    lanes[drum.id] = index;
  });
  return lanes;
}

/**
 * Get mouse drum IDs array
 * @returns {Array} Array of drum IDs for mouse testing
 */
export function getMouseDrumIds() {
  return DRUM_KIT_CONFIG.map(d => d.id);
}

/**
 * Get mouse drum names array
 * @returns {Array} Array of drum names for mouse testing
 */
export function getMouseDrumNames() {
  return DRUM_KIT_CONFIG.map(d => d.name);
}
