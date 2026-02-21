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
import { findDrumByMidiNote } from '../utils/drumHelpers.js';
import { getColorWithHueVariation } from '../utils/colorUtils.js';
import { paintDot } from '../canvas/DrawingUtils.js';
import { Particle } from '../canvas/Particle.js';

export class ClassicMode extends ModeBase {
  constructor() {
    super('Classic Pointillism', BASE_SIZE_CLASSIC, VELOCITY_MULT_CLASSIC);
  }

  paint(note, velocity, context) {
    const { paintCanvas, drumSettings, globalSizeMultiplier, particles, midiDeviceId, debugPanel, drumId } = context;

    // Random position (p5.js global functions)
    let x = random(paintCanvas.width);
    let y = random(paintCanvas.height);

    // Get drum settings (use drumId from context if available, otherwise find it)
    const actualDrumId = drumId || findDrumByMidiNote(note, midiDeviceId, drumSettings);

    if (!actualDrumId) {
      return; // Safety check - should never happen due to handlePaint check
    }

    const settings = drumSettings[actualDrumId];

    // Apply scaling curves to velocity-based values
    let scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || 'linear');
    let scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || 'linear');

    // Get visual properties directly from settings (since we already have the drumId)
    // Calculate size
    let size = (this.baseSize + scaledVelSize * this.velocityMult) * globalSizeMultiplier * (settings.size || 1.0);

    let col = getColorWithHueVariation(settings, scaledVelOpacity);
    let shape = settings.shape;
    let opacityMult = settings.opacity || 1.0;
    let stroke = settings.strokeEnabled ? { enabled: true, weight: settings.strokeWeight || 2, color: settings.strokeColor || '#000000' } : { enabled: false };
    let rotation = settings.rotation || 0;

    // Calculate final opacity (alpha is 0-255 scale, convert to 0-1)
    const finalOpacity = (ALPHA_CLASSIC * scaledVelOpacity * opacityMult) / 255;

    // Paint the dot
    paintCanvas.push();
    paintDot(paintCanvas, x, y, size, col, ALPHA_CLASSIC * scaledVelOpacity * opacityMult, shape, stroke, rotation);
    paintCanvas.pop();

    // Add particle effect
    particles.push(new Particle(x, y, size, col));

    // Record actual calculated values for debug panel
    if (debugPanel && actualDrumId) {
      debugPanel.recordPaint(actualDrumId, note, velocity, {
        size: size,
        opacity: finalOpacity,
        color: col.toString('#rrggbb'),
        rotation: rotation,
        strokeColor: stroke?.enabled ? stroke.color : null,
        strokeWeight: stroke?.enabled ? stroke.weight : null
      });
    }
  }
}
