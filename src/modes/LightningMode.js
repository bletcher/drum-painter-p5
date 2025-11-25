/**
 * Lightning Mode
 * Creates realistic electrical discharge with fractal branching
 * Based on dielectric breakdown model (DBM) and stepped leader physics
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

    // Lightning origin - starts in upper area (cloud layer)
    const originX = random(paintCanvas.width * 0.1, paintCanvas.width * 0.9);
    const originY = random(paintCanvas.height * 0.1, paintCanvas.height * 0.4);

    // Strike downward like cloud-to-ground lightning (with slight variation)
    // HALF_PI = straight down, add variation of ±20 degrees
    const strikeAngle = HALF_PI + random(-PI/9, PI/9);

    let col = getDrumColor(note, midiDeviceId, scaledVelOpacity, drumSettings);
    if (!col) return;

    let shape = getDrumShape(note, midiDeviceId, drumSettings);

    // Block complex shapes for performance (multi-stroke mode)
    const FORBIDDEN_SHAPES = ['brushstroke', 'splatter', 'inkblot'];
    if (FORBIDDEN_SHAPES.includes(shape)) {
      shape = 'circle';
    }

    let opacityMult = getDrumOpacity(note, midiDeviceId, drumSettings);
    let stroke = getDrumStroke(note, midiDeviceId, drumSettings);
    let rotation = getDrumRotation(note, midiDeviceId, drumSettings);

    paintCanvas.push();

    // Lightning segment class
    class LightningSegment {
      constructor(x, y, angle, generation, energy) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.generation = generation; // 0 = main bolt, higher = branches
        this.energy = energy; // Decreases with branching
        this.children = [];
      }
    }

    // Build lightning tree using fractal branching
    function createLightningTree(startX, startY, startAngle, maxGenerations) {
      const root = new LightningSegment(startX, startY, startAngle, 0, 1.0);
      const allSegments = [root];

      function growBranch(parent, stepsRemaining) {
        if (stepsRemaining <= 0 || parent.energy < 0.1) return;

        // Stepped leader - create zigzag path with sudden direction changes
        const stepLength = random(8, 20); // Realistic step length
        const angleJitter = random(-PI/3, PI/3); // Sharp angular changes
        const newAngle = parent.angle + angleJitter;

        const newX = parent.x + cos(newAngle) * stepLength;
        const newY = parent.y + sin(newAngle) * stepLength;

        // Check bounds
        if (newX < 0 || newX > paintCanvas.width || newY < 0 || newY > paintCanvas.height) {
          return;
        }

        const segment = new LightningSegment(newX, newY, newAngle, parent.generation, parent.energy);
        parent.children.push(segment);
        allSegments.push(segment);

        // Branch probability increases with energy and velocity
        const branchProbability = 0.15 + scaledVelOpacity * 0.15;

        // Create side branches (lightning can split multiple times from same point)
        if (random() < branchProbability && parent.generation < maxGenerations) {
          // Can create 1-3 branches from same point
          const numBranches = random() < 0.7 ? 1 : (random() < 0.6 ? 2 : 3);

          for (let i = 0; i < numBranches; i++) {
            // Branch at wider angles (45-90 degrees from main)
            const branchAngle = newAngle + random(PI/4, HALF_PI) * (random() < 0.5 ? 1 : -1);
            const branchEnergy = parent.energy * random(0.5, 0.75); // Energy splits
            const branchSegment = new LightningSegment(
              newX,
              newY,
              branchAngle,
              parent.generation + 1,
              branchEnergy
            );
            segment.children.push(branchSegment);
            allSegments.push(branchSegment);

            // Continue branch with reduced steps
            growBranch(branchSegment, floor(stepsRemaining * random(0.4, 0.7)));
          }
        }

        // Continue main path
        growBranch(segment, stepsRemaining - 1);
      }

      // Start growing from origin
      const totalSteps = floor(15 + scaledVelOpacity * 25);
      const maxGen = floor(2 + scaledVelOpacity * 3);
      growBranch(root, totalSteps, maxGen);

      return allSegments;
    }

    // Create the lightning tree
    const maxGenerations = floor(2 + scaledVelOpacity * 3);
    const segments = createLightningTree(originX, originY, strikeAngle, maxGenerations);

    // Draw glow (corona) first - larger, fainter
    const baseSize = (3 + scaledVelSize * 10) * globalSizeMultiplier * getDrumSize(note, midiDeviceId, drumSettings);

    for (let segment of segments) {
      // Width decreases with generation (main bolt thickest)
      const widthScale = pow(0.65, segment.generation);
      const glowSize = baseSize * widthScale * 3;
      const glowAlpha = (80 * segment.energy * scaledVelOpacity * opacityMult);

      paintDot(paintCanvas, segment.x, segment.y, glowSize, col, glowAlpha, 'circle', null, 0);
    }

    // Draw bright core
    for (let segment of segments) {
      const widthScale = pow(0.65, segment.generation);
      const segmentSize = baseSize * widthScale;
      const segmentAlpha = (240 * segment.energy * scaledVelOpacity * opacityMult);

      paintDot(paintCanvas, segment.x, segment.y, segmentSize, col, segmentAlpha, shape, stroke, rotation);

      // Draw connecting lines for stronger visual continuity
      if (segment.children.length > 0) {
        for (let child of segment.children) {
          // Interpolate a few dots between parent and child
          const numInterps = 2;
          for (let i = 1; i <= numInterps; i++) {
            const t = i / (numInterps + 1);
            const interpX = lerp(segment.x, child.x, t);
            const interpY = lerp(segment.y, child.y, t);
            const interpSize = lerp(segmentSize, baseSize * pow(0.65, child.generation), t);
            const interpAlpha = lerp(segmentAlpha, 240 * child.energy * scaledVelOpacity * opacityMult, t);

            paintDot(paintCanvas, interpX, interpY, interpSize, col, interpAlpha, shape, stroke, rotation);
          }
        }
      }
    }

    // Add extra bright flash at origin
    const flashSize = baseSize * 2.5;
    paintDot(paintCanvas, originX, originY, flashSize, col, 255 * scaledVelOpacity * opacityMult, 'circle', null, 0);

    paintCanvas.pop();
    particles.push(new Particle(originX, originY, baseSize, col));

    // Record actual calculated values for debug panel
    if (debugPanel && actualDrumId) {
      debugPanel.recordPaint(actualDrumId, note, velocity, {
        size: baseSize,
        opacity: (240 * scaledVelOpacity * opacityMult) / 255,
        color: col.toString('#rrggbb'),
        rotation: rotation,
        strokeColor: stroke?.enabled ? stroke.color : null,
        strokeWeight: stroke?.enabled ? stroke.weight : null
      });
    }
  }
}
