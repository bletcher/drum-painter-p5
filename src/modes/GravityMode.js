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
  GRAVITY_STEPS_VELOCITY_MULT,
  GRAVITY_STEP_MIN,
  GRAVITY_STEP_MAX,
  GRAVITY_DRIFT_MIN,
  GRAVITY_DRIFT_MAX
} from '../config/constants.js';
import { applyScalingCurve } from '../utils/scaling.js';
import { findDrumByMidiNote } from '../utils/drumHelpers.js';
import { getColorWithHueVariation } from '../utils/colorUtils.js';
import { paintDot } from '../canvas/DrawingUtils.js';
import { Particle } from '../canvas/Particle.js';

export class GravityMode extends ModeBase {
  constructor() {
    super('Gravity Field', BASE_SIZE_GRAVITY, VELOCITY_MULT_GRAVITY);
  }

  paint(note, velocity, context) {
    const { paintCanvas, drumSettings, globalSizeMultiplier, particles, midiDeviceId, debugPanel, drumId } = context;

    // Get drum settings (use drumId from context if available, otherwise find it)
    const actualDrumId = drumId || findDrumByMidiNote(note, midiDeviceId, drumSettings);
    if (!actualDrumId) return; // Safety check - should never happen due to handlePaint check

    const settings = drumSettings[actualDrumId];

    // Apply scaling curves
    let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || 'linear');
    let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || 'linear');

    // Start from top area
    let x = random(paintCanvas.width);
    let y = random(paintCanvas.height * 0.8);
    let size = (this.baseSize + scaledVelSize * this.velocityMult) * globalSizeMultiplier * (settings.size || 1.0);

    // Get visual properties directly from resolved settings
    let col = getColorWithHueVariation(settings, scaledVelOpacity);

    const FORBIDDEN_SHAPES = ['brushstroke', 'splatter', 'inkblot'];
    let shape = FORBIDDEN_SHAPES.includes(settings.shape) ? 'circle' : settings.shape;

    let opacityMult = settings.opacity || 1.0;
    let stroke = settings.strokeEnabled ? { enabled: true, weight: settings.strokeWeight || 2, color: settings.strokeColor || '#000000' } : { enabled: false };
    let rotation = settings.rotation || 0;

    // Calculate average opacity (starts higher, ends lower)
    const startingOpacity = (ALPHA_GRAVITY * scaledVelOpacity * opacityMult) / 255;
    const endingOpacity = (ALPHA_GRAVITY_MIN * scaledVelOpacity * opacityMult) / 255;
    const avgOpacity = (startingOpacity + endingOpacity) / 2;

    paintCanvas.push();

    // Paint falling trail
    // Steps scale with velocity: base steps + (velocity-scaled steps * velocity multiplier)
    let steps = floor(GRAVITY_STEPS_BASE + scaledVelOpacity * GRAVITY_STEPS_MULT * GRAVITY_STEPS_VELOCITY_MULT);

    // Calculate drift range based on velocity (higher velocity = more drift)
    const driftRange = (GRAVITY_DRIFT_MAX - GRAVITY_DRIFT_MIN) * scaledVelOpacity;
    const driftMin = GRAVITY_DRIFT_MIN * scaledVelOpacity;
    const driftMax = driftMin + driftRange;

    for (let i = 0; i < steps; i++) {
      y += random(GRAVITY_STEP_MIN, GRAVITY_STEP_MAX);
      // Velocity-dependent drift
      x += random(driftMin, driftMax);

      // Alpha decreases as it falls
      let alpha = map(i, 0, steps, ALPHA_GRAVITY * scaledVelOpacity * opacityMult, ALPHA_GRAVITY_MIN * scaledVelOpacity * opacityMult);
      // Pass alpha to stroke as well so it fades with the dots
      paintDot(paintCanvas, x, y, size, col, alpha, shape, stroke, rotation, alpha);

      // Stop if it goes off canvas
      if (y > paintCanvas.height) break;
    }

    paintCanvas.pop();

    // Add particle effect
    particles.push(new Particle(x, y, size, col));

    // Record actual calculated values for debug panel
    if (debugPanel && actualDrumId) {
      debugPanel.recordPaint(actualDrumId, note, velocity, {
        size: size,
        opacity: avgOpacity,
        color: col.toString('#rrggbb'),
        rotation: rotation,
        strokeColor: stroke?.enabled ? stroke.color : null,
        strokeWeight: stroke?.enabled ? stroke.weight : null
      });
    }
  }
}
