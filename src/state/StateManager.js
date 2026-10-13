/**
 * State Manager
 * Handles saving/loading settings and undo/redo functionality
 */

import { MAX_HISTORY } from '../config/constants.js';
import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';
import { showUserFriendlyError } from '../utils/errorMessages.js';

const STORAGE_KEY = 'drumPainterSettings';
const PROJECT_PREFIX = 'drum-painter-project-';

/**
 * Save a blob as a download
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  // Snapshots are taken *before* destructive actions (clear, background change),
  // so Ctrl+Z brings back the painting you just wiped. Copies are made on the
  // GPU with drawImage — no pixel readback.

  /**
   * Copy the canvas into a new HTML canvas
   */
  snapshot(paintCanvas) {
    const copy = document.createElement('canvas');
    copy.width = paintCanvas.elt.width;
    copy.height = paintCanvas.elt.height;
    copy.getContext('2d').drawImage(paintCanvas.elt, 0, 0);
    return { canvas: copy, width: paintCanvas.width, height: paintCanvas.height };
  }

  /**
   * Draw a snapshot back onto the paint canvas
   */
  restore(paintCanvas, snap) {
    if (paintCanvas.height !== snap.height) {
      // e.g. a long staff session was cleared and the canvas shrank back
      paintCanvas.resizeCanvas(snap.width, snap.height);
      if (paintCanvas._renderer) {
        paintCanvas._renderer._cachedFillStyle = undefined;
        paintCanvas._renderer._cachedStrokeStyle = undefined;
      }
      if (window.BLEND_MODES) paintCanvas.blendMode(window.BLEND_MODES[window.currentBlendMode || 0]);
    }
    const ctx = paintCanvas.drawingContext;
    ctx.save();
    ctx.globalCompositeOperation = 'copy';
    ctx.globalAlpha = 1;
    ctx.drawImage(snap.canvas, 0, 0, snap.width, snap.height);
    ctx.restore();
  }

  /**
   * Remember the canvas before a destructive change
   * @param {p5.Graphics} paintCanvas - The canvas to save
   */
  saveCanvasState(paintCanvas) {
    this.canvasHistory.push(this.snapshot(paintCanvas));
    if (this.canvasHistory.length > MAX_HISTORY) {
      this.canvasHistory.shift();
    }
    this.redoStack = [];
  }

  /**
   * Undo the last destructive change
   * @param {p5.Graphics} paintCanvas - The canvas to restore to
   */
  undo(paintCanvas) {
    const snap = this.canvasHistory.pop();
    if (!snap) return false;
    this.redoStack = this.redoStack || [];
    this.redoStack.push(this.snapshot(paintCanvas));
    this.restore(paintCanvas, snap);
    return true;
  }

  /**
   * Redo a change that was undone
   * @param {p5.Graphics} paintCanvas - The canvas to restore to
   */
  redo(paintCanvas) {
    const snap = this.redoStack?.pop();
    if (!snap) return false;
    this.canvasHistory.push(this.snapshot(paintCanvas));
    this.restore(paintCanvas, snap);
    return true;
  }

  // ===== LOCALSTORAGE PERSISTENCE =====

  /**
   * Build the saved-settings object from the app state. The one place that
   * defines the settings file format (browser storage, export files and
   * projects all use it).
   * @param {Object} appState - Current application state (see getAppState in main.js)
   * @returns {Object}
   */
  serialize(appState) {
    return {
      version: '3.0',
      timingVersion: 2, // Hit timing uses MIDI timestamps + scheduled metronome
      drumKitConfig: DRUM_KIT_CONFIG,
      drumSettings: appState.drumSettings,
      drumOrder: appState.drumOrder, // Explicit drum ordering
      globalSettings: {
        sizeMultiplier: appState.globalSizeMultiplier,
        blendMode: appState.currentBlendMode,
        bgColor: appState.currentBgColor
      },
      currentModeType: appState.currentModeType,
      freeformStyle: appState.freeformStyle,
      chronicleLayout: appState.chronicleLayout,
      spiralSettings: appState.spiralSettings,
      timelineSettings: appState.timelineSettings,
      bankModeSettings: appState.bankModeSettings,
      recordOutputPortId: appState.recordOutputPortId || null,
      recordOutputNote: appState.recordOutputNote ?? 36,
      recordOutputChannel: appState.recordOutputChannel ?? 1,
      sendClockEnabled: appState.sendClockEnabled ?? false,
      videoQuality: appState.videoQuality || 'medium',
      videoFormat: appState.videoFormat || 'auto',
      lastPaletteDrumIds: appState.lastPaletteDrumIds || null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Save current settings to localStorage
   * @param {Object} appState - Current application state
   */
  saveAsDefault(appState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serialize(appState)));
      debugLog('✓ Settings saved to browser storage');
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
   * @returns {Object|null} - Loaded (unvalidated) state or null if not found
   */
  loadDefault() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      const state = JSON.parse(saved);
      infoLog('✓ Settings loaded from browser storage');
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
      const json = JSON.stringify(this.serialize(appState), null, 2);
      downloadBlob(new Blob([json], { type: 'application/json' }), `drum-painter-settings-${Date.now()}.json`);
      infoLog('✓ Settings exported to file');
      return true;
    } catch (error) {
      debugError('Error exporting settings:', error);
      return false;
    }
  }

  // ===== NAMED PROJECTS =====

  /**
   * @returns {Object<string, Object>} - Saved projects by name
   */
  listProjects() {
    const projects = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PROJECT_PREFIX)) {
        try {
          projects[key.slice(PROJECT_PREFIX.length)] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          debugError(`Failed to parse project: ${key}`, e);
        }
      }
    }
    return projects;
  }

  saveProject(name, appState) {
    localStorage.setItem(PROJECT_PREFIX + name, JSON.stringify(this.serialize(appState)));
  }

  loadProject(name) {
    const raw = localStorage.getItem(PROJECT_PREFIX + name);
    return raw ? JSON.parse(raw) : null;
  }

  deleteProject(name) {
    localStorage.removeItem(PROJECT_PREFIX + name);
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
