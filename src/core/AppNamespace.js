/**
 * App Namespace
 * Centralizes all global state to reduce window pollution
 * Access via window.DrumPainter or import directly
 */

import { debugLog } from '../utils/debug.js';

/**
 * Central application namespace
 * Holds all shared state and references
 */
export const DrumPainter = {
  // Version
  version: '3.0',

  // Canvas references
  displayCanvas: null,
  paintCanvas: null,

  // System managers (initialized in main.js)
  stateManager: null,
  notificationSystem: null,
  midiManager: null,
  debugPanel: null,

  // Application state
  state: {
    drumSettings: {},
    drumOrder: [],
    currentBgColor: '#ffffff',
    currentBlendMode: 0,
    BLEND_MODES: [],
    BLEND: null
  },

  // UI state
  ui: {
    showUI: true,
    scrollbarBounds: null,
    isDraggingControls: false,
    midiDevicesList: []
  },

  // Functions exposed for external access
  resetTimelineScroll: null,
  toggleShortcutsPanel: null,
  hideShortcutsPanel: null,
  toggleUserGuide: null,
  hideUserGuide: null,

  /**
   * Initialize the namespace with p5 references
   * @param {Object} options - Initialization options
   */
  init(options = {}) {
    debugLog('DrumPainter namespace initialized');
  },

  /**
   * Get current drum settings
   * @returns {Object} Current drum settings
   */
  getDrumSettings() {
    return this.state.drumSettings;
  },

  /**
   * Set drum settings
   * @param {Object} settings - New drum settings
   */
  setDrumSettings(settings) {
    this.state.drumSettings = settings;
  },

  /**
   * Get drum order
   * @returns {Array} Current drum order
   */
  getDrumOrder() {
    return this.state.drumOrder;
  },

  /**
   * Set drum order
   * @param {Array} order - New drum order
   */
  setDrumOrder(order) {
    this.state.drumOrder = order;
  }
};

// Expose on window for backward compatibility
// This replaces the 20+ individual window.* assignments
if (typeof window !== 'undefined') {
  window.DrumPainter = DrumPainter;

  // Legacy compatibility getters/setters
  // These allow old code to still use window.drumSettings etc
  Object.defineProperty(window, 'drumSettings', {
    get() { return DrumPainter.state.drumSettings; },
    set(v) { DrumPainter.state.drumSettings = v; },
    configurable: true
  });

  Object.defineProperty(window, 'drumOrder', {
    get() { return DrumPainter.state.drumOrder; },
    set(v) { DrumPainter.state.drumOrder = v; },
    configurable: true
  });

  Object.defineProperty(window, 'stateManager', {
    get() { return DrumPainter.stateManager; },
    set(v) { DrumPainter.stateManager = v; },
    configurable: true
  });

  Object.defineProperty(window, 'notificationSystem', {
    get() { return DrumPainter.notificationSystem; },
    set(v) { DrumPainter.notificationSystem = v; },
    configurable: true
  });

  Object.defineProperty(window, 'displayCanvas', {
    get() { return DrumPainter.displayCanvas; },
    set(v) { DrumPainter.displayCanvas = v; },
    configurable: true
  });

  Object.defineProperty(window, 'paintCanvas', {
    get() { return DrumPainter.paintCanvas; },
    set(v) { DrumPainter.paintCanvas = v; },
    configurable: true
  });

  Object.defineProperty(window, 'currentBgColor', {
    get() { return DrumPainter.state.currentBgColor; },
    set(v) { DrumPainter.state.currentBgColor = v; },
    configurable: true
  });

  Object.defineProperty(window, 'currentBlendMode', {
    get() { return DrumPainter.state.currentBlendMode; },
    set(v) { DrumPainter.state.currentBlendMode = v; },
    configurable: true
  });

  Object.defineProperty(window, 'BLEND_MODES', {
    get() { return DrumPainter.state.BLEND_MODES; },
    set(v) { DrumPainter.state.BLEND_MODES = v; },
    configurable: true
  });

  Object.defineProperty(window, 'BLEND', {
    get() { return DrumPainter.state.BLEND; },
    set(v) { DrumPainter.state.BLEND = v; },
    configurable: true
  });

  Object.defineProperty(window, 'debugPanel', {
    get() { return DrumPainter.debugPanel; },
    set(v) { DrumPainter.debugPanel = v; },
    configurable: true
  });

  Object.defineProperty(window, 'scrollbarBounds', {
    get() { return DrumPainter.ui.scrollbarBounds; },
    set(v) { DrumPainter.ui.scrollbarBounds = v; },
    configurable: true
  });

  Object.defineProperty(window, 'isDraggingControls', {
    get() { return DrumPainter.ui.isDraggingControls; },
    set(v) { DrumPainter.ui.isDraggingControls = v; },
    configurable: true
  });

  Object.defineProperty(window, 'midiDevicesList', {
    get() { return DrumPainter.ui.midiDevicesList; },
    set(v) { DrumPainter.ui.midiDevicesList = v; },
    configurable: true
  });

  // Function delegates
  Object.defineProperty(window, 'resetTimelineScroll', {
    get() { return DrumPainter.resetTimelineScroll; },
    set(v) { DrumPainter.resetTimelineScroll = v; },
    configurable: true
  });

  Object.defineProperty(window, 'toggleShortcutsPanel', {
    get() { return DrumPainter.toggleShortcutsPanel; },
    set(v) { DrumPainter.toggleShortcutsPanel = v; },
    configurable: true
  });

  Object.defineProperty(window, 'hideShortcutsPanel', {
    get() { return DrumPainter.hideShortcutsPanel; },
    set(v) { DrumPainter.hideShortcutsPanel = v; },
    configurable: true
  });

  Object.defineProperty(window, 'toggleUserGuide', {
    get() { return DrumPainter.toggleUserGuide; },
    set(v) { DrumPainter.toggleUserGuide = v; },
    configurable: true
  });

  Object.defineProperty(window, 'hideUserGuide', {
    get() { return DrumPainter.hideUserGuide; },
    set(v) { DrumPainter.hideUserGuide = v; },
    configurable: true
  });
}

export default DrumPainter;
