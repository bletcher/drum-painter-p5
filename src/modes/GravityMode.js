/**
 * Gravity Field Mode
 * Paints falling dots with gravity effect
 */

import { ModeBase } from './ModeBase.js';
import {
  BASE_SIZE_GRAVITY,
  VELOCITY_MULT_GRAVITY,
  ALPHA_GRAVITY,
  ALPHA_GRAVITY_MIN,
  GRAVITY_STEPS_BASE,
  GRAVITY_STEPS_MULT,
  GRAVITY_STEP_MIN,
  GRAVITY_STEP_MAX,
  GRAVITY_DRIFT_MIN,
  GRAVITY_DRIFT_MAX
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

export class GravityMode extends ModeBase {
  constructor() {
    super('Gravity Field', BASE_SIZE_GRAVITY, VELOCITY_MULT_GRAVITY);
  }

  paint(note, velocity, context) {
    const { paintCanvas, drumSettings, globalSizeMultiplier, particles } = context;

    // Get drum settings
    const drumId = findDrumByMidiNote(note, drumSettings);
    const settings = drumSettings[drumId];

    // Apply scaling curves
    let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || 'linear');
    let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || 'linear');

    // Start from top area
    let x = random(paintCanvas.width);
    let y = random(paintCanvas.height * 0.3);
    let size = (this.baseSize + scaledVelSize * this.velocityMult) * globalSizeMultiplier * getDrumSize(note, drumSettings);

    // Get visual properties
    let col = getDrumColor(note, scaledVelOpacity, drumSettings);
    let shape = getDrumShape(note, drumSettings);
    let opacityMult = getDrumOpacity(note, drumSettings);
    let stroke = getDrumStroke(note, drumSettings);
    let rotation = getDrumRotation(note, drumSettings);

    paintCanvas.push();

    // Paint falling trail
    let steps = floor(GRAVITY_STEPS_BASE + scaledVelOpacity * GRAVITY_STEPS_MULT);
    for (let i = 0; i < steps; i++) {
      y += random(GRAVITY_STEP_MIN, GRAVITY_STEP_MAX);
      x += random(GRAVITY_DRIFT_MIN, GRAVITY_DRIFT_MAX);

      // Alpha decreases as it falls
      let alpha = map(i, 0, steps, ALPHA_GRAVITY * scaledVelOpacity * opacityMult, ALPHA_GRAVITY_MIN * scaledVelOpacity * opacityMult);
      paintDot(paintCanvas, x, y, size, col, alpha, shape, stroke, rotation);

      // Stop if it goes off canvas
      if (y > paintCanvas.height) break;
    }

    paintCanvas.pop();

    // Add particle effect
    particles.push(new Particle(x, y, size, col));
  }
}
