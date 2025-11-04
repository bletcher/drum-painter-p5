/**
 * State Manager
 * Handles saving/loading settings and undo/redo functionality
 */

import { MAX_HISTORY } from '../config/constants.js';
import { DRUM_KIT_CONFIG } from '../config/drumKit.js';

const STORAGE_KEY = 'drumPainterSettings';

export class StateManager {
  constructor() {
    this.canvasHistory = [];
    this.historyIndex = -1;
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
      console.log(`Undo (${this.historyIndex + 1}/${this.canvasHistory.length})`);
      return true;
    } else {
      console.log('Nothing to undo');
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
      console.log(`Redo (${this.historyIndex + 1}/${this.canvasHistory.length})`);
      return true;
    } else {
      console.log('Nothing to redo');
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
        version: '2.0',
        drumKitConfig: DRUM_KIT_CONFIG,
        drumSettings: appState.drumSettings,
        globalSettings: {
          sizeMultiplier: appState.globalSizeMultiplier,
          blendMode: appState.currentBlendMode,
          bgColor: appState.currentBgColor
        },
        bankModeSettings: appState.bankModeSettings || {
          enabled: false,
          activeDrum: 'kick',
          padAssignments: {},
          globalVariables: {}
        },
        timestamp: new Date().toISOString()
      };

      console.log('💾 Saving to localStorage with key:', STORAGE_KEY);
      console.log('💾 Saving drum settings:', Object.keys(state.drumSettings));
      console.log('💾 Saving global settings:', state.globalSettings);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // Verify it was saved
      const verification = localStorage.getItem(STORAGE_KEY);
      console.log('✅ Verified save - data exists:', !!verification);

      // Debug logging
      console.log('✓ Settings saved to browser storage');
      console.log('  Bank mode enabled:', state.bankModeSettings.enabled);
      console.log('  Bank pad assignments:', Object.keys(state.bankModeSettings.padAssignments || {}).length, 'drums');

      return true;
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      return false;
    }
  }

  /**
   * Load settings from localStorage
   * @returns {Object|null} - Loaded state or null if not found
   */
  loadDefault() {
    try {
      console.log('📦 Checking localStorage for key:', STORAGE_KEY);
      const saved = localStorage.getItem(STORAGE_KEY);
      console.log('📦 Raw localStorage value:', saved ? 'Found' : 'Not found');

      if (!saved) {
        console.warn('⚠️ No saved settings found in localStorage');
        return null;
      }

      const state = JSON.parse(saved);
      console.log('✓ Settings loaded from browser storage');
      console.log('📦 Loaded state keys:', Object.keys(state));
      console.log('📦 Loaded drum settings:', state.drumSettings ? Object.keys(state.drumSettings) : 'none');
      return state;
    } catch (error) {
      console.error('❌ Error loading settings:', error);
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
        version: '2.0',
        drumKitConfig: DRUM_KIT_CONFIG,
        drumSettings: appState.drumSettings,
        globalSettings: {
          sizeMultiplier: appState.globalSizeMultiplier,
          blendMode: appState.currentBlendMode,
          bgColor: appState.currentBgColor
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

      console.log('✓ Settings exported to file');
      return true;
    } catch (error) {
      console.error('Error exporting settings:', error);
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
          console.log('✓ Settings imported from file');
          resolve(state);
        } catch (error) {
          console.error('Error parsing imported file:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        console.error('Error reading file');
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
      console.log('✓ Saved settings cleared');
      return true;
    } catch (error) {
      console.error('Error clearing settings:', error);
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
}
