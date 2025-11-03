/**
 * Drum Painter - Main Entry Point
 * Modular version with ES6 modules
 */

import { PAINT_CANVAS_WIDTH, PAINT_CANVAS_HEIGHT, BG_COLORS } from './config/constants.js';
import { DRUM_KIT_CONFIG, generateFactorySettings } from './config/drumKit.js';
import { ClassicMode } from './modes/ClassicMode.js';
import { FibonacciMode } from './modes/FibonacciMode.js';
import { RadialMode } from './modes/RadialMode.js';
import { GravityMode } from './modes/GravityMode.js';
import { OrganicMode } from './modes/OrganicMode.js';
import { DendriticMode } from './modes/DendriticMode.js';
import { LightningMode } from './modes/LightningMode.js';

// ===== GLOBAL STATE =====
let paintCanvas;
let particles = [];
let currentMode = 0;
let strokeCount = 0;
let globalSizeMultiplier = 1.0;
let showUI = true;
let currentBgColor = 0;

// Drum settings
let drumSettings = generateFactorySettings();

// MIDI state
let midiReady = false;
let midiInput = null;

// DOM elements
let midiStatusEl;
let controlsEl;

// Initialize paint modes
const modes = [
  new ClassicMode(),
  new FibonacciMode(),
  new RadialMode(),
  new GravityMode(),
  new OrganicMode(),
  new DendriticMode(),
  new LightningMode()
  // Timeline mode (Mode 5) - complex, will be added later
];

// ===== P5.JS SKETCH =====

// Using global mode for now (easier for testing)
window.setup = function() {
  // Create display canvas
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent(document.body);

  // Create offscreen painting canvas
  paintCanvas = createGraphics(PAINT_CANVAS_WIDTH, PAINT_CANVAS_HEIGHT);
  paintCanvas.background(BG_COLORS[currentBgColor]);

  // Cache DOM elements
  midiStatusEl = document.getElementById('midi-status');
  controlsEl = document.getElementById('controls');

  // Setup MIDI
  setupMidi();

  console.log('🎨 Drum Painter - Modular Version');
  console.log('📦 Loaded modes:', modes.map(m => m.name));
  console.log('🥁 Drum kit:', DRUM_KIT_CONFIG.map(d => d.name));
};

window.draw = function() {
  background(240);

  // Calculate scaling to fit paint canvas in window
  let scaleFactor = min(width / paintCanvas.width, height / paintCanvas.height) * 0.9;
  let displayWidth = paintCanvas.width * scaleFactor;
  let displayHeight = paintCanvas.height * scaleFactor;
  let offsetX = (width - displayWidth) / 2;
  let offsetY = (height - displayHeight) / 2;

  // Draw the paint canvas
  image(paintCanvas, offsetX, offsetY, displayWidth, displayHeight);

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display(offsetX, offsetY, scaleFactor);
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }

  // Show mode name briefly
  if (frameCount < 180) {
    push();
    fill(0, 150);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(24);
    text(modes[currentMode].name, width / 2, 50);
    pop();
  }
};

window.keyPressed = function() {
  // Space - clear canvas
  if (key === ' ') {
    paintCanvas.background(BG_COLORS[currentBgColor]);
    strokeCount = 0;
    particles = [];

    // Reset mode-specific state
    if (currentMode === 1) {
      modes[currentMode].spiralAngle = 0;
    }
    if (currentMode === 4) {
      modes[currentMode].resetGrowthPoints(paintCanvas);
    }

    console.log('Canvas cleared');
    return false;
  }

  // S - save
  if (key === 's' || key === 'S') {
    let filename = `drum-painting-${modes[currentMode].name.replace(/\s+/g, '-')}-${Date.now()}.png`;
    paintCanvas.save(filename);
    console.log(`Saved: ${filename}`);
    return false;
  }

  // H - toggle UI
  if (key === 'h' || key === 'H') {
    showUI = !showUI;
    if (controlsEl) {
      controlsEl.style.display = showUI ? 'block' : 'none';
    }
    return false;
  }

  // 1-7 - switch modes
  if (key >= '1' && key <= '7') {
    let newMode = parseInt(key) - 1;
    if (newMode < modes.length && newMode !== currentMode) {
      // Deactivate old mode
      modes[currentMode].onDeactivate({ paintCanvas });

      // Switch mode
      currentMode = newMode;
      strokeCount = 0;

      // Activate new mode
      modes[currentMode].onActivate({ paintCanvas });

      console.log(`Mode: ${modes[currentMode].name}`);
    }
    return false;
  }

  return true;
};

window.windowResized = function() {
  resizeCanvas(windowWidth, windowHeight);
};

// ===== MIDI SETUP =====

function setupMidi() {
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess()
      .then(onMIDISuccess, onMIDIFailure);
  } else {
    console.log('WebMIDI not supported');
    if (midiStatusEl) {
      midiStatusEl.textContent = 'WebMIDI not supported in this browser';
    }
  }
}

function onMIDISuccess(midiAccess) {
  console.log('MIDI Access obtained');

  // Get all MIDI inputs
  const inputs = midiAccess.inputs.values();
  let inputFound = false;

  for (let input of inputs) {
    console.log('MIDI Input:', input.name);
    input.onmidimessage = onMIDIMessage;
    midiInput = input;
    inputFound = true;
  }

  if (inputFound) {
    midiReady = true;
    if (midiStatusEl) {
      midiStatusEl.textContent = 'MIDI: Connected ✓';
      midiStatusEl.className = 'status connected';
    }
    console.log('✓ MIDI ready');
  } else {
    if (midiStatusEl) {
      midiStatusEl.textContent = 'MIDI: No devices found';
    }
    console.log('No MIDI devices found');
  }
}

function onMIDIFailure(error) {
  console.error('MIDI Access failed:', error);
  if (midiStatusEl) {
    midiStatusEl.textContent = 'MIDI: Access failed';
  }
}

function onMIDIMessage(message) {
  const [status, note, velocity] = message.data;
  const command = status >> 4;
  const channel = status & 0xf;

  // Note On (9) with velocity > 0
  if (command === 9 && velocity > 0) {
    handleNoteOn(note, velocity);
  }
}

function handleNoteOn(note, velocity) {
  console.log(`Note: ${note}, Velocity: ${velocity}`);

  // Normalize velocity to 0-1
  const normalizedVelocity = velocity / 127;

  // Create context for mode
  const context = {
    paintCanvas,
    drumSettings,
    globalSizeMultiplier,
    particles,
    strokeCount
  };

  // Paint with current mode
  try {
    modes[currentMode].paint(note, normalizedVelocity, context);
    strokeCount++;
  } catch (error) {
    console.error('Error painting:', error);
  }
}

// ===== MOUSE TESTING (for development without MIDI) =====

window.mousePressed = function() {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
    return;
  }

  // Simulate MIDI note on click
  // Use first drum's MIDI note
  const testNote = DRUM_KIT_CONFIG[0].defaultMidiNote;
  const testVelocity = random(0.5, 1.0);

  console.log(`Mouse test: Note ${testNote}, Vel ${testVelocity}`);
  handleNoteOn(testNote, testVelocity * 127);
};

console.log('🎹 Click anywhere to test painting');
console.log('⌨️  Press 1-7 to switch modes:');
console.log('   1: Classic Pointillism');
console.log('   2: Fibonacci Spiral');
console.log('   3: Radial Symmetry');
console.log('   4: Gravity Field');
console.log('   5: Organic Growth');
console.log('   6: Dendritic Spreading');
console.log('   7: Lightning');
console.log('⌨️  Press SPACE to clear');
console.log('⌨️  Press S to save');
