/**
 * Projector Simulator
 * Simulates projector display without needing physical hardware
 * Completely isolated - does not modify existing canvas or rendering
 */

import { PROJECTOR_PROFILES, PERFORMANCE_TIERS, DEFAULT_PROJECTOR_CONFIG } from '../config/projectorProfiles.js';

export class ProjectorSimulator {
  constructor() {
    // Deep copy default config to avoid mutations
    this.config = JSON.parse(JSON.stringify(DEFAULT_PROJECTOR_CONFIG));
    this.fpsHistory = [];
    this.lastFrameTime = 0;
    this.frameCount = 0;
  }

  /**
   * Initialize projector simulator
   * @param {Object} savedConfig - Optional saved configuration
   */
  init(savedConfig = null) {
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig };
    }
    console.log('🎥 ProjectorSimulator initialized (disabled by default)');
  }

  /**
   * Enable projector mode
   */
  enable() {
    if (this.config.enabled) {
      console.log('⚠️ Projector mode already enabled');
      return;
    }

    this.config.enabled = true;
    console.log('✓ Projector mode enabled');

    // Open popup window if configured
    if (this.config.displayMode === 'popup') {
      this.openPopupWindow();
    }
  }

  /**
   * Disable projector mode
   */
  disable() {
    if (!this.config.enabled) {
      return;
    }

    this.config.enabled = false;
    console.log('✓ Projector mode disabled');

    // Close popup window if open
    this.closePopupWindow();
  }

  /**
   * Open popup window for projector simulation
   */
  openPopupWindow() {
    if (this.config.popupWindow && !this.config.popupWindow.closed) {
      console.log('⚠️ Popup window already open');
      this.config.popupWindow.focus();
      return;
    }

    // Open popup window
    const width = 1920;
    const height = 1080;
    const left = window.screenX + window.outerWidth;
    const top = window.screenY;

    this.config.popupWindow = window.open(
      'projector-view.html',
      'projectorView',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (this.config.popupWindow) {
      console.log('✓ Projector popup window opened');

      // Start syncing canvas to popup
      this.startCanvasSync();

      // Handle window close
      this.config.popupWindow.addEventListener('beforeunload', () => {
        this.closePopupWindow();
      });
    } else {
      console.error('❌ Failed to open popup window (popup blocker?)');
      alert('Failed to open projector window. Please allow popups for this site.');
    }
  }

  /**
   * Close popup window
   */
  closePopupWindow() {
    if (this.config.syncInterval) {
      clearInterval(this.config.syncInterval);
      this.config.syncInterval = null;
    }

    if (this.config.popupWindow && !this.config.popupWindow.closed) {
      this.config.popupWindow.close();
    }

    this.config.popupWindow = null;
    console.log('✓ Projector popup window closed');
  }

  /**
   * Start syncing canvas to popup window
   */
  startCanvasSync() {
    if (this.config.syncInterval) {
      clearInterval(this.config.syncInterval);
    }

    // Sync at target FPS (default 60fps = ~16ms)
    const syncRate = 1000 / this.config.targetFPS;

    this.config.syncInterval = setInterval(() => {
      this.syncFrame();
    }, syncRate);

    console.log(`✓ Canvas sync started (${this.config.targetFPS} FPS)`);
  }

  /**
   * Sync single frame to popup window
   */
  syncFrame() {
    if (!this.config.popupWindow || this.config.popupWindow.closed) {
      this.closePopupWindow();
      return;
    }

    // Get paintCanvas from window (exposed by main.js)
    const paintCanvas = window.paintCanvas;
    if (!paintCanvas) {
      return;
    }

    // Calculate FPS
    const now = performance.now();
    const frameDelta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    const currentFPS = frameDelta > 0 ? Math.round(1000 / frameDelta) : 0;

    // Track FPS history (last 30 frames)
    this.fpsHistory.push(currentFPS);
    if (this.fpsHistory.length > 30) {
      this.fpsHistory.shift();
    }

    // Get canvas data as image
    const canvasData = paintCanvas.canvas.toDataURL('image/png');

    // Send to popup window
    this.config.popupWindow.postMessage({
      type: 'frame',
      data: canvasData,
      profile: this.getActiveProfile(),
      performanceTier: this.getActivePerformanceTier(),
      fps: currentFPS,
      avgFPS: this.getAverageFPS(),
      frameTime: frameDelta.toFixed(1),
      ambientLight: this.config.ambientLightLevel
    }, '*');

    this.frameCount++;
  }

  /**
   * Apply projector color profile to a color
   * @param {Object} color - HSL color object {h, s, l}
   * @returns {Object} Adjusted HSL color
   */
  applyColorProfile(color) {
    if (!this.config.enabled || this.config.profile === 'native') {
      return color;
    }

    const profile = PROJECTOR_PROFILES[this.config.profile];
    if (!profile) {
      return color;
    }

    const { h, s, l } = color;

    return {
      h: h,
      s: Math.min(100, s * profile.saturationBoost),
      l: Math.max(profile.minBrightness, l)
    };
  }

  /**
   * Get active profile configuration
   */
  getActiveProfile() {
    return PROJECTOR_PROFILES[this.config.profile] || PROJECTOR_PROFILES['native'];
  }

  /**
   * Get active performance tier
   */
  getActivePerformanceTier() {
    return PERFORMANCE_TIERS[this.config.performanceTier] || PERFORMANCE_TIERS['balanced'];
  }

  /**
   * Get average FPS
   */
  getAverageFPS() {
    if (this.fpsHistory.length === 0) return 0;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.fpsHistory.length);
  }

  /**
   * Update configuration
   * @param {Object} updates - Configuration updates
   */
  updateConfig(updates) {
    const oldEnabled = this.config.enabled;
    const oldDisplayMode = this.config.displayMode;

    this.config = { ...this.config, ...updates };

    // Handle enable/disable
    if (updates.enabled !== undefined) {
      if (updates.enabled && !oldEnabled) {
        this.enable();
      } else if (!updates.enabled && oldEnabled) {
        this.disable();
      }
    }

    // Handle display mode change
    if (updates.displayMode && updates.displayMode !== oldDisplayMode) {
      if (this.config.enabled) {
        this.closePopupWindow();
        if (updates.displayMode === 'popup') {
          this.openPopupWindow();
        }
      }
    }

    // Restart sync if FPS changed
    if (updates.targetFPS && this.config.syncInterval) {
      this.startCanvasSync();
    }
  }

  /**
   * Get current state for saving
   */
  getState() {
    return {
      enabled: this.config.enabled,
      profile: this.config.profile,
      performanceTier: this.config.performanceTier,
      targetFPS: this.config.targetFPS,
      showFPSCounter: this.config.showFPSCounter,
      ambientLightLevel: this.config.ambientLightLevel,
      displayMode: this.config.displayMode
    };
  }

  /**
   * Load state from saved settings
   * @param {Object} state - Saved state
   */
  loadState(state) {
    if (!state) return;

    this.updateConfig({
      enabled: state.enabled || false,
      profile: state.profile || 'medium-lumens',
      performanceTier: state.performanceTier || 'balanced',
      targetFPS: state.targetFPS || 60,
      showFPSCounter: state.showFPSCounter || false,
      ambientLightLevel: state.ambientLightLevel || 0,
      displayMode: state.displayMode || 'popup'
    });

    console.log('✓ Projector state loaded');
  }

  /**
   * Check if projector mode is enabled
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * Get performance multiplier for particle counts
   */
  getParticleMultiplier() {
    if (!this.config.enabled) {
      return 1.0;
    }

    const tier = this.getActivePerformanceTier();
    return tier.particleMultiplier;
  }
}

// Export singleton instance
export const projectorSimulator = new ProjectorSimulator();
