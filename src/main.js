/**
 * Drum Painter - Main Entry Point
 * Modular version with ES6 modules
 */

import {
  PAINT_CANVAS_WIDTH,
  PAINT_CANVAS_HEIGHT,
  BG_COLORS,
  BLEND_MODE_NAMES,
  SCROLLBAR_WIDTH,
  SCROLLBAR_TRACK_PADDING,
  SCROLLBAR_THUMB_MIN_HEIGHT,
  SCROLL_SPEED,
  CANVAS_FIT_SCALE,
  VIEWPORT_MARGIN_BOTTOM,
  VIEWPORT_MARGIN_TOP,
  AUTO_SCROLL_PADDING,
  SCROLL_MAX_PADDING,
  MODE_DISPLAY_FRAMES,
  MODE_OVERLAY_TEXT_SIZE,
  UI_DEBOUNCE_SHORT,
  UI_NOTIFICATION_DURATION,
  URL_REVOKE_DELAY,
  CLICK_PAINT_VELOCITY_MAP_MIN,
  CLICK_PAINT_VELOCITY_MAP_MAX,
  CLICK_PAINT_SPEED_MAX
} from './config/constants.js';
import { DRUM_KIT_CONFIG, generateFactorySettings } from './config/drumKit.js';
import { FreeformMode } from './modes/FreeformMode.js';
import { TimelineMode } from './modes/TimelineMode.js';
import { MidiManager } from './midi/MidiManager.js';
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
import { showUserFriendlyError, formatErrorMessage } from './utils/errorMessages.js';
import { DarkModeManager } from './utils/darkMode.js';
import { SessionRecorder } from './session/SessionRecorder.js';
import { PostProcessing } from './effects/PostProcessing.js';

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

// DOM elements
let midiStatusEl;
let controlsEl;

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
    bankModeSettings: midiManager ? midiManager.getState() : {}
  };
}

// ===== P5.JS SKETCH =====

// Using global mode for now (easier for testing)
window.setup = async function() {
  // Create display canvas
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent(document.body);

  // Initialize blend modes array (needs p5 constants)
  BLEND_MODES = [BLEND, MULTIPLY, SCREEN, OVERLAY, DODGE, BURN, ADD, DIFFERENCE];

  // Create offscreen painting canvas
  paintCanvas = createGraphics(PAINT_CANVAS_WIDTH, PAINT_CANVAS_HEIGHT);
  paintCanvas.background(currentBgColor);
  paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

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
  midiStatusEl = document.getElementById('midi-status');
  controlsEl = document.getElementById('controls');

  // Apply centralized theme to HTML elements
  applyAllThemes();

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
  midiManager = new MidiManager((note, velocity, deviceId) => handlePaint(note, velocity, deviceId));

  // Initialize customization panel
  customizationPanel = new DrumCustomizationPanel(drumSettings, midiManager, stateManager, notificationSystem, chronicleMode, darkModeManager);

  // Initialize MIDI mapping panel
  midiMappingPanel = new MidiMappingPanel(drumSettings, midiManager, notificationSystem, updateActiveDrumIndicator);

  // Initialize video recorder with display canvas (captures grid/overlays)
  videoRecorder = new VideoRecorder(window.displayCanvas, notificationSystem);
  setupVideoRecorderUI();

  // Initialize audio/video merger
  audioVideoMerger = new AudioVideoMerger(notificationSystem);
  setupRecordingsUI();

  // Initialize timeline controls (pass videoRecorder for integration)
  timelineControls = new TimelineControls(chronicleMode, notificationSystem, videoRecorder);
  timelineControls.initialize();

  // Initialize debug panel
  debugPanel = new DebugPanel(drumSettings, midiManager);
  window.debugPanel = debugPanel; // Expose globally for modes to use

  // Set MIDI status callback
  midiManager.onMidiStatusChange = (connected, message, deviceName = '', devices = []) => {
    const statusIndicator = document.getElementById('midi-status-indicator');
    const deviceNameEl = document.getElementById('midi-device-name');

    if (statusIndicator) {
      // Green = connected, Red = no MIDI, Yellow = checking
      statusIndicator.style.background = connected ? '#10b981' : (message.includes('No') ? '#ef4444' : '#fbbf24');
    }

    if (deviceNameEl) {
      deviceNameEl.textContent = deviceName || message;
    }

    // Store devices for modal
    window.midiDevicesList = devices;
  };

  // Set MIDI activity callback
  midiManager.onMidiActivity = (channel, note, velocity, deviceId) => {
    const channelEl = document.getElementById('midi-channel');
    const noteEl = document.getElementById('midi-note');
    const velocityEl = document.getElementById('midi-velocity');
    const deviceNameEl = document.getElementById('midi-device-name');
    const activityLight = document.getElementById('midi-activity-light');

    if (channelEl) {
      channelEl.textContent = channel;
    }

    if (note !== null && noteEl) {
      noteEl.textContent = note;
    }

    if (velocity !== null && velocityEl) {
      velocityEl.textContent = velocity;
    }

    // Update device name to show which device sent this message
    if (deviceId && deviceNameEl) {
      const device = midiManager.connectedDevices.find(d => d.id === deviceId);
      if (device) {
        deviceNameEl.textContent = device.name;
      }
    }

    // Flash activity light
    if (activityLight) {
      activityLight.style.opacity = '1';
      setTimeout(() => {
        activityLight.style.opacity = '0';
      }, 100);
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

  // Setup MIDI
  midiManager.setup().then(() => {
    // Migrate drum ID changes (rack_tom -> snare_rim)
    migrateDrumIdChanges();

    // After MIDI is set up, migrate old drum mappings to use stable device keys
    migrateDrumMappingsToStableKeys();

    // Check for duplicate note mappings and warn user
    checkForDuplicateNoteMappings();
  });

  // Setup MIDI devices modal
  setupMidiDevicesModal();

  // Save initial canvas state
  stateManager.saveCanvasState(paintCanvas);

  // Try to load saved settings
  debugLog('🔄 Attempting to load saved settings...');
  await loadSavedSettings();
  debugLog('Current drumSettings after initialization:', drumSettings);
  debugLog('🔍 After loadSavedSettings - chronicleMode.metronomeEnabled:', chronicleMode.metronomeEnabled);

  // Always regenerate timeline lanes after loading settings
  // This ensures custom drums are available in timeline mode even if we start in freeform
  chronicleMode.regenerateLanes(drumSettings, drumOrder);

  // Initialize UI controls
  initializeUI();
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

  debugLog('🎨 Drum Painter - Modular Version');
  debugLog('📦 Current mode:', currentModeType, '- Style/Layout:', currentModeType === 'freeform' ? freeformMode.style : chronicleMode.layout);
  debugLog('🥁 Drum kit:', DRUM_KIT_CONFIG.map(d => d.name));
};

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
    const isTimeBased = ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(chronicleMode.layout);

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

    // Show/hide Quick Settings video section (hide for time-based layouts, show for others)
    const quickSettingsVideoSection = document.getElementById('quick-settings-video-section');
    if (quickSettingsVideoSection) {
      quickSettingsVideoSection.style.display = (isTimeline && isTimeBased) ? 'none' : 'block';
    }

    // Don't hide the Quick Settings panel when switching to Timeline mode
    // It will be hidden when recording starts (in TimelineMode.startRecording for time-based layouts)
    // and shown when recording stops (in TimelineMode.stopRecording)
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
        const isTimeBased = ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(chronicleMode.layout);
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
    bgColorPicker.addEventListener('change', (e) => {
      currentBgColor = e.target.value;

      // Temporarily reset blend mode to normal for clearing
      paintCanvas.blendMode(BLEND);
      paintCanvas.background(currentBgColor);
      // Restore the current blend mode
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

      window.currentBgColor = currentBgColor; // Update global
      debugLog(`Background Color: ${currentBgColor}`);
      notificationSystem.show(`Background: ${currentBgColor}`);

      // Save state for undo
      stateManager.saveCanvasState(paintCanvas);
      stateManager.scheduleAutoSave();
    });
  }

  if (bgColorReset) {
    bgColorReset.addEventListener('click', () => {
      currentBgColor = '#ffffff';
      if (bgColorPicker) bgColorPicker.value = currentBgColor;

      // Temporarily reset blend mode to normal for clearing
      paintCanvas.blendMode(BLEND);
      paintCanvas.background(currentBgColor);
      // Restore the current blend mode
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

      window.currentBgColor = currentBgColor; // Update global
      debugLog(`Background Color reset to white`);
      notificationSystem.show(`Background: white`);

      // Save state for undo
      stateManager.saveCanvasState(paintCanvas);
      stateManager.scheduleAutoSave();
    });
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
  setupSessionRecordingUI();

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
      // Reset spiral settings - note: spiral mode is now a Chronicle layout
      chronicleMode.startTime = Date.now();
      // Temporarily reset blend mode to normal for clearing
      paintCanvas.blendMode(BLEND);
      paintCanvas.background(currentBgColor);
      // Restore the current blend mode
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
      notificationSystem.show('Spiral Reset');
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

  // Quick Action buttons
  const shortcutToggleUI = document.getElementById('shortcut-toggle-ui');
  if (shortcutToggleUI) {
    shortcutToggleUI.addEventListener('click', () => {
      showUI = !showUI;
      controlsEl.style.display = showUI ? 'block' : 'none';
    });
  }

  const shortcutFullscreen = document.getElementById('shortcut-fullscreen');
  if (shortcutFullscreen) {
    shortcutFullscreen.addEventListener('click', () => {
      let fs = fullscreen();
      fullscreen(!fs);
    });
  }

  const shortcutClear = document.getElementById('shortcut-clear');
  if (shortcutClear) {
    shortcutClear.addEventListener('click', () => {
      if (confirm('Clear the entire canvas?')) {
        paintCanvas.background(currentBgColor);
        getCurrentMode().clear({ paintCanvas, currentBgColor });
        notificationSystem.show('Canvas cleared');
      }
    });
  }

  const shortcutSaveImage = document.getElementById('shortcut-save-image');
  if (shortcutSaveImage) {
    shortcutSaveImage.addEventListener('click', () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `drum-painter-${timestamp}.png`;
      paintCanvas.save(filename);
      notificationSystem.show(`Image saved: ${filename}`);
    });
  }

  const shortcutUndo = document.getElementById('shortcut-undo');
  if (shortcutUndo) {
    shortcutUndo.addEventListener('click', () => {
      if (window.historyManager && window.historyManager.undo()) {
        notificationSystem.show('Undo');
      }
    });
  }

  const shortcutRedo = document.getElementById('shortcut-redo');
  if (shortcutRedo) {
    shortcutRedo.addEventListener('click', () => {
      if (window.historyManager && window.historyManager.redo()) {
        notificationSystem.show('Redo');
      }
    });
  }

  const shortcutRecord = document.getElementById('shortcut-record');
  if (shortcutRecord) {
    shortcutRecord.addEventListener('click', () => {
      if (!videoRecorder.isRecording) {
        videoRecorder.startRecording().then(success => {
          if (success) {
            updateVideoRecordingUI(true);
          }
        });
      } else {
        videoRecorder.stopRecording();
        updateVideoRecordingUI(false);
      }
    });
  }

  const shortcutSaveSettings = document.getElementById('shortcut-save-settings');
  if (shortcutSaveSettings) {
    shortcutSaveSettings.addEventListener('click', () => {
      // Simulate D key press
      const event = new KeyboardEvent('keydown', { key: 'd' });
      window.dispatchEvent(event);
    });
  }

  const shortcutBlendMode = document.getElementById('shortcut-blend-mode');
  if (shortcutBlendMode) {
    shortcutBlendMode.addEventListener('click', () => {
      currentBlendMode = (currentBlendMode + 1) % BLEND_MODES.length;
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
      window.currentBlendMode = currentBlendMode;
      const blendSelect = document.getElementById('blend-select');
      if (blendSelect) blendSelect.value = currentBlendMode.toString();
      notificationSystem.show(`Blend: ${BLEND_MODE_NAMES[currentBlendMode]}`);
    });
  }

  const shortcutArrows = document.getElementById('shortcut-arrows');
  if (shortcutArrows) {
    shortcutArrows.addEventListener('click', () => {
      if (window.toggleShortcutsPanel) {
        window.toggleShortcutsPanel();
      }
    });
  }

  const shortcutDrums = document.getElementById('shortcut-drums');
  if (shortcutDrums) {
    shortcutDrums.addEventListener('click', () => {
      if (window.toggleShortcutsPanel) {
        window.toggleShortcutsPanel();
      }
    });
  }

  const shortcutHelp = document.getElementById('shortcut-help');
  if (shortcutHelp) {
    shortcutHelp.addEventListener('click', () => {
      if (window.toggleShortcutsPanel) {
        window.toggleShortcutsPanel();
      }
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

  // Reset to factory defaults button
  const resetBtn = document.getElementById('reset-factory-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all settings to factory defaults?')) {
        // Reset to factory settings
        const factorySettings = generateFactorySettings();
        for (const drumId in factorySettings) {
          Object.assign(drumSettings[drumId], factorySettings[drumId]);
        }
        globalSizeMultiplier = 1.0;
        currentBlendMode = 0;
        currentBgColor = '#ffffff';
        paintCanvas.background(currentBgColor);
        paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
        window.currentBlendMode = currentBlendMode; // Update global

        customizationPanel.build(); // Rebuild UI
        stateManager.saveNow(); // Persist reset to localStorage
        notificationSystem.show('Reset to factory defaults');
      }
    });
  }

  // Clear canvas button (in customization panel footer)
  const clearCanvasBtn = document.getElementById('clear-canvas-btn');
  if (clearCanvasBtn) {
    clearCanvasBtn.addEventListener('click', () => {
      if (confirm('Clear the entire canvas? This cannot be undone.')) {
        paintCanvas.blendMode(BLEND);
        paintCanvas.background(currentBgColor);
        paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
        window.currentBgColor = currentBgColor;
        strokeCount = 0;
        particles = [];
        getCurrentMode().clear({ paintCanvas, currentBgColor });
        stateManager.saveCanvasState(paintCanvas);
        notificationSystem.show('Canvas cleared', 'success');
      }
    });
  }

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
        const state = await stateManager.importFromFile(file);

        // Validate version
        if (!state.version) {
          throw new Error('Invalid settings file: missing version');
        }

        // Load custom drum kit config if available
        if (state.drumKitConfig && Array.isArray(state.drumKitConfig)) {
          // Clear and reload config
          DRUM_KIT_CONFIG.length = 0;
          state.drumKitConfig.forEach(drum => DRUM_KIT_CONFIG.push(drum));
        }

        // Apply drum settings
        if (state.drumSettings) {
          for (const drumId in state.drumSettings) {
            if (drumSettings[drumId]) {
              Object.assign(drumSettings[drumId], state.drumSettings[drumId]);
            } else {
              // New drum from imported file
              drumSettings[drumId] = state.drumSettings[drumId];
            }
          }
        }

        // Clean up orphaned drums from DRUM_KIT_CONFIG
        const orphanedDrums = [];
        for (let i = DRUM_KIT_CONFIG.length - 1; i >= 0; i--) {
          const drumId = DRUM_KIT_CONFIG[i].id;
          if (!drumSettings[drumId]) {
            debugWarn(`⚠️ Removing orphaned drum: ${drumId}`);
            orphanedDrums.push(drumId);
            DRUM_KIT_CONFIG.splice(i, 1);
          }
        }

        // Apply global settings
        if (state.globalSettings) {
          if (state.globalSettings.sizeMultiplier !== undefined) {
            globalSizeMultiplier = state.globalSettings.sizeMultiplier;
          }
          if (state.globalSettings.blendMode !== undefined) {
            currentBlendMode = state.globalSettings.blendMode;
            paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
            window.currentBlendMode = currentBlendMode; // Update global
          }
          if (state.globalSettings.bgColor !== undefined) {
            // Handle both old integer format and new hex string format
            if (typeof state.globalSettings.bgColor === 'number') {
              // Convert old integer index to hex color
              const oldColors = ['#ffffff', '#000000', '#202020', '#f0f0f0', '#c8c8c8'];
              currentBgColor = oldColors[state.globalSettings.bgColor] || '#ffffff';
            } else {
              currentBgColor = state.globalSettings.bgColor;
            }
            // Temporarily reset blend mode to normal for clearing
            paintCanvas.blendMode(BLEND);
            paintCanvas.background(currentBgColor);
            paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
          }
        }

        // Load bank mode settings
        if (state.bankModeSettings && midiManager) {
          midiManager.loadState(state.bankModeSettings);
          updateActiveDrumIndicator();
        }

        // Rebuild UI
        customizationPanel.build();

        infoLog('✓ Settings imported from file');
        notificationSystem.show('Imported successfully!');
      } catch (error) {
        debugError('Error importing settings:', error);
        showUserFriendlyError(notificationSystem, 'FILE_PARSE_ERROR', error);
        alert(formatErrorMessage('FILE_PARSE_ERROR', error));
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

      // Update active tab styling (directly manipulate inline styles)
      guideTabs.forEach(t => {
        t.style.background = 'transparent';
        t.style.color = '#666';
        t.style.borderBottom = '3px solid transparent';
      });
      tab.style.background = '#667eea';
      tab.style.color = 'white';
      tab.style.borderBottom = '3px solid #667eea';

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

  // Projects System
  const projectNameInput = document.getElementById('project-name-input');
  const saveProjectBtn = document.getElementById('save-project-btn');
  const loadProjectBtn = document.getElementById('load-project-btn');
  const deleteProjectBtn = document.getElementById('delete-project-btn');
  const projectsList = document.getElementById('projects-list');

  // Load projects list on startup
  function refreshProjectsList() {
    if (!projectsList) return;

    const projects = getAllProjects();
    projectsList.innerHTML = '<option value="">Select a project...</option>';

    Object.keys(projects).forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      const timestamp = new Date(projects[name].timestamp);
      option.textContent = `${name} (${timestamp.toLocaleDateString()})`;
      projectsList.appendChild(option);
    });
  }

  function getAllProjects() {
    const projects = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('drum-painter-project-')) {
        const projectName = key.replace('drum-painter-project-', '');
        try {
          projects[projectName] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          debugError(`Failed to parse project: ${projectName}`, e);
        }
      }
    }
    return projects;
  }

  if (saveProjectBtn && projectNameInput) {
    saveProjectBtn.addEventListener('click', () => {
      const projectName = projectNameInput.value.trim();
      if (!projectName) {
        notificationSystem.show('Please enter a project name', 'warning');
        return;
      }

      // Ensure window.drumSettings is synced
      window.drumSettings = drumSettings;

      const projectData = {
        drumSettings,
        globalSizeMultiplier,
        currentBlendMode,
        currentBgColor,
        currentModeType,
        freeformStyle: freeformMode.style,
        chronicleLayout: chronicleMode.layout,
        bankModeSettings: midiManager.getState(),
        timelineSettings: {
          bpm: chronicleMode.bpm,
          subdivision: chronicleMode.subdivision,
          beatsPerMeasure: chronicleMode.beatsPerMeasure,
          metronomeEnabled: chronicleMode.metronomeEnabled,
          midiLatencyMs: chronicleMode.midiLatencyMs,
          showGrid: chronicleMode.showGrid,
          showDeviationGraph: chronicleMode.showDeviationGraph,
          deviationGraphMode: chronicleMode.deviationGraphMode,
          rowSpacing: chronicleMode.rowSpacing
        },
        timestamp: new Date().toISOString()
      };

      localStorage.setItem(`drum-painter-project-${projectName}`, JSON.stringify(projectData));
      notificationSystem.show(`Project "${projectName}" saved!`, 'success');
      projectNameInput.value = '';
      refreshProjectsList();
    });
  }

  if (loadProjectBtn && projectsList) {
    loadProjectBtn.addEventListener('click', () => {
      const projectName = projectsList.value;
      if (!projectName) {
        notificationSystem.show('Please select a project', 'warning');
        return;
      }

      try {
        const projectData = JSON.parse(localStorage.getItem(`drum-painter-project-${projectName}`));
        if (!projectData) {
          notificationSystem.show('Project not found', 'error');
          return;
        }

        // Load drum settings
        if (projectData.drumSettings) {
          Object.assign(drumSettings, projectData.drumSettings);
          window.drumSettings = drumSettings;
        }

        // Load global settings
        if (projectData.globalSizeMultiplier !== undefined) {
          globalSizeMultiplier = projectData.globalSizeMultiplier;
          const globalSizeSlider = document.getElementById('global-size');
          const globalSizeVal = document.getElementById('global-size-val');
          if (globalSizeSlider) globalSizeSlider.value = globalSizeMultiplier;
          if (globalSizeVal) globalSizeVal.textContent = `${globalSizeMultiplier.toFixed(1)}x`;
        }

        if (projectData.currentBlendMode !== undefined) {
          currentBlendMode = projectData.currentBlendMode;
          paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
          window.currentBlendMode = currentBlendMode;
          const blendSelect = document.getElementById('blend-select');
          if (blendSelect) blendSelect.value = currentBlendMode.toString();
        }

        if (projectData.currentBgColor !== undefined) {
          // Handle both old integer format and new hex string format
          if (typeof projectData.currentBgColor === 'number') {
            // Convert old integer index to hex color
            const oldColors = ['#ffffff', '#000000', '#202020', '#f0f0f0', '#c8c8c8'];
            currentBgColor = oldColors[projectData.currentBgColor] || '#ffffff';
          } else {
            currentBgColor = projectData.currentBgColor;
          }
          paintCanvas.blendMode(BLEND);
          paintCanvas.background(currentBgColor);
          paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
          window.currentBgColor = currentBgColor;
          const bgColorPicker = document.getElementById('bg-color-picker');
          if (bgColorPicker) bgColorPicker.value = currentBgColor;
        }

        if (projectData.currentMode !== undefined) {
          switchMode(projectData.currentMode);
        }

        // Load bank mode settings
        if (projectData.bankModeSettings && midiManager) {
          midiManager.loadState(projectData.bankModeSettings);
        }

        // Load timeline settings
        if (projectData.timelineSettings && chronicleMode) {
          if (projectData.timelineSettings.bpm !== undefined) {
            chronicleMode.bpm = projectData.timelineSettings.bpm;
          }
          if (projectData.timelineSettings.subdivision !== undefined) {
            chronicleMode.subdivision = projectData.timelineSettings.subdivision;
          }
          if (projectData.timelineSettings.beatsPerMeasure !== undefined) {
            chronicleMode.beatsPerMeasure = projectData.timelineSettings.beatsPerMeasure;
          }
          if (projectData.timelineSettings.metronomeEnabled !== undefined) {
            chronicleMode.metronomeEnabled = projectData.timelineSettings.metronomeEnabled;
          }
          if (projectData.timelineSettings.midiLatencyMs !== undefined) {
            chronicleMode.midiLatencyMs = projectData.timelineSettings.midiLatencyMs;
          }
          if (projectData.timelineSettings.showGrid !== undefined) {
            chronicleMode.showGrid = projectData.timelineSettings.showGrid;
          }
          if (projectData.timelineSettings.showDeviationGraph !== undefined) {
            chronicleMode.showDeviationGraph = projectData.timelineSettings.showDeviationGraph;
          }
          if (projectData.timelineSettings.deviationGraphMode !== undefined) {
            chronicleMode.deviationGraphMode = projectData.timelineSettings.deviationGraphMode;
          }
          if (projectData.timelineSettings.deviationGraphWidth !== undefined) {
            chronicleMode.deviationGraphWidth = projectData.timelineSettings.deviationGraphWidth;
          }
          if (projectData.timelineSettings.deviationGraphHeight !== undefined) {
            chronicleMode.deviationGraphHeight = projectData.timelineSettings.deviationGraphHeight;
          }
          if (projectData.timelineSettings.rowSpacing !== undefined) {
            chronicleMode.rowSpacing = projectData.timelineSettings.rowSpacing;
          }
          if (projectData.timelineSettings.warmupMeasures !== undefined) {
            chronicleMode.warmupMeasures = projectData.timelineSettings.warmupMeasures;
          }
          if (projectData.timelineSettings.measuresPerStaffPreference !== undefined) {
            chronicleMode.measuresPerStaffPreference = projectData.timelineSettings.measuresPerStaffPreference;
          }
          // Tempo automation settings
          if (projectData.timelineSettings.tempoAutomationEnabled !== undefined) {
            chronicleMode.tempoAutomationEnabled = projectData.timelineSettings.tempoAutomationEnabled;
          }
          if (projectData.timelineSettings.tempoAutomationBpmChange !== undefined) {
            chronicleMode.tempoAutomationBpmChange = projectData.timelineSettings.tempoAutomationBpmChange;
          }
          if (projectData.timelineSettings.tempoAutomationBars !== undefined) {
            chronicleMode.tempoAutomationBars = projectData.timelineSettings.tempoAutomationBars;
          }
          if (projectData.timelineSettings.tempoAutomationMaxBpm !== undefined) {
            chronicleMode.tempoAutomationMaxBpm = projectData.timelineSettings.tempoAutomationMaxBpm;
          }
          if (projectData.timelineSettings.tempoAutomationDirection !== undefined) {
            chronicleMode.tempoAutomationDirection = projectData.timelineSettings.tempoAutomationDirection;
          }
          if (projectData.timelineSettings.tempoAutomationMinBpm !== undefined) {
            chronicleMode.tempoAutomationMinBpm = projectData.timelineSettings.tempoAutomationMinBpm;
          }
          // Sync UI with loaded settings
          if (timelineControls) {
            timelineControls.syncUI();
          }
        }

        // Rebuild UI
        customizationPanel.build();
        updateActiveDrumIndicator();

        notificationSystem.show(`Project "${projectName}" loaded!`, 'success');
      } catch (error) {
        debugError('Error loading project:', error);
        showUserFriendlyError(notificationSystem, 'PROJECT_LOAD_ERROR', error);
      }
    });
  }

  if (deleteProjectBtn && projectsList) {
    deleteProjectBtn.addEventListener('click', () => {
      const projectName = projectsList.value;
      if (!projectName) {
        notificationSystem.show('Please select a project', 'warning');
        return;
      }

      if (confirm(`Delete project "${projectName}"?`)) {
        localStorage.removeItem(`drum-painter-project-${projectName}`);
        notificationSystem.show(`Project "${projectName}" deleted`, 'info');
        refreshProjectsList();
      }
    });
  }

  // Initialize projects list
  refreshProjectsList();
}

/**
 * Setup MIDI Devices Modal
 */
function setupMidiDevicesModal() {
  const midiStatus = document.getElementById('midi-status');
  const backdrop = document.getElementById('midi-devices-backdrop');
  const closeBtn = document.getElementById('close-midi-devices-btn');

  // Open modal when clicking MIDI status
  if (midiStatus) {
    midiStatus.addEventListener('click', () => {
      openMidiDevicesModal();
    });

    // Hover effect
    midiStatus.addEventListener('mouseenter', () => {
      midiStatus.style.background = '#e9ecef';
    });

    midiStatus.addEventListener('mouseleave', () => {
      midiStatus.style.background = '#f8f9fa';
    });
  }

  // Close modal
  if (closeBtn) {
    closeBtn.addEventListener('click', closeMidiDevicesModal);
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeMidiDevicesModal();
      }
    });
  }
}

/**
 * Open MIDI devices modal
 */
function openMidiDevicesModal() {
  const backdrop = document.getElementById('midi-devices-backdrop');
  const devicesList = document.getElementById('midi-devices-list');

  if (!backdrop || !devicesList) return;

  // Populate devices list - prefer direct midiManager access
  const devices = midiManager?.connectedDevices || window.midiDevicesList || [];
  debugLog('🎹 Opening MIDI devices modal, found devices:', devices);

  if (devices.length === 0) {
    devicesList.innerHTML = `
      <div style="text-align: center; padding: 20px; opacity: 0.7;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 12px; opacity: 0.5;">
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/>
          <path d="M6 9V21"/>
          <path d="M18 9V21"/>
        </svg>
        <div style="font-size: 14px;">No MIDI devices connected</div>
      </div>
    `;
  } else {
    devicesList.innerHTML = devices.map((device, index) => `
      <div style="
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: ${index < devices.length - 1 ? '12px' : '0'};
        border: 1px solid rgba(255, 255, 255, 0.2);
      ">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/>
            <path d="M6 9V21"/>
            <path d="M18 9V21"/>
          </svg>
          <div style="font-weight: bold; font-size: 14px;">${device.name}</div>
        </div>
        <div style="font-size: 12px; opacity: 0.8; display: flex; flex-direction: column; gap: 4px; margin-left: 28px;">
          <div>Manufacturer: ${device.manufacturer}</div>
          <div>State: ${device.state === 'connected' ? '✓ Connected' : device.state}</div>
          <div style="font-size: 11px; opacity: 0.6; margin-top: 4px;">ID: ${device.id}</div>
        </div>
      </div>
    `).join('');
  }

  backdrop.style.display = 'flex';
}

/**
 * Close MIDI devices modal
 */
function closeMidiDevicesModal() {
  const backdrop = document.getElementById('midi-devices-backdrop');
  if (backdrop) {
    backdrop.style.display = 'none';
  }
}

/**
 * Setup Session Recording UI
 */
function setupSessionRecordingUI() {
  const recordBtn = document.getElementById('session-record-btn');
  const stopBtn = document.getElementById('session-stop-btn');
  const exportBtn = document.getElementById('session-export-btn');
  const clearBtn = document.getElementById('session-clear-btn');
  const statusEl = document.getElementById('session-status');

  if (!recordBtn || !stopBtn || !exportBtn || !clearBtn || !statusEl) {
    debugWarn('Session recording UI elements not found');
    return;
  }

  // Update UI based on recording status
  function updateUI() {
    const status = sessionRecorder.getStatus();
    const stats = sessionRecorder.getStats();

    if (status.isRecording) {
      // Recording in progress
      recordBtn.disabled = true;
      recordBtn.style.cursor = 'not-allowed';
      recordBtn.style.background = '#f0f0f0';

      stopBtn.disabled = false;
      stopBtn.style.cursor = 'pointer';
      stopBtn.style.background = 'white';
      stopBtn.style.fontWeight = 'bold';

      exportBtn.disabled = true;
      clearBtn.disabled = true;

      statusEl.textContent = `Recording... ${status.eventCount} events (${status.duration.toFixed(1)}s)`;
      statusEl.style.color = '#c00';
      statusEl.style.fontWeight = 'bold';
    } else if (stats.hasData) {
      // Has recorded data
      recordBtn.disabled = false;
      recordBtn.style.cursor = 'pointer';
      recordBtn.style.background = 'white';
      recordBtn.style.fontWeight = 'bold';

      stopBtn.disabled = true;
      stopBtn.style.cursor = 'not-allowed';
      stopBtn.style.background = '#f0f0f0';

      exportBtn.disabled = false;
      exportBtn.style.cursor = 'pointer';
      exportBtn.style.background = 'white';

      clearBtn.disabled = false;
      clearBtn.style.cursor = 'pointer';
      clearBtn.style.background = 'white';

      statusEl.textContent = `${stats.totalEvents} events recorded (${stats.duration.toFixed(1)}s)`;
      statusEl.style.color = '#060';
      statusEl.style.fontWeight = 'normal';
    } else {
      // Ready to record
      recordBtn.disabled = false;
      recordBtn.style.cursor = 'pointer';
      recordBtn.style.background = 'white';
      recordBtn.style.fontWeight = 'bold';

      stopBtn.disabled = true;
      stopBtn.style.cursor = 'not-allowed';
      stopBtn.style.background = '#f0f0f0';

      exportBtn.disabled = true;
      exportBtn.style.cursor = 'not-allowed';
      exportBtn.style.background = '#f0f0f0';

      clearBtn.disabled = true;
      clearBtn.style.cursor = 'not-allowed';
      clearBtn.style.background = '#f0f0f0';

      statusEl.textContent = 'Ready to record';
      statusEl.style.color = '#666';
      statusEl.style.fontWeight = 'normal';
    }
  }

  // Record button
  recordBtn.addEventListener('click', () => {
    sessionRecorder.startRecording();
    updateUI();
  });

  // Stop button
  stopBtn.addEventListener('click', () => {
    sessionRecorder.stopRecording();
    updateUI();
  });

  // Export button
  exportBtn.addEventListener('click', () => {
    sessionRecorder.exportToFile();
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear session data? This cannot be undone.')) {
      sessionRecorder.clearSession();
      updateUI();
    }
  });

  // Update UI during recording (refresh every 100ms)
  setInterval(() => {
    if (sessionRecorder.getStatus().isRecording) {
      updateUI();
    }
  }, 100);

  // Initial UI update
  updateUI();
}

/**
 * Setup Video Recorder UI
 */
function setupVideoRecorderUI() {
  const recordBtn = document.getElementById('video-record-btn');
  const recordIcon = document.getElementById('video-record-icon');
  const recordText = document.getElementById('video-record-text');
  const recordingStatus = document.getElementById('video-recording-status');
  const qualitySelect = document.getElementById('video-quality');

  // Check if recording is supported
  if (!VideoRecorder.isSupported()) {
    if (recordBtn) {
      recordBtn.disabled = true;
      recordBtn.style.opacity = '0.5';
      recordBtn.style.cursor = 'not-allowed';
      recordText.textContent = 'Not Supported';
    }
    debugWarn('⚠️ Video recording not supported in this browser');
    return;
  }

  // Quality selector
  if (qualitySelect) {
    qualitySelect.addEventListener('change', (e) => {
      videoRecorder.setQuality(e.target.value);
    });
  }

  // Record button
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      if (!videoRecorder.isRecording) {
        // Start recording
        videoRecorder.startRecording().then(success => {
          if (success) {
            updateVideoRecordingUI(true);
          }
        });
      } else {
        // Stop recording
        videoRecorder.stopRecording();
        updateVideoRecordingUI(false);
      }
    });
  }
}

/**
 * Update video recording UI state
 */
function updateVideoRecordingUI(isRecording) {
  const recordBtn = document.getElementById('video-record-btn');
  const recordIcon = document.getElementById('video-record-icon');
  const recordText = document.getElementById('video-record-text');
  const recordingStatus = document.getElementById('video-recording-status');

  if (isRecording) {
    // Recording state
    if (recordBtn) {
      recordBtn.style.background = '#7f1d1d';
    }
    if (recordIcon) {
      recordIcon.textContent = '■';
    }
    if (recordText) {
      recordText.textContent = 'Stop Recording';
    }
    if (recordingStatus) {
      recordingStatus.style.display = 'block';
    }
  } else {
    // Stopped state
    if (recordBtn) {
      recordBtn.style.background = '#dc2626';
    }
    if (recordIcon) {
      recordIcon.textContent = '●';
    }
    if (recordText) {
      recordText.textContent = 'Start Recording';
    }
    if (recordingStatus) {
      recordingStatus.style.display = 'none';
    }
  }
}

/**
 * Setup Recordings UI and event listeners
 */
function setupRecordingsUI() {
  // Event listeners for recording events
  window.addEventListener('recording-saved', () => {
    updateRecordingsList();
  });

  window.addEventListener('recording-deleted', () => {
    updateRecordingsList();
  });

  window.addEventListener('recordings-cleared', () => {
    updateRecordingsList();
  });

  // Clear all recordings button
  const clearAllBtn = document.getElementById('clear-recordings-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all recordings?')) {
        videoRecorder.clearAllRecordings();
      }
    });
  }

  // Initial update
  updateRecordingsList();
}

/**
 * Update the recordings list UI
 */
function updateRecordingsList() {
  const recordingsList = document.getElementById('recordings-list');
  if (!recordingsList) return;

  const recordings = videoRecorder.getRecordings();

  if (recordings.length === 0) {
    recordingsList.innerHTML = `
      <div style="font-size: 10px; color: #999; text-align: center; padding: 20px;">
        No recordings yet
      </div>
    `;
    return;
  }

  recordingsList.innerHTML = recordings.map((recording, index) => `
    <div class="recording-item" data-recording-id="${recording.id}" style="
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      padding: 10px;
      margin-bottom: ${index < recordings.length - 1 ? '8px' : '0'};
      border: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <div style="flex: 1;">
          <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">
            Recording #${recordings.length - index}
          </div>
          <div style="font-size: 10px; opacity: 0.7; display: flex; flex-direction: column; gap: 2px;">
            <div>${recording.timestamp.toLocaleTimeString()}</div>
            <div>${recording.duration}s • ${recording.size}MB • ${recording.quality}</div>
          </div>
        </div>
        <button class="delete-recording-btn" data-recording-id="${recording.id}"
          style="padding: 4px 8px; font-size: 10px; background: #dc2626; color: white; border: none; border-radius: 3px; cursor: pointer; opacity: 0.8;"
          title="Delete recording">
          Delete
        </button>
      </div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button class="download-recording-btn" data-recording-id="${recording.id}"
          style="padding: 6px 10px; font-size: 10px; background: #059669; color: white; border: none; border-radius: 3px; cursor: pointer; flex: 1; min-width: 80px;">
          Download Video
        </button>
        <label class="merge-audio-btn"
          style="padding: 6px 10px; font-size: 10px; background: #2563eb; color: white; border: none; border-radius: 3px; cursor: pointer; flex: 1; min-width: 80px; text-align: center; display: inline-block;">
          Merge Audio
          <input type="file" class="audio-file-input" data-recording-id="${recording.id}"
            accept="audio/*" style="display: none;">
        </label>
      </div>
      <div id="merge-progress-${recording.id}" style="display: none; margin-top: 8px;">
        <div style="font-size: 10px; margin-bottom: 4px; color: #3b82f6;">
          <span id="merge-status-${recording.id}">Merging...</span>
          <span id="merge-percent-${recording.id}"></span>
        </div>
        <div style="background: rgba(255, 255, 255, 0.1); height: 4px; border-radius: 2px; overflow: hidden;">
          <div id="merge-progress-bar-${recording.id}" style="background: #3b82f6; height: 100%; width: 0%; transition: width 0.3s;"></div>
        </div>
      </div>
    </div>
  `).join('');

  // Attach event listeners to buttons
  recordingsList.querySelectorAll('.download-recording-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.recordingId);
      videoRecorder.downloadRecording(id);
    });
  });

  recordingsList.querySelectorAll('.delete-recording-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.recordingId);
      if (confirm('Delete this recording?')) {
        videoRecorder.deleteRecording(id);
      }
    });
  });

  recordingsList.querySelectorAll('.audio-file-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = parseInt(input.dataset.recordingId);
      const file = e.target.files[0];
      if (!file) return;

      const recording = recordings.find(r => r.id === id);
      if (!recording) return;

      // Show progress UI
      const progressDiv = document.getElementById(`merge-progress-${id}`);
      const statusSpan = document.getElementById(`merge-status-${id}`);
      const percentSpan = document.getElementById(`merge-percent-${id}`);
      const progressBar = document.getElementById(`merge-progress-bar-${id}`);

      if (progressDiv) progressDiv.style.display = 'block';

      try {
        // Merge audio and video
        const mergedBlob = await audioVideoMerger.merge(
          recording.blob,
          file,
          (progress) => {
            // Update progress
            if (percentSpan) percentSpan.textContent = ` ${progress}%`;
            if (progressBar) progressBar.style.width = `${progress}%`;
          }
        );

        // Update status
        if (statusSpan) statusSpan.textContent = 'Complete!';
        if (percentSpan) percentSpan.textContent = '';
        if (progressBar) progressBar.style.width = '100%';

        // Auto-download merged file
        setTimeout(() => {
          const url = URL.createObjectURL(mergedBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `drum-painter-merged-${id}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY);

          // Hide progress after download
          setTimeout(() => {
            if (progressDiv) progressDiv.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
          }, 2000);
        }, 500);
      } catch (error) {
        debugError('Merge failed:', error);
        if (statusSpan) statusSpan.textContent = 'Merge failed';
        if (statusSpan) statusSpan.style.color = '#dc2626';
        showUserFriendlyError(notificationSystem, 'VIDEO_MERGE_ERROR', error);

        // Hide progress after a delay
        setTimeout(() => {
          if (progressDiv) progressDiv.style.display = 'none';
          if (progressBar) progressBar.style.width = '0%';
          if (statusSpan) {
            statusSpan.textContent = 'Merging...';
            statusSpan.style.color = '#3b82f6';
          }
        }, 3000);
      }

      // Reset file input
      input.value = '';
    });
  });
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

window.draw = function() {
  background(240);

  // Calculate scaling and offset
  let scaleFactor, displayWidth, displayHeight, offsetX, offsetY;

  // Check if we're in a time-based layout (staff or spiral)
  const isTimeBased = currentModeType === 'timeline' && ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(chronicleMode.layout);

  if (isTimeBased) {
    // Time-based layouts: scale based on width only, allow vertical scrolling
    scaleFactor = (width / paintCanvas.width) * CANVAS_FIT_SCALE;
    displayWidth = paintCanvas.width * scaleFactor;
    displayHeight = paintCanvas.height * scaleFactor;
    offsetX = (width - displayWidth) / 2;
    offsetY = timelineScrollY; // Apply scroll offset
  } else {
    // Other modes: scale based on width, allow vertical scrolling if canvas is tall
    scaleFactor = (width / paintCanvas.width) * CANVAS_FIT_SCALE;
    displayWidth = paintCanvas.width * scaleFactor;
    displayHeight = paintCanvas.height * scaleFactor;
    offsetX = (width - displayWidth) / 2;

    // If canvas fits in height, center it. Otherwise allow scrolling
    if (displayHeight <= height) {
      offsetY = (height - displayHeight) / 2;
      timelineScrollY = 0; // Reset scroll when canvas fits
    } else {
      offsetY = timelineScrollY; // Use scroll offset for tall canvases
    }
  }

  // Apply post-processing effects before displaying
  if (postProcessing) {
    postProcessing.apply(paintCanvas);
  }

  // Get bottom panel height for timeline mode (graph + metronome area)
  const bottomPanelHeight = isTimeBased ? chronicleMode.getBottomPanelHeight() : 0;
  const staffViewportHeight = height - bottomPanelHeight;

  if (isTimeBased && bottomPanelHeight > 0) {
    // Clip staff rendering to area above the bottom panel
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(0, 0, width, staffViewportHeight);
    drawingContext.clip();
  }

  // Draw the paint canvas
  image(paintCanvas, offsetX, offsetY, displayWidth, displayHeight);

  // Draw timeline guides OVER the canvas if in time-based layout
  if (isTimeBased) {
    chronicleMode.drawLaneGuides(window, offsetX, offsetY, scaleFactor, paintCanvas);
  }

  if (isTimeBased && bottomPanelHeight > 0) {
    // Restore clipping
    drawingContext.restore();

    // Draw bottom panel background
    noStroke();
    fill(240);
    rect(0, staffViewportHeight, width, bottomPanelHeight);

    // Draw separator line at panel top
    stroke(200);
    strokeWeight(1);
    line(0, staffViewportHeight, width, staffViewportHeight);
  }

  if (isTimeBased) {
    // Draw circular visual metronome (in panel area)
    chronicleMode.drawCircularMetronome(window, width, height);

    // Draw deviation graph (in panel area, staff mode only)
    chronicleMode.drawDeviationGraph(window, offsetX, offsetY, scaleFactor, drumSettings);

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
  }

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display(offsetX, offsetY, scaleFactor);
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // Update Timeline mode if active (time-based layouts) - handles metronome
  const isTimeBasedNow = currentModeType === 'timeline' && ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(chronicleMode.layout);
  if (isTimeBasedNow) {
    const context = {
      paintCanvas,
      drumSettings,
      globalSizeMultiplier,
      particles,
      strokeCount,
      currentBgColor
    };

    chronicleMode.update(context);
  }

  // Update and draw notification system
  notificationSystem.update();
  notificationSystem.draw(width, height);

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
};

window.keyPressed = function() {
  // Don't process keyboard shortcuts if user is typing in an input field
  const activeElement = document.activeElement;
  const isTypingInInput = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.tagName === 'SELECT' ||
    activeElement.isContentEditable
  );

  // Allow default behavior when typing in inputs (except for certain global shortcuts)
  if (isTypingInInput) {
    // ESC - blur the input to allow closing panels
    if (keyCode === 27) {
      activeElement.blur();
      return false;
    }
    // Allow all other keys to work normally in inputs
    return true;
  }

  // Don't process keyboard shortcuts if any panel is open (except H to hide UI)
  const panelOpen = customizationPanel.isVisible || midiMappingPanel.isVisible;

  // H - toggle UI (always allow this)
  if (key === 'h' || key === 'H') {
    showUI = !showUI;
    if (controlsEl) {
      controlsEl.style.display = showUI ? 'block' : 'none';
    }
    const drumSettingsEl = document.getElementById('drum-settings');
    if (drumSettingsEl) {
      drumSettingsEl.style.display = showUI ? 'block' : 'none';
    }
    const infoEl = document.getElementById('info');
    if (infoEl) {
      infoEl.style.display = showUI ? 'block' : 'none';
    }
    // Close modal panels when hiding UI
    if (!showUI) {
      if (customizationPanel.isVisible) customizationPanel.toggle();
      if (midiMappingPanel.isVisible) midiMappingPanel.toggle();
    }
    return false;
  }

  // ? - show keyboard shortcuts (always allow this)
  if (key === '?' || key === '/') {
    if (window.toggleShortcutsPanel) {
      window.toggleShortcutsPanel();
    }
    return false;
  }

  // U - show user guide (always allow this)
  if (key === 'u' || key === 'U') {
    if (window.toggleUserGuide) {
      window.toggleUserGuide();
    }
    return false;
  }

  // F - toggle fullscreen (always allow this)
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
    notificationSystem.show(fs ? 'Exited fullscreen' : 'Entered fullscreen');
    return false;
  }

  // ESC - close modals and panels (always allow this)
  if (keyCode === 27) { // ESC key
    // Close user guide
    if (window.hideUserGuide) {
      window.hideUserGuide();
    }
    // Close shortcuts panel
    if (window.hideShortcutsPanel) {
      window.hideShortcutsPanel();
    }
    // Close MIDI devices modal
    closeMidiDevicesModal();
    return false;
  }

  // Block all other keyboard shortcuts if a panel is open
  if (panelOpen) {
    return true; // Allow default behavior (typing in inputs)
  }

  // Space - toggle video recording
  if (key === ' ') {
    if (!videoRecorder.isRecording) {
      // Start recording
      videoRecorder.startRecording().then(success => {
        if (success) {
          updateVideoRecordingUI(true);
        }
      });
    } else {
      // Stop recording
      videoRecorder.stopRecording();
      updateVideoRecordingUI(false);
    }
    return false;
  }

  // Backspace - clear canvas
  if (keyCode === BACKSPACE) {
    // Ask for confirmation before clearing
    if (!confirm('Clear the entire canvas? This cannot be undone.')) {
      return false;
    }

    // Temporarily reset blend mode to normal for clearing
    paintCanvas.blendMode(BLEND);
    paintCanvas.background(currentBgColor);
    // Restore the current blend mode
    paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

    window.currentBgColor = currentBgColor; // Update global
    strokeCount = 0;
    particles = [];

    // Clear mode-specific state
    getCurrentMode().clear({ paintCanvas, currentBgColor });

    // Save state for undo
    stateManager.saveCanvasState(paintCanvas);

    debugLog('Canvas cleared');
    notificationSystem.show('Canvas cleared', 'success');
    return false;
  }

  // S - save image
  if (key === 's' || key === 'S') {
    let filename = `drum-painting-${getCurrentMode().name.replace(/\s+/g, '-')}-${Date.now()}.png`;
    paintCanvas.save(filename);
    debugLog(`Saved: ${filename}`);
    notificationSystem.show(`Saved: ${filename}`);
    return false;
  }

  // D - save settings as default (immediate save)
  if (key === 'd' || key === 'D') {
    // Ensure window.drumSettings is synced before saving
    window.drumSettings = drumSettings;

    if (stateManager.saveNow()) {
      infoLog('✓ Settings saved as default');
      notificationSystem.show('Settings saved');
    }
    return false;
  }

  // Z - undo
  if (key === 'z' || key === 'Z') {
    if (stateManager.undo(paintCanvas)) {
      notificationSystem.show('Undo');
    }
    return false;
  }

  // Y - redo
  if (key === 'y' || key === 'Y') {
    if (stateManager.redo(paintCanvas)) {
      notificationSystem.show('Redo');
    }
    return false;
  }

  // B - cycle blend modes
  if (key === 'b' || key === 'B') {
    currentBlendMode = (currentBlendMode + 1) % BLEND_MODES.length;
    paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
    window.currentBlendMode = currentBlendMode;
    const blendSelect = document.getElementById('blend-select');
    if (blendSelect) blendSelect.value = currentBlendMode.toString();
    notificationSystem.show(`Blend: ${BLEND_MODE_NAMES[currentBlendMode]}`);
    return false;
  }

  // P - play/pause timeline (only for time-based layouts: staff, spiral)
  if (key === 'p' || key === 'P') {
    if (currentModeType === 'timeline' && (chronicleMode.layout === 'staff' || chronicleMode.layout === 'spiral')) {
      if (timelineControls) {
        timelineControls.toggleRecording();
        notificationSystem.show(chronicleMode.recording ? 'Timeline started' : 'Timeline paused');
      }
    }
    return false;
  }

  // C - clear timeline
  if (key === 'c' || key === 'C') {
    if (currentModeType === 'timeline') {
      if (confirm('Clear the timeline? This cannot be undone.')) {
        // Reset blend mode temporarily for clearing
        paintCanvas.blendMode(BLEND);
        paintCanvas.background(currentBgColor);
        paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

        window.currentBgColor = currentBgColor;
        strokeCount = 0;
        particles = [];

        // Clear timeline state
        chronicleMode.clear({ paintCanvas, currentBgColor });

        // Save state for undo
        stateManager.saveCanvasState(paintCanvas);

        notificationSystem.show('Timeline cleared', 'success');
      }
    }
    return false;
  }

  // Arrow keys - navigate modes and styles/layouts
  if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) {
    // Left/Right: Toggle between Freeform and Timeline
    const freeformRadio = document.getElementById('mode-type-freeform');
    const timelineRadio = document.getElementById('mode-type-timeline');

    if (keyCode === LEFT_ARROW && currentModeType !== 'freeform') {
      // Switch to Freeform
      if (freeformRadio) {
        freeformRadio.click();
        notificationSystem.show('Mode: Freeform');
      }
    } else if (keyCode === RIGHT_ARROW && currentModeType === 'freeform') {
      // Switch to Timeline
      if (timelineRadio) {
        timelineRadio.click();
        notificationSystem.show('Mode: Timeline');
      }
    }
    return false;
  }

  if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
    // Up/Down: Cycle through styles (Freeform) or layouts (Timeline)
    if (currentModeType === 'freeform') {
      const styleSelect = document.getElementById('freeform-style-select');
      if (styleSelect) {
        const options = Array.from(styleSelect.options);
        const currentIndex = options.findIndex(opt => opt.value === freeformMode.style);
        let newIndex;

        if (keyCode === UP_ARROW) {
          newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        } else {
          newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        }

        styleSelect.selectedIndex = newIndex;
        styleSelect.dispatchEvent(new Event('change'));
        notificationSystem.show(`Style: ${options[newIndex].text.split('—')[0].trim()}`);
      }
    } else {
      const layoutSelect = document.getElementById('timeline-layout-select');
      if (layoutSelect) {
        const options = Array.from(layoutSelect.options);
        const currentIndex = options.findIndex(opt => opt.value === chronicleMode.layout);
        let newIndex;

        if (keyCode === UP_ARROW) {
          newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        } else {
          newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        }

        layoutSelect.selectedIndex = newIndex;
        layoutSelect.dispatchEvent(new Event('change'));
        notificationSystem.show(`Layout: ${options[newIndex].text.split('—')[0].trim()}`);
      }
    }
    return false;
  }

  // 1-9 - select drum in customization panel
  if (key >= '1' && key <= '9') {
    const drumIndex = parseInt(key) - 1;
    if (drumIndex < DRUM_KIT_CONFIG.length) {
      const drumId = DRUM_KIT_CONFIG[drumIndex].id;

      // If customization panel is open, select the drum
      if (customizationPanel.isVisible) {
        customizationPanel.selectDrum(drumId);
        notificationSystem.show(`Selected: ${DRUM_KIT_CONFIG[drumIndex].name}`);
      } else {
        // Open panel and select drum
        customizationPanel.toggle();
        setTimeout(() => {
          customizationPanel.selectDrum(drumId);
          notificationSystem.show(`Selected: ${DRUM_KIT_CONFIG[drumIndex].name}`);
        }, 100);
      }
    }
    return false;
  }

  return true;
};

window.windowResized = function() {
  resizeCanvas(windowWidth, windowHeight);
};

// ===== MIDI CALLBACKS =====

/**
 * Handle MIDI note painting
 * Called by MidiManager when a note is played
 */
function handlePaint(note, velocity, deviceId) {
  // Check if this device+note combination is mapped to a drum
  // Pass midiManager for smart device key matching
  const drumId = findDrumByMidiNote(note, deviceId, drumSettings, midiManager);

  if (!drumId) {
    // No mapping found - don't paint
    const device = midiManager.connectedDevices.find(d => d.id === deviceId);
    const deviceName = device ? device.name : deviceId;
    debugLog(`⚠️ Unmapped MIDI: Note ${note} from ${deviceName} - not painting`);
    return;
  }

  const drumName = drumSettings[drumId]?.name || drumId;
  debugLog(`🎵 Paint: Note ${note} (${drumName}), Vel ${velocity.toFixed(2)}`);

  // Record session event if recording is active
  if (sessionRecorder) {
    sessionRecorder.recordEvent(note, velocity, deviceId, drumId);
  }

  // Flash MIDI activity indicator
  const activityLight = document.getElementById('midi-activity-light');
  if (activityLight) {
    activityLight.style.opacity = '1';
    setTimeout(() => {
      activityLight.style.opacity = '0';
    }, 100);
  }

  // Create context for mode
  const context = {
    paintCanvas,
    drumSettings,
    globalSizeMultiplier,
    particles,
    strokeCount,
    midiDeviceId: deviceId,  // Add device ID to context
    debugPanel,  // Add debug panel to context so modes can record actual values
    drumId,  // Add drumId to context so modes know which drum is being played
    DRUM_KIT_CONFIG  // Add drum kit config for pattern calculations
  };

  // Add currentBgColor to context
  context.currentBgColor = currentBgColor;

  // Paint with current mode
  try {
    getCurrentMode().paint(note, velocity, context);
    strokeCount++;
  } catch (error) {
    debugError('Error painting:', error);
    showUserFriendlyError(notificationSystem, 'PAINT_ERROR', error);
  }
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
        const ccMin = assignment.ccMin || 0;
        const ccMax = assignment.ccMax || 127;
        const normalizedValue = (ccValue - ccMin) / (ccMax - ccMin);

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
  const isTimeBased = ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(mapping.layout);
  const timelineControlsEl = document.getElementById('timeline-controls');
  if (timelineControlsEl) {
    timelineControlsEl.style.display = (mapping.type !== 'freeform' && isTimeBased) ? 'block' : 'none';
  }

  // Show/hide Quick Settings video section (hide for time-based layouts)
  const quickSettingsVideoSection = document.getElementById('quick-settings-video-section');
  if (quickSettingsVideoSection) {
    quickSettingsVideoSection.style.display = (mapping.type !== 'freeform' && isTimeBased) ? 'none' : 'block';
  }

  // Don't hide Quick Settings panel - it will be hidden when recording starts
  // and shown when recording stops

  debugLog(`Mode: ${getCurrentMode().name}`);
  notificationSystem.show(getCurrentMode().name);
}

/**
 * Load saved settings from localStorage or default-settings.json
 */
async function loadSavedSettings() {
  // First try localStorage
  let savedState = stateManager.loadDefault();

  // If localStorage is empty, try loading from bundled default-settings.json
  if (!savedState) {
    savedState = await stateManager.loadFromFile();
  }

  if (!savedState) {
    debugLog('No saved settings found, using factory defaults');
    return;
  }

  // Load custom drum kit config if available (must be done BEFORE loading drum settings)
  if (savedState.drumKitConfig && Array.isArray(savedState.drumKitConfig)) {
    // Clear and reload config
    DRUM_KIT_CONFIG.length = 0;
    savedState.drumKitConfig.forEach(drum => DRUM_KIT_CONFIG.push(drum));
    debugLog(`✓ Loaded drum kit config: ${DRUM_KIT_CONFIG.length} drums`);
  }

  // Apply bank mode settings FIRST (before orphan cleanup that might auto-save)
  if (savedState.bankModeSettings && midiManager) {
    midiManager.loadState(savedState.bankModeSettings);
    debugLog('✓ Loaded bank mode settings (early)');
  }

  // Apply drum settings (merge instead of replace to maintain references)
  if (savedState.drumSettings) {
    debugLog('Loading drum settings from storage:', JSON.stringify(savedState.drumSettings, null, 2));
    for (const drumId in savedState.drumSettings) {
      if (drumSettings[drumId]) {
        // Update existing drum
        Object.assign(drumSettings[drumId], savedState.drumSettings[drumId]);
        // Ensure midiDevice exists (for backwards compatibility with old saves)
        if (drumSettings[drumId].midiDevice === undefined) {
          drumSettings[drumId].midiDevice = null;
        }
      } else {
        // Add new custom drum that doesn't exist in factory settings
        drumSettings[drumId] = savedState.drumSettings[drumId];
        // Ensure midiDevice exists
        if (drumSettings[drumId].midiDevice === undefined) {
          drumSettings[drumId].midiDevice = null;
        }
        debugLog(`➕ Added custom drum from saved settings: ${drumId} (${savedState.drumSettings[drumId].name})`);
      }
    }
    // Update global window.drumSettings reference
    window.drumSettings = drumSettings;
    debugLog('✓ Loaded drum settings');
    debugLog('Current drum settings after load:', JSON.stringify(drumSettings, null, 2));
  }

  // Load or migrate drumOrder
  if (savedState.drumOrder && Array.isArray(savedState.drumOrder)) {
    // New format: use saved drumOrder
    drumOrder = savedState.drumOrder;
    debugLog(`✓ Loaded drumOrder: ${drumOrder.length} drums`);
  } else {
    // Migration: generate drumOrder from DRUM_KIT_CONFIG (preserves user's drum order)
    drumOrder = DRUM_KIT_CONFIG.map(d => d.id);
    debugLog(`✓ Migrated drumOrder from config: ${drumOrder.length} drums`);
  }
  // Update global reference
  window.drumOrder = drumOrder;

  // Load spiral settings BEFORE orphan cleanup (so auto-save has correct values)
  if (savedState.spiralSettings && chronicleMode) {
    if (savedState.spiralSettings.tightness !== undefined) {
      chronicleMode.spiralSettings.tightness = savedState.spiralSettings.tightness;
    }
    if (savedState.spiralSettings.startRadius !== undefined) {
      chronicleMode.spiralSettings.startRadius = savedState.spiralSettings.startRadius;
    }
    if (savedState.spiralSettings.syncToBPM !== undefined) {
      chronicleMode.spiralSettings.syncToBPM = savedState.spiralSettings.syncToBPM;
    }
    if (savedState.spiralSettings.separateTracks !== undefined) {
      chronicleMode.spiralSettings.separateTracks = savedState.spiralSettings.separateTracks;
    }
    if (savedState.spiralSettings.trackSpacing !== undefined) {
      chronicleMode.spiralSettings.trackSpacing = savedState.spiralSettings.trackSpacing;
    }
    debugLog('✓ Loaded spiral settings (early)');
  }

  // Load timeline settings BEFORE orphan cleanup (so auto-save has correct values)
  if (savedState.timelineSettings && chronicleMode) {
    if (savedState.timelineSettings.bpm !== undefined) {
      chronicleMode.bpm = savedState.timelineSettings.bpm;
    }
    if (savedState.timelineSettings.subdivision !== undefined) {
      chronicleMode.subdivision = savedState.timelineSettings.subdivision;
    }
    if (savedState.timelineSettings.beatsPerMeasure !== undefined) {
      chronicleMode.beatsPerMeasure = savedState.timelineSettings.beatsPerMeasure;
    }
    if (savedState.timelineSettings.metronomeEnabled !== undefined) {
      debugLog('📦 Loading metronomeEnabled from savedState:', savedState.timelineSettings.metronomeEnabled);
      chronicleMode.metronomeEnabled = savedState.timelineSettings.metronomeEnabled;
      debugLog('📦 chronicleMode.metronomeEnabled is now:', chronicleMode.metronomeEnabled);
    } else {
      debugLog('⚠️ No metronomeEnabled in savedState.timelineSettings');
    }
    if (savedState.timelineSettings.midiLatencyMs !== undefined) {
      chronicleMode.midiLatencyMs = savedState.timelineSettings.midiLatencyMs;
    }
    if (savedState.timelineSettings.showGrid !== undefined) {
      chronicleMode.showGrid = savedState.timelineSettings.showGrid;
    }
    if (savedState.timelineSettings.showDeviationGraph !== undefined) {
      chronicleMode.showDeviationGraph = savedState.timelineSettings.showDeviationGraph;
    }
    if (savedState.timelineSettings.deviationGraphMode !== undefined) {
      chronicleMode.deviationGraphMode = savedState.timelineSettings.deviationGraphMode;
    }
    if (savedState.timelineSettings.deviationGraphWidth !== undefined) {
      chronicleMode.deviationGraphWidth = savedState.timelineSettings.deviationGraphWidth;
    }
    if (savedState.timelineSettings.deviationGraphHeight !== undefined) {
      chronicleMode.deviationGraphHeight = savedState.timelineSettings.deviationGraphHeight;
    }
    if (savedState.timelineSettings.rowSpacing !== undefined) {
      chronicleMode.rowSpacing = savedState.timelineSettings.rowSpacing;
    }
    if (savedState.timelineSettings.warmupMeasures !== undefined) {
      chronicleMode.warmupMeasures = savedState.timelineSettings.warmupMeasures;
    }
    if (savedState.timelineSettings.measuresPerStaffPreference !== undefined) {
      chronicleMode.measuresPerStaffPreference = savedState.timelineSettings.measuresPerStaffPreference;
    }
    if (savedState.timelineSettings.layout !== undefined) {
      chronicleMode.layout = savedState.timelineSettings.layout;
    }
    // Tempo automation settings
    if (savedState.timelineSettings.tempoAutomationEnabled !== undefined) {
      chronicleMode.tempoAutomationEnabled = savedState.timelineSettings.tempoAutomationEnabled;
    }
    if (savedState.timelineSettings.tempoAutomationBpmChange !== undefined) {
      chronicleMode.tempoAutomationBpmChange = savedState.timelineSettings.tempoAutomationBpmChange;
    }
    if (savedState.timelineSettings.tempoAutomationBars !== undefined) {
      chronicleMode.tempoAutomationBars = savedState.timelineSettings.tempoAutomationBars;
    }
    if (savedState.timelineSettings.tempoAutomationMaxBpm !== undefined) {
      chronicleMode.tempoAutomationMaxBpm = savedState.timelineSettings.tempoAutomationMaxBpm;
    }
    if (savedState.timelineSettings.tempoAutomationDirection !== undefined) {
      chronicleMode.tempoAutomationDirection = savedState.timelineSettings.tempoAutomationDirection;
    }
    if (savedState.timelineSettings.tempoAutomationMinBpm !== undefined) {
      chronicleMode.tempoAutomationMinBpm = savedState.timelineSettings.tempoAutomationMinBpm;
    }
    debugLog('✓ Loaded timeline settings (early)');
  }

  // Clean up orphaned drums (two-way cleanup)

  // 1. Remove drums from DRUM_KIT_CONFIG that don't have settings
  for (let i = DRUM_KIT_CONFIG.length - 1; i >= 0; i--) {
    const drumId = DRUM_KIT_CONFIG[i].id;
    if (!drumSettings[drumId]) {
      debugWarn(`⚠️ Removing orphaned drum from config: ${drumId}`);
      DRUM_KIT_CONFIG.splice(i, 1);
    }
  }

  // 2. Remove settings for drums that aren't in DRUM_KIT_CONFIG (more important!)
  const validDrumIds = new Set(DRUM_KIT_CONFIG.map(d => d.id));
  const orphanedSettings = [];
  for (const drumId in drumSettings) {
    if (!validDrumIds.has(drumId)) {
      orphanedSettings.push(drumId);
    }
  }

  if (orphanedSettings.length > 0) {
    debugWarn(`🗑️ Removing ${orphanedSettings.length} orphaned drum settings not in current config:`);
    orphanedSettings.forEach(drumId => {
      debugWarn(`  - ${drumId} (${drumSettings[drumId]?.name || 'unknown'})`);
      delete drumSettings[drumId];
    });

    // Auto-save after cleanup
    const appState = {
      drumSettings,
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
        showDeviationGraph: chronicleMode.showDeviationGraph,
        deviationGraphMode: chronicleMode.deviationGraphMode,
        rowSpacing: chronicleMode.rowSpacing,
        warmupMeasures: chronicleMode.warmupMeasures,
        measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference,
        tempoAutomationEnabled: chronicleMode.tempoAutomationEnabled,
        tempoAutomationBpmChange: chronicleMode.tempoAutomationBpmChange,
        tempoAutomationBars: chronicleMode.tempoAutomationBars,
        tempoAutomationMaxBpm: chronicleMode.tempoAutomationMaxBpm
      },
      bankModeSettings: midiManager.getState()
    };
    stateManager.saveAsDefault(appState);
    infoLog(`✓ Cleaned up and saved settings`);
  }

  // Apply global settings
  if (savedState.globalSettings) {
    if (savedState.globalSettings.sizeMultiplier !== undefined) {
      globalSizeMultiplier = savedState.globalSettings.sizeMultiplier;
      // Update UI slider
      const globalSizeSlider = document.getElementById('global-size');
      const globalSizeVal = document.getElementById('global-size-val');
      if (globalSizeSlider) globalSizeSlider.value = globalSizeMultiplier;
      if (globalSizeVal) globalSizeVal.textContent = `${globalSizeMultiplier.toFixed(1)}x`;
    }
    if (savedState.globalSettings.blendMode !== undefined) {
      currentBlendMode = savedState.globalSettings.blendMode;
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
      window.currentBlendMode = currentBlendMode; // Update global
      // Update UI dropdown
      const blendSelect = document.getElementById('blend-select');
      if (blendSelect) blendSelect.value = currentBlendMode.toString();
    }
    if (savedState.globalSettings.bgColor !== undefined) {
      // Handle both old integer format and new hex string format
      if (typeof savedState.globalSettings.bgColor === 'number') {
        // Convert old integer index to hex color
        const oldColors = ['#ffffff', '#000000', '#202020', '#f0f0f0', '#c8c8c8'];
        currentBgColor = oldColors[savedState.globalSettings.bgColor] || '#ffffff';
      } else {
        currentBgColor = savedState.globalSettings.bgColor;
      }
      // Temporarily reset blend mode to normal for clearing
      paintCanvas.blendMode(BLEND);
      paintCanvas.background(currentBgColor);
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
      // Update global window reference
      window.currentBgColor = currentBgColor;
      // Update UI color picker
      const bgColorPicker = document.getElementById('bg-color-picker');
      if (bgColorPicker) bgColorPicker.value = currentBgColor;
    }
    debugLog('✓ Loaded global settings');
  }

  // Update active drum indicator (bank mode settings already loaded earlier)
  if (savedState.bankModeSettings && midiManager) {
    updateActiveDrumIndicator(); // Update indicator if bank mode was saved as enabled
  }

  // Load paint mode (new two-tier structure)
  if (savedState.currentModeType !== undefined) {
    // Load new two-tier mode structure
    currentModeType = savedState.currentModeType;

    if (savedState.freeformStyle !== undefined) {
      freeformMode.setStyle(savedState.freeformStyle);
    }

    if (savedState.chronicleLayout !== undefined) {
      chronicleMode.layout = savedState.chronicleLayout;
    }

    // Sync UI elements - note that initializeUI hasn't been called yet, so we need to do this after
    // For now, just set the mode type and we'll sync UI in initializeUI
    debugLog('✓ Loaded paint mode (new structure):', currentModeType,
                savedState.freeformStyle || 'default',
                savedState.chronicleLayout || 'default');
  } else if (savedState.currentMode !== undefined) {
    // Legacy: Load old mode index and convert to new structure
    switchMode(savedState.currentMode);
    infoLog('✓ Loaded paint mode (legacy):', savedState.currentMode);
  }

  // Update spiral UI sliders/dropdowns (settings already loaded earlier)
  if (savedState.spiralSettings && chronicleMode) {
    if (savedState.spiralSettings.tightness !== undefined) {
      const spiralTightnessSlider = document.getElementById('spiral-tightness');
      const spiralTightnessVal = document.getElementById('spiral-tightness-val');
      if (spiralTightnessSlider) spiralTightnessSlider.value = savedState.spiralSettings.tightness;
      if (spiralTightnessVal) spiralTightnessVal.textContent = savedState.spiralSettings.tightness;
    }
    if (savedState.spiralSettings.separateTracks !== undefined) {
      const spiralSeparateTracksCheckbox = document.getElementById('spiral-separate-tracks');
      if (spiralSeparateTracksCheckbox) spiralSeparateTracksCheckbox.checked = savedState.spiralSettings.separateTracks;
      const spiralTrackSpacingRow = document.getElementById('spiral-track-spacing-row');
      if (spiralTrackSpacingRow) spiralTrackSpacingRow.style.display = savedState.spiralSettings.separateTracks ? 'flex' : 'none';
    }
    if (savedState.spiralSettings.trackSpacing !== undefined) {
      const spiralTrackSpacingSlider = document.getElementById('spiral-track-spacing');
      const spiralTrackSpacingDisplay = document.getElementById('spiral-track-spacing-display');
      if (spiralTrackSpacingSlider) spiralTrackSpacingSlider.value = savedState.spiralSettings.trackSpacing;
      if (spiralTrackSpacingDisplay) spiralTrackSpacingDisplay.textContent = savedState.spiralSettings.trackSpacing;
    }
  }

  // Update timeline UI dropdowns (settings already loaded earlier)
  if (savedState.timelineSettings && chronicleMode) {
    if (savedState.timelineSettings.layout !== undefined) {
      const timelineLayoutSelect = document.getElementById('timeline-layout');
      if (timelineLayoutSelect) timelineLayoutSelect.value = savedState.timelineSettings.layout;
    }
  }

  infoLog(`📁 Loaded settings from ${savedState.timestamp}`);
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
      debugLog(`🔄 Migrating drum ID: ${oldId} -> ${newId}`);

      // Copy all settings from old ID to new ID
      drumSettings[newId] = { ...drumSettings[oldId] };

      // Delete old ID
      delete drumSettings[oldId];

      // Update bank mode assignments if present
      if (midiManager.bankPadAssignments && midiManager.bankPadAssignments[oldId]) {
        midiManager.bankPadAssignments[newId] = midiManager.bankPadAssignments[oldId];
        delete midiManager.bankPadAssignments[oldId];
      }

      migrated = true;
    }
  }

  if (migrated) {
    debugLog('✅ Drum ID migration complete');

    // Save updated settings
    const appState = {
      drumSettings,
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
        showDeviationGraph: chronicleMode.showDeviationGraph,
        deviationGraphMode: chronicleMode.deviationGraphMode,
        rowSpacing: chronicleMode.rowSpacing,
        warmupMeasures: chronicleMode.warmupMeasures,
        measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference,
        tempoAutomationEnabled: chronicleMode.tempoAutomationEnabled,
        tempoAutomationBpmChange: chronicleMode.tempoAutomationBpmChange,
        tempoAutomationBars: chronicleMode.tempoAutomationBars,
        tempoAutomationMaxBpm: chronicleMode.tempoAutomationMaxBpm
      },
      bankModeSettings: midiManager.getState()
    };
    stateManager.saveAsDefault(appState);
  }
}

/**
 * Migrate old drum mappings to use stable device keys
 * This upgrades legacy mappings that only have volatile device IDs
 */
function migrateDrumMappingsToStableKeys() {
  if (!midiManager || !midiManager.deviceRegistry) {
    debugLog('⚠️ Cannot migrate: MIDI manager not ready');
    return;
  }

  let migratedCount = 0;
  let ambiguousCount = 0;

  for (const drumId in drumSettings) {
    const drum = drumSettings[drumId];

    // Check if drum has a volatile device ID but no stable key (needs migration)
    if (drum.midiDevice && !drum.midiDeviceStable) {
      // Try to find stable key for this volatile device ID
      const stableKey = midiManager.deviceRegistry.getStableKey(drum.midiDevice);

      if (stableKey) {
        // Found it! Upgrade the mapping
        drum.midiDeviceStable = stableKey;
        migratedCount++;
        debugLog(`🔄 Migrated ${drumId} to use stable key: ${stableKey}`);
      } else {
        // Device ID not in current registry - might be disconnected or from old session
        // Try to match by device name from connectedDevices (less reliable)
        const connectedDevice = midiManager.connectedDevices.find(d => d.id === drum.midiDevice);
        if (connectedDevice && connectedDevice.stableKey) {
          drum.midiDeviceStable = connectedDevice.stableKey;
          migratedCount++;
          debugLog(`🔄 Migrated ${drumId} to use stable key (via connected devices): ${connectedDevice.stableKey}`);
        } else {
          ambiguousCount++;
          debugLog(`⚠️ Cannot migrate ${drumId}: device ID ${drum.midiDevice} not found in registry`);
          // Clear the obsolete device ID to allow note-only matching
          drum.midiDevice = null;
        }
      }
    }
  }

  if (migratedCount > 0) {
    debugLog(`✅ Migrated ${migratedCount} drum mapping(s) to stable device keys`);
    notificationSystem.show(`Upgraded ${migratedCount} drum mapping(s) to new device tracking`, 'success');

    // Save updated settings to persist the migration
    const appState = {
      drumSettings,
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
        showDeviationGraph: chronicleMode.showDeviationGraph,
        deviationGraphMode: chronicleMode.deviationGraphMode,
        rowSpacing: chronicleMode.rowSpacing,
        warmupMeasures: chronicleMode.warmupMeasures,
        measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference,
        tempoAutomationEnabled: chronicleMode.tempoAutomationEnabled,
        tempoAutomationBpmChange: chronicleMode.tempoAutomationBpmChange,
        tempoAutomationBars: chronicleMode.tempoAutomationBars,
        tempoAutomationMaxBpm: chronicleMode.tempoAutomationMaxBpm
      },
      bankModeSettings: midiManager.getState()
    };
    stateManager.saveAsDefault(appState);
  }

  if (ambiguousCount > 0) {
    debugLog(`⚠️ ${ambiguousCount} drum(s) with unknown devices - set to "any device" mode`);
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

// Helper function to check if mouse is over any UI panel
function isMouseOverPanel() {
  const panels = [
    document.getElementById('controls'),
    document.getElementById('drum-settings'),
    document.getElementById('customization-panel'),
    document.getElementById('midi-mapping-panel'),
    document.getElementById('shortcuts-panel'),
    document.getElementById('shortcuts-backdrop'),
    document.getElementById('user-guide-panel'),
    document.getElementById('user-guide-backdrop')
  ];

  for (const panel of panels) {
    if (!panel) continue;
    // Skip if element is not visible
    if (panel.style.display === 'none' || panel.style.display === '') continue;

    const rect = panel.getBoundingClientRect();
    if (mouseX >= rect.left && mouseX <= rect.right &&
        mouseY >= rect.top && mouseY <= rect.bottom) {
      return true;
    }
  }
  return false;
}

window.mousePressed = function() {
  // Don't interact if mouse is over any panel
  if (isMouseOverPanel()) {
    return;
  }

  // Handle metronome dragging in time-based layouts
  const isTimeBased = currentModeType === 'timeline' && ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(chronicleMode.layout);
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
  // Handle metronome dragging in time-based layouts
  const isTimeBased = currentModeType === 'timeline' && ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(chronicleMode.layout);
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
  const testVelocity = constrain(map(speed, 0, CLICK_PAINT_SPEED_MAX, CLICK_PAINT_VELOCITY_MAP_MIN, CLICK_PAINT_VELOCITY_MAP_MAX), CLICK_PAINT_VELOCITY_MAP_MIN, CLICK_PAINT_VELOCITY_MAP_MAX);

  // Use first drum for testing (bypass MIDI mapping check)
  const drumId = DRUM_KIT_CONFIG[0].id;
  const testNote = DRUM_KIT_CONFIG[0].defaultMidiNote;

  console.log(`🖱️ Mouse dragged: speed=${speed.toFixed(2)}, vel=${testVelocity.toFixed(2)}, mode=${getCurrentMode().name}`);

  // Create context for mode (direct paint, no MIDI mapping required)
  const context = {
    paintCanvas,
    drumSettings,
    globalSizeMultiplier,
    particles,
    strokeCount,
    debugPanel,
    drumId,
    DRUM_KIT_CONFIG,
    currentBgColor
  };

  // Paint directly with current mode
  try {
    getCurrentMode().paint(testNote, testVelocity, context);
    strokeCount++;
  } catch (error) {
    debugError('Error painting with mouse:', error);
    showUserFriendlyError(notificationSystem, 'PAINT_ERROR', error);
  }

  // Update previous position
  prevMouseX = mouseX;
  prevMouseY = mouseY;
};

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

  // Single click for single stroke
  const drumId = DRUM_KIT_CONFIG[0].id;
  const testNote = DRUM_KIT_CONFIG[0].defaultMidiNote;
  const testVelocity = 0.7; // Medium velocity for clicks

  console.log(`🖱️ Mouse click: Note ${testNote}, Vel ${testVelocity.toFixed(2)}, Mode: ${getCurrentMode().name}`);

  // Create context for mode (direct paint, no MIDI mapping required)
  const context = {
    paintCanvas,
    drumSettings,
    globalSizeMultiplier,
    particles,
    strokeCount,
    debugPanel,
    drumId,
    DRUM_KIT_CONFIG,
    currentBgColor
  };

  // Paint directly with current mode
  try {
    getCurrentMode().paint(testNote, testVelocity, context);
    strokeCount++;
  } catch (error) {
    debugError('Error painting with mouse:', error);
    showUserFriendlyError(notificationSystem, 'PAINT_ERROR', error);
  }
};

window.mouseReleased = function() {
  // Handle metronome release in time-based layouts
  const isTimeBased = currentModeType === 'timeline' && ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(chronicleMode.layout);
  if (isTimeBased) {
    chronicleMode.handleMetronomeMouseReleased();
    chronicleMode.handleDeviationGraphMouseReleased();
  }

  // Stop dragging scrollbar
  isDraggingScrollbar = false;
};

// Mouse wheel handler for vertical scrolling
window.mouseWheel = function(event) {
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
