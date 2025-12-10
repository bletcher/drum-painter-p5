/**
 * Timeline Renderer
 * Handles drawing of timeline grids, playheads, and guides
 */

import {
  TIMELINE_LANE_OFFSET,
  PLAYHEAD_BASE_WEIGHT,
  PLAYHEAD_PULSE_WEIGHT,
  PLAYHEAD_PULSE_DECAY
} from '../config/constants.js';

/**
 * Timeline Renderer
 * Provides rendering functions for timeline visualizations
 */
export class TimelineRenderer {
  /**
   * Draw staff grid overlay
   * @param {Object} p5 - p5.js instance
   * @param {Object} options - Rendering options
   */
  static drawStaffGrid(p5, options) {
    const {
      offsetX,
      offsetY,
      scale,
      canvasWidth,
      canvasHeight,
      timeElapsed,
      bpm,
      beatsPerMeasure,
      subdivision,
      pixelsPerSecond,
      drumLineSpacing,
      laneCount,
      lanes,
      drumSettings,
      staffHeight,
      rowSpacing,
      measuresPerStaffPreference,
      showGrid,
      warmupMeasures
    } = options;

    if (!showGrid) return;

    p5.push();
    p5.colorMode(p5.RGB, 255);

    // Calculate beat/measure metrics
    const secondsPerBeat = 60 / bpm;
    const secondsPerSubdivision = secondsPerBeat / (subdivision / 4);
    const maxStaffWidth = canvasWidth - 100;

    // Calculate effective pixels per second based on user preference
    let effectivePixelsPerSecond = pixelsPerSecond;
    if (measuresPerStaffPreference > 0) {
      const pixelsPerMeasure = maxStaffWidth / measuresPerStaffPreference;
      const pixelsPerBeat = pixelsPerMeasure / beatsPerMeasure;
      effectivePixelsPerSecond = pixelsPerBeat / secondsPerBeat;
    }

    const secondsPerMeasure = secondsPerBeat * beatsPerMeasure;
    const pixelsPerMeasure = effectivePixelsPerSecond * secondsPerMeasure;
    const measuresPerStaff = Math.max(1, Math.floor(maxStaffWidth / pixelsPerMeasure));
    const staffWidth = measuresPerStaff * pixelsPerMeasure;

    // Calculate warmup offset
    const warmupSeconds = warmupMeasures * secondsPerMeasure;

    // Draw multiple staff rows
    const totalStaffs = Math.ceil(canvasHeight / (staffHeight + rowSpacing)) + 1;

    for (let staffIndex = 0; staffIndex < totalStaffs; staffIndex++) {
      const staffY = staffIndex * (staffHeight + rowSpacing);
      const staffScreenY = (staffY * scale) + offsetY;

      // Skip if staff is off-screen
      if (staffScreenY > p5.height + 100 || staffScreenY < -staffHeight * scale - 100) continue;

      // Draw staff background
      p5.noStroke();
      p5.fill(255, 255, 255, 30);
      p5.rect(offsetX + 50 * scale, staffScreenY, staffWidth * scale, staffHeight * scale);

      // Draw horizontal lane lines
      for (let laneIdx = 0; laneIdx < laneCount; laneIdx++) {
        const y = staffY + TIMELINE_LANE_OFFSET + (laneIdx * drumLineSpacing);
        const screenY = (y * scale) + offsetY;

        p5.stroke(100, 100, 100, 80);
        p5.strokeWeight(0.5);
        p5.line(offsetX + 50 * scale, screenY, offsetX + (50 + staffWidth) * scale, screenY);
      }

      // Draw measure bar lines
      for (let measure = 0; measure <= measuresPerStaff; measure++) {
        const x = 50 + (measure * pixelsPerMeasure);
        const screenX = (x * scale) + offsetX;

        // Measure lines (thick)
        p5.stroke(80, 80, 80, 150);
        p5.strokeWeight(measure === 0 || measure === measuresPerStaff ? 2 : 1);
        p5.line(screenX, staffScreenY, screenX, staffScreenY + staffHeight * scale);

        // Beat lines (medium)
        if (measure < measuresPerStaff) {
          for (let beat = 1; beat < beatsPerMeasure; beat++) {
            const beatX = x + (beat * (pixelsPerMeasure / beatsPerMeasure));
            const beatScreenX = (beatX * scale) + offsetX;

            p5.stroke(120, 120, 120, 100);
            p5.strokeWeight(0.5);
            p5.line(beatScreenX, staffScreenY, beatScreenX, staffScreenY + staffHeight * scale);
          }
        }
      }

      // Draw drum labels on left side of each staff
      p5.textAlign(p5.RIGHT, p5.CENTER);
      p5.textSize(9 * scale);
      p5.noStroke();

      for (const [drumId, laneIdx] of Object.entries(lanes)) {
        const y = staffY + TIMELINE_LANE_OFFSET + (laneIdx * drumLineSpacing);
        const screenY = (y * scale) + offsetY;

        // Get drum name and color
        const drum = drumSettings[drumId];
        if (drum) {
          p5.fill(drum.color || '#888888');
          p5.text(drum.name || drumId, offsetX + 45 * scale, screenY);
        }
      }
    }

    // Draw playhead if recording
    if (timeElapsed !== null && timeElapsed !== undefined) {
      this.drawPlayhead(p5, {
        timeElapsed,
        offsetX,
        offsetY,
        scale,
        effectivePixelsPerSecond,
        staffWidth,
        staffHeight,
        rowSpacing
      });
    }

    p5.pop();
  }

  /**
   * Draw playhead indicator
   */
  static drawPlayhead(p5, options) {
    const {
      timeElapsed,
      offsetX,
      offsetY,
      scale,
      effectivePixelsPerSecond,
      staffWidth,
      staffHeight,
      rowSpacing
    } = options;

    // Calculate total horizontal position
    const totalX = timeElapsed * effectivePixelsPerSecond;

    // Determine which staff row we're on
    const staffIndex = Math.floor(totalX / staffWidth);

    // Position within current staff
    const xInStaff = totalX % staffWidth;

    // Calculate playhead position
    const playheadX = 50 + xInStaff;
    const staffY = staffIndex * (staffHeight + rowSpacing);

    const screenX = (playheadX * scale) + offsetX;
    const screenY = (staffY * scale) + offsetY;

    // Pulse effect
    const pulsePhase = (Date.now() % 500) / 500;
    const pulseIntensity = Math.sin(pulsePhase * Math.PI * 2) * 0.3 + 0.7;

    // Draw playhead
    p5.stroke(255, 50, 50, 200 * pulseIntensity);
    p5.strokeWeight(PLAYHEAD_BASE_WEIGHT + (PLAYHEAD_PULSE_WEIGHT * pulseIntensity));
    p5.line(screenX, screenY, screenX, screenY + staffHeight * scale);

    // Draw playhead triangle marker at top
    p5.fill(255, 50, 50, 200);
    p5.noStroke();
    p5.triangle(
      screenX - 6, screenY - 2,
      screenX + 6, screenY - 2,
      screenX, screenY + 4
    );
  }

  /**
   * Draw spiral guide
   */
  static drawSpiralGuide(p5, options) {
    const {
      centerX,
      centerY,
      spiralSettings,
      beatCount,
      beatsPerMeasure,
      scale
    } = options;

    const { tightness, startRadius } = spiralSettings;

    p5.push();
    p5.stroke(100, 100, 100, 50);
    p5.strokeWeight(1);
    p5.noFill();

    // Draw spiral guide path
    p5.beginShape();
    for (let i = 0; i <= 360 * 4; i += 5) {
      const theta = (i / 360) * Math.PI * 2;
      const growthRate = tightness / (Math.PI * 2);
      const r = startRadius + (growthRate * theta);

      const x = centerX + r * Math.cos(theta - Math.PI / 2);
      const y = centerY + r * Math.sin(theta - Math.PI / 2);

      p5.vertex(x, y);
    }
    p5.endShape();

    // Draw current position marker
    const measurePosition = beatCount % beatsPerMeasure;
    const measureNumber = Math.floor(beatCount / beatsPerMeasure);
    const currentTheta = ((measurePosition / beatsPerMeasure) * Math.PI * 2) + (measureNumber * Math.PI * 2);
    const growthRate = tightness / (Math.PI * 2);
    const currentRadius = startRadius + (growthRate * currentTheta);

    p5.fill(255, 100, 100, 150);
    p5.noStroke();
    const markerX = centerX + currentRadius * Math.cos(currentTheta - Math.PI / 2);
    const markerY = centerY + currentRadius * Math.sin(currentTheta - Math.PI / 2);
    p5.ellipse(markerX, markerY, 10 * scale);

    p5.pop();
  }

  /**
   * Draw rings guide
   */
  static drawRingsGuide(p5, options) {
    const {
      centerX,
      centerY,
      laneCount,
      ringSpacing
    } = options;

    p5.push();
    p5.noFill();
    p5.stroke(100, 100, 100, 40);
    p5.strokeWeight(1);

    for (let i = 0; i < laneCount; i++) {
      const radius = 50 + (i * ringSpacing);
      p5.ellipse(centerX, centerY, radius * 2);
    }

    p5.pop();
  }

  /**
   * Draw radial spokes guide
   */
  static drawRadialGuide(p5, options) {
    const {
      centerX,
      centerY,
      laneCount,
      maxRadius = 400
    } = options;

    p5.push();
    p5.stroke(100, 100, 100, 40);
    p5.strokeWeight(1);

    for (let i = 0; i < laneCount; i++) {
      const angle = (i / laneCount) * Math.PI * 2;
      p5.line(
        centerX,
        centerY,
        centerX + maxRadius * Math.cos(angle),
        centerY + maxRadius * Math.sin(angle)
      );
    }

    p5.pop();
  }
}

export default TimelineRenderer;
