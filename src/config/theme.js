/**
 * Theme Configuration
 * Centralized color palette and styling constants for UI components
 */

// ===== COLOR PALETTE =====

export const COLORS = {
  // Primary brand colors
  primary: {
    main: '#667eea',
    light: '#8b9aff',
    dark: '#4c5ed4',
    bg: '#f8f9ff',
    bgGradient: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)'
  },

  // Success/positive colors (used for calculated values, confirmations)
  success: {
    main: '#28a745',
    light: '#22c55e',
    dark: '#166534',
    bg: '#f0fff4',
    bgGradient: 'linear-gradient(135deg, #f0fff4 0%, #dcfce7 100%)'
  },

  // Warning/input colors (used for input indicators, velocity)
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#92400e',
    darkest: '#78350f',
    bg: '#fffbeb',
    bgLight: '#fef3c7',
    bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
  },

  // Error/danger colors
  error: {
    main: '#dc3545',
    light: '#ef4444',
    dark: '#b91c1c',
    bg: '#fef2f2'
  },

  // Info colors
  info: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#1e40af',
    bg: '#eff6ff'
  },

  // Neutral grays
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  },

  // Background colors
  background: {
    primary: '#ffffff',
    secondary: '#f8f9fa',
    tertiary: '#f5f5f5',
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)'
  },

  // Text colors
  text: {
    primary: '#333333',
    secondary: '#666666',
    muted: '#999999',
    light: '#ffffff',
    dark: '#000000'
  },

  // Border colors
  border: {
    light: '#f0f0f0',
    medium: '#ddd',
    dark: '#ccc'
  }
};

// ===== SEMANTIC COLORS =====
// Map semantic names to specific color values for easier component usage

export const SEMANTIC = {
  // Panel and section headers
  headerPrimary: COLORS.primary.main,
  headerSuccess: COLORS.success.main,

  // Backgrounds
  panelBg: COLORS.background.primary,
  sectionBg: COLORS.background.secondary,
  cardBg: COLORS.background.primary,
  backdropBg: COLORS.background.overlay,

  // Interactive elements
  buttonPrimary: COLORS.primary.main,
  buttonSuccess: COLORS.success.main,
  buttonDanger: COLORS.error.main,
  buttonHoverOverlay: 'rgba(255, 255, 255, 0.2)',

  // Text
  labelText: COLORS.text.secondary,
  valueText: COLORS.text.primary,
  mutedText: COLORS.text.muted,

  // Borders
  borderLight: COLORS.border.light,
  borderMedium: COLORS.border.medium,

  // Special use cases
  inputHighlight: COLORS.warning.bgGradient,
  calculatedHighlight: COLORS.success.bgGradient,
  fixedSettingsBg: COLORS.background.primary
};

// ===== TYPOGRAPHY =====

export const TYPOGRAPHY = {
  fontFamily: {
    default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    monospace: '"Courier New", Courier, monospace'
  },
  fontSize: {
    xs: '9px',
    sm: '10px',
    base: '11px',
    md: '12px',
    lg: '13px',
    xl: '16px',
    xxl: '18px'
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  }
};

// ===== SPACING =====

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '15px',
  xl: '20px',
  xxl: '30px'
};

// ===== BORDER RADIUS =====

export const RADIUS = {
  sm: '3px',
  md: '4px',
  lg: '6px',
  xl: '8px'
};

// ===== SHADOWS =====

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 4px 20px rgba(0, 0, 0, 0.3)',
  panel: '0 4px 20px rgba(0, 0, 0, 0.3)'
};

// ===== COMPONENT-SPECIFIC THEMES =====

export const DEBUG_PANEL = {
  header: {
    collapsed: {
      chevronColor: COLORS.primary.main,
      borderColor: COLORS.primary.main,
      textColor: COLORS.primary.main
    }
  },
  fixedSettings: {
    labelColor: COLORS.text.secondary,
    valueColor: COLORS.text.primary,
    borderColor: COLORS.border.light
  },
  velocity: {
    background: COLORS.warning.bgGradient,
    borderColor: COLORS.warning.main,
    labelColor: COLORS.warning.dark,
    valueColor: COLORS.warning.dark,
    badgeColor: COLORS.warning.darkest
  },
  calculated: {
    background: COLORS.success.bgGradient,
    borderColor: COLORS.success.light,
    labelColor: COLORS.success.dark,
    valueColor: COLORS.success.dark,
    tableRowBorder: 'rgba(22, 101, 52, 0.1)'
  }
};

export const CUSTOMIZATION_PANEL = {
  tab: {
    inactive: COLORS.background.secondary,
    active: COLORS.background.primary,
    hover: COLORS.gray[200],
    textInactive: COLORS.text.secondary,
    textActive: COLORS.text.primary
  },
  section: {
    background: COLORS.background.secondary,
    borderRadius: '8px'
  },
  slider: {
    track: COLORS.gray[300],
    thumb: COLORS.primary.main
  },
  ccButton: {
    learn: COLORS.primary.main,
    learning: '#ff6b35',
    mapped: COLORS.primary.main,
    remove: COLORS.error.main
  }
};

export const MIDI_MAPPING_PANEL = {
  drumRow: {
    background: COLORS.background.primary,
    hoverBackground: COLORS.gray[50],
    border: COLORS.border.light
  },
  learnButton: {
    idle: COLORS.primary.main,
    active: '#ff6b35'
  }
};

export const QUICK_SETTINGS_PANEL = {
  buttons: {
    customize: 'linear-gradient(135deg, #8362a1ff 0%, #764ba2 100%)',
    midiMapping: 'linear-gradient(135deg, #6085b6ff 0%, #5796f5ff 100%)',
    userGuide: 'linear-gradient(135deg, #439cacff 0%, #4cb6adff 100%)',
    debug: 'linear-gradient(135deg, #bdb252ff 0%, #acc51cff 100%)',
    save: COLORS.success.light,
    load: COLORS.info.main,
    delete: COLORS.error.light,
    videoRecord: '#dc2626'
  },
  panel: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: RADIUS.xl,
    shadow: SHADOWS.md
  }
};

export const CONTROLS_PANEL = {
  panel: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: RADIUS.xl,
    shadow: SHADOWS.md
  },
  header: {
    textColor: COLORS.text.primary,
    iconColor: COLORS.text.primary
  },
  midiStatus: {
    background: COLORS.background.secondary,
    borderRadius: RADIUS.lg,
    connectedColor: COLORS.success.light,
    disconnectedColor: COLORS.warning.main,
    activityColor: COLORS.success.light
  },
  select: {
    background: COLORS.background.primary,
    border: COLORS.border.medium,
    borderRadius: RADIUS.md
  },
  timelineButtons: {
    start: COLORS.success.main,
    stop: COLORS.error.main,
    continue: COLORS.success.main,
    startOver: '#ff6b35',
    reset: COLORS.primary.main
  }
};

// ===== HELPER FUNCTIONS =====

/**
 * Create a CSS style string from an object of properties
 */
export function createStyle(styleObj) {
  return Object.entries(styleObj)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');
}

/**
 * Get a color with alpha transparency
 */
export function withAlpha(color, alpha) {
  // Simple helper - assumes hex color
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
