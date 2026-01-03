/**
 * Configuration Constants
 * All constant values used throughout the application
 *
 * TABLE OF CONTENTS
 * =================
 * Line   Section
 * ----   -------
 *  30    CANVAS SETTINGS - Canvas dimensions
 *  34    PARTICLE SETTINGS - Visual feedback particles
 *  38    PAINT SIZE SETTINGS - Brush sizes per mode
 *  52    ALPHA/OPACITY SETTINGS - Transparency values
 *  60    MODE-SPECIFIC SETTINGS - Freeform paint modes
 *  76    DENDRITIC SETTINGS - Branching pattern config
 *  81    SYMMETRY SETTINGS - Radial symmetry bounds
 *  85    BLEND MODE SETTINGS - Available blend modes
 *  88    BACKGROUND COLOR SETTINGS - Canvas backgrounds
 *  92    UNDO/REDO SETTINGS - History limits
 * 108    SCALING CURVES - Velocity response curves
 * 127    BRUSHSTROKE SETTINGS - Realistic brush texture
 * 166    SPLATTER SETTINGS - Paint splatter effect
 * 206    INK BLOT SETTINGS - Ink blot/watercolor effect
 * 232    UI SETTINGS - Shape options, mode names
 * 246    TIMELINE SETTINGS - BPM, subdivision defaults
 * 256    UI LAYOUT - Scrollbar dimensions
 * 262    TIMELINE MODE VISUALS - Staff/spiral layouts
 * 285    METRONOME SETTINGS - Visual & audio metronome
 * 303    TIMELINE PAINT - Dot sizing and particles
 * 310    PLAYHEAD SETTINGS - Recording indicator
 * 315    MAIN UI - Canvas scaling, viewport margins
 * 325    AUTO-SAVE & TIMING - Debounce delays
 * 334    DRUM CUSTOMIZATION PANEL - Slider ranges
 * 347    DRAWING UTILS - Bezier segments, vertices
 * 351    BRUSH TEXTURE CACHE - Cache limits
 * 357    POST PROCESSING - Bloom effect settings
 * 361    CLICK PAINT MODE - Mouse velocity mapping
 * 366    DEBUGGING - Debug flags
 */

// ===== CANVAS SETTINGS =====
export const PAINT_CANVAS_WIDTH = 1920;
export const PAINT_CANVAS_HEIGHT = 1080;

// ===== PARTICLE SETTINGS =====
export const PARTICLE_LIFETIME = 30;
export const PARTICLE_SIZE_GROWTH = 0.1;

// ===== PAINT SIZE SETTINGS =====
// Standard modes use velocityMult = 60 for consistent sizing
// Special modes (Lightning=10, Dendritic=12, Timeline=15) kept smaller
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

// ===== LIGHTNING SETTINGS =====
// Origin bounds (cloud layer position)
export const LIGHTNING_ORIGIN_X_MIN = 0.1;          // Min X as fraction of canvas width
export const LIGHTNING_ORIGIN_X_MAX = 0.9;          // Max X as fraction of canvas width
export const LIGHTNING_ORIGIN_Y_MIN = 0.1;          // Min Y as fraction of canvas height
export const LIGHTNING_ORIGIN_Y_MAX = 0.4;          // Max Y as fraction of canvas height (upper 40%)

// Strike angle (downward direction)
export const LIGHTNING_ANGLE_VARIATION = 0.349;     // ±20 degrees in radians (PI/9)

// Stepped leader physics
export const LIGHTNING_STEP_LENGTH_MIN = 8;         // Min step length in pixels
export const LIGHTNING_STEP_LENGTH_MAX = 20;        // Max step length in pixels
export const LIGHTNING_ANGLE_JITTER = 1.047/2;        // Max angle change per step (PI/3 = 60 degrees)

// Branching behavior
export const LIGHTNING_BRANCH_PROB_BASE = 0.1;     // Base probability of branching
export const LIGHTNING_BRANCH_PROB_VELOCITY = 0.1; // Additional probability from velocity
export const LIGHTNING_BRANCH_COUNT_SINGLE = 0.7;   // Probability of single branch
export const LIGHTNING_BRANCH_COUNT_DOUBLE = 0.6;   // Probability of double (vs triple) when not single
export const LIGHTNING_BRANCH_ANGLE_MIN = 0.785/2;    // Min branch angle (PI/4 = 45 degrees)
export const LIGHTNING_BRANCH_ANGLE_MAX = 1.571/2;    // Max branch angle (HALF_PI = 90 degrees)
export const LIGHTNING_ENERGY_SPLIT_MIN = 0.5;      // Min energy retained by branch
export const LIGHTNING_ENERGY_SPLIT_MAX = 0.75;     // Max energy retained by branch
export const LIGHTNING_STEP_REDUCTION_MIN = 0.4;    // Min step reduction for branches
export const LIGHTNING_STEP_REDUCTION_MAX = 0.7;    // Max step reduction for branches

// Path length and generations
export const LIGHTNING_STEPS_BASE = 4;             // Base number of steps
export const LIGHTNING_STEPS_VELOCITY = 2;         // Additional steps from velocity
export const LIGHTNING_GENERATIONS_BASE = 2;        // Base number of branch generations
export const LIGHTNING_GENERATIONS_VELOCITY = 1;    // Additional generations from velocity

// Size and rendering
export const LIGHTNING_BASE_SIZE_MIN = 3;           // Min base size
export const LIGHTNING_BASE_SIZE_VELOCITY = 10/5;     // Size multiplier from velocity
export const LIGHTNING_WIDTH_DECAY = 0.65*2;          // Width reduction per generation
export const LIGHTNING_GLOW_SIZE_MULT = 3/3;          // Glow size relative to core
export const LIGHTNING_GLOW_ALPHA = 80;             // Base glow opacity
export const LIGHTNING_CORE_ALPHA = 240;            // Base core opacity
export const LIGHTNING_FLASH_SIZE_MULT = 2.5;       // Origin flash size multiplier
export const LIGHTNING_FLASH_ALPHA = 255;           // Origin flash opacity

// ===== DENDRITIC SETTINGS =====
export const DENDRITIC_BRANCH_BASE = 1; // Base number of main branches
export const DENDRITIC_BRANCH_VELOCITY_MULT = 0.5; // Multiplier for velocity's effect on branch count
export const DENDRITIC_MAINSTEM_LENGTH_MULT = 0.066; // Multiplier for main stem length (0.5-2.0)

// Stream width sizing (Horton's width ratio)
export const DENDRITIC_STREAM_BASE_SIZE = 0;        // Minimum stream width
export const DENDRITIC_STREAM_VELOCITY_MULT = 1.5;    // Velocity multiplier for stream width
export const DENDRITIC_STREAM_WIDTH_RATIO = 1.8;    // Width increase per stream order

// Stream opacity
export const DENDRITIC_STREAM_ALPHA_BASE = 180;     // Base opacity for stream segments
export const DENDRITIC_STREAM_ALPHA_ORDER = 20;     // Opacity increase per stream order
export const DENDRITIC_STREAM_ALPHA_DOWNSTREAM = 40; // Opacity increase toward downstream

// Outlet (river mouth) sizing
export const DENDRITIC_OUTLET_BASE_SIZE = 2;        // Minimum outlet size
export const DENDRITIC_OUTLET_VELOCITY_MULT = 4;    // Velocity multiplier for outlet size
export const DENDRITIC_OUTLET_ALPHA = 240;          // Base opacity for outlet

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
export const INK_BLOT_CORE_RADIUS = 0.25;          // Multiplied by size
export const INK_BLOT_CORE_ALPHA = 120;
export const INK_BLOT_CORE_VERTICES = 24;         // Number of vertices for organic shape

// Bleeding layers (spreading outward from core)
export const INK_BLOT_BLEED_LAYERS = 5;           // Number of spreading layers
export const INK_BLOT_BLEED_SPREAD_MIN = 0.1;    // Min radius increase per layer (multiplied by size)
export const INK_BLOT_BLEED_SPREAD_MAX = 0.2;    // Max radius increase per layer
export const INK_BLOT_BLEED_ALPHA_START = 100;    // Alpha of first bleed layer
export const INK_BLOT_BLEED_ALPHA_DECAY = 0.8;    // Multiplier for each successive layer

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
export const DEFAULT_TIMELINE_SUBDIVISION = 12;  // 12 = Eighth triplets
export const DEFAULT_TIMELINE_BEATS_PER_MEASURE = 4;
export const DEFAULT_TIMELINE_PIXELS_PER_SECOND = 200;
export const DEFAULT_STAFF_HEIGHT = 80;
export const DEFAULT_DRUM_LINE_SPACING = 15;
export const DEFAULT_STAFF_WIDTH = 1800;
export const DEFAULT_MIDI_LATENCY_MS = 70;

// ===== UI LAYOUT =====
export const SCROLLBAR_WIDTH = 12;
export const SCROLLBAR_TRACK_PADDING = 10;
export const SCROLLBAR_THUMB_MIN_HEIGHT = 30;
export const SCROLL_SPEED = 30;

// ===== TIMELINE MODE VISUALS =====
export const TIMELINE_ROW_SPACING = 10;           // Vertical spacing between staff rows (pixels)
export const TIMELINE_RING_SPACING = 40;          // Spacing between concentric rings
export const TIMELINE_POLYGON_SIDES = 6;          // Number of sides for polygon layout
export const TIMELINE_LANE_OFFSET = 8;            // Radial offset per drum in spiral mode

// Timeline spiral defaults
export const TIMELINE_SPIRAL_TIGHTNESS = 15;
export const TIMELINE_SPIRAL_ROTATIONS_PER_MIN = 4;
export const TIMELINE_SPIRAL_START_RADIUS = 50;
export const TIMELINE_SPIRAL_MAX_RADIUS_MULT = 0.85; // Max radius as fraction of min(width,height)/2

// Timeline layout magic numbers
export const TIMELINE_RING_BASE_RADIUS = 100;     // Base radius for rings layout
export const TIMELINE_RADIAL_BASE_DISTANCE = 50;  // Starting distance for radial spokes
export const TIMELINE_RADIAL_STEP = 30;           // Distance increase per beat
export const TIMELINE_PETAL_BASE_RADIUS = 100;
export const TIMELINE_PETAL_STEP = 20;
export const TIMELINE_PETAL_OSCILLATION = 40;
export const TIMELINE_POLYGON_BASE_RADIUS = 80;
export const TIMELINE_POLYGON_STEP = 15;
export const TIMELINE_POLYGON_PULSE = 20;
export const TIMELINE_POLYGON_ROTATION_BEATS = 60; // Beats per full rotation

// Metronome visual settings
export const METRONOME_RADIUS = 60;
export const METRONOME_DEFAULT_MARGIN = 100;      // Margin from canvas edge
export const METRONOME_PULSE_THRESHOLD = 0.15;    // Subdivision threshold for pulse
export const METRONOME_MARKER_SIZE_FIRST = 10;
export const METRONOME_MARKER_SIZE_BEAT = 7;
export const METRONOME_MARKER_SIZE_SUB = 4;
export const METRONOME_HAND_OFFSET = 10;          // Hand length offset from edge

// Metronome audio frequencies
export const METRONOME_FREQ_FIRST_BEAT = 1200;
export const METRONOME_FREQ_BEAT = 800;
export const METRONOME_FREQ_SUBDIVISION = 600;
export const METRONOME_GAIN_FIRST = 0.3;
export const METRONOME_GAIN_BEAT = 0.2;
export const METRONOME_GAIN_SUB = 0.1;
export const METRONOME_CLICK_DURATION = 0.05;     // Click duration in seconds

// Timeline paint settings
export const TIMELINE_DOT_BASE_SIZE = 8;
export const TIMELINE_DOT_VELOCITY_MULT = 15;
export const TIMELINE_DOT_ALPHA = 200;
export const TIMELINE_PARTICLE_LIFE = 30;
export const TIMELINE_PARTICLE_ALPHA = 150;

// Playhead visual settings
export const PLAYHEAD_BASE_WEIGHT = 3;
export const PLAYHEAD_PULSE_WEIGHT = 4;
export const PLAYHEAD_PULSE_DECAY = 0.2;          // Beat fraction for pulse decay

// ===== MAIN.JS UI =====
export const CANVAS_FIT_SCALE = 0.95;             // Scale factor when fitting canvas to window
export const VIEWPORT_MARGIN_BOTTOM = 100;        // Margin for auto-scroll
export const VIEWPORT_MARGIN_TOP = 50;
export const AUTO_SCROLL_PADDING = 150;
export const SCROLL_MAX_PADDING = 50;
export const MODE_DISPLAY_FRAMES = 180;           // Frames to show mode name overlay
export const MODE_OVERLAY_TEXT_SIZE = 24;

// Auto-save timing
export const AUTO_SAVE_DELAY = 2000;              // 2 seconds debounce

// UI debounce/delay timings
export const UI_DEBOUNCE_SHORT = 100;
export const UI_DEBOUNCE_MEDIUM = 500;
export const UI_NOTIFICATION_DURATION = 2000;
export const UI_NOTIFICATION_FADE = 3000;
export const URL_REVOKE_DELAY = 1000;

// ===== DRUM CUSTOMIZATION PANEL =====
export const PANEL_PREVIEW_SIZE = 80;             // Canvas size for shape preview
export const PANEL_PREVIEW_BASE_SIZE = 40;        // Base shape size in preview
export const MIDI_NOTE_MAX = 127;
export const MIDI_CC_MAX = 127;
export const SLIDER_SIZE_MIN = 30;
export const SLIDER_SIZE_MAX = 300;
export const SLIDER_OPACITY_MIN = 10;
export const SLIDER_OPACITY_MAX = 100;
export const SLIDER_ROTATION_MAX = 360;
export const SLIDER_STROKE_MAX = 10;
export const CC_LEARN_TIMEOUT = 4000;             // Timeout for CC learning mode

// ===== DRAWING UTILS =====
export const BEZIER_SEGMENTS = 15;                // Segments for curved brush strokes
export const ORGANIC_CORE_POINTS = 20;            // Vertices for organic shapes

// ===== BRUSH TEXTURE CACHE =====
export const TEXTURE_CACHE_MAX_SIZE = 50;
export const TEXTURE_NOISE_STRENGTH = 30;
export const TEXTURE_ORGANIC_POINTS = 20;
export const TEXTURE_CURVE_SEGMENTS = 15;

// ===== POST PROCESSING =====
export const BLOOM_THRESHOLD = 180;               // Brightness threshold (0-255)
export const BLOOM_RADIUS = 15;                   // Blur radius in pixels

// ===== CLICK PAINT MODE =====
export const CLICK_PAINT_VELOCITY_MAP_MIN = 0.3;
export const CLICK_PAINT_VELOCITY_MAP_MAX = 1.0;
export const CLICK_PAINT_SPEED_MAX = 50;

// ===== DEBUGGING =====
// Set to true to enable verbose console logging
export const DEBUG_MODE = false;

// Set to true to make all drums respond to any MIDI device (ignore device ID)
export const IGNORE_MIDI_DEVICE_ID = false;
