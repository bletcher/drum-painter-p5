/**
 * Apply Theme to HTML Elements
 * This module applies centralized theme styles to elements defined in index.html
 */

import { QUICK_SETTINGS_PANEL, CONTROLS_PANEL } from '../config/theme.js';

/**
 * Apply theme styles to Quick Settings panel buttons
 */
export function applyQuickSettingsTheme() {
  // Main action buttons
  const customizeBtn = document.getElementById('customize-btn');
  if (customizeBtn) {
    customizeBtn.style.background = QUICK_SETTINGS_PANEL.buttons.customize;
  }

  const midiMappingBtn = document.getElementById('midi-mapping-btn');
  if (midiMappingBtn) {
    midiMappingBtn.style.background = QUICK_SETTINGS_PANEL.buttons.midiMapping;
  }

  const userGuideBtn = document.getElementById('user-guide-btn');
  if (userGuideBtn) {
    userGuideBtn.style.background = QUICK_SETTINGS_PANEL.buttons.userGuide;
  }

  const debugBtn = document.getElementById('debug-btn');
  if (debugBtn) {
    debugBtn.style.background = QUICK_SETTINGS_PANEL.buttons.debug;
  }

  // Project buttons
  const saveProjectBtn = document.getElementById('save-project-btn');
  if (saveProjectBtn) {
    saveProjectBtn.style.background = QUICK_SETTINGS_PANEL.buttons.save;
  }

  const loadProjectBtn = document.getElementById('load-project-btn');
  if (loadProjectBtn) {
    loadProjectBtn.style.background = QUICK_SETTINGS_PANEL.buttons.load;
  }

  const deleteProjectBtn = document.getElementById('delete-project-btn');
  if (deleteProjectBtn) {
    deleteProjectBtn.style.background = QUICK_SETTINGS_PANEL.buttons.delete;
  }

  // Video recording button
  const videoRecordBtn = document.getElementById('video-record-btn');
  if (videoRecordBtn) {
    videoRecordBtn.style.background = QUICK_SETTINGS_PANEL.buttons.videoRecord;
  }
}

/**
 * Apply theme styles to Controls (Drum Painter) panel
 */
export function applyControlsPanelTheme() {
  // Timeline buttons
  const timelineStartBtn = document.getElementById('timeline-start-btn');
  if (timelineStartBtn) {
    timelineStartBtn.style.background = CONTROLS_PANEL.timelineButtons.start;
  }

  const timelineStopBtn = document.getElementById('timeline-stop-btn');
  if (timelineStopBtn) {
    timelineStopBtn.style.background = CONTROLS_PANEL.timelineButtons.stop;
  }

  const timelineContinueBtn = document.getElementById('timeline-continue-btn');
  if (timelineContinueBtn) {
    timelineContinueBtn.style.background = CONTROLS_PANEL.timelineButtons.continue;
  }

  const timelineStartOverBtn = document.getElementById('timeline-start-over-btn');
  if (timelineStartOverBtn) {
    timelineStartOverBtn.style.background = CONTROLS_PANEL.timelineButtons.startOver;
  }

  // Spiral reset button
  const spiralResetBtn = document.getElementById('spiral-reset-btn');
  if (spiralResetBtn) {
    spiralResetBtn.style.background = CONTROLS_PANEL.timelineButtons.reset;
  }

  // MIDI status background
  const midiStatus = document.getElementById('midi-status');
  if (midiStatus) {
    midiStatus.style.background = CONTROLS_PANEL.midiStatus.background;
    midiStatus.style.borderRadius = CONTROLS_PANEL.midiStatus.borderRadius;
  }

  // MIDI activity light color
  const midiActivityLight = document.getElementById('midi-activity-light');
  if (midiActivityLight) {
    midiActivityLight.style.background = CONTROLS_PANEL.midiStatus.activityColor;
  }
}

/**
 * Apply all theme styles
 */
export function applyAllThemes() {
  applyQuickSettingsTheme();
  applyControlsPanelTheme();
}
