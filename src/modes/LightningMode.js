/**
 * Lightning Mode
 * Creates jagged electrical discharge effects
 */

import { ModeBase } from './ModeBase.js';
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

export class LightningMode extends ModeBase {
  constructor() {
    super('Lightning', 3, 10);
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

    // Lightning starts from random top area or side
    let startX, startY, endX, endY;
    const direction = random(1);

    if (direction < 0.5) {
      // Vertical lightning (top to bottom)
      startX = random(paintCanvas.width);
      startY = random(paintCanvas.height * 0.2);
      endX = startX + random(-100, 100);
      endY = random(paintCanvas.height * 0.6, paintCanvas.height * 0.9);
    } else {
      // Horizontal lightning (left to right or right to left)
      if (random(1) < 0.5) {
        startX = random(paintCanvas.width * 0.1);
        endX = random(paintCanvas.width * 0.6, paintCanvas.width * 0.9);
      } else {
        startX = random(paintCanvas.width * 0.9, paintCanvas.width);
        endX = random(paintCanvas.width * 0.1, paintCanvas.width * 0.4);
      }
      startY = random(paintCanvas.height);
      endY = startY + random(-100, 100);
    }

    let col = getDrumColor(note, midiDeviceId, scaledVelOpacity, drumSettings);
    if (!col) return; // Safety check - should not happen but handle gracefully

    let shape = getDrumShape(note, midiDeviceId, drumSettings);
    let opacityMult = getDrumOpacity(note, midiDeviceId, drumSettings);
    let stroke = getDrumStroke(note, midiDeviceId, drumSettings);
    let rotation = getDrumRotation(note, midiDeviceId, drumSettings);

    paintCanvas.push();

    // Create jagged lightning bolt
    const drawLightningBolt = (x1, y1, x2, y2, thickness, alpha) => {
      const segments = floor(10 + scaledVelOpacity * 15);
      let points = [{x: x1, y: y1}];

      // Create jagged path
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        let x = lerp(x1, x2, t);
        let y = lerp(y1, y2, t);

        // Add random offset perpendicular to the main direction
        const offset = random(-15, 15) * (1 - abs(t - 0.5) * 2); // More jagged in middle
        const angle = atan2(y2 - y1, x2 - x1) + HALF_PI;
        x += cos(angle) * offset;
        y += sin(angle) * offset;

        points.push({x, y});
      }
      points.push({x: x2, y: y2});

      // Draw the lightning bolt
      for (let i = 0; i < points.length; i++) {
        const size = thickness * random(0.7, 1.3);
        paintDot(paintCanvas, points[i].x, points[i].y, size, col, alpha, shape, stroke, rotation);

        // Randomly create side branches
        if (i > 0 && i < points.length - 1 && random(1) < 0.2) {
          const branchAngle = random(PI/4, PI/2) * (random(1) < 0.5 ? 1 : -1);
          const branchLength = random(20, 50);
          const branchEndX = points[i].x + cos(branchAngle) * branchLength;
          const branchEndY = points[i].y + sin(branchAngle) * branchLength;

          // Draw smaller branch
          const branchSegments = 3;
          for (let j = 0; j <= branchSegments; j++) {
            const bt = j / branchSegments;
            const bx = lerp(points[i].x, branchEndX, bt);
            const by = lerp(points[i].y, branchEndY, bt);
            paintDot(paintCanvas, bx, by, size * 0.6, col, alpha * 0.7, shape, stroke, rotation);
          }
        }
      }
    };

    // Main lightning bolt
    const mainThickness = (3 + scaledVelSize * 10) * globalSizeMultiplier * getDrumSize(note, midiDeviceId, drumSettings);
    const mainAlpha = 220 * scaledVelOpacity * opacityMult;
    drawLightningBolt(startX, startY, endX, endY, mainThickness, mainAlpha);

    // Add glow effect with fainter outer bolts
    if (scaledVelOpacity > 0.5) {
      drawLightningBolt(
        startX + random(-3, 3),
        startY + random(-3, 3),
        endX + random(-3, 3),
        endY + random(-3, 3),
        mainThickness * 1.5,
        mainAlpha * 0.3
      );
    }

    paintCanvas.pop();
    particles.push(new Particle(startX, startY, 8, col));

    // Record actual calculated values for debug panel
    if (debugPanel && actualDrumId) {
      debugPanel.recordPaint(actualDrumId, note, velocity, {
        size: mainThickness,
        opacity: (mainAlpha) / 255,
        color: col.toString('#rrggbb'),
        rotation: rotation,
        strokeColor: stroke?.enabled ? stroke.color : null,
        strokeWeight: stroke?.enabled ? stroke.weight : null
      });
    }
  }
}
