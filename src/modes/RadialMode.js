/**
 * Radial Symmetry Mode
 * Paints dots in radial symmetry patterns
 */

import { ModeBase } from './ModeBase.js';
import {
  BASE_SIZE_SYMMETRY,
  VELOCITY_MULT_SYMMETRY,
  ALPHA_SYMMETRY,
  SYMMETRY_ORDER,
  SYMMETRY_RADIUS_MIN,
  SYMMETRY_RADIUS_MAX
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

export class RadialMode extends ModeBase {
  constructor() {
    super('Radial Symmetry', BASE_SIZE_SYMMETRY, VELOCITY_MULT_SYMMETRY);
  }

  paint(note, velocity, context) {
    const { paintCanvas, drumSettings, globalSizeMultiplier, particles, midiDeviceId } = context;

    // Get drum settings
    const drumId = findDrumByMidiNote(note, midiDeviceId, drumSettings);
    if (!drumId) return; // Safety check - should never happen due to handlePaint check

    const settings = drumSettings[drumId];

    // Apply scaling curves
    let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || 'linear');
    let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || 'linear');

    // Random starting angle and radius
    let angle = random(TWO_PI / SYMMETRY_ORDER);
    let radius = random(SYMMETRY_RADIUS_MIN, SYMMETRY_RADIUS_MAX);
    let size = (this.baseSize + scaledVelSize * this.velocityMult) * globalSizeMultiplier * getDrumSize(note, midiDeviceId, drumSettings);

    // Get visual properties
    let col = getDrumColor(note, midiDeviceId, scaledVelOpacity, drumSettings);
    if (!col) return; // Safety check - should not happen but handle gracefully

    let shape = getDrumShape(note, midiDeviceId, drumSettings);
    let opacityMult = getDrumOpacity(note, midiDeviceId, drumSettings);
    let stroke = getDrumStroke(note, midiDeviceId, drumSettings);
    let rotation = getDrumRotation(note, midiDeviceId, drumSettings);

    paintCanvas.push();

    // Paint symmetrical pattern
    for (let i = 0; i < SYMMETRY_ORDER; i++) {
      let a = angle + (TWO_PI / SYMMETRY_ORDER) * i;
      let x = paintCanvas.width / 2 + cos(a) * radius;
      let y = paintCanvas.height / 2 + sin(a) * radius;

      paintDot(paintCanvas, x, y, size, col, ALPHA_SYMMETRY * scaledVelOpacity * opacityMult, shape, stroke, rotation);

      // Only add particle for first dot to avoid clutter
      if (i === 0) {
        particles.push(new Particle(x, y, size, col));
      }
    }

    paintCanvas.pop();
  }
}
