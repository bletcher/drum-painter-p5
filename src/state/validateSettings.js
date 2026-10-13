/**
 * Settings Validation
 * Cleans up settings loaded from browser storage, an imported file or a saved
 * project before they touch the app. Files are shared between drummers, so
 * nothing in them is trusted: wrong types are dropped and numbers are clamped.
 */

import { SHAPE_OPTIONS, SCALING_CURVES } from '../config/constants.js';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const DRUM_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SCALING_VALUES = new Set([...Object.values(SCALING_CURVES), 'linear', 'log', 'exp', 'quad']);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function cleanString(value, maxLength = 40) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || undefined;
}

function cleanNumber(value, min, max) {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

function cleanNote(value) {
  if (value === null) return null;
  const n = cleanNumber(value, 0, 127);
  return n === undefined ? undefined : Math.round(n);
}

function cleanDevice(value) {
  if (value === null) return null;
  return typeof value === 'string' ? value.slice(0, 200) : undefined;
}

/**
 * Copy only defined values onto target
 */
function assignDefined(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) target[key] = value;
  }
  return target;
}

function cleanCCMapping(mapping) {
  if (!isObject(mapping)) return undefined;
  return assignDefined({}, {
    cc: mapping.cc === null ? null : cleanNumber(mapping.cc, 0, 1016),
    min: cleanNumber(mapping.min, -1000, 1000),
    max: cleanNumber(mapping.max, -1000, 1000),
    ccMin: cleanNumber(mapping.ccMin, 0, 127),
    ccMax: cleanNumber(mapping.ccMax, 0, 127)
  });
}

/**
 * Validate one drum's settings
 */
export function cleanDrumSettings(drum) {
  if (!isObject(drum)) return null;
  const cleaned = assignDefined({}, {
    name: cleanString(drum.name),
    midiNote: cleanNote(drum.midiNote),
    midiDevice: cleanDevice(drum.midiDevice),
    midiDeviceStable: cleanDevice(drum.midiDeviceStable),
    color: HEX_COLOR.test(drum.color) ? drum.color : undefined,
    shape: SHAPE_OPTIONS.includes(drum.shape) ? drum.shape : undefined,
    opacity: cleanNumber(drum.opacity, 0, 1),
    opacityScaling: SCALING_VALUES.has(drum.opacityScaling) ? drum.opacityScaling : undefined,
    size: cleanNumber(drum.size, 0.05, 10),
    sizeScaling: SCALING_VALUES.has(drum.sizeScaling) ? drum.sizeScaling : undefined,
    strokeEnabled: typeof drum.strokeEnabled === 'boolean' ? drum.strokeEnabled : undefined,
    strokeWeight: cleanNumber(drum.strokeWeight, 0, 50),
    strokeColor: HEX_COLOR.test(drum.strokeColor) ? drum.strokeColor : undefined,
    hueVariation: cleanNumber(drum.hueVariation, 0, 360),
    hueScaling: SCALING_VALUES.has(drum.hueScaling) ? drum.hueScaling : undefined,
    rotation: cleanNumber(drum.rotation, -360, 360)
  });

  if (isObject(drum.midiCC)) {
    cleaned.midiCC = {};
    for (const [param, mapping] of Object.entries(drum.midiCC)) {
      const m = cleanCCMapping(mapping);
      if (m && /^[A-Za-z]{1,40}$/.test(param)) cleaned.midiCC[param] = m;
    }
  }
  return cleaned;
}

/**
 * Validate a whole saved/imported settings object.
 * Unknown keys are dropped; everything the app reads is type-checked.
 * @param {*} state
 * @returns {{state: Object|null, warnings: string[]}}
 */
export function validateSettings(state) {
  const warnings = [];
  if (!isObject(state)) {
    return { state: null, warnings: ['Settings file is not a JSON object'] };
  }

  const out = {
    version: typeof state.version === 'string' ? state.version : '3.0',
    timingVersion: cleanNumber(state.timingVersion, 0, 100)
  };

  // Kit layout
  if (Array.isArray(state.drumKitConfig)) {
    out.drumKitConfig = state.drumKitConfig
      .filter(d => isObject(d) && DRUM_ID.test(d.id))
      .slice(0, 64)
      .map(d => assignDefined({ id: d.id }, {
        name: cleanString(d.name) || d.id,
        defaultMidiNote: cleanNote(d.defaultMidiNote) ?? null,
        defaultColor: HEX_COLOR.test(d.defaultColor) ? d.defaultColor : '#888888'
      }));
    if (out.drumKitConfig.length < state.drumKitConfig.length) warnings.push('Some drums in the file were invalid and skipped');
  }

  if (isObject(state.drumSettings)) {
    out.drumSettings = {};
    for (const [id, drum] of Object.entries(state.drumSettings)) {
      if (!DRUM_ID.test(id)) continue;
      const cleaned = cleanDrumSettings(drum);
      if (cleaned) out.drumSettings[id] = cleaned;
    }
  }

  if (Array.isArray(state.drumOrder)) {
    out.drumOrder = state.drumOrder.filter(id => typeof id === 'string' && DRUM_ID.test(id));
  }

  if (isObject(state.globalSettings)) {
    const g = state.globalSettings;
    out.globalSettings = assignDefined({}, {
      sizeMultiplier: cleanNumber(g.sizeMultiplier, 0.1, 5),
      blendMode: cleanNumber(g.blendMode, 0, 7) !== undefined ? Math.round(cleanNumber(g.blendMode, 0, 7)) : undefined,
      // Old saves stored the background as an index into a fixed list
      bgColor: HEX_COLOR.test(g.bgColor) ? g.bgColor : (Number.isInteger(g.bgColor) ? g.bgColor : undefined)
    });
  }

  for (const key of ['currentModeType', 'freeformStyle', 'chronicleLayout']) {
    const v = cleanString(state[key], 30);
    if (v && /^[a-z-]+$/.test(v)) out[key] = v;
  }
  if (Number.isInteger(state.currentMode)) out.currentMode = state.currentMode;

  if (isObject(state.spiralSettings)) {
    const s = state.spiralSettings;
    out.spiralSettings = assignDefined({}, {
      tightness: cleanNumber(s.tightness, 1, 200),
      startRadius: cleanNumber(s.startRadius, 0, 2000),
      syncToBPM: typeof s.syncToBPM === 'boolean' ? s.syncToBPM : undefined,
      separateTracks: typeof s.separateTracks === 'boolean' ? s.separateTracks : undefined,
      trackSpacing: cleanNumber(s.trackSpacing, 0, 200)
    });
  }

  if (isObject(state.timelineSettings)) {
    const t = state.timelineSettings;
    const bool = (v) => typeof v === 'boolean' ? v : undefined;
    out.timelineSettings = assignDefined({}, {
      bpm: cleanNumber(t.bpm, 20, 400),
      subdivision: [4, 8, 12, 16].includes(Number(t.subdivision)) ? Number(t.subdivision) : undefined,
      beatsPerMeasure: cleanNumber(t.beatsPerMeasure, 1, 16),
      metronomeEnabled: bool(t.metronomeEnabled),
      midiLatencyMs: cleanNumber(t.midiLatencyMs, -50, 200),
      showGrid: bool(t.showGrid),
      gridColor: HEX_COLOR.test(t.gridColor) ? t.gridColor : undefined,
      showDeviationGraph: bool(t.showDeviationGraph),
      deviationGraphMode: ['cumulative', 'actual'].includes(t.deviationGraphMode) ? t.deviationGraphMode : undefined,
      deviationGraphWidth: t.deviationGraphWidth === null ? null : cleanNumber(t.deviationGraphWidth, 100, 3000),
      deviationGraphHeight: t.deviationGraphHeight === null ? null : cleanNumber(t.deviationGraphHeight, 50, 1000),
      rowSpacing: cleanNumber(t.rowSpacing, 0, 200),
      layout: cleanString(t.layout, 20),
      warmupMeasures: cleanNumber(t.warmupMeasures, 0, 8),
      measuresPerStaffPreference: cleanNumber(t.measuresPerStaffPreference, 0, 16),
      tempoAutomationEnabled: bool(t.tempoAutomationEnabled),
      tempoAutomationBpmChange: cleanNumber(t.tempoAutomationBpmChange ?? t.tempoAutomationBpmIncrease, 1, 50),
      tempoAutomationBars: cleanNumber(t.tempoAutomationBars, 1, 64),
      tempoAutomationMaxBpm: cleanNumber(t.tempoAutomationMaxBpm, 20, 400),
      tempoAutomationMinBpm: cleanNumber(t.tempoAutomationMinBpm, 20, 400),
      tempoAutomationDirection: ['increase', 'decrease'].includes(t.tempoAutomationDirection) ? t.tempoAutomationDirection : undefined
    });
  }

  if (isObject(state.bankModeSettings)) {
    const b = state.bankModeSettings;
    const bank = assignDefined({}, {
      bankModeEnabled: typeof b.bankModeEnabled === 'boolean' ? b.bankModeEnabled : undefined,
      activeDrumBank: typeof b.activeDrumBank === 'string' && DRUM_ID.test(b.activeDrumBank) ? b.activeDrumBank : undefined
    });
    if (isObject(b.padAssignments)) {
      bank.padAssignments = {};
      for (const [id, a] of Object.entries(b.padAssignments)) {
        if (DRUM_ID.test(id) && isObject(a)) {
          bank.padAssignments[id] = { note: cleanNote(a.note) ?? null, deviceId: cleanDevice(a.deviceId) ?? null };
        }
      }
    }
    if (isObject(b.globalVariables)) {
      bank.globalVariables = {};
      for (const [key, a] of Object.entries(b.globalVariables)) {
        if (/^[A-Za-z]{1,40}$/.test(key) && isObject(a)) {
          bank.globalVariables[key] = {
            cc: a.cc === null ? null : (cleanNumber(a.cc, 0, 1016) ?? null),
            ccMin: cleanNumber(a.ccMin, 0, 127) ?? 0,
            ccMax: cleanNumber(a.ccMax, 0, 127) ?? 127,
            deviceId: cleanDevice(a.deviceId) ?? null
          };
        }
      }
    }
    if (isObject(b.deviceRegistry) && Array.isArray(b.deviceRegistry.devices)) {
      bank.deviceRegistry = {
        devices: b.deviceRegistry.devices
          .filter(d => isObject(d) && typeof d.stableKey === 'string')
          .slice(0, 50)
          .map(d => ({
            stableKey: d.stableKey.slice(0, 200),
            name: cleanString(d.name, 100) || '',
            manufacturer: cleanString(d.manufacturer, 100) || '',
            lastSeen: cleanNumber(d.lastSeen, 0, 1e15)
          }))
      };
    }
    out.bankModeSettings = bank;
  }

  out.recordOutputPortId = typeof state.recordOutputPortId === 'string' ? state.recordOutputPortId.slice(0, 200) : null;
  out.recordOutputNote = cleanNote(state.recordOutputNote) ?? 36;
  out.recordOutputChannel = Math.round(cleanNumber(state.recordOutputChannel, 1, 16) ?? 1);
  out.sendClockEnabled = state.sendClockEnabled === true;
  out.videoQuality = ['low', 'medium', 'high', 'ultra'].includes(state.videoQuality) ? state.videoQuality : undefined;
  out.videoFormat = ['auto', 'mp4', 'webm-vp9', 'webm-vp8', 'webm'].includes(state.videoFormat) ? state.videoFormat : undefined;
  if (Array.isArray(state.lastPaletteDrumIds)) {
    out.lastPaletteDrumIds = state.lastPaletteDrumIds.filter(id => typeof id === 'string' && DRUM_ID.test(id));
  }
  if (typeof state.timestamp === 'string') out.timestamp = state.timestamp.slice(0, 40);

  return { state: out, warnings };
}
