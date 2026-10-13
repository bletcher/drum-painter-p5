/**
 * MIDI Manager
 * Handles all MIDI input, CC processing, Bank Mode, and MIDI Learn
 */

import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { DeviceRegistry } from './DeviceRegistry.js';
import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';
import { Ticker } from '../timing/Ticker.js';

/**
 * Best estimate of when a MIDI message actually arrived, on the performance.now() clock.
 * Web MIDI stamps each message on arrival; fall back to now if the stamp is missing
 * or implausible.
 */
function messageTime(message) {
  const now = performance.now();
  const ts = message.timeStamp;
  if (!(ts > 0) || ts > now + 5 || now - ts > 1000) return now;
  return ts;
}

// Virtual ports (loopMIDI etc.) are rarely what the drummer plays
const VIRTUAL_PORT = /loopmidi|loopbe|virtual|iac driver|midi through|rtpmidi/i;

/**
 * Short label for the status box: a hardware device's name, plus how many
 * other inputs are connected
 */
function describeInputs(inputs) {
  if (inputs.length === 0) return '';
  const primary = inputs.find(i => !VIRTUAL_PORT.test(i.name)) || inputs[0];
  return inputs.length > 1 ? `${primary.name} +${inputs.length - 1} more` : primary.name;
}

/**
 * Map a raw controller value to 0-1 using a calibrated range
 */
export function normalizeCC(value, ccMin = 0, ccMax = 127) {
  const range = ccMax - ccMin;
  if (range <= 0) return value >= ccMax ? 1 : 0;
  return Math.max(0, Math.min(1, (value - ccMin) / range));
}

export class MidiManager {
  constructor(onPaintCallback) {
    this.onPaintCallback = onPaintCallback;
    this.midiReady = false;
    this.midiInput = null;
    this.connectedDevices = [];
    this.lastChannel = null;
    this.lastNote = null;
    this.lastVelocity = null;

    // Device Registry for stable device tracking
    this.deviceRegistry = new DeviceRegistry();
    this.deviceRegistry.onRegistryChange = (event, stableKey, deviceId) => {
      this.handleDeviceRegistryChange(event, stableKey, deviceId);
    };

    // MIDI Learn state
    this.midiLearnMode = false;
    this.midiLearnDrumId = null;
    this.ccLearnMode = false;
    this.ccLearnDrumId = null;
    this.ccLearnParameter = null;
    this.ccLearnCalibrationValues = [];
    this.ccLearnStartTime = 0;

    // Bank Mode state
    this.bankModeEnabled = false;
    this.activeDrumBank = 'kick';
    this.bankPadAssignments = {};
    this.globalVariableAssignments = {
      // Per-drum parameters
      size: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },
      opacity: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },
      hueVariation: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },
      rotation: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },
      strokeWeight: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },

      // Visual style parameters (affect brushstroke/splatter globally)
      splatterDensity: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },          // Splatter droplet count
      splatterConnectionThickness: { cc: null, ccMin: 0, ccMax: 127, deviceId: null }, // Connection width
      splatterSprayIntensity: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },   // Spray dot count
      splatterConnectionAmount: { cc: null, ccMin: 0, ccMax: 127, deviceId: null }, // Connection probability
      splatterCoreSize: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },         // Blob radius
      brushDensity: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },             // Bristles per cluster
      brushOpacity: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },             // Bristle alpha
      brushEdgeSoftness: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },        // Edge variation
      brushStrokeVariation: { cc: null, ccMin: 0, ccMax: 127, deviceId: null },     // Pressure sigma
      splatterSpraySize: { cc: null, ccMin: 0, ccMax: 127, deviceId: null }         // Spray dot size
    };
    this.bankLearnMode = false;
    this.bankLearnType = null;
    this.bankLearnTarget = null;

    // Initialize bank pad assignments
    for (const drum of DRUM_KIT_CONFIG) {
      this.bankPadAssignments[drum.id] = { note: null, deviceId: null };
    }

    // MIDI output — sends a note to a virtual port (e.g. loopMIDI) on record start/stop
    this.midiAccess = null;            // Stored MIDIAccess for output enumeration
    this.recordOutputPortId = null;    // Selected output port ID
    this.recordOutputNote = 36;        // Note to send (default 36 = C2)
    this.recordOutputChannel = 1;      // MIDI channel (1–16)
    this.onOutputDevicesChanged = null; // Callback when output list changes

    // MIDI Clock — sends 24 ppq clock pulses so the DAW locks to Drum Painter's BPM
    this.sendClockEnabled = false;
    this._clockBpm = 120;
    this._nextClockTime = 0;           // Next clock pulse (performance.now() ms)
    this._clockTicker = null;

    // Callbacks
    this.onMidiStatusChange = null;
    this.onBankModeChange = null;
    this.onDeviceMappingsUpdated = null; // Called when device mappings are auto-updated
  }

  /**
   * Setup MIDI access
   */
  async setup() {
    if (!navigator.requestMIDIAccess) {
      debugWarn('WebMIDI not supported');
      return false;
    }

    try {
      const midi = await navigator.requestMIDIAccess();
      await this.onMIDISuccess(midi);
      return true;
    } catch (error) {
      this.onMIDIFailure(error);
      return false;
    }
  }

  /**
   * Handle successful MIDI access
   */
  async onMIDISuccess(midi) {
    infoLog('✓ MIDI Access granted');
    this.midiAccess = midi; // Store for output access
    debugLog('🔍 Raw MIDI object:', midi);
    debugLog('🔍 MIDI inputs map:', midi.inputs);
    debugLog('🔍 MIDI outputs map:', midi.outputs);

    const inputs = Array.from(midi.inputs.values());
    debugLog('📥 Available MIDI inputs:', inputs.map(i => i.name));
    debugLog('📥 Full input details:', inputs.map(i => ({
      name: i.name,
      id: i.id,
      manufacturer: i.manufacturer,
      state: i.state,
      connection: i.connection
    })));

    if (inputs.length === 0) {
      debugWarn('No MIDI devices found');
      this.connectedDevices = [];
      if (this.onMidiStatusChange) {
        this.onMidiStatusChange(false, 'No MIDI devices found', '', []);
      }
      return;
    }

    // Store connected devices and register in device registry
    this.connectedDevices = inputs.map(input => {
      // Register device in registry
      const stableKey = this.deviceRegistry.registerDevice(input);

      return {
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state,
        stableKey: stableKey  // Add stable key for reference
      };
    });

    debugLog('📱 Connected devices:', this.connectedDevices);

    // Connect to all inputs - pass device ID with message
    for (const input of inputs) {
      try {
        // Open the port if it's not already open
        if (input.connection !== 'open') {
          await input.open();
        }
        input.onmidimessage = (message) => this.handleMIDIMessage(message, input.id);
        infoLog(`✅ Connected to: ${input.name} (ID: ${input.id}, state: ${input.connection})`);
      } catch (error) {
        debugWarn(`⚠️ Failed to open ${input.name}:`, error);
        // Still set up the handler in case the port is already open
        input.onmidimessage = (message) => this.handleMIDIMessage(message, input.id);
      }
    }

    // Listen for device state changes (connect/disconnect)
    midi.onstatechange = async (e) => {
      debugLog('🔄 MIDI device state changed:', e.port.name, e.port.state);

      if (e.port.type === 'input') {
        if (e.port.state === 'connected') {
          // Opening a port fires another statechange for the same device; only
          // register (and remap drums) when it is genuinely new or reconnected
          const known = this.deviceRegistry.getDeviceById(e.port.id);
          const isNew = !known || known.state !== 'connected';
          const stableKey = isNew
            ? this.deviceRegistry.registerDevice(e.port)
            : this.deviceRegistry.getStableKey(e.port.id);

          // Connect to new input - open if not already open
          if (e.port.connection !== 'open') {
            try {
              await e.port.open();
            } catch (error) {
              debugWarn(`⚠️ Failed to open ${e.port.name}:`, error);
            }
          }
          e.port.onmidimessage = (message) => this.handleMIDIMessage(message, e.port.id);
          if (isNew) infoLog(`🔌 Newly connected: ${e.port.name} (${stableKey})`);
        } else if (e.port.state === 'disconnected') {
          // Mark device as disconnected in registry
          this.deviceRegistry.markDisconnected(e.port.id);
          debugLog(`📴 Disconnected: ${e.port.name}`);
        }
      }

      // Re-scan devices to update connected devices list
      const newInputs = Array.from(midi.inputs.values());
      this.connectedDevices = newInputs.map(input => {
        const stableKey = this.deviceRegistry.getStableKey(input.id);
        return {
          id: input.id,
          name: input.name,
          manufacturer: input.manufacturer || 'Unknown',
          state: input.state,
          stableKey: stableKey
        };
      });
      debugLog('📱 Updated connected devices:', this.connectedDevices);

      // Notify output device changes
      if (e.port.type === 'output' && this.onOutputDevicesChanged) {
        this.onOutputDevicesChanged(this.getOutputDevices());
      }

      // Update status callback
      if (this.onMidiStatusChange) {
        const primaryDevice = describeInputs(newInputs);
        const connected = newInputs.length > 0;
        this.onMidiStatusChange(connected, connected ? 'Connected' : 'No devices', primaryDevice, this.connectedDevices);
      }
    };

    this.midiReady = true;
    if (this.onMidiStatusChange) {
      const primaryDevice = describeInputs(inputs);
      this.onMidiStatusChange(true, 'Connected', primaryDevice, this.connectedDevices);
    }
  }

  /**
   * Handle MIDI access failure
   */
  onMIDIFailure(error) {
    debugError('MIDI Access failed:', error);
    if (this.onMidiStatusChange) {
      // Usually the browser's permission prompt was blocked or dismissed;
      // the connect card explains how to fix it
      this.onMidiStatusChange(false, 'MIDI blocked: click to fix');
    }
  }

  /**
   * Handle incoming MIDI message
   */
  handleMIDIMessage(message, deviceId) {
    try {
      const data = message.data;
      const command = data[0];
      const note = data[1];
      const velocity = data[2];

      // Extract MIDI channel (channels 1-16 from command byte)
      const channel = (command & 0x0F) + 1;

      // Note On message (144-159 for channels 1-16) with velocity > 0
      if (command >= 144 && command <= 159 && velocity > 0) {
        this.lastChannel = channel;
        this.lastNote = note;
        this.lastVelocity = velocity;
        this.handleNoteOn(note, velocity, deviceId, messageTime(message));
        if (this.onMidiActivity) {
          this.onMidiActivity(channel, note, velocity, deviceId);
        }
      }

      // CC messages (176-191 for channels 1-16)
      if (command >= 176 && command <= 191) {
        this.lastChannel = channel;
        this.handleCC(note, velocity, deviceId); // note=CC number, velocity=CC value
        if (this.onMidiActivity) {
          this.onMidiActivity(channel, null, null, deviceId);
        }
      }

      // Pitch Bend messages (224-239 for channels 1-16)
      if (command >= 224 && command <= 239) {
        this.lastChannel = channel;
        this.handlePitchBend(command, note, velocity, deviceId);
        if (this.onMidiActivity) {
          this.onMidiActivity(channel, null, null, deviceId);
        }
      }
    } catch (error) {
      debugError('Error handling MIDI message:', error);
    }
  }

  /**
   * Handle Note On message
   */
  handleNoteOn(note, velocity, deviceId, timeStamp = performance.now()) {
    // Handle bank mode pad learn
    if (this.bankLearnMode && this.bankLearnType === 'pad' && this.bankLearnTarget) {
      this.bankPadAssignments[this.bankLearnTarget].note = note;
      this.bankPadAssignments[this.bankLearnTarget].deviceId = deviceId;
      const device = this.connectedDevices.find(d => d.id === deviceId);
      const deviceName = device ? device.name : deviceId;
      debugLog(`Bank Pad Learn: Assigned note ${note} from ${deviceName} to ${this.bankLearnTarget}`);
      this.exitLearnMode();
      return;
    }

    // Handle bank mode pad selection (switch active drum)
    if (this.bankModeEnabled) {
      for (const drumId in this.bankPadAssignments) {
        const assignment = this.bankPadAssignments[drumId];
        // Match both note and device (or deviceId is null for "any device")
        if (assignment.note === note && (!assignment.deviceId || assignment.deviceId === deviceId)) {
          this.activeDrumBank = drumId;
          debugLog(`🎚️ BANK PAD: Note ${note} switched active drum to ${drumId}`);
          if (this.onBankModeChange) {
            this.onBankModeChange(drumId);
          }
          return; // Don't paint, just select
        }
      }
    }

    // Handle MIDI learn mode (for drum note mapping)
    if (this.midiLearnMode && this.midiLearnDrumId) {
      this.assignDrumNote(this.midiLearnDrumId, note, deviceId);
      this.exitLearnMode();
      return;
    }

    // Normal painting - normalize velocity to 0-1 and pass device ID and arrival time
    const vel = velocity / 127;
    if (this.onPaintCallback) {
      this.onPaintCallback(note, vel, deviceId, timeStamp);
    }
  }

  /**
   * Handle CC message
   */
  handleCC(ccNumber, ccValue, deviceId) {
    // Handle bank mode variable learn with calibration
    if (this.bankLearnMode && this.bankLearnType === 'variable' && this.bankLearnTarget) {
      this.handleCCLearnCalibration(ccNumber, ccValue, this.bankLearnTarget, true, deviceId);
      return;
    }

    // Handle bank mode CC processing (route to active drum)
    if (this.bankModeEnabled) {
      this.handleBankModeCC(ccNumber, ccValue, deviceId);
      return;
    }

    // Handle direct mode CC learn with calibration
    if (this.ccLearnMode && this.ccLearnDrumId && this.ccLearnParameter) {
      this.handleCCLearnCalibration(ccNumber, ccValue, this.ccLearnParameter, false);
      return;
    }

    // Normal CC processing
    this.handleCCValue(ccNumber, ccValue);
  }

  /**
   * Handle Pitch Bend message
   */
  handlePitchBend(command, lsb, msb, deviceId) {
    const pitchBendValue = (msb * 128) + lsb; // 0-16383
    const normalizedValue = pitchBendValue / 16383; // 0.0-1.0
    const ccValue = Math.round(normalizedValue * 127); // Convert to 0-127 like CC

    const channel = command - 224 + 1; // MIDI channel 1-16
    const pseudoCC = 1000 + channel; // Use 1001-1016 as "CC numbers" for pitch bend

    // Handle learn mode
    if (this.bankLearnMode && this.bankLearnType === 'variable' && this.bankLearnTarget) {
      this.handleCCLearnCalibration(pseudoCC, ccValue, this.bankLearnTarget, true, deviceId);
      return;
    }

    if (this.ccLearnMode && this.ccLearnDrumId && this.ccLearnParameter) {
      this.handleCCLearnCalibration(pseudoCC, ccValue, this.ccLearnParameter, false, deviceId);
      return;
    }

    // Normal processing
    if (this.bankModeEnabled) {
      this.handleBankModeCC(pseudoCC, ccValue, deviceId);
    } else {
      this.handleCCValue(pseudoCC, ccValue);
    }
  }

  /**
   * Handle CC learn calibration (3-second range detection)
   */
  handleCCLearnCalibration(ccNumber, ccValue, target, isBankMode, deviceId) {
    // Start timer on first value
    if (this.ccLearnCalibrationValues.length === 0) {
      this.ccLearnStartTime = Date.now();
      infoLog(`CC Calibration: Move controller through FULL range for 3 seconds...`);
    }

    this.ccLearnCalibrationValues.push(ccValue);

    // After 3 seconds, calculate min/max and assign
    const elapsed = Date.now() - this.ccLearnStartTime;
    if (elapsed >= 3000) {
      const ccMin = Math.min(...this.ccLearnCalibrationValues);
      const ccMax = Math.max(...this.ccLearnCalibrationValues);

      if (isBankMode) {
        this.globalVariableAssignments[target].cc = ccNumber;
        this.globalVariableAssignments[target].ccMin = ccMin;
        this.globalVariableAssignments[target].ccMax = ccMax;
        this.globalVariableAssignments[target].deviceId = deviceId;
        const device = this.connectedDevices.find(d => d.id === deviceId);
        const deviceName = device ? device.name : deviceId;
        infoLog(`Bank Variable Learn Complete: CC ${ccNumber} from ${deviceName} assigned to ${target}`);
      } else {
        // Store CC assignment for drum parameter
        this.ccAssignments = this.ccAssignments || {};
        this.ccAssignments[this.ccLearnDrumId] = this.ccAssignments[this.ccLearnDrumId] || {};
        this.ccAssignments[this.ccLearnDrumId][target] = { cc: ccNumber, ccMin, ccMax };
        infoLog(`CC Learn Complete: CC ${ccNumber} assigned to ${this.ccLearnDrumId}.${target}`);
      }

      debugLog(`  Detected range: ${ccMin}-${ccMax}`);
      this.exitLearnMode();
    }
  }

  /**
   * Handle CC value for direct mode
   */
  handleCCValue(ccNumber, ccValue, drumSettings, updateUICallback) {
    // This needs drumSettings passed from main - will be set via callback
    if (this.handleCCValueCallback) {
      this.handleCCValueCallback(ccNumber, ccValue);
    }
  }

  /**
   * Handle CC value for bank mode
   */
  handleBankModeCC(ccNumber, ccValue, deviceId, drumSettings, updateUICallback) {
    // Find which global variable uses this CC number
    for (const paramKey in this.globalVariableAssignments) {
      const assignment = this.globalVariableAssignments[paramKey];

      // Match both CC number and device (or deviceId is null for "any device")
      if (assignment.cc === ccNumber && (!assignment.deviceId || assignment.deviceId === deviceId)) {
        // Map CC value using detected range (clamped; a zero-width range acts as a switch)
        const normalizedValue = normalizeCC(ccValue, assignment.ccMin ?? 0, assignment.ccMax ?? 127);

        // Callback to update UI and settings
        if (this.handleBankCCCallback) {
          this.handleBankCCCallback(this.activeDrumBank, paramKey, normalizedValue, ccValue, ccNumber);
        }
        return;
      }
    }
  }

  /**
   * Enable MIDI learn for a drum
   */
  startMidiLearn(drumId) {
    this.midiLearnMode = true;
    this.midiLearnDrumId = drumId;
    debugLog(`MIDI Learn: Waiting for note for ${drumId}...`);
  }

  /**
   * Enable CC learn for a parameter
   */
  startCCLearn(drumId, parameter) {
    this.ccLearnMode = true;
    this.ccLearnDrumId = drumId;
    this.ccLearnParameter = parameter;
    this.ccLearnCalibrationValues = [];
    debugLog(`CC Learn: Waiting for CC for ${drumId}.${parameter}...`);
  }

  /**
   * Enable bank mode pad learn
   */
  startBankPadLearn(drumId) {
    this.bankLearnMode = true;
    this.bankLearnType = 'pad';
    this.bankLearnTarget = drumId;
    debugLog(`Bank Pad Learn: Waiting for note for ${drumId}...`);
  }

  /**
   * Enable bank mode variable learn
   */
  startBankVariableLearn(paramKey) {
    this.bankLearnMode = true;
    this.bankLearnType = 'variable';
    this.bankLearnTarget = paramKey;
    this.ccLearnCalibrationValues = [];
    debugLog(`Bank Variable Learn: Waiting for CC for ${paramKey}...`);
  }

  /**
   * Exit all learn modes
   */
  exitLearnMode() {
    this.midiLearnMode = false;
    this.midiLearnDrumId = null;
    this.ccLearnMode = false;
    this.ccLearnDrumId = null;
    this.ccLearnParameter = null;
    this.bankLearnMode = false;
    this.bankLearnType = null;
    this.bankLearnTarget = null;
    this.ccLearnCalibrationValues = [];
  }

  /**
   * Get list of available MIDI output devices
   * @returns {Array<{id: string, name: string}>}
   */
  getOutputDevices() {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.outputs.values()).map(o => ({
      id: o.id,
      name: o.name
    }));
  }

  /**
   * Send a MIDI Note On pulse to the configured output port.
   * Used to trigger recording in Ableton (or any MIDI-mapped DAW).
   * @param {boolean} isStart - true = recording started, false = recording stopped
   */
  sendRecordTriggerNote(isStart) {
    if (!this.recordOutputPortId || !this.midiAccess) return;

    const output = this.midiAccess.outputs.get(this.recordOutputPortId);
    if (!output) {
      debugWarn('Record output port not found:', this.recordOutputPortId);
      return;
    }

    const channel = (this.recordOutputChannel - 1) & 0x0F; // 0-indexed
    const note = this.recordOutputNote & 0x7F;
    const velocity = isStart ? 127 : 64; // Different velocities for start vs stop

    const now = performance.now();
    output.send([0x90 | channel, note, velocity], now); // Note On
    output.send([0x80 | channel, note, 0], now + 50);   // Note Off 50ms later

    debugLog(`📤 MIDI out: Note ${note} vel ${velocity} → ${output.name}`);
  }

  /**
   * Start sending MIDI Clock (24 ppq) at the given BPM.
   * Sends MIDI Start (0xFA) immediately, then schedules 0xF8 clock pulses ahead
   * of time with MIDIOutput.send timestamps (the browser delivers them exactly),
   * driven by a worker ticker so it keeps going when the tab is in the background.
   */
  startMidiClock(bpm) {
    if (!this.recordOutputPortId || !this.midiAccess) return;

    this._clockBpm = bpm;

    const now = performance.now();
    this._sendOutputNow([0xFA]); // MIDI Start — resets DAW bar counter
    this._nextClockTime = now + 2;

    if (!this._clockTicker) {
      this._clockTicker = new Ticker(() => this._runClockScheduler(), 25);
    }
    this._clockTicker.start();
    debugLog(`📤 MIDI Clock started at ${bpm} BPM`);
  }

  /**
   * Stop MIDI Clock and send MIDI Stop (0xFC).
   */
  stopMidiClock() {
    if (this._clockTicker) {
      this._clockTicker.stop();
    }
    this._sendOutputNow([0xFC]); // MIDI Stop
    debugLog('📤 MIDI Clock stopped');
  }

  /**
   * Update clock BPM on the fly (takes effect at next scheduler tick).
   */
  updateClockBpm(bpm) {
    this._clockBpm = bpm;
  }

  _runClockScheduler() {
    if (!this.recordOutputPortId || !this.midiAccess) return;
    const output = this.midiAccess.outputs.get(this.recordOutputPortId);
    if (!output) return;

    const now = performance.now();
    const lookAhead = document.hidden ? 1000 : 100; // ms
    const tickInterval = 60000 / (this._clockBpm * 24); // ms between clock pulses

    // If the scheduler fell far behind (machine asleep), don't flood the port
    if (this._nextClockTime < now - 100) {
      this._nextClockTime = now;
    }

    while (this._nextClockTime < now + lookAhead) {
      output.send([0xF8], this._nextClockTime);
      this._nextClockTime += tickInterval;
    }
  }

  _sendOutputNow(data) {
    if (!this.recordOutputPortId || !this.midiAccess) return;
    const output = this.midiAccess.outputs.get(this.recordOutputPortId);
    if (output) output.send(data);
  }

  /**
   * Toggle bank mode
   */
  toggleBankMode() {
    this.bankModeEnabled = !this.bankModeEnabled;
    debugLog(`Bank Mode: ${this.bankModeEnabled ? 'ON' : 'OFF'}`);
    return this.bankModeEnabled;
  }

  /**
   * Assign drum note (called from external when MIDI learn completes)
   */
  assignDrumNote(drumId, note, deviceId) {
    // Get device info for logging and stable key
    const device = this.connectedDevices.find(d => d.id === deviceId);
    const deviceName = device ? device.name : deviceId;
    const stableKey = device ? device.stableKey : null;

    infoLog(`MIDI Learn: Assigned note ${note} from ${deviceName} to ${drumId}`);

    // This will be handled by callback - pass both volatile ID and stable key
    if (this.onDrumNoteAssigned) {
      this.onDrumNoteAssigned(drumId, note, deviceId, stableKey);
    }
  }

  /**
   * Handle device registry changes (connect/disconnect)
   * Auto-updates drum mappings when devices reconnect
   */
  handleDeviceRegistryChange(event, stableKey, newDeviceId) {
    if (event === 'register') {
      debugLog(`🔄 Device registered: ${stableKey}, checking for drums to update...`);

      // This will be called from main.js to update drum settings
      if (this.onDeviceMappingsUpdated) {
        this.onDeviceMappingsUpdated(stableKey, newDeviceId);
      }
    } else if (event === 'disconnect') {
      debugLog(`⚠️ Device disconnected: ${stableKey}`);
      // Note: We keep the stable key in drum settings so it can reconnect later
    }
  }

  /**
   * Get stable device key from volatile device ID
   */
  getStableDeviceKey(volatileDeviceId) {
    return this.deviceRegistry.getStableKey(volatileDeviceId);
  }

  /**
   * Get current volatile device ID from stable key
   */
  getCurrentDeviceId(stableKey) {
    return this.deviceRegistry.getCurrentId(stableKey);
  }

  /**
   * Check if a device is currently connected by stable key
   */
  isDeviceConnected(stableKey) {
    return this.deviceRegistry.isConnected(stableKey);
  }

  /**
   * Get current state for saving
   */
  getState() {
    return {
      bankModeEnabled: this.bankModeEnabled,
      activeDrumBank: this.activeDrumBank,
      padAssignments: this.bankPadAssignments,
      globalVariables: this.globalVariableAssignments,
      deviceRegistry: this.deviceRegistry.getState()
    };
  }

  /**
   * Load state from saved data
   */
  loadState(state) {
    if (state.bankModeEnabled !== undefined) {
      this.bankModeEnabled = state.bankModeEnabled;
    }
    if (state.activeDrumBank) {
      this.activeDrumBank = state.activeDrumBank;
    }
    if (state.padAssignments) {
      this.bankPadAssignments = state.padAssignments;
    }
    if (state.globalVariables) {
      this.globalVariableAssignments = state.globalVariables;
    }
    if (state.deviceRegistry) {
      this.deviceRegistry.loadState(state.deviceRegistry);
    }
  }
}
