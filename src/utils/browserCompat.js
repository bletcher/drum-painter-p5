/**
 * Browser Compatibility Checks
 *
 * Web MIDI works in Chrome, Edge, Opera and Firefox 108+ (Firefox asks the user
 * to approve a site-permission add-on the first time). Safari on macOS and every
 * browser on iOS/iPadOS have no Web MIDI.
 *
 * Nothing here blocks the app: when MIDI isn't available (or the device is
 * touch-only) a small dismissible banner explains what still works — Keyboard
 * pads and the Demo beat. Styles live in src/styles/app.css (.compat-banner).
 */

const DISMISS_KEY = 'drumPainterCompatBannerDismissed';
const BANNER_ID = 'compat-banner';

/**
 * Check if device is mobile
 * @returns {boolean} True if mobile device
 */
export function isMobileDevice() {
  // Check for mobile user agents
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileRegex.test(navigator.userAgent);

  // Check for touch-only devices with small screens
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768 || window.innerHeight < 600;

  return isMobileUA || (isTouchDevice && isSmallScreen) || isIOS();
}

/**
 * iPhone, iPod or iPad (iPadOS reports a Mac user agent, so check touch points too)
 * @returns {boolean}
 */
export function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * True when the primary input is touch with no hover-capable pointer
 * (phones, tablets without a trackpad).
 * @returns {boolean}
 */
export function isTouchOnlyDevice() {
  if (window.matchMedia) {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }
  return navigator.maxTouchPoints > 0 && !('onmousemove' in window);
}

/**
 * Check if Web MIDI API is supported
 * @returns {boolean} True if MIDI is supported
 */
export function isMidiSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

/**
 * Get browser name
 * @returns {string} Browser name
 */
export function getBrowserName() {
  const ua = navigator.userAgent;

  // Order matters: Edge and Opera UAs also contain "Chrome/", Chrome contains "Safari/"
  if (ua.includes('Edg/') || ua.includes('EdgiOS/') || ua.includes('EdgA/')) return 'Microsoft Edge';
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
  if (ua.includes('Firefox/') || ua.includes('FxiOS/')) return 'Firefox';
  if (ua.includes('CriOS/') || ua.includes('Chrome/')) return 'Google Chrome';
  if (ua.includes('Safari/')) return 'Safari';
  return 'this browser';
}

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function saveDismissed(variant) {
  try {
    localStorage.setItem(DISMISS_KEY, variant);
  } catch {
    // ignore (private mode)
  }
}

/**
 * Show a dismissible, non-blocking banner.
 * @param {object} options
 * @param {string} options.variant - Identifies the message; dismissal is remembered per variant
 * @param {string} options.title
 * @param {string} options.message
 * @param {'warning'|'info'} [options.tone='warning']
 * @param {string} [options.icon]
 * @returns {HTMLElement|null} the banner, or null if previously dismissed
 */
export function showCompatBanner({ variant, title, message, tone = 'warning', icon = '⚠️' }) {
  if (readDismissed() === variant) return null;

  document.getElementById(BANNER_ID)?.remove();

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.className = `compat-banner compat-banner-${tone}`;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  const iconEl = document.createElement('span');
  iconEl.className = 'compat-banner-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon;

  const text = document.createElement('div');
  text.className = 'compat-banner-text';
  const titleEl = document.createElement('strong');
  titleEl.textContent = title;
  const messageEl = document.createElement('p');
  messageEl.textContent = message;
  text.append(titleEl, messageEl);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-btn compat-banner-close';
  close.setAttribute('aria-label', 'Dismiss this message');
  close.textContent = '×';
  close.addEventListener('click', () => {
    saveDismissed(variant);
    banner.remove();
  });

  banner.append(iconEl, text, close);

  // Interacting with the banner must not paint on the canvas underneath
  for (const type of ['mousedown', 'click', 'pointerdown', 'touchstart']) {
    banner.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }

  (document.body || document.documentElement).appendChild(banner);
  return banner;
}

/**
 * Show the "MIDI not available" banner.
 * Kept for compatibility; now a thin wrapper around the non-blocking banner.
 * @param {string} [feature='Web MIDI'] - Feature name that's not supported
 * @param {string} [recommendation] - Override for the explanatory text
 */
export function showCompatibilityWarning(feature = 'Web MIDI', recommendation) {
  const browser = getBrowserName();
  const where = isIOS() ? 'on iPhone and iPad' : `in ${browser}`;
  const reason = isIOS()
    ? 'Apple doesn\'t support MIDI in any iOS/iPadOS browser.'
    : (browser === 'Safari' ? 'Safari doesn\'t support Web MIDI.' : `${browser} doesn't support ${feature}.`);

  return showCompatBanner({
    variant: isIOS() ? 'no-midi-ios' : 'no-midi',
    title: `MIDI isn't available ${where}`,
    message: recommendation ||
      `${reason} To play with a drum kit, open Drum Painter in Chrome, Edge or Firefox on a computer. ` +
      'You can still try it here with ⌨️ Keyboard pads or ▶ Demo beat.'
  });
}

/**
 * Note for touch-only devices: playing a kit needs a desktop browser.
 * Kept for compatibility; now a thin wrapper around the non-blocking banner.
 */
export function showMobileWarning() {
  return showCompatBanner({
    variant: 'touch-device',
    tone: 'info',
    icon: '🥁',
    title: 'Drum kits connect through a desktop browser',
    message: 'MIDI drums need Chrome, Edge or Firefox on a computer. ' +
      'On this device you can explore with ⌨️ Keyboard pads or ▶ Demo beat.'
  });
}

/**
 * Check browser compatibility and show a (non-blocking) banner if needed.
 * @returns {boolean} True if Web MIDI is supported
 */
export function checkBrowserCompatibility() {
  const midi = isMidiSupported();

  if (!midi) {
    showCompatibilityWarning('Web MIDI');
  } else if (isTouchOnlyDevice()) {
    showMobileWarning();
  }

  return midi;
}
