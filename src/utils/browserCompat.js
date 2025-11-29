/**
 * Browser Compatibility Checks
 * Detects browser support for required features
 */

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

  return isMobileUA || (isTouchDevice && isSmallScreen);
}

/**
 * Check if Web MIDI API is supported
 * @returns {boolean} True if MIDI is supported
 */
export function isMidiSupported() {
  return navigator.requestMIDIAccess !== undefined;
}

/**
 * Get browser name
 * @returns {string} Browser name
 */
export function getBrowserName() {
  const userAgent = navigator.userAgent;

  if (userAgent.includes('Edg/')) {
    return 'Microsoft Edge';
  } else if (userAgent.includes('Chrome/')) {
    return 'Google Chrome';
  } else if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
    return 'Opera';
  } else if (userAgent.includes('Firefox/')) {
    return 'Firefox';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    return 'Safari';
  } else {
    return 'Unknown Browser';
  }
}

/**
 * Show browser compatibility warning modal
 * @param {string} feature - Feature name that's not supported
 * @param {string} recommendation - Recommended browsers
 */
export function showCompatibilityWarning(feature, recommendation) {
  const browserName = getBrowserName();

  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 20px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    ">
      <div style="font-size: 60px; margin-bottom: 20px;">⚠️</div>
      <h2 style="margin: 0 0 15px 0; font-size: 28px; font-weight: bold;">
        Browser Not Supported
      </h2>
      <p style="margin: 0 0 10px 0; font-size: 16px; opacity: 0.95;">
        <strong>${browserName}</strong> does not support <strong>${feature}</strong>,
        which is required for this application to work.
      </p>
      <p style="margin: 0 0 25px 0; font-size: 14px; opacity: 0.85;">
        ${recommendation}
      </p>
      <div style="
        background: rgba(255,255,255,0.15);
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 25px;
      ">
        <div style="font-size: 13px; opacity: 0.9; margin-bottom: 8px;">
          ✅ Recommended browsers:
        </div>
        <div style="font-size: 15px; font-weight: 600;">
          Chrome • Edge • Opera
        </div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: white;
        color: #667eea;
        border: none;
        padding: 12px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: transform 0.2s;
      " onmouseover="this.style.transform='scale(1.05)'"
         onmouseout="this.style.transform='scale(1)'">
        I Understand
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

/**
 * Show mobile device warning modal
 */
export function showMobileWarning() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 20px;
    box-sizing: border-box;
  `;

  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      padding: 30px;
      border-radius: 20px;
      max-width: 450px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    ">
      <div style="font-size: 50px; margin-bottom: 15px;">📱</div>
      <h2 style="margin: 0 0 15px 0; font-size: 24px; font-weight: bold;">
        Desktop Experience Required
      </h2>
      <p style="margin: 0 0 10px 0; font-size: 15px; opacity: 0.95; line-height: 1.5;">
        <strong>Drum Painter</strong> is designed for desktop use with MIDI drum hardware and requires:
      </p>
      <div style="
        background: rgba(255,255,255,0.15);
        padding: 15px;
        border-radius: 10px;
        margin: 15px 0;
        text-align: left;
      ">
        <div style="font-size: 14px; margin-bottom: 8px;">✓ Full-size display for UI controls</div>
        <div style="font-size: 14px; margin-bottom: 8px;">✓ MIDI drum kit connection</div>
        <div style="font-size: 14px; margin-bottom: 8px;">✓ Keyboard shortcuts</div>
        <div style="font-size: 14px;">✓ Desktop browser (Chrome, Edge, Opera)</div>
      </div>
      <p style="margin: 0 0 20px 0; font-size: 13px; opacity: 0.9;">
        Mobile devices cannot connect to MIDI hardware and lack the screen space for the full interface.
      </p>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: white;
        color: #d97706;
        border: none;
        padding: 12px 30px;
        border-radius: 25px;
        font-size: 15px;
        font-weight: bold;
        cursor: pointer;
        transition: transform 0.2s;
      " onmouseover="this.style.transform='scale(1.05)'"
         onmouseout="this.style.transform='scale(1)'">
        I Understand
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

/**
 * Check browser compatibility and show warnings if needed
 * @returns {boolean} True if all required features are supported
 */
export function checkBrowserCompatibility() {
  // Check for mobile devices first
  if (isMobileDevice()) {
    showMobileWarning();
    return false;
  }

  // Check for MIDI support
  if (!isMidiSupported()) {
    showCompatibilityWarning(
      'Web MIDI API',
      'This application requires MIDI support to receive input from your drum kit.'
    );
    return false;
  }

  return true;
}
