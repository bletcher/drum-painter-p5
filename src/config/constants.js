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
export const VELOCITY_MULT_CLASSIC = 200;//60;
export const BASE_SIZE_FIBONACCI = 5;
export const VELOCITY_MULT_FIBONACCI = 60;
export const BASE_SIZE_SYMMETRY = 5;
export const VELOCITY_MULT_SYMMETRY = 60;
export const BASE_SIZE_GRAVITY = 5;
export const VELOCITY_MULT_GRAVITY = 60;
export const BASE_SIZE_ORGANIC = 5;
export const VELOCITY_MULT_ORGANIC = 60;

// ===== ALPHA/OPACITY SETTINGS (out of 255)=====
export const ALPHA_CLASSIC = 255;
export const ALPHA_FIBONACCI = 255;
export const ALPHA_SYMMETRY = 255;
export const ALPHA_GRAVITY = 255;
export const ALPHA_ORGANIC = 255;
export const ALPHA_GRAVITY_MIN = 55;

// ===== MODE-SPECIFIC SETTINGS =====
export const SYMMETRY_ORDER = 8;
export const GROWTH_POINTS_COUNT = 5;
export const FIBONACCI_RADIUS_MULT = 15;
export const GRAVITY_STEPS_BASE = 10;
export const GRAVITY_STEPS_MULT = 20;
export const GRAVITY_STEPS_VELOCITY_MULT = 0.8; // Multiplier for velocity's effect on step count
export const GRAVITY_STEP_MIN = 3;
export const GRAVITY_STEP_MAX = 8;
export const GRAVITY_DRIFT_MIN = -20;
export const GRAVITY_DRIFT_MAX = 20;
export const ORGANIC_DISTANCE_BASE = 30;
export const ORGANIC_DISTANCE_SPREAD = 40;
export const ORGANIC_MOVE_PROBABILITY = 0.1;
export const ORGANIC_MOVE_RANGE = 100;

// ===== DENDRITIC SETTINGS =====
export const DENDRITIC_BRANCH_BASE = 2.5; // Base number of main branches
export const DENDRITIC_BRANCH_VELOCITY_MULT = 1.0; // Multiplier for velocity's effect on branch count
export const DENDRITIC_MAINSTEM_LENGTH_MULT = 0.33; // Multiplier for main stem length (0.5-2.0)

// ===== SYMMETRY SETTINGS =====
export const SYMMETRY_RADIUS_MIN = 100;
export const SYMMETRY_RADIUS_MAX = 400;

// ===== BLEND MODE SETTINGS =====
export const BLEND_MODE_NAMES = ['Normal', 'Multiply', 'Screen', 'Overlay', 'Dodge', 'Burn', 'Add', 'Difference'];

// ===== BACKGROUND COLOR SETTINGS =====
export const BG_COLORS = [255, 0, 32, 240, 200]; // White, Black, Dark gray, Light gray, Beige
export const BG_COLOR_NAMES = ['White', 'Black', 'Dark Gray', 'Light Gray', 'Beige'];

// ===== UNDO/REDO SETTINGS =====
export const MAX_HISTORY = 2;

// ===== MIDI NOTE MAPPINGS =====
/*export const MIDI_NOTES = {
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
*/
// ===== SCALING CURVES =====
export const SCALING_CURVES = {
  FIXED: 'fixed',
  ONE_TO_ONE: '1:1',
  INVERSE: 'inverse',
  BOOST_SOFT: 'boost-soft',
  GATE_SOFT: 'gate-soft',
  GATE_LOUD: 'gate-loud'
};

export const SCALING_CURVE_NAMES = {
  [SCALING_CURVES.FIXED]: 'Fixed',
  [SCALING_CURVES.ONE_TO_ONE]: '1:1',
  [SCALING_CURVES.INVERSE]: 'Inverse',
  [SCALING_CURVES.BOOST_SOFT]: 'Boost Soft',
  [SCALING_CURVES.GATE_SOFT]: 'Gate Soft',
  [SCALING_CURVES.GATE_LOUD]: 'Gate Loud'
};

// ===== BRUSHSTROKE SETTINGS =====
// Bristle pattern
export const BRUSH_CLUSTER_SPACING_DIVISOR = 6;  // width / this + offset
export const BRUSH_CLUSTER_SPACING_OFFSET = 8;
export const BRUSH_BRISTLES_PER_CLUSTER_MIN = 4;
export const BRUSH_BRISTLES_PER_CLUSTER_MAX = 10;

// Bristle dimensions
export const BRUSH_BRISTLE_THICKNESS_MIN = 0.08;  // Multiplied by height
export const BRUSH_BRISTLE_THICKNESS_MAX = 0.15;
export const BRUSH_BRISTLE_LENGTH_MIN = 0.15;     // Multiplied by width
export const BRUSH_BRISTLE_LENGTH_MAX = 0.35;
export const BRUSH_BRISTLE_ROTATION_VARIATION = 0.08;

// Bristle opacity
export const BRUSH_BRISTLE_ALPHA_MIN = 60;
export const BRUSH_BRISTLE_ALPHA_MAX = 120;

// Detail marks (finer lines within bristles)
export const BRUSH_DETAIL_PROBABILITY = 0.4;
export const BRUSH_DETAIL_ALPHA_MIN = 20;
export const BRUSH_DETAIL_ALPHA_MAX = 50;
export const BRUSH_DETAIL_LENGTH_MIN = 0.4;       // Multiplied by bristle length
export const BRUSH_DETAIL_LENGTH_MAX = 0.7;
export const BRUSH_DETAIL_THICKNESS_MIN = 0.3;    // Multiplied by bristle thickness
export const BRUSH_DETAIL_THICKNESS_MAX = 0.6;

// Pressure curve (Gaussian distribution for stroke thickness)
export const BRUSH_PRESSURE_SIGMA = 0.3;
export const BRUSH_PRESSURE_MIN = 0.3;

// Edge masking (organic irregular edges)
export const BRUSH_EDGE_MASK_TOP_MIN = -0.7;      // Multiplied by height
export const BRUSH_EDGE_MASK_TOP_MAX = 0.15;
export const BRUSH_EDGE_MASK_BOTTOM_MIN = 0.85;   // Multiplied by height
export const BRUSH_EDGE_MASK_BOTTOM_MAX = 1.7;
export const BRUSH_EDGE_MASK_LEFT_MAX = 0.15;     // Multiplied by width
export const BRUSH_EDGE_MASK_RIGHT_MIN = 0.85;    // Multiplied by width

// ===== SPLATTER SETTINGS =====
// Droplet generation
export const SPLATTER_DROPLET_COUNT_MIN = 12;
export const SPLATTER_DROPLET_COUNT_MAX = 25;
export const SPLATTER_DROPLET_DISTANCE_MIN = 0.5; // Multiplied by size
export const SPLATTER_DROPLET_DISTANCE_MAX = 1.0;
export const SPLATTER_DROPLET_SIZE_MIN = 0.08;    // Multiplied by size
export const SPLATTER_DROPLET_SIZE_MAX = 0.2;
export const SPLATTER_DROPLET_ALPHA_MIN = 100;
export const SPLATTER_DROPLET_ALPHA_MAX = 180;

// Central blob
export const SPLATTER_BLOB_RADIUS = 0.4;          // Multiplied by size
export const SPLATTER_BLOB_ALPHA = 200;
export const SPLATTER_BLOB_CORE_POINTS = 20;      // Number of vertices for organic shape
export const SPLATTER_BLOB_RADIUS_VARIATION = 0.4; // Noise-based variation

// Connections (from blob to droplets)
export const SPLATTER_CONNECTION_PROBABILITY = 0.7;
export const SPLATTER_CONNECTION_START_RADIUS = 0.85; // Multiplied by blob radius
export const SPLATTER_CONNECTION_BASE_WIDTH = 0.1;    // Multiplied by size
export const SPLATTER_CONNECTION_STRENGTH_MIN = 0.5;
export const SPLATTER_CONNECTION_STRENGTH_MAX = 1.0;
export const SPLATTER_CONNECTION_PINCH_WIDTH = 0.25;  // Multiplied by base width (pinch point)
export const SPLATTER_CONNECTION_ALPHA_MIN = 100;
export const SPLATTER_CONNECTION_ALPHA_MAX = 160;

// Droplet tails (directional motion effect)
export const SPLATTER_TAIL_PROBABILITY = 0.4;

// Spray dots (small disconnected dots)
export const SPLATTER_SPRAY_COUNT_MIN = 15;
export const SPLATTER_SPRAY_COUNT_MAX = 30;
export const SPLATTER_SPRAY_DISTANCE_MIN = 0.8;   // Multiplied by size
export const SPLATTER_SPRAY_DISTANCE_MAX = 1.3;
export const SPLATTER_SPRAY_SIZE_MIN = 0.02;      // Multiplied by size
export const SPLATTER_SPRAY_SIZE_MAX = 0.06;
export const SPLATTER_SPRAY_ALPHA_MIN = 60;
export const SPLATTER_SPRAY_ALPHA_MAX = 120;

// ===== INK BLOT SETTINGS =====
// Core blob
export const INK_BLOT_CORE_RADIUS = 0.3;          // Multiplied by size
export const INK_BLOT_CORE_ALPHA = 120;
export const INK_BLOT_CORE_VERTICES = 24;         // Number of vertices for organic shape

// Bleeding layers (spreading outward from core)
export const INK_BLOT_BLEED_LAYERS = 6;           // Number of spreading layers
export const INK_BLOT_BLEED_SPREAD_MIN = 0.15;    // Min radius increase per layer (multiplied by size)
export const INK_BLOT_BLEED_SPREAD_MAX = 0.25;    // Max radius increase per layer
export const INK_BLOT_BLEED_ALPHA_START = 160;    // Alpha of first bleed layer
export const INK_BLOT_BLEED_ALPHA_DECAY = 0.4;    // Multiplier for each successive layer

// Edge variation
export const INK_BLOT_EDGE_NOISE_SCALE = 0.3;     // Perlin noise scale for edge variation
export const INK_BLOT_EDGE_NOISE_AMOUNT = 0.5;   // Amount of radius variation (0-1)

// Feathering (small organic tendrils extending from edges)
export const INK_BLOT_FEATHER_COUNT_MIN = 8;
export const INK_BLOT_FEATHER_COUNT_MAX = 16;
export const INK_BLOT_FEATHER_LENGTH_MIN = 0.15;  // Multiplied by size
export const INK_BLOT_FEATHER_LENGTH_MAX = 0.35;
export const INK_BLOT_FEATHER_WIDTH = 0.08;       // Multiplied by size
export const INK_BLOT_FEATHER_ALPHA_MIN = 60;
export const INK_BLOT_FEATHER_ALPHA_MAX = 120;

// ===== UI SETTINGS =====
export const SHAPE_OPTIONS = ['brushstroke', 'splatter', 'inkblot', 'circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'];

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
export const DEFAULT_TIMELINE_BPM = 90;
export const DEFAULT_TIMELINE_SUBDIVISION = 4;
export const DEFAULT_TIMELINE_BEATS_PER_MEASURE = 4;
export const DEFAULT_TIMELINE_PIXELS_PER_SECOND = 200;
export const DEFAULT_STAFF_HEIGHT = 80;
export const DEFAULT_DRUM_LINE_SPACING = 15;
export const DEFAULT_STAFF_WIDTH = 1800;
export const DEFAULT_MIDI_LATENCY_MS = 70;

// ===== DEBUGGING =====
// Set to true to make all drums respond to any MIDI device (ignore device ID)
export const IGNORE_MIDI_DEVICE_ID = false;
