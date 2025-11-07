/**
 * Drum Painter - Main Entry Point
 * Modular version with ES6 modules
 */

import { PAINT_CANVAS_WIDTH, PAINT_CANVAS_HEIGHT, BG_COLORS, BLEND_MODE_NAMES } from './config/constants.js';
import { DRUM_KIT_CONFIG, generateFactorySettings } from './config/drumKit.js';
import { ClassicMode } from './modes/ClassicMode.js';
import { FibonacciMode } from './modes/FibonacciMode.js';
import { RadialMode } from './modes/RadialMode.js';
import { GravityMode } from './modes/GravityMode.js';
import { OrganicMode } from './modes/OrganicMode.js';
import { DendriticMode } from './modes/DendriticMode.js';
import { LightningMode } from './modes/LightningMode.js';
import { TimelineMode } from './modes/TimelineMode.js';
import { MidiManager } from './midi/MidiManager.js';
import { StateManager } from './state/StateManager.js';
import { NotificationSystem } from './ui/Notification.js';
import { DrumCustomizationPanel } from './ui/DrumCustomizationPanel.js';
import { MidiMappingPanel } from './ui/MidiMappingPanel.js';
import { TimelineControls } from './ui/TimelineControls.js';
import { findDrumByMidiNote } from './utils/drumHelpers.js';

// ===== GLOBAL STATE =====
let paintCanvas;
let particles = [];
let currentMode = 0;
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

// DOM elements
let midiStatusEl;
let controlsEl;

// Initialize paint modes
const timelineMode = new TimelineMode(DRUM_KIT_CONFIG);
const modes = [
  new ClassicMode(),
  new FibonacciMode(),
  new RadialMode(),
  new GravityMode(),
  new OrganicMode(),
  new DendriticMode(),
  new LightningMode(),
  timelineMode
];

// ===== P5.JS SKETCH =====

// Using global mode for now (easier for testing)
window.setup = function() {
  // Create display canvas
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent(document.body);

  // Initialize blend modes array (needs p5 constants)
  BLEND_MODES = [BLEND, MULTIPLY, SCREEN, OVERLAY, DODGE, BURN];

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

  // Initialize system managers
  stateManager = new StateManager();
  notificationSystem = new NotificationSystem();

  // Initialize MIDI manager with paint callback
  midiManager = new MidiManager((note, velocity) => handlePaint(note, velocity));

  // Initialize customization panel
  customizationPanel = new DrumCustomizationPanel(drumSettings, midiManager, stateManager, notificationSystem);

  // Initialize MIDI mapping panel
  midiMappingPanel = new MidiMappingPanel(drumSettings, midiManager, notificationSystem, updateActiveDrumIndicator);

  // Initialize timeline controls
  timelineControls = new TimelineControls(timelineMode, notificationSystem);
  timelineControls.initialize();

  // Set MIDI status callback
  midiManager.onMidiStatusChange = (connected, message, deviceName = '') => {
    const statusText = document.getElementById('midi-status-text');
    const statusIndicator = document.getElementById('midi-status-indicator');
    const deviceNameEl = document.getElementById('midi-device-name');

    if (statusText) {
      statusText.textContent = message;
      statusText.style.color = connected ? '#10b981' : (message.includes('No') ? '#ef4444' : '#666');
    }

    if (statusIndicator) {
      // Green = connected, Red = no MIDI, Yellow = checking
      statusIndicator.style.background = connected ? '#10b981' : (message.includes('No') ? '#ef4444' : '#fbbf24');
    }

    if (deviceNameEl && deviceName) {
      deviceNameEl.textContent = deviceName;
      deviceNameEl.style.display = 'block';
    } else if (deviceNameEl) {
      deviceNameEl.style.display = 'none';
    }
  };

  // Set MIDI CC handling callbacks
  midiManager.handleCCValueCallback = (ccNumber, ccValue) => {
    handleDirectModeCC(ccNumber, ccValue);
  };

  midiManager.handleBankCCCallback = (drumId, paramKey, normalizedValue, ccValue, ccNumber) => {
    handleBankModeCC(drumId, paramKey, normalizedValue, ccValue, ccNumber);
  };

  midiManager.onDrumNoteAssigned = (drumId, note) => {
    drumSettings[drumId].midiNote = note;
    notificationSystem.show(`${drumId}: Note ${note}`);
  };

  // Set Bank Mode change callback (updates active drum indicator)
  midiManager.onBankModeChange = (drumId) => {
    updateActiveDrumIndicator();
    notificationSystem.show(`Active: ${drumSettings[drumId]?.name || drumId}`);
  };

  // Setup MIDI
  midiManager.setup();

  // Save initial canvas state
  stateManager.saveCanvasState(paintCanvas);

  // Try to load saved settings
  console.log('🔄 Attempting to load saved settings...');
  loadSavedSettings();
  console.log('Current drumSettings after initialization:', drumSettings);

  // Initialize UI controls
  initializeUI();

  // Rebuild customization panel to reflect loaded settings (including custom drums)
  customizationPanel.build();

  console.log('🎨 Drum Painter - Modular Version');
  console.log('📦 Loaded modes:', modes.map(m => m.name));
  console.log('🥁 Drum kit:', DRUM_KIT_CONFIG.map(d => d.name));
};

// ===== UI INITIALIZATION =====

function initializeUI() {
  // Mode selector dropdown
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    modeSelect.value = currentMode.toString();
    modeSelect.addEventListener('change', (e) => {
      const newMode = parseInt(e.target.value);
      if (newMode !== currentMode && newMode < modes.length) {
        switchMode(newMode);
      }
    });
  }

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
    loadBtn.addEventListener('click', () => {
      loadSavedSettings();
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
        currentMode,
        bankModeSettings: midiManager.getState(),
        timelineSettings: {
          bpm: timelineMode.bpm,
          subdivision: timelineMode.subdivision,
          beatsPerMeasure: timelineMode.beatsPerMeasure,
          metronomeEnabled: timelineMode.metronomeEnabled,
          midiLatencyMs: timelineMode.midiLatencyMs,
          showGrid: timelineMode.showGrid,
          rowSpacing: timelineMode.rowSpacing
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
        if (projectData.timelineSettings && timelineMode) {
          if (projectData.timelineSettings.bpm !== undefined) {
            timelineMode.bpm = projectData.timelineSettings.bpm;
          }
          if (projectData.timelineSettings.subdivision !== undefined) {
            timelineMode.subdivision = projectData.timelineSettings.subdivision;
          }
          if (projectData.timelineSettings.beatsPerMeasure !== undefined) {
            timelineMode.beatsPerMeasure = projectData.timelineSettings.beatsPerMeasure;
          }
          if (projectData.timelineSettings.metronomeEnabled !== undefined) {
            timelineMode.metronomeEnabled = projectData.timelineSettings.metronomeEnabled;
          }
          if (projectData.timelineSettings.midiLatencyMs !== undefined) {
            timelineMode.midiLatencyMs = projectData.timelineSettings.midiLatencyMs;
          }
          if (projectData.timelineSettings.showGrid !== undefined) {
            timelineMode.showGrid = projectData.timelineSettings.showGrid;
          }
          if (projectData.timelineSettings.rowSpacing !== undefined) {
            timelineMode.rowSpacing = projectData.timelineSettings.rowSpacing;
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

  if (currentMode === 7) {
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

  // Draw timeline guides OVER the canvas if in timeline mode
  if (currentMode === 7) {
    timelineMode.drawLaneGuides(window, offsetX, offsetY, scaleFactor, paintCanvas);

    // Auto-scroll to keep current playhead visible when recording
    if (timelineMode.recording && timelineMode.startTime !== null) {
      const timeElapsed = timelineMode.getElapsedTime();
      const totalX = timeElapsed * timelineMode.pixelsPerSecond;
      const staffIndex = Math.floor(totalX / timelineMode.staffWidth);
      const currentStaffY = staffIndex * timelineMode.staffHeight * scaleFactor;
      const currentStaffBottomY = (staffIndex + 1) * timelineMode.staffHeight * scaleFactor;

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

  // Update timeline mode if active (mode 7) - handles metronome
  if (currentMode === 7) {
    const context = {
      paintCanvas,
      drumSettings,
      globalSizeMultiplier,
      particles,
      strokeCount,
      currentBgColor
    };

    timelineMode.update(context);
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
    text(modes[currentMode].name, width / 2, 50);
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

  // ESC - close shortcuts panel (always allow this)
  if (keyCode === 27) { // ESC key
    if (window.hideShortcutsPanel) {
      window.hideShortcutsPanel();
    }
    return false;
  }

  // Block all other keyboard shortcuts if a panel is open
  if (panelOpen) {
    return true; // Allow default behavior (typing in inputs)
  }

  // Space - clear canvas
  if (key === ' ') {
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
    if (currentMode === 1) {
      modes[currentMode].spiralAngle = 0;
    }
    if (currentMode === 4) {
      modes[currentMode].resetGrowthPoints(paintCanvas);
    }

    // Save state for undo
    stateManager.saveCanvasState(paintCanvas);

    console.log('Canvas cleared');
    notificationSystem.show('Canvas cleared', 'success');
    return false;
  }

  // S - save image
  if (key === 's' || key === 'S') {
    let filename = `drum-painting-${modes[currentMode].name.replace(/\s+/g, '-')}-${Date.now()}.png`;
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

  // 1-8 - switch modes
  if (key >= '1' && key <= '8') {
    let newMode = parseInt(key) - 1;
    switchMode(newMode);
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
function handlePaint(note, velocity) {
  console.log(`🎵 Paint: Note ${note}, Vel ${velocity.toFixed(2)}`);

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
    strokeCount
  };

  // Add currentBgColor to context
  context.currentBgColor = currentBgColor;

  // Paint with current mode
  try {
    modes[currentMode].paint(note, velocity, context);
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
 * Switch to a new paint mode
 */
function switchMode(newMode) {
  if (newMode < 0 || newMode >= modes.length || newMode === currentMode) {
    return;
  }

  // Deactivate old mode
  modes[currentMode].onDeactivate({ paintCanvas });

  // Hide timeline controls if leaving timeline mode
  if (currentMode === 7) {
    timelineControls.hide();
  }

  // Switch mode
  currentMode = newMode;
  strokeCount = 0;

  // Activate new mode
  modes[currentMode].onActivate({ paintCanvas });

  // Show timeline controls if entering timeline mode
  if (currentMode === 7) {
    timelineControls.show();
    timelineScrollY = 0; // Reset scroll position
    isDraggingScrollbar = false; // Reset scrollbar state
  } else {
    // Reset scrollbar state when leaving timeline mode
    isDraggingScrollbar = false;
  }

  // Update dropdown to match
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    modeSelect.value = currentMode.toString();
  }

  console.log(`Mode: ${modes[currentMode].name}`);
  notificationSystem.show(modes[currentMode].name);
}

/**
 * Load saved settings from localStorage
 */
function loadSavedSettings() {
  const savedState = stateManager.loadDefault();

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
      } else {
        // Add new custom drum that doesn't exist in factory settings
        drumSettings[drumId] = savedState.drumSettings[drumId];
        console.log(`➕ Added custom drum from saved settings: ${drumId} (${savedState.drumSettings[drumId].name})`);
      }
    }
    // Update global window.drumSettings reference
    window.drumSettings = drumSettings;
    console.log('✓ Loaded drum settings');
    console.log('Current drum settings after load:', JSON.stringify(drumSettings, null, 2));
  }

  // Clean up any orphaned drums in DRUM_KIT_CONFIG (drums without settings)
  for (let i = DRUM_KIT_CONFIG.length - 1; i >= 0; i--) {
    const drumId = DRUM_KIT_CONFIG[i].id;
    if (!drumSettings[drumId]) {
      console.warn(`⚠️ Removing orphaned drum from config: ${drumId}`);
      DRUM_KIT_CONFIG.splice(i, 1);
    }
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

  console.log(`📁 Loaded settings from ${savedState.timestamp}`);
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
    document.getElementById('shortcuts-panel')
  ];

  for (const panel of panels) {
    if (!panel) continue;
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
