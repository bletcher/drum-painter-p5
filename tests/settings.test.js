import { describe, it, expect } from 'vitest';
import { validateSettings } from '../src/state/validateSettings.js';
import { findDrumByMidiNote } from '../src/utils/drumHelpers.js';
import { normalizeCC } from '../src/midi/MidiManager.js';

describe('validateSettings', () => {
  it('rejects non-objects', () => {
    expect(validateSettings(null).state).toBeNull();
    expect(validateSettings('nope').state).toBeNull();
  });

  it('keeps valid drum settings and drops bad values', () => {
    const { state } = validateSettings({
      drumSettings: {
        kick: { name: 'Kick', midiNote: 36, color: '#112233', size: 2, shape: 'circle' },
        snare: { name: 'Snare', midiNote: 300, color: 'red', size: 'huge', shape: 'blob' }
      }
    });
    expect(state.drumSettings.kick).toMatchObject({ name: 'Kick', midiNote: 36, color: '#112233', size: 2, shape: 'circle' });
    expect(state.drumSettings.snare.midiNote).toBe(127); // clamped
    expect(state.drumSettings.snare.color).toBeUndefined();
    expect(state.drumSettings.snare.size).toBeUndefined();
    expect(state.drumSettings.snare.shape).toBeUndefined();
  });

  it('strips markup-looking drum ids and keeps names as plain strings', () => {
    const { state } = validateSettings({
      drumKitConfig: [{ id: '"><img src=x onerror=alert(1)>', name: 'x' }, { id: 'tom_1', name: '<b>Tom</b>' }],
      drumSettings: { '<script>': { name: 'bad' }, tom_1: { name: '<img src=x onerror=alert(1)>' } }
    });
    expect(state.drumKitConfig.map(d => d.id)).toEqual(['tom_1']);
    expect(Object.keys(state.drumSettings)).toEqual(['tom_1']);
    // Names are kept as text; the UI must escape them when rendering
    expect(typeof state.drumSettings.tom_1.name).toBe('string');
  });

  it('maps the old tempoAutomationBpmIncrease key', () => {
    const { state } = validateSettings({ timelineSettings: { tempoAutomationBpmIncrease: 7 } });
    expect(state.timelineSettings.tempoAutomationBpmChange).toBe(7);
  });
});

describe('findDrumByMidiNote', () => {
  const registry = { getStableKey: (id) => ({ 'port-2': 'Kit::Maker' })[id] || null };
  const midiManager = { deviceRegistry: registry };

  it('prefers the exact device, then the same device after reconnect, then any-device mappings', () => {
    const drums = {
      anyKick: { midiNote: 36, midiDevice: null, midiDeviceStable: null },
      kitKick: { midiNote: 36, midiDevice: 'port-1', midiDeviceStable: 'Kit::Maker' }
    };
    // Same physical kit came back on a new port id
    expect(findDrumByMidiNote(36, 'port-2', drums, midiManager)).toBe('kitKick');
    expect(drums.kitKick.midiDevice).toBe('port-2'); // remembered for next time
    // Unknown device falls back to the any-device mapping
    expect(findDrumByMidiNote(36, 'port-9', drums, midiManager)).toBe('anyKick');
  });

  it('never matches a drum mapped to a different device', () => {
    const drums = { kick: { midiNote: 36, midiDevice: 'port-1', midiDeviceStable: 'Other::Kit' } };
    expect(findDrumByMidiNote(36, 'port-2', drums, midiManager)).toBeNull();
  });
});

describe('normalizeCC', () => {
  it('maps the calibrated range to 0-1 and clamps', () => {
    expect(normalizeCC(64, 0, 127)).toBeCloseTo(0.504);
    expect(normalizeCC(10, 20, 100)).toBe(0);
    expect(normalizeCC(120, 20, 100)).toBe(1);
  });

  it('treats a zero-width range as a switch instead of dividing by zero', () => {
    expect(normalizeCC(127, 127, 127)).toBe(1);
    expect(normalizeCC(0, 127, 127)).toBe(0);
  });
});
