/**
 * Fibonacci Spiral Mode
 * Paints dots in a golden spiral pattern
 */

import { ModeBase } from './ModeBase.js';
import {
  BASE_SIZE_FIBONACCI,
  VELOCITY_MULT_FIBONACCI,
  ALPHA_FIBONACCI,
  FIBONACCI_RADIUS_MULT
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

export class FibonacciMode extends ModeBase {
  constructor() {
    super('Fibonacci Spiral', BASE_SIZE_FIBONACCI, VELOCITY_MULT_FIBONACCI);
    this.spiralAngle = 0;
  }

  onActivate(context) {
    // Reset spiral angle when mode is activated
    this.spiralAngle = 0;
  }

  paint(note, velocity, context) {
    const { paintCanvas, drumSettings, globalSizeMultiplier, particles, strokeCount } = context;

    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
    this.spiralAngle += goldenAngle;

    // Get drum settings
    const drumId = findDrumByMidiNote(note, drumSettings);
    const settings = drumSettings[drumId];

    // Apply scaling curves
    let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || 'linear');
    let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || 'linear');

    // Calculate position in spiral
    let radius = Math.sqrt(strokeCount) * FIBONACCI_RADIUS_MULT;
    let x = paintCanvas.width / 2 + Math.cos(this.spiralAngle) * radius;
    let y = paintCanvas.height / 2 + Math.sin(this.spiralAngle) * radius;
    let size = (this.baseSize + scaledVelSize * this.velocityMult) * globalSizeMultiplier * getDrumSize(note, drumSettings);

    // Keep within bounds
    x = constrain(x, 0, paintCanvas.width);
    y = constrain(y, 0, paintCanvas.height);

    // Get visual properties
    let col = getDrumColor(note, scaledVelOpacity, drumSettings);
    let shape = getDrumShape(note, drumSettings);
    let opacityMult = getDrumOpacity(note, drumSettings);
    let stroke = getDrumStroke(note, drumSettings);
    let rotation = getDrumRotation(note, drumSettings);

    // Paint the dot
    paintCanvas.push();
    paintDot(paintCanvas, x, y, size, col, ALPHA_FIBONACCI * scaledVelOpacity * opacityMult, shape, stroke, rotation);
    paintCanvas.pop();

    // Add particle effect
    particles.push(new Particle(x, y, size, col));
  }
}
