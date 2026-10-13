/**
 * Theme Configuration
 * Centralized color palette and styling constants for UI components
 */

// ===== COLOR PALETTE =====

// Neutral tokens (surfaces, text, borders, tinted backgrounds) are CSS variable
// references defined in src/styles/app.css, so panels built in JS follow the
// light/dark theme automatically. The hex after the comma is only a fallback.
// Never do string math on these values (e.g. appending alpha) — use CSS instead.
// Saturated fills (main/light/dark) stay as plain hex and work in both themes.

export const COLORS = {
  // Primary brand colors
  primary: {
    main: '#5a67d8',
    light: '#8b9aff',
    dark: '#4c5ed4',
    text: 'var(--primary-text, #4c51bf)',
    bg: 'var(--primary-soft, #f8f9ff)',
    bgGradient: 'var(--primary-soft-gradient, linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%))'
  },

  // Success/positive colors (used for calculated values, confirmations)
  success: {
    main: '#15803d',
    light: '#3cb368',
    dark: '#166534',
    text: 'var(--success-text, #166534)',
    bg: 'var(--success-soft, #f0fff4)',
    bgGradient: 'var(--success-soft-gradient, linear-gradient(135deg, #f0fff4 0%, #dcfce7 100%))'
  },

  // Warning/input colors (used for input indicators, velocity)
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#92400e',
    darkest: '#78350f',
    text: 'var(--warning-text, #92400e)',
    bg: 'var(--warning-soft, #fffbeb)',
    bgLight: 'var(--warning-soft-2, #fef3c7)',
    bgGradient: 'var(--warning-soft-gradient, linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%))'
  },

  // Error/danger colors
  error: {
    main: '#c53030',
    light: '#db3e3e',
    dark: '#b91c1c',
    text: 'var(--danger-text, #b91c1c)',
    bg: 'var(--danger-soft, #fef2f2)'
  },

  // Info colors
  info: {
    main: '#2563eb',
    light: '#60a5fa',
    dark: '#1e40af',
    text: 'var(--info-text, #1e40af)',
    bg: 'var(--info-soft, #eff6ff)'
  },

  // Neutral grays (50–400 are used as surfaces/borders, so they follow the theme)
  gray: {
    50: 'var(--gray-50, #f9fafb)',
    100: 'var(--gray-100, #f3f4f6)',
    200: 'var(--gray-200, #e5e7eb)',
    300: 'var(--gray-300, #d1d5db)',
    400: 'var(--gray-400, #9ca3af)',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  },

  // Background colors
  background: {
    primary: 'var(--panel-solid, #ffffff)',
    secondary: 'var(--surface, #f8f9fa)',
    tertiary: 'var(--surface-2, #f5f5f5)',
    overlay: 'var(--scrim, rgba(0, 0, 0, 0.5))',
    overlayLight: 'rgba(0, 0, 0, 0.3)'
  },

  // Text colors
  text: {
    primary: 'var(--text, #333333)',
    secondary: 'var(--text-muted, #555555)',
    muted: 'var(--text-subtle, #666a70)',
    light: 'var(--text-on-color, #ffffff)',
    dark: 'var(--text-strong, #000000)'
  },

  // Border colors
  border: {
    light: 'var(--border-soft, #f0f0f0)',
    medium: 'var(--border-input, #8f959e)',
    dark: 'var(--border-strong, #b5b9c0)'
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
    xs: '11px',  // nothing smaller than 11px, for legibility
    sm: '11px',
    base: '12px',
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
      chevronColor: COLORS.primary.text,
      borderColor: COLORS.primary.main,
      textColor: COLORS.primary.text
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
    labelColor: COLORS.warning.text,
    valueColor: COLORS.warning.text,
    badgeColor: COLORS.warning.text
  },
  calculated: {
    background: COLORS.success.bgGradient,
    borderColor: COLORS.success.light,
    labelColor: COLORS.success.text,
    valueColor: COLORS.success.text,
    tableRowBorder: 'var(--border-soft, rgba(22, 101, 52, 0.1))'
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
    learning: '#c2410c', // orange dark enough for white text
    mapped: COLORS.primary.text,
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
    active: '#c2410c'
  }
};

// QUICK_SETTINGS_PANEL / CONTROLS_PANEL button colors are no longer applied from JS;
// index.html buttons are styled by classes in app.css. Kept for compatibility.
export const QUICK_SETTINGS_PANEL = {
  buttons: {
    customize: 'linear-gradient(135deg, #8362a1ff 0%, #764ba2 100%)',
    midiMapping: 'linear-gradient(135deg, #6085b6ff 0%, #5796f5ff 100%)',
    userGuide: 'linear-gradient(135deg, #439cacff 0%, #4cb6adff 100%)',
    debug: 'linear-gradient(135deg, #bdb252ff 0%, #acc51cff 100%)',
    save: COLORS.success.light,
    load: COLORS.info.main,
    delete: COLORS.error.light,
    videoRecord: '#da3939ff'
  },
  panel: {
    background: 'var(--panel-bg, rgba(255, 255, 255, 0.95))',
    borderRadius: RADIUS.xl,
    shadow: SHADOWS.md
  }
};

export const CONTROLS_PANEL = {
  panel: {
    background: 'var(--panel-bg, rgba(255, 255, 255, 0.95))',
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
