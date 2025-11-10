/**
 * Dendritic Spreading Mode
 * Creates tree-like branching patterns that flow from edges to center
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

    // Central soma/convergence point (upstream)
    let somaX = random(paintCanvas.width * 0.3, paintCanvas.width * 0.7);
    let somaY = random(paintCanvas.height * 0.3, paintCanvas.height * 0.6);

    let col = getDrumColor(note, midiDeviceId, scaledVelOpacity, drumSettings);
    if (!col) return; // Safety check - should not happen but handle gracefully

    let shape = getDrumShape(note, midiDeviceId, drumSettings);
    let opacityMult = getDrumOpacity(note, midiDeviceId, drumSettings);
    let stroke = getDrumStroke(note, midiDeviceId, drumSettings);
    let rotation = getDrumRotation(note, midiDeviceId, drumSettings);

    paintCanvas.push();

    // Build a tree structure from soma outward, then draw it in reverse
    // This creates proper tributary merging

    class BranchNode {
      constructor(x, y, thickness, parent = null) {
        this.x = x;
        this.y = y;
        this.thickness = thickness;
        this.parent = parent;
        this.children = [];
      }
    }

    // Create the tree starting from soma
    const rootNode = new BranchNode(somaX, somaY, 1.0);
    const allNodes = [rootNode];

    // Recursively create branches
    function createBranches(node, depth, maxDepth, angle) {
      if (depth >= maxDepth) return;

      // Length decreases with depth
      const branchLength = (80 - depth * 15) * (0.5 + scaledVelOpacity * 0.5);

      // Number of child branches (2-4 for main branches, 2-3 for smaller)
      const numChildren = depth === 0 ? floor(3 + scaledVelOpacity * 3) : floor(2 + random(2));

      for (let i = 0; i < numChildren; i++) {
        // Calculate branch angle
        let branchAngle;
        if (depth === 0) {
          // Main branches spread evenly around the soma
          branchAngle = (TWO_PI / numChildren) * i + random(-PI/8, PI/8);
        } else {
          // Sub-branches split from parent angle
          const spread = PI / 3;
          branchAngle = angle + map(i, 0, numChildren - 1, -spread/2, spread/2) + random(-PI/12, PI/12);
        }

        // Calculate end position
        const endX = node.x + cos(branchAngle) * branchLength;
        const endY = node.y + sin(branchAngle) * branchLength;

        // Thickness decreases with depth
        const thickness = node.thickness * 0.6;

        // Create child node
        const childNode = new BranchNode(endX, endY, thickness, node);
        node.children.push(childNode);
        allNodes.push(childNode);

        // Recurse with lower probability at each level
        if (random(1) > depth * 0.2) {
          createBranches(childNode, depth + 1, maxDepth, branchAngle);
        }
      }
    }

    // Generate the tree structure
    const maxDepth = 3 + floor(scaledVelOpacity * 2);
    createBranches(rootNode, 0, maxDepth, 0);

    // Now draw the network from tips to root (downstream to upstream)
    // This makes tributaries appear to merge as they approach the center

    function drawPath(node) {
      if (!node.parent) return; // Don't draw from root

      const parent = node.parent;

      // Calculate cumulative thickness (thicker near root)
      const distToRoot = dist(node.x, node.y, somaX, somaY);
      const maxDist = paintCanvas.width * 0.6;
      const thicknessFactor = map(distToRoot, maxDist, 0, 0.3, 1.5);

      const baseSize = (2 + scaledVelSize * 8) * globalSizeMultiplier * getDrumSize(note, midiDeviceId, drumSettings);
      const nodeSize = baseSize * node.thickness * thicknessFactor;
      const parentSize = baseSize * parent.thickness * thicknessFactor * 1.2;

      // Draw segment from child to parent
      const numSteps = ceil(dist(node.x, node.y, parent.x, parent.y) / 3);

      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const x = lerp(node.x, parent.x, t);
        const y = lerp(node.y, parent.y, t);
        const size = lerp(nodeSize, parentSize, t);

        // Alpha increases toward root
        const alpha = map(t, 0, 1,
          140 * scaledVelOpacity * opacityMult,
          200 * scaledVelOpacity * opacityMult
        );

        paintDot(paintCanvas, x, y, size, col, alpha, shape, stroke, rotation);
      }
    }

    // Draw all paths
    for (let node of allNodes) {
      drawPath(node);
    }

    // Draw the soma (central convergence point) last, making it prominent
    const somaSize = (10 + scaledVelSize * 18) * globalSizeMultiplier * getDrumSize(note, midiDeviceId, drumSettings);
    paintDot(paintCanvas, somaX, somaY, somaSize, col, 240 * scaledVelOpacity * opacityMult, shape, stroke, rotation);

    // Add some extra emphasis dots around soma
    for (let i = 0; i < 3; i++) {
      const angle = random(TWO_PI);
      const distance = random(somaSize * 0.3, somaSize * 0.8);
      const x = somaX + cos(angle) * distance;
      const y = somaY + sin(angle) * distance;
      paintDot(paintCanvas, x, y, somaSize * 0.7, col, 200 * scaledVelOpacity * opacityMult, shape, stroke, rotation);
    }

    paintCanvas.pop();
    particles.push(new Particle(somaX, somaY, 10, col));

    // Record actual calculated values for debug panel (use soma size and average opacity)
    if (debugPanel && actualDrumId) {
      debugPanel.recordPaint(actualDrumId, note, velocity, {
        size: somaSize,
        opacity: (240 * scaledVelOpacity * opacityMult) / 255,
        color: col.toString('#rrggbb'),
        rotation: rotation,
        strokeColor: stroke?.enabled ? stroke.color : null,
        strokeWeight: stroke?.enabled ? stroke.weight : null
      });
    }
  }
}
