/**
 * Drum Painter - Main Entry Point
 * Modular version with ES6 modules
 */

import { PAINT_CANVAS_WIDTH, PAINT_CANVAS_HEIGHT, BG_COLORS, BLEND_MODE_NAMES } from './config/constants.js';
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
import { DebugPanel } from './ui/DebugPanel.js';
import { findDrumByMidiNote } from './utils/drumHelpers.js';
import { applyAllThemes } from './utils/applyTheme.js';

// ===== GLOBAL STATE =====
let paintCanvas;
let particles = [];
let currentModeType = 'freeform'; // 'freeform' or 'chronicle'
let strokeCount = 0;
let globalSizeMultiplier = 1.0;
let showUI = true;
let currentBgColor = 0;
let currentBlendMode = 0;
let BLEND_MODES = []; // Will be initialized in setup()
let timelineScrollY = 0; // Vertical scroll offset for timeline mode
let isDraggingScrollbar = false; // Track if user is dragging scrollbar
let scrollbarDragStartY = 0; // Starting Y position of drag

// Drum settings
let drumSettings = generateFactorySettings();

// Expose globals for timeline mode to access
window.drumSettings = drumSettings;

// System managers
let midiManager;
let stateManager;
let notificationSystem;
let customizationPanel;
let midiMappingPanel;
let timelineControls;
let videoRecorder;
let debugPanel;

// DOM elements
let midiStatusEl;
let controlsEl;

// Initialize paint modes
const freeformMode = new FreeformMode();
const chronicleMode = new TimelineMode(DRUM_KIT_CONFIG);

// Helper function to get current active mode
function getCurrentMode() {
  return currentModeType === 'freeform' ? freeformMode : chronicleMode;
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
  paintCanvas.background(BG_COLORS[currentBgColor]);
  paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

  // Expose paintCanvas and currentBgColor globally
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

  // Initialize system managers
  stateManager = new StateManager();
  notificationSystem = new NotificationSystem();

  // Initialize MIDI manager with paint callback
  midiManager = new MidiManager((note, velocity, deviceId) => handlePaint(note, velocity, deviceId));

  // Initialize customization panel
  customizationPanel = new DrumCustomizationPanel(drumSettings, midiManager, stateManager, notificationSystem, chronicleMode);

  // Initialize MIDI mapping panel
  midiMappingPanel = new MidiMappingPanel(drumSettings, midiManager, notificationSystem, updateActiveDrumIndicator);

  // Initialize video recorder first (needed by timeline controls)
  videoRecorder = new VideoRecorder(paintCanvas, notificationSystem);
  setupVideoRecorderUI();

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
      console.error(`Cannot assign MIDI note: Drum "${drumId}" not found in drumSettings`);
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
    console.log(`✓ Mapped ${drumId} to Note ${note} from ${deviceName} (stable: ${stableKey})`);
  };

  // Set device mappings updated callback (auto-updates when devices reconnect)
  midiManager.onDeviceMappingsUpdated = (stableKey, newDeviceId) => {
    console.log(`🔄 Updating drum mappings for reconnected device: ${stableKey} -> ${newDeviceId}`);

    // Find all drums mapped to this stable key and update their volatile device IDs
    let updatedCount = 0;
    for (const drumId in drumSettings) {
      const drum = drumSettings[drumId];
      if (drum.midiDeviceStable === stableKey) {
        const oldId = drum.midiDevice;
        drum.midiDevice = newDeviceId;
        updatedCount++;
        console.log(`  ✓ Updated ${drumId}: device ID ${oldId} -> ${newDeviceId}`);
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
  console.log('🔄 Attempting to load saved settings...');
  await loadSavedSettings();
  console.log('Current drumSettings after initialization:', drumSettings);

  // Initialize UI controls
  initializeUI();

  // Activate the current mode (important for initializing mode-specific state)
  getCurrentMode().onActivate({ paintCanvas });

  // Rebuild customization panel to reflect loaded settings (including custom drums)
  customizationPanel.build();

  console.log('🎨 Drum Painter - Modular Version');
  console.log('📦 Current mode:', currentModeType, '- Style/Layout:', currentModeType === 'freeform' ? freeformMode.style : chronicleMode.layout);
  console.log('🥁 Drum kit:', DRUM_KIT_CONFIG.map(d => d.name));
};

// ===== UI INITIALIZATION =====

function initializeUI() {
  // Mode type selector (Freeform / Chronicle radio buttons)
  const freeformRadio = document.getElementById('mode-type-freeform');
  const chronicleRadio = document.getElementById('mode-type-chronicle');
  const freeformStyleSelector = document.getElementById('freeform-style-selector');
  const chronicleLayoutSelector = document.getElementById('chronicle-layout-selector');
  const freeformStyleSelect = document.getElementById('freeform-style-select');
  const chronicleLayoutSelect = document.getElementById('chronicle-layout-select');

  // Sync UI with current mode state (important for loading saved settings)
  if (freeformRadio && chronicleRadio) {
    if (currentModeType === 'freeform') {
      freeformRadio.checked = true;
    } else {
      chronicleRadio.checked = true;
    }
  }
  if (freeformStyleSelect) {
    freeformStyleSelect.value = freeformMode.style;
  }
  if (chronicleLayoutSelect) {
    chronicleLayoutSelect.value = chronicleMode.layout;
  }

  // Function to update UI visibility based on mode type
  function updateModeUI() {
    const isFreeform = currentModeType === 'freeform';

    // Show/hide appropriate selectors
    if (freeformStyleSelector) {
      freeformStyleSelector.style.display = isFreeform ? 'block' : 'none';
    }
    if (chronicleLayoutSelector) {
      chronicleLayoutSelector.style.display = isFreeform ? 'none' : 'block';
    }

    // Show/hide Timeline controls (only for Chronicle mode)
    const timelineControlsEl = document.getElementById('timeline-controls');
    if (timelineControlsEl) {
      timelineControlsEl.style.display = isFreeform ? 'none' : 'block';
    }

    // Show/hide Quick Settings video section (hide in Chronicle mode, show in Freeform)
    const quickSettingsVideoSection = document.getElementById('quick-settings-video-section');
    if (quickSettingsVideoSection) {
      quickSettingsVideoSection.style.display = isFreeform ? 'block' : 'none';
    }
  }

  // Mode type change handlers
  if (freeformRadio) {
    freeformRadio.addEventListener('change', (e) => {
      if (e.target.checked) {
        getCurrentMode().onDeactivate({ paintCanvas });
        currentModeType = 'freeform';
        getCurrentMode().onActivate({ paintCanvas });
        updateModeUI();
        notificationSystem.show('Freeform Mode');
      }
    });
  }

  if (chronicleRadio) {
    chronicleRadio.addEventListener('change', (e) => {
      if (e.target.checked) {
        getCurrentMode().onDeactivate({ paintCanvas });
        currentModeType = 'chronicle';
        getCurrentMode().onActivate({ paintCanvas });
        updateModeUI();
        notificationSystem.show('Chronicle Mode');
      }
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
    });
  }

  // Chronicle layout selector
  if (chronicleLayoutSelect) {
    chronicleLayoutSelect.addEventListener('change', (e) => {
      const layout = e.target.value;
      chronicleMode.layout = layout;
      const layoutName = e.target.options[e.target.selectedIndex].text;
      notificationSystem.show(`Layout: ${layoutName}`);
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
      console.log(`Blend Mode: ${BLEND_MODE_NAMES[currentBlendMode]}`);
      notificationSystem.show(`Blend: ${BLEND_MODE_NAMES[currentBlendMode]}`);
    });
  }

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

  const spiralSpeedSlider = document.getElementById('spiral-speed');
  const spiralSpeedDisplay = document.getElementById('spiral-speed-display');
  if (spiralSpeedSlider && spiralSpeedDisplay) {
    // Update display while dragging
    spiralSpeedSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      spiralSpeedDisplay.textContent = value;
    });

    // Apply parameter only when slider is released
    spiralSpeedSlider.addEventListener('change', (e) => {
      const value = parseFloat(e.target.value);
      chronicleMode.spiralSettings.rotationsPerMinute = value;
      notificationSystem.show(`Speed: ${value} RPM`);
    });
  }

  const spiralPatternSelect = document.getElementById('spiral-pattern');
  if (spiralPatternSelect) {
    spiralPatternSelect.addEventListener('change', (e) => {
      const pattern = e.target.value;
      chronicleMode.spiralSettings.pattern = pattern;
      notificationSystem.show(`Pattern: ${pattern.charAt(0).toUpperCase() + pattern.slice(1)}`);
    });
  }

  const spiralResetBtn = document.getElementById('spiral-reset-btn');
  if (spiralResetBtn) {
    spiralResetBtn.addEventListener('click', () => {
      // Reset spiral settings - note: spiral mode is now a Chronicle layout
      chronicleMode.startTime = Date.now();
      // Temporarily reset blend mode to normal for clearing
      paintCanvas.blendMode(BLEND);
      paintCanvas.background(BG_COLORS[currentBgColor]);
      // Restore the current blend mode
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
      notificationSystem.show('Spiral Reset');
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

  // Save/Load buttons
  const saveBtn = document.getElementById('save-default-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      // Ensure window.drumSettings is synced before saving
      window.drumSettings = drumSettings;

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
          rotationsPerMinute: chronicleMode.spiralSettings.rotationsPerMinute,
          startRadius: chronicleMode.spiralSettings.startRadius,
          syncToBPM: chronicleMode.spiralSettings.syncToBPM,
          pattern: chronicleMode.spiralSettings.pattern
        },
        timelineSettings: {
          bpm: chronicleMode.bpm,
          subdivision: chronicleMode.subdivision,
          beatsPerMeasure: chronicleMode.beatsPerMeasure,
          metronomeEnabled: chronicleMode.metronomeEnabled,
          midiLatencyMs: chronicleMode.midiLatencyMs,
          showGrid: chronicleMode.showGrid,
          rowSpacing: chronicleMode.rowSpacing,
          layout: chronicleMode.layout,
          warmupMeasures: chronicleMode.warmupMeasures,
          measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference
        },
        bankModeSettings: midiManager.getState()
      };

      console.log('Saving settings:', JSON.stringify(appState.drumSettings, null, 2));

      if (stateManager.saveAsDefault(appState)) {
        notificationSystem.show('Settings saved!');
      }
    });
  }

  const loadBtn = document.getElementById('load-default-btn');
  if (loadBtn) {
    loadBtn.addEventListener('click', async () => {
      await loadSavedSettings();
      customizationPanel.build(); // Rebuild UI with loaded settings
      updateActiveDrumIndicator(); // Update bank mode indicator
      notificationSystem.show('Settings loaded!');
    });
  }

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
        currentBgColor = 0;
        paintCanvas.background(BG_COLORS[currentBgColor]);
        paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
        window.currentBlendMode = currentBlendMode; // Update global

        customizationPanel.build(); // Rebuild UI
        notificationSystem.show('Reset to factory defaults');
      }
    });
  }

  // Export to file button
  const exportBtn = document.getElementById('export-file-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
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
          rotationsPerMinute: chronicleMode.spiralSettings.rotationsPerMinute,
          startRadius: chronicleMode.spiralSettings.startRadius,
          syncToBPM: chronicleMode.spiralSettings.syncToBPM,
          pattern: chronicleMode.spiralSettings.pattern
        },
        timelineSettings: {
          bpm: chronicleMode.bpm,
          subdivision: chronicleMode.subdivision,
          beatsPerMeasure: chronicleMode.beatsPerMeasure,
          metronomeEnabled: chronicleMode.metronomeEnabled,
          midiLatencyMs: chronicleMode.midiLatencyMs,
          showGrid: chronicleMode.showGrid,
          rowSpacing: chronicleMode.rowSpacing,
          layout: chronicleMode.layout,
          warmupMeasures: chronicleMode.warmupMeasures,
          measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference
        },
        bankModeSettings: midiManager.getState()
      };
      if (stateManager.exportToFile(appState)) {
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
            console.warn(`⚠️ Removing orphaned drum: ${drumId}`);
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
            currentBgColor = state.globalSettings.bgColor;
            // Temporarily reset blend mode to normal for clearing
            paintCanvas.blendMode(BLEND);
            paintCanvas.background(BG_COLORS[currentBgColor]);
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

        console.log('✓ Settings imported from file');
        notificationSystem.show('Imported successfully!');
      } catch (error) {
        console.error('Error importing settings:', error);
        notificationSystem.show('Import failed');
        alert('Failed to import settings. Please check the file format.');
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
          console.error(`Failed to parse project: ${projectName}`, e);
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
          currentBgColor = projectData.currentBgColor;
          paintCanvas.blendMode(BLEND);
          paintCanvas.background(BG_COLORS[currentBgColor]);
          paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
          window.currentBgColor = currentBgColor;
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
          if (projectData.timelineSettings.rowSpacing !== undefined) {
            chronicleMode.rowSpacing = projectData.timelineSettings.rowSpacing;
          }
          if (projectData.timelineSettings.warmupMeasures !== undefined) {
            chronicleMode.warmupMeasures = projectData.timelineSettings.warmupMeasures;
          }
          if (projectData.timelineSettings.measuresPerStaffPreference !== undefined) {
            chronicleMode.measuresPerStaffPreference = projectData.timelineSettings.measuresPerStaffPreference;
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
        console.error('Error loading project:', error);
        notificationSystem.show('Failed to load project', 'error');
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
  console.log('🎹 Opening MIDI devices modal, found devices:', devices);

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
    console.warn('⚠️ Video recording not supported in this browser');
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
 * Draw scrollbar for timeline mode
 */
function drawTimelineScrollbar(displayWidth, displayHeight, offsetX) {
  const scrollbarWidth = 12;
  const scrollbarX = offsetX + displayWidth + 5;
  const scrollbarTrackHeight = height - 20;
  const scrollbarY = 10;

  // Only show scrollbar if content is larger than viewport
  if (displayHeight > height) {
    // Calculate scrollbar thumb size and position
    const visibleRatio = height / displayHeight;
    const thumbHeight = Math.max(30, scrollbarTrackHeight * visibleRatio);
    const scrollRange = displayHeight - height;
    const scrollRatio = Math.abs(timelineScrollY) / scrollRange;
    const thumbY = scrollbarY + scrollRatio * (scrollbarTrackHeight - thumbHeight);

    // Draw scrollbar track
    push();
    fill(220);
    noStroke();
    rect(scrollbarX, scrollbarY, scrollbarWidth, scrollbarTrackHeight, 6);

    // Draw scrollbar thumb
    if (isDraggingScrollbar || isMouseOverScrollbar(scrollbarX, thumbY, scrollbarWidth, thumbHeight)) {
      fill(100);
    } else {
      fill(150);
    }
    rect(scrollbarX, thumbY, scrollbarWidth, thumbHeight, 6);
    pop();

    // Store scrollbar bounds for mouse interaction
    window.scrollbarBounds = {
      x: scrollbarX,
      y: scrollbarY,
      width: scrollbarWidth,
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

  if (currentModeType === "chronicle") {
    // Timeline mode: scale based on width only, allow vertical scrolling
    scaleFactor = (width / paintCanvas.width) * 0.95;
    displayWidth = paintCanvas.width * scaleFactor;
    displayHeight = paintCanvas.height * scaleFactor;
    offsetX = (width - displayWidth) / 2;
    offsetY = timelineScrollY; // Apply scroll offset
  } else {
    // Other modes: scale based on width, allow vertical scrolling if canvas is tall
    scaleFactor = (width / paintCanvas.width) * 0.95;
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

  // Draw the paint canvas
  image(paintCanvas, offsetX, offsetY, displayWidth, displayHeight);

  // Draw spiral timeline guide over the canvas if in Chronicle mode with spiral layout
  if (currentModeType === 'chronicle' && chronicleMode.layout === 'spiral') {
    // Could add a spiral guide visualization here if needed
    // For now, spiral is drawn as part of Chronicle mode's drawLaneGuides
  }

  // Draw timeline guides OVER the canvas if in Chronicle mode
  if (currentModeType === "chronicle") {
    chronicleMode.drawLaneGuides(window, offsetX, offsetY, scaleFactor, paintCanvas);

    // Draw circular visual metronome
    chronicleMode.drawCircularMetronome(window, width, height);

    // Auto-scroll to keep current playhead visible when recording
    if (chronicleMode.recording && chronicleMode.startTime !== null) {
      const timeElapsed = chronicleMode.getElapsedTime();
      const totalX = timeElapsed * chronicleMode.pixelsPerSecond;
      const staffIndex = Math.floor(totalX / chronicleMode.staffWidth);
      const currentStaffY = staffIndex * chronicleMode.staffHeight * scaleFactor;
      const currentStaffBottomY = (staffIndex + 1) * chronicleMode.staffHeight * scaleFactor;

      // Auto-scroll if playhead is below viewport
      const viewportBottom = -timelineScrollY + height - 100; // Leave some margin
      const viewportTop = -timelineScrollY + 50;

      if (currentStaffBottomY > viewportBottom) {
        // Scroll down to show current staff
        timelineScrollY = -(currentStaffBottomY - height + 150);
      } else if (currentStaffY < viewportTop) {
        // Scroll up to show current staff
        timelineScrollY = -currentStaffY + 100;
      }

      // Clamp auto-scroll to valid range
      const maxScroll = Math.max(0, displayHeight - height + 50);
      timelineScrollY = Math.max(-maxScroll, Math.min(10, timelineScrollY));
    }

  }

  // Draw scrollbar for any mode if canvas is taller than viewport
  if (displayHeight > height) {
    drawTimelineScrollbar(displayWidth, displayHeight, offsetX);
  }

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display(offsetX, offsetY, scaleFactor);
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // Update timeline mode if active (mode 8) - handles metronome
  if (currentModeType === "chronicle") {
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
  if (frameCount < 180) {
    push();
    fill(0, 150);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(24);
    text(getCurrentMode().name, width / 2, 50);
    pop();
  }
};

window.keyPressed = function() {
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
    paintCanvas.background(BG_COLORS[currentBgColor]);
    // Restore the current blend mode
    paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

    window.currentBgColor = currentBgColor; // Update global
    strokeCount = 0;
    particles = [];

    // Reset mode-specific state
    if (currentModeType === 'freeform') {
      if (freeformMode.style === 'fibonacci' && freeformMode.styles.fibonacci.spiralAngle !== undefined) {
        freeformMode.styles.fibonacci.spiralAngle = 0;
      }
      if (freeformMode.style === 'organic' && freeformMode.styles.organic.resetGrowthPoints) {
        freeformMode.styles.organic.resetGrowthPoints(paintCanvas);
      }
    }

    // Save state for undo
    stateManager.saveCanvasState(paintCanvas);

    console.log('Canvas cleared');
    notificationSystem.show('Canvas cleared', 'success');
    return false;
  }

  // S - save image
  if (key === 's' || key === 'S') {
    let filename = `drum-painting-${getCurrentMode().name.replace(/\s+/g, '-')}-${Date.now()}.png`;
    paintCanvas.save(filename);
    console.log(`Saved: ${filename}`);
    notificationSystem.show(`Saved: ${filename}`);
    return false;
  }

  // D - save settings as default
  if (key === 'd' || key === 'D') {
    // Ensure window.drumSettings is synced before saving
    window.drumSettings = drumSettings;

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
        rotationsPerMinute: chronicleMode.spiralSettings.rotationsPerMinute,
        startRadius: chronicleMode.spiralSettings.startRadius,
        syncToBPM: chronicleMode.spiralSettings.syncToBPM
      },
      timelineSettings: {
        bpm: chronicleMode.bpm,
        subdivision: chronicleMode.subdivision,
        beatsPerMeasure: chronicleMode.beatsPerMeasure,
        metronomeEnabled: chronicleMode.metronomeEnabled,
        midiLatencyMs: chronicleMode.midiLatencyMs,
        showGrid: chronicleMode.showGrid,
        rowSpacing: chronicleMode.rowSpacing,
        warmupMeasures: chronicleMode.warmupMeasures,
        measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference
      },
      bankModeSettings: midiManager.getState()
    };
    if (stateManager.saveAsDefault(appState)) {
      console.log('✓ Settings saved as default');
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

  // 1-9 - switch modes
  if (key >= '1' && key <= '9') {
    let newMode = parseInt(key) - 1;
    if (newMode < modes.length) {
      switchMode(newMode);
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
    console.log(`⚠️ Unmapped MIDI: Note ${note} from ${deviceName} - not painting`);
    return;
  }

  const drumName = drumSettings[drumId]?.name || drumId;
  console.log(`🎵 Paint: Note ${note} (${drumName}), Vel ${velocity.toFixed(2)}`);

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
    console.error('Error painting:', error);
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

          console.log(`🎚️ Direct CC: ${drumId}.${paramKey} = ${mappedValue.toFixed(1)} (CC${ccNumber}=${ccValue})`);
        }
        return;
      }
    }
  }
}

/**
 * Handle Bank Mode CC messages
 * Applies CC to active drum's parameter
 */
function handleBankModeCC(drumId, paramKey, normalizedValue, ccValue, ccNumber) {
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

  console.log(`🎚️ Bank CC: ${drumId}.${paramKey} = ${mappedValue.toFixed(1)} (CC${ccNumber}=${ccValue})`);

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
  // Map old mode indices to new structure
  // 0-6: Freeform styles, 7: Spiral (now Chronicle spiral layout), 8: Timeline (now Chronicle)
  const modeMap = {
    0: { type: 'freeform', style: 'classic' },
    1: { type: 'freeform', style: 'fibonacci' },
    2: { type: 'freeform', style: 'radial' },
    3: { type: 'freeform', style: 'gravity' },
    4: { type: 'freeform', style: 'organic' },
    5: { type: 'freeform', style: 'dendritic' },
    6: { type: 'freeform', style: 'lightning' },
    7: { type: 'chronicle', layout: 'spiral' },  // Old Spiral mode
    8: { type: 'chronicle', layout: 'staff' }     // Old Timeline mode
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
    chronicleMode.layout = mapping.layout;
    const chronicleRadio = document.getElementById('mode-type-chronicle');
    const chronicleLayoutSelect = document.getElementById('chronicle-layout-select');
    if (chronicleRadio) chronicleRadio.checked = true;
    if (chronicleLayoutSelect) chronicleLayoutSelect.value = mapping.layout;
  }

  // Activate new mode
  getCurrentMode().onActivate({ paintCanvas });

  // Update UI visibility
  const freeformStyleSelector = document.getElementById('freeform-style-selector');
  const chronicleLayoutSelector = document.getElementById('chronicle-layout-selector');
  if (freeformStyleSelector) freeformStyleSelector.style.display = mapping.type === 'freeform' ? 'block' : 'none';
  if (chronicleLayoutSelector) chronicleLayoutSelector.style.display = mapping.type === 'chronicle' ? 'block' : 'none';

  const timelineControlsEl = document.getElementById('timeline-controls');
  if (timelineControlsEl) {
    timelineControlsEl.style.display = mapping.type === 'chronicle' ? 'block' : 'none';
  }

  // Show/hide Quick Settings video section (hide in Chronicle mode, show in Freeform)
  const quickSettingsVideoSection = document.getElementById('quick-settings-video-section');
  if (quickSettingsVideoSection) {
    quickSettingsVideoSection.style.display = mapping.type === 'freeform' ? 'block' : 'none';
  }

  console.log(`Mode: ${getCurrentMode().name}`);
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
    console.log('No saved settings found, using factory defaults');
    return;
  }

  // Load custom drum kit config if available (must be done BEFORE loading drum settings)
  if (savedState.drumKitConfig && Array.isArray(savedState.drumKitConfig)) {
    // Clear and reload config
    DRUM_KIT_CONFIG.length = 0;
    savedState.drumKitConfig.forEach(drum => DRUM_KIT_CONFIG.push(drum));
    console.log(`✓ Loaded drum kit config: ${DRUM_KIT_CONFIG.length} drums`);
  }

  // Apply drum settings (merge instead of replace to maintain references)
  if (savedState.drumSettings) {
    console.log('Loading drum settings from storage:', JSON.stringify(savedState.drumSettings, null, 2));
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
        console.log(`➕ Added custom drum from saved settings: ${drumId} (${savedState.drumSettings[drumId].name})`);
      }
    }
    // Update global window.drumSettings reference
    window.drumSettings = drumSettings;
    console.log('✓ Loaded drum settings');
    console.log('Current drum settings after load:', JSON.stringify(drumSettings, null, 2));
  }

  // Clean up orphaned drums (two-way cleanup)

  // 1. Remove drums from DRUM_KIT_CONFIG that don't have settings
  for (let i = DRUM_KIT_CONFIG.length - 1; i >= 0; i--) {
    const drumId = DRUM_KIT_CONFIG[i].id;
    if (!drumSettings[drumId]) {
      console.warn(`⚠️ Removing orphaned drum from config: ${drumId}`);
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
    console.warn(`🗑️ Removing ${orphanedSettings.length} orphaned drum settings not in current config:`);
    orphanedSettings.forEach(drumId => {
      console.warn(`  - ${drumId} (${drumSettings[drumId]?.name || 'unknown'})`);
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
        rotationsPerMinute: chronicleMode.spiralSettings.rotationsPerMinute,
        startRadius: chronicleMode.spiralSettings.startRadius,
        syncToBPM: chronicleMode.spiralSettings.syncToBPM
      },
      timelineSettings: {
        bpm: chronicleMode.bpm,
        subdivision: chronicleMode.subdivision,
        beatsPerMeasure: chronicleMode.beatsPerMeasure,
        metronomeEnabled: chronicleMode.metronomeEnabled,
        midiLatencyMs: chronicleMode.midiLatencyMs,
        showGrid: chronicleMode.showGrid,
        rowSpacing: chronicleMode.rowSpacing,
        warmupMeasures: chronicleMode.warmupMeasures,
        measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference
      },
      bankModeSettings: midiManager.getState()
    };
    stateManager.saveAsDefault(appState);
    console.log(`✓ Cleaned up and saved settings`);
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
      currentBgColor = savedState.globalSettings.bgColor;
      // Temporarily reset blend mode to normal for clearing
      paintCanvas.blendMode(BLEND);
      paintCanvas.background(BG_COLORS[currentBgColor]);
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
      // Update global window reference
      window.currentBgColor = currentBgColor;
    }
    console.log('✓ Loaded global settings');
  }

  // Apply bank mode settings
  if (savedState.bankModeSettings && midiManager) {
    midiManager.loadState(savedState.bankModeSettings);
    console.log('✓ Loaded bank mode settings');
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
    console.log('✓ Loaded paint mode (new structure):', currentModeType,
                savedState.freeformStyle || 'default',
                savedState.chronicleLayout || 'default');
  } else if (savedState.currentMode !== undefined) {
    // Legacy: Load old mode index and convert to new structure
    switchMode(savedState.currentMode);
    console.log('✓ Loaded paint mode (legacy):', savedState.currentMode);
  }

  // Load spiral settings
  if (savedState.spiralSettings && chronicleMode) {
    if (savedState.spiralSettings.tightness !== undefined) {
      chronicleMode.spiralSettings.tightness = savedState.spiralSettings.tightness;
      const spiralTightnessSlider = document.getElementById('spiral-tightness');
      const spiralTightnessVal = document.getElementById('spiral-tightness-val');
      if (spiralTightnessSlider) spiralTightnessSlider.value = savedState.spiralSettings.tightness;
      if (spiralTightnessVal) spiralTightnessVal.textContent = savedState.spiralSettings.tightness;
    }
    if (savedState.spiralSettings.rotationsPerMinute !== undefined) {
      chronicleMode.spiralSettings.rotationsPerMinute = savedState.spiralSettings.rotationsPerMinute;
      const spiralSpeedSlider = document.getElementById('spiral-speed');
      const spiralSpeedVal = document.getElementById('spiral-speed-val');
      if (spiralSpeedSlider) spiralSpeedSlider.value = savedState.spiralSettings.rotationsPerMinute;
      if (spiralSpeedVal) spiralSpeedVal.textContent = savedState.spiralSettings.rotationsPerMinute;
    }
    if (savedState.spiralSettings.startRadius !== undefined) {
      chronicleMode.spiralSettings.startRadius = savedState.spiralSettings.startRadius;
    }
    if (savedState.spiralSettings.syncToBPM !== undefined) {
      chronicleMode.spiralSettings.syncToBPM = savedState.spiralSettings.syncToBPM;
    }
    if (savedState.spiralSettings.pattern !== undefined) {
      chronicleMode.spiralSettings.pattern = savedState.spiralSettings.pattern;
      const spiralPatternSelect = document.getElementById('spiral-pattern');
      if (spiralPatternSelect) spiralPatternSelect.value = savedState.spiralSettings.pattern;
    }
    console.log('✓ Loaded spiral settings');
  }

  // Load timeline settings
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
      chronicleMode.metronomeEnabled = savedState.timelineSettings.metronomeEnabled;
    }
    if (savedState.timelineSettings.midiLatencyMs !== undefined) {
      chronicleMode.midiLatencyMs = savedState.timelineSettings.midiLatencyMs;
    }
    if (savedState.timelineSettings.showGrid !== undefined) {
      chronicleMode.showGrid = savedState.timelineSettings.showGrid;
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
      const timelineLayoutSelect = document.getElementById('timeline-layout');
      if (timelineLayoutSelect) timelineLayoutSelect.value = savedState.timelineSettings.layout;
    }
    console.log('✓ Loaded timeline settings');
  }

  console.log(`📁 Loaded settings from ${savedState.timestamp}`);
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
      console.log(`🔄 Migrating drum ID: ${oldId} -> ${newId}`);

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
    console.log('✅ Drum ID migration complete');

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
        rotationsPerMinute: chronicleMode.spiralSettings.rotationsPerMinute,
        startRadius: chronicleMode.spiralSettings.startRadius,
        syncToBPM: chronicleMode.spiralSettings.syncToBPM
      },
      timelineSettings: {
        bpm: chronicleMode.bpm,
        subdivision: chronicleMode.subdivision,
        beatsPerMeasure: chronicleMode.beatsPerMeasure,
        metronomeEnabled: chronicleMode.metronomeEnabled,
        midiLatencyMs: chronicleMode.midiLatencyMs,
        showGrid: chronicleMode.showGrid,
        rowSpacing: chronicleMode.rowSpacing,
        warmupMeasures: chronicleMode.warmupMeasures,
        measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference
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
    console.log('⚠️ Cannot migrate: MIDI manager not ready');
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
        console.log(`🔄 Migrated ${drumId} to use stable key: ${stableKey}`);
      } else {
        // Device ID not in current registry - might be disconnected or from old session
        // Try to match by device name from connectedDevices (less reliable)
        const connectedDevice = midiManager.connectedDevices.find(d => d.id === drum.midiDevice);
        if (connectedDevice && connectedDevice.stableKey) {
          drum.midiDeviceStable = connectedDevice.stableKey;
          migratedCount++;
          console.log(`🔄 Migrated ${drumId} to use stable key (via connected devices): ${connectedDevice.stableKey}`);
        } else {
          ambiguousCount++;
          console.log(`⚠️ Cannot migrate ${drumId}: device ID ${drum.midiDevice} not found in registry`);
          // Clear the obsolete device ID to allow note-only matching
          drum.midiDevice = null;
        }
      }
    }
  }

  if (migratedCount > 0) {
    console.log(`✅ Migrated ${migratedCount} drum mapping(s) to stable device keys`);
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
        rotationsPerMinute: chronicleMode.spiralSettings.rotationsPerMinute,
        startRadius: chronicleMode.spiralSettings.startRadius,
        syncToBPM: chronicleMode.spiralSettings.syncToBPM
      },
      timelineSettings: {
        bpm: chronicleMode.bpm,
        subdivision: chronicleMode.subdivision,
        beatsPerMeasure: chronicleMode.beatsPerMeasure,
        metronomeEnabled: chronicleMode.metronomeEnabled,
        midiLatencyMs: chronicleMode.midiLatencyMs,
        showGrid: chronicleMode.showGrid,
        rowSpacing: chronicleMode.rowSpacing,
        warmupMeasures: chronicleMode.warmupMeasures,
        measuresPerStaffPreference: chronicleMode.measuresPerStaffPreference
      },
      bankModeSettings: midiManager.getState()
    };
    stateManager.saveAsDefault(appState);
  }

  if (ambiguousCount > 0) {
    console.log(`⚠️ ${ambiguousCount} drum(s) with unknown devices - set to "any device" mode`);
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
    console.warn(`⚠️ Found ${duplicates.length} MIDI note conflict(s):`);
    duplicates.forEach(({ note, drums }) => {
      console.warn(`  Note ${note} mapped to ${drums.length} drums:`);
      drums.forEach(drum => {
        const deviceInfo = drum.deviceStable
          ? `device: ${drum.deviceStable}`
          : drum.device
            ? `device: ${drum.device} (no stable key!)`
            : 'ANY device';
        console.warn(`    - ${drum.id} (${drum.name}) [${deviceInfo}]`);
      });
      console.warn(`  → Only ONE will respond unless they have different device assignments!`);
    });

    // Show notification
    const notesList = duplicates.map(d => d.note).join(', ');
    notificationSystem.show(`⚠️ MIDI Note Conflicts: Notes ${notesList} mapped to multiple drums. Check console!`, 'warning');
  } else {
    console.log(`✅ No MIDI note conflicts detected`);
  }

  // Also log all current mappings for debugging
  console.log('📋 Current Drum Mappings:');
  for (const drumId in drumSettings) {
    const drum = drumSettings[drumId];
    const deviceInfo = drum.midiDeviceStable
      ? `${drum.midiDeviceStable}`
      : drum.midiDevice
        ? `volatile:${drum.midiDevice}`
        : 'ANY';
    console.log(`  ${drumId} (${drum.name}): Note ${drum.midiNote} @ ${deviceInfo}`);
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

  // Handle metronome dragging in timeline mode
  if (currentModeType === "chronicle" && chronicleMode.handleMetronomeMousePressed(mouseX, mouseY)) {
    return; // Metronome was clicked, don't do anything else
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
  // Handle metronome dragging in timeline mode
  if (currentModeType === "chronicle") {
    chronicleMode.handleMetronomeMouseDragged(mouseX, mouseY);
  }

  // Handle scrollbar dragging (any mode with tall canvas)
  if (isDraggingScrollbar && window.scrollbarBounds) {
    const sb = window.scrollbarBounds;
    const dragDelta = mouseY - scrollbarDragStartY;
    const dragRatio = dragDelta / sb.trackHeight;
    const scrollDelta = dragRatio * sb.scrollRange;

    timelineScrollY -= scrollDelta;

    // Clamp scroll to valid range
    timelineScrollY = Math.max(-sb.scrollRange, Math.min(10, timelineScrollY));

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
  const testVelocity = constrain(map(speed, 0, 50, 0.3, 1.0), 0.3, 1.0);

  // Use first drum's MIDI note
  const testNote = DRUM_KIT_CONFIG[0].defaultMidiNote;

  handlePaint(testNote, testVelocity);

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
  const testNote = DRUM_KIT_CONFIG[0].defaultMidiNote;
  const testVelocity = 0.7; // Medium velocity for clicks

  console.log(`🖱️ Mouse click: Note ${testNote}, Vel ${testVelocity.toFixed(2)}`);
  handlePaint(testNote, testVelocity);
};

window.mouseReleased = function() {
  // Handle metronome release in timeline mode
  if (currentModeType === "chronicle") {
    chronicleMode.handleMetronomeMouseReleased();
  }

  // Stop dragging scrollbar
  isDraggingScrollbar = false;
};

// Mouse wheel handler for vertical scrolling
window.mouseWheel = function(event) {
  // Calculate display dimensions
  const scaleFactor = (width / paintCanvas.width) * 0.95;
  const displayHeight = paintCanvas.height * scaleFactor;

  // Only scroll if canvas is taller than viewport
  if (displayHeight > height) {
    // Scroll vertically
    const scrollSpeed = 30;
    timelineScrollY -= event.delta * scrollSpeed;

    // Calculate maximum scroll (keep at least some content visible)
    const maxScroll = Math.max(0, displayHeight - height + 50);

    // Clamp scroll to valid range
    timelineScrollY = Math.max(-maxScroll, Math.min(10, timelineScrollY));

    return false; // Prevent default scrolling
  }
};

console.log('🖱️  Click or drag anywhere to test painting');
console.log('');
console.log('⌨️  MODES (1-8):');
console.log('   1: Classic Pointillism');
console.log('   2: Fibonacci Spiral');
console.log('   3: Radial Symmetry');
console.log('   4: Gravity Field');
console.log('   5: Organic Growth');
console.log('   6: Dendritic Spreading');
console.log('   7: Lightning');
console.log('   8: Timeline');
console.log('');
console.log('⌨️  CONTROLS:');
console.log('   SPACE: Clear canvas');
console.log('   S: Save image');
console.log('   D: Save settings as default');
console.log('   Z: Undo');
console.log('   Y: Redo');
console.log('   H: Hide/show UI');
