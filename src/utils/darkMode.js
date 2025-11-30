/**
 * Dark Mode Manager
 * Handles dark mode theme toggling
 */

export class DarkModeManager {
  constructor() {
    this.darkMode = false;
    this.loadPreference();
  }

  /**
   * Load dark mode preference from localStorage
   */
  loadPreference() {
    const saved = localStorage.getItem('drumPainterDarkMode');
    if (saved !== null) {
      this.darkMode = saved === 'true';
    }
  }

  /**
   * Save dark mode preference to localStorage
   */
  savePreference() {
    localStorage.setItem('drumPainterDarkMode', this.darkMode.toString());
  }

  /**
   * Toggle dark mode on/off
   */
  toggle() {
    this.darkMode = !this.darkMode;
    this.apply();
    this.savePreference();
    return this.darkMode;
  }

  /**
   * Set dark mode state
   * @param {boolean} enabled - Enable or disable dark mode
   */
  set(enabled) {
    this.darkMode = enabled;
    this.apply();
    this.savePreference();
  }

  /**
   * Apply dark mode theme to the page
   */
  apply() {
    if (this.darkMode) {
      this.applyDarkTheme();
    } else {
      this.applyLightTheme();
    }
  }

  /**
   * Apply dark theme colors
   */
  applyDarkTheme() {
    document.body.style.background = '#1a1a1a';
    document.body.style.color = '#e0e0e0';

    // Update control panels
    const drumSettings = document.getElementById('drum-settings');
    if (drumSettings) {
      drumSettings.style.setProperty('background', 'rgba(45, 45, 45, 0.95)', 'important');
      drumSettings.style.borderColor = '#404040';
      drumSettings.style.color = '#e0e0e0';
    }

    const info = document.getElementById('info');
    if (info) {
      info.style.background = '#2d2d2d';
      info.style.borderColor = '#404040';
      info.style.color = '#e0e0e0';
    }

    // Update customization panel
    const customizationPanel = document.getElementById('customization-panel');
    if (customizationPanel) {
      customizationPanel.style.background = '#2d2d2d';
      customizationPanel.style.borderColor = '#404040';
      customizationPanel.style.color = '#e0e0e0';
    }

    const drumSettingsContainer = document.getElementById('drum-settings-container');
    if (drumSettingsContainer) {
      drumSettingsContainer.style.background = '#2d2d2d';
      drumSettingsContainer.style.color = '#e0e0e0';
    }

    // Update all divs inside customization panel
    const customizationDivs = document.querySelectorAll('#customization-panel div, #drum-settings-container div');
    customizationDivs.forEach(div => {
      if (div.style.background === 'white' || div.style.background === 'rgb(255, 255, 255)' || div.style.backgroundColor === 'white') {
        div.style.background = '#2d2d2d';
      }
      if (div.style.color === 'black' || div.style.color === 'rgb(0, 0, 0)') {
        div.style.color = '#e0e0e0';
      }
    });

    // Update all inputs and selects
    const inputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="color"]), select, textarea');
    inputs.forEach(input => {
      input.style.background = '#1a1a1a';
      input.style.borderColor = '#404040';
      input.style.color = '#e0e0e0';
    });

    // Update labels
    const labels = document.querySelectorAll('label');
    labels.forEach(label => {
      label.style.color = '#e0e0e0';
    });

    // Update buttons (more aggressive)
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      const bg = button.style.background || button.style.backgroundColor;
      // Only update if it's white, empty, or default styling
      if (!bg || bg === 'white' || bg === 'rgb(255, 255, 255)' || bg === '') {
        button.style.background = '#404040';
        button.style.color = '#e0e0e0';
        button.style.borderColor = '#505050';
      }
    });

    // Update horizontal rules
    const hrs = document.querySelectorAll('hr');
    hrs.forEach(hr => {
      hr.style.borderTopColor = '#404040';
    });

    // Update tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(el => {
      el.style.setProperty('--tooltip-bg', '#1a1a1a');
      el.style.setProperty('--tooltip-color', '#e0e0e0');
    });

    // Update key badges
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
      key.style.background = '#404040';
      key.style.color = '#e0e0e0';
      key.style.borderColor = '#505050';
    });

    // Update all h3 and h4 headers
    const headers = document.querySelectorAll('h3, h4');
    headers.forEach(header => {
      header.style.color = '#e0e0e0';
    });

    // Update tabs in customization panel
    const tabs = document.querySelectorAll('.drum-tab, [style*="cursor: pointer"]');
    tabs.forEach(tab => {
      if (tab.style.background === 'white' || tab.style.background === 'rgb(255, 255, 255)' || tab.style.background === '') {
        tab.style.background = '#404040';
        tab.style.color = '#e0e0e0';
      }
    });
  }

  /**
   * Apply light theme colors (restore defaults)
   */
  applyLightTheme() {
    document.body.style.background = '';
    document.body.style.color = '';

    // Update control panels
    const drumSettings = document.getElementById('drum-settings');
    if (drumSettings) {
      drumSettings.style.setProperty('background', 'rgba(255, 255, 255, 0.95)', 'important');
      drumSettings.style.borderColor = '';
      drumSettings.style.color = '';
    }

    const info = document.getElementById('info');
    if (info) {
      info.style.background = '';
      info.style.borderColor = '';
      info.style.color = '';
    }

    // Update customization panel
    const customizationPanel = document.getElementById('customization-panel');
    if (customizationPanel) {
      customizationPanel.style.background = '';
      customizationPanel.style.borderColor = '';
      customizationPanel.style.color = '';
    }

    const drumSettingsContainer = document.getElementById('drum-settings-container');
    if (drumSettingsContainer) {
      drumSettingsContainer.style.background = '';
      drumSettingsContainer.style.color = '';
    }

    // Reset all divs inside customization panel
    const customizationDivs = document.querySelectorAll('#customization-panel div, #drum-settings-container div');
    customizationDivs.forEach(div => {
      if (div.style.background === '#2d2d2d' || div.style.background === 'rgb(45, 45, 45)') {
        div.style.background = '';
      }
      if (div.style.color === '#e0e0e0' || div.style.color === 'rgb(224, 224, 224)') {
        div.style.color = '';
      }
    });

    // Update all inputs and selects
    const inputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="color"]), select, textarea');
    inputs.forEach(input => {
      input.style.background = '';
      input.style.borderColor = '';
      input.style.color = '';
    });

    // Update labels
    const labels = document.querySelectorAll('label');
    labels.forEach(label => {
      label.style.color = '';
    });

    // Update buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      if (button.style.background === 'rgb(64, 64, 64)' || button.style.background === '#404040') {
        button.style.background = '';
        button.style.color = '';
        button.style.borderColor = '';
      }
    });

    // Update horizontal rules
    const hrs = document.querySelectorAll('hr');
    hrs.forEach(hr => {
      hr.style.borderTopColor = '';
    });

    // Update tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(el => {
      el.style.removeProperty('--tooltip-bg');
      el.style.removeProperty('--tooltip-color');
    });

    // Update key badges
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
      key.style.background = '';
      key.style.color = '';
      key.style.borderColor = '';
    });

    // Update all h3 and h4 headers
    const headers = document.querySelectorAll('h3, h4');
    headers.forEach(header => {
      header.style.color = '';
    });

    // Update tabs in customization panel
    const tabs = document.querySelectorAll('.drum-tab, [style*="cursor: pointer"]');
    tabs.forEach(tab => {
      if (tab.style.background === '#404040' || tab.style.background === 'rgb(64, 64, 64)') {
        tab.style.background = '';
        tab.style.color = '';
      }
    });
  }
}
