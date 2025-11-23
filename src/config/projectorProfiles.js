/**
 * Projector Configuration Profiles
 * Defines settings for different projector types and simulation modes
 */

// ===== PROJECTOR BRIGHTNESS PROFILES =====
export const PROJECTOR_PROFILES = {
  'low-lumens': {
    name: 'Low Lumens (<1000)',
    minBrightness: 60,          // Avoid colors darker than 60% lightness
    saturationBoost: 1.3,       // Boost saturation by 30%
    contrastMultiplier: 1.4,    // Increase contrast by 40%
    description: 'For projectors under 1000 lumens in dark rooms'
  },
  'medium-lumens': {
    name: 'Medium Lumens (1000-2500)',
    minBrightness: 40,
    saturationBoost: 1.15,
    contrastMultiplier: 1.2,
    description: 'For projectors 1000-2500 lumens with some ambient light'
  },
  'high-lumens': {
    name: 'High Lumens (2500+)',
    minBrightness: 20,
    saturationBoost: 1.0,
    contrastMultiplier: 1.0,
    description: 'For bright projectors 2500+ lumens'
  },
  'native': {
    name: 'Native (No Adjustments)',
    minBrightness: 0,
    saturationBoost: 1.0,
    contrastMultiplier: 1.0,
    description: 'Screen mode - no projector adjustments'
  }
};

// ===== PERFORMANCE TIERS =====
export const PERFORMANCE_TIERS = {
  'ultra': {
    name: 'Ultra Quality',
    particleMultiplier: 1.0,
    simplifiedShapes: false,
    antialiasing: true,
    expensiveBlendModes: true,
    targetFPS: 60,
    description: 'Full quality, all effects enabled'
  },
  'high': {
    name: 'High Quality',
    particleMultiplier: 0.85,
    simplifiedShapes: false,
    antialiasing: true,
    expensiveBlendModes: true,
    targetFPS: 60,
    description: 'Slight particle reduction'
  },
  'balanced': {
    name: 'Balanced',
    particleMultiplier: 0.7,
    simplifiedShapes: false,
    antialiasing: false,
    expensiveBlendModes: true,
    targetFPS: 60,
    description: 'Optimized for 60fps on large displays'
  },
  'performance': {
    name: 'Performance',
    particleMultiplier: 0.5,
    simplifiedShapes: true,
    antialiasing: false,
    expensiveBlendModes: false,
    targetFPS: 60,
    description: 'Maximum framerate, simplified rendering'
  }
};

// ===== DEFAULT PROJECTOR CONFIG =====
export const DEFAULT_PROJECTOR_CONFIG = {
  enabled: false,                    // Projector mode disabled by default
  profile: 'medium-lumens',          // Default brightness profile
  performanceTier: 'balanced',       // Default performance tier
  targetFPS: 60,                     // Target framerate
  showFPSCounter: false,             // Show performance HUD
  popupWindow: null,                 // Reference to popup window (if open)
  syncInterval: null,                // Interval for syncing frames
  ambientLightLevel: 0,              // 0-100, simulates ambient light
  displayMode: 'popup'               // 'popup', 'split', 'toggle', 'overlay'
};

// ===== AMBIENT LIGHT SIMULATION =====
export const AMBIENT_LIGHT_PRESETS = {
  0: 'Pitch Black',
  20: 'Very Dark',
  40: 'Dim Lighting',
  60: 'Some Ambient Light',
  80: 'Bright Room',
  100: 'Very Bright'
};
