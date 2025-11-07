/**
 * Classic Pointillism Mode
 * Random dots scattered across the canvas
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

export class ClassicMode extends ModeBase {
  constructor() {
    super('Classic Pointillism', BASE_SIZE_CLASSIC, VELOCITY_MULT_CLASSIC);
  }

  paint(note, velocity, context) {
    const { paintCanvas, drumSettings, globalSizeMultiplier, particles, midiDeviceId } = context;

    // Random position
    let x = random(paintCanvas.width);
    let y = random(paintCanvas.height);

    // Get drum settings
    const drumId = findDrumByMidiNote(note, midiDeviceId, drumSettings);
    if (!drumId) return; // Safety check - should never happen due to handlePaint check

    const settings = drumSettings[drumId];

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

    // Safety check - should not happen but handle gracefully
    if (!col) return;

    // Paint the dot
    paintCanvas.push();
    paintDot(paintCanvas, x, y, size, col, ALPHA_CLASSIC * scaledVelOpacity * opacityMult, shape, stroke, rotation);
    paintCanvas.pop();

    // Add particle effect
    particles.push(new Particle(x, y, size, col));
  }
}
