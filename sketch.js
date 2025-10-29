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

// Mode-specific state
let spiralAngle = 0;
let growthPoints = [];

// Blend mode state
let currentBlendMode = 0;
let BLEND_MODES = []; // Will be initialized in setup() when p5 constants are available
const BLEND_MODE_NAMES = ['Normal', 'Multiply', 'Screen', 'Overlay', 'Dodge', 'Burn'];

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

// Mouse testing drum selection
const MOUSE_DRUM_NOTES = [
  MIDI_NOTES.KICK,
  MIDI_NOTES.SNARE,
  MIDI_NOTES.CLOSED_HAT,
  MIDI_NOTES.OPEN_HAT,
  MIDI_NOTES.TOM_LOW,
  MIDI_NOTES.TOM_MID,
  MIDI_NOTES.TOM_HIGH,
  MIDI_NOTES.CRASH,
  MIDI_NOTES.RIDE
];

const MOUSE_DRUM_NAMES = [
  'Kick', 'Snare', 'Closed Hat', 'Open Hat',
  'Tom Low', 'Tom Mid', 'Tom High', 'Crash', 'Ride'
];

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

  // Show mouse drum indicator when mouse testing is active
  if (mouseTestEnabled && mouseX > 0 && mouseY > 0) {
    drawMouseIndicator();
  }

  // UI
  if (showUI) {
    updateUIStatus();
  }
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
  let size = BASE_SIZE_CLASSIC + velocity * VELOCITY_MULT_CLASSIC;
  let col = getDrumColor(note);

  paintCanvas.push();
  paintCanvas.noStroke();
  paintDot(x, y, size, col, ALPHA_CLASSIC * velocity);
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
  let size = BASE_SIZE_FIBONACCI + velocity * VELOCITY_MULT_FIBONACCI;

  // Keep within bounds
  x = constrain(x, 0, paintCanvas.width);
  y = constrain(y, 0, paintCanvas.height);

  let col = getDrumColor(note);

  paintCanvas.push();
  paintCanvas.noStroke();
  paintDot(x, y, size, col, ALPHA_FIBONACCI * velocity);
  paintCanvas.pop();

  particles.push(new Particle(x, y, size, col));
}

// ===== MODE 2: RADIAL SYMMETRY =====

function paintSymmetry(note, velocity) {
  let angle = random(TWO_PI / SYMMETRY_ORDER);
  let radius = random(SYMMETRY_RADIUS_MIN, SYMMETRY_RADIUS_MAX);
  let size = BASE_SIZE_SYMMETRY + velocity * VELOCITY_MULT_SYMMETRY;
  let col = getDrumColor(note);

  paintCanvas.push();
  paintCanvas.noStroke();

  for (let i = 0; i < SYMMETRY_ORDER; i++) {
    let a = angle + (TWO_PI / SYMMETRY_ORDER) * i;
    let x = paintCanvas.width / 2 + cos(a) * radius;
    let y = paintCanvas.height / 2 + sin(a) * radius;

    paintDot(x, y, size, col, ALPHA_SYMMETRY * velocity);

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
  let size = BASE_SIZE_GRAVITY + velocity * VELOCITY_MULT_GRAVITY;
  let col = getDrumColor(note);

  paintCanvas.push();
  paintCanvas.noStroke();

  let steps = floor(GRAVITY_STEPS_BASE + velocity * GRAVITY_STEPS_MULT);
  for (let i = 0; i < steps; i++) {
    y += random(GRAVITY_STEP_MIN, GRAVITY_STEP_MAX);
    x += random(GRAVITY_DRIFT_MIN, GRAVITY_DRIFT_MAX);

    let alpha = map(i, 0, steps, ALPHA_GRAVITY * velocity, ALPHA_GRAVITY_MIN * velocity);
    paintDot(x, y, size, col, alpha);

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
  let size = BASE_SIZE_ORGANIC + velocity * VELOCITY_MULT_ORGANIC;

  x = constrain(x, 0, paintCanvas.width);
  y = constrain(y, 0, paintCanvas.height);

  let col = getDrumColor(note);

  paintCanvas.push();
  paintCanvas.noStroke();
  paintDot(x, y, size, col, ALPHA_ORGANIC * velocity);
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
 */
function paintDot(x, y, size, col, alpha) {
  let r = red(col), g = green(col), b = blue(col);
  paintCanvas.fill(r, g, b, alpha);
  paintCanvas.circle(x, y, size);
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
  let drumColor = getDrumColor(MOUSE_DRUM_NOTES[currentMouseDrum]);
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
  switch (note) {
    case MIDI_NOTES.KICK:
      return color(20, 30, 80);
    case MIDI_NOTES.SNARE:
      return color(200, 40, 50);
    case MIDI_NOTES.CLOSED_HAT:
      return color(240, 220, 60);
    case MIDI_NOTES.OPEN_HAT:
      return color(250, 240, 100);
    case MIDI_NOTES.TOM_LOW:
      return color(220, 100, 40);
    case MIDI_NOTES.TOM_MID:
      return color(180, 70, 120);
    case MIDI_NOTES.TOM_HIGH:
      return color(100, 160, 220);
    case MIDI_NOTES.CRASH:
      return color(255, 200, 50);
    case MIDI_NOTES.RIDE:
      return color(80, 200, 200);
    default:
      return color(150, 150, 150);
  }
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
    let statusText = `Mode: ${MODE_NAMES[currentMode]} | Blend: ${BLEND_MODE_NAMES[currentBlendMode]} | Strokes: ${strokeCount}`;

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
    console.log(`Blend Mode: ${BLEND_MODE_NAMES[currentBlendMode]}`);
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

  // Mode switching (1-5)
  if (key >= '1' && key <= '5') {
    currentMode = parseInt(key) - 1;
    strokeCount = 0;
    spiralAngle = 0;
    resetGrowthPoints();
    console.log(`Mode: ${MODE_NAMES[currentMode]}`);
  }

  return false; // Prevent default browser behavior
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ===== MOUSE PAINTING (for testing without MIDI) =====

function mousePressed() {
  if (!midiReady || mouseTestEnabled) {
    prevMouseX = mouseX;
    prevMouseY = mouseY;
  }
}

function mouseDragged() {
  // Allow painting with mouse if no MIDI connected OR if mouse test enabled
  if (!midiReady || mouseTestEnabled) {
    // Calculate velocity based on mouse speed
    let speed = dist(mouseX, mouseY, prevMouseX, prevMouseY);
    let vel = constrain(map(speed, 0, 50, 0.3, 1.0), 0.3, 1.0);

    // Paint with currently selected drum
    paintDrum(MOUSE_DRUM_NOTES[currentMouseDrum], vel);

    // Update previous position
    prevMouseX = mouseX;
    prevMouseY = mouseY;
  }
}

function mouseClicked() {
  // Single click for single stroke
  if (!midiReady || mouseTestEnabled) {
    let vel = 0.7; // Medium velocity for clicks
    paintDrum(MOUSE_DRUM_NOTES[currentMouseDrum], vel);
  }
}
