/**
 * Spiral Chronicle Mode
 * Time flows outward in a logarithmic spiral from the center
 * Each drum has a fixed angular position (like hours on a clock)
 */

import { ModeBase } from './ModeBase.js';
import {
  BASE_SIZE_CLASSIC,
  VELOCITY_MULT_CLASSIC,
  ALPHA_CLASSIC
} from '../config/constants.js';
import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { applyScalingCurve } from '../utils/scaling.js';
import {
  getDrumColor,
  getDrumSize,
  getDrumShape,
  getDrumOpacity,
  getDrumStroke,
  getDrumRotation,
  findDrumByMidiNote
} from '../utils/drumHelpers.js';
import { paintDot } from '../canvas/DrawingUtils.js';
import { Particle } from '../canvas/Particle.js';

export class SpiralMode extends ModeBase {
  constructor() {
    super('Spiral Chronicle', BASE_SIZE_CLASSIC, VELOCITY_MULT_CLASSIC);

    // Spiral parameters
    this.startTime = null;
    this.spiralTightness = 15;        // Space between rotations (pixels per rotation)
    this.rotationsPerMinute = 4;      // How fast the spiral rotates (visual speed)
    this.startRadius = 50;            // Initial radius at center
    this.syncToBPM = false;           // Whether to sync rotation speed to BPM

    // Drum angular positions (will be calculated based on number of drums)
    this.drumAngles = {};
    this.calculateDrumAngles();
  }

  /**
   * Calculate fixed angular positions for each drum
   * Distributes drums evenly around 360 degrees
   */
  calculateDrumAngles() {
    const numDrums = DRUM_KIT_CONFIG.length;
    const angleStep = (Math.PI * 2) / numDrums;

    DRUM_KIT_CONFIG.forEach((drum, index) => {
      // Offset by -90 degrees to start at top (12 o'clock)
      this.drumAngles[drum.id] = (angleStep * index) - (Math.PI / 2);
    });
  }

  /**
   * Initialize when mode is activated
   */
  onActivate(context) {
    this.startTime = Date.now();
    this.calculateDrumAngles(); // Recalculate in case drums were added/removed
  }

  /**
   * Calculate current radius based on elapsed time
   */
  getCurrentRadius() {
    if (!this.startTime) {
      this.startTime = Date.now();
    }

    const elapsed = (Date.now() - this.startTime) / 1000; // seconds

    // Archimedean spiral: r = a + b*θ
    // θ increases based on time and rotation speed
    const rotationsPerSecond = this.rotationsPerMinute / 60;
    const theta = elapsed * rotationsPerSecond * Math.PI * 2;

    // Radius increases linearly with angle
    const radius = this.startRadius + (this.spiralTightness * theta / (Math.PI * 2));

    return { radius, theta };
  }

  /**
   * Get position on spiral for a specific drum
   */
  getSpiralPosition(drumId, paintCanvas) {
    const centerX = paintCanvas.width / 2;
    const centerY = paintCanvas.height / 2;

    const { radius, theta } = this.getCurrentRadius();

    // Get this drum's fixed angular offset
    const drumAngle = this.drumAngles[drumId] || 0;

    // Add some randomness for organic feel (±10 degrees, ±10% radius)
    const angleVariation = random(-0.17, 0.17); // ~10 degrees
    const radiusVariation = radius * random(-0.1, 0.1);

    const finalAngle = theta + drumAngle + angleVariation;
    const finalRadius = radius + radiusVariation;

    const x = centerX + finalRadius * cos(finalAngle);
    const y = centerY + finalRadius * sin(finalAngle);

    return { x, y, radius: finalRadius };
  }

  paint(note, velocity, context) {
    const { paintCanvas, drumSettings, globalSizeMultiplier, particles, midiDeviceId } = context;

    // Get drum settings
    const drumId = findDrumByMidiNote(note, midiDeviceId, drumSettings);
    if (!drumId) return;

    const settings = drumSettings[drumId];

    // Get position on spiral
    const { x, y, radius } = this.getSpiralPosition(drumId, paintCanvas);

    // Check if position is still on canvas (with some margin)
    const margin = 100;
    if (x < -margin || x > paintCanvas.width + margin ||
        y < -margin || y > paintCanvas.height + margin) {
      // Reset spiral when it goes off canvas
      this.startTime = Date.now();
      return;
    }

    // Apply scaling curves to velocity-based values
    let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || 'linear');
    let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || 'linear');

    // Calculate size
    let size = (this.baseSize + scaledVelSize * this.velocityMult) * globalSizeMultiplier * getDrumSize(note, midiDeviceId, drumSettings);

    // Get visual properties
    let col = getDrumColor(note, midiDeviceId, scaledVelOpacity, drumSettings);
    let shape = getDrumShape(note, midiDeviceId, drumSettings);
    let opacityMult = getDrumOpacity(note, midiDeviceId, drumSettings);
    let stroke = getDrumStroke(note, midiDeviceId, drumSettings);
    let rotation = getDrumRotation(note, midiDeviceId, drumSettings);

    if (!col) return;

    // Paint the dot
    paintCanvas.push();
    paintDot(paintCanvas, x, y, size, col, ALPHA_CLASSIC * scaledVelOpacity * opacityMult, shape, stroke, rotation);
    paintCanvas.pop();

    // Add particle effect
    particles.push(new Particle(x, y, size, col));
  }

  /**
   * Set spiral parameters
   */
  setParameters(params) {
    if (params.tightness !== undefined) {
      this.spiralTightness = params.tightness;
    }
    if (params.rotationsPerMinute !== undefined) {
      this.rotationsPerMinute = params.rotationsPerMinute;
    }
    if (params.startRadius !== undefined) {
      this.startRadius = params.startRadius;
    }
    if (params.syncToBPM !== undefined) {
      this.syncToBPM = params.syncToBPM;
    }
  }

  /**
   * Reset the spiral (restart from center)
   */
  reset() {
    this.startTime = Date.now();
  }
}
