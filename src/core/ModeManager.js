/**
 * Mode Manager
 * Handles paint mode switching and mode lifecycle
 */

import { FreeformMode } from '../modes/FreeformMode.js';
import { TimelineMode } from '../modes/TimelineMode.js';
import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { debugLog, debugError } from '../utils/debug.js';
import { showUserFriendlyError } from '../utils/errorMessages.js';
import { findDrumByMidiNote } from '../utils/drumHelpers.js';

/**
 * Mode Manager
 * Centralizes paint mode management and switching
 */
export class ModeManager {
  constructor(options = {}) {
    this.notificationSystem = options.notificationSystem;
    this.stateManager = options.stateManager;

    // Initialize paint modes
    this.freeformMode = new FreeformMode();
    this.chronicleMode = new TimelineMode(DRUM_KIT_CONFIG);

    // Current mode type: 'freeform' or 'timeline'
    this.currentModeType = 'freeform';

    // Callbacks
    this.onModeChange = null;
  }

  /**
   * Get current paint mode instance
   * @returns {Object} Current mode (FreeformMode or TimelineMode)
   */
  getCurrentMode() {
    return this.currentModeType === 'freeform' ? this.freeformMode : this.chronicleMode;
  }

  /**
   * Get freeform mode instance
   */
  getFreeformMode() {
    return this.freeformMode;
  }

  /**
   * Get chronicle/timeline mode instance
   */
  getChronicleMode() {
    return this.chronicleMode;
  }

  /**
   * Get current mode type
   * @returns {string} 'freeform' or 'timeline'
   */
  getModeType() {
    return this.currentModeType;
  }

  /**
   * Set mode type
   * @param {string} modeType - 'freeform' or 'timeline'
   * @param {Object} context - Context for activation (paintCanvas, drumSettings, drumOrder)
   */
  setModeType(modeType, context) {
    if (modeType === this.currentModeType) return;

    // Deactivate current mode
    this.getCurrentMode().onDeactivate(context);

    // Switch mode
    this.currentModeType = modeType;

    // Activate new mode
    this.getCurrentMode().onActivate(context);

    // Trigger callback
    if (this.onModeChange) {
      this.onModeChange(modeType);
    }

    this.stateManager?.scheduleAutoSave();
  }

  /**
   * Set freeform style
   * @param {string} style - Style name
   * @param {Object} context - Context with paintCanvas
   */
  setFreeformStyle(style, context) {
    // Deactivate old style
    const oldStyle = this.freeformMode.getActiveStyle();
    if (oldStyle.onDeactivate) {
      oldStyle.onDeactivate(context);
    }

    // Switch to new style
    this.freeformMode.setStyle(style);

    // Activate new style
    const newStyle = this.freeformMode.getActiveStyle();
    if (newStyle.onActivate) {
      newStyle.onActivate(context);
    }

    this.stateManager?.scheduleAutoSave();
  }

  /**
   * Set timeline layout
   * @param {string} layout - Layout name
   */
  setTimelineLayout(layout) {
    this.chronicleMode.layout = layout;
    this.stateManager?.scheduleAutoSave();
  }

  /**
   * Check if current layout is time-based
   * @returns {boolean}
   */
  isTimeBased() {
    return this.currentModeType === 'timeline' &&
      ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(this.chronicleMode.layout);
  }

  /**
   * Activate current mode
   * @param {Object} context - Context with paintCanvas, drumSettings, drumOrder
   */
  activate(context) {
    this.getCurrentMode().onActivate(context);
  }

  /**
   * Deactivate current mode
   * @param {Object} context - Context with paintCanvas
   */
  deactivate(context) {
    this.getCurrentMode().onDeactivate(context);
  }

  /**
   * Clear current mode
   * @param {Object} context - Context with paintCanvas, currentBgColor
   */
  clear(context) {
    this.getCurrentMode().clear(context);
  }

  /**
   * Paint with current mode
   * @param {number} note - MIDI note
   * @param {number} velocity - MIDI velocity
   * @param {Object} context - Paint context
   */
  paint(note, velocity, context) {
    try {
      this.getCurrentMode().paint(note, velocity, context);
    } catch (error) {
      debugError('Error painting:', error);
      if (this.notificationSystem) {
        showUserFriendlyError(this.notificationSystem, 'PAINT_ERROR', error);
      }
    }
  }

  /**
   * Handle MIDI paint callback
   * @param {number} note - MIDI note
   * @param {number} velocity - MIDI velocity
   * @param {string} deviceId - MIDI device ID
   * @param {Object} options - Additional options
   */
  handlePaint(note, velocity, deviceId, options = {}) {
    const {
      paintCanvas,
      drumSettings,
      globalSizeMultiplier,
      particles,
      strokeCount,
      midiManager,
      debugPanel,
      sessionRecorder,
      currentBgColor
    } = options;

    // Find drum by MIDI note
    const drumId = findDrumByMidiNote(note, deviceId, drumSettings, midiManager);

    if (!drumId) {
      const device = midiManager?.connectedDevices?.find(d => d.id === deviceId);
      const deviceName = device ? device.name : deviceId;
      debugLog(`Unmapped MIDI: Note ${note} from ${deviceName} - not painting`);
      return { painted: false, drumId: null };
    }

    const drumName = drumSettings[drumId]?.name || drumId;
    debugLog(`Paint: Note ${note} (${drumName}), Vel ${velocity.toFixed(2)}`);

    // Record session event if recording is active
    if (sessionRecorder) {
      sessionRecorder.recordEvent(note, velocity, deviceId, drumId);
    }

    // Create context for mode
    const context = {
      paintCanvas,
      drumSettings,
      globalSizeMultiplier,
      particles,
      strokeCount,
      midiDeviceId: deviceId,
      debugPanel,
      drumId,
      DRUM_KIT_CONFIG,
      currentBgColor
    };

    // Paint with current mode
    this.paint(note, velocity, context);

    return { painted: true, drumId };
  }

  /**
   * Update timeline lanes when drums change
   * @param {Object} drumSettings - Drum settings
   * @param {Array} drumOrder - Drum order
   */
  regenerateLanes(drumSettings, drumOrder) {
    this.chronicleMode.regenerateLanes(drumSettings, drumOrder);
  }

  /**
   * Switch to a legacy mode index (for loading old saves)
   * @param {number} oldModeIndex - Old mode index (0-8)
   * @param {Object} context - Context with paintCanvas, drumSettings, drumOrder
   */
  switchLegacyMode(oldModeIndex, context) {
    const modeMap = {
      0: { type: 'freeform', style: 'classic' },
      1: { type: 'timeline', layout: 'fibonacci' },
      2: { type: 'timeline', layout: 'radial' },
      3: { type: 'freeform', style: 'gravity' },
      4: { type: 'freeform', style: 'organic' },
      5: { type: 'freeform', style: 'dendritic' },
      6: { type: 'freeform', style: 'lightning' },
      7: { type: 'timeline', layout: 'spiral' },
      8: { type: 'timeline', layout: 'staff' }
    };

    const mapping = modeMap[oldModeIndex];
    if (!mapping) return;

    // Deactivate current mode
    this.getCurrentMode().onDeactivate(context);

    // Switch to new mode type
    this.currentModeType = mapping.type;

    if (mapping.type === 'freeform') {
      this.freeformMode.setStyle(mapping.style);
    } else {
      this.chronicleMode.layout = mapping.layout;
    }

    // Activate new mode
    this.getCurrentMode().onActivate(context);

    debugLog(`Mode: ${this.getCurrentMode().name}`);
    this.notificationSystem?.show(this.getCurrentMode().name);
  }

  /**
   * Get current app state for saving
   * @param {Object} options - Additional state options
   */
  getAppState(options = {}) {
    const {
      drumSettings,
      drumOrder,
      globalSizeMultiplier,
      currentBlendMode,
      currentBgColor,
      midiManager
    } = options;

    return {
      drumSettings,
      drumOrder,
      globalSizeMultiplier,
      currentBlendMode,
      currentBgColor,
      currentModeType: this.currentModeType,
      freeformStyle: this.freeformMode.style,
      chronicleLayout: this.chronicleMode.layout,
      spiralSettings: {
        tightness: this.chronicleMode.spiralSettings.tightness,
        startRadius: this.chronicleMode.spiralSettings.startRadius,
        syncToBPM: this.chronicleMode.spiralSettings.syncToBPM,
        separateTracks: this.chronicleMode.spiralSettings.separateTracks,
        trackSpacing: this.chronicleMode.spiralSettings.trackSpacing
      },
      timelineSettings: {
        bpm: this.chronicleMode.bpm,
        subdivision: this.chronicleMode.subdivision,
        beatsPerMeasure: this.chronicleMode.beatsPerMeasure,
        metronomeEnabled: this.chronicleMode.metronomeEnabled,
        midiLatencyMs: this.chronicleMode.midiLatencyMs,
        showGrid: this.chronicleMode.showGrid,
        rowSpacing: this.chronicleMode.rowSpacing,
        warmupMeasures: this.chronicleMode.warmupMeasures,
        measuresPerStaffPreference: this.chronicleMode.measuresPerStaffPreference
      },
      bankModeSettings: midiManager ? midiManager.getState() : {}
    };
  }

  /**
   * Load mode state from saved settings
   * @param {Object} savedState - Saved state object
   * @param {Object} context - Context for activation
   */
  loadState(savedState, context) {
    // Load mode type
    if (savedState.currentModeType !== undefined) {
      this.currentModeType = savedState.currentModeType;
    }

    // Load freeform style
    if (savedState.freeformStyle !== undefined) {
      this.freeformMode.setStyle(savedState.freeformStyle);
    }

    // Load chronicle layout
    if (savedState.chronicleLayout !== undefined) {
      this.chronicleMode.layout = savedState.chronicleLayout;
    }

    // Load spiral settings
    if (savedState.spiralSettings) {
      const ss = savedState.spiralSettings;
      if (ss.tightness !== undefined) this.chronicleMode.spiralSettings.tightness = ss.tightness;
      if (ss.startRadius !== undefined) this.chronicleMode.spiralSettings.startRadius = ss.startRadius;
      if (ss.syncToBPM !== undefined) this.chronicleMode.spiralSettings.syncToBPM = ss.syncToBPM;
      if (ss.separateTracks !== undefined) this.chronicleMode.spiralSettings.separateTracks = ss.separateTracks;
      if (ss.trackSpacing !== undefined) this.chronicleMode.spiralSettings.trackSpacing = ss.trackSpacing;
    }

    // Load timeline settings
    if (savedState.timelineSettings) {
      const ts = savedState.timelineSettings;
      if (ts.bpm !== undefined) this.chronicleMode.bpm = ts.bpm;
      if (ts.subdivision !== undefined) this.chronicleMode.subdivision = ts.subdivision;
      if (ts.beatsPerMeasure !== undefined) this.chronicleMode.beatsPerMeasure = ts.beatsPerMeasure;
      if (ts.metronomeEnabled !== undefined) this.chronicleMode.metronomeEnabled = ts.metronomeEnabled;
      if (ts.midiLatencyMs !== undefined) this.chronicleMode.midiLatencyMs = ts.midiLatencyMs;
      if (ts.showGrid !== undefined) this.chronicleMode.showGrid = ts.showGrid;
      if (ts.rowSpacing !== undefined) this.chronicleMode.rowSpacing = ts.rowSpacing;
      if (ts.warmupMeasures !== undefined) this.chronicleMode.warmupMeasures = ts.warmupMeasures;
      if (ts.measuresPerStaffPreference !== undefined) this.chronicleMode.measuresPerStaffPreference = ts.measuresPerStaffPreference;
      if (ts.layout !== undefined) this.chronicleMode.layout = ts.layout;
    }

    debugLog('Mode state loaded:', this.currentModeType, this.freeformMode.style, this.chronicleMode.layout);
  }
}

export default ModeManager;
