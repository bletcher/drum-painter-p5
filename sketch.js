/**
 * DRUM PAINTER - p5.js Version
 *
 * Paint pointillistic art with MIDI drum triggers
 * Each drum creates unique visual marks with velocity sensitivity
 */

// ===== CONFIGURATION CONSTANTS =====

// Canvas settings
const PAINT_CANVAS_WIDTH = 1920;
const PAINT_CANVAS_HEIGHT = 1080;

// Particle settings
const PARTICLE_LIFETIME = 30;
const PARTICLE_SIZE_GROWTH = 0.1;

// Paint size settings
// Size calculation constants (maximum dynamic range)
const BASE_SIZE_CLASSIC = 5;
const VELOCITY_MULT_CLASSIC = 60;
const BASE_SIZE_FIBONACCI = 5;
const VELOCITY_MULT_FIBONACCI = 60;
const BASE_SIZE_SYMMETRY = 5;
const VELOCITY_MULT_SYMMETRY = 60;
const BASE_SIZE_GRAVITY = 5;
const VELOCITY_MULT_GRAVITY = 60;
const BASE_SIZE_ORGANIC = 5;
const VELOCITY_MULT_ORGANIC = 60;

// Alpha/opacity settings
const ALPHA_CLASSIC = 150;
const ALPHA_FIBONACCI = 180;
const ALPHA_SYMMETRY = 160;
const ALPHA_GRAVITY = 180;
const ALPHA_ORGANIC = 140;
const ALPHA_GRAVITY_MIN = 40;

// Mode-specific settings
const SYMMETRY_ORDER = 8;
const GROWTH_POINTS_COUNT = 5;
const FIBONACCI_RADIUS_MULT = 15;
const GRAVITY_STEPS_BASE = 10;
const GRAVITY_STEPS_MULT = 20;
const GRAVITY_STEP_MIN = 3;
const GRAVITY_STEP_MAX = 8;
const GRAVITY_DRIFT_MIN = -5;
const GRAVITY_DRIFT_MAX = 5;
const ORGANIC_DISTANCE_BASE = 30;
const ORGANIC_DISTANCE_SPREAD = 50;
const ORGANIC_MOVE_PROBABILITY = 0.05;
const ORGANIC_MOVE_RANGE = 100;

// Symmetry settings
const SYMMETRY_RADIUS_MIN = 100;
const SYMMETRY_RADIUS_MAX = 400;

// Canvas for persistent painting
let paintCanvas;

// MIDI state
let midiReady = false;
let midiInput = null;

// Painting state
let particles = [];
let currentMode = 0;
let strokeCount = 0;
let lastVelocity = 0; // Track last MIDI velocity for display
let lastDotSize = 0; // Track last dot size for display
let showUI = true;
let showHelp = false;
let globalSizeMultiplier = 1.0; // 0.3 to 3.0 range

// Notification flash state
let notificationText = '';
let notificationAlpha = 0;

// Mode-specific state
let spiralAngle = 0;
let growthPoints = [];

// Timeline mode state
let timelineX = 0;
let timelineSpeed = 2; // pixels per frame when auto-scrolling
let timelineAutoScroll = false; // auto-advance or only on hits
let timelineStartTime = null; // When first note was hit
let timelinePixelsPerSecond = 200; // How many pixels = 1 second
let measuresPerStaff = 4; // Number of complete measures per staff row (will be calculated dynamically)
let staffWidth = 1800; // Width before wrapping to next staff (calculated dynamically)
let staffHeight = 80; // Total height of one staff (all 4 drums)
let drumLineSpacing = 15; // Vertical spacing between drum lines within a staff
let timelineRecording = false; // Whether timeline is currently recording
let timelinePausedTime = 0; // Accumulated paused time in milliseconds
let timelineStopTime = null; // When we last stopped recording
let timelineBPM = 120; // Beats per minute for metronome
let timelineSubdivision = 4; // Beat subdivision (4 = quarter notes, 8 = eighth notes, 16 = sixteenth notes)
let metronomeEnabled = false; // Whether metronome sound is enabled
let lastMetronomeClick = -1; // Last subdivision index that played a click
let audioContext = null; // Web Audio API context for metronome
let lastMetronomeBPM = 120; // Track BPM changes
let lastMetronomeSubdivision = 4; // Track subdivision changes
let midiLatencyMs = 70; // MIDI latency compensation in milliseconds (adjustable)

// Blend mode state
let currentBlendMode = 0;
let BLEND_MODES = []; // Will be initialized in setup() when p5 constants are available
const BLEND_MODE_NAMES = ['Normal', 'Multiply', 'Screen', 'Overlay', 'Dodge', 'Burn'];

// Background color state
let currentBgColor = 0;
const BG_COLORS = [255, 0, 32, 240, 200]; // White, Black, Dark gray, Light gray, Beige
const BG_COLOR_NAMES = ['White', 'Black', 'Dark Gray', 'Light Gray', 'Beige'];

// Undo/Redo system
const MAX_HISTORY = 2;
let canvasHistory = [];
let historyIndex = -1;

// Mouse painting state (for testing without MIDI)
let mouseTestEnabled = false; // Start disabled, enable only if no MIDI
let currentMouseDrum = 0;
let prevMouseX = 0;
let prevMouseY = 0;

// DOM element cache
let midiStatusEl;
let modeSelectEl;
let blendSelectEl;
let additionalStatusEl;
let controlsEl;

// MIDI note mappings (General MIDI drum map)
const MIDI_NOTES = {
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

// ═══════════════════════════════════════════════════════════════
// 🥁 DRUM KIT CONFIGURATION - EASY CUSTOMIZATION!
// ═══════════════════════════════════════════════════════════════
//
// HOW TO CUSTOMIZE YOUR DRUM KIT:
//
// 1. ADD A DRUM: Copy a line and add to the array below
//    { id: 'new_drum', name: 'My Drum', defaultMidiNote: 60, defaultColor: '#FF00FF' }
//
// 2. REMOVE A DRUM: Delete or comment out the line
//
// 3. RENAME A DRUM: Change the 'name' field (or use UI after loading)
//
// 4. REORDER DRUMS: Change the order in this array
//    - Timeline mode uses this order top-to-bottom
//    - Mouse mode cycles through this order with [ ]
//
// FIELD REFERENCE:
// - id: Unique identifier (no spaces, letters/numbers/_)
// - name: Display name (can be changed in UI later)
// - defaultMidiNote: MIDI note number (0-127, use Learn button in UI)
// - defaultColor: Hex color code (#RRGGBB)
//
// EXAMPLES:
// Full kit: Add hi-hat, crash, ride, multiple toms
// Minimal: Keep just 2-3 drums
// Electronic kit: Map to your specific MIDI notes
//
// ═══════════════════════════════════════════════════════════════

const DRUM_KIT_CONFIG = [
  { id: 'kick', name: 'Kick', defaultMidiNote: 51, defaultColor: '#141E50' },
  { id: 'snare', name: 'Snare', defaultMidiNote: 49, defaultColor: '#C82832' },
  { id: 'rack_tom', name: 'Rack Tom', defaultMidiNote: 50, defaultColor: '#64A0DC' },
  { id: 'floor_tom', name: 'Floor Tom', defaultMidiNote: 39, defaultColor: '#DC6428' }
  // 💡 ADD MORE DRUMS HERE! Examples:
  // { id: 'hi_hat', name: 'Hi-Hat', defaultMidiNote: 42, defaultColor: '#FFC300' },
  // { id: 'crash', name: 'Crash', defaultMidiNote: 49, defaultColor: '#FF5733' },
  // { id: 'ride', name: 'Ride', defaultMidiNote: 51, defaultColor: '#DAF7A6' }
];

// Generate DRUM_IDS object from config (for backwards compatibility)
const DRUM_IDS = {};
DRUM_KIT_CONFIG.forEach(drum => {
  DRUM_IDS[drum.id.toUpperCase()] = drum.id;
});

// Drum customization system
let showCustomization = false;
let midiLearnMode = false;
let midiLearnDrumId = null;
let currentCustomizationTab = DRUM_IDS.KICK; // Track current active tab

// MIDI CC learn mode
let ccLearnMode = false;
let ccLearnDrumId = null;
let ccLearnParameter = null; // 'size', 'opacity', 'hueVariation', 'rotation', 'strokeWeight'
let ccLearnCalibrationValues = []; // Track CC values during learn for auto-calibration
let ccLearnStartTime = 0;

// Scaling curve types
const SCALING_CURVES = {
  LINEAR: 'linear',
  LOGARITHMIC: 'log',
  EXPONENTIAL: 'exp',
  QUADRATIC: 'quad'
};

const SCALING_CURVE_NAMES = {
  [SCALING_CURVES.LINEAR]: 'Linear',
  [SCALING_CURVES.LOGARITHMIC]: 'Logarithmic',
  [SCALING_CURVES.EXPONENTIAL]: 'Exponential',
  [SCALING_CURVES.QUADRATIC]: 'Quadratic'
};

// Generate factory default settings from config
function generateFactorySettings() {
  const settings = {};
  DRUM_KIT_CONFIG.forEach(drum => {
    settings[drum.id] = {
      name: drum.name,
      midiNote: drum.defaultMidiNote,
      color: drum.defaultColor,
      shape: 'circle',
      opacity: 1.0,
      opacityScaling: SCALING_CURVES.LINEAR,
      size: 1.0,
      sizeScaling: SCALING_CURVES.LINEAR,
      strokeEnabled: false,
      strokeWeight: 2,
      strokeColor: '#000000',
      hueVariation: 0,
      hueScaling: SCALING_CURVES.LINEAR,
      rotation: 0,
      // MIDI CC live control mappings (min/max match slider display ranges)
      midiCC: {
        size: { cc: null, min: 30, max: 300, ccMin: 0, ccMax: 127 },           // 30% to 300% (slider range)
        opacity: { cc: null, min: 10, max: 100, ccMin: 0, ccMax: 127 },        // 10% to 100% (slider range)
        hueVariation: { cc: null, min: 0, max: 30, ccMin: 0, ccMax: 127 },     // 0° to 30°
        rotation: { cc: null, min: 0, max: 360, ccMin: 0, ccMax: 127 },        // 0° to 360°
        strokeWeight: { cc: null, min: 1, max: 10, ccMin: 0, ccMax: 127 }      // 1px to 10px
      }
    };
  });
  return settings;
}

const FACTORY_DRUM_SETTINGS = generateFactorySettings();

// Deep copy factory settings to current settings
let drumSettings = JSON.parse(JSON.stringify(FACTORY_DRUM_SETTINGS));

// Mouse testing drum selection (generated from config)
let MOUSE_DRUM_IDS = DRUM_KIT_CONFIG.map(d => d.id);
let MOUSE_DRUM_NAMES = DRUM_KIT_CONFIG.map(d => d.name);

const SHAPE_OPTIONS = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'];

const MODE_NAMES = [
  'Classic Pointillism',
  'Fibonacci Spiral',
  'Radial Symmetry',
  'Gravity Field',
  'Organic Growth',
  'Timeline/Sequencer'
];

// Timeline lane mapping (generated dynamically from config)
function generateTimelineLanes() {
  const lanes = {};
  DRUM_KIT_CONFIG.forEach((drum, index) => {
    lanes[drum.id] = index;
  });
  return lanes;
}

let TIMELINE_LANES = generateTimelineLanes();
let TIMELINE_LANE_COUNT = DRUM_KIT_CONFIG.length;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Initialize blend modes (p5 constants are now available)
  BLEND_MODES = [BLEND, MULTIPLY, SCREEN, OVERLAY, DODGE, BURN];

  // Create high-res painting canvas
  paintCanvas = createGraphics(PAINT_CANVAS_WIDTH, PAINT_CANVAS_HEIGHT);
  paintCanvas.background(BG_COLORS[currentBgColor]);
  paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

  // Initialize growth points for organic mode
  for (let i = 0; i < GROWTH_POINTS_COUNT; i++) {
    growthPoints.push(createVector(
      random(paintCanvas.width),
      random(paintCanvas.height)
    ));
  }

  // Cache DOM elements
  midiStatusEl = document.getElementById('midi-status');
  modeSelectEl = document.getElementById('mode-select');
  blendSelectEl = document.getElementById('blend-select');
  additionalStatusEl = document.getElementById('additional-status');
  controlsEl = document.getElementById('controls');

  // Setup MIDI
  setupMIDI();

  // Load saved settings from localStorage (if available)
  loadDefaultOnStartup();

  // Force migrate any old CC format settings (aggressive fix)
  for (const drum of DRUM_KIT_CONFIG) {
    const drumId = drum.id;
    if (drumSettings[drumId] && drumSettings[drumId].midiCC) {
      const midiCC = drumSettings[drumId].midiCC;

      // Fix size range if wrong
      if (midiCC.size && midiCC.size.min < 10) {
        midiCC.size.min = 30;
        midiCC.size.max = 300;
        console.log(`Force-migrated size CC for ${drumId}: ${midiCC.size.min}-${midiCC.size.max}`);
      }

      // Fix opacity range if wrong
      if (midiCC.opacity && midiCC.opacity.min < 5) {
        midiCC.opacity.min = 10;
        midiCC.opacity.max = 100;
        console.log(`Force-migrated opacity CC for ${drumId}: ${midiCC.opacity.min}-${midiCC.opacity.max}`);
      }

      // Remove value properties
      delete midiCC.size?.value;
      delete midiCC.opacity?.value;
      delete midiCC.hueVariation?.value;
      delete midiCC.rotation?.value;
      delete midiCC.strokeWeight?.value;
    }
  }
  console.log('CC migration check complete');

  // Save initial blank canvas state
  saveCanvasState();

  // Initialize timeline controls visibility
  updateTimelineControlsVisibility();

  console.log('🎨 Drum Painter Ready!');
  console.log('Controls: SPACE=clear, S=save, 1-6=modes, H=hide UI, B=blend mode, Z=undo, Y=redo');
  console.log('Mouse Testing: M=toggle, []=change drum, click/drag to paint');

  // Make HTML callback functions globally accessible
  window.toggleCustomization = toggleCustomization;
  window.updateDrumSetting = updateDrumSetting;
  window.learnMIDINote = learnMIDINote;
  window.updateTimelineBPM = updateTimelineBPM;
  window.updateTimelineSubdivision = updateTimelineSubdivision;
  window.updateMidiLatency = updateMidiLatency;
  window.toggleMetronome = toggleMetronome;
  window.startTimelineRecording = startTimelineRecording;
  window.stopTimelineRecording = stopTimelineRecording;
  window.changeModeFromDropdown = changeModeFromDropdown;
  window.changeBlendModeFromDropdown = changeBlendModeFromDropdown;
  window.saveAsDefault = saveAsDefault;
  window.loadDefault = loadDefault;
  window.exportToFile = exportToFile;
  window.importFromFile = importFromFile;
  window.handleFileImport = handleFileImport;
  window.resetToFactory = resetToFactory;
  window.updateDrumTabLabel = updateDrumTabLabel;
  window.addNewDrum = addNewDrum;
  window.removeDrum = removeDrum;
}

function draw() {
  background(240);

  // Display painting canvas scaled to window
  let scaleFactor = min(width / paintCanvas.width, height / paintCanvas.height);
  let w = paintCanvas.width * scaleFactor;
  let h = paintCanvas.height * scaleFactor;
  let x = (width - w) / 2;
  let y = (height - h) / 2;

  image(paintCanvas, x, y, w, h);

  // Draw timeline guides OVER the canvas if in timeline mode
  if (currentMode === 5) {
    drawTimelineLaneGuides(x, y, scaleFactor);

    // Update metronome if enabled and recording
    if (metronomeEnabled && timelineRecording) {
      updateMetronome();
    }
  }

  // Update and draw particles (visual feedback)
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display(x, y, scaleFactor);
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // Limit particle count for performance
  const MAX_PARTICLES = 50;
  while (particles.length > MAX_PARTICLES) {
    particles.shift(); // Remove oldest
  }

  // Show mouse drum indicator when mouse testing is active (and either no MIDI or mouse mode explicitly enabled)
  if (mouseTestEnabled && (!midiReady || mouseTestEnabled) && mouseX > 0 && mouseY > 0) {
    drawMouseIndicator();
  }

  // Notification flash
  if (notificationAlpha > 0) {
    drawNotification();
    notificationAlpha -= 5; // Fade out
  }

  // Help overlay
  if (showHelp) {
    drawHelpOverlay();
  }

  // UI
  if (showUI) {
    updateUIStatus();
  }
}

// ===== NOTIFICATION SYSTEM =====

function showNotification(text) {
  notificationText = text;
  notificationAlpha = 255;
}

function drawNotification() {
  push();

  // Center text
  textAlign(CENTER, CENTER);
  textSize(48);
  textStyle(BOLD);

  // Background shadow
  fill(0, 0, 0, notificationAlpha * 0.7);
  text(notificationText, width / 2 + 3, height / 2 + 3);

  // Main text
  fill(255, 255, 255, notificationAlpha);
  text(notificationText, width / 2, height / 2);

  pop();
}

// ===== HELP OVERLAY =====

function drawHelpOverlay() {
  push();

  // Semi-transparent background
  fill(0, 0, 0, 220);
  noStroke();
  rect(0, 0, width, height);

  // Help panel
  let panelWidth = min(600, width - 40);
  let panelHeight = min(550, height - 40);
  let panelX = (width - panelWidth) / 2;
  let panelY = (height - panelHeight) / 2;

  fill(255, 255, 255, 250);
  rect(panelX, panelY, panelWidth, panelHeight, 10);

  // Title
  fill(0);
  textAlign(CENTER, TOP);
  textSize(24);
  textStyle(BOLD);
  text('🥁 DRUM PAINTER - CONTROLS', width / 2, panelY + 20);

  // Content
  textAlign(LEFT, TOP);
  textSize(14);
  textStyle(NORMAL);
  let x = panelX + 30;
  let y = panelY + 70;
  let lineHeight = 25;
  let col1 = x;
  let col2 = x + 200;

  // Painting Controls
  fill(100, 50, 150);
  textStyle(BOLD);
  text('PAINTING MODES:', col1, y);
  y += lineHeight + 5;

  fill(0);
  textStyle(NORMAL);
  text('1-6', col1, y);
  text('Switch painting modes (Classic, Fibonacci, Timeline...)', col2, y);
  y += lineHeight;

  // Canvas Controls
  y += 10;
  fill(100, 50, 150);
  textStyle(BOLD);
  text('CANVAS:', col1, y);
  y += lineHeight + 5;

  fill(0);
  textStyle(NORMAL);
  text('SPACE', col1, y);
  text('Clear canvas', col2, y);
  y += lineHeight;
  text('S', col1, y);
  text('Save painting (PNG)', col2, y);
  y += lineHeight;
  text('Z', col1, y);
  text('Undo (2 levels)', col2, y);
  y += lineHeight;
  text('Y', col1, y);
  text('Redo', col2, y);
  y += lineHeight;

  // Visual Controls
  y += 10;
  fill(100, 50, 150);
  textStyle(BOLD);
  text('VISUAL EFFECTS:', col1, y);
  y += lineHeight + 5;

  fill(0);
  textStyle(NORMAL);
  text('B', col1, y);
  text('Cycle blend modes (Normal, Multiply, etc.)', col2, y);
  y += lineHeight;
  text('G', col1, y);
  text('Change background color (White, Black, etc.)', col2, y);
  y += lineHeight;
  text('+ / -', col1, y);
  text('Adjust brush size (30% - 300%)', col2, y);
  y += lineHeight;
  text('H', col1, y);
  text('Hide/show UI panel', col2, y);
  y += lineHeight;

  // Mouse Testing
  y += 10;
  fill(100, 50, 150);
  textStyle(BOLD);
  text('MOUSE TESTING:', col1, y);
  y += lineHeight + 5;

  fill(0);
  textStyle(NORMAL);
  text('M', col1, y);
  text('Toggle mouse mode on/off', col2, y);
  y += lineHeight;
  text('[ ]', col1, y);
  text('Change drum (9 drums available)', col2, y);
  y += lineHeight;
  text('Click/Drag', col1, y);
  text('Paint with mouse (velocity-sensitive)', col2, y);
  y += lineHeight;

  // Footer
  y = panelY + panelHeight - 35;
  fill(150);
  textAlign(CENTER, TOP);
  textSize(12);
  text('Press ? to close this help | Press ESC to toggle help & UI', width / 2, y);

  pop();
}

// ===== MIDI SETUP =====

function setupMIDI() {
  // Set a timeout to fallback to mouse mode if MIDI doesn't respond
  let midiTimeout = setTimeout(() => {
    if (!midiReady && midiStatusEl) {
      console.warn('MIDI setup timed out - Enabling mouse mode');
      mouseTestEnabled = true; // Enable mouse mode on timeout
      midiStatusEl.textContent = 'Mouse Mode: Active (MIDI timeout)';
      midiStatusEl.className = 'status mouse-mode';
    }
  }, 2000); // 2 second timeout

  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess()
      .then((midi) => {
        clearTimeout(midiTimeout);
        onMIDISuccess(midi);
      })
      .catch((error) => {
        clearTimeout(midiTimeout);
        onMIDIFailure(error);
      });
  } else {
    clearTimeout(midiTimeout);
    console.error('WebMIDI not supported in this browser - Enabling mouse mode');
    mouseTestEnabled = true; // Enable mouse mode when WebMIDI not supported
    if (midiStatusEl) {
      midiStatusEl.textContent = 'Mouse Mode: Active (WebMIDI not supported)';
      midiStatusEl.className = 'status mouse-mode';
    }
  }
}

function onMIDISuccess(midi) {
  console.log('✓ MIDI Access granted');

  // List available inputs
  const inputs = Array.from(midi.inputs.values());
  console.log('Available MIDI inputs:', inputs.map(i => i.name));

  if (inputs.length === 0) {
    console.warn('No MIDI devices found - Enabling mouse mode');
    mouseTestEnabled = true; // Enable mouse mode when no MIDI devices
    if (midiStatusEl) {
      midiStatusEl.textContent = 'Mouse Mode: Active (no MIDI devices)';
      midiStatusEl.className = 'status mouse-mode';
    }
    return;
  }

  // Connect to first input (or all inputs)
  inputs.forEach(input => {
    input.onmidimessage = handleMIDIMessage;
    console.log(`Connected to: ${input.name}`);
  });

  midiReady = true;
  if (midiStatusEl) {
    midiStatusEl.textContent = 'MIDI: Connected ✓';
    midiStatusEl.className = 'status connected';
  }
}

function onMIDIFailure(error) {
  console.error('MIDI Access failed:', error);
  mouseTestEnabled = true; // Enable mouse mode when MIDI fails
  if (midiStatusEl) {
    midiStatusEl.textContent = 'Mouse Mode: Active (MIDI failed)';
    midiStatusEl.className = 'status mouse-mode';
  }
}

function handleMIDIMessage(message) {
  try {
    const [command, note, velocity] = message.data;

    // Debug: Log ALL MIDI messages (temporarily)
    console.log(`MIDI: command=${command}, data1=${note}, data2=${velocity}`);

    // Note On message (144) with velocity > 0
    if (command === 144 && velocity > 0) {
      // Handle MIDI learn mode
      if (midiLearnMode && midiLearnDrumId) {
        drumSettings[midiLearnDrumId].midiNote = note;
        console.log(`MIDI Learn: Assigned note ${note} to ${midiLearnDrumId}`);

        // Update just the input field instead of rebuilding entire UI
        const inputEl = document.querySelector(`#drum-${midiLearnDrumId}-content input[type="number"]`);
        if (inputEl) {
          inputEl.value = note;
        }

        // Exit learn mode
        midiLearnMode = false;
        midiLearnDrumId = null;
        return;
      }

      // Normal painting - use full velocity range (0-100%)
      const vel = map(velocity, 0, 127, 0.0, 1.0);
      paintDrum(note, vel);
    }

    // CC messages (176-191 for channels 1-16)
    if (command >= 176 && command <= 191) {
      const ccNumber = note; // Second byte is CC number
      const ccValue = velocity; // Third byte is CC value (0-127)

      // Handle CC learn mode with calibration
      if (ccLearnMode && ccLearnDrumId && ccLearnParameter) {
        // Collect CC values for calibration (first message starts the timer)
        if (ccLearnCalibrationValues.length === 0) {
          ccLearnStartTime = millis();
          console.log(`CC Calibration: Move controller through FULL range for 3 seconds...`);
        }

        ccLearnCalibrationValues.push(ccValue);

        // After 3 seconds, calculate min/max and assign
        const elapsed = millis() - ccLearnStartTime;
        if (elapsed >= 3000) {
          const ccMin = Math.min(...ccLearnCalibrationValues);
          const ccMax = Math.max(...ccLearnCalibrationValues);

          drumSettings[ccLearnDrumId].midiCC[ccLearnParameter].cc = ccNumber;
          drumSettings[ccLearnDrumId].midiCC[ccLearnParameter].ccMin = ccMin;
          drumSettings[ccLearnDrumId].midiCC[ccLearnParameter].ccMax = ccMax;

          console.log(`CC Learn Complete: CC ${ccNumber} assigned to ${ccLearnDrumId}.${ccLearnParameter}`);
          console.log(`  Detected range: ${ccMin}-${ccMax} (${ccMax === 127 ? 'full range' : 'limited range'})`);

          // Exit learn mode
          ccLearnMode = false;
          ccLearnDrumId = null;
          ccLearnParameter = null;
          ccLearnCalibrationValues = [];

          // Rebuild UI to show the new CC mapping
          buildDrumSettingsUI();
          return;
        }
      }

      // Normal CC processing - find which drum/parameter uses this CC
      handleCCValue(ccNumber, ccValue);
    }

    // Pitch Bend messages (224-239 for channels 1-16) - KeyLab faders send these!
    if (command >= 224 && command <= 239) {
      // Pitch bend is 14-bit: combine LSB (note) and MSB (velocity)
      const pitchBendValue = (velocity * 128) + note; // 0-16383
      const normalizedValue = pitchBendValue / 16383; // 0.0-1.0
      const ccValue = Math.round(normalizedValue * 127); // Convert to 0-127 like CC

      const channel = command - 224 + 1; // MIDI channel 1-16
      const pseudoCC = 1000 + channel; // Use 1001-1016 as "CC numbers" for pitch bend

      // Handle CC learn mode with calibration (treat pitch bend like a CC)
      if (ccLearnMode && ccLearnDrumId && ccLearnParameter) {
        // Collect pitch bend values for calibration (first message starts the timer)
        if (ccLearnCalibrationValues.length === 0) {
          ccLearnStartTime = millis();
          console.log(`Pitch Bend Calibration: Move fader through FULL range for 3 seconds...`);
        }

        ccLearnCalibrationValues.push(ccValue);

        // After 3 seconds, calculate min/max and assign
        const elapsed = millis() - ccLearnStartTime;
        if (elapsed >= 3000) {
          const ccMin = Math.min(...ccLearnCalibrationValues);
          const ccMax = Math.max(...ccLearnCalibrationValues);

          drumSettings[ccLearnDrumId].midiCC[ccLearnParameter].cc = pseudoCC;
          drumSettings[ccLearnDrumId].midiCC[ccLearnParameter].ccMin = ccMin;
          drumSettings[ccLearnDrumId].midiCC[ccLearnParameter].ccMax = ccMax;

          console.log(`Pitch Bend Learn Complete: Pitch Bend (ch${channel}) assigned to ${ccLearnDrumId}.${ccLearnParameter}`);
          console.log(`  Detected range: ${ccMin}-${ccMax}`);

          // Exit learn mode
          ccLearnMode = false;
          ccLearnDrumId = null;
          ccLearnParameter = null;
          ccLearnCalibrationValues = [];

          // Rebuild UI to show the new CC mapping
          buildDrumSettingsUI();
          return;
        }
      }

      // Normal pitch bend processing - treat like CC
      handleCCValue(pseudoCC, ccValue);
    }

    // Optional: log for debugging
    // console.log(`MIDI: ${command} ${note} ${velocity}`);
  } catch (error) {
    console.error('Error handling MIDI message:', error);
  }
}

// ===== MIDI CC VALUE HANDLING =====

function handleCCValue(ccNumber, ccValue) {
  // Search through all drums to find which parameter uses this CC number
  let foundCount = 0;

  for (const drum of DRUM_KIT_CONFIG) {
    const drumId = drum.id;
    const settings = drumSettings[drumId];
    if (!settings || !settings.midiCC) continue;

    const ccParams = settings.midiCC;
    const parameters = ['size', 'opacity', 'hueVariation', 'rotation', 'strokeWeight'];

    for (const param of parameters) {
      if (ccParams[param].cc === ccNumber) {
        foundCount++;

        // Log warning if duplicate CC mapping found
        if (foundCount > 1) {
          console.warn(`⚠️ DUPLICATE: CC ${ccNumber} is mapped to multiple parameters!`);
        }
        // Map CC value using detected range (ccMin-ccMax) to slider display range (min-max)
        const ccMin = ccParams[param].ccMin || 0;
        const ccMax = ccParams[param].ccMax || 127;
        const normalizedValue = (ccValue - ccMin) / (ccMax - ccMin);
        const min = ccParams[param].min;
        const max = ccParams[param].max;
        const sliderValue = min + normalizedValue * (max - min);

        // Debug: Log the actual ranges being used
        console.log(`CC ${ccNumber} for ${drumId}.${param}: CC range=${ccMin}-${ccMax}, slider range=${min}-${max}, CC value=${ccValue}, mapped=${sliderValue.toFixed(1)}`);

        // Update the actual parameter and slider (convert slider value to internal value)
        if (param === 'size') {
          const sizePercent = Math.round(sliderValue);
          drumSettings[drumId].size = sliderValue / 100; // Convert 30-300 to 0.3-3.0
          const sliderEl = document.querySelector(`input[oninput*="size-${drumId}"]`);
          const displayEl = document.getElementById(`size-${drumId}`);
          if (sliderEl) sliderEl.value = sizePercent;
          if (displayEl) displayEl.textContent = sizePercent + '%';
        } else if (param === 'opacity') {
          const opacityPercent = Math.round(sliderValue);
          drumSettings[drumId].opacity = sliderValue / 100; // Convert 10-100 to 0.1-1.0
          const sliderEl = document.querySelector(`input[oninput*="opacity-${drumId}"]`);
          const displayEl = document.getElementById(`opacity-${drumId}`);
          if (sliderEl) sliderEl.value = opacityPercent;
          if (displayEl) displayEl.textContent = opacityPercent + '%';
        } else if (param === 'hueVariation') {
          drumSettings[drumId].hueVariation = Math.round(sliderValue);
          const sliderEl = document.querySelector(`input[oninput*="huevar-${drumId}"]`);
          const displayEl = document.getElementById(`huevar-${drumId}`);
          if (sliderEl) sliderEl.value = Math.round(sliderValue);
          if (displayEl) displayEl.textContent = Math.round(sliderValue) + '°';
        } else if (param === 'rotation') {
          drumSettings[drumId].rotation = Math.round(sliderValue);
          const sliderEl = document.querySelector(`input[oninput*="rotation-${drumId}"]`);
          const displayEl = document.getElementById(`rotation-${drumId}`);
          if (sliderEl) sliderEl.value = Math.round(sliderValue);
          if (displayEl) displayEl.textContent = Math.round(sliderValue) + '°';
        } else if (param === 'strokeWeight') {
          drumSettings[drumId].strokeWeight = Math.round(sliderValue);
          const sliderEl = document.getElementById(`strokeweight-slider-${drumId}`);
          const displayEl = document.getElementById(`strokeweight-${drumId}`);
          if (sliderEl) sliderEl.value = Math.round(sliderValue);
          if (displayEl) displayEl.textContent = Math.round(sliderValue) + 'px';
        }

        // Update preview
        updateDrumPreview(drumId);

        // Log for debugging
        console.log(`CC ${ccNumber} -> ${drumId}.${param} = ${sliderValue.toFixed(1)} (internal: ${drumSettings[drumId][param]})`);
        return; // Found and processed, exit
      }
    }
  }
}

// ===== MAIN PAINTING ROUTER =====

function paintDrum(note, velocity) {
  try {
    // Track velocity and calculate approximate dot size for UI display
    lastVelocity = velocity;

    // Get drum settings for size calculation
    const drumId = findDrumByMidiNote(note);
    const settings = drumSettings[drumId];
    const scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || SCALING_CURVES.LINEAR);

    // Calculate approximate size based on current mode
    let baseSize, velocityMult;
    switch (currentMode) {
      case 0: baseSize = BASE_SIZE_CLASSIC; velocityMult = VELOCITY_MULT_CLASSIC; break;
      case 1: baseSize = BASE_SIZE_FIBONACCI; velocityMult = VELOCITY_MULT_FIBONACCI; break;
      case 2: baseSize = BASE_SIZE_SYMMETRY; velocityMult = VELOCITY_MULT_SYMMETRY; break;
      case 3: baseSize = BASE_SIZE_GRAVITY; velocityMult = VELOCITY_MULT_GRAVITY; break;
      case 4: baseSize = BASE_SIZE_ORGANIC; velocityMult = VELOCITY_MULT_ORGANIC; break;
      case 5: baseSize = 8; velocityMult = 15; break; // Timeline mode
      default: baseSize = 10; velocityMult = 20;
    }

    lastDotSize = Math.round(
      (baseSize + scaledVelSize * velocityMult) *
      globalSizeMultiplier *
      getDrumSize(note)
    );

    updateUIStatus(); // Update UI to show velocity and size

    switch (currentMode) {
      case 0:
        paintClassic(note, velocity);
        break;
      case 1:
        paintFibonacci(note, velocity);
        break;
      case 2:
        paintSymmetry(note, velocity);
        break;
      case 3:
        paintGravity(note, velocity);
        break;
      case 4:
        paintOrganic(note, velocity);
        break;
      case 5:
        paintTimeline(note, velocity);
        break;
      default:
        console.warn(`Unknown mode: ${currentMode}`);
        return;
    }
    strokeCount++;

    // Save canvas state every 10 strokes for undo/redo
    if (strokeCount % 10 === 0) {
      saveCanvasState();
    }
  } catch (error) {
    console.error('Error painting:', error);
  }
}

// ===== MODE 0: CLASSIC POINTILLISM =====

function paintClassic(note, velocity) {
  let x = random(paintCanvas.width);
  let y = random(paintCanvas.height);

  // Get drum settings
  const drumId = findDrumByMidiNote(note);
  const settings = drumSettings[drumId];

  // Apply scaling curves to velocity-based values
  let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || SCALING_CURVES.LINEAR);
  let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || SCALING_CURVES.LINEAR);

  // CC values are already in the settings (no multiplication needed)
  let size = (BASE_SIZE_CLASSIC + scaledVelSize * VELOCITY_MULT_CLASSIC) * globalSizeMultiplier * getDrumSize(note);
  let col = getDrumColor(note, scaledVelOpacity);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);
  let stroke = getDrumStroke(note);
  let rotation = getDrumRotation(note);

  paintCanvas.push();
  paintDot(x, y, size, col, ALPHA_CLASSIC * scaledVelOpacity * opacityMult, shape, stroke, rotation);
  paintCanvas.pop();

  particles.push(new Particle(x, y, size, col));
}

// ===== MODE 1: FIBONACCI SPIRAL =====

function paintFibonacci(note, velocity) {
  const goldenAngle = PI * (3 - sqrt(5)); // ~137.5 degrees
  spiralAngle += goldenAngle;

  // Get drum settings
  const drumId = findDrumByMidiNote(note);
  const settings = drumSettings[drumId];

  // Apply scaling curves
  let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || SCALING_CURVES.LINEAR);
  let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || SCALING_CURVES.LINEAR);

  let radius = sqrt(strokeCount) * FIBONACCI_RADIUS_MULT;
  let x = paintCanvas.width / 2 + cos(spiralAngle) * radius;
  let y = paintCanvas.height / 2 + sin(spiralAngle) * radius;
  let size = (BASE_SIZE_FIBONACCI + scaledVelSize * VELOCITY_MULT_FIBONACCI) * globalSizeMultiplier * getDrumSize(note);

  // Keep within bounds
  x = constrain(x, 0, paintCanvas.width);
  y = constrain(y, 0, paintCanvas.height);

  let col = getDrumColor(note, scaledVelOpacity);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);
  let stroke = getDrumStroke(note);
  let rotation = getDrumRotation(note);

  paintCanvas.push();
  paintDot(x, y, size, col, ALPHA_FIBONACCI * scaledVelOpacity * opacityMult, shape, stroke, rotation);
  paintCanvas.pop();

  particles.push(new Particle(x, y, size, col));
}

// ===== MODE 2: RADIAL SYMMETRY =====

function paintSymmetry(note, velocity) {
  // Get drum settings
  const drumId = findDrumByMidiNote(note);
  const settings = drumSettings[drumId];

  // Apply scaling curves
  let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || SCALING_CURVES.LINEAR);
  let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || SCALING_CURVES.LINEAR);

  let angle = random(TWO_PI / SYMMETRY_ORDER);
  let radius = random(SYMMETRY_RADIUS_MIN, SYMMETRY_RADIUS_MAX);
  let size = (BASE_SIZE_SYMMETRY + scaledVelSize * VELOCITY_MULT_SYMMETRY) * globalSizeMultiplier * getDrumSize(note);
  let col = getDrumColor(note, scaledVelOpacity);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);
  let stroke = getDrumStroke(note);
  let rotation = getDrumRotation(note);

  paintCanvas.push();

  for (let i = 0; i < SYMMETRY_ORDER; i++) {
    let a = angle + (TWO_PI / SYMMETRY_ORDER) * i;
    let x = paintCanvas.width / 2 + cos(a) * radius;
    let y = paintCanvas.height / 2 + sin(a) * radius;

    paintDot(x, y, size, col, ALPHA_SYMMETRY * scaledVelOpacity * opacityMult, shape, stroke, rotation);

    if (i === 0) {
      particles.push(new Particle(x, y, size, col));
    }
  }
  paintCanvas.pop();
}

// ===== MODE 3: GRAVITY FIELD =====

function paintGravity(note, velocity) {
  // Get drum settings
  const drumId = findDrumByMidiNote(note);
  const settings = drumSettings[drumId];

  // Apply scaling curves
  let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || SCALING_CURVES.LINEAR);
  let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || SCALING_CURVES.LINEAR);

  let x = random(paintCanvas.width);
  let y = random(paintCanvas.height * 0.3);
  let size = (BASE_SIZE_GRAVITY + scaledVelSize * VELOCITY_MULT_GRAVITY) * globalSizeMultiplier * getDrumSize(note);
  let col = getDrumColor(note, scaledVelOpacity);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);
  let stroke = getDrumStroke(note);
  let rotation = getDrumRotation(note);

  paintCanvas.push();

  let steps = floor(GRAVITY_STEPS_BASE + scaledVelOpacity * GRAVITY_STEPS_MULT);
  for (let i = 0; i < steps; i++) {
    y += random(GRAVITY_STEP_MIN, GRAVITY_STEP_MAX);
    x += random(GRAVITY_DRIFT_MIN, GRAVITY_DRIFT_MAX);

    let alpha = map(i, 0, steps, ALPHA_GRAVITY * scaledVelOpacity * opacityMult, ALPHA_GRAVITY_MIN * scaledVelOpacity * opacityMult);
    paintDot(x, y, size, col, alpha, shape, stroke, rotation);

    if (y > paintCanvas.height) break;
  }
  paintCanvas.pop();

  particles.push(new Particle(x, y, size, col));
}

// ===== MODE 4: ORGANIC GROWTH =====

function paintOrganic(note, velocity) {
  // Get drum settings
  const drumId = findDrumByMidiNote(note);
  const settings = drumSettings[drumId];

  // Apply scaling curves
  let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || SCALING_CURVES.LINEAR);
  let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || SCALING_CURVES.LINEAR);

  // Find nearest growth point
  let testPos = createVector(random(paintCanvas.width), random(paintCanvas.height));
  let nearest = growthPoints[0];
  let minDist = Infinity;

  for (let gp of growthPoints) {
    let d = p5.Vector.dist(testPos, gp);
    if (d < minDist) {
      minDist = d;
      nearest = gp;
    }
  }

  // Paint near growth point
  let angle = random(TWO_PI);
  let distance = randomGaussian() * ORGANIC_DISTANCE_SPREAD + ORGANIC_DISTANCE_BASE;
  let x = nearest.x + cos(angle) * distance;
  let y = nearest.y + sin(angle) * distance;
  let size = (BASE_SIZE_ORGANIC + scaledVelSize * VELOCITY_MULT_ORGANIC) * globalSizeMultiplier * getDrumSize(note);

  x = constrain(x, 0, paintCanvas.width);
  y = constrain(y, 0, paintCanvas.height);

  let col = getDrumColor(note, scaledVelOpacity);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);
  let stroke = getDrumStroke(note);
  let rotation = getDrumRotation(note);

  paintCanvas.push();
  paintDot(x, y, size, col, ALPHA_ORGANIC * scaledVelOpacity * opacityMult, shape, stroke, rotation);
  paintCanvas.pop();

  // Occasionally move growth point
  if (random(1) < ORGANIC_MOVE_PROBABILITY) {
    nearest.x += random(-ORGANIC_MOVE_RANGE, ORGANIC_MOVE_RANGE);
    nearest.y += random(-ORGANIC_MOVE_RANGE, ORGANIC_MOVE_RANGE);

    // Keep growth points within canvas with margin
    const margin = 50;
    nearest.x = constrain(nearest.x, margin, paintCanvas.width - margin);
    nearest.y = constrain(nearest.y, margin, paintCanvas.height - margin);
  }

  particles.push(new Particle(x, y, size, col));
}

// ===== MODE 5: TIMELINE/SEQUENCER =====

function paintTimeline(note, velocity) {
  // Find which drum this is
  const drumId = findDrumByMidiNote(note);
  if (!drumId || !(drumId in TIMELINE_LANES)) {
    console.warn(`Drum ${note} not mapped to timeline lane`);
    return;
  }

  // Don't paint if timeline is not recording
  if (!timelineRecording) {
    console.log('Timeline not recording - press Start button first');
    return;
  }

  // Initialize start time on first note after starting recording
  const currentTime = millis();
  if (timelineStartTime === null) {
    timelineStartTime = currentTime;
  }

  // Calculate time elapsed in seconds (excluding paused time)
  // Subtract MIDI latency compensation to align notes with grid
  const timeElapsed = (currentTime - timelineStartTime - timelinePausedTime - midiLatencyMs) / 1000.0;

  // Calculate x position based on time
  const totalX = timeElapsed * timelinePixelsPerSecond;

  // Calculate which staff (row) this belongs to based on wrapping
  const staffIndex = floor(totalX / staffWidth);
  const xInStaff = totalX % staffWidth;

  // Calculate y position within the staff
  const laneIndex = TIMELINE_LANES[drumId];
  const staffY = staffIndex * staffHeight;
  const laneY = staffY + (laneIndex * drumLineSpacing) + drumLineSpacing;

  // Ensure paintCanvas is tall enough for this staff
  const requiredHeight = (staffIndex + 1) * staffHeight + 100;
  if (paintCanvas.height < requiredHeight) {
    // Resize canvas - save current content, resize, restore
    let tempImg = paintCanvas.get();
    paintCanvas.resizeCanvas(paintCanvas.width, requiredHeight);
    paintCanvas.image(tempImg, 0, 0);
  }

  // Get drum settings and apply scaling
  const settings = drumSettings[drumId];

  let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || SCALING_CURVES.LINEAR);
  let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || SCALING_CURVES.LINEAR);

  let col = getDrumColor(note, scaledVelOpacity);
  let shape = getDrumShape(note);
  let sizeMultiplier = getDrumSize(note);
  let opacityMult = getDrumOpacity(note);
  let stroke = getDrumStroke(note);
  let rotation = getDrumRotation(note);

  // Size based on velocity
  let size = (8 + scaledVelSize * 15) * sizeMultiplier;
  let alpha = 200 * scaledVelOpacity * opacityMult;

  paintCanvas.push();
  paintDot(xInStaff, laneY, size, col, alpha, shape, stroke, rotation);
  paintCanvas.pop();

  // Visual feedback particle
  particles.push(new Particle(xInStaff, laneY, size, col));
}

/**
 * Draw timeline lane guides (called from draw loop when in timeline mode)
 * @param {number} offsetX - X offset of the canvas on screen
 * @param {number} offsetY - Y offset of the canvas on screen
 * @param {number} scale - Scale factor of the canvas
 */
function drawTimelineLaneGuides(offsetX, offsetY, scale) {
  push();

  // IMPORTANT: Ensure we're in RGB mode for correct color rendering
  colorMode(RGB, 255);

  // Calculate beat/measure metrics
  const secondsPerBeat = 60 / timelineBPM;
  const pixelsPerBeat = secondsPerBeat * timelinePixelsPerSecond;
  const pixelsPerMeasure = pixelsPerBeat * 4; // 4 beats per measure (4/4 time)
  const secondsPerSubdivision = secondsPerBeat / (timelineSubdivision / 4);
  const pixelsPerSubdivision = secondsPerSubdivision * timelinePixelsPerSecond;

  // Calculate how many complete measures fit in the canvas width (with margin)
  const maxStaffWidth = paintCanvas.width - 100; // Leave margin for labels
  measuresPerStaff = Math.max(1, Math.floor(maxStaffWidth / pixelsPerMeasure));

  // Calculate staff width to fit exact number of measures
  staffWidth = measuresPerStaff * pixelsPerMeasure;

  // Calculate how many staffs we need to show
  const currentTime = millis();
  let timeElapsed = 0;
  if (timelineStartTime !== null) {
    if (timelineRecording) {
      // Currently recording - use current time
      timeElapsed = (currentTime - timelineStartTime - timelinePausedTime) / 1000.0;
    } else if (timelineStopTime !== null) {
      // Stopped - freeze at stop time
      timeElapsed = (timelineStopTime - timelineStartTime - timelinePausedTime) / 1000.0;
    }
  }
  const totalX = timeElapsed * timelinePixelsPerSecond;
  const maxStaffs = max(1, ceil(totalX / staffWidth) + 1);
  const maxStaffsToShow = min(maxStaffs, floor(paintCanvas.height / staffHeight) + 1);

  // Draw staffs
  for (let staffIdx = 0; staffIdx < maxStaffsToShow; staffIdx++) {
    const staffY = staffIdx * staffHeight;

    // Draw horizontal staff lines for each drum
    stroke(200, 200, 200, 120);
    strokeWeight(1);

    for (let i = 0; i < TIMELINE_LANE_COUNT; i++) {
      let y = (staffY + (i * drumLineSpacing) + drumLineSpacing) * scale + offsetY;
      let x1 = offsetX;
      let x2 = offsetX + staffWidth * scale;
      line(x1, y, x2, y);
    }

    // Draw vertical beat/measure lines based on BPM
    const maxBeats = Math.ceil(staffWidth / pixelsPerBeat);
    const subdivisionsPerBeat = timelineSubdivision / 4; // How many subdivisions in one quarter note

    console.log(`Grid debug: subdivision=${timelineSubdivision}, subdivisionsPerBeat=${subdivisionsPerBeat}, pixelsPerSubdivision=${pixelsPerSubdivision}`);

    // Draw subdivision lines (light grey, visible) - ONLY where they don't overlap with beats
    stroke(190, 190, 190, 200);
    strokeWeight(1);
    let subdivisionCount = 0;
    for (let beat = 0; beat <= maxBeats; beat++) {
      for (let sub = 1; sub < subdivisionsPerBeat; sub++) { // Start at 1 to skip the beat itself
        let xPos = beat * pixelsPerBeat + sub * pixelsPerSubdivision;
        if (xPos <= staffWidth) {
          let x = offsetX + xPos * scale;
          let y1 = offsetY + staffY * scale;
          let y2 = offsetY + (staffY + staffHeight) * scale;
          line(x, y1, x, y2);
          subdivisionCount++;
        }
      }
    }
    console.log(`Drew ${subdivisionCount} subdivision lines for staff ${staffIdx}`);

    // Draw beat lines (medium grey, thicker - for quarter notes)
    stroke(170, 170, 170, 180);
    strokeWeight(1.5);
    for (let beat = 0; beat <= maxBeats; beat++) {
      // Skip beats that fall on measure boundaries (we'll draw those separately)
      if (beat % 4 !== 0) {
        let xPos = beat * pixelsPerBeat;
        if (xPos <= staffWidth) {
          let x = offsetX + xPos * scale;
          let y1 = offsetY + staffY * scale;
          let y2 = offsetY + (staffY + staffHeight) * scale;
          line(x, y1, x, y2);
        }
      }
    }

    // Draw measure lines (darkest, every 4 beats)
    stroke(150, 150, 150, 180);
    strokeWeight(2);
    for (let measure = 0; measure <= maxBeats / 4; measure++) {
      let xPos = measure * pixelsPerBeat * 4;
      if (xPos <= staffWidth) {
        let x = offsetX + xPos * scale;
        let y1 = offsetY + staffY * scale;
        let y2 = offsetY + (staffY + staffHeight) * scale;
        line(x, y1, x, y2);
      }
    }

    // Draw drum labels on left side with matching colors
    noStroke();
    textAlign(LEFT, CENTER);
    textSize(11 * scale);
    textStyle(BOLD);

    // Generate drum info from config
    const drumInfo = DRUM_KIT_CONFIG.map(drum => ({
      name: (drumSettings[drum.id]?.name || drum.name).toUpperCase().substring(0, 6),
      drumId: drum.id
    }));

    drumInfo.forEach((info, i) => {
      let y = (staffY + (i * drumLineSpacing) + drumLineSpacing) * scale + offsetY;

      // Get drum color
      const settings = drumSettings[info.drumId];
      if (settings) {
        let col = color(settings.color);
        let r = red(col);
        let g = green(col);
        let b = blue(col);
        fill(r, g, b, 200);
      } else {
        fill(0, 0, 0, 100);
      }

      text(info.name, offsetX + 5 * scale, y);
    });

    // Draw staff index/measure marker
    textAlign(LEFT, TOP);
    textSize(10 * scale);
    fill(0, 0, 0, 80);
    const startTime = staffIdx * (staffWidth / timelinePixelsPerSecond);
    const startBeat = Math.floor(startTime / secondsPerBeat);
    const startMeasure = Math.floor(startBeat / 4);
    text(`M${startMeasure + 1}`, offsetX + 5 * scale, offsetY + staffY * scale + 5 * scale);
  }

  // Draw playhead line (current time position)
  if (timelineStartTime !== null && totalX > 0) {
    const staffIndex = floor(totalX / staffWidth);
    const xInStaff = totalX % staffWidth;
    const staffY = staffIndex * staffHeight;

    // Red when recording, grey when stopped
    if (timelineRecording) {
      stroke(255, 50, 50, 200);
    } else {
      stroke(100, 100, 100, 150);
    }
    strokeWeight(3);
    let x = offsetX + xInStaff * scale;
    let y1 = offsetY + staffY * scale;
    let y2 = offsetY + (staffY + staffHeight) * scale;
    line(x, y1, x, y2);
  }

  pop();
}

// ===== UTILITY FUNCTIONS =====

/**
 * Helper function to paint a dot on the canvas
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Circle size
 * @param {p5.Color} col - Color object
 * @param {number} alpha - Alpha/opacity value
 * @param {string} shape - Shape type ('circle', 'square', etc.)
 * @param {object} stroke - Stroke settings {enabled, weight, color}
 * @param {number} rotation - Rotation angle in degrees
 */
function paintDot(x, y, size, col, alpha, shape = 'circle', stroke = null, rotation = 0) {
  let r = red(col), g = green(col), b = blue(col);
  paintCanvas.fill(r, g, b, alpha);

  // Apply stroke if enabled
  if (stroke && stroke.enabled) {
    let sr = parseInt(stroke.color.slice(1, 3), 16);
    let sg = parseInt(stroke.color.slice(3, 5), 16);
    let sb = parseInt(stroke.color.slice(5, 7), 16);
    paintCanvas.stroke(sr, sg, sb);
    paintCanvas.strokeWeight(stroke.weight);
  } else {
    paintCanvas.noStroke();
  }

  // Apply rotation for non-circular shapes
  if (rotation !== 0 && shape !== 'circle') {
    paintCanvas.push();
    paintCanvas.translate(x, y);
    paintCanvas.rotate(radians(rotation));

    switch (shape) {
      case 'square':
        paintCanvas.rectMode(CENTER);
        paintCanvas.square(0, 0, size);
        break;
      case 'triangle':
        let h = size * 0.866;
        paintCanvas.triangle(0, -size / 2, -size / 2, h / 2, size / 2, h / 2);
        break;
      case 'diamond':
        paintCanvas.quad(0, -size / 2, size / 2, 0, 0, size / 2, -size / 2, 0);
        break;
      case 'star':
        drawStar(paintCanvas, 0, 0, size / 3, size / 2, 5);
        break;
      case 'hexagon':
        drawHexagon(paintCanvas, 0, 0, size / 2);
        break;
      default:
        paintCanvas.circle(0, 0, size);
    }

    paintCanvas.pop();
  } else {
    // No rotation or circle (rotation doesn't affect circles)
    switch (shape) {
      case 'circle':
        paintCanvas.circle(x, y, size);
        break;
      case 'square':
        paintCanvas.rectMode(CENTER);
        paintCanvas.square(x, y, size);
        break;
      case 'triangle':
        let h = size * 0.866;
        paintCanvas.triangle(x, y - size / 2, x - size / 2, y + h / 2, x + size / 2, y + h / 2);
        break;
      case 'diamond':
        paintCanvas.quad(x, y - size / 2, x + size / 2, y, x, y + size / 2, x - size / 2, y);
        break;
      case 'star':
        drawStar(paintCanvas, x, y, size / 3, size / 2, 5);
        break;
      case 'hexagon':
        drawHexagon(paintCanvas, x, y, size / 2);
        break;
      default:
        paintCanvas.circle(x, y, size);
    }
  }
}

function drawStar(canvas, x, y, radius1, radius2, npoints) {
  let angle = TWO_PI / npoints;
  let halfAngle = angle / 2.0;
  canvas.beginShape();
  for (let a = -PI / 2; a < TWO_PI - PI / 2; a += angle) {
    let sx = x + cos(a) * radius2;
    let sy = y + sin(a) * radius2;
    canvas.vertex(sx, sy);
    sx = x + cos(a + halfAngle) * radius1;
    sy = y + sin(a + halfAngle) * radius1;
    canvas.vertex(sx, sy);
  }
  canvas.endShape(CLOSE);
}

function drawHexagon(canvas, x, y, radius) {
  canvas.beginShape();
  for (let i = 0; i < 6; i++) {
    let angle = (TWO_PI / 6) * i - PI / 2;
    let sx = x + cos(angle) * radius;
    let sy = y + sin(angle) * radius;
    canvas.vertex(sx, sy);
  }
  canvas.endShape(CLOSE);
}

/**
 * Reset growth points to random positions on canvas
 */
function resetGrowthPoints() {
  growthPoints = [];
  for (let i = 0; i < GROWTH_POINTS_COUNT; i++) {
    growthPoints.push(createVector(
      random(paintCanvas.width),
      random(paintCanvas.height)
    ));
  }
}

/**
 * Save current canvas state to history
 */
function saveCanvasState() {
  // Remove any states after current index (for branching)
  canvasHistory = canvasHistory.slice(0, historyIndex + 1);

  // Save current canvas as image
  canvasHistory.push(paintCanvas.get());

  // Keep only MAX_HISTORY states
  if (canvasHistory.length > MAX_HISTORY) {
    canvasHistory.shift();
  } else {
    historyIndex++;
  }
}

/**
 * Undo to previous canvas state
 */
function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    paintCanvas.image(canvasHistory[historyIndex], 0, 0);
    console.log(`Undo (${historyIndex + 1}/${canvasHistory.length})`);
  } else {
    console.log('Nothing to undo');
  }
}

/**
 * Redo to next canvas state
 */
function redo() {
  if (historyIndex < canvasHistory.length - 1) {
    historyIndex++;
    paintCanvas.image(canvasHistory[historyIndex], 0, 0);
    console.log(`Redo (${historyIndex + 1}/${canvasHistory.length})`);
  } else {
    console.log('Nothing to redo');
  }
}

/**
 * Draw visual indicator for mouse testing mode
 */
function drawMouseIndicator() {
  const drumId = MOUSE_DRUM_IDS[currentMouseDrum];
  const midiNote = drumSettings[drumId].midiNote;
  let drumColor = getDrumColor(midiNote);
  let r = red(drumColor), g = green(drumColor), b = blue(drumColor);

  push();
  // Draw colored ring around cursor
  noFill();
  stroke(r, g, b, 200);
  strokeWeight(3);
  circle(mouseX, mouseY, 30);

  // Draw smaller filled circle
  fill(r, g, b, 100);
  noStroke();
  circle(mouseX, mouseY, 10);

  // Draw drum name next to cursor
  fill(255);
  stroke(0);
  strokeWeight(4);
  textSize(14);
  textAlign(LEFT, TOP);
  text(MOUSE_DRUM_NAMES[currentMouseDrum], mouseX + 20, mouseY - 10);
  pop();
}

function getDrumColor(note, velocityNorm = 1.0) {
  // Find drum by MIDI note
  const drumId = findDrumByMidiNote(note);
  if (drumId && drumSettings[drumId]) {
    const settings = drumSettings[drumId];
    let col = color(settings.color);

    // Apply hue variation if set (CC already modifies settings.hueVariation)
    if (settings.hueVariation > 0) {
      push();
      colorMode(HSB, 360, 100, 100);
      let h = hue(col);
      let s = saturation(col);
      let b = brightness(col);

      // Apply scaling curve to hue variation based on velocity
      let scaledVariation = applyScalingCurve(velocityNorm, settings.hueScaling || SCALING_CURVES.LINEAR);

      // Add random hue shift (scaled by velocity)
      let maxShift = settings.hueVariation * scaledVariation;
      let hueShift = random(-maxShift, maxShift);
      h = (h + hueShift + 360) % 360; // Keep in 0-360 range

      col = color(h, s, b);
      colorMode(RGB, 255);
      pop();
    }

    return col;
  }
  // Fallback to gray
  return color(150, 150, 150);
}

function getDrumShape(note) {
  const drumId = findDrumByMidiNote(note);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].shape;
  }
  return 'circle';
}

function getDrumOpacity(note) {
  const drumId = findDrumByMidiNote(note);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].opacity;
  }
  return 1.0;
}

function getDrumSize(note) {
  const drumId = findDrumByMidiNote(note);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].size;
  }
  return 1.0;
}

/**
 * Apply scaling curve to a value (0-1 range)
 * @param {number} value - Input value (0-1)
 * @param {string} scaling - Scaling type (linear, log, exp, quad)
 * @returns {number} - Scaled value (0-1)
 */
function applyScalingCurve(value, scaling) {
  value = constrain(value, 0, 1);

  switch (scaling) {
    case SCALING_CURVES.LOGARITHMIC:
      // Log curve: more sensitivity at lower values
      // Using log10(1 + 9x) to map 0->0 and 1->1
      return Math.log10(1 + 9 * value);

    case SCALING_CURVES.EXPONENTIAL:
      // Exponential curve: more sensitivity at higher values
      return Math.pow(value, 2.5);

    case SCALING_CURVES.QUADRATIC:
      // Smooth quadratic curve
      return value * value;

    case SCALING_CURVES.LINEAR:
    default:
      return value;
  }
}

function getDrumStroke(note) {
  const drumId = findDrumByMidiNote(note);
  if (drumId && drumSettings[drumId]) {
    return {
      enabled: drumSettings[drumId].strokeEnabled,
      weight: drumSettings[drumId].strokeWeight,
      color: drumSettings[drumId].strokeColor
    };
  }
  return { enabled: false, weight: 2, color: '#000000' };
}

function getDrumRotation(note) {
  const drumId = findDrumByMidiNote(note);
  if (drumId && drumSettings[drumId]) {
    return drumSettings[drumId].rotation;
  }
  return 0;
}

/**
 * Find which drum ID is mapped to a given MIDI note
 */
function findDrumByMidiNote(midiNote) {
  for (let drumId in drumSettings) {
    if (drumSettings[drumId].midiNote === midiNote) {
      return drumId;
    }
  }
  return null;
}

// ===== PARTICLE CLASS (visual feedback) =====

class Particle {
  constructor(x, y, size, col) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.col = col;
    this.life = PARTICLE_LIFETIME;
  }

  update() {
    this.life--;
  }

  display(offsetX, offsetY, scaleFactor) {
    let alpha = map(this.life, 0, PARTICLE_LIFETIME, 0, 255);
    let x = offsetX + this.x * scaleFactor;
    let y = offsetY + this.y * scaleFactor;
    let s = this.size * scaleFactor * (1 + (PARTICLE_LIFETIME - this.life) * PARTICLE_SIZE_GROWTH);
    let r = red(this.col), g = green(this.col), b = blue(this.col);

    push();
    noFill();
    stroke(r, g, b, alpha);
    strokeWeight(2);
    circle(x, y, s);
    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

// ===== UI & CONTROLS =====

function updateUIStatus() {
  // Update dropdown selections
  if (modeSelectEl) {
    modeSelectEl.value = currentMode;
  }
  if (blendSelectEl) {
    blendSelectEl.value = currentBlendMode;
  }

  // Build additional status text
  if (additionalStatusEl) {
    let statusParts = [];

    // Show strokes, velocity, and dot size
    const velocityPercent = Math.round(lastVelocity * 100);
    statusParts.push(`Strokes: ${strokeCount} | Vel: ${velocityPercent}% | Size: ${lastDotSize}px`);

    // Show brush size if not at 100%
    if (globalSizeMultiplier !== 1.0) {
      statusParts.push(`Size: ${(globalSizeMultiplier * 100).toFixed(0)}%`);
    }

    // Show mouse test info if enabled
    if (mouseTestEnabled) {
      statusParts.push(`Mouse: ${MOUSE_DRUM_NAMES[currentMouseDrum]}`);
    }

    additionalStatusEl.textContent = statusParts.join(' | ');
  }
}

/**
 * Change mode from dropdown selection
 */
function changeModeFromDropdown(mode) {
  if (mode >= 0 && mode <= 5 && mode !== currentMode) {
    currentMode = mode;
    strokeCount = 0;
    spiralAngle = 0;

    // Reset timeline when switching TO timeline mode (mode 5)
    if (currentMode === 5) {
      timelineStartTime = null;
      timelineRecording = false;
      timelinePausedTime = 0;
      updateTimelineControlsVisibility();
      updateTimelineButtonsUI('initial');
    } else {
      // Hide timeline controls when switching away
      updateTimelineControlsVisibility();
    }

    // Only reset growth points when switching TO organic mode (mode 4)
    if (currentMode === 4) {
      resetGrowthPoints();
    }

    showNotification(MODE_NAMES[currentMode]);
    console.log(`Mode: ${MODE_NAMES[currentMode]}`);
  }
}

/**
 * Change blend mode from dropdown selection
 */
function changeBlendModeFromDropdown(blendMode) {
  if (blendMode >= 0 && blendMode < BLEND_MODES.length && blendMode !== currentBlendMode) {
    currentBlendMode = blendMode;
    paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
    showNotification(`Blend: ${BLEND_MODE_NAMES[currentBlendMode]}`);
    console.log(`Blend Mode: ${BLEND_MODE_NAMES[currentBlendMode]}`);
  }
}

function keyPressed() {
  // Ignore keyboard shortcuts if user is typing in an input field
  const activeElement = document.activeElement;
  if (activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.tagName === 'SELECT' ||
    activeElement.isContentEditable
  )) {
    return true; // Allow default behavior for input fields
  }

  if (key === ' ') {
    // Clear canvas
    paintCanvas.background(255);
    strokeCount = 0;
    spiralAngle = 0;
    resetGrowthPoints();
    saveCanvasState();
    console.log('Canvas cleared');
  }

  if (key === 's' || key === 'S') {
    // Save painting
    try {
      let filename = `drum-painting-${MODE_NAMES[currentMode].replace(/\s+/g, '-')}-${Date.now()}.png`;
      paintCanvas.save(filename);
      console.log(`Saved: ${filename}`);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }

  if (key === 'h' || key === 'H') {
    // Toggle UI
    showUI = !showUI;
    if (controlsEl) {
      controlsEl.style.display = showUI ? 'block' : 'none';
    }
  }

  if (key === 'b' || key === 'B') {
    // Cycle blend modes
    currentBlendMode = (currentBlendMode + 1) % BLEND_MODES.length;
    paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
    showNotification(`Blend: ${BLEND_MODE_NAMES[currentBlendMode]}`);
    console.log(`Blend Mode: ${BLEND_MODE_NAMES[currentBlendMode]}`);
  }

  if (key === 'g' || key === 'G') {
    // Cycle background colors
    currentBgColor = (currentBgColor + 1) % BG_COLORS.length;
    paintCanvas.background(BG_COLORS[currentBgColor]);
    saveCanvasState(); // Save after background change
    showNotification(`Background: ${BG_COLOR_NAMES[currentBgColor]}`);
    console.log(`Background: ${BG_COLOR_NAMES[currentBgColor]}`);
  }

  if (key === 'z' || key === 'Z') {
    // Undo
    undo();
  }

  if (key === 'y' || key === 'Y') {
    // Redo
    redo();
  }

  if (key === 'm' || key === 'M') {
    // Toggle mouse test mode
    mouseTestEnabled = !mouseTestEnabled;
    console.log(`Mouse test mode: ${mouseTestEnabled ? 'ON' : 'OFF'}`);

    // Update status if MIDI is connected
    if (midiReady && midiStatusEl) {
      if (mouseTestEnabled) {
        midiStatusEl.textContent = 'MIDI: Connected ✓ | Mouse: Enabled';
      } else {
        midiStatusEl.textContent = 'MIDI: Connected ✓';
      }
    }
  }

  if (key === '[') {
    // Previous drum for mouse testing
    currentMouseDrum = (currentMouseDrum - 1 + MOUSE_DRUM_NAMES.length) % MOUSE_DRUM_NAMES.length;
    console.log(`Mouse drum: ${MOUSE_DRUM_NAMES[currentMouseDrum]}`);
  }

  if (key === ']') {
    // Next drum for mouse testing
    currentMouseDrum = (currentMouseDrum + 1) % MOUSE_DRUM_NAMES.length;
    console.log(`Mouse drum: ${MOUSE_DRUM_NAMES[currentMouseDrum]}`);
  }

  if (key === '?' || key === '/') {
    // Toggle help overlay (? or / key)
    showHelp = !showHelp;
  }

  if (key === '+' || key === '=') {
    // Increase brush size
    globalSizeMultiplier = constrain(globalSizeMultiplier + 0.1, 0.3, 3.0);
    showNotification(`Size: ${(globalSizeMultiplier * 100).toFixed(0)}%`);
    console.log(`Brush size: ${(globalSizeMultiplier * 100).toFixed(0)}%`);
  }

  if (key === '-' || key === '_') {
    // Decrease brush size
    globalSizeMultiplier = constrain(globalSizeMultiplier - 0.1, 0.3, 3.0);
    showNotification(`Size: ${(globalSizeMultiplier * 100).toFixed(0)}%`);
    console.log(`Brush size: ${(globalSizeMultiplier * 100).toFixed(0)}%`);
  }

  if (keyCode === ESCAPE) {
    // ESC toggles both help and UI
    showHelp = !showHelp;
    showUI = !showUI;
    if (controlsEl) {
      controlsEl.style.display = showUI ? 'block' : 'none';
    }
  }

  // Mode switching (1-6)
  if (key >= '1' && key <= '6') {
    currentMode = parseInt(key) - 1;
    strokeCount = 0;
    spiralAngle = 0;

    // Reset timeline when switching TO timeline mode (mode 5)
    if (currentMode === 5) {
      timelineStartTime = null;
      timelineRecording = false;
      timelinePausedTime = 0;
      updateTimelineControlsVisibility();
      updateTimelineButtonsUI('initial');
    } else {
      // Hide timeline controls when switching away
      updateTimelineControlsVisibility();
    }

    // Only reset growth points when switching TO organic mode (mode 4)
    if (currentMode === 4) {
      resetGrowthPoints();
    }

    showNotification(MODE_NAMES[currentMode]);
    console.log(`Mode: ${MODE_NAMES[currentMode]}`);
  }

  return false; // Prevent default browser behavior
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ===== MOUSE PAINTING (for testing without MIDI) =====

function mousePressed() {
  // Don't paint if customization panel is open or dragging controls
  if (showCustomization || window.isDraggingControls) return;

  if (!midiReady || mouseTestEnabled) {
    prevMouseX = mouseX;
    prevMouseY = mouseY;
  }
}

function mouseDragged() {
  // Don't paint if customization panel is open or dragging controls
  if (showCustomization || window.isDraggingControls) return;

  // Allow painting with mouse if no MIDI connected OR if mouse test enabled
  if (!midiReady || mouseTestEnabled) {
    // Calculate velocity based on mouse speed
    let speed = dist(mouseX, mouseY, prevMouseX, prevMouseY);
    let vel = constrain(map(speed, 0, 50, 0.3, 1.0), 0.3, 1.0);

    // Paint with currently selected drum (use its assigned MIDI note)
    const drumId = MOUSE_DRUM_IDS[currentMouseDrum];
    const midiNote = drumSettings[drumId].midiNote;
    paintDrum(midiNote, vel);

    // Update previous position
    prevMouseX = mouseX;
    prevMouseY = mouseY;
  }
}

function mouseClicked() {
  // Don't paint if customization panel is open or dragging controls
  if (showCustomization || window.isDraggingControls) return;

  // Single click for single stroke
  if (!midiReady || mouseTestEnabled) {
    let vel = 0.7; // Medium velocity for clicks
    const drumId = MOUSE_DRUM_IDS[currentMouseDrum];
    const midiNote = drumSettings[drumId].midiNote;
    paintDrum(midiNote, vel);
  }
}

// ===== CUSTOMIZATION PANEL =====

/**
 * Toggle the customization panel visibility
 */
function toggleCustomization() {
  showCustomization = !showCustomization;
  const panel = document.getElementById('customization-panel');
  const backdrop = document.getElementById('customization-backdrop');

  if (showCustomization) {
    buildDrumSettingsUI();
    panel.style.display = 'block';
    backdrop.style.display = 'block';
  } else {
    panel.style.display = 'none';
    backdrop.style.display = 'none';
  }
}

/**
 * Build the drum customization UI dynamically
 */
function buildDrumSettingsUI() {
  const container = document.getElementById('drum-settings-container');
  container.innerHTML = '';

  // Use drums from config (dynamic)
  const drumsToShow = DRUM_KIT_CONFIG.map(drum => ({
    id: drum.id,
    name: drumSettings[drum.id]?.name || drum.name
  }));

  // Create tab navigation
  const tabNav = document.createElement('div');
  tabNav.style.cssText = `
    display: flex;
    gap: 5px;
    margin-bottom: 15px;
    border-bottom: 2px solid #e9ecef;
  `;

  // Create tab content container
  const tabContent = document.createElement('div');
  tabContent.style.cssText = `
    position: relative;
    min-height: 350px;
  `;

  // Create tabs and content for each drum
  drumsToShow.forEach(({ id: drumId, name: drumName }, index) => {
    const settings = drumSettings[drumId];

    // Skip if settings don't exist for this drum
    if (!settings) {
      console.error(`No settings found for drum: ${drumId}`);
      return;
    }

    const isActive = drumId === currentCustomizationTab;

    // Create tab button
    const tabButton = document.createElement('button');
    tabButton.id = `tab-btn-${drumId}`;
    tabButton.style.cssText = `
      flex: 1;
      padding: 10px;
      border: none;
      background: ${isActive ? 'white' : '#f8f9fa'};
      border-top: 3px solid ${isActive ? settings.color : 'transparent'};
      border-radius: 8px 8px 0 0;
      font-weight: ${isActive ? 'bold' : 'normal'};
      cursor: pointer;
      transition: all 0.2s;
      font-size: 13px;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    `;

    // Add color indicator dot
    const colorDot = document.createElement('span');
    colorDot.style.cssText = `
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: ${settings.color};
      display: inline-block;
    `;

    tabButton.appendChild(colorDot);
    tabButton.appendChild(document.createTextNode(drumName));

    tabButton.onmouseover = () => {
      if (!tabButton.classList.contains('active')) {
        tabButton.style.background = '#e9ecef';
      }
    };
    tabButton.onmouseout = () => {
      if (!tabButton.classList.contains('active')) {
        tabButton.style.background = '#f8f9fa';
      }
    };
    tabButton.onclick = () => switchDrumTab(drumId);

    tabNav.appendChild(tabButton);

    // Create tab panel
    const panel = document.createElement('div');
    panel.id = `tab-panel-${drumId}`;
    panel.style.cssText = `
      display: ${isActive ? 'block' : 'none'};
      animation: fadeIn 0.2s;
    `;
    panel.className = isActive ? 'active' : '';

    // Settings content
    const content = document.createElement('div');
    content.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    `;
    content.id = `drum-${drumId}-content`;

    // Drum Name (create programmatically to ensure it's editable)
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = settings.name || drumName;
    nameInput.placeholder = 'Drum name';
    nameInput.spellcheck = false;
    nameInput.disabled = false;
    nameInput.readOnly = false;
    nameInput.tabIndex = 0;
    nameInput.style.cssText = 'width: 100%; padding: 8px; border: 2px solid #ddd; border-radius: 5px; font-size: 13px; cursor: text; pointer-events: auto; user-select: text; -webkit-user-select: text;';

    // Add click handler to focus
    nameInput.addEventListener('click', function(e) {
      e.stopPropagation();
      this.focus();
      console.log('Name input clicked and focused');
    });

    nameInput.addEventListener('focus', function() {
      console.log('Name input focused');
      this.style.borderColor = '#667eea';
    });

    nameInput.addEventListener('blur', function() {
      console.log('Name input blurred, value:', this.value);
      this.style.borderColor = '#ddd';
      updateDrumSetting(drumId, 'name', this.value);
      updateDrumTabLabel(drumId, this.value);
    });

    nameInput.addEventListener('input', function() {
      console.log('Name input changed:', this.value);
    });

    nameInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        this.blur();
      }
    });

    const nameGroup = document.createElement('div');
    nameGroup.style.marginBottom = '12px';
    const nameLabel = document.createElement('label');
    nameLabel.style.cssText = 'display: block; font-size: 12px; color: #666; margin-bottom: 5px; font-weight: 600;';
    nameLabel.textContent = 'Name';
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);

    // MIDI Note selector
    const midiNoteGroup = createSettingGroup('MIDI Note',
      `<div style="display: flex; align-items: center; gap: 10px;">
        <input type="number" min="0" max="127" value="${settings.midiNote}"
          onchange="updateDrumSetting('${drumId}', 'midiNote', parseInt(this.value))"
          style="flex: 1; padding: 8px; border: 2px solid #ddd; border-radius: 5px; font-size: 13px;">
        <button onclick="learnMIDINote('${drumId}')" style="
          padding: 8px 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
        " onmouseover="this.style.background='#5568d3'" onmouseout="this.style.background='#667eea'">Learn</button>
      </div>
      <div style="font-size: 11px; color: #888; margin-top: 4px;">Click "Learn" then hit your drum pad</div>`
    );

    // Color picker (with real-time preview)
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = settings.color;
    colorInput.style.cssText = 'width: 100%; height: 40px; border: 2px solid #ddd; border-radius: 5px; cursor: pointer;';
    colorInput.addEventListener('input', function() {
      // Real-time preview while dragging
      drumSettings[drumId].color = this.value;
      updateDrumPreview(drumId);
      // Update tab color indicator
      const tabBtn = document.getElementById(`tab-btn-${drumId}`);
      if (tabBtn) {
        const colorDot = tabBtn.querySelector('span');
        if (colorDot) colorDot.style.background = this.value;
        if (tabBtn.classList.contains('active')) {
          tabBtn.style.borderTop = `3px solid ${this.value}`;
        }
      }
    });
    colorInput.addEventListener('change', function() {
      // Final update on release
      updateDrumSetting(drumId, 'color', this.value);
    });

    const colorGroup = document.createElement('div');
    colorGroup.style.marginBottom = '12px';
    const colorLabel = document.createElement('label');
    colorLabel.style.cssText = 'display: block; font-size: 12px; color: #666; margin-bottom: 5px; font-weight: 600;';
    colorLabel.textContent = 'Color';
    colorGroup.appendChild(colorLabel);
    colorGroup.appendChild(colorInput);

    // Shape selector
    const shapeOptions = SHAPE_OPTIONS.map(shape =>
      `<option value="${shape}" ${settings.shape === shape ? 'selected' : ''}>${shape.charAt(0).toUpperCase() + shape.slice(1)}</option>`
    ).join('');

    const shapeGroup = createSettingGroup('Shape',
      `<select onchange="updateDrumSetting('${drumId}', 'shape', this.value)"
        style="width: 100%; padding: 8px; border: 2px solid #ddd; border-radius: 5px; font-size: 13px; cursor: pointer;">
        ${shapeOptions}
      </select>`
    );

    // Opacity slider (multiplier with velocity)
    const opacityPercent = Math.round(settings.opacity * 100);
    const opacityGroup = createSettingGroup('Opacity',
      `<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <input type="range" min="10" max="100" value="${opacityPercent}"
          oninput="updateDrumSetting('${drumId}', 'opacity', this.value / 100); document.getElementById('opacity-${drumId}').textContent = this.value + '%';"
          style="flex: 1; min-width: 100px; cursor: pointer;">
        <span id="opacity-${drumId}" style="min-width: 35px; font-weight: bold; color: #666; font-size: 11px;">${opacityPercent}%</span>
        <select onchange="updateDrumSetting('${drumId}', 'opacityScaling', this.value)"
          style="min-width: 65px; padding: 3px; border: 1px solid #ddd; border-radius: 3px; font-size: 10px; cursor: pointer;">
          ${Object.keys(SCALING_CURVES).map(key =>
            `<option value="${SCALING_CURVES[key]}" ${settings.opacityScaling === SCALING_CURVES[key] ? 'selected' : ''}>${SCALING_CURVE_NAMES[SCALING_CURVES[key]]}</option>`
          ).join('')}
        </select>
      </div>`
    );
    opacityGroup.querySelector('div').appendChild(createCCLearnButton(drumId, 'opacity'));

    // Size slider (multiplier with velocity)
    const sizePercent = Math.round(settings.size * 100);
    const sizeGroup = createSettingGroup('Size',
      `<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <input type="range" min="30" max="300" value="${sizePercent}"
          oninput="updateDrumSetting('${drumId}', 'size', this.value / 100); document.getElementById('size-${drumId}').textContent = this.value + '%';"
          style="flex: 1; min-width: 100px; cursor: pointer;">
        <span id="size-${drumId}" style="min-width: 35px; font-weight: bold; color: #666; font-size: 11px;">${sizePercent}%</span>
        <select onchange="updateDrumSetting('${drumId}', 'sizeScaling', this.value)"
          style="min-width: 65px; padding: 3px; border: 1px solid #ddd; border-radius: 3px; font-size: 10px; cursor: pointer;">
          ${Object.keys(SCALING_CURVES).map(key =>
            `<option value="${SCALING_CURVES[key]}" ${settings.sizeScaling === SCALING_CURVES[key] ? 'selected' : ''}>${SCALING_CURVE_NAMES[SCALING_CURVES[key]]}</option>`
          ).join('')}
        </select>
      </div>`
    );
    sizeGroup.querySelector('div').appendChild(createCCLearnButton(drumId, 'size'));

    // Hue variation slider
    const hueVarValue = Math.round(settings.hueVariation);
    const hueVarGroup = createSettingGroup('Hue Variation',
      `<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <input type="range" min="0" max="30" value="${hueVarValue}"
          oninput="updateDrumSetting('${drumId}', 'hueVariation', parseInt(this.value)); document.getElementById('huevar-${drumId}').textContent = this.value + '°';"
          style="flex: 1; min-width: 100px; cursor: pointer;">
        <span id="huevar-${drumId}" style="min-width: 35px; font-weight: bold; color: #666; font-size: 11px;">${hueVarValue}°</span>
        <select onchange="updateDrumSetting('${drumId}', 'hueScaling', this.value)"
          style="min-width: 65px; padding: 3px; border: 1px solid #ddd; border-radius: 3px; font-size: 10px; cursor: pointer;">
          ${Object.keys(SCALING_CURVES).map(key =>
            `<option value="${SCALING_CURVES[key]}" ${settings.hueScaling === SCALING_CURVES[key] ? 'selected' : ''}>${SCALING_CURVE_NAMES[SCALING_CURVES[key]]}</option>`
          ).join('')}
        </select>
      </div>`
    );
    hueVarGroup.querySelector('div').appendChild(createCCLearnButton(drumId, 'hueVariation'));

    // Rotation slider (for non-circular shapes)
    const rotationValue = Math.round(settings.rotation);
    const rotationGroup = createSettingGroup('Rotation',
      `<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <input type="range" min="0" max="360" value="${rotationValue}"
          oninput="updateDrumSetting('${drumId}', 'rotation', parseInt(this.value)); document.getElementById('rotation-${drumId}').textContent = this.value + '°';"
          style="flex: 1; min-width: 100px; cursor: pointer;">
        <span id="rotation-${drumId}" style="min-width: 35px; font-weight: bold; color: #666; font-size: 11px;">${rotationValue}°</span>
      </div>
      <div style="font-size: 11px; color: #888; margin-top: 4px;">Shape rotation (circles not affected)</div>`
    );
    rotationGroup.querySelector('div').appendChild(createCCLearnButton(drumId, 'rotation'));

    // Stroke/Outline controls (with real-time preview)
    const strokeGroup = document.createElement('div');
    strokeGroup.style.marginBottom = '12px';

    const strokeCheckboxLabel = document.createElement('label');
    strokeCheckboxLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;';

    const strokeCheckbox = document.createElement('input');
    strokeCheckbox.type = 'checkbox';
    strokeCheckbox.checked = settings.strokeEnabled;
    strokeCheckbox.style.cursor = 'pointer';
    strokeCheckbox.onchange = function() {
      updateDrumSetting(drumId, 'strokeEnabled', this.checked);
      document.getElementById(`stroke-controls-${drumId}`).style.display = this.checked ? 'block' : 'none';
    };

    const strokeCheckboxText = document.createElement('span');
    strokeCheckboxText.style.cssText = 'font-size: 12px; color: #666; font-weight: 600;';
    strokeCheckboxText.textContent = 'Outline/Stroke';

    strokeCheckboxLabel.appendChild(strokeCheckbox);
    strokeCheckboxLabel.appendChild(strokeCheckboxText);
    strokeGroup.appendChild(strokeCheckboxLabel);

    // Stroke controls container
    const strokeControls = document.createElement('div');
    strokeControls.id = `stroke-controls-${drumId}`;
    strokeControls.style.cssText = `display: ${settings.strokeEnabled ? 'block' : 'none'}; padding-left: 24px;`;

    // Stroke color with real-time preview
    const strokeColorWrapper = document.createElement('div');
    strokeColorWrapper.style.marginBottom = '8px';
    const strokeColorLabel = document.createElement('label');
    strokeColorLabel.style.cssText = 'display: block; font-size: 11px; color: #888; margin-bottom: 4px;';
    strokeColorLabel.textContent = 'Stroke Color';

    const strokeColorInput = document.createElement('input');
    strokeColorInput.type = 'color';
    strokeColorInput.value = settings.strokeColor;
    strokeColorInput.style.cssText = 'width: 100%; height: 32px; border: 2px solid #ddd; border-radius: 5px; cursor: pointer;';
    strokeColorInput.addEventListener('input', function() {
      // Real-time preview while dragging
      drumSettings[drumId].strokeColor = this.value;
      updateDrumPreview(drumId);
    });
    strokeColorInput.addEventListener('change', function() {
      // Final update on release
      updateDrumSetting(drumId, 'strokeColor', this.value);
    });

    strokeColorWrapper.appendChild(strokeColorLabel);
    strokeColorWrapper.appendChild(strokeColorInput);
    strokeControls.appendChild(strokeColorWrapper);

    // Stroke weight
    const strokeWeightWrapper = document.createElement('div');
    const strokeWeightLabel = document.createElement('label');
    strokeWeightLabel.style.cssText = 'display: block; font-size: 11px; color: #888; margin-bottom: 4px;';
    strokeWeightLabel.textContent = 'Stroke Weight';

    const strokeWeightControls = document.createElement('div');
    strokeWeightControls.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-wrap: wrap;';

    const strokeWeightSlider = document.createElement('input');
    strokeWeightSlider.type = 'range';
    strokeWeightSlider.id = `strokeweight-slider-${drumId}`;
    strokeWeightSlider.min = '1';
    strokeWeightSlider.max = '10';
    strokeWeightSlider.value = settings.strokeWeight;
    strokeWeightSlider.style.cssText = 'flex: 1; min-width: 100px; cursor: pointer;';
    strokeWeightSlider.oninput = function() {
      updateDrumSetting(drumId, 'strokeWeight', parseInt(this.value));
      document.getElementById(`strokeweight-${drumId}`).textContent = this.value + 'px';
    };

    const strokeWeightDisplay = document.createElement('span');
    strokeWeightDisplay.id = `strokeweight-${drumId}`;
    strokeWeightDisplay.style.cssText = 'min-width: 35px; font-weight: bold; color: #666; font-size: 11px;';
    strokeWeightDisplay.textContent = settings.strokeWeight + 'px';

    strokeWeightControls.appendChild(strokeWeightSlider);
    strokeWeightControls.appendChild(strokeWeightDisplay);
    strokeWeightControls.appendChild(createCCLearnButton(drumId, 'strokeWeight'));
    strokeWeightWrapper.appendChild(strokeWeightLabel);
    strokeWeightWrapper.appendChild(strokeWeightControls);
    strokeControls.appendChild(strokeWeightWrapper);

    strokeGroup.appendChild(strokeControls);

    // Shape preview (compact, inline with last setting)
    const preview = document.createElement('div');
    preview.innerHTML = `
      <div style="text-align: center; padding: 8px; background: white; border-radius: 5px; border: 1px solid #e0e0e0;">
        <small style="color: #666; display: block; margin-bottom: 3px; font-size: 10px;">Preview</small>
        <div id="preview-${drumId}" style="display: inline-block;"></div>
      </div>
    `;

    // Helper function to create MIDI CC learn button
    function createCCLearnButton(drumId, paramKey) {
      const ccData = settings.midiCC[paramKey];
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; align-items: center; gap: 3px;';

      if (ccData.cc !== null) {
        // Show CC number with range info and remove button
        const ccDisplay = document.createElement('span');
        const ccMin = ccData.ccMin || 0;
        const ccMax = ccData.ccMax || 127;
        const rangeInfo = (ccMin === 0 && ccMax === 127) ? '' : ` (${ccMin}-${ccMax})`;
        ccDisplay.textContent = `CC${ccData.cc}${rangeInfo}`;
        ccDisplay.style.cssText = 'font-size: 9px; color: #667eea; font-weight: bold; padding: 2px 4px; background: #e8eaff; border-radius: 3px;';

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove MIDI CC mapping';
        removeBtn.style.cssText = 'padding: 1px 4px; font-size: 10px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; line-height: 1;';
        removeBtn.onclick = function() {
          drumSettings[drumId].midiCC[paramKey].cc = null;
          drumSettings[drumId].midiCC[paramKey].ccMin = 0;
          drumSettings[drumId].midiCC[paramKey].ccMax = 127;
          buildDrumSettingsUI();
        };

        wrapper.appendChild(ccDisplay);
        wrapper.appendChild(removeBtn);
      } else {
        // Show learn button
        const learnBtn = document.createElement('button');
        learnBtn.textContent = '🎛';
        learnBtn.title = 'Learn MIDI CC';
        learnBtn.style.cssText = 'padding: 2px 5px; font-size: 11px; background: #667eea; color: white; border: none; border-radius: 3px; cursor: pointer;';
        learnBtn.onclick = function() {
          ccLearnMode = true;
          ccLearnDrumId = drumId;
          ccLearnParameter = paramKey;
          ccLearnCalibrationValues = [];
          this.textContent = '⏳';
          this.style.background = '#ff6b35';
          console.log(`CC Learn Mode: Move controller through FULL range for ${drumId}.${paramKey} (3 seconds)`);

          setTimeout(() => {
            if (ccLearnMode) {
              ccLearnMode = false;
              ccLearnDrumId = null;
              ccLearnParameter = null;
              ccLearnCalibrationValues = [];
              this.textContent = '🎛';
              this.style.background = '#667eea';
              console.log('CC Learn timeout - no controller detected');
            }
          }, 4000);
        };

        wrapper.appendChild(learnBtn);
      }

      return wrapper;
    }

    content.appendChild(nameGroup);
    content.appendChild(midiNoteGroup);
    content.appendChild(colorGroup);
    content.appendChild(shapeGroup);
    content.appendChild(rotationGroup);
    content.appendChild(sizeGroup);
    content.appendChild(opacityGroup);
    content.appendChild(hueVarGroup);
    content.appendChild(strokeGroup);
    content.appendChild(preview); // Preview in right column

    // Add "Remove Drum" button at bottom (only if more than 1 drum)
    if (DRUM_KIT_CONFIG.length > 1) {
      const removeBtnWrapper = document.createElement('div');
      removeBtnWrapper.style.cssText = 'grid-column: 1 / -1; margin-top: 10px;';
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '🗑️ Remove This Drum';
      removeBtn.style.cssText = `
        width: 100%;
        padding: 8px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        transition: all 0.2s;
      `;
      removeBtn.onmouseover = () => removeBtn.style.background = '#c82333';
      removeBtn.onmouseout = () => removeBtn.style.background = '#dc3545';
      removeBtn.onclick = () => removeDrum(drumId);
      removeBtnWrapper.appendChild(removeBtn);
      content.appendChild(removeBtnWrapper);
    }

    panel.appendChild(content);
    tabContent.appendChild(panel);
  });

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Add "+" button to add new drum
  const addDrumBtn = document.createElement('button');
  addDrumBtn.innerHTML = '+ Add Drum';
  addDrumBtn.style.cssText = `
    padding: 10px 20px;
    border: 2px dashed #667eea;
    background: white;
    color: #667eea;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
    font-weight: bold;
    min-width: 100px;
  `;
  addDrumBtn.onmouseover = () => {
    addDrumBtn.style.background = '#f0f0ff';
  };
  addDrumBtn.onmouseout = () => {
    addDrumBtn.style.background = 'white';
  };
  addDrumBtn.onclick = () => addNewDrum();
  tabNav.appendChild(addDrumBtn);

  container.appendChild(tabNav);
  container.appendChild(tabContent);

  // Draw all previews immediately
  drumsToShow.forEach(({ id }) => {
    updateDrumPreview(id);
  });
}

/**
 * Switch between drum tabs
 */
function switchDrumTab(drumId) {
  // Remember current tab
  currentCustomizationTab = drumId;

  const drumsToShow = DRUM_KIT_CONFIG.map(drum => ({
    id: drum.id,
    name: drumSettings[drum.id]?.name || drum.name
  }));

  drumsToShow.forEach(({ id }) => {
    const btn = document.getElementById(`tab-btn-${id}`);
    const panel = document.getElementById(`tab-panel-${id}`);
    const settings = drumSettings[id];

    if (id === drumId) {
      // Activate this tab
      btn.style.background = 'white';
      btn.style.fontWeight = 'bold';
      btn.style.borderTop = `3px solid ${settings.color}`;
      btn.classList.add('active');
      panel.style.display = 'block';
      panel.classList.add('active');
    } else {
      // Deactivate other tabs
      btn.style.background = '#f8f9fa';
      btn.style.fontWeight = 'normal';
      btn.style.borderTop = '3px solid transparent';
      btn.classList.remove('active');
      panel.style.display = 'none';
      panel.classList.remove('active');
    }
  });
}

/**
 * Helper to create a setting group with label
 */
function createSettingGroup(label, inputHTML) {
  const group = document.createElement('div');
  group.style.marginBottom = '12px';
  group.innerHTML = `
    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 5px; font-weight: 600;">
      ${label}
    </label>
    ${inputHTML}
  `;
  return group;
}

/**
 * Update a drum setting and refresh preview
 */
function updateDrumSetting(drumId, property, value) {
  if (drumSettings[drumId]) {
    drumSettings[drumId][property] = value;
    updateDrumPreview(drumId);

    // Update tab color indicator if color changed
    if (property === 'color') {
      const tabBtn = document.getElementById(`tab-btn-${drumId}`);
      if (tabBtn) {
        const colorDot = tabBtn.querySelector('span');
        if (colorDot) {
          colorDot.style.background = value;
        }
        // Update border color if this tab is active
        if (tabBtn.classList.contains('active')) {
          tabBtn.style.borderTop = `3px solid ${value}`;
        }
      }
    }

    // Update mouse drum names if name changed
    if (property === 'name') {
      MOUSE_DRUM_NAMES = DRUM_KIT_CONFIG.map(drum =>
        drumSettings[drum.id]?.name || drum.name
      );
    }

    console.log(`Updated ${drumId}: ${property} = ${value}`);
  }
}

/**
 * Update drum tab label when name changes
 */
function updateDrumTabLabel(drumId, newName) {
  const tabBtn = document.getElementById(`tab-btn-${drumId}`);
  if (tabBtn) {
    // Find and update the text node (not the color dot)
    const textNodes = Array.from(tabBtn.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
    if (textNodes.length > 0) {
      textNodes[0].textContent = newName;
    }
  }
}

/**
 * Add a new drum to the kit
 */
function addNewDrum() {
  // Generate unique ID
  const timestamp = Date.now();
  const newId = `drum_${timestamp}`;

  // Pick a random color
  const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  // Add to config
  DRUM_KIT_CONFIG.push({
    id: newId,
    name: `Drum ${DRUM_KIT_CONFIG.length + 1}`,
    defaultMidiNote: 60,
    defaultColor: randomColor
  });

  // Add to settings
  drumSettings[newId] = {
    name: `Drum ${DRUM_KIT_CONFIG.length}`,
    midiNote: 60,
    color: randomColor,
    shape: 'circle',
    opacity: 1.0,
    opacityScaling: SCALING_CURVES.LINEAR,
    size: 1.0,
    sizeScaling: SCALING_CURVES.LINEAR,
    strokeEnabled: false,
    strokeWeight: 2,
    strokeColor: '#000000',
    hueVariation: 0,
    hueScaling: SCALING_CURVES.LINEAR,
    rotation: 0
  };

  // Regenerate mappings
  regenerateDrumMappings();

  // Rebuild UI and switch to new drum
  currentCustomizationTab = newId;
  buildDrumSettingsUI();

  console.log(`Added new drum: ${newId}`);
  showNotification('Drum Added');
}

/**
 * Remove a drum from the kit
 */
function removeDrum(drumId) {
  if (DRUM_KIT_CONFIG.length <= 1) {
    alert('Cannot remove the last drum!');
    return;
  }

  const drumName = drumSettings[drumId]?.name || drumId;
  if (!confirm(`Remove "${drumName}"? This cannot be undone.`)) {
    return;
  }

  // Remove from config
  const configIndex = DRUM_KIT_CONFIG.findIndex(d => d.id === drumId);
  if (configIndex !== -1) {
    DRUM_KIT_CONFIG.splice(configIndex, 1);
  }

  // Remove from settings
  delete drumSettings[drumId];

  // Remove from DRUM_IDS
  for (let key in DRUM_IDS) {
    if (DRUM_IDS[key] === drumId) {
      delete DRUM_IDS[key];
      break;
    }
  }

  // Regenerate mappings
  regenerateDrumMappings();

  // Switch to first drum and rebuild UI
  currentCustomizationTab = DRUM_KIT_CONFIG[0].id;
  buildDrumSettingsUI();

  console.log(`Removed drum: ${drumId}`);
  showNotification('Drum Removed');
}

/**
 * Regenerate all drum-related mappings after add/remove
 */
function regenerateDrumMappings() {
  // Regenerate DRUM_IDS
  Object.keys(DRUM_IDS).forEach(key => delete DRUM_IDS[key]);
  DRUM_KIT_CONFIG.forEach(drum => {
    DRUM_IDS[drum.id.toUpperCase()] = drum.id;
  });

  // Regenerate mouse drum arrays
  MOUSE_DRUM_IDS = DRUM_KIT_CONFIG.map(d => d.id);
  MOUSE_DRUM_NAMES = DRUM_KIT_CONFIG.map(d => drumSettings[d.id]?.name || d.name);

  // Regenerate timeline lanes
  TIMELINE_LANES = {};
  DRUM_KIT_CONFIG.forEach((drum, index) => {
    TIMELINE_LANES[drum.id] = index;
  });
  TIMELINE_LANE_COUNT = DRUM_KIT_CONFIG.length;

  // Reset current mouse drum if out of bounds
  if (currentMouseDrum >= MOUSE_DRUM_IDS.length) {
    currentMouseDrum = 0;
  }
}

/**
 * Update the preview for a drum
 */
function updateDrumPreview(drumId) {
  const previewEl = document.getElementById(`preview-${drumId}`);
  if (!previewEl) return;

  const settings = drumSettings[drumId];
  const size = 24; // Smaller preview

  // Create a small canvas for preview
  let previewCanvas = document.createElement('canvas');
  previewCanvas.width = 50;
  previewCanvas.height = 50;
  previewCanvas.style.display = 'block';
  previewCanvas.style.margin = '0 auto';

  let ctx = previewCanvas.getContext('2d');
  ctx.clearRect(0, 0, 50, 50);

  // Parse color
  let hex = settings.color;
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  let alpha = settings.opacity;

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

  // Apply stroke if enabled
  if (settings.strokeEnabled) {
    let strokeHex = settings.strokeColor;
    let sr = parseInt(strokeHex.slice(1, 3), 16);
    let sg = parseInt(strokeHex.slice(3, 5), 16);
    let sb = parseInt(strokeHex.slice(5, 7), 16);
    ctx.strokeStyle = `rgb(${sr}, ${sg}, ${sb})`;
    ctx.lineWidth = settings.strokeWeight;
  } else {
    ctx.strokeStyle = 'none';
    ctx.lineWidth = 0;
  }

  let cx = 25, cy = 25;

  // Apply rotation for non-circular shapes
  if (settings.rotation !== 0 && settings.shape !== 'circle') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((settings.rotation * Math.PI) / 180);
    cx = 0;
    cy = 0;
  }

  // Draw shape
  switch (settings.shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
      if (settings.strokeEnabled) ctx.stroke();
      break;
    case 'square':
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      if (settings.strokeEnabled) ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
      break;
    case 'triangle':
      ctx.beginPath();
      let h = size * 0.866;
      ctx.moveTo(cx, cy - size / 2);
      ctx.lineTo(cx - size / 2, cy + h / 2);
      ctx.lineTo(cx + size / 2, cy + h / 2);
      ctx.closePath();
      ctx.fill();
      if (settings.strokeEnabled) ctx.stroke();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(cx, cy - size / 2);
      ctx.lineTo(cx + size / 2, cy);
      ctx.lineTo(cx, cy + size / 2);
      ctx.lineTo(cx - size / 2, cy);
      ctx.closePath();
      ctx.fill();
      if (settings.strokeEnabled) ctx.stroke();
      break;
    case 'star':
      drawStarCanvas(ctx, cx, cy, size / 3, size / 2, 5);
      if (settings.strokeEnabled) ctx.stroke();
      break;
    case 'hexagon':
      drawHexagonCanvas(ctx, cx, cy, size / 2);
      if (settings.strokeEnabled) ctx.stroke();
      break;
  }

  // Restore transformation if rotation was applied
  if (settings.rotation !== 0 && settings.shape !== 'circle') {
    ctx.restore();
  }

  previewEl.innerHTML = '';
  previewEl.appendChild(previewCanvas);
}

/**
 * Draw star on 2D canvas context
 */
function drawStarCanvas(ctx, x, y, radius1, radius2, npoints) {
  let angle = (Math.PI * 2) / npoints;
  let halfAngle = angle / 2.0;
  ctx.beginPath();
  for (let a = -Math.PI / 2; a < Math.PI * 2 - Math.PI / 2; a += angle) {
    let sx = x + Math.cos(a) * radius2;
    let sy = y + Math.sin(a) * radius2;
    ctx.lineTo(sx, sy);
    sx = x + Math.cos(a + halfAngle) * radius1;
    sy = y + Math.sin(a + halfAngle) * radius1;
    ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw hexagon on 2D canvas context
 */
function drawHexagonCanvas(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    let angle = ((Math.PI * 2) / 6) * i - Math.PI / 2;
    let sx = x + Math.cos(angle) * radius;
    let sy = y + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(sx, sy);
    } else {
      ctx.lineTo(sx, sy);
    }
  }
  ctx.closePath();
  ctx.fill();
}

// ===== MIDI LEARN SYSTEM =====

/**
 * Enable MIDI learn mode for a specific drum
 */
function learnMIDINote(drumId) {
  midiLearnMode = true;
  midiLearnDrumId = drumId;

  // Visual feedback
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Listening...';
  btn.style.background = '#ff6b6b';

  console.log(`MIDI Learn: Hit your ${drumId} drum pad now...`);

  // Timeout after 5 seconds
  setTimeout(() => {
    if (midiLearnMode && midiLearnDrumId === drumId) {
      midiLearnMode = false;
      midiLearnDrumId = null;
      btn.textContent = originalText;
      btn.style.background = '#667eea';
      console.log('MIDI Learn: Timed out');
    }
  }, 5000);
}

// ===== TIMELINE RECORDING CONTROLS =====

/**
 * Start timeline recording
 * @param {boolean} startOver - If true, reset timeline; if false, continue from where we left off
 */
function startTimelineRecording(startOver = false) {
  timelineRecording = true;

  // If starting over, reset everything
  if (startOver) {
    timelineStartTime = null; // Will be set on first note
    timelinePausedTime = 0;
    timelineStopTime = null;
    lastMetronomeClick = -1; // Reset metronome

    // Clear the canvas
    paintCanvas.background(BG_COLORS[currentBgColor]);
    saveCanvasState();

    console.log('Timeline recording started (from beginning)');
    showNotification('Recording Started (New)');
  } else {
    // Continue recording - keep existing timelineStartTime and calculate paused duration
    if (timelineStartTime !== null && timelineStopTime !== null) {
      // We're continuing after a stop - add the paused duration
      const pauseDuration = millis() - timelineStopTime;
      timelinePausedTime += pauseDuration;
      timelineStopTime = null;

      // Sync metronome to current position
      // Don't subtract 1 - we want to be at the CURRENT subdivision, not the previous one
      const currentTime = millis();
      const timeElapsed = (currentTime - timelineStartTime - timelinePausedTime) / 1000.0;
      const secondsPerBeat = 60 / timelineBPM;
      const secondsPerSubdivision = secondsPerBeat / (timelineSubdivision / 4);

      // Calculate the current subdivision, rounding to nearest to avoid drift
      const exactSubdivision = timeElapsed / secondsPerSubdivision;
      lastMetronomeClick = Math.round(exactSubdivision) - 1;

      console.log(`Timeline recording continued (paused for ${pauseDuration}ms)`);
      showNotification('Recording Continued');
    } else {
      // First time starting
      timelineStartTime = null; // Will be set on first note
      timelinePausedTime = 0;
      timelineStopTime = null;
      lastMetronomeClick = -1; // Reset metronome
      console.log('Timeline recording started');
      showNotification('Recording Started');
    }
  }

  // Update UI - show recording buttons
  updateTimelineButtonsUI('recording');

  const statusDiv = document.getElementById('timeline-status');
  if (statusDiv) statusDiv.textContent = '🔴 Recording...';
}

/**
 * Stop timeline recording
 */
function stopTimelineRecording() {
  timelineRecording = false;
  timelineStopTime = millis(); // Record when we stopped

  // Update UI - show start over / continue buttons
  updateTimelineButtonsUI('stopped');

  const statusDiv = document.getElementById('timeline-status');
  if (statusDiv) statusDiv.textContent = 'Recording paused';

  console.log('Timeline recording stopped at', timelineStopTime);
  showNotification('Recording Stopped');
}

/**
 * Update timeline button visibility based on state
 * @param {string} state - 'initial', 'recording', or 'stopped'
 */
function updateTimelineButtonsUI(state) {
  const initialButtons = document.getElementById('timeline-buttons-initial');
  const recordingButtons = document.getElementById('timeline-buttons-recording');
  const stoppedButtons = document.getElementById('timeline-buttons-stopped');

  if (initialButtons) initialButtons.style.display = 'none';
  if (recordingButtons) recordingButtons.style.display = 'none';
  if (stoppedButtons) stoppedButtons.style.display = 'none';

  if (state === 'initial') {
    if (initialButtons) initialButtons.style.display = 'flex';
  } else if (state === 'recording') {
    if (recordingButtons) recordingButtons.style.display = 'flex';
  } else if (state === 'stopped') {
    if (stoppedButtons) stoppedButtons.style.display = 'flex';
  }
}

/**
 * Update visibility of timeline controls based on current mode
 */
function updateTimelineControlsVisibility() {
  const timelineControls = document.getElementById('timeline-controls');
  if (timelineControls) {
    timelineControls.style.display = (currentMode === 5) ? 'block' : 'none';

    // Sync UI with current values when showing
    if (currentMode === 5) {
      const bpmInput = document.getElementById('timeline-bpm');
      const bpmDisplay = document.getElementById('bpm-display');
      const subdivisionSelect = document.getElementById('timeline-subdivision');

      if (bpmInput) bpmInput.value = timelineBPM;
      if (bpmDisplay) bpmDisplay.textContent = timelineBPM;
      if (subdivisionSelect) subdivisionSelect.value = timelineSubdivision;
    }
  }
}

/**
 * Update timeline BPM setting
 */
function updateTimelineBPM(bpm) {
  timelineBPM = constrain(bpm, 40, 240);
  const bpmDisplay = document.getElementById('bpm-display');
  if (bpmDisplay) bpmDisplay.textContent = timelineBPM;
  console.log('Timeline BPM set to', timelineBPM);
}

/**
 * Update timeline subdivision setting
 */
function updateTimelineSubdivision(subdivision) {
  timelineSubdivision = subdivision;
  lastMetronomeClick = -1; // Reset metronome on subdivision change
  console.log('Timeline subdivision set to', timelineSubdivision);
}

/**
 * Update MIDI latency compensation
 */
function updateMidiLatency(latencyMs) {
  midiLatencyMs = constrain(latencyMs, 0, 200);
  console.log('MIDI latency compensation set to', midiLatencyMs, 'ms');
}

/**
 * Toggle metronome on/off
 */
function toggleMetronome(enabled) {
  metronomeEnabled = enabled;

  // Initialize audio context on first enable
  if (enabled && !audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  console.log('Metronome', enabled ? 'enabled' : 'disabled');
}

/**
 * Update metronome - play click sounds based on BPM and subdivision
 */
function updateMetronome() {
  if (!timelineStartTime || !audioContext) return;

  // Reset if BPM or subdivision changed
  if (lastMetronomeBPM !== timelineBPM || lastMetronomeSubdivision !== timelineSubdivision) {
    lastMetronomeClick = -1;
    lastMetronomeBPM = timelineBPM;
    lastMetronomeSubdivision = timelineSubdivision;
  }

  const currentTime = millis();
  const timeElapsed = (currentTime - timelineStartTime - timelinePausedTime) / 1000.0;

  const secondsPerBeat = 60 / timelineBPM;
  const secondsPerSubdivision = secondsPerBeat / (timelineSubdivision / 4);

  // Calculate which subdivision we're on
  const currentSubdivision = Math.floor(timeElapsed / secondsPerSubdivision);

  // Play click if we've crossed into a new subdivision
  if (currentSubdivision > lastMetronomeClick) {
    lastMetronomeClick = currentSubdivision;

    // Calculate beat position for tone selection
    // Quarter notes are spaced by (timelineSubdivision / 4) subdivisions
    // Measures are 4 quarter notes = timelineSubdivision subdivisions
    const subdivisionsPerQuarter = timelineSubdivision / 4;
    const subdivisionsPerMeasure = timelineSubdivision;

    // Check if this subdivision aligns with a measure or quarter note
    const isOnMeasure = (currentSubdivision % subdivisionsPerMeasure) === 0;
    const isOnQuarterNote = (currentSubdivision % subdivisionsPerQuarter) === 0;

    // Debug logging
    const beatType = isOnMeasure ? 'MEASURE' : (isOnQuarterNote ? 'QUARTER' : 'subdivision');
    console.log(`Metronome click ${currentSubdivision}: ${beatType}`);

    playMetronomeClick(isOnMeasure, isOnQuarterNote);
  }
}

/**
 * Play a metronome click sound
 * @param {boolean} isMeasure - True if this is the first beat of a measure
 * @param {boolean} isQuarterNote - True if this is a quarter note beat
 */
function playMetronomeClick(isMeasure, isQuarterNote) {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Different pitches for different beats
  if (isMeasure) {
    oscillator.frequency.value = 1200; // High pitch for measure
    gainNode.gain.value = 0.3;
  } else if (isQuarterNote) {
    oscillator.frequency.value = 800; // Medium pitch for quarter notes
    gainNode.gain.value = 0.2;
  } else {
    oscillator.frequency.value = 600; // Low pitch for subdivisions
    gainNode.gain.value = 0.15;
  }

  oscillator.type = 'sine';

  const now = audioContext.currentTime;
  oscillator.start(now);

  // Quick attack and decay for a "click" sound
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
  oscillator.stop(now + 0.05);
}

// ===== STATE MANAGEMENT SYSTEM =====

const STORAGE_KEY = 'drumPainterSettings';

/**
 * Save current settings to localStorage as default
 */
function saveAsDefault() {
  try {
    const state = {
      version: '1.2', // Bumped version for MIDI CC support
      drumKitConfig: DRUM_KIT_CONFIG, // Save custom drum kit
      drumSettings: drumSettings,
      globalSettings: {
        sizeMultiplier: globalSizeMultiplier,
        blendMode: currentBlendMode,
        bgColor: currentBgColor
      },
      timestamp: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('✓ Settings saved to browser storage');
    showNotification('Saved as Default');
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Save Failed');
  }
}

/**
 * Load settings from localStorage
 */
function loadDefault() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      console.warn('No saved settings found');
      showNotification('No Default Settings');
      return;
    }

    const state = JSON.parse(saved);

    // Load custom drum kit config if available
    if (state.drumKitConfig && Array.isArray(state.drumKitConfig)) {
      // Clear and reload config
      DRUM_KIT_CONFIG.length = 0;
      state.drumKitConfig.forEach(drum => DRUM_KIT_CONFIG.push(drum));

      // Regenerate mappings
      regenerateDrumMappings();
    }

    // Validate and apply settings
    if (state.drumSettings) {
      applyDrumSettings(state.drumSettings);
    }
    if (state.globalSettings) {
      if (state.globalSettings.sizeMultiplier !== undefined) {
        globalSizeMultiplier = state.globalSettings.sizeMultiplier;
      }
      if (state.globalSettings.blendMode !== undefined) {
        currentBlendMode = state.globalSettings.blendMode;
        paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
      }
      if (state.globalSettings.bgColor !== undefined) {
        currentBgColor = state.globalSettings.bgColor;
      }
    }

    // Rebuild UI to reflect changes
    buildDrumSettingsUI();

    console.log('✓ Settings loaded from browser storage');
    showNotification('Default Loaded');
  } catch (error) {
    console.error('Error loading settings:', error);
    showNotification('Load Failed');
  }
}

/**
 * Export settings to a JSON file
 */
function exportToFile() {
  try {
    const state = {
      version: '1.1',
      drumKitConfig: DRUM_KIT_CONFIG,
      drumSettings: drumSettings,
      globalSettings: {
        sizeMultiplier: globalSizeMultiplier,
        blendMode: currentBlendMode,
        bgColor: currentBgColor
      },
      timestamp: new Date().toISOString()
    };

    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `drum-painter-settings-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    console.log('✓ Settings exported to file');
    showNotification('Exported to File');
  } catch (error) {
    console.error('Error exporting settings:', error);
    showNotification('Export Failed');
  }
}

/**
 * Trigger file picker for import
 */
function importFromFile() {
  const input = document.getElementById('import-file-input');
  if (input) {
    input.click();
  }
}

/**
 * Handle file import
 */
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const state = JSON.parse(e.target.result);

      // Validate version
      if (!state.version) {
        throw new Error('Invalid settings file: missing version');
      }

      // Load custom drum kit config if available
      if (state.drumKitConfig && Array.isArray(state.drumKitConfig)) {
        // Clear and reload config
        DRUM_KIT_CONFIG.length = 0;
        state.drumKitConfig.forEach(drum => DRUM_KIT_CONFIG.push(drum));

        // Regenerate mappings
        regenerateDrumMappings();
      }

      // Apply settings
      if (state.drumSettings) {
        applyDrumSettings(state.drumSettings);
      }
      if (state.globalSettings) {
        if (state.globalSettings.sizeMultiplier !== undefined) {
          globalSizeMultiplier = state.globalSettings.sizeMultiplier;
        }
        if (state.globalSettings.blendMode !== undefined) {
          currentBlendMode = state.globalSettings.blendMode;
          paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
        }
        if (state.globalSettings.bgColor !== undefined) {
          currentBgColor = state.globalSettings.bgColor;
        }
      }

      // Rebuild UI
      buildDrumSettingsUI();

      console.log('✓ Settings imported from file');
      showNotification('Imported Successfully');
    } catch (error) {
      console.error('Error importing settings:', error);
      showNotification('Import Failed');
      alert('Failed to import settings. Please check the file format.');
    }
  };

  reader.readAsText(file);

  // Reset input so same file can be imported again
  event.target.value = '';
}

/**
 * Reset all settings to factory defaults
 */
function resetToFactory() {
  if (confirm('Reset all drum settings to factory defaults? This cannot be undone.')) {
    // Deep copy factory settings
    drumSettings = JSON.parse(JSON.stringify(FACTORY_DRUM_SETTINGS));

    // Reset global settings
    globalSizeMultiplier = 1.0;
    currentBlendMode = 0;
    currentBgColor = 0;
    paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

    // Rebuild UI
    buildDrumSettingsUI();

    console.log('✓ Settings reset to factory defaults');
    showNotification('Reset to Factory');
  }
}

/**
 * Apply drum settings from loaded state
 */
function applyDrumSettings(newSettings) {
  // Validate and merge each drum's settings
  for (let drumId in DRUM_IDS) {
    const id = DRUM_IDS[drumId];
    if (newSettings[id]) {
      // Only apply valid properties
      const validKeys = ['name', 'midiNote', 'color', 'shape',
                         'opacity', 'opacityScaling',
                         'size', 'sizeScaling',
                         'strokeEnabled', 'strokeWeight', 'strokeColor',
                         'hueVariation', 'hueScaling',
                         'rotation', 'midiCC'];

      for (let key of validKeys) {
        if (newSettings[id][key] !== undefined) {
          drumSettings[id][key] = newSettings[id][key];
        }
      }

      // Backward compatibility: Initialize midiCC if not present or migrate old format
      if (!drumSettings[id].midiCC) {
        drumSettings[id].midiCC = {
          size: { cc: null, min: 30, max: 300, ccMin: 0, ccMax: 127 },
          opacity: { cc: null, min: 10, max: 100, ccMin: 0, ccMax: 127 },
          hueVariation: { cc: null, min: 0, max: 30, ccMin: 0, ccMax: 127 },
          rotation: { cc: null, min: 0, max: 360, ccMin: 0, ccMax: 127 },
          strokeWeight: { cc: null, min: 1, max: 10, ccMin: 0, ccMax: 127 }
        };
      } else {
        // Migrate old format (internal values) to new format (slider values)
        const midiCC = drumSettings[id].midiCC;

        // Check if using old format (size min < 10 means internal format)
        if (midiCC.size && midiCC.size.min < 10) {
          midiCC.size.min = 30;
          midiCC.size.max = 300;
          console.log(`Migrated size CC range for ${id}`);
        }

        // Check if using old format (opacity min < 5 means internal format)
        if (midiCC.opacity && midiCC.opacity.min < 5) {
          midiCC.opacity.min = 10;
          midiCC.opacity.max = 100;
          console.log(`Migrated opacity CC range for ${id}`);
        }

        // Add ccMin/ccMax if missing (default to full 0-127 range)
        const params = ['size', 'opacity', 'hueVariation', 'rotation', 'strokeWeight'];
        for (const param of params) {
          if (midiCC[param]) {
            if (midiCC[param].ccMin === undefined) midiCC[param].ccMin = 0;
            if (midiCC[param].ccMax === undefined) midiCC[param].ccMax = 127;
          }
        }

        // Remove old 'value' properties if they exist (no longer needed)
        if (midiCC.size && 'value' in midiCC.size) delete midiCC.size.value;
        if (midiCC.opacity && 'value' in midiCC.opacity) delete midiCC.opacity.value;
        if (midiCC.hueVariation && 'value' in midiCC.hueVariation) delete midiCC.hueVariation.value;
        if (midiCC.rotation && 'value' in midiCC.rotation) delete midiCC.rotation.value;
        if (midiCC.strokeWeight && 'value' in midiCC.strokeWeight) delete midiCC.strokeWeight.value;
      }
    }
  }

  // Update mouse drum names after loading
  MOUSE_DRUM_NAMES = DRUM_KIT_CONFIG.map(drum =>
    drumSettings[drum.id]?.name || drum.name
  );
}

/**
 * Load default settings on startup (silent, no notifications)
 */
function loadDefaultOnStartup() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      console.log('No saved settings found - using factory defaults');
      return;
    }

    const state = JSON.parse(saved);

    // Load custom drum kit config if available
    if (state.drumKitConfig && Array.isArray(state.drumKitConfig)) {
      // Clear and reload config
      DRUM_KIT_CONFIG.length = 0;
      state.drumKitConfig.forEach(drum => DRUM_KIT_CONFIG.push(drum));

      // Regenerate mappings
      regenerateDrumMappings();
    }

    // Validate and apply settings
    if (state.drumSettings) {
      applyDrumSettings(state.drumSettings);
    }
    if (state.globalSettings) {
      if (state.globalSettings.sizeMultiplier !== undefined) {
        globalSizeMultiplier = state.globalSettings.sizeMultiplier;
      }
      if (state.globalSettings.blendMode !== undefined) {
        currentBlendMode = state.globalSettings.blendMode;
        // Blend mode will be applied after canvas is created
      }
      if (state.globalSettings.bgColor !== undefined) {
        currentBgColor = state.globalSettings.bgColor;
      }
    }

    console.log('✓ Loaded saved settings from browser storage');
  } catch (error) {
    console.error('Error loading saved settings on startup:', error);
  }
}
