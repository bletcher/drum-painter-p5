/**
 * Input Handlers
 * Handles keyboard and mouse input for the application
 */

import {
  SCROLLBAR_TRACK_PADDING,
  SCROLL_SPEED,
  SCROLL_MAX_PADDING,
  CANVAS_FIT_SCALE,
  CLICK_PAINT_VELOCITY_MAP_MIN,
  CLICK_PAINT_VELOCITY_MAP_MAX,
  CLICK_PAINT_SPEED_MAX,
  BLEND_MODE_NAMES
} from '../config/constants.js';
import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { debugLog, debugError } from '../utils/debug.js';
import { showUserFriendlyError } from '../utils/errorMessages.js';

/**
 * Input Handler Manager
 * Centralizes keyboard and mouse input handling
 */
export class InputHandlers {
  constructor(options = {}) {
    this.paintCanvas = options.paintCanvas;
    this.stateManager = options.stateManager;
    this.notificationSystem = options.notificationSystem;
    this.midiManager = options.midiManager;
    this.videoRecorder = options.videoRecorder;
    this.customizationPanel = options.customizationPanel;
    this.midiMappingPanel = options.midiMappingPanel;
    this.timelineControls = options.timelineControls;
    this.debugPanel = options.debugPanel;

    // State references (will be updated)
    this.currentModeType = 'freeform';
    this.currentBlendMode = 0;
    this.currentBgColor = '#ffffff';
    this.globalSizeMultiplier = 1.0;
    this.BLEND_MODES = [];
    this.showUI = true;
    this.particles = [];
    this.strokeCount = 0;

    // Scroll state
    this.timelineScrollY = 0;
    this.isDraggingScrollbar = false;
    this.scrollbarDragStartY = 0;

    // Mouse tracking
    this.prevMouseX = 0;
    this.prevMouseY = 0;

    // Mode references
    this.freeformMode = null;
    this.chronicleMode = null;
    this.getCurrentMode = null;

    // Callbacks
    this.onCanvasClear = null;
    this.onBlendModeChange = null;
    this.onSettingsSave = null;
    this.onVideoRecordingUIUpdate = null;
    this.closeMidiDevicesModal = null;
  }

  /**
   * Set mode references
   */
  setModes(freeformMode, chronicleMode, getCurrentMode) {
    this.freeformMode = freeformMode;
    this.chronicleMode = chronicleMode;
    this.getCurrentMode = getCurrentMode;
  }

  /**
   * Update state references
   */
  updateState(state) {
    Object.assign(this, state);
  }

  /**
   * Get timeline scroll offset
   */
  getTimelineScrollY() {
    return this.timelineScrollY;
  }

  /**
   * Set timeline scroll offset
   */
  setTimelineScrollY(value) {
    this.timelineScrollY = value;
  }

  /**
   * Reset timeline scroll
   */
  resetTimelineScroll() {
    this.timelineScrollY = 0;
  }

  /**
   * Check if mouse is over any UI panel
   */
  isMouseOverPanel() {
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
      if (panel.style.display === 'none' || panel.style.display === '') continue;

      const rect = panel.getBoundingClientRect();
      if (mouseX >= rect.left && mouseX <= rect.right &&
          mouseY >= rect.top && mouseY <= rect.bottom) {
        return true;
      }
    }
    return false;
  }

  /**
   * Handle key press events
   * @returns {boolean} Whether to allow default behavior
   */
  handleKeyPressed(key, keyCode) {
    const controlsEl = document.getElementById('controls');
    const panelOpen = this.customizationPanel?.isVisible || this.midiMappingPanel?.isVisible;

    // H - toggle UI (always allow)
    if (key === 'h' || key === 'H') {
      this.showUI = !this.showUI;
      if (controlsEl) {
        controlsEl.style.display = this.showUI ? 'block' : 'none';
      }
      const drumSettingsEl = document.getElementById('drum-settings');
      if (drumSettingsEl) {
        drumSettingsEl.style.display = this.showUI ? 'block' : 'none';
      }
      const infoEl = document.getElementById('info');
      if (infoEl) {
        infoEl.style.display = this.showUI ? 'block' : 'none';
      }
      if (!this.showUI) {
        if (this.customizationPanel?.isVisible) this.customizationPanel.toggle();
        if (this.midiMappingPanel?.isVisible) this.midiMappingPanel.toggle();
      }
      return false;
    }

    // ? - show keyboard shortcuts (always allow)
    if (key === '?' || key === '/') {
      if (window.toggleShortcutsPanel) {
        window.toggleShortcutsPanel();
      }
      return false;
    }

    // U - show user guide (always allow)
    if (key === 'u' || key === 'U') {
      if (window.toggleUserGuide) {
        window.toggleUserGuide();
      }
      return false;
    }

    // F - toggle fullscreen (always allow)
    if (key === 'f' || key === 'F') {
      let fs = fullscreen();
      fullscreen(!fs);
      this.notificationSystem?.show(fs ? 'Exited fullscreen' : 'Entered fullscreen');
      return false;
    }

    // ESC - close modals and panels (always allow)
    if (keyCode === 27) {
      if (window.hideUserGuide) window.hideUserGuide();
      if (window.hideShortcutsPanel) window.hideShortcutsPanel();
      if (this.closeMidiDevicesModal) this.closeMidiDevicesModal();
      return false;
    }

    // Block all other shortcuts if a panel is open
    if (panelOpen) {
      return true;
    }

    // Space - toggle video recording
    if (key === ' ') {
      this.toggleVideoRecording();
      return false;
    }

    // Backspace - clear canvas
    if (keyCode === BACKSPACE) {
      if (!confirm('Clear the entire canvas? This cannot be undone.')) {
        return false;
      }
      this.clearCanvas();
      return false;
    }

    // S - save image
    if (key === 's' || key === 'S') {
      this.saveImage();
      return false;
    }

    // D - save settings as default
    if (key === 'd' || key === 'D') {
      this.saveSettings();
      return false;
    }

    // Z - undo
    if (key === 'z' || key === 'Z') {
      if (this.stateManager?.undo(this.paintCanvas)) {
        this.notificationSystem?.show('Undo');
      }
      return false;
    }

    // Y - redo
    if (key === 'y' || key === 'Y') {
      if (this.stateManager?.redo(this.paintCanvas)) {
        this.notificationSystem?.show('Redo');
      }
      return false;
    }

    // B - cycle blend modes
    if (key === 'b' || key === 'B') {
      this.cycleBlendMode();
      return false;
    }

    // P - play/pause timeline
    if (key === 'p' || key === 'P') {
      this.toggleTimeline();
      return false;
    }

    // C - clear timeline
    if (key === 'c' || key === 'C') {
      this.clearTimeline();
      return false;
    }

    // Arrow keys - navigate modes
    if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) {
      this.handleArrowModeSwitch(keyCode);
      return false;
    }

    if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
      this.handleArrowStyleSwitch(keyCode);
      return false;
    }

    // 1-9 - select drum
    if (key >= '1' && key <= '9') {
      this.selectDrumByNumber(parseInt(key) - 1);
      return false;
    }

    return true;
  }

  /**
   * Toggle video recording
   */
  toggleVideoRecording() {
    if (!this.videoRecorder) return;

    if (!this.videoRecorder.isRecording) {
      this.videoRecorder.startRecording().then(success => {
        if (success && this.onVideoRecordingUIUpdate) {
          this.onVideoRecordingUIUpdate(true);
        }
      });
    } else {
      this.videoRecorder.stopRecording();
      if (this.onVideoRecordingUIUpdate) {
        this.onVideoRecordingUIUpdate(false);
      }
    }
  }

  /**
   * Clear the canvas
   */
  clearCanvas() {
    // Reset blend mode for clearing
    this.paintCanvas.blendMode(BLEND);
    this.paintCanvas.background(this.currentBgColor);
    this.paintCanvas.blendMode(this.BLEND_MODES[this.currentBlendMode]);

    window.currentBgColor = this.currentBgColor;
    this.strokeCount = 0;
    this.particles = [];

    if (this.getCurrentMode) {
      this.getCurrentMode().clear({ paintCanvas: this.paintCanvas, currentBgColor: this.currentBgColor });
    }

    this.stateManager?.saveCanvasState(this.paintCanvas);
    debugLog('Canvas cleared');
    this.notificationSystem?.show('Canvas cleared', 'success');

    if (this.onCanvasClear) this.onCanvasClear();
  }

  /**
   * Save the current image
   */
  saveImage() {
    const mode = this.getCurrentMode ? this.getCurrentMode() : { name: 'Unknown' };
    const filename = `drum-painting-${mode.name.replace(/\s+/g, '-')}-${Date.now()}.png`;
    this.paintCanvas.save(filename);
    debugLog(`Saved: ${filename}`);
    this.notificationSystem?.show(`Saved: ${filename}`);
  }

  /**
   * Save settings
   */
  saveSettings() {
    window.drumSettings = window.DrumPainter?.state?.drumSettings || window.drumSettings;
    if (this.stateManager?.saveNow()) {
      debugLog('Settings saved as default');
      this.notificationSystem?.show('Settings saved');
    }
    if (this.onSettingsSave) this.onSettingsSave();
  }

  /**
   * Cycle blend mode
   */
  cycleBlendMode() {
    this.currentBlendMode = (this.currentBlendMode + 1) % this.BLEND_MODES.length;
    this.paintCanvas.blendMode(this.BLEND_MODES[this.currentBlendMode]);
    window.currentBlendMode = this.currentBlendMode;

    const blendSelect = document.getElementById('blend-select');
    if (blendSelect) blendSelect.value = this.currentBlendMode.toString();

    this.notificationSystem?.show(`Blend: ${BLEND_MODE_NAMES[this.currentBlendMode]}`);
    if (this.onBlendModeChange) this.onBlendModeChange(this.currentBlendMode);
  }

  /**
   * Toggle timeline play/pause
   */
  toggleTimeline() {
    const isTimeBased = ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(this.chronicleMode?.layout);
    if (this.currentModeType === 'timeline' && isTimeBased) {
      if (this.timelineControls) {
        this.timelineControls.toggleRecording();
        this.notificationSystem?.show(this.chronicleMode?.recording ? 'Timeline started' : 'Timeline paused');
      }
    }
  }

  /**
   * Clear timeline
   */
  clearTimeline() {
    if (this.currentModeType !== 'timeline') return;

    if (confirm('Clear the timeline? This cannot be undone.')) {
      this.paintCanvas.blendMode(BLEND);
      this.paintCanvas.background(this.currentBgColor);
      this.paintCanvas.blendMode(this.BLEND_MODES[this.currentBlendMode]);

      window.currentBgColor = this.currentBgColor;
      this.strokeCount = 0;
      this.particles = [];

      this.chronicleMode?.clear({ paintCanvas: this.paintCanvas, currentBgColor: this.currentBgColor });
      this.stateManager?.saveCanvasState(this.paintCanvas);
      this.notificationSystem?.show('Timeline cleared', 'success');
    }
  }

  /**
   * Handle left/right arrow for mode switching
   */
  handleArrowModeSwitch(keyCode) {
    const freeformRadio = document.getElementById('mode-type-freeform');
    const timelineRadio = document.getElementById('mode-type-timeline');

    if (keyCode === LEFT_ARROW && this.currentModeType !== 'freeform') {
      if (freeformRadio) {
        freeformRadio.click();
        this.notificationSystem?.show('Mode: Freeform');
      }
    } else if (keyCode === RIGHT_ARROW && this.currentModeType === 'freeform') {
      if (timelineRadio) {
        timelineRadio.click();
        this.notificationSystem?.show('Mode: Timeline');
      }
    }
  }

  /**
   * Handle up/down arrow for style switching
   */
  handleArrowStyleSwitch(keyCode) {
    if (this.currentModeType === 'freeform') {
      const styleSelect = document.getElementById('freeform-style-select');
      if (styleSelect) {
        const options = Array.from(styleSelect.options);
        const currentIndex = options.findIndex(opt => opt.value === this.freeformMode?.style);
        let newIndex;

        if (keyCode === UP_ARROW) {
          newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        } else {
          newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        }

        styleSelect.selectedIndex = newIndex;
        styleSelect.dispatchEvent(new Event('change'));
        this.notificationSystem?.show(`Style: ${options[newIndex].text.split('—')[0].trim()}`);
      }
    } else {
      const layoutSelect = document.getElementById('timeline-layout-select');
      if (layoutSelect) {
        const options = Array.from(layoutSelect.options);
        const currentIndex = options.findIndex(opt => opt.value === this.chronicleMode?.layout);
        let newIndex;

        if (keyCode === UP_ARROW) {
          newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        } else {
          newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        }

        layoutSelect.selectedIndex = newIndex;
        layoutSelect.dispatchEvent(new Event('change'));
        this.notificationSystem?.show(`Layout: ${options[newIndex].text.split('—')[0].trim()}`);
      }
    }
  }

  /**
   * Select drum by number key (1-9)
   */
  selectDrumByNumber(drumIndex) {
    if (drumIndex >= DRUM_KIT_CONFIG.length) return;

    const drumId = DRUM_KIT_CONFIG[drumIndex].id;

    if (this.customizationPanel?.isVisible) {
      this.customizationPanel.selectDrum(drumId);
      this.notificationSystem?.show(`Selected: ${DRUM_KIT_CONFIG[drumIndex].name}`);
    } else {
      this.customizationPanel?.toggle();
      setTimeout(() => {
        this.customizationPanel?.selectDrum(drumId);
        this.notificationSystem?.show(`Selected: ${DRUM_KIT_CONFIG[drumIndex].name}`);
      }, 100);
    }
  }

  /**
   * Handle mouse pressed
   */
  handleMousePressed() {
    if (this.isMouseOverPanel()) return;

    // Handle metronome dragging
    const isTimeBased = this.currentModeType === 'timeline' &&
      ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(this.chronicleMode?.layout);

    if (isTimeBased && this.chronicleMode?.handleMetronomeMousePressed(mouseX, mouseY)) {
      return;
    }

    // Check scrollbar
    if (window.scrollbarBounds) {
      const sb = window.scrollbarBounds;
      if (mouseX >= sb.x && mouseX <= sb.x + sb.width &&
          mouseY >= sb.thumbY && mouseY <= sb.thumbY + sb.thumbHeight) {
        this.isDraggingScrollbar = true;
        this.scrollbarDragStartY = mouseY;
        return;
      }
      if (mouseX >= sb.x && mouseX <= sb.x + sb.width &&
          mouseY >= sb.y && mouseY <= sb.y + sb.trackHeight) {
        const clickRatio = (mouseY - sb.y) / sb.trackHeight;
        this.timelineScrollY = -clickRatio * sb.scrollRange;
        this.isDraggingScrollbar = true;
        this.scrollbarDragStartY = mouseY;
        return;
      }
    }

    if (this.customizationPanel?.isVisible || this.midiMappingPanel?.isVisible || window.isDraggingControls) {
      return;
    }

    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
      return;
    }

    this.prevMouseX = mouseX;
    this.prevMouseY = mouseY;
  }

  /**
   * Handle mouse dragged
   */
  handleMouseDragged(drumSettings) {
    const isTimeBased = this.currentModeType === 'timeline' &&
      ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(this.chronicleMode?.layout);

    if (isTimeBased) {
      this.chronicleMode?.handleMetronomeMouseDragged(mouseX, mouseY);
    }

    if (this.isDraggingScrollbar && window.scrollbarBounds) {
      const sb = window.scrollbarBounds;
      const dragDelta = mouseY - this.scrollbarDragStartY;
      const dragRatio = dragDelta / sb.trackHeight;
      const scrollDelta = dragRatio * sb.scrollRange;

      this.timelineScrollY -= scrollDelta;
      this.timelineScrollY = Math.max(-sb.scrollRange, Math.min(SCROLLBAR_TRACK_PADDING, this.timelineScrollY));
      this.scrollbarDragStartY = mouseY;
      return;
    }

    if (this.isMouseOverPanel()) return;
    if (this.customizationPanel?.isVisible || this.midiMappingPanel?.isVisible || window.isDraggingControls) return;
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

    // Paint with mouse drag
    const speed = dist(mouseX, mouseY, this.prevMouseX, this.prevMouseY);
    const testVelocity = constrain(
      map(speed, 0, CLICK_PAINT_SPEED_MAX, CLICK_PAINT_VELOCITY_MAP_MIN, CLICK_PAINT_VELOCITY_MAP_MAX),
      CLICK_PAINT_VELOCITY_MAP_MIN,
      CLICK_PAINT_VELOCITY_MAP_MAX
    );

    const drumId = DRUM_KIT_CONFIG[0].id;
    const testNote = DRUM_KIT_CONFIG[0].defaultMidiNote;

    const context = {
      paintCanvas: this.paintCanvas,
      drumSettings,
      globalSizeMultiplier: this.globalSizeMultiplier,
      particles: this.particles,
      strokeCount: this.strokeCount,
      debugPanel: this.debugPanel,
      drumId,
      DRUM_KIT_CONFIG,
      currentBgColor: this.currentBgColor
    };

    try {
      if (this.getCurrentMode) {
        this.getCurrentMode().paint(testNote, testVelocity, context);
        this.strokeCount++;
      }
    } catch (error) {
      debugError('Error painting with mouse:', error);
      showUserFriendlyError(this.notificationSystem, 'PAINT_ERROR', error);
    }

    this.prevMouseX = mouseX;
    this.prevMouseY = mouseY;
  }

  /**
   * Handle mouse clicked
   */
  handleMouseClicked(drumSettings) {
    if (this.isMouseOverPanel()) return;
    if (this.customizationPanel?.isVisible || this.midiMappingPanel?.isVisible || window.isDraggingControls) return;
    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

    const drumId = DRUM_KIT_CONFIG[0].id;
    const testNote = DRUM_KIT_CONFIG[0].defaultMidiNote;
    const testVelocity = 0.7;

    const context = {
      paintCanvas: this.paintCanvas,
      drumSettings,
      globalSizeMultiplier: this.globalSizeMultiplier,
      particles: this.particles,
      strokeCount: this.strokeCount,
      debugPanel: this.debugPanel,
      drumId,
      DRUM_KIT_CONFIG,
      currentBgColor: this.currentBgColor
    };

    try {
      if (this.getCurrentMode) {
        this.getCurrentMode().paint(testNote, testVelocity, context);
        this.strokeCount++;
      }
    } catch (error) {
      debugError('Error painting with mouse:', error);
      showUserFriendlyError(this.notificationSystem, 'PAINT_ERROR', error);
    }
  }

  /**
   * Handle mouse released
   */
  handleMouseReleased() {
    const isTimeBased = this.currentModeType === 'timeline' &&
      ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(this.chronicleMode?.layout);

    if (isTimeBased) {
      this.chronicleMode?.handleMetronomeMouseReleased();
    }

    this.isDraggingScrollbar = false;
  }

  /**
   * Handle mouse wheel for scrolling
   */
  handleMouseWheel(event) {
    const scaleFactor = (width / this.paintCanvas.width) * CANVAS_FIT_SCALE;
    const displayHeight = this.paintCanvas.height * scaleFactor;

    if (displayHeight > height) {
      this.timelineScrollY -= event.delta * SCROLL_SPEED;
      const maxScroll = Math.max(0, displayHeight - height + SCROLL_MAX_PADDING);
      this.timelineScrollY = Math.max(-maxScroll, Math.min(SCROLLBAR_TRACK_PADDING, this.timelineScrollY));
      return false;
    }
  }
}

export default InputHandlers;
