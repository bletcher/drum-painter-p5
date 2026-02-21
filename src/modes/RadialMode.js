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
import { findDrumByMidiNote } from '../utils/drumHelpers.js';
import { getColorWithHueVariation } from '../utils/colorUtils.js';
import { paintDot } from '../canvas/DrawingUtils.js';
import { Particle } from '../canvas/Particle.js';

export class RadialMode extends ModeBase {
  constructor() {
    super('Radial Symmetry', BASE_SIZE_SYMMETRY, VELOCITY_MULT_SYMMETRY);
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

    // Random starting angle and radius
    let angle = random(TWO_PI / SYMMETRY_ORDER);
    let radius = random(SYMMETRY_RADIUS_MIN, SYMMETRY_RADIUS_MAX);
    let size = (this.baseSize + scaledVelSize * this.velocityMult) * globalSizeMultiplier * (settings.size || 1.0);

    // Get visual properties directly from resolved settings
    let col = getColorWithHueVariation(settings, scaledVelOpacity);
    let shape = settings.shape;
    let opacityMult = settings.opacity || 1.0;
    let stroke = settings.strokeEnabled ? { enabled: true, weight: settings.strokeWeight || 2, color: settings.strokeColor || '#000000' } : { enabled: false };
    let rotation = settings.rotation || 0;

    // Calculate final opacity (alpha is 0-255 scale, convert to 0-1)
    const finalOpacity = (ALPHA_SYMMETRY * scaledVelOpacity * opacityMult) / 255;

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
