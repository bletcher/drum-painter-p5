/**
 * Dark Mode Manager
 *
 * Sets `data-theme="dark" | "light"` on <html>; every color comes from CSS
 * variables in src/styles/app.css (and theme.js tokens reference those
 * variables), so nothing here touches individual elements.
 *
 * With no saved preference the OS setting (prefers-color-scheme) is followed,
 * including live changes. Once the user toggles, their choice is saved under
 * 'drumPainterDarkMode' and wins over the OS.
 */

const STORAGE_KEY = 'drumPainterDarkMode';

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export class DarkModeManager {
  constructor() {
    this.darkMode = false;
    /** true when the user has made an explicit choice (saved in localStorage) */
    this.hasExplicitPreference = false;
    this._mediaQuery = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
    this._onSystemChange = this._onSystemChange.bind(this);
    if (this._mediaQuery) {
      if (this._mediaQuery.addEventListener) {
        this._mediaQuery.addEventListener('change', this._onSystemChange);
      } else if (this._mediaQuery.addListener) {
        this._mediaQuery.addListener(this._onSystemChange); // older Safari
      }
    }
    this.loadPreference();
  }

  /**
   * Load dark mode preference from localStorage, falling back to the OS setting
   */
  loadPreference() {
    const saved = readStored();
    if (saved === 'true' || saved === 'false') {
      this.hasExplicitPreference = true;
      this.darkMode = saved === 'true';
    } else {
      this.hasExplicitPreference = false;
      this.darkMode = !!this._mediaQuery?.matches;
    }
  }

  /**
   * Save dark mode preference to localStorage
   */
  savePreference() {
    this.hasExplicitPreference = true;
    try {
      localStorage.setItem(STORAGE_KEY, this.darkMode.toString());
    } catch {
      // Storage unavailable (private mode etc.) — the choice lasts for this session
    }
  }

  /**
   * Toggle dark mode on/off
   * @returns {boolean} the new state
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
    this.darkMode = !!enabled;
    this.apply();
    this.savePreference();
  }

  /**
   * Apply the current theme to the page
   */
  apply() {
    const root = document.documentElement;
    root.dataset.theme = this.darkMode ? 'dark' : 'light';
    root.style.colorScheme = this.darkMode ? 'dark' : 'light';

    // Keep the header toggle in sync (e.g. after an OS theme change)
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle && toggle.checked !== this.darkMode) {
      toggle.checked = this.darkMode;
    }
  }

  _onSystemChange(event) {
    if (this.hasExplicitPreference) return;
    this.darkMode = event.matches;
    this.apply();
  }
}
