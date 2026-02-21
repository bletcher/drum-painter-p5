/**
 * Organic Growth Mode
 * Paints dots near moving growth points
 */

import { ModeBase } from './ModeBase.js';
import {
  BASE_SIZE_ORGANIC,
  VELOCITY_MULT_ORGANIC,
  ALPHA_ORGANIC,
  GROWTH_POINTS_COUNT,
  ORGANIC_DISTANCE_BASE,
  ORGANIC_DISTANCE_SPREAD,
  ORGANIC_MOVE_PROBABILITY,
  ORGANIC_MOVE_RANGE
} from '../config/constants.js';
import { applyScalingCurve } from '../utils/scaling.js';
import { findDrumByMidiNote } from '../utils/drumHelpers.js';
import { getColorWithHueVariation } from '../utils/colorUtils.js';
import { paintDot } from '../canvas/DrawingUtils.js';
import { Particle } from '../canvas/Particle.js';

export class OrganicMode extends ModeBase {
  constructor() {
    super('Organic Growth', BASE_SIZE_ORGANIC, VELOCITY_MULT_ORGANIC);
    this.growthPoints = [];
  }

  onActivate(context) {
    // Initialize growth points when mode is activated
    this.resetGrowthPoints(context.paintCanvas);
  }

  resetGrowthPoints(paintCanvas) {
    this.growthPoints = [];
    for (let i = 0; i < GROWTH_POINTS_COUNT; i++) {
      this.growthPoints.push(createVector(
        random(paintCanvas.width),
        random(paintCanvas.height)
      ));
    }
  }

  clear(context) {
    // Reset growth points when canvas is cleared
    if (context?.paintCanvas) {
      this.resetGrowthPoints(context.paintCanvas);
    }
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

    // Find nearest growth point
    let testPos = createVector(random(paintCanvas.width), random(paintCanvas.height));
    let nearest = this.growthPoints[0];
    let minDist = Infinity;

    for (let gp of this.growthPoints) {
      let d = p5.Vector.dist(testPos, gp);
      if (d < minDist) {
        minDist = d;
        nearest = gp;
      }
    }

    // Paint near growth point
    let angle = random(TWO_PI);
    let distance = randomGaussian() * ORGANIC_DISTANCE_SPREAD + ORGANIC_DISTANCE_BASE;
    let x = nearest.x + cos(angle) * distance;
    let y = nearest.y + sin(angle) * distance;
    let size = (this.baseSize + scaledVelSize * this.velocityMult) * globalSizeMultiplier * (settings.size || 1.0);

    // Keep within bounds
    x = constrain(x, 0, paintCanvas.width);
    y = constrain(y, 0, paintCanvas.height);

    // Get visual properties directly from resolved settings
    let col = getColorWithHueVariation(settings, scaledVelOpacity);
    let shape = settings.shape;
    let opacityMult = settings.opacity || 1.0;
    let stroke = settings.strokeEnabled ? { enabled: true, weight: settings.strokeWeight || 2, color: settings.strokeColor || '#000000' } : { enabled: false };
    let rotation = settings.rotation || 0;

    // Calculate final opacity (alpha is 0-255 scale, convert to 0-1)
    const finalOpacity = (ALPHA_ORGANIC * scaledVelOpacity * opacityMult) / 255;

    // Paint the dot
    paintCanvas.push();
    paintDot(paintCanvas, x, y, size, col, ALPHA_ORGANIC * scaledVelOpacity * opacityMult, shape, stroke, rotation);
    paintCanvas.pop();

    // Occasionally move growth point
    if (random(1) < ORGANIC_MOVE_PROBABILITY) {
      nearest.x += random(-ORGANIC_MOVE_RANGE, ORGANIC_MOVE_RANGE);
      nearest.y += random(-ORGANIC_MOVE_RANGE, ORGANIC_MOVE_RANGE);

      // Keep growth points within canvas with margin
      const margin = 50;
      nearest.x = constrain(nearest.x, margin, paintCanvas.width - margin);
      nearest.y = constrain(nearest.y, margin, paintCanvas.height - margin);
    }

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
