/**
 * Dendritic Spreading Mode
 * Creates tree-like branching patterns that flow from edges to center
 */

import { ModeBase } from './ModeBase.js';
import { applyScalingCurve } from '../utils/scaling.js';
import {
  DENDRITIC_BRANCH_BASE,
  DENDRITIC_BRANCH_VELOCITY_MULT,
  DENDRITIC_MAINSTEM_LENGTH_MULT
} from '../config/constants.js';
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

export class DendriticMode extends ModeBase {
  constructor() {
    super('Dendritic Spreading', 5, 12);
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

    // River outlet (downstream) - positioned randomly anywhere on canvas
    const margin = 100; // Keep away from edges for river growth
    const outletX = random(margin, paintCanvas.width - margin);
    const outletY = random(margin, paintCanvas.height - margin);

    // Calculate flow direction pointing AWAY from nearest edge
    // Find distances to each edge
    const distToLeft = outletX;
    const distToRight = paintCanvas.width - outletX;
    const distToTop = outletY;
    const distToBottom = paintCanvas.height - outletY;

    // Find the nearest edge
    const minDist = min(distToLeft, distToRight, distToTop, distToBottom);

    // Flow away from nearest edge (add slight randomization)
    let flowDirection;
    const angleVariation = random(-PI/6, PI/6); // ±30 degrees variation

    if (minDist === distToLeft) {
      // Near left edge - flow right
      flowDirection = 0 + angleVariation;
    } else if (minDist === distToRight) {
      // Near right edge - flow left
      flowDirection = PI + angleVariation;
    } else if (minDist === distToTop) {
      // Near top edge - flow down
      flowDirection = HALF_PI + angleVariation;
    } else {
      // Near bottom edge - flow up
      flowDirection = -HALF_PI + angleVariation;
    }

    let col = getDrumColor(note, midiDeviceId, scaledVelOpacity, drumSettings);
    if (!col) return;

    let shape = getDrumShape(note, midiDeviceId, drumSettings);
    let opacityMult = getDrumOpacity(note, midiDeviceId, drumSettings);
    let stroke = getDrumStroke(note, midiDeviceId, drumSettings);
    let rotation = getDrumRotation(note, midiDeviceId, drumSettings);

    paintCanvas.push();

    // River segment with stream order (Horton's Laws)
    class StreamSegment {
      constructor(startX, startY, order, flowAngle) {
        this.startX = startX;
        this.startY = startY;
        this.order = order; // Stream order (1 = headwater, higher = main channel)
        this.flowAngle = flowAngle;
        this.tributaries = [];
      }
    }

    const allSegments = [];

    // Create main channel with tributaries using Horton's Laws
    function createMainChannel(startX, startY, order, flowAngle, length) {
      const segment = new StreamSegment(startX, startY, order, flowAngle);
      allSegments.push(segment);

      // Calculate end point going upstream (add, not subtract)
      const sinuosity = random(-0.15, 0.15); // Slight curve
      const endX = startX + cos(flowAngle + sinuosity) * length;
      const endY = startY + sin(flowAngle + sinuosity) * length;

      segment.endX = endX;
      segment.endY = endY;

      // Stop at edge or max order - add some margin
      const margin = 50;
      if (order <= 0 || endX < margin || endX > paintCanvas.width - margin ||
          endY < margin || endY > paintCanvas.height - margin) {
        return segment;
      }

      // Add tributaries joining from sides (Horton's bifurcation ratio ~3-4)
      // Add randomization: velocity influences range, but each segment varies
      const velocityInfluence = scaledVelOpacity * DENDRITIC_BRANCH_BASE * DENDRITIC_BRANCH_VELOCITY_MULT;
      const minBranches = floor(DENDRITIC_BRANCH_BASE + velocityInfluence * 0.3);
      const maxBranches = floor(DENDRITIC_BRANCH_BASE + velocityInfluence * 1.7);
      const numTributaries = floor(random(minBranches, maxBranches + 1));

      for (let i = 0; i < numTributaries; i++) {
        // Tributaries join at positions along main channel
        const joinT = random(0.3, 0.9); // Join point along main channel
        const joinX = lerp(startX, endX, joinT);
        const joinY = lerp(startY, endY, joinT);

        // Tributary joins at acute angle (30-70 degrees typical)
        const side = random() > 0.5 ? 1 : -1; // Left or right side
        const junctionAngle = flowAngle + side * random(PI/6, PI/2.5); // 30-72 degrees

        // Tributary length decreases with lower order (Horton's length ratio ~2)
        const tributaryLength = length * random(0.4, 0.7);

        // Create tributary with lower order
        const tributary = createMainChannel(joinX, joinY, order - 1, junctionAngle, tributaryLength);
        segment.tributaries.push(tributary);
      }

      return segment;
    }

    // Create the main trunk starting from outlet
    const maxOrder = 2 + floor(scaledVelOpacity * 2);
    // Length proportional to velocity: soft hits = 30% length, hard hits = 100% length
    const velocityLengthMult = 0.3 + scaledVelOpacity * 0.7;
    const mainChannelLength = min(paintCanvas.width, paintCanvas.height) * 0.7 * DENDRITIC_MAINSTEM_LENGTH_MULT * velocityLengthMult;
    // River grows away from nearest edge (same direction as flow)
    const upstreamAngle = flowDirection;
    createMainChannel(outletX, outletY, maxOrder, upstreamAngle, mainChannelLength);

    // Draw a stream segment with natural meandering
    function drawStreamSegment(segment) {
      const segmentLength = dist(segment.startX, segment.startY, segment.endX, segment.endY);
      const numSteps = max(3, ceil(segmentLength / 4));

      // Width increases with stream order (Horton's width ratio)
      const baseSize = (2 + scaledVelSize * 10) * globalSizeMultiplier * getDrumSize(note, midiDeviceId, drumSettings);
      const streamWidth = baseSize * pow(1.8, segment.order - 1);

      // Calculate perpendicular for meandering
      const flowAngle = atan2(segment.endY - segment.startY, segment.endX - segment.startX);
      const perpAngle = flowAngle + HALF_PI;

      // Meandering parameters (higher order = less meandering)
      const meanderWavelength = segmentLength / (2 + segment.order * 0.5);
      const meanderAmplitude = streamWidth * (3 - segment.order * 0.5);

      let accumulatedDriftX = 0;
      let accumulatedDriftY = 0;

      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;

        // Base position
        let x = lerp(segment.startX, segment.endX, t);
        let y = lerp(segment.startY, segment.endY, t);

        // Sinusoidal meandering
        const meander = sin(t * TWO_PI * segmentLength / meanderWavelength) * meanderAmplitude * t;
        x += cos(perpAngle) * meander;
        y += sin(perpAngle) * meander;

        // Random walk for natural variability (less for higher order streams)
        const driftStrength = (1.5 / segment.order) * t;
        accumulatedDriftX += random(-driftStrength, driftStrength);
        accumulatedDriftY += random(-driftStrength, driftStrength);
        accumulatedDriftX *= 0.92;
        accumulatedDriftY *= 0.92;

        x += accumulatedDriftX;
        y += accumulatedDriftY;

        // Size varies slightly along stream
        const size = streamWidth * (1 + t * 0.15);

        // Opacity increases slightly downstream
        const alpha = (180 + segment.order * 20 + t * 40) * scaledVelOpacity * opacityMult;

        paintDot(paintCanvas, x, y, size, col, alpha, shape, stroke, rotation);
      }

      // Recursively draw tributaries
      for (let tributary of segment.tributaries) {
        drawStreamSegment(tributary);
      }
    }

    // Draw all segments starting from main channel
    for (let segment of allSegments) {
      if (segment.order === maxOrder) { // Draw from highest order (main trunk)
        drawStreamSegment(segment);
      }
    }

    // Draw the outlet (river mouth)
    const outletSize = (12 + scaledVelSize * 20) * globalSizeMultiplier * getDrumSize(note, midiDeviceId, drumSettings);
    paintDot(paintCanvas, outletX, outletY, outletSize, col, 240 * scaledVelOpacity * opacityMult, shape, stroke, rotation);

    // Add outlet delta
    for (let i = 0; i < 3; i++) {
      const spreadAngle = flowDirection + random(-PI/6, PI/6);
      const distance = random(outletSize * 0.5, outletSize * 1.2);
      const x = outletX + cos(spreadAngle) * distance;
      const y = outletY + sin(spreadAngle) * distance;
      paintDot(paintCanvas, x, y, outletSize * 0.7, col, 200 * scaledVelOpacity * opacityMult, shape, stroke, rotation);
    }

    paintCanvas.pop();
    particles.push(new Particle(outletX, outletY, 10, col));

    // Debug panel
    if (debugPanel && actualDrumId) {
      debugPanel.recordPaint(actualDrumId, note, velocity, {
        size: outletSize,
        opacity: (240 * scaledVelOpacity * opacityMult) / 255,
        color: col.toString('#rrggbb'),
        rotation: rotation,
        strokeColor: stroke?.enabled ? stroke.color : null,
        strokeWeight: stroke?.enabled ? stroke.weight : null
      });
    }
  }
}
