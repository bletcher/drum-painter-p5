/**
 * Configuration Constants
 * All constant values used throughout the application
 */

// ===== CANVAS SETTINGS =====
export const PAINT_CANVAS_WIDTH = 1920;
export const PAINT_CANVAS_HEIGHT = 1080;

// ===== PARTICLE SETTINGS =====
export const PARTICLE_LIFETIME = 30;
export const PARTICLE_SIZE_GROWTH = 0.1;

// ===== PAINT SIZE SETTINGS =====
export const BASE_SIZE_CLASSIC = 5;
export const VELOCITY_MULT_CLASSIC = 60;
export const BASE_SIZE_FIBONACCI = 5;
export const VELOCITY_MULT_FIBONACCI = 60;
export const BASE_SIZE_SYMMETRY = 5;
export const VELOCITY_MULT_SYMMETRY = 60;
export const BASE_SIZE_GRAVITY = 5;
export const VELOCITY_MULT_GRAVITY = 60;
export const BASE_SIZE_ORGANIC = 5;
export const VELOCITY_MULT_ORGANIC = 60;

// ===== ALPHA/OPACITY SETTINGS =====
export const ALPHA_CLASSIC = 150;
export const ALPHA_FIBONACCI = 180;
export const ALPHA_SYMMETRY = 160;
export const ALPHA_GRAVITY = 180;
export const ALPHA_ORGANIC = 140;
export const ALPHA_GRAVITY_MIN = 40;

// ===== MODE-SPECIFIC SETTINGS =====
export const SYMMETRY_ORDER = 8;
export const GROWTH_POINTS_COUNT = 5;
export const FIBONACCI_RADIUS_MULT = 15;
export const GRAVITY_STEPS_BASE = 10;
export const GRAVITY_STEPS_MULT = 20;
export const GRAVITY_STEP_MIN = 3;
export const GRAVITY_STEP_MAX = 8;
export const GRAVITY_DRIFT_MIN = -5;
export const GRAVITY_DRIFT_MAX = 5;
export const ORGANIC_DISTANCE_BASE = 30;
export const ORGANIC_DISTANCE_SPREAD = 50;
export const ORGANIC_MOVE_PROBABILITY = 0.05;
export const ORGANIC_MOVE_RANGE = 100;

// ===== SYMMETRY SETTINGS =====
export const SYMMETRY_RADIUS_MIN = 100;
export const SYMMETRY_RADIUS_MAX = 400;

// ===== BLEND MODE SETTINGS =====
export const BLEND_MODE_NAMES = ['Normal', 'Multiply', 'Screen', 'Overlay', 'Dodge', 'Burn'];

// ===== BACKGROUND COLOR SETTINGS =====
export const BG_COLORS = [255, 0, 32, 240, 200]; // White, Black, Dark gray, Light gray, Beige
export const BG_COLOR_NAMES = ['White', 'Black', 'Dark Gray', 'Light Gray', 'Beige'];

// ===== UNDO/REDO SETTINGS =====
export const MAX_HISTORY = 2;

// ===== MIDI NOTE MAPPINGS =====
export const MIDI_NOTES = {
  KICK: 36,
  SNARE: 38,
  CLOSED_HAT: 42,
  OPEN_HAT: 46,
  TOM_LOW: 45,
  TOM_MID: 48,
  TOM_HIGH: 50,
  CRASH: 49,
  RIDE: 51
};

// ===== SCALING CURVES =====
export const SCALING_CURVES = {
  LINEAR: 'linear',
  LOGARITHMIC: 'log',
  EXPONENTIAL: 'exp',
  QUADRATIC: 'quad'
};

export const SCALING_CURVE_NAMES = {
  [SCALING_CURVES.LINEAR]: 'Linear',
  [SCALING_CURVES.LOGARITHMIC]: 'Logarithmic',
  [SCALING_CURVES.EXPONENTIAL]: 'Exponential',
  [SCALING_CURVES.QUADRATIC]: 'Quadratic'
};

// ===== UI SETTINGS =====
export const SHAPE_OPTIONS = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'];

export const MODE_NAMES = [
  'Classic Pointillism',
  'Fibonacci Spiral',
  'Radial Symmetry',
  'Gravity Field',
  'Organic Growth',
  'Timeline/Sequencer',
  'Dendritic Spreading',
  'Lightning'
];

// ===== TIMELINE SETTINGS =====
export const DEFAULT_TIMELINE_BPM = 120;
export const DEFAULT_TIMELINE_SUBDIVISION = 4;
export const DEFAULT_TIMELINE_BEATS_PER_MEASURE = 4;
export const DEFAULT_TIMELINE_PIXELS_PER_SECOND = 200;
export const DEFAULT_STAFF_HEIGHT = 80;
export const DEFAULT_DRUM_LINE_SPACING = 15;
export const DEFAULT_STAFF_WIDTH = 1800;
export const DEFAULT_MIDI_LATENCY_MS = 70;
