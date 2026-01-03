/**
 * Layout Calculator
 * Handles position calculations for different timeline layouts
 */

import {
  TIMELINE_RING_BASE_RADIUS,
  TIMELINE_RADIAL_BASE_DISTANCE,
  TIMELINE_RADIAL_STEP,
  TIMELINE_PETAL_BASE_RADIUS,
  TIMELINE_PETAL_STEP,
  TIMELINE_PETAL_OSCILLATION,
  TIMELINE_POLYGON_BASE_RADIUS,
  TIMELINE_POLYGON_STEP,
  TIMELINE_POLYGON_PULSE,
  TIMELINE_POLYGON_ROTATION_BEATS,
  TIMELINE_LANE_OFFSET,
  TIMELINE_SPIRAL_MAX_RADIUS_MULT
} from '../config/constants.js';

/**
 * Layout Calculator
 * Provides position calculations for different timeline layouts
 */
export class LayoutCalculator {
  /**
   * Calculate position for rings layout
   * Concentric circles - each drum gets a ring, angle represents time
   */
  static calculateRingsPosition(laneIndex, beatCount, beatsPerMeasure, ringSpacing, centerX, centerY) {
    const ringRadius = TIMELINE_RING_BASE_RADIUS + (laneIndex * ringSpacing);
    const angle = (beatCount / beatsPerMeasure) * Math.PI * 2;
    return {
      x: centerX + ringRadius * Math.cos(angle),
      y: centerY + ringRadius * Math.sin(angle)
    };
  }

  /**
   * Calculate position for radial layout
   * Spokes/rays - each drum gets a spoke, distance from center represents time
   */
  static calculateRadialPosition(laneIndex, laneCount, beatCount, centerX, centerY) {
    const spokeAngle = (laneIndex / laneCount) * Math.PI * 2;
    const distance = TIMELINE_RADIAL_BASE_DISTANCE + (beatCount * TIMELINE_RADIAL_STEP);
    return {
      x: centerX + distance * Math.cos(spokeAngle),
      y: centerY + distance * Math.sin(spokeAngle)
    };
  }

  /**
   * Calculate position for petals layout
   * Flower petals - each drum traces a petal curve
   */
  static calculatePetalsPosition(laneIndex, laneCount, beatCount, centerX, centerY) {
    const petalAngle = (laneIndex / laneCount) * Math.PI * 2;
    const petalRadius = TIMELINE_PETAL_BASE_RADIUS + (beatCount * TIMELINE_PETAL_STEP);
    const petalOscillation = Math.sin(beatCount * 0.5) * TIMELINE_PETAL_OSCILLATION;
    const petalX = centerX + (petalRadius + petalOscillation) * Math.cos(petalAngle);
    const petalY = centerY + (petalRadius + petalOscillation) * Math.sin(petalAngle);
    return { x: petalX, y: petalY };
  }

  /**
   * Calculate position for polygon layout
   * Rotating, pulsing polygon - drums at vertices
   */
  static calculatePolygonPosition(laneIndex, laneCount, beatCount, centerX, centerY) {
    // Base vertex angle (evenly distributed around circle)
    const baseVertexAngle = (laneIndex / laneCount) * Math.PI * 2;

    // Add rotation that increases with each beat (creates spiral effect)
    const rotationOffset = (beatCount * Math.PI * 2) / TIMELINE_POLYGON_ROTATION_BEATS;
    const rotatedVertexAngle = baseVertexAngle + rotationOffset;

    // Base radius expands with each beat
    const baseRadius = TIMELINE_POLYGON_BASE_RADIUS + (beatCount * TIMELINE_POLYGON_STEP);

    // Add subtle pulsing effect (breathing)
    const pulseAmount = Math.sin(beatCount * 0.25) * TIMELINE_POLYGON_PULSE;
    const polygonRadius = baseRadius + pulseAmount;

    return {
      x: centerX + polygonRadius * Math.cos(rotatedVertexAngle),
      y: centerY + polygonRadius * Math.sin(rotatedVertexAngle)
    };
  }

  /**
   * Calculate position for spiral layout
   * Archimedean spiral - one full rotation per measure, wraps back to center at edge
   */
  static calculateSpiralPosition(laneIndex, laneCount, beatCount, beatsPerMeasure, spiralSettings, centerX, centerY) {
    const { tightness, startRadius } = spiralSettings;

    const measurePosition = beatCount % beatsPerMeasure;
    const measureNumber = Math.floor(beatCount / beatsPerMeasure);

    // Angle within current measure (0 to 2π per measure)
    const theta = (measurePosition / beatsPerMeasure) * Math.PI * 2;

    // Add full rotations for completed measures
    const totalTheta = theta + (measureNumber * Math.PI * 2);

    // Calculate max radius based on canvas size (derived from center coordinates)
    const canvasWidth = centerX * 2;
    const canvasHeight = centerY * 2;
    const maxRadius = Math.min(canvasWidth, canvasHeight) / 2 * TIMELINE_SPIRAL_MAX_RADIUS_MULT;
    const radiusRange = maxRadius - startRadius;

    // Calculate how many measures fit in one cycle (out and back)
    const measuresPerCycle = Math.max(1, Math.floor(radiusRange / tightness) * 2);

    // Cycle the measure number to create out-and-back pattern
    const cycledMeasure = measureNumber % measuresPerCycle;
    const halfCycle = measuresPerCycle / 2;

    // Go outward for first half, inward for second half
    const effectiveMeasure = cycledMeasure < halfCycle
      ? cycledMeasure
      : measuresPerCycle - cycledMeasure;

    // Archimedean spiral with wrapping: r = a + b*measure
    const spiralRadius = startRadius + (effectiveMeasure * tightness);

    // Add lane offset for multiple drums
    const laneOffset = (laneIndex - (laneCount - 1) / 2) * TIMELINE_LANE_OFFSET;

    return {
      x: centerX + (spiralRadius + laneOffset) * Math.cos(totalTheta - Math.PI / 2),
      y: centerY + (spiralRadius + laneOffset) * Math.sin(totalTheta - Math.PI / 2)
    };
  }

  /**
   * Calculate position for staff layout
   * Traditional musical staff notation
   */
  static calculateStaffPosition(laneIndex, laneCount, timeElapsed, bpm, canvasWidth, options = {}) {
    const {
      pixelsPerSecond = 200,
      drumLineSpacing = 15,
      staffHeight = 80,
      measuresPerStaffPreference = 4,
      beatsPerMeasure = 4
    } = options;

    // Calculate effective pixels per second based on preference
    let effectivePixelsPerSecond = pixelsPerSecond;
    if (measuresPerStaffPreference > 0) {
      const maxStaffWidth = canvasWidth - 100;
      const secondsPerBeat = 60 / bpm;
      const pixelsPerMeasure = maxStaffWidth / measuresPerStaffPreference;
      const pixelsPerBeat = pixelsPerMeasure / beatsPerMeasure;
      effectivePixelsPerSecond = pixelsPerBeat / secondsPerBeat;
    }

    const maxStaffWidth = canvasWidth - 100;
    const secondsPerMeasure = (60 / bpm) * beatsPerMeasure;
    const pixelsPerMeasure = effectivePixelsPerSecond * secondsPerMeasure;
    const measuresPerStaff = Math.floor(maxStaffWidth / pixelsPerMeasure) || 1;
    const staffWidth = measuresPerStaff * pixelsPerMeasure;

    // Calculate total horizontal position
    const totalX = timeElapsed * effectivePixelsPerSecond;

    // Determine which staff row we're on
    const staffIndex = Math.floor(totalX / staffWidth);

    // Position within current staff
    const xInStaff = totalX % staffWidth;

    // Y position based on lane
    const yBase = staffIndex * (staffHeight + options.rowSpacing || 30);
    const y = yBase + TIMELINE_LANE_OFFSET + (laneIndex * drumLineSpacing);

    // Add left margin
    const x = 50 + xInStaff;

    return {
      x,
      y,
      staffIndex,
      staffWidth,
      measuresPerStaff,
      effectivePixelsPerSecond
    };
  }

  /**
   * Calculate layout position based on layout type
   */
  static calculatePosition(layout, params) {
    const {
      laneIndex,
      laneCount,
      beatCount,
      timeElapsed,
      bpm,
      beatsPerMeasure,
      centerX,
      centerY,
      canvasWidth,
      ringSpacing,
      spiralSettings,
      options
    } = params;

    switch (layout) {
      case 'rings':
        return this.calculateRingsPosition(laneIndex, beatCount, beatsPerMeasure, ringSpacing, centerX, centerY);

      case 'radial':
        return this.calculateRadialPosition(laneIndex, laneCount, beatCount, centerX, centerY);

      case 'petals':
        return this.calculatePetalsPosition(laneIndex, laneCount, beatCount, centerX, centerY);

      case 'polygon':
        return this.calculatePolygonPosition(laneIndex, laneCount, beatCount, centerX, centerY);

      case 'spiral':
        return this.calculateSpiralPosition(laneIndex, laneCount, beatCount, beatsPerMeasure, spiralSettings, centerX, centerY);

      case 'staff':
        return this.calculateStaffPosition(laneIndex, laneCount, timeElapsed, bpm, canvasWidth, options);

      default:
        // Default to center
        return { x: centerX, y: centerY };
    }
  }
}

export default LayoutCalculator;
