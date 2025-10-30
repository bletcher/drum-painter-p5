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
const BASE_SIZE_CLASSIC = 10;
const VELOCITY_MULT_CLASSIC = 30;
const BASE_SIZE_FIBONACCI = 8;
const VELOCITY_MULT_FIBONACCI = 20;
const BASE_SIZE_SYMMETRY = 12;
const VELOCITY_MULT_SYMMETRY = 25;
const BASE_SIZE_GRAVITY = 8;
const VELOCITY_MULT_GRAVITY = 15;
const BASE_SIZE_ORGANIC = 10;
const VELOCITY_MULT_ORGANIC = 20;

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
let showUI = true;
let showHelp = false;
let globalSizeMultiplier = 1.0; // 0.3 to 3.0 range

// Notification flash state
let notificationText = '';
let notificationAlpha = 0;

// Mode-specific state
let spiralAngle = 0;
let growthPoints = [];

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
let mouseTestEnabled = true; // Allow mouse painting even with MIDI
let currentMouseDrum = 0;
let prevMouseX = 0;
let prevMouseY = 0;

// DOM element cache
let midiStatusEl;
let modeStatusEl;
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

// Drum customization system
let showCustomization = false;
let midiLearnMode = false;
let midiLearnDrumId = null;

// Drum IDs (independent of MIDI notes)
const DRUM_IDS = {
  KICK: 'kick',
  SNARE: 'snare',
  RACK_TOM: 'rack_tom',
  FLOOR_TOM: 'floor_tom'
};

let drumSettings = {
  [DRUM_IDS.KICK]: { midiNote: 36, color: '#141E50', shape: 'circle', opacity: 1.0 },
  [DRUM_IDS.SNARE]: { midiNote: 38, color: '#C82832', shape: 'circle', opacity: 1.0 },
  [DRUM_IDS.RACK_TOM]: { midiNote: 50, color: '#64A0DC', shape: 'circle', opacity: 1.0 },
  [DRUM_IDS.FLOOR_TOM]: { midiNote: 45, color: '#DC6428', shape: 'circle', opacity: 1.0 }
};

// Mouse testing drum selection (maps to the 4 custom drums)
const MOUSE_DRUM_IDS = [
  DRUM_IDS.KICK,
  DRUM_IDS.SNARE,
  DRUM_IDS.RACK_TOM,
  DRUM_IDS.FLOOR_TOM
];

const MOUSE_DRUM_NAMES = [
  'Kick',
  'Snare',
  'Rack Tom',
  'Floor Tom'
];

const SHAPE_OPTIONS = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'];

const MODE_NAMES = [
  'Classic Pointillism',
  'Fibonacci Spiral',
  'Radial Symmetry',
  'Gravity Field',
  'Organic Growth'
];

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Initialize blend modes (p5 constants are now available)
  BLEND_MODES = [BLEND, MULTIPLY, SCREEN, OVERLAY, DODGE, BURN];

  // Create high-res painting canvas
  paintCanvas = createGraphics(PAINT_CANVAS_WIDTH, PAINT_CANVAS_HEIGHT);
  paintCanvas.background(255);
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
  modeStatusEl = document.getElementById('mode-status');
  controlsEl = document.getElementById('controls');

  // Setup MIDI
  setupMIDI();

  // Save initial blank canvas state
  saveCanvasState();

  console.log('🎨 Drum Painter Ready!');
  console.log('Controls: SPACE=clear, S=save, 1-5=modes, H=hide UI, B=blend mode, Z=undo, Y=redo');
  console.log('Mouse Testing: M=toggle, []=change drum, click/drag to paint');
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
  text('1-5', col1, y);
  text('Switch painting modes (Classic, Fibonacci, etc.)', col2, y);
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
    console.error('WebMIDI not supported in this browser - Mouse mode active');
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
    console.warn('No MIDI devices found - Mouse mode active');
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
  if (midiStatusEl) {
    midiStatusEl.textContent = 'Mouse Mode: Active (MIDI failed)';
    midiStatusEl.className = 'status mouse-mode';
  }
}

function handleMIDIMessage(message) {
  try {
    const [command, note, velocity] = message.data;

    // Note On message (144) with velocity > 0
    if (command === 144 && velocity > 0) {
      // Handle MIDI learn mode
      if (midiLearnMode && midiLearnDrumId) {
        drumSettings[midiLearnDrumId].midiNote = note;
        console.log(`MIDI Learn: Assigned note ${note} to ${midiLearnDrumId}`);

        // Update UI
        buildDrumSettingsUI();

        // Exit learn mode
        midiLearnMode = false;
        midiLearnDrumId = null;
        return;
      }

      // Normal painting
      const vel = map(velocity, 0, 127, 0.3, 1.0);
      paintDrum(note, vel);
    }

    // Optional: log for debugging
    // console.log(`MIDI: ${command} ${note} ${velocity}`);
  } catch (error) {
    console.error('Error handling MIDI message:', error);
  }
}

// ===== MAIN PAINTING ROUTER =====

function paintDrum(note, velocity) {
  try {
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
  let size = (BASE_SIZE_CLASSIC + velocity * VELOCITY_MULT_CLASSIC) * globalSizeMultiplier;
  let col = getDrumColor(note);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);

  paintCanvas.push();
  paintCanvas.noStroke();
  paintDot(x, y, size, col, ALPHA_CLASSIC * velocity * opacityMult, shape);
  paintCanvas.pop();

  particles.push(new Particle(x, y, size, col));
}

// ===== MODE 1: FIBONACCI SPIRAL =====

function paintFibonacci(note, velocity) {
  const goldenAngle = PI * (3 - sqrt(5)); // ~137.5 degrees
  spiralAngle += goldenAngle;

  let radius = sqrt(strokeCount) * FIBONACCI_RADIUS_MULT;
  let x = paintCanvas.width / 2 + cos(spiralAngle) * radius;
  let y = paintCanvas.height / 2 + sin(spiralAngle) * radius;
  let size = (BASE_SIZE_FIBONACCI + velocity * VELOCITY_MULT_FIBONACCI) * globalSizeMultiplier;

  // Keep within bounds
  x = constrain(x, 0, paintCanvas.width);
  y = constrain(y, 0, paintCanvas.height);

  let col = getDrumColor(note);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);

  paintCanvas.push();
  paintCanvas.noStroke();
  paintDot(x, y, size, col, ALPHA_FIBONACCI * velocity * opacityMult, shape);
  paintCanvas.pop();

  particles.push(new Particle(x, y, size, col));
}

// ===== MODE 2: RADIAL SYMMETRY =====

function paintSymmetry(note, velocity) {
  let angle = random(TWO_PI / SYMMETRY_ORDER);
  let radius = random(SYMMETRY_RADIUS_MIN, SYMMETRY_RADIUS_MAX);
  let size = (BASE_SIZE_SYMMETRY + velocity * VELOCITY_MULT_SYMMETRY) * globalSizeMultiplier;
  let col = getDrumColor(note);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);

  paintCanvas.push();
  paintCanvas.noStroke();

  for (let i = 0; i < SYMMETRY_ORDER; i++) {
    let a = angle + (TWO_PI / SYMMETRY_ORDER) * i;
    let x = paintCanvas.width / 2 + cos(a) * radius;
    let y = paintCanvas.height / 2 + sin(a) * radius;

    paintDot(x, y, size, col, ALPHA_SYMMETRY * velocity * opacityMult, shape);

    if (i === 0) {
      particles.push(new Particle(x, y, size, col));
    }
  }
  paintCanvas.pop();
}

// ===== MODE 3: GRAVITY FIELD =====

function paintGravity(note, velocity) {
  let x = random(paintCanvas.width);
  let y = random(paintCanvas.height * 0.3);
  let size = (BASE_SIZE_GRAVITY + velocity * VELOCITY_MULT_GRAVITY) * globalSizeMultiplier;
  let col = getDrumColor(note);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);

  paintCanvas.push();
  paintCanvas.noStroke();

  let steps = floor(GRAVITY_STEPS_BASE + velocity * GRAVITY_STEPS_MULT);
  for (let i = 0; i < steps; i++) {
    y += random(GRAVITY_STEP_MIN, GRAVITY_STEP_MAX);
    x += random(GRAVITY_DRIFT_MIN, GRAVITY_DRIFT_MAX);

    let alpha = map(i, 0, steps, ALPHA_GRAVITY * velocity * opacityMult, ALPHA_GRAVITY_MIN * velocity * opacityMult);
    paintDot(x, y, size, col, alpha, shape);

    if (y > paintCanvas.height) break;
  }
  paintCanvas.pop();

  particles.push(new Particle(x, y, size, col));
}

// ===== MODE 4: ORGANIC GROWTH =====

function paintOrganic(note, velocity) {
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
  let size = (BASE_SIZE_ORGANIC + velocity * VELOCITY_MULT_ORGANIC) * globalSizeMultiplier;

  x = constrain(x, 0, paintCanvas.width);
  y = constrain(y, 0, paintCanvas.height);

  let col = getDrumColor(note);
  let shape = getDrumShape(note);
  let opacityMult = getDrumOpacity(note);

  paintCanvas.push();
  paintCanvas.noStroke();
  paintDot(x, y, size, col, ALPHA_ORGANIC * velocity * opacityMult, shape);
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

// ===== UTILITY FUNCTIONS =====

/**
 * Helper function to paint a dot on the canvas
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Circle size
 * @param {p5.Color} col - Color object
 * @param {number} alpha - Alpha/opacity value
 * @param {string} shape - Shape type ('circle', 'square', etc.)
 */
function paintDot(x, y, size, col, alpha, shape = 'circle') {
  let r = red(col), g = green(col), b = blue(col);
  paintCanvas.fill(r, g, b, alpha);

  switch (shape) {
    case 'circle':
      paintCanvas.circle(x, y, size);
      break;
    case 'square':
      paintCanvas.rectMode(CENTER);
      paintCanvas.square(x, y, size);
      break;
    case 'triangle':
      let h = size * 0.866; // height of equilateral triangle
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

function getDrumColor(note) {
  // Find drum by MIDI note
  const drumId = findDrumByMidiNote(note);
  if (drumId && drumSettings[drumId]) {
    return color(drumSettings[drumId].color);
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
  if (modeStatusEl) {
    let statusText = `Mode: ${MODE_NAMES[currentMode]} | Blend: ${BLEND_MODE_NAMES[currentBlendMode]}`;

    // Show brush size if not at 100%
    if (globalSizeMultiplier !== 1.0) {
      statusText += ` | Size: ${(globalSizeMultiplier * 100).toFixed(0)}%`;
    }

    statusText += ` | Strokes: ${strokeCount}`;

    // Show mouse test info if enabled
    if (mouseTestEnabled) {
      statusText += ` | Mouse: ${MOUSE_DRUM_NAMES[currentMouseDrum]}`;
    }

    modeStatusEl.textContent = statusText;
  }
}

function keyPressed() {
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

  // Mode switching (1-5)
  if (key >= '1' && key <= '5') {
    currentMode = parseInt(key) - 1;
    strokeCount = 0;
    spiralAngle = 0;

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
  // Don't paint if customization panel is open
  if (showCustomization) return;

  if (!midiReady || mouseTestEnabled) {
    prevMouseX = mouseX;
    prevMouseY = mouseY;
  }
}

function mouseDragged() {
  // Don't paint if customization panel is open
  if (showCustomization) return;

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
  // Don't paint if customization panel is open
  if (showCustomization) return;

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

  // Only show these 4 drums
  const drumsToShow = [
    { id: DRUM_IDS.KICK, name: 'Kick' },
    { id: DRUM_IDS.SNARE, name: 'Snare' },
    { id: DRUM_IDS.RACK_TOM, name: 'Rack Tom' },
    { id: DRUM_IDS.FLOOR_TOM, name: 'Floor Tom' }
  ];

  // Create settings for each drum
  drumsToShow.forEach(({ id: drumId, name: drumName }) => {
    const settings = drumSettings[drumId];

    // Create drum section
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 15px;
      padding: 15px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 8px;
      border-left: 4px solid ${settings.color};
    `;

    // Collapsible header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      font-weight: bold;
      color: #333;
      font-size: 15px;
    `;

    const headerTitle = document.createElement('span');
    headerTitle.textContent = `${drumName}`;

    const toggleIcon = document.createElement('span');
    toggleIcon.textContent = '▼';
    toggleIcon.style.transition = 'transform 0.3s';

    header.appendChild(headerTitle);
    header.appendChild(toggleIcon);

    // Settings content (initially visible)
    const content = document.createElement('div');
    content.style.cssText = `
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(0,0,0,0.1);
    `;
    content.id = `drum-${drumId}-content`;

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

    // Color picker
    const colorGroup = createSettingGroup('Color',
      `<input type="color" value="${settings.color}"
        onchange="updateDrumSetting('${drumId}', 'color', this.value)"
        style="width: 100%; height: 40px; border: 2px solid #ddd; border-radius: 5px; cursor: pointer;">`
    );

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
    const opacityGroup = createSettingGroup('Opacity Multiplier',
      `<div style="display: flex; align-items: center; gap: 10px;">
        <input type="range" min="10" max="100" value="${opacityPercent}"
          oninput="updateDrumSetting('${drumId}', 'opacity', this.value / 100); document.getElementById('opacity-${drumId}').textContent = this.value + '%';"
          style="flex: 1; cursor: pointer;">
        <span id="opacity-${drumId}" style="min-width: 45px; font-weight: bold; color: #666;">${opacityPercent}%</span>
      </div>
      <div style="font-size: 11px; color: #888; margin-top: 4px;">Multiplies with MIDI velocity</div>`
    );

    // Shape preview
    const preview = document.createElement('div');
    preview.innerHTML = `
      <div style="margin-top: 10px; text-align: center; padding: 10px; background: white; border-radius: 5px;">
        <small style="color: #666; display: block; margin-bottom: 5px;">Preview</small>
        <div id="preview-${drumId}" style="display: inline-block;"></div>
      </div>
    `;

    content.appendChild(midiNoteGroup);
    content.appendChild(colorGroup);
    content.appendChild(shapeGroup);
    content.appendChild(opacityGroup);
    content.appendChild(preview);

    // Toggle collapse functionality
    let isOpen = true;
    header.onclick = () => {
      isOpen = !isOpen;
      content.style.display = isOpen ? 'block' : 'none';
      toggleIcon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
    };

    section.appendChild(header);
    section.appendChild(content);
    container.appendChild(section);

    // Draw preview
    updateDrumPreview(drumId);
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
    console.log(`Updated ${drumId}: ${property} = ${value}`);
  }
}

/**
 * Update the preview for a drum
 */
function updateDrumPreview(drumId) {
  const previewEl = document.getElementById(`preview-${drumId}`);
  if (!previewEl) return;

  const settings = drumSettings[drumId];
  const size = 30;

  // Create a small canvas for preview
  let previewCanvas = document.createElement('canvas');
  previewCanvas.width = 60;
  previewCanvas.height = 60;
  previewCanvas.style.display = 'block';
  previewCanvas.style.margin = '0 auto';

  let ctx = previewCanvas.getContext('2d');
  ctx.clearRect(0, 0, 60, 60);

  // Parse color
  let hex = settings.color;
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  let alpha = settings.opacity;

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.strokeStyle = 'none';

  let cx = 30, cy = 30;

  // Draw shape
  switch (settings.shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'square':
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      break;
    case 'triangle':
      ctx.beginPath();
      let h = size * 0.866;
      ctx.moveTo(cx, cy - size / 2);
      ctx.lineTo(cx - size / 2, cy + h / 2);
      ctx.lineTo(cx + size / 2, cy + h / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(cx, cy - size / 2);
      ctx.lineTo(cx + size / 2, cy);
      ctx.lineTo(cx, cy + size / 2);
      ctx.lineTo(cx - size / 2, cy);
      ctx.closePath();
      ctx.fill();
      break;
    case 'star':
      drawStarCanvas(ctx, cx, cy, size / 3, size / 2, 5);
      break;
    case 'hexagon':
      drawHexagonCanvas(ctx, cx, cy, size / 2);
      break;
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
