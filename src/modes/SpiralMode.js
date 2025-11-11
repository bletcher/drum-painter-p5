/**
 * Spiral Chronicle Mode
 * Time flows outward in a spiral from the center
 * All notes appear sequentially on a visible spiral timeline
 */

import { ModeBase } from './ModeBase.js';
import {
  BASE_SIZE_CLASSIC,
  VELOCITY_MULT_CLASSIC,
  ALPHA_CLASSIC
} from '../config/constants.js';
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
    super('Chronicle', BASE_SIZE_CLASSIC, VELOCITY_MULT_CLASSIC);

    // Chronicle parameters
    this.startTime = null;
    this.spiralTightness = 15;        // Space between rotations (pixels per rotation)
    this.rotationsPerMinute = 4;      // How fast the spiral rotates (visual speed)
    this.startRadius = 50;            // Initial radius at center
    this.syncToBPM = false;           // Whether to sync rotation speed to BPM

    // Pattern selection: 'spiral', 'rays', 'helix', 'orbit'
    this.pattern = 'spiral';

    // Helix-specific parameters
    this.helixCount = 2;              // Number of intertwined helices
    this.helixPhaseOffset = 0;        // Phase offset for helix patterns

    // Orbit-specific parameters
    this.orbitSpacing = 80;           // Spacing between orbit radii
  }

  /**
   * Initialize when mode is activated
   */
  onActivate(context) {
    this.startTime = Date.now();
  }

  /**
   * Calculate current position on spiral based on elapsed time
   */
  getCurrentPosition() {
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
   * Get x,y coordinates for a given radius and theta
   */
  getSpiralCoordinates(radius, theta, centerX, centerY) {
    const x = centerX + radius * Math.cos(theta);
    const y = centerY + radius * Math.sin(theta);
    return { x, y };
  }

  /**
   * Calculate position based on selected pattern
   * Returns { x, y } coordinates for painting
   */
  getPatternPosition(drumIndex, totalDrums, centerX, centerY) {
    const { radius, theta } = this.getCurrentPosition();

    switch (this.pattern) {
      case 'spiral':
        // Original spiral pattern
        return this.getSpiralCoordinates(radius, theta, centerX, centerY);

      case 'rays':
        // Straight rays radiating from center
        // Each drum gets a fixed angle, distance = elapsed time
        const rayAngle = (drumIndex / totalDrums) * Math.PI * 2;
        const distance = radius; // Reuse radius calculation from spiral
        return {
          x: centerX + distance * Math.cos(rayAngle),
          y: centerY + distance * Math.sin(rayAngle)
        };

      case 'helix':
        // DNA-like double helix
        // Drums alternate between two helical paths
        const helixIndex = drumIndex % this.helixCount;
        const helixAngle = theta + (helixIndex * Math.PI * 2 / this.helixCount);
        const helixRadius = this.startRadius + 100; // Fixed radius for helix
        const helixX = centerX + helixRadius * Math.cos(helixAngle);
        const helixY = centerY + (radius - this.startRadius) * 0.5; // Vertical progress
        const helixOffset = Math.sin(helixAngle) * 50; // Oscillation
        return {
          x: helixX + helixOffset,
          y: helixY
        };

      case 'orbit':
        // Circular orbits at different radii
        // Each drum gets its own orbital radius, theta controls rotation
        const orbitRadius = this.startRadius + (drumIndex * this.orbitSpacing);
        return {
          x: centerX + orbitRadius * Math.cos(theta),
          y: centerY + orbitRadius * Math.sin(theta)
        };

      default:
        // Fallback to spiral
        return this.getSpiralCoordinates(radius, theta, centerX, centerY);
    }
  }

  /**
   * Draw the spiral timeline guide on the window canvas (not paintCanvas)
   * This draws a temporary guide that shows where notes will appear
   */
  draw(canvasWidth, canvasHeight) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const { theta: currentTheta } = this.getCurrentPosition();

    // Draw the spiral from start to current position using global p5 functions
    noFill();
    stroke(200, 200, 200, 120); // Light grey
    strokeWeight(2);

    beginShape();

    // Draw spiral from theta=0 to current theta
    const steps = Math.max(100, currentTheta * 20); // More steps for smoother curve
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * currentTheta;
      const r = this.startRadius + (this.spiralTightness * t / (Math.PI * 2));
      const coords = this.getSpiralCoordinates(r, t, centerX, centerY);
      vertex(coords.x, coords.y);
    }

    endShape();
  }

  paint(note, velocity, context) {
    const { paintCanvas, drumSettings, globalSizeMultiplier, particles, midiDeviceId, debugPanel, drumId, DRUM_KIT_CONFIG } = context;

    // Get drum settings (use drumId from context if available, otherwise find it)
    const actualDrumId = drumId || findDrumByMidiNote(note, midiDeviceId, drumSettings);
    if (!actualDrumId) return;

    const settings = drumSettings[actualDrumId];

    // Get drum index for pattern calculation
    const drumIndex = DRUM_KIT_CONFIG.findIndex(d => d.id === actualDrumId);
    if (drumIndex === -1) return;
    const totalDrums = DRUM_KIT_CONFIG.length;

    // Get position based on selected pattern
    const centerX = paintCanvas.width / 2;
    const centerY = paintCanvas.height / 2;
    const { x, y } = this.getPatternPosition(drumIndex, totalDrums, centerX, centerY);

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

    // Paint the dot on the spiral timeline
    paintCanvas.push();
    paintDot(paintCanvas, x, y, size, col, ALPHA_CLASSIC * scaledVelOpacity * opacityMult, shape, stroke, rotation);
    paintCanvas.pop();

    // Add particle effect
    particles.push(new Particle(x, y, size, col));

    // Record actual calculated values for debug panel
    if (debugPanel && actualDrumId) {
      debugPanel.recordPaint(actualDrumId, note, velocity, {
        size: size,
        opacity: (ALPHA_CLASSIC * scaledVelOpacity * opacityMult) / 255,
        color: col.toString('#rrggbb'),
        rotation: rotation,
        strokeColor: stroke?.enabled ? stroke.color : null,
        strokeWeight: stroke?.enabled ? stroke.weight : null
      });
    }
  }

  /**
   * Set chronicle parameters
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
    if (params.pattern !== undefined) {
      this.pattern = params.pattern;
    }
    if (params.helixCount !== undefined) {
      this.helixCount = params.helixCount;
    }
    if (params.orbitSpacing !== undefined) {
      this.orbitSpacing = params.orbitSpacing;
    }
  }

  /**
   * Reset the spiral (restart from center)
   */
  reset() {
    this.startTime = Date.now();
  }
}
