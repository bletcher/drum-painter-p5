/**
 * State Manager
 * Handles saving/loading settings and undo/redo functionality
 */

import { MAX_HISTORY } from '../config/constants.js';
import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';
import { showUserFriendlyError } from '../utils/errorMessages.js';

const STORAGE_KEY = 'drumPainterSettings';

export class StateManager {
  constructor() {
    this.canvasHistory = [];
    this.historyIndex = -1;

    // Auto-save system
    this.autoSaveTimeout = null;
    this.autoSaveDelay = 2000; // 2 seconds debounce
    this.pendingAutoSave = false;
    this.lastSaveTime = null;
    this.getAppState = null; // Function to get current app state (set by main.js)
    this.onSaveStatusChange = null; // Callback for UI updates
  }

  /**
   * Set the function that retrieves current app state
   * Must be called during initialization
   * @param {Function} fn - Function that returns current app state object
   */
  setAppStateGetter(fn) {
    this.getAppState = fn;
  }

  /**
   * Set callback for save status changes (for UI feedback)
   * @param {Function} fn - Callback function(status: 'saving'|'saved'|'pending')
   */
  setOnSaveStatusChange(fn) {
    this.onSaveStatusChange = fn;
  }

  /**
   * Schedule an auto-save with debouncing
   * Call this whenever settings change
   */
  scheduleAutoSave() {
    if (!this.getAppState) {
      debugWarn('⚠️ Auto-save: No app state getter configured');
      return;
    }

    // Mark as pending
    this.pendingAutoSave = true;
    if (this.onSaveStatusChange) {
      this.onSaveStatusChange('pending');
    }

    // Clear existing timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    // Schedule new save
    this.autoSaveTimeout = setTimeout(() => {
      this.performAutoSave();
    }, this.autoSaveDelay);
  }

  /**
   * Perform the actual auto-save
   */
  performAutoSave() {
    if (!this.getAppState) {
      debugWarn('⚠️ Auto-save: No app state getter configured');
      return;
    }

    if (this.onSaveStatusChange) {
      this.onSaveStatusChange('saving');
    }

    const appState = this.getAppState();
    const success = this.saveAsDefault(appState);

    if (success) {
      this.pendingAutoSave = false;
      this.lastSaveTime = Date.now();
      debugLog('🔄 Auto-saved settings');
      if (this.onSaveStatusChange) {
        this.onSaveStatusChange('saved');
      }
    }
  }

  /**
   * Cancel any pending auto-save
   */
  cancelAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    this.pendingAutoSave = false;
  }

  /**
   * Force immediate save (used by 'D' key)
   */
  saveNow() {
    this.cancelAutoSave();
    if (this.getAppState) {
      const appState = this.getAppState();
      const success = this.saveAsDefault(appState);
      if (success) {
        this.lastSaveTime = Date.now();
        if (this.onSaveStatusChange) {
          this.onSaveStatusChange('saved');
        }
      }
      return success;
    }
    return false;
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges() {
    return this.pendingAutoSave;
  }

  // ===== UNDO/REDO SYSTEM =====

  /**
   * Save current canvas state for undo/redo
   * @param {p5.Graphics} paintCanvas - The canvas to save
   */
  saveCanvasState(paintCanvas) {
    // Remove any states after current index (for branching)
    this.canvasHistory = this.canvasHistory.slice(0, this.historyIndex + 1);

    // Save current canvas as image
    this.canvasHistory.push(paintCanvas.get());

    // Keep only MAX_HISTORY states
    if (this.canvasHistory.length > MAX_HISTORY) {
      this.canvasHistory.shift();
    } else {
      this.historyIndex++;
    }
  }

  /**
   * Undo to previous canvas state
   * @param {p5.Graphics} paintCanvas - The canvas to restore to
   */
  undo(paintCanvas) {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      paintCanvas.image(this.canvasHistory[this.historyIndex], 0, 0);
      debugLog(`Undo (${this.historyIndex + 1}/${this.canvasHistory.length})`);
      return true;
    } else {
      debugLog('Nothing to undo');
      return false;
    }
  }

  /**
   * Redo to next canvas state
   * @param {p5.Graphics} paintCanvas - The canvas to restore to
   */
  redo(paintCanvas) {
    if (this.historyIndex < this.canvasHistory.length - 1) {
      this.historyIndex++;
      paintCanvas.image(this.canvasHistory[this.historyIndex], 0, 0);
      debugLog(`Redo (${this.historyIndex + 1}/${this.canvasHistory.length})`);
      return true;
    } else {
      debugLog('Nothing to redo');
      return false;
    }
  }

  // ===== LOCALSTORAGE PERSISTENCE =====

  /**
   * Save current settings to localStorage
   * @param {Object} appState - Current application state
   */
  saveAsDefault(appState) {
    try {
      const state = {
        version: '3.0',
        drumKitConfig: DRUM_KIT_CONFIG,
        drumSettings: appState.drumSettings,
        drumOrder: appState.drumOrder, // Explicit drum ordering
        globalSettings: {
          sizeMultiplier: appState.globalSizeMultiplier,
          blendMode: appState.currentBlendMode,
          bgColor: appState.currentBgColor
        },
        currentMode: appState.currentMode,
        // Two-tier mode system
        currentModeType: appState.currentModeType,
        freeformStyle: appState.freeformStyle,
        chronicleLayout: appState.chronicleLayout,
        spiralSettings: appState.spiralSettings || {
          tightness: 15,
          rotationsPerMinute: 4,
          startRadius: 50,
          syncToBPM: false,
          pattern: 'spiral'
        },
        timelineSettings: appState.timelineSettings || {
          bpm: 80,
          subdivision: 16,
          beatsPerMeasure: 4,
          metronomeEnabled: false,
          midiLatencyMs: 0,
          showGrid: true,
          rowSpacing: 30,
          layout: 'staff',
          warmupMeasures: 0,
          measuresPerStaffPreference: 4
        },
        bankModeSettings: appState.bankModeSettings || {
          enabled: false,
          activeDrum: 'kick',
          padAssignments: {},
          globalVariables: {}
        },
        timestamp: new Date().toISOString()
      };

      debugLog('💾 Saving to localStorage with key:', STORAGE_KEY);
      debugLog('💾 Saving drum settings:', Object.keys(state.drumSettings));
      debugLog('💾 Saving global settings:', state.globalSettings);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // Verify it was saved
      const verification = localStorage.getItem(STORAGE_KEY);
      debugLog('✅ Verified save - data exists:', !!verification);

      // Debug logging
      infoLog('✓ Settings saved to browser storage');
      debugLog('  Bank mode enabled:', state.bankModeSettings.enabled);
      debugLog('  Bank pad assignments:', Object.keys(state.bankModeSettings.padAssignments || {}).length, 'drums');

      return true;
    } catch (error) {
      debugError('❌ Error saving settings:', error);
      if (window.notificationSystem) {
        showUserFriendlyError(window.notificationSystem, 'STORAGE_SAVE_FAILED', error);
      }
      return false;
    }
  }

  /**
   * Load settings from localStorage
   * @returns {Object|null} - Loaded state or null if not found
   */
  loadDefault() {
    try {
      debugLog('📦 Checking localStorage for key:', STORAGE_KEY);
      const saved = localStorage.getItem(STORAGE_KEY);
      debugLog('📦 Raw localStorage value:', saved ? 'Found' : 'Not found');

      if (!saved) {
        debugWarn('⚠️ No saved settings found in localStorage');
        return null;
      }

      const state = JSON.parse(saved);
      infoLog('✓ Settings loaded from browser storage');
      debugLog('📦 Loaded state keys:', Object.keys(state));
      debugLog('📦 Loaded drum settings:', state.drumSettings ? Object.keys(state.drumSettings) : 'none');
      return state;
    } catch (error) {
      debugError('❌ Error loading settings:', error);
      if (window.notificationSystem) {
        showUserFriendlyError(window.notificationSystem, 'STORAGE_LOAD_FAILED', error);
      }
      return null;
    }
  }

  /**
   * Export settings to JSON file
   * @param {Object} appState - Current application state
   */
  exportToFile(appState) {
    try {
      const state = {
        version: '3.0',
        drumKitConfig: DRUM_KIT_CONFIG,
        drumSettings: appState.drumSettings,
        drumOrder: appState.drumOrder, // Explicit drum ordering
        globalSettings: {
          sizeMultiplier: appState.globalSizeMultiplier,
          blendMode: appState.currentBlendMode,
          bgColor: appState.currentBgColor
        },
        currentMode: appState.currentMode,
        // Two-tier mode system
        currentModeType: appState.currentModeType,
        freeformStyle: appState.freeformStyle,
        chronicleLayout: appState.chronicleLayout,
        spiralSettings: appState.spiralSettings || {
          tightness: 15,
          rotationsPerMinute: 4,
          startRadius: 50,
          syncToBPM: false,
          pattern: 'spiral'
        },
        timelineSettings: appState.timelineSettings || {
          bpm: 80,
          subdivision: 16,
          beatsPerMeasure: 4,
          metronomeEnabled: false,
          midiLatencyMs: 0,
          showGrid: true,
          rowSpacing: 30,
          layout: 'staff',
          warmupMeasures: 0,
          measuresPerStaffPreference: 4
        },
        bankModeSettings: appState.bankModeSettings || {
          enabled: false,
          activeDrum: 'kick',
          padAssignments: {},
          globalVariables: {}
        },
        timestamp: new Date().toISOString()
      };

      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `drum-painter-settings-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      infoLog('✓ Settings exported to file');
      return true;
    } catch (error) {
      debugError('Error exporting settings:', error);
      return false;
    }
  }

  /**
   * Import settings from JSON file
   * @param {File} file - The file to import
   * @returns {Promise<Object>} - Imported state
   */
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const state = JSON.parse(e.target.result);
          infoLog('✓ Settings imported from file');
          resolve(state);
        } catch (error) {
          debugError('Error parsing imported file:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        debugError('Error reading file');
        reject(new Error('File read error'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Clear all saved settings
   */
  clearSavedSettings() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      infoLog('✓ Saved settings cleared');
      return true;
    } catch (error) {
      debugError('Error clearing settings:', error);
      return false;
    }
  }

  /**
   * Check if saved settings exist
   * @returns {boolean}
   */
  hasSavedSettings() {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Load default settings from bundled JSON file (for production builds)
   * @returns {Promise<Object|null>} - Loaded state or null if not found
   */
  async loadFromFile() {
    try {
      // Use Vite's BASE_URL to construct correct path
      const basePath = import.meta.env.BASE_URL || '/';
      const settingsPath = `${basePath}default-settings.json`;

      debugLog('📦 Attempting to load default-settings.json from:', settingsPath);
      const response = await fetch(settingsPath);

      if (!response.ok) {
        debugLog('⚠️ No default-settings.json file found at:', settingsPath);
        return null;
      }

      const state = await response.json();
      infoLog('✓ Loaded settings from default-settings.json');
      debugLog('📦 Loaded state keys:', Object.keys(state));
      return state;
    } catch (error) {
      debugLog('⚠️ Could not load default-settings.json:', error.message);
      return null;
    }
  }
}
