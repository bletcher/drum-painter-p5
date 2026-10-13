/**
 * Drum Painter - Main Entry Point
 * Modular version with ES6 modules
 */

import {
  PAINT_CANVAS_WIDTH,
  PAINT_CANVAS_HEIGHT,
  BLEND_MODE_NAMES,
  SCROLLBAR_WIDTH,
  SCROLLBAR_TRACK_PADDING,
  SCROLLBAR_THUMB_MIN_HEIGHT,
  SCROLL_SPEED,
  CANVAS_FIT_SCALE,
  VIEWPORT_MARGIN_BOTTOM,
  VIEWPORT_MARGIN_TOP,
  SCROLL_MAX_PADDING,
  MODE_DISPLAY_FRAMES,
  MODE_OVERLAY_TEXT_SIZE,
  CLICK_PAINT_VELOCITY_MAP_MIN,
  CLICK_PAINT_VELOCITY_MAP_MAX,
  CLICK_PAINT_SPEED_MAX
} from './config/constants.js';
import { DRUM_KIT_CONFIG, generateFactorySettings, createDrumSettings } from './config/drumKit.js';
import './styles/app.css';
import { FreeformMode } from './modes/FreeformMode.js';
import { TimelineMode, TIME_BASED_LAYOUTS } from './modes/TimelineMode.js';
import { MidiManager, normalizeCC } from './midi/MidiManager.js';
import { StateManager } from './state/StateManager.js';
import { NotificationSystem } from './ui/Notification.js';
import { DrumCustomizationPanel } from './ui/DrumCustomizationPanel.js';
import { MidiMappingPanel } from './ui/MidiMappingPanel.js';
import { TimelineControls } from './ui/TimelineControls.js';
import { VideoRecorder } from './ui/VideoRecorder.js';
import { AudioVideoMerger } from './utils/AudioVideoMerger.js';
import { DebugPanel } from './ui/DebugPanel.js';
import { findDrumByMidiNote } from './utils/drumHelpers.js';
import { applyAllThemes } from './utils/applyTheme.js';
import { visualStyleManager } from './canvas/VisualStyleManager.js';
import { getBrushTextureCache } from './canvas/BrushTextureCache.js';
import { debugLog, debugWarn, debugError, infoLog } from './utils/debug.js';
import { checkBrowserCompatibility } from './utils/browserCompat.js';
import { showUserFriendlyError } from './utils/errorMessages.js';
import { DarkModeManager } from './utils/darkMode.js';
import { SessionRecorder } from './session/SessionRecorder.js';
import { PostProcessing } from './effects/PostProcessing.js';
import { validateSettings } from './state/validateSettings.js';
import { initRecordingsUI, toggleVideoRecording } from './app/recordingsUI.js';
import { initSessionUI } from './app/sessionUI.js';
import { initMidiDevicesModal, closeMidiDevicesModal } from './app/midiDevicesModal.js';
import { KitSetupWizard } from './features/KitSetupWizard.js';
import { LatencyCalibrator } from './features/LatencyCalibrator.js';
import { KeyboardPads } from './features/KeyboardPads.js';
import { DemoGroove } from './features/DemoGroove.js';
import './styles/features.css';
import { initPanels } from './ui/panels.js';
import { initAccessibility } from './ui/a11y.js';

// ===== GLOBAL STATE =====
let paintCanvas;
let particles = [];
let currentModeType = 'freeform'; // 'staff' (time-based timeline), 'freeform' (random), or 'chronicle' (point-based sequential)
let strokeCount = 0;
let globalSizeMultiplier = 1.0;
let showUI = true;
let currentBgColor = '#ffffff'; // Default white background
let currentBlendMode = 0;
let BLEND_MODES = []; // Will be initialized in setup()
let timelineScrollY = 0; // Vertical scroll offset for timeline mode
let isDraggingScrollbar = false; // Track if user is dragging scrollbar
let scrollbarDragStartY = 0; // Starting Y position of drag

// Drum settings
let drumSettings = generateFactorySettings();
let drumOrder = DRUM_KIT_CONFIG.map(d => d.id); // Explicit ordering of drums

// Expose globals for timeline mode and other modules to access
window.drumSettings = drumSettings;
window.drumOrder = drumOrder;
window.stateManager = null; // Will be set after initialization

// System managers
let midiManager;
let stateManager;
let notificationSystem;
window.notificationSystem = null; // Expose globally for error reporting from other modules
let customizationPanel;
let midiMappingPanel;
let timelineControls;
let videoRecorder;
let audioVideoMerger;

let debugPanel;
let darkModeManager;
let sessionRecorder;
let postProcessing;
let overlayGfx = null; // p5.Graphics off-screen buffer for bottom panel drawing
let overlayCanvas = null; // Raw HTML canvas overlay – visible but not captured by video recording
let overlayHasContent = true; // Whether the overlay needs clearing when leaving time-based layouts
let kitSetupWizard = null;
let keyboardPads = null;

// Higher densities quadruple fill and memory cost for no visible gain here
const MAX_PIXEL_DENSITY = 2;


// Initialize paint modes
const freeformMode = new FreeformMode();
const chronicleMode = new TimelineMode(DRUM_KIT_CONFIG);

// Helper function to get current active mode
function getCurrentMode() {
  // Timeline mode (TimelineMode) handles all structured layouts:
  // - Time-based: staff, spiral, rings, petals, polygon (require Start button, use elapsed time, sync with metronome)
  // - Point-based: fibonacci, radial (advance by hits, no temporal relationship)
  // Freeform mode handles random/unpredictable styles
  return currentModeType === 'freeform' ? freeformMode : chronicleMode;
}

// Helper function to get current app state for saving
function getAppState() {
  return {
    drumSettings,
    drumOrder,
    globalSizeMultiplier,
    currentBlendMode,
    currentBgColor,
    currentModeType,
    freeformStyle: freeformMode.style,
    chronicleLayout: chronicleMode.layout,
    spiralSettings: {
      tightness: chronicleMode.spiralSettings.tightness,

      startRadius: chronicleMode.spiralSettings.startRadius,
      syncToBPM: chronicleMode.spiralSettings.syncToBPM,

      separateTracks: chronicleMode.spiralSettings.separateTracks,
      trackSpacing: chronicleMode.spiralSettings.trackSpacing
    },
    timelineSettings: {
      bpm: chronicleMode.bpm,
      subdivision: chronicleMode.subdivision,
      beatsPerMeasure: chronicleMode.beatsPerMeasure,
      metronomeEnabled: chronicleMode.metronomeEnabled,
      midiLatencyMs: chronicleMode.midiLatencyMs,
      showGrid: chronicleMode.showGrid,
      gridColor: chronicleMode.gridColor,
      showDeviationGraph: chronicleMode.showDeviationGraph,
      deviationGraphMode: chronicleMode.deviationGraphMode,
      deviationGraphWidth: chronicleMode.deviationGraphWidth,
      deviationGraphHeight: chronicleMode.deviationGraphHeight,
      rowSpacing: chronicleMode.rowSpacing,
      layout: chronicleMode.layout,
      warmupMeasures: chronicleMode.warmupMeasures,
      measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference,
      tempoAutomationEnabled: chronicleMode.tempoAutomationEnabled,
      tempoAutomationBpmChange: chronicleMode.tempoAutomationBpmChange,
      tempoAutomationBars: chronicleMode.tempoAutomationBars,
      tempoAutomationMaxBpm: chronicleMode.tempoAutomationMaxBpm,
      tempoAutomationDirection: chronicleMode.tempoAutomationDirection,
      tempoAutomationMinBpm: chronicleMode.tempoAutomationMinBpm
    },
    bankModeSettings: midiManager ? midiManager.getState() : {},
    recordOutputPortId: midiManager ? midiManager.recordOutputPortId : null,
    recordOutputNote: midiManager ? midiManager.recordOutputNote : 36,
    recordOutputChannel: midiManager ? midiManager.recordOutputChannel : 1,
    sendClockEnabled: midiManager ? midiManager.sendClockEnabled : false,
    videoQuality: videoRecorder ? videoRecorder.currentQuality : 'medium',
    videoFormat: videoRecorder ? videoRecorder.currentFormat : 'auto',
    lastPaletteDrumIds: customizationPanel ? customizationPanel.lastPaletteDrumIds : null
  };
}

// ===== P5.JS SKETCH =====

// Using global mode for now (easier for testing)
window.setup = async function() {
  const density = Math.min(MAX_PIXEL_DENSITY, displayDensity());
  pixelDensity(density);

  // Create display canvas
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent(document.body);

  // Initialize blend modes array (needs p5 constants)
  BLEND_MODES = [BLEND, MULTIPLY, SCREEN, OVERLAY, DODGE, BURN, ADD, DIFFERENCE];

  // Create offscreen painting canvas
  paintCanvas = createGraphics(PAINT_CANVAS_WIDTH, PAINT_CANVAS_HEIGHT);
  paintCanvas.pixelDensity(density);
  window.PAINT_CANVAS_DEFAULT_HEIGHT = PAINT_CANVAS_HEIGHT;
  window.PAINT_CANVAS_DEFAULT_DENSITY = density;
  paintCanvas.background(currentBgColor);
  paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

  // Create an off-screen p5.Graphics buffer for drawing the bottom panel
  // (metronome + deviation graph) using the p5 API, and a raw HTML canvas overlay
  // for display. The overlay sits on top of displayCanvas visually but is NOT
  // captured by VideoRecorder's captureStream(), so the panel never appears in recordings.
  overlayGfx = createGraphics(windowWidth, windowHeight);
  // Patch cursor/mouse props so TimelineMode drawing functions work with overlayGfx
  overlayGfx.cursor = (...args) => window.cursor(...args);
  overlayGfx.ARROW = window.ARROW;
  overlayGfx.MOVE = window.MOVE;
  Object.defineProperty(overlayGfx, 'mouseX', { get: () => window.mouseX, configurable: true });
  Object.defineProperty(overlayGfx, 'mouseY', { get: () => window.mouseY, configurable: true });

  // Visible overlay canvas (raw HTML canvas, independent of p5 internals)
  overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = windowWidth * pixelDensity();
  overlayCanvas.height = windowHeight * pixelDensity();
  overlayCanvas.style.position = 'fixed';
  overlayCanvas.style.top = '0';
  overlayCanvas.style.left = '0';
  overlayCanvas.style.width = windowWidth + 'px';
  overlayCanvas.style.height = windowHeight + 'px';
  overlayCanvas.style.pointerEvents = 'none';
  overlayCanvas.style.zIndex = '1';
  document.body.appendChild(overlayCanvas);

  // Handle for debugging in the browser console and automated tests
  window.__drumPainter = {
    chronicleMode,
    freeformMode,
    get drumSettings() { return drumSettings; },
    get midiManager() { return midiManager; },
    get hitQueueLength() { return hitQueue.length; },
    setMode: (type) => { currentModeType = type; }
  };

  // Expose canvases globally
  window.displayCanvas = canvas;
  window.paintCanvas = paintCanvas;
  window.currentBgColor = currentBgColor;
  window.BLEND_MODES = BLEND_MODES;
  window.currentBlendMode = currentBlendMode;
  window.BLEND = BLEND;

  // Helper function to reset timeline scroll
  window.resetTimelineScroll = function() {
    timelineScrollY = 0;
  };

  // Cache DOM elements

  // Apply centralized theme to HTML elements
  applyAllThemes();
  initPanels();
  initAccessibility();

  // Check browser compatibility for MIDI support
  const midiSupported = checkBrowserCompatibility();
  if (!midiSupported) {
    infoLog('⚠️ Web MIDI API not supported in this browser');
  }

  // Initialize system managers
  stateManager = new StateManager();
  window.stateManager = stateManager; // Expose globally for other modules
  notificationSystem = new NotificationSystem();
  window.notificationSystem = notificationSystem; // Expose globally for error reporting
  darkModeManager = new DarkModeManager();
  sessionRecorder = new SessionRecorder(notificationSystem);
  postProcessing = new PostProcessing();

  // Apply saved dark mode preference
  darkModeManager.apply();

  // Initialize visual style manager with brush texture cache reference
  visualStyleManager.setBrushTextureCache(getBrushTextureCache());

  // Initialize MIDI manager with paint callback
  midiManager = new MidiManager(handlePaint);

  // Initialize customization panel
  customizationPanel = new DrumCustomizationPanel(drumSettings, midiManager, stateManager, notificationSystem, chronicleMode, darkModeManager);

  // Initialize MIDI mapping panel
  midiMappingPanel = new MidiMappingPanel(drumSettings, midiManager, notificationSystem, updateActiveDrumIndicator);

  // Initialize video recorder with display canvas.
  // The bottom panel (metronome + deviation graph) is drawn on overlayGfx (not
  // displayCanvas) so it never appears in the video. A relay canvas also crops the
  // grey panel area from the bottom of the recording.
  videoRecorder = new VideoRecorder(window.displayCanvas, notificationSystem);
  // Wire the overlay canvas so staff-mode recordings composite the bottom panel
  videoRecorder.relayOverlay = overlayGfx.canvas;
  videoRecorder.getCaptureRect = () => {
    if (currentModeType !== 'timeline') return null;
    const pd = pixelDensity();
    const canvasW = Math.round(width * pd);
    const canvasH = Math.round(height * pd);
    const panelH_px = Math.round(chronicleMode.getPotentialBottomPanelHeight() * pd);
    const usableH = canvasH - panelH_px;

    const isCircular = ['spiral', 'rings', 'petals', 'polygon'].includes(chronicleMode.layout);
    if (isCircular) {
      // Square crop centered on the painting area — excludes side margins and bottom panel
      const squareSize = Math.min(canvasW, usableH);
      const sx = Math.round((canvasW - squareSize) / 2);
      return { sx, sy: 0, sw: squareSize, sh: squareSize, includeOverlay: false };
    } else {
      // Staff: full canvas including the bottom panel. The relay composites overlayGfx
      // on top so the metronome and deviation graph appear in the recording.
      if (usableH >= canvasH) return null;
      return { sx: 0, sy: 0, sw: canvasW, sh: canvasH, includeOverlay: true };
    }
  };
  videoRecorder.onRecordingStart = () => {
    if (!midiManager) return;
    if (midiManager.sendClockEnabled) {
      midiManager.startMidiClock(chronicleMode ? chronicleMode.bpm : 120);
    }
    midiManager.sendRecordTriggerNote(true);
  };
  videoRecorder.onRecordingStop = () => {
    if (!midiManager) return;
    if (midiManager.sendClockEnabled) {
      midiManager.stopMidiClock();
    }
    midiManager.sendRecordTriggerNote(false);
  };

  // Initialize audio/video merger and the recording UI
  audioVideoMerger = new AudioVideoMerger(notificationSystem);
  initRecordingsUI({ videoRecorder, audioVideoMerger, notificationSystem, stateManager });

  // Initialize timeline controls (pass videoRecorder for integration)
  timelineControls = new TimelineControls(chronicleMode, notificationSystem, videoRecorder);
  timelineControls.onBpmOrTimeSigChange = (bpm, beats) => {
    updateClockInfoDisplay();
    if (midiManager) midiManager.updateClockBpm(bpm);
  };
  timelineControls.initialize();

  // MIDI clock follows tempo changes (automation or edits during a take)
  chronicleMode.onTempoChange = (bpm) => {
    if (midiManager) midiManager.updateClockBpm(bpm);
    updateClockInfoDisplay();
  };

  // Initialize debug panel
  debugPanel = new DebugPanel(drumSettings, midiManager);
  window.debugPanel = debugPanel; // Expose globally for modes to use

  // Set MIDI status callback
  midiManager.onMidiStatusChange = (connected, message, deviceName = '', devices = []) => {
    const statusIndicator = document.getElementById('midi-status-indicator');
    const deviceNameEl = document.getElementById('midi-device-name');

    if (statusIndicator) {
      // Green = connected, Red = no MIDI, Yellow = checking
      statusIndicator.style.background = connected ? '#10b981' : (/No|blocked/.test(message) ? '#ef4444' : '#fbbf24');
    }

    if (deviceNameEl) {
      deviceNameEl.textContent = deviceName || message;
    }

    // Store devices for modal
    window.midiDevicesList = devices;
  };

  // Set MIDI activity callback. Messages can arrive hundreds of times a second
  // (hi-hat pedal CC, rolls), so just remember the latest and update the
  // readout once per animation frame.
  let pendingActivity = null;
  let activityFrameRequested = false;
  let activityLightTimer = null;
  const activityEls = {
    channel: document.getElementById('midi-channel'),
    note: document.getElementById('midi-note'),
    velocity: document.getElementById('midi-velocity'),
    deviceName: document.getElementById('midi-device-name'),
    light: document.getElementById('midi-activity-light')
  };

  function renderMidiActivity() {
    activityFrameRequested = false;
    const { channel, note, velocity, deviceId } = pendingActivity;
    if (activityEls.channel) activityEls.channel.textContent = channel;
    if (note !== null && activityEls.note) activityEls.note.textContent = note;
    if (velocity !== null && activityEls.velocity) activityEls.velocity.textContent = velocity;

    // Show which device sent this message
    if (deviceId && activityEls.deviceName) {
      const device = midiManager.connectedDevices.find(d => d.id === deviceId);
      if (device) activityEls.deviceName.textContent = device.name;
    }

    if (activityEls.light) {
      activityEls.light.style.opacity = '1';
      clearTimeout(activityLightTimer);
      activityLightTimer = setTimeout(() => { activityEls.light.style.opacity = '0'; }, 100);
    }
  }

  midiManager.onMidiActivity = (channel, note, velocity, deviceId) => {
    pendingActivity = { channel, note, velocity, deviceId };
    if (!activityFrameRequested) {
      activityFrameRequested = true;
      requestAnimationFrame(renderMidiActivity);
    }
  };

  // Set MIDI CC handling callbacks
  midiManager.handleCCValueCallback = (ccNumber, ccValue) => {
    handleDirectModeCC(ccNumber, ccValue);
  };

  midiManager.handleBankCCCallback = (drumId, paramKey, normalizedValue, ccValue, ccNumber) => {
    handleBankModeCC(drumId, paramKey, normalizedValue, ccValue, ccNumber);
  };

  midiManager.onDrumNoteAssigned = (drumId, note, deviceId, stableKey) => {
    // Safety check - ensure drum exists in drumSettings
    if (!drumSettings[drumId]) {
      debugError(`Cannot assign MIDI note: Drum "${drumId}" not found in drumSettings`);
      notificationSystem.show(`Error: Drum "${drumId}" not found`, 'error');
      return;
    }

    drumSettings[drumId].midiNote = note;
    drumSettings[drumId].midiDevice = deviceId;
    drumSettings[drumId].midiDeviceStable = stableKey; // Store stable key for reconnection

    // Get device name for notification
    const device = midiManager.connectedDevices.find(d => d.id === deviceId);
    const deviceName = device ? device.name : 'Unknown';

    notificationSystem.show(`${drumId}: Note ${note} (${deviceName})`);
    debugLog(`✓ Mapped ${drumId} to Note ${note} from ${deviceName} (stable: ${stableKey})`);
  };

  // Set device mappings updated callback (auto-updates when devices reconnect)
  midiManager.onDeviceMappingsUpdated = (stableKey, newDeviceId) => {
    debugLog(`🔄 Updating drum mappings for reconnected device: ${stableKey} -> ${newDeviceId}`);

    // Find all drums mapped to this stable key and update their volatile device IDs
    let updatedCount = 0;
    for (const drumId in drumSettings) {
      const drum = drumSettings[drumId];
      if (drum.midiDeviceStable === stableKey) {
        const oldId = drum.midiDevice;
        drum.midiDevice = newDeviceId;
        updatedCount++;
        debugLog(`  ✓ Updated ${drumId}: device ID ${oldId} -> ${newDeviceId}`);
      }
    }

    if (updatedCount > 0) {
      notificationSystem.show(`Updated ${updatedCount} drum mapping${updatedCount > 1 ? 's' : ''} for reconnected device`);
    }
  };

  // Set Bank Mode change callback (updates active drum indicator)
  midiManager.onBankModeChange = (drumId) => {
    updateActiveDrumIndicator();
    notificationSystem.show(`Active: ${drumSettings[drumId]?.name || drumId}`);
  };

  // Record trigger callback — fires when the assigned pad is hit
  midiManager.onRecordTrigger = toggleVideoRecording;

  // MIDI output port change callback — repopulate selector when devices change
  midiManager.onOutputDevicesChanged = (outputs) => {
    populateMidiOutputSelect(outputs);
  };

  // MIDI Out UI wiring
  const outputPortSelect = document.getElementById('record-output-port');
  const outputNoteInput = document.getElementById('record-output-note');
  const outputChannelInput = document.getElementById('record-output-channel');

  if (outputPortSelect) {
    outputPortSelect.addEventListener('change', () => {
      midiManager.recordOutputPortId = outputPortSelect.value || null;
      stateManager.scheduleAutoSave();
    });
  }
  if (outputNoteInput) {
    outputNoteInput.addEventListener('change', () => {
      midiManager.recordOutputNote = parseInt(outputNoteInput.value) || 36;
      stateManager.scheduleAutoSave();
    });
  }
  if (outputChannelInput) {
    outputChannelInput.addEventListener('change', () => {
      midiManager.recordOutputChannel = parseInt(outputChannelInput.value) || 1;
      stateManager.scheduleAutoSave();
    });
  }

  const outputTestBtn = document.getElementById('record-output-test-btn');
  if (outputTestBtn) {
    outputTestBtn.addEventListener('click', () => {
      midiManager.sendRecordTriggerNote(true);
      notificationSystem.show(`Test: Note ${midiManager.recordOutputNote} sent to ${midiManager.recordOutputPortId ? 'loopMIDI' : 'no port selected'}`, 'info');
    });
  }

  const outputClockCheckbox = document.getElementById('record-output-clock');
  const clockInfoDiv = document.getElementById('record-output-clock-info');
  if (outputClockCheckbox) {
    outputClockCheckbox.addEventListener('change', () => {
      midiManager.sendClockEnabled = outputClockCheckbox.checked;
      if (clockInfoDiv) {
        clockInfoDiv.style.display = outputClockCheckbox.checked ? 'block' : 'none';
      }
      updateClockInfoDisplay();
      stateManager.scheduleAutoSave();
    });
  }

  // Setup MIDI devices modal
  initMidiDevicesModal(() => midiManager.connectedDevices);

  // If MIDI access was refused (blocked or dismissed permission prompt),
  // clicking the status box asks again instead of opening the device list
  document.getElementById('midi-status')?.addEventListener('click', async (e) => {
    if (midiManager.midiReady || !navigator.requestMIDIAccess) return;
    e.stopImmediatePropagation();
    if (await midiManager.setup()) {
      migrateDrumMappingsToStableKeys();
      populateMidiOutputSelect(midiManager.getOutputDevices());
      notificationSystem.show('MIDI connected', 'success');
    } else {
      notificationSystem.show('Still blocked. Allow "MIDI devices" in the site settings (icon left of the address bar), then reload.', 'warning');
    }
  }, true);

  // Load saved settings before MIDI connects, so device migrations and
  // reconnect handling work on the user's real mappings
  const isFirstRun = !stateManager.hasSavedSettings();
  await loadSavedSettings();

  // Setup MIDI
  const midiAvailable = await midiManager.setup();
  migrateDrumIdChanges();
  // Upgrade old mappings to stable device keys (survive reconnects)
  migrateDrumMappingsToStableKeys();
  checkForDuplicateNoteMappings();
  populateMidiOutputSelect(midiManager.getOutputDevices());

  // Always regenerate timeline lanes after loading settings
  // This ensures custom drums are available in timeline mode even if we start in freeform
  chronicleMode.regenerateLanes(drumSettings, drumOrder);

  // Initialize UI controls
  initializeUI();

  // Any UI interaction may change what the canvas shows
  for (const type of ['input', 'change', 'click', 'pointerup', 'keyup']) {
    document.addEventListener(type, requestRedraw, true);
  }
  debugLog('🔍 After initializeUI - chronicleMode.metronomeEnabled:', chronicleMode.metronomeEnabled);

  // Activate the current mode (important for initializing mode-specific state)
  getCurrentMode().onActivate({ paintCanvas, drumSettings, drumOrder });

  // Rebuild customization panel to reflect loaded settings (including custom drums)
  customizationPanel.build();

  // Sync timeline controls UI with loaded settings (including metronome checkbox)
  if (timelineControls) {
    debugLog('🔄 Syncing timeline controls UI with loaded settings...');
    timelineControls.syncUI();
  }

  // Set up auto-save system
  stateManager.setAppStateGetter(getAppState);
  stateManager.setOnSaveStatusChange((status) => {
    // Update save indicator in UI
    const saveIndicator = document.getElementById('save-indicator');
    if (saveIndicator) {
      if (status === 'pending') {
        saveIndicator.textContent = '●';
        saveIndicator.style.color = '#fbbf24'; // Yellow
        saveIndicator.title = 'Unsaved changes';
      } else if (status === 'saving') {
        saveIndicator.textContent = '●';
        saveIndicator.style.color = '#60a5fa'; // Blue
        saveIndicator.title = 'Saving...';
      } else if (status === 'saved') {
        saveIndicator.textContent = '●';
        saveIndicator.style.color = '#10b981'; // Green
        saveIndicator.title = 'All changes saved';
        // Fade to grey after 2 seconds
        setTimeout(() => {
          if (!stateManager.hasUnsavedChanges()) {
            saveIndicator.style.color = '#9ca3af'; // Grey
            saveIndicator.title = 'Saved';
          }
        }, 2000);
      }
    }
  });

  initFeatures();
  showWelcome(isFirstRun, midiAvailable);

  // Optional developer tools
  const debugBtn = document.getElementById('debug-btn');
  if (debugBtn && new URLSearchParams(location.search).has('debug')) {
    debugBtn.hidden = false;
  }
  const versionEl = document.getElementById('app-version');
  if (versionEl) versionEl.textContent = `v${__APP_VERSION__}`;
};

/**
 * Drums in kit order, for Kit Setup / keyboard pads / demo
 */
function getKitDrums() {
  return drumOrder
    .filter(id => drumSettings[id])
    .map(id => ({ id, name: drumSettings[id].name, color: drumSettings[id].color, midiNote: drumSettings[id].midiNote }));
}

/**
 * Kit Setup wizard, latency calibration, keyboard pads and demo beat
 */
function initFeatures() {
  kitSetupWizard = new KitSetupWizard({
    getDrums: getKitDrums,
    setHitListener,
    describeDevice: (deviceId) => midiManager.connectedDevices.find(d => d.id === deviceId)?.name || '',
    assign: (drumId, note, deviceId) => {
      // A pad can only belong to one drum: unmap it from any other drum first
      const stableKey = midiManager.getStableDeviceKey(deviceId);
      for (const [id, drum] of Object.entries(drumSettings)) {
        if (id !== drumId && drum.midiNote === note &&
            (!drum.midiDeviceStable || drum.midiDeviceStable === stableKey)) {
          drum.midiNote = null;
        }
      }
      Object.assign(drumSettings[drumId], { midiNote: note, midiDevice: deviceId, midiDeviceStable: stableKey });
    },
    onFinish: () => {
      customizationPanel.build();
      stateManager.saveNow();
      notificationSystem.show('Kit mapping saved', 'success');
    }
  });
  document.getElementById('kit-setup-btn')?.addEventListener('click', () => kitSetupWizard.open());

  const latencyInput = document.getElementById('midi-latency');
  const calibrator = new LatencyCalibrator({
    setHitListener,
    getOffset: () => chronicleMode.midiLatencyMs,
    applyOffset: (ms) => {
      chronicleMode.midiLatencyMs = ms;
      if (latencyInput) latencyInput.value = ms;
      stateManager.scheduleAutoSave();
      notificationSystem.show(`Timing offset set to ${ms} ms`, 'success');
    }
  });
  document.getElementById('calibrate-latency-btn')?.addEventListener('click', () => calibrator.open());

  const padsBtn = document.getElementById('keyboard-pads-btn');
  keyboardPads = new KeyboardPads({
    getDrums: getKitDrums,
    onHit: queueHit,
    onToggle: (enabled) => {
      padsBtn?.setAttribute('aria-pressed', String(enabled));
      notificationSystem.show(enabled
        ? 'Keyboard pads on: A S D F G H J K L ; (Shift = accent, ` or Esc to stop)'
        : 'Keyboard pads off');
    }
  });
  padsBtn?.addEventListener('click', () => keyboardPads.toggle());

  const demoBtn = document.getElementById('demo-btn');
  const demo = new DemoGroove({
    getDrums: getKitDrums,
    onHit: queueHit,
    getTimeline: () => (currentModeType === 'timeline' ? chronicleMode : null),
    getBpm: () => chronicleMode.bpm
  });
  demoBtn?.addEventListener('click', () => {
    const playing = demo.toggle();
    demoBtn.setAttribute('aria-pressed', String(playing));
    demoBtn.textContent = playing ? '■ Stop demo' : '▶ Demo beat';
  });

  document.getElementById('show-shortcuts-btn')?.addEventListener('click', () => window.toggleShortcutsPanel?.());
}

/**
 * First-run / no-MIDI guidance
 */
function showWelcome(isFirstRun, midiAvailable) {
  const devices = midiManager.connectedDevices;
  if (!midiAvailable) {
    // The browser-support banner already explains this
    return;
  }
  if (devices.length === 0) {
    notificationSystem.show(
      'No MIDI kit found. Plug one in, or try the keyboard pads.',
      'info',
      { actionLabel: 'Keyboard pads', onAction: () => keyboardPads.toggle(true) }
    );
  } else if (isFirstRun) {
    notificationSystem.show(
      `Connected to ${(devices.find(d => !/loopmidi|virtual/i.test(d.name)) || devices[0]).name}. Hit some drums! If a pad doesn't paint, run Kit Setup.`,
      'success',
      { actionLabel: 'Kit Setup', onAction: () => kitSetupWizard.open() }
    );
  }
}

// ===== UI INITIALIZATION =====

function initializeUI() {
  // Mode type selector (Freeform / Timeline radio buttons)
  const timelineRadio = document.getElementById('mode-type-timeline');
  const freeformRadio = document.getElementById('mode-type-freeform');
  const timelineLayoutSelector = document.getElementById('timeline-layout-selector');
  const freeformStyleSelector = document.getElementById('freeform-style-selector');
  const timelineLayoutSelect = document.getElementById('timeline-layout-select');
  const freeformStyleSelect = document.getElementById('freeform-style-select');

  // Sync UI with current mode state (important for loading saved settings)
  if (timelineRadio && freeformRadio) {
    if (currentModeType === 'timeline' || currentModeType === 'staff' || currentModeType === 'chronicle') {
      timelineRadio.checked = true;
      currentModeType = 'timeline'; // Normalize old modes
    } else {
      freeformRadio.checked = true;
    }
  }

  // Sync Timeline layout dropdown
  if (timelineLayoutSelect) {
    const allTimelineLayouts = ['fibonacci', 'radial', 'rings', 'petals', 'polygon', 'staff', 'spiral'];
    if (allTimelineLayouts.includes(chronicleMode.layout)) {
      timelineLayoutSelect.value = chronicleMode.layout;
    } else {
      timelineLayoutSelect.value = 'fibonacci'; // Default
    }
  }

  // Sync Freeform style dropdown
  if (freeformStyleSelect) {
    freeformStyleSelect.value = freeformMode.style;
  }

  // Function to update UI visibility based on mode type
  function updateModeUI() {
    const isTimeline = currentModeType === 'timeline';
    const isFreeform = currentModeType === 'freeform';

    // Check if current layout is time-based (staff/spiral/rings/petals/polygon) - these need timeline controls
    const isTimeBased = TIME_BASED_LAYOUTS.includes(chronicleMode.layout);

    // Show/hide appropriate selectors
    if (timelineLayoutSelector) {
      timelineLayoutSelector.style.display = isTimeline ? 'block' : 'none';
    }
    if (freeformStyleSelector) {
      freeformStyleSelector.style.display = isFreeform ? 'block' : 'none';
    }

    // Show/hide Timeline controls (only for time-based layouts: staff/spiral)
    const timelineControlsEl = document.getElementById('timeline-controls');
    if (timelineControlsEl) {
      timelineControlsEl.style.display = (isTimeline && isTimeBased) ? 'block' : 'none';
      // Sync UI controls with timeline mode settings when showing
      if (isTimeline && isTimeBased && timelineControls) {
        timelineControls.syncUI();
      }
    }

    // Show/hide spiral-specific controls (only when in spiral layout)
    const spiralControlsEl = document.getElementById('spiral-controls');
    if (spiralControlsEl) {
      spiralControlsEl.style.display = (isTimeline && chronicleMode.layout === 'spiral') ? 'block' : 'none';
    }

    // Quick Settings video section always visible — Recent Recordings must be accessible in all modes
  }

  // Mode type change handlers
  if (timelineRadio) {
    timelineRadio.addEventListener('change', (e) => {
      if (e.target.checked) {
        getCurrentMode().onDeactivate({ paintCanvas });
        currentModeType = 'timeline';

        // Ensure chronicleMode has a valid layout selected
        const timelineLayoutSelect = document.getElementById('timeline-layout-select');
        if (timelineLayoutSelect) {
          chronicleMode.layout = timelineLayoutSelect.value || 'fibonacci';
        } else {
          chronicleMode.layout = 'fibonacci'; // Default fallback
        }

        getCurrentMode().onActivate({ paintCanvas, drumSettings, drumOrder });
        updateModeUI();

        // Show different notification based on layout type
        const isTimeBased = TIME_BASED_LAYOUTS.includes(chronicleMode.layout);
        notificationSystem.show(isTimeBased ? 'Timeline Mode (time-based)' : 'Timeline Mode (point-based)');
        stateManager.scheduleAutoSave();
      }
    });
  }

  if (freeformRadio) {
    freeformRadio.addEventListener('change', (e) => {
      if (e.target.checked) {
        getCurrentMode().onDeactivate({ paintCanvas });
        // Stop timeline controls interval to prevent memory leak
        if (timelineControls) {
          timelineControls.stopUpdateLoop();
        }
        currentModeType = 'freeform';
        getCurrentMode().onActivate({ paintCanvas, drumSettings, drumOrder });
        updateModeUI();
        notificationSystem.show('Freeform Mode');
        stateManager.scheduleAutoSave();
      }
    });
  }

  // Timeline layout selector
  if (timelineLayoutSelect) {
    timelineLayoutSelect.addEventListener('change', (e) => {
      const layout = e.target.value;
      chronicleMode.layout = layout;
      const layoutName = e.target.options[e.target.selectedIndex].text.split('—')[0].trim();
      notificationSystem.show(layoutName);

      // Update UI visibility based on new layout (time-based vs point-based)
      updateModeUI();
      stateManager.scheduleAutoSave();
    });
  }

  // Freeform style selector
  if (freeformStyleSelect) {
    freeformStyleSelect.addEventListener('change', (e) => {
      const style = e.target.value;

      // Deactivate old style
      const oldStyle = freeformMode.getActiveStyle();
      if (oldStyle.onDeactivate) {
        oldStyle.onDeactivate({ paintCanvas });
      }

      // Switch to new style
      freeformMode.setStyle(style);

      // Activate new style
      const newStyle = freeformMode.getActiveStyle();
      if (newStyle.onActivate) {
        newStyle.onActivate({ paintCanvas });
      }

      const styleName = e.target.options[e.target.selectedIndex].text.split('—')[0].trim();
      notificationSystem.show(styleName);
      stateManager.scheduleAutoSave();
    });
  }

  // Initialize UI state
  updateModeUI();
  window.updateModeUI = updateModeUI;

  // Blend mode selector dropdown
  const blendSelect = document.getElementById('blend-select');
  if (blendSelect) {
    blendSelect.value = currentBlendMode.toString();
    blendSelect.addEventListener('change', (e) => {
      currentBlendMode = parseInt(e.target.value);
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
      window.currentBgColor = currentBgColor; // Update global
      window.currentBlendMode = currentBlendMode; // Update global
      debugLog(`Blend Mode: ${BLEND_MODE_NAMES[currentBlendMode]}`);
      notificationSystem.show(`Blend: ${BLEND_MODE_NAMES[currentBlendMode]}`);
      stateManager.scheduleAutoSave();
    });
  }

  // Post-processing effects dropdown
  const postfxSelect = document.getElementById('postfx-select');
  if (postfxSelect) {
    postfxSelect.addEventListener('change', (e) => {
      const effect = e.target.value;
      postProcessing.setEffect(effect);
      debugLog(`Post-processing: ${effect}`);
      notificationSystem.show(`Post FX: ${effect === 'none' ? 'None' : effect.charAt(0).toUpperCase() + effect.slice(1)}`);
    });
  }

  // Background color picker
  const bgColorPicker = document.getElementById('bg-color-picker');
  const bgColorReset = document.getElementById('bg-color-reset');

  if (bgColorPicker) {
    bgColorPicker.value = currentBgColor;
    bgColorPicker.addEventListener('change', (e) => setBackgroundColor(e.target.value));
  }

  if (bgColorReset) {
    bgColorReset.addEventListener('click', () => setBackgroundColor('#ffffff'));
  }

  // Dark mode toggle
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    // Set initial state from saved preference
    darkModeToggle.checked = darkModeManager.darkMode;

    darkModeToggle.addEventListener('change', (e) => {
      const isDark = darkModeManager.toggle();
      notificationSystem.show(isDark ? 'Dark mode enabled' : 'Light mode enabled');
      debugLog(`Dark mode: ${isDark ? 'ON' : 'OFF'}`);
    });
  }

  // Session recording controls
  initSessionUI(sessionRecorder);

  // Global size slider
  const globalSizeSlider = document.getElementById('global-size');
  const globalSizeVal = document.getElementById('global-size-val');
  if (globalSizeSlider && globalSizeVal) {
    globalSizeSlider.value = globalSizeMultiplier;
    globalSizeVal.textContent = `${globalSizeMultiplier.toFixed(1)}x`;

    globalSizeSlider.addEventListener('input', (e) => {
      globalSizeMultiplier = parseFloat(e.target.value);
      globalSizeVal.textContent = `${globalSizeMultiplier.toFixed(1)}x`;
      window.drumSettings = drumSettings; // Keep window reference fresh
    });
  }

  // Spiral controls
  const spiralTightnessSlider = document.getElementById('spiral-tightness');
  const spiralTightnessDisplay = document.getElementById('spiral-tightness-display');
  if (spiralTightnessSlider && spiralTightnessDisplay) {
    // Update display while dragging
    spiralTightnessSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      spiralTightnessDisplay.textContent = value;
    });

    // Apply parameter only when slider is released (don't reset spiral)
    spiralTightnessSlider.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      chronicleMode.spiralSettings.tightness = value;
      notificationSystem.show(`Tightness: ${value}`);
    });
  }

  // Spiral separate tracks toggle
  const spiralSeparateTracksCheckbox = document.getElementById('spiral-separate-tracks');
  const spiralTrackSpacingRow = document.getElementById('spiral-track-spacing-row');
  if (spiralSeparateTracksCheckbox) {
    spiralSeparateTracksCheckbox.addEventListener('change', (e) => {
      chronicleMode.spiralSettings.separateTracks = e.target.checked;
      if (spiralTrackSpacingRow) {
        spiralTrackSpacingRow.style.display = e.target.checked ? 'flex' : 'none';
      }
      notificationSystem.show(`Separate tracks: ${e.target.checked ? 'On' : 'Off'}`);
      stateManager.scheduleAutoSave();
    });
  }

  // Spiral track spacing slider
  const spiralTrackSpacingSlider = document.getElementById('spiral-track-spacing');
  const spiralTrackSpacingDisplay = document.getElementById('spiral-track-spacing-display');
  if (spiralTrackSpacingSlider && spiralTrackSpacingDisplay) {
    spiralTrackSpacingSlider.addEventListener('input', (e) => {
      spiralTrackSpacingDisplay.textContent = e.target.value;
    });
    spiralTrackSpacingSlider.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      chronicleMode.spiralSettings.trackSpacing = value;
      notificationSystem.show(`Track spacing: ${value}`);
      stateManager.scheduleAutoSave();
    });
  }

  const spiralResetBtn = document.getElementById('spiral-reset-btn');
  if (spiralResetBtn) {
    spiralResetBtn.addEventListener('click', () => {
      // Restart the spiral's clock from the center
      chronicleMode.restartClock();
      stateManager.saveCanvasState(paintCanvas);
      fillBackground();
      notificationSystem.show('Spiral reset', 'info', { actionLabel: 'Undo', onAction: undoCanvas });
    });
  }

  // Recording options collapsible toggle
  const recOptionsHeader = document.getElementById('recording-options-header');
  if (recOptionsHeader) {
    recOptionsHeader.addEventListener('click', () => {
      const content = document.getElementById('recording-options-content');
      const arrow = document.getElementById('recording-options-arrow');
      if (content && arrow) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
        recOptionsHeader.setAttribute('aria-expanded', String(isHidden));
      }
    });
  }

  // Customize button
  const customizeBtn = document.getElementById('customize-btn');
  if (customizeBtn) {
    customizeBtn.addEventListener('click', () => {
      customizationPanel.toggle();
    });
  }

  // MIDI Mapping button
  const midiMappingBtn = document.getElementById('midi-mapping-btn');
  if (midiMappingBtn) {
    midiMappingBtn.addEventListener('click', () => {
      midiMappingPanel.toggle();
    });
  }

  // User Guide button
  const userGuideBtn = document.getElementById('user-guide-btn');
  if (userGuideBtn) {
    userGuideBtn.addEventListener('click', () => {
      if (window.toggleUserGuide) {
        window.toggleUserGuide();
      }
    });
  }

  // Debug button
  const debugBtn = document.getElementById('debug-btn');
  if (debugBtn) {
    debugBtn.addEventListener('click', () => {
      debugPanel.toggle();
    });
  }

  // Close customization button
  const closeBtn = document.getElementById('close-customize-btn');
  const backdrop = document.getElementById('customization-backdrop');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      customizationPanel.toggle();
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      customizationPanel.toggle();
    });
  }

  // Close MIDI mapping button
  const closeMidiBtn = document.getElementById('close-midi-mapping-btn');
  const midiBackdrop = document.getElementById('midi-mapping-backdrop');
  if (closeMidiBtn) {
    closeMidiBtn.addEventListener('click', () => {
      midiMappingPanel.toggle();
    });
  }
  if (midiBackdrop) {
    midiBackdrop.addEventListener('click', () => {
      midiMappingPanel.toggle();
    });
  }

  // Apply Palette button - opens the palette sub-view in the customization panel
  const applyPaletteBtn = document.getElementById('apply-palette-btn');
  if (applyPaletteBtn) {
    applyPaletteBtn.addEventListener('click', () => {
      customizationPanel.openPaletteView();
    });
  }

  // Reset to factory defaults button
  const resetBtn = document.getElementById('reset-factory-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all drum settings to factory defaults?')) {
        const factorySettings = generateFactorySettings();
        for (const drumId in factorySettings) {
          if (drumSettings[drumId]) Object.assign(drumSettings[drumId], factorySettings[drumId]);
        }
        globalSizeMultiplier = 1.0;
        currentBlendMode = 0;
        window.currentBlendMode = currentBlendMode;
        currentBgColor = '#ffffff';
        fillBackground();
        syncControlsToState();

        customizationPanel.build(); // Rebuild UI
        stateManager.saveNow(); // Persist reset to localStorage
        notificationSystem.show('Reset to factory defaults');
      }
    });
  }

  // Clear canvas button
  document.getElementById('clear-canvas-btn')?.addEventListener('click', () => clearCanvas());

  // Export to file button
  const exportBtn = document.getElementById('export-file-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (stateManager.exportToFile(getAppState())) {
        notificationSystem.show('Settings exported!');
      } else {
        notificationSystem.show('Export failed');
      }
    });
  }

  // Import from file button
  const importBtn = document.getElementById('import-file-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const fileInput = document.getElementById('import-file-input');
      if (fileInput) {
        fileInput.click();
      }
    });
  }

  // File input change handler
  const fileInput = document.getElementById('import-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const raw = await stateManager.importFromFile(file);
        const { state, warnings } = validateSettings(raw);
        if (!state || (!state.drumSettings && !state.timelineSettings && !state.globalSettings)) {
          throw new Error('This doesn\'t look like a Drum Painter settings file');
        }
        applyImportedSettings(state);
        notificationSystem.show(warnings.length ? `Imported (${warnings[0]})` : 'Settings imported', warnings.length ? 'warning' : 'success');
      } catch (error) {
        debugError('Error importing settings:', error);
        showUserFriendlyError(notificationSystem, 'FILE_PARSE_ERROR', error);
      }

      // Reset input so same file can be imported again
      e.target.value = '';
    });
  }

  // Keyboard Shortcuts Panel
  const shortcutsPanel = document.getElementById('shortcuts-panel');
  const shortcutsBackdrop = document.getElementById('shortcuts-backdrop');
  const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');

  function toggleShortcutsPanel() {
    const isVisible = shortcutsPanel.style.display === 'block';
    shortcutsPanel.style.display = isVisible ? 'none' : 'block';
    shortcutsBackdrop.style.display = isVisible ? 'none' : 'block';
  }

  function hideShortcutsPanel() {
    shortcutsPanel.style.display = 'none';
    shortcutsBackdrop.style.display = 'none';
  }

  if (closeShortcutsBtn) {
    closeShortcutsBtn.addEventListener('click', hideShortcutsPanel);
  }

  if (shortcutsBackdrop) {
    shortcutsBackdrop.addEventListener('click', hideShortcutsPanel);
  }

  // Expose toggle function globally for keyboard handler
  window.toggleShortcutsPanel = toggleShortcutsPanel;
  window.hideShortcutsPanel = hideShortcutsPanel;

  // User Guide Panel
  const userGuidePanel = document.getElementById('user-guide-panel');
  const userGuideBackdrop = document.getElementById('user-guide-backdrop');
  const closeUserGuideBtn = document.getElementById('close-user-guide-btn');

  function toggleUserGuide() {
    const isVisible = userGuideBackdrop.style.display === 'flex';
    userGuideBackdrop.style.display = isVisible ? 'none' : 'flex';
  }

  function hideUserGuide() {
    userGuideBackdrop.style.display = 'none';
  }

  if (closeUserGuideBtn) {
    closeUserGuideBtn.addEventListener('click', hideUserGuide);
  }

  if (userGuideBackdrop) {
    userGuideBackdrop.addEventListener('click', hideUserGuide);
  }

  // Prevent clicks on the panel from closing it (stop propagation to backdrop)
  if (userGuidePanel) {
    userGuidePanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Prevent scroll events from affecting the canvas
    userGuidePanel.addEventListener('wheel', (e) => {
      e.stopPropagation();
    }, { passive: false });
  }

  // User guide tabs
  const guideTabs = document.querySelectorAll('.guide-level-tab');
  const guideContents = document.querySelectorAll('.guide-content');

  guideTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent closing the guide
      const targetLevel = tab.dataset.level;

      // Active tab styling comes from CSS ([aria-selected="true"])
      guideTabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));

      // Show corresponding content (use display property)
      guideContents.forEach(content => {
        if (content.id === `guide-${targetLevel}`) {
          content.style.display = 'block';
        } else {
          content.style.display = 'none';
        }
      });
    });
  });

  // Expose toggle function globally for keyboard handler
  window.toggleUserGuide = toggleUserGuide;
  window.hideUserGuide = hideUserGuide;

  // Projects: named snapshots of all settings, stored in the browser
  const projectNameInput = document.getElementById('project-name-input');
  const saveProjectBtn = document.getElementById('save-project-btn');
  const loadProjectBtn = document.getElementById('load-project-btn');
  const deleteProjectBtn = document.getElementById('delete-project-btn');
  const projectsList = document.getElementById('projects-list');

  function refreshProjectsList() {
    if (!projectsList) return;
    const projects = stateManager.listProjects();
    projectsList.replaceChildren(new Option('Select a project...', ''));
    for (const [name, project] of Object.entries(projects)) {
      const date = project.timestamp ? new Date(project.timestamp).toLocaleDateString() : '';
      projectsList.appendChild(new Option(date ? `${name} (${date})` : name, name));
    }
  }

  saveProjectBtn?.addEventListener('click', () => {
    const projectName = projectNameInput.value.trim().slice(0, 60);
    if (!projectName) {
      notificationSystem.show('Please enter a project name', 'warning');
      return;
    }
    stateManager.saveProject(projectName, getAppState());
    notificationSystem.show(`Project "${projectName}" saved!`, 'success');
    projectNameInput.value = '';
    refreshProjectsList();
  });

  loadProjectBtn?.addEventListener('click', () => {
    const projectName = projectsList.value;
    if (!projectName) {
      notificationSystem.show('Please select a project', 'warning');
      return;
    }
    try {
      const { state } = validateSettings(stateManager.loadProject(projectName));
      if (!state) {
        notificationSystem.show('Project not found', 'error');
        return;
      }
      applyImportedSettings(state);
      notificationSystem.show(`Project "${projectName}" loaded!`, 'success');
    } catch (error) {
      debugError('Error loading project:', error);
      showUserFriendlyError(notificationSystem, 'PROJECT_LOAD_ERROR', error);
    }
  });

  deleteProjectBtn?.addEventListener('click', () => {
    const projectName = projectsList.value;
    if (!projectName) {
      notificationSystem.show('Please select a project', 'warning');
      return;
    }
    if (confirm(`Delete project "${projectName}"?`)) {
      stateManager.deleteProject(projectName);
      notificationSystem.show(`Project "${projectName}" deleted`, 'info');
      refreshProjectsList();
    }
  });

  // Initialize projects list
  refreshProjectsList();
}

/**
 * Update the MIDI clock info display (BPM and time signature reminder).
 */
function updateClockInfoDisplay() {
  const bpmEl = document.getElementById('record-output-bpm-display');
  const timesigEl = document.getElementById('record-output-timesig-display');
  if (bpmEl && chronicleMode) {
    bpmEl.textContent = chronicleMode.bpm;
  }
  if (timesigEl && chronicleMode) {
    timesigEl.textContent = `${chronicleMode.beatsPerMeasure}/4`;
  }
}

/**
 * Populate the MIDI output port selector
 */
function populateMidiOutputSelect(outputs) {
  const select = document.getElementById('record-output-port');
  if (!select) return;

  const current = select.value;
  select.innerHTML = '<option value="">None</option>';
  outputs.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.name;
    select.appendChild(opt);
  });

  // Restore previous selection if still available
  if (current && select.querySelector(`option[value="${current}"]`)) {
    select.value = current;
  } else if (midiManager.recordOutputPortId) {
    // Try restoring from saved state
    if (select.querySelector(`option[value="${midiManager.recordOutputPortId}"]`)) {
      select.value = midiManager.recordOutputPortId;
    }
  }
}

/**
 * Draw scrollbar for timeline mode
 */
function drawTimelineScrollbar(displayWidth, displayHeight, offsetX, viewportHeight) {
  const effectiveHeight = viewportHeight || height;
  const scrollbarX = offsetX + displayWidth + 5;
  const scrollbarTrackHeight = effectiveHeight - (SCROLLBAR_TRACK_PADDING * 2);
  const scrollbarY = SCROLLBAR_TRACK_PADDING;

  // Only show scrollbar if content is larger than viewport
  if (displayHeight > effectiveHeight) {
    // Calculate scrollbar thumb size and position
    const visibleRatio = effectiveHeight / displayHeight;
    const thumbHeight = Math.max(SCROLLBAR_THUMB_MIN_HEIGHT, scrollbarTrackHeight * visibleRatio);
    const scrollRange = displayHeight - effectiveHeight;
    const scrollRatio = Math.abs(timelineScrollY) / scrollRange;
    const thumbY = scrollbarY + scrollRatio * (scrollbarTrackHeight - thumbHeight);

    // Draw scrollbar track
    push();
    fill(220);
    noStroke();
    rect(scrollbarX, scrollbarY, SCROLLBAR_WIDTH, scrollbarTrackHeight, 6);

    // Draw scrollbar thumb
    if (isDraggingScrollbar || isMouseOverScrollbar(scrollbarX, thumbY, SCROLLBAR_WIDTH, thumbHeight)) {
      fill(100);
    } else {
      fill(150);
    }
    rect(scrollbarX, thumbY, SCROLLBAR_WIDTH, thumbHeight, 6);
    pop();

    // Store scrollbar bounds for mouse interaction
    window.scrollbarBounds = {
      x: scrollbarX,
      y: scrollbarY,
      width: SCROLLBAR_WIDTH,
      trackHeight: scrollbarTrackHeight,
      thumbY: thumbY,
      thumbHeight: thumbHeight,
      scrollRange: scrollRange
    };
  } else {
    window.scrollbarBounds = null;
  }
}

/**
 * Check if mouse is over scrollbar thumb
 */
function isMouseOverScrollbar(x, y, w, h) {
  return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
}

// ===== RENDER LOOP =====

// Hits are queued by the MIDI/keyboard handlers and painted at the start of the
// next frame, so a burst of notes (flams, rolls) never blocks MIDI input. Each
// hit carries its own timestamp, so deferring the drawing doesn't move it in time.
const hitQueue = [];
const MAX_QUEUED_HITS = 2000;

// Skip redrawing when nothing on screen can have changed
let needsRedraw = true;
let lastRedrawTime = 0;
const IDLE_REDRAW_MS = 500;

function requestRedraw() {
  needsRedraw = true;
}
window.requestRedraw = requestRedraw;

function isTimeBasedLayout() {
  return currentModeType === 'timeline' && TIME_BASED_LAYOUTS.includes(chronicleMode.layout);
}

/**
 * True while something on screen is moving and must be redrawn every frame
 */
function isAnimating() {
  return particles.length > 0 ||
    hitQueue.length > 0 ||
    frameCount < MODE_DISPLAY_FRAMES ||
    (isTimeBasedLayout() && chronicleMode.recording) ||
    !!videoRecorder?.isRecording ||
    isDraggingScrollbar ||
    chronicleMode.metronomeDragging ||
    chronicleMode.deviationGraphDragging ||
    chronicleMode.deviationGraphResizing;
}

/**
 * Paint every queued hit
 */
function processHitQueue() {
  if (hitQueue.length === 0) return;
  const hits = hitQueue.splice(0, hitQueue.length);
  for (const hit of hits) {
    paintHit(hit);
  }
}

window.draw = function() {
  processHitQueue();

  const now = performance.now();
  if (!needsRedraw && !isAnimating() && now - lastRedrawTime < IDLE_REDRAW_MS) {
    return;
  }
  needsRedraw = false;
  lastRedrawTime = now;

  background(darkModeManager?.darkMode ? 24 : 240);

  // Fit the painting to the window width; tall canvases scroll vertically
  const isTimeBased = isTimeBasedLayout();
  const scaleFactor = (width / paintCanvas.width) * CANVAS_FIT_SCALE;
  const displayWidth = paintCanvas.width * scaleFactor;
  const displayHeight = paintCanvas.height * scaleFactor;
  const offsetX = (width - displayWidth) / 2;
  let offsetY;

  if (isTimeBased) {
    offsetY = timelineScrollY;
  } else if (displayHeight <= height) {
    // Canvas fits: center it
    offsetY = (height - displayHeight) / 2;
    timelineScrollY = 0;
  } else {
    offsetY = timelineScrollY;
  }

  // Get bottom panel height for timeline mode (graph + metronome area)
  const bottomPanelHeight = isTimeBased ? chronicleMode.getBottomPanelHeight() : 0;
  const staffViewportHeight = height - bottomPanelHeight;

  const ctx = drawingContext;
  if (isTimeBased && bottomPanelHeight > 0) {
    // Clip staff rendering to area above the bottom panel
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, staffViewportHeight);
    ctx.clip();
  }

  // Draw only the visible slice of the paint canvas — staff sessions can make it
  // many screens tall
  const srcTop = Math.max(0, -offsetY / scaleFactor);
  const srcBottom = Math.min(paintCanvas.height, (staffViewportHeight - offsetY) / scaleFactor);
  if (srcBottom > srcTop) {
    const pd = paintCanvas.pixelDensity();
    const sx = 0;
    const sy = srcTop * pd;
    const sw = paintCanvas.width * pd;
    const sh = (srcBottom - srcTop) * pd;
    const dy = offsetY + srcTop * scaleFactor;
    const dh = (srcBottom - srcTop) * scaleFactor;
    ctx.drawImage(paintCanvas.elt, sx, sy, sw, sh, offsetX, dy, displayWidth, dh);

    if (postProcessing?.isActive) {
      postProcessing.drawOver(ctx, paintCanvas.elt, sx, sy, sw, sh, offsetX, dy, displayWidth, dh);
    }
  }

  // Draw timeline guides OVER the canvas if in time-based layout
  if (isTimeBased) {
    chronicleMode.drawLaneGuides(window, offsetX, offsetY, scaleFactor, paintCanvas, staffViewportHeight);
  }

  if (isTimeBased && bottomPanelHeight > 0) {
    ctx.restore();
  }

  // Bottom panel (metronome + deviation graph) goes on the overlay canvas, NOT on
  // displayCanvas, so it never appears in video recordings.
  if (isTimeBased || overlayHasContent) {
    overlayGfx.clear();
    if (isTimeBased && bottomPanelHeight > 0) {
      overlayGfx.noStroke();
      overlayGfx.fill(240);
      overlayGfx.rect(0, staffViewportHeight, width, bottomPanelHeight);
      overlayGfx.stroke(200);
      overlayGfx.strokeWeight(1);
      overlayGfx.line(0, staffViewportHeight, width, staffViewportHeight);
    }

    if (isTimeBased) {
      chronicleMode.drawCircularMetronome(overlayGfx, width, height);
      chronicleMode.drawDeviationGraph(overlayGfx, offsetX, offsetY, scaleFactor, drumSettings);
    }

    // Copy the off-screen p5 buffer to the visible overlay HTML canvas
    const overlayCtx = overlayCanvas.getContext('2d');
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCtx.drawImage(overlayGfx.canvas, 0, 0);
    overlayHasContent = isTimeBased;
  }

  if (isTimeBased) {
    // Auto-scroll to keep current playhead visible when recording
    if (chronicleMode.recording && chronicleMode.startTime !== null && chronicleMode.layout === 'staff') {
      const staffInfo = chronicleMode.getCurrentStaffInfo();
      const currentStaffY = staffInfo.staffY * scaleFactor;

      // Use the staff viewport (above panel) as the effective height
      const effectiveHeight = staffViewportHeight;
      const targetStaffTopOnScreen = effectiveHeight - VIEWPORT_MARGIN_BOTTOM - (chronicleMode.staffHeight * scaleFactor);

      const scrollNeededForThisStaff = targetStaffTopOnScreen - currentStaffY;
      const newScrollY = Math.min(0, scrollNeededForThisStaff);

      if (newScrollY < timelineScrollY) {
        timelineScrollY = newScrollY;
      }

      const maxScroll = Math.max(0, displayHeight - effectiveHeight + SCROLL_MAX_PADDING);
      timelineScrollY = Math.max(-maxScroll, timelineScrollY);
    }
  }

  // Draw scrollbar for any mode if canvas is taller than viewport
  // Constrain scrollbar to staff area (above bottom panel)
  if (displayHeight > staffViewportHeight) {
    drawTimelineScrollbar(displayWidth, displayHeight, offsetX, staffViewportHeight);
  } else {
    window.scrollbarBounds = null;
  }

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display(offsetX, offsetY, scaleFactor);
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // Backstop for the metronome scheduler (it normally runs on its own timer)
  if (isTimeBased) {
    chronicleMode.update({ paintCanvas });
  }

  // Show mode name briefly
  if (frameCount < MODE_DISPLAY_FRAMES) {
    push();
    fill(0, 150);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(MODE_OVERLAY_TEXT_SIZE);
    text(getCurrentMode().name, width / 2, VIEWPORT_MARGIN_TOP);
    pop();
  }

  // Relay cropped frame to the recording canvas (excludes grey panel area from video)
  if (videoRecorder?.isRecording && videoRecorder?.relayCanvas) {
    const htmlCanvas = window.displayCanvas.elt || window.displayCanvas.canvas || window.displayCanvas;
    videoRecorder.relayFrame(htmlCanvas);
  }
};

// Anything the user does might change what's on screen
window.mouseMoved = requestRedraw;

/**
 * Show or hide all panels (H)
 */
function toggleUI() {
  showUI = !showUI;
  for (const id of ['controls', 'drum-settings']) {
    const el = document.getElementById(id);
    if (el) el.style.display = showUI ? 'block' : 'none';
  }
  // Close modal panels when hiding UI
  if (!showUI) {
    if (customizationPanel.isVisible) customizationPanel.toggle();
    if (midiMappingPanel.isVisible) midiMappingPanel.toggle();
  }
}

function cycleBlendMode() {
  currentBlendMode = (currentBlendMode + 1) % BLEND_MODES.length;
  paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
  window.currentBlendMode = currentBlendMode;
  const blendSelect = document.getElementById('blend-select');
  if (blendSelect) blendSelect.value = currentBlendMode.toString();
  notificationSystem.show(`Blend: ${BLEND_MODE_NAMES[currentBlendMode]}`);
}

function saveImage() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `drum-painter-${timestamp}.png`;
  paintCanvas.save(filename);
  notificationSystem.show(`Saved: ${filename}`);
}

/**
 * Step a <select> to the previous/next option and fire its change handler
 */
function stepSelect(id, direction) {
  const select = document.getElementById(id);
  if (!select) return;
  const count = select.options.length;
  select.selectedIndex = (select.selectedIndex + direction + count) % count;
  select.dispatchEvent(new Event('change'));
}

window.keyPressed = function(event) {
  requestRedraw();
  const e = event || {};

  // Don't process keyboard shortcuts if user is typing in an input field
  const activeElement = document.activeElement;
  const isTypingInInput = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.tagName === 'SELECT' ||
    activeElement.isContentEditable
  );
  if (isTypingInInput) {
    if (keyCode === ESCAPE) {
      activeElement.blur();
      return false;
    }
    return true;
  }

  const modifier = e.ctrlKey || e.metaKey;

  // Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z or Ctrl+Y redo
  if (modifier && (e.code === 'KeyZ' || e.code === 'KeyY')) {
    if (e.code === 'KeyY' || e.shiftKey) {
      redoCanvas();
    } else {
      undoCanvas();
    }
    return false;
  }
  // Leave other browser shortcuts (Ctrl+R, Ctrl+C, …) alone
  if (modifier || e.altKey) return true;

  // ESC - close modals and panels
  if (keyCode === ESCAPE) {
    window.hideUserGuide?.();
    window.hideShortcutsPanel?.();
    closeMidiDevicesModal();
    if (customizationPanel.isVisible) customizationPanel.toggle();
    if (midiMappingPanel.isVisible) midiMappingPanel.toggle();
    return false;
  }

  // These work even with a panel open
  if (key === 'h' || key === 'H') { toggleUI(); return false; }
  if (key === '?' || key === '/') { window.toggleShortcutsPanel?.(); return false; }
  if (key === 'u' || key === 'U') { window.toggleUserGuide?.(); return false; }
  if (key === 'f' || key === 'F') {
    const fs = fullscreen();
    fullscreen(!fs);
    return false;
  }

  // Block all other keyboard shortcuts if a panel is open
  if (customizationPanel.isVisible || midiMappingPanel.isVisible || kitSetupWizard?.isOpen) {
    return true;
  }

  // Space - toggle video recording
  if (key === ' ') {
    toggleVideoRecording();
    return false;
  }

  // Backspace/Delete - clear canvas (undoable)
  if (keyCode === BACKSPACE || keyCode === DELETE) {
    clearCanvas();
    return false;
  }

  switch (key) {
    case 's': case 'S':
      saveImage();
      return false;
    case 'd': case 'D':
      if (stateManager.saveNow()) notificationSystem.show('Settings saved');
      return false;
    case 'b': case 'B':
      cycleBlendMode();
      return false;
    case 'p': case 'P':
      // Start/pause the timeline (time-based layouts)
      if (isTimeBasedLayout() && timelineControls) {
        if (chronicleMode.recording) {
          timelineControls.handlePause();
        } else {
          timelineControls.handleStart(false);
        }
      }
      return false;
    case 'c': case 'C':
      if (currentModeType === 'timeline') clearCanvas('Timeline cleared');
      return false;
  }

  // Arrow keys - navigate modes and styles/layouts
  if (keyCode === LEFT_ARROW && currentModeType !== 'freeform') {
    document.getElementById('mode-type-freeform')?.click();
    return false;
  }
  if (keyCode === RIGHT_ARROW && currentModeType === 'freeform') {
    document.getElementById('mode-type-timeline')?.click();
    return false;
  }
  if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
    const direction = keyCode === UP_ARROW ? -1 : 1;
    stepSelect(currentModeType === 'freeform' ? 'freeform-style-select' : 'timeline-layout-select', direction);
    return false;
  }

  // 1-9 - select drum in customization panel
  if (key >= '1' && key <= '9') {
    const drumId = drumOrder[parseInt(key) - 1];
    if (drumId && drumSettings[drumId]) {
      if (!customizationPanel.isVisible) customizationPanel.toggle();
      customizationPanel.selectDrum(drumId);
      notificationSystem.show(`Selected: ${drumSettings[drumId].name}`);
    }
    return false;
  }

  return true;
};

window.windowResized = function() {
  requestRedraw();
  resizeCanvas(windowWidth, windowHeight);
  if (overlayGfx) {
    overlayGfx.resizeCanvas(windowWidth, windowHeight);
  }
  if (overlayCanvas) {
    overlayCanvas.width = windowWidth * pixelDensity();
    overlayCanvas.height = windowHeight * pixelDensity();
    overlayCanvas.style.width = windowWidth + 'px';
    overlayCanvas.style.height = windowHeight + 'px';
  }
};

// ===== MIDI CALLBACKS =====

/**
 * Handle MIDI note painting
 * Called by MidiManager when a note is played
 */
function handlePaint(note, velocity, deviceId, timeStamp = performance.now()) {
  // Check if this device+note combination is mapped to a drum
  // Pass midiManager for smart device key matching
  const drumId = findDrumByMidiNote(note, deviceId, drumSettings, midiManager);

  // Latency calibration and kit setup listen to raw hits
  if (hitListener && hitListener({ note, velocity, deviceId, drumId, timeStamp })) {
    return;
  }

  if (!drumId) {
    reportUnmappedNote(note, deviceId);
    return;
  }

  queueHit({ note, velocity, deviceId, drumId, timeStamp });
}

/**
 * Queue a hit for painting on the next frame
 * @param {{note, velocity, deviceId, drumId, timeStamp}} hit
 */
function queueHit(hit) {
  // Record session event with the precise hit time
  if (sessionRecorder) {
    sessionRecorder.recordEvent(hit.note, hit.velocity, hit.deviceId, hit.drumId, hit.timeStamp);
  }
  if (hitQueue.length < MAX_QUEUED_HITS) {
    hitQueue.push(hit);
  }
}

// Optional hook that sees every hit first; return true to consume it
let hitListener = null;
function setHitListener(fn) {
  hitListener = fn;
}

/**
 * Tell the user (at most every few seconds per note) when a pad isn't mapped
 */
const unmappedNoteWarnings = new Map();
function reportUnmappedNote(note, deviceId) {
  const now = performance.now();
  const last = unmappedNoteWarnings.get(note) || 0;
  if (now - last < 8000) return;
  unmappedNoteWarnings.set(note, now);

  const device = midiManager.connectedDevices.find(d => d.id === deviceId);
  const deviceName = device ? device.name : 'your device';
  notificationSystem.show(`Note ${note} from ${deviceName} isn't mapped to a drum`, 'warning', {
    actionLabel: 'Set up kit',
    onAction: () => kitSetupWizard?.open()
  });
}

/**
 * Fill the paint canvas with the background color (blend mode must be normal
 * for the fill, then the user's blend mode is restored)
 */
function fillBackground() {
  paintCanvas.blendMode(BLEND);
  paintCanvas.background(currentBgColor);
  paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
  window.currentBgColor = currentBgColor;
  needsRedraw = true;
}

/**
 * Clear the painting. Undoable, so no confirmation dialog is needed.
 * @param {string} message - Toast text
 */
function clearCanvas(message = 'Canvas cleared') {
  stateManager.saveCanvasState(paintCanvas);
  fillBackground();
  strokeCount = 0;
  particles = [];
  getCurrentMode().clear({ paintCanvas, currentBgColor });
  timelineControls?.updateButtonsUI();
  timelineControls?.updateStatusText();
  notificationSystem.show(message, 'success', { actionLabel: 'Undo', onAction: undoCanvas });
}

/**
 * Change the background color (repaints the canvas; undoable)
 */
function setBackgroundColor(color) {
  stateManager.saveCanvasState(paintCanvas);
  currentBgColor = color;
  fillBackground();
  const picker = document.getElementById('bg-color-picker');
  if (picker) picker.value = color;
  notificationSystem.show(`Background: ${color}`, 'info', { actionLabel: 'Undo', onAction: undoCanvas });
  stateManager.scheduleAutoSave();
}

function undoCanvas() {
  if (stateManager.undo(paintCanvas)) {
    needsRedraw = true;
    notificationSystem.show('Undo');
  } else {
    notificationSystem.show('Nothing to undo');
  }
}

function redoCanvas() {
  if (stateManager.redo(paintCanvas)) {
    needsRedraw = true;
    notificationSystem.show('Redo');
  }
}

/**
 * Paint one hit with the current mode
 */
function paintHit({ note, velocity, deviceId, drumId, timeStamp }) {
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
    currentBgColor,
    hitTime: timeStamp // performance.now() time the drum was actually hit
  };

  try {
    getCurrentMode().paint(note, velocity, context);
    strokeCount++;
  } catch (error) {
    debugError('Error painting:', error);
    showUserFriendlyError(notificationSystem, 'PAINT_ERROR', error);
  }
  needsRedraw = true;
}

/**
 * Handle Direct Mode CC messages
 * Maps CC to specific drum parameters based on ccAssignments
 */
function handleDirectModeCC(ccNumber, ccValue) {
  if (!midiManager.ccAssignments) return;

  // Search all drums for this CC mapping
  for (const drumId in midiManager.ccAssignments) {
    const drumCCs = midiManager.ccAssignments[drumId];

    for (const paramKey in drumCCs) {
      const assignment = drumCCs[paramKey];

      if (assignment.cc === ccNumber) {
        // Map CC value using detected range
        const normalizedValue = normalizeCC(ccValue, assignment.ccMin ?? 0, assignment.ccMax ?? 127);

        // Update drum setting
        if (drumSettings[drumId] && drumSettings[drumId].midiCC && drumSettings[drumId].midiCC[paramKey]) {
          const paramConfig = drumSettings[drumId].midiCC[paramKey];
          const mappedValue = paramConfig.min + normalizedValue * (paramConfig.max - paramConfig.min);

          // Apply the value
          if (paramKey === 'size' || paramKey === 'opacity') {
            drumSettings[drumId][paramKey] = mappedValue / 100; // Convert to 0-1 range
          } else {
            drumSettings[drumId][paramKey] = mappedValue;
          }

          debugLog(`🎚️ Direct CC: ${drumId}.${paramKey} = ${mappedValue.toFixed(1)} (CC${ccNumber}=${ccValue})`);
        }
        return;
      }
    }
  }
}

/**
 * Handle Bank Mode CC messages
 * Applies CC to active drum's parameter OR global visual style parameter
 */
function handleBankModeCC(drumId, paramKey, normalizedValue, ccValue, ccNumber) {
  // Check if this is a visual style parameter (global, affects brushstroke/splatter)
  const isVisualStyleParam = paramKey.startsWith('splatter') || paramKey.startsWith('brush');

  if (isVisualStyleParam) {
    // Handle visual style parameter (affects all brushstrokes/splatters globally)
    visualStyleManager.updateParameter(paramKey, normalizedValue);

    // Show notification
    const paramMapping = visualStyleManager.parameterMappings[paramKey];
    if (paramMapping) {
      const value = paramMapping.min + normalizedValue * (paramMapping.max - paramMapping.min);
      notificationSystem.show(`${paramMapping.description}: ${value.toFixed(2)}`);
    }
    return;
  }

  // Handle per-drum parameter (existing functionality)
  if (!drumSettings[drumId]) return;

  // Get parameter configuration
  const paramConfig = drumSettings[drumId].midiCC?.[paramKey];
  if (!paramConfig) return;

  // Map normalized value to parameter range
  const mappedValue = paramConfig.min + normalizedValue * (paramConfig.max - paramConfig.min);

  // Apply the value
  if (paramKey === 'size' || paramKey === 'opacity') {
    drumSettings[drumId][paramKey] = mappedValue / 100; // Convert to 0-1 range
  } else {
    drumSettings[drumId][paramKey] = mappedValue;
  }

  debugLog(`🎚️ Bank CC: ${drumId}.${paramKey} = ${mappedValue.toFixed(1)} (CC${ccNumber}=${ccValue})`);

  // Show notification
  notificationSystem.show(`${drumId}: ${paramKey} = ${mappedValue.toFixed(0)}`);
}

/**
 * Update the active drum indicator (Bank Mode visual feedback)
 */
function updateActiveDrumIndicator() {
  const indicator = document.getElementById('active-drum-indicator');
  if (!indicator) return;

  if (midiManager.bankModeEnabled) {
    const drumName = drumSettings[midiManager.activeDrumBank]?.name || midiManager.activeDrumBank.toUpperCase();
    indicator.textContent = `🎯 CONTROLLING: ${drumName}`;
    indicator.style.display = 'block';
  } else {
    indicator.style.display = 'none';
  }
}

/**
 * Switch to a new paint mode (legacy compatibility - now uses mode type and style/layout)
 * This is kept for loading old saved states
 */
function switchMode(oldModeIndex) {
  // Map old mode indices to new three-group structure
  // 0-6: Old styles, 7: Spiral, 8: Timeline
  const modeMap = {
    0: { type: 'freeform', style: 'classic' },
    1: { type: 'chronicle', layout: 'fibonacci' },  // Moved to Chronicle
    2: { type: 'chronicle', layout: 'radial' },     // Moved to Chronicle
    3: { type: 'freeform', style: 'gravity' },
    4: { type: 'freeform', style: 'organic' },
    5: { type: 'freeform', style: 'dendritic' },
    6: { type: 'freeform', style: 'lightning' },
    7: { type: 'staff', layout: 'spiral' },  // Spiral is now in Staff mode
    8: { type: 'staff', layout: 'staff' }    // Staff notation in Staff mode
  };

  const mapping = modeMap[oldModeIndex];
  if (!mapping) return;

  // Deactivate current mode
  getCurrentMode().onDeactivate({ paintCanvas });

  // Switch to new mode type
  currentModeType = mapping.type;

  if (mapping.type === 'freeform') {
    freeformMode.setStyle(mapping.style);
    const freeformRadio = document.getElementById('mode-type-freeform');
    const freeformStyleSelect = document.getElementById('freeform-style-select');
    if (freeformRadio) freeformRadio.checked = true;
    if (freeformStyleSelect) freeformStyleSelect.value = mapping.style;
  } else {
    // Timeline mode (handles all layouts: fibonacci, radial, rings, petals, polygon, staff, spiral)
    // Normalize old 'staff' and 'chronicle' types to 'timeline'
    chronicleMode.layout = mapping.layout;
    const timelineRadio = document.getElementById('mode-type-timeline');
    const timelineLayoutSelect = document.getElementById('timeline-layout-select');
    if (timelineRadio) timelineRadio.checked = true;
    if (timelineLayoutSelect) timelineLayoutSelect.value = mapping.layout;
  }

  // Activate new mode
  getCurrentMode().onActivate({ paintCanvas, drumSettings, drumOrder });

  // Update UI visibility
  const timelineLayoutSelector = document.getElementById('timeline-layout-selector');
  const freeformStyleSelector = document.getElementById('freeform-style-selector');
  if (timelineLayoutSelector) timelineLayoutSelector.style.display = mapping.type !== 'freeform' ? 'block' : 'none';
  if (freeformStyleSelector) freeformStyleSelector.style.display = mapping.type === 'freeform' ? 'block' : 'none';

  // Check if layout is time-based for timeline controls
  const isTimeBased = TIME_BASED_LAYOUTS.includes(mapping.layout);
  const timelineControlsEl = document.getElementById('timeline-controls');
  if (timelineControlsEl) {
    timelineControlsEl.style.display = (mapping.type !== 'freeform' && isTimeBased) ? 'block' : 'none';
  }

  // Quick Settings video section always visible — Recent Recordings must be accessible in all modes

  debugLog(`Mode: ${getCurrentMode().name}`);
  notificationSystem.show(getCurrentMode().name);
}

/**
 * Load saved settings: browser storage first, then the bundled default-settings.json
 */
async function loadSavedSettings() {
  const raw = stateManager.loadDefault() || await stateManager.loadFromFile();
  if (!raw) {
    debugLog('No saved settings found, using factory defaults');
    return;
  }
  const { state, warnings } = validateSettings(raw);
  warnings.forEach(w => debugWarn(w));
  if (state) {
    applySettings(state);
    infoLog(`📁 Loaded settings from ${state.timestamp || 'defaults'}`);
  }
}

// Background colors used to be stored as an index into this list
const LEGACY_BG_COLORS = ['#ffffff', '#000000', '#202020', '#f0f0f0', '#c8c8c8'];

/**
 * Apply validated settings to the app. Used at startup, for imported files and
 * for saved projects, so all three behave the same.
 * @param {Object} savedState - Output of validateSettings()
 */
function applySettings(savedState) {
  // Kit layout first: which drums exist
  if (savedState.drumKitConfig?.length) {
    DRUM_KIT_CONFIG.length = 0;
    savedState.drumKitConfig.forEach(drum => DRUM_KIT_CONFIG.push(drum));
  }

  if (savedState.bankModeSettings) {
    midiManager.loadState(savedState.bankModeSettings);
  }

  if (savedState.drumSettings) {
    for (const [drumId, saved] of Object.entries(savedState.drumSettings)) {
      if (!drumSettings[drumId]) {
        // Custom drum: start from defaults so every field exists
        const config = DRUM_KIT_CONFIG.find(d => d.id === drumId);
        drumSettings[drumId] = createDrumSettings(config?.name || drumId, null, config?.defaultColor || '#888888');
      }
      const { midiCC, ...rest } = saved;
      Object.assign(drumSettings[drumId], rest);
      if (midiCC) {
        for (const [param, mapping] of Object.entries(midiCC)) {
          drumSettings[drumId].midiCC[param] = { ...(drumSettings[drumId].midiCC[param] || {}), ...mapping };
        }
      }
    }
  }

  // Keep the kit list and the per-drum settings in agreement
  for (let i = DRUM_KIT_CONFIG.length - 1; i >= 0; i--) {
    if (!drumSettings[DRUM_KIT_CONFIG[i].id]) DRUM_KIT_CONFIG.splice(i, 1);
  }
  const validIds = new Set(DRUM_KIT_CONFIG.map(d => d.id));
  for (const drumId of Object.keys(drumSettings)) {
    if (!validIds.has(drumId)) delete drumSettings[drumId];
  }

  // Drum order (timeline lanes); add any drums the saved order is missing
  const order = (savedState.drumOrder || []).filter(id => validIds.has(id));
  DRUM_KIT_CONFIG.forEach(d => { if (!order.includes(d.id)) order.push(d.id); });
  drumOrder = order;
  window.drumOrder = drumOrder;

  if (savedState.lastPaletteDrumIds && customizationPanel) {
    customizationPanel.lastPaletteDrumIds = savedState.lastPaletteDrumIds;
  }

  if (savedState.spiralSettings) {
    Object.assign(chronicleMode.spiralSettings, savedState.spiralSettings);
  }

  if (savedState.timelineSettings) {
    // Validated keys match TimelineMode's property names
    const { midiLatencyMs, layout, ...timeline } = savedState.timelineSettings;
    Object.assign(chronicleMode, timeline);
    if (timeline.bpm) chronicleMode.baseBpm = timeline.bpm;
    if (layout) chronicleMode.layout = layout;
    if (midiLatencyMs !== undefined) {
      // Before timing v2 this was a fudge factor for frame-locked clicks; the
      // metronome is now sample-accurate, so old values would shift every hit
      chronicleMode.midiLatencyMs = savedState.timingVersion >= 2 ? midiLatencyMs : 0;
    }
  }

  const g = savedState.globalSettings;
  if (g) {
    if (g.sizeMultiplier !== undefined) globalSizeMultiplier = g.sizeMultiplier;
    if (g.blendMode !== undefined) {
      currentBlendMode = g.blendMode;
      window.currentBlendMode = currentBlendMode;
    }
    if (g.bgColor !== undefined) {
      currentBgColor = typeof g.bgColor === 'number' ? (LEGACY_BG_COLORS[g.bgColor] || '#ffffff') : g.bgColor;
      window.currentBgColor = currentBgColor;
      paintCanvas.blendMode(BLEND);
      paintCanvas.background(currentBgColor);
    }
    paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
  }

  // Paint mode
  if (savedState.currentModeType !== undefined) {
    currentModeType = ['timeline', 'staff', 'chronicle'].includes(savedState.currentModeType) ? 'timeline' : 'freeform';
    if (savedState.freeformStyle) freeformMode.setStyle(savedState.freeformStyle);
    if (savedState.chronicleLayout) chronicleMode.layout = savedState.chronicleLayout;
  } else if (savedState.currentMode !== undefined) {
    switchMode(savedState.currentMode); // Very old saves
  }

  if (videoRecorder) {
    if (savedState.videoQuality) videoRecorder.setQuality(savedState.videoQuality);
    if (savedState.videoFormat) videoRecorder.setFormat(savedState.videoFormat);
  }

  midiManager.recordOutputPortId = savedState.recordOutputPortId ?? midiManager.recordOutputPortId;
  midiManager.recordOutputNote = savedState.recordOutputNote ?? midiManager.recordOutputNote;
  midiManager.recordOutputChannel = savedState.recordOutputChannel ?? midiManager.recordOutputChannel;
  midiManager.sendClockEnabled = savedState.sendClockEnabled ?? midiManager.sendClockEnabled;

  window.drumSettings = drumSettings;
  chronicleMode.regenerateLanes(drumSettings, drumOrder);
  syncControlsToState();
}

/**
 * Apply settings from an imported file or a saved project while running
 * @param {Object} state - Output of validateSettings()
 */
function applyImportedSettings(state) {
  getCurrentMode().onDeactivate({ paintCanvas });
  applySettings(state);
  getCurrentMode().onActivate({ paintCanvas, drumSettings, drumOrder });
  customizationPanel.build();
  stateManager.saveNow();
}

/**
 * Make every control in the page show the current settings
 */
function syncControlsToState() {
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
  };
  const setChecked = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!value;
  };

  setValue('global-size', globalSizeMultiplier);
  const sizeLabel = document.getElementById('global-size-val');
  if (sizeLabel) sizeLabel.textContent = `${globalSizeMultiplier.toFixed(1)}x`;
  setValue('blend-select', String(currentBlendMode));
  setValue('bg-color-picker', currentBgColor);

  // Mode and style/layout pickers
  setChecked('mode-type-timeline', currentModeType === 'timeline');
  setChecked('mode-type-freeform', currentModeType === 'freeform');
  setValue('freeform-style-select', freeformMode.style);
  setValue('timeline-layout-select', chronicleMode.layout);
  window.updateModeUI?.();

  // Spiral
  const spiral = chronicleMode.spiralSettings;
  setValue('spiral-tightness', spiral.tightness);
  const tightness = document.getElementById('spiral-tightness-display');
  if (tightness) tightness.textContent = spiral.tightness;
  setChecked('spiral-separate-tracks', spiral.separateTracks);
  const spacingRow = document.getElementById('spiral-track-spacing-row');
  if (spacingRow) spacingRow.style.display = spiral.separateTracks ? 'flex' : 'none';
  setValue('spiral-track-spacing', spiral.trackSpacing);
  const spacing = document.getElementById('spiral-track-spacing-display');
  if (spacing) spacing.textContent = spiral.trackSpacing;

  // Recording
  if (videoRecorder) {
    setValue('video-quality', videoRecorder.currentQuality);
    setValue('timeline-video-quality', videoRecorder.currentQuality);
    setValue('timeline-video-format', videoRecorder.currentFormat);
  }
  setValue('record-output-note', midiManager.recordOutputNote);
  setValue('record-output-channel', midiManager.recordOutputChannel);
  setChecked('record-output-clock', midiManager.sendClockEnabled);
  const clockInfo = document.getElementById('record-output-clock-info');
  if (clockInfo) clockInfo.style.display = midiManager.sendClockEnabled ? 'block' : 'none';
  updateClockInfoDisplay();
  if (midiManager.midiAccess) populateMidiOutputSelect(midiManager.getOutputDevices());

  timelineControls?.syncUI();
  updateActiveDrumIndicator();
}

/**
 * Migrate drum ID changes (e.g., rack_tom -> snare_rim)
 * Preserves all settings when drum IDs are renamed
 */
function migrateDrumIdChanges() {
  const migrations = {
    'rack_tom': 'snare_rim'  // Old ID -> New ID
  };

  let migrated = false;
  for (const [oldId, newId] of Object.entries(migrations)) {
    if (drumSettings[oldId] && !drumSettings[newId]) {
      drumSettings[newId] = { ...drumSettings[oldId] };
      delete drumSettings[oldId];

      if (midiManager.bankPadAssignments?.[oldId]) {
        midiManager.bankPadAssignments[newId] = midiManager.bankPadAssignments[oldId];
        delete midiManager.bankPadAssignments[oldId];
      }
      migrated = true;
    }
  }

  if (migrated) {
    stateManager.saveNow();
  }
}

/**
 * Migrate old drum mappings to use stable device keys
 * This upgrades legacy mappings that only have volatile device IDs
 */
function migrateDrumMappingsToStableKeys() {
  if (!midiManager?.deviceRegistry) return;

  let migratedCount = 0;
  for (const drumId in drumSettings) {
    const drum = drumSettings[drumId];

    // Has a volatile device ID but no stable key: needs migration
    if (drum.midiDevice && !drum.midiDeviceStable) {
      const stableKey = midiManager.deviceRegistry.getStableKey(drum.midiDevice);
      if (stableKey) {
        drum.midiDeviceStable = stableKey;
        migratedCount++;
      } else {
        // Port ID from an old session that no longer exists: allow any device
        drum.midiDevice = null;
      }
    }
  }

  if (migratedCount > 0) {
    debugLog(`✅ Migrated ${migratedCount} drum mapping(s) to stable device keys`);
    stateManager.saveNow();
  }
}

/**
 * Check for duplicate MIDI note mappings and warn user
 * Helps debug conflicts where multiple drums use the same note
 */
function checkForDuplicateNoteMappings() {
  const noteMap = new Map(); // note -> [drumIds]

  // Build map of notes to drums
  for (const drumId in drumSettings) {
    const drum = drumSettings[drumId];
    if (drum.midiNote !== null && drum.midiNote !== undefined) {
      if (!noteMap.has(drum.midiNote)) {
        noteMap.set(drum.midiNote, []);
      }
      noteMap.get(drum.midiNote).push({
        id: drumId,
        name: drum.name,
        device: drum.midiDevice,
        deviceStable: drum.midiDeviceStable
      });
    }
  }

  // Find duplicates
  const duplicates = [];
  for (const [note, drums] of noteMap.entries()) {
    if (drums.length > 1) {
      duplicates.push({ note, drums });
    }
  }

  if (duplicates.length > 0) {
    debugWarn(`⚠️ Found ${duplicates.length} MIDI note conflict(s):`);
    duplicates.forEach(({ note, drums }) => {
      debugWarn(`  Note ${note} mapped to ${drums.length} drums:`);
      drums.forEach(drum => {
        const deviceInfo = drum.deviceStable
          ? `device: ${drum.deviceStable}`
          : drum.device
            ? `device: ${drum.device} (no stable key!)`
            : 'ANY device';
        debugWarn(`    - ${drum.id} (${drum.name}) [${deviceInfo}]`);
      });
      debugWarn(`  → Only ONE will respond unless they have different device assignments!`);
    });

    // Show notification
    const notesList = duplicates.map(d => d.note).join(', ');
    notificationSystem.show(`⚠️ MIDI Note Conflicts: Notes ${notesList} mapped to multiple drums. Check console!`, 'warning');
  } else {
    debugLog(`✅ No MIDI note conflicts detected`);
  }

  // Also log all current mappings for debugging
  debugLog('📋 Current Drum Mappings:');
  for (const drumId in drumSettings) {
    const drum = drumSettings[drumId];
    const deviceInfo = drum.midiDeviceStable
      ? `${drum.midiDeviceStable}`
      : drum.midiDevice
        ? `volatile:${drum.midiDevice}`
        : 'ANY';
    debugLog(`  ${drumId} (${drum.name}): Note ${drum.midiNote} @ ${deviceInfo}`);
  }
}

// ===== MOUSE TESTING (for development without MIDI) =====

// Track previous mouse position for velocity calculation
let prevMouseX = 0;
let prevMouseY = 0;

// True when the pointer is over any UI (panels, dialogs, toasts) rather than the canvas
function isMouseOverPanel() {
  const el = document.elementFromPoint(mouseX, mouseY);
  return !!el && el !== window.displayCanvas.elt;
}

window.mousePressed = function() {
  requestRedraw();
  // Don't interact if mouse is over any panel
  if (isMouseOverPanel()) {
    return;
  }

  // Handle metronome dragging in time-based layouts
  const isTimeBased = isTimeBasedLayout();
  if (isTimeBased && chronicleMode.handleMetronomeMousePressed(mouseX, mouseY)) {
    return; // Metronome was clicked, don't do anything else
  }

  // Handle deviation graph dragging in staff mode
  if (isTimeBased && chronicleMode.handleDeviationGraphMousePressed(mouseX, mouseY)) {
    return; // Deviation graph was clicked, don't do anything else
  }

  // Check if clicking on scrollbar (any mode with tall canvas)
  if (window.scrollbarBounds) {
    const sb = window.scrollbarBounds;
    if (mouseX >= sb.x && mouseX <= sb.x + sb.width &&
        mouseY >= sb.thumbY && mouseY <= sb.thumbY + sb.thumbHeight) {
      isDraggingScrollbar = true;
      scrollbarDragStartY = mouseY;
      return;
    }
    // Click on scrollbar track (jump to position)
    if (mouseX >= sb.x && mouseX <= sb.x + sb.width &&
        mouseY >= sb.y && mouseY <= sb.y + sb.trackHeight) {
      const clickRatio = (mouseY - sb.y) / sb.trackHeight;
      timelineScrollY = -clickRatio * sb.scrollRange;
      isDraggingScrollbar = true;
      scrollbarDragStartY = mouseY;
      return;
    }
  }

  // Don't paint if any panel is open or dragging controls
  if (customizationPanel.isVisible || midiMappingPanel.isVisible || window.isDraggingControls) {
    return;
  }

  // Don't paint if outside canvas bounds
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
    return;
  }

  // Record position for drag velocity
  prevMouseX = mouseX;
  prevMouseY = mouseY;
};

window.mouseDragged = function() {
  requestRedraw();
  // Handle metronome dragging in time-based layouts
  const isTimeBased = isTimeBasedLayout();
  if (isTimeBased) {
    chronicleMode.handleMetronomeMouseDragged(mouseX, mouseY);
    chronicleMode.handleDeviationGraphMouseDragged(mouseX, mouseY);

    // Block other interactions if graph is being dragged or resized
    if (chronicleMode.deviationGraphDragging || chronicleMode.deviationGraphResizing) {
      return;
    }
  }

  // Handle scrollbar dragging (any mode with tall canvas)
  if (isDraggingScrollbar && window.scrollbarBounds) {
    const sb = window.scrollbarBounds;
    const dragDelta = mouseY - scrollbarDragStartY;
    const dragRatio = dragDelta / sb.trackHeight;
    const scrollDelta = dragRatio * sb.scrollRange;

    timelineScrollY -= scrollDelta;

    // Clamp scroll to valid range
    timelineScrollY = Math.max(-sb.scrollRange, Math.min(SCROLLBAR_TRACK_PADDING, timelineScrollY));

    scrollbarDragStartY = mouseY;
    return;
  }

  // Don't interact if mouse is over any panel
  if (isMouseOverPanel()) {
    return;
  }

  // Don't paint if any panel is open or dragging controls
  if (customizationPanel.isVisible || midiMappingPanel.isVisible || window.isDraggingControls) {
    return;
  }

  // Don't paint if outside canvas bounds
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
    return;
  }

  // Calculate velocity based on mouse speed
  const speed = dist(mouseX, mouseY, prevMouseX, prevMouseY);
  const velocity = constrain(map(speed, 0, CLICK_PAINT_SPEED_MAX, CLICK_PAINT_VELOCITY_MAP_MIN, CLICK_PAINT_VELOCITY_MAP_MAX), CLICK_PAINT_VELOCITY_MAP_MIN, CLICK_PAINT_VELOCITY_MAP_MAX);
  paintWithMouse(velocity);

  // Update previous position
  prevMouseX = mouseX;
  prevMouseY = mouseY;
};

/**
 * Mouse painting uses the first drum in the kit (handy for trying styles)
 */
function paintWithMouse(velocity) {
  const drumId = drumOrder.find(id => drumSettings[id]);
  if (!drumId) return;
  queueHit({
    note: drumSettings[drumId].midiNote,
    velocity,
    deviceId: 'mouse',
    drumId,
    timeStamp: performance.now()
  });
}

window.mouseClicked = function() {
  // Don't interact if mouse is over any panel
  if (isMouseOverPanel()) {
    return;
  }

  // Don't paint if any panel is open or dragging controls
  if (customizationPanel.isVisible || midiMappingPanel.isVisible || window.isDraggingControls) {
    return;
  }

  // Don't paint if outside canvas bounds
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
    return;
  }

  paintWithMouse(0.7);
};

window.mouseReleased = function() {
  requestRedraw();
  // Handle metronome release in time-based layouts
  const isTimeBased = isTimeBasedLayout();
  if (isTimeBased) {
    chronicleMode.handleMetronomeMouseReleased();
    chronicleMode.handleDeviationGraphMouseReleased();
  }

  // Stop dragging scrollbar
  isDraggingScrollbar = false;
};

// Mouse wheel handler for vertical scrolling
window.mouseWheel = function(event) {
  requestRedraw();
  // Calculate display dimensions
  const scaleFactor = (width / paintCanvas.width) * CANVAS_FIT_SCALE;
  const displayHeight = paintCanvas.height * scaleFactor;

  // Only scroll if canvas is taller than viewport
  if (displayHeight > height) {
    // Scroll vertically
    timelineScrollY -= event.delta * SCROLL_SPEED;

    // Calculate maximum scroll (keep at least some content visible)
    const maxScroll = Math.max(0, displayHeight - height + SCROLL_MAX_PADDING);

    // Clamp scroll to valid range
    timelineScrollY = Math.max(-maxScroll, Math.min(SCROLLBAR_TRACK_PADDING, timelineScrollY));

    return false; // Prevent default scrolling
  }
};

debugLog('🖱️  Click or drag anywhere to test painting');
debugLog('');
debugLog('⌨️  MODES (1-8):');
debugLog('   1: Classic Pointillism');
debugLog('   2: Fibonacci Spiral');
debugLog('   3: Radial Symmetry');
debugLog('   4: Gravity Field');
debugLog('   5: Organic Growth');
debugLog('   6: Dendritic Spreading');
debugLog('   7: Lightning');
debugLog('   8: Timeline');
debugLog('');
debugLog('⌨️  CONTROLS:');
debugLog('   SPACE: Clear canvas');
debugLog('   S: Save image');
debugLog('   D: Save settings as default');
debugLog('   Z: Undo');
debugLog('   Y: Redo');
debugLog('   H: Hide/show UI');
