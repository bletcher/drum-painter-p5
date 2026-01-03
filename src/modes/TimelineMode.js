/**
 * Timeline/Sequencer Mode
 * Time-based/sequential paint modes with deterministic positioning
 * Includes Staff, Spiral, Fibonacci, Radial layouts
 */

import { FibonacciMode } from './FibonacciMode.js';
import { RadialMode } from './RadialMode.js';
import {
  DEFAULT_TIMELINE_SUBDIVISION,
  TIMELINE_ROW_SPACING,
  TIMELINE_RING_SPACING,
  TIMELINE_POLYGON_SIDES,
  TIMELINE_LANE_OFFSET,
  TIMELINE_SPIRAL_TIGHTNESS,
  TIMELINE_SPIRAL_ROTATIONS_PER_MIN,
  TIMELINE_SPIRAL_START_RADIUS,
  TIMELINE_SPIRAL_MAX_RADIUS_MULT,
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
  METRONOME_RADIUS,
  METRONOME_DEFAULT_MARGIN,
  METRONOME_PULSE_THRESHOLD,
  METRONOME_MARKER_SIZE_FIRST,
  METRONOME_MARKER_SIZE_BEAT,
  METRONOME_MARKER_SIZE_SUB,
  METRONOME_HAND_OFFSET,
  METRONOME_FREQ_FIRST_BEAT,
  METRONOME_FREQ_BEAT,
  METRONOME_FREQ_SUBDIVISION,
  METRONOME_GAIN_FIRST,
  METRONOME_GAIN_BEAT,
  METRONOME_GAIN_SUB,
  METRONOME_CLICK_DURATION,
  TIMELINE_DOT_BASE_SIZE,
  TIMELINE_DOT_VELOCITY_MULT,
  TIMELINE_DOT_ALPHA,
  TIMELINE_PARTICLE_LIFE,
  TIMELINE_PARTICLE_ALPHA,
  PLAYHEAD_BASE_WEIGHT,
  PLAYHEAD_PULSE_WEIGHT,
  PLAYHEAD_PULSE_DECAY
} from '../config/constants.js';
import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';

export class TimelineMode {
  constructor(drumKitConfig) {
    this.name = 'Timeline/Sequencer';
    this.drumKitConfig = drumKitConfig;

    // Timeline state
    this.recording = false;
    this.startTime = null; // When recording started (millis)
    this.pausedTime = 0; // Accumulated paused time in milliseconds
    this.stopTime = null; // When we last stopped recording

    // Musical settings
    this.bpm = 80; // Beats per minute
    this.subdivision = DEFAULT_TIMELINE_SUBDIVISION; // Beat subdivision (4 = quarter notes, 8 = eighth notes, 12 = eighth triplets, 16 = sixteenth notes)
    this.beatsPerMeasure = 4; // Time signature numerator (2/4, 3/4, 4/4, etc.)
    this.midiLatencyMs = 70; // MIDI latency compensation in milliseconds
    this.warmupMeasures = 0; // Number of measures to wait before painting (0-4)

    // Layout selection: 'staff', 'spiral', 'fibonacci', 'radial'
    this.layout = 'staff';

    // Initialize layout delegates for non-staff modes
    this.layoutModes = {
      fibonacci: new FibonacciMode(),
      radial: new RadialMode()
    };

    // Metronome position (draggable)
    this.metronomeX = null; // null = use default position
    this.metronomeY = null;
    this.metronomeDragging = false;
    this.metronomeDragOffsetX = 0;
    this.metronomeDragOffsetY = 0;

    // Grid/Staff layout
    this.pixelsPerSecond = 200; // How many pixels = 1 second
    this.staffWidth = 1800; // Width before wrapping to next staff (calculated dynamically)
    this.staffHeight = 80; // Total height of one staff (calculated based on drum count in regenerateLanes)
    this.drumLineSpacing = 15; // Vertical spacing between drum lines
    this.measuresPerStaff = 4; // Number of complete measures per staff row (calculated dynamically)
    this.measuresPerStaffPreference = 4; // User preference: 0 = auto, or specific number
    this.showGrid = true; // Show/hide grid lines
    this.rowSpacing = TIMELINE_ROW_SPACING; // Vertical spacing between staff rows (pixels)

    // Layout-specific parameters
    this.ringSpacing = TIMELINE_RING_SPACING; // Spacing between concentric rings
    this.petalCount = 0; // Auto-calculated from drum count
    this.polygonSides = TIMELINE_POLYGON_SIDES; // Number of sides for polygon layout
    this.spiralSettings = {
      tightness: TIMELINE_SPIRAL_TIGHTNESS,         // Space between rotations (pixels per rotation)
      rotationsPerMinute: TIMELINE_SPIRAL_ROTATIONS_PER_MIN, // How fast the spiral rotates (visual speed)
      startRadius: TIMELINE_SPIRAL_START_RADIUS,       // Initial radius at center
      syncToBPM: false,      // Whether to sync rotation speed to BPM
      pattern: 'spiral'      // Pattern type (for future expansion)
    };

    // Metronome state
    this.metronomeEnabled = false;
    this.lastMetronomeClick = -1; // Last subdivision index that played a click
    this.lastMetronomeBPM = 120;
    this.lastMetronomeSubdivision = 4;
    this.audioContext = null; // Web Audio API context

    // Hit counters for point-based layouts (fibonacci, radial)
    this.globalHitCount = 0; // Total hits across all drums
    this.perDrumHitCount = {}; // Hits per individual drum

    // Timeline lanes (generated from drum kit config)
    this.timelineLanes = {};
    this.timelineLaneCount = 0;
    this.regenerateLanes();
  }

  /**
   * Regenerate timeline lanes from current drum settings
   * @param {Object} drumSettings - Current drum settings (optional, uses drumKitConfig if not provided)
   * @param {Array} drumOrder - Explicit drum ordering (optional, falls back to Object.keys or drumKitConfig)
   */
  regenerateLanes(drumSettings = null, drumOrder = null) {
    this.timelineLanes = {};

    if (drumOrder && Array.isArray(drumOrder) && drumOrder.length > 0) {
      // Use explicit drumOrder as source of truth (preferred)
      drumOrder.forEach((drumId, index) => {
        // Only add drums that exist in drumSettings (if provided) or always add if no settings
        if (!drumSettings || drumId in drumSettings) {
          this.timelineLanes[drumId] = index;
        }
      });
      this.timelineLaneCount = Object.keys(this.timelineLanes).length;

      debugLog(`📋 Timeline lanes regenerated from drumOrder: ${this.timelineLaneCount} drums`);
      debugLog('   Drum order:', drumOrder);
      debugLog('   Lane mapping:', this.timelineLanes);
    } else if (drumSettings) {
      // Fallback: Use drum settings keys (maintains insertion order in ES6+)
      const drumIds = Object.keys(drumSettings);
      drumIds.forEach((drumId, index) => {
        this.timelineLanes[drumId] = index;
      });
      this.timelineLaneCount = drumIds.length;

      debugLog(`📋 Timeline lanes regenerated from settings: ${this.timelineLaneCount} drums`);
      debugLog('   Drum order:', drumIds);
      debugLog('   Lane mapping:', this.timelineLanes);
    } else {
      // Fallback to drum kit config (only used during initial constructor call)
      this.drumKitConfig.forEach((drum, index) => {
        this.timelineLanes[drum.id] = index;
      });
      this.timelineLaneCount = this.drumKitConfig.length;
      debugLog(`📋 Timeline lanes initialized from config: ${this.timelineLaneCount} drums`);
    }

    // Update staff height based on number of drums
    // Each drum gets drumLineSpacing, plus one extra spacing at the top
    this.staffHeight = (this.timelineLaneCount * this.drumLineSpacing) + this.drumLineSpacing;
  }

  /**
   * Called when timeline mode is activated
   * @param {Object} context - Context object with paintCanvas, drumSettings, and drumOrder
   */
  onActivate({ paintCanvas, drumSettings, drumOrder }) {
    debugLog('Timeline Mode activated');
    debugLog('🎵 Metronome enabled:', this.metronomeEnabled);
    debugLog('🎵 Audio context exists:', !!this.audioContext);
    // Ensure timeline lanes match current drum configuration
    // Use drumOrder if available, otherwise fall back to window.drumOrder or drumSettings keys
    this.regenerateLanes(drumSettings, drumOrder || window.drumOrder);

    // Note: Audio context initialization moved to startRecording()
    // because browser autoplay policy requires user interaction
  }

  /**
   * Called when timeline mode is deactivated
   */
  onDeactivate({ paintCanvas }) {
    this.stopRecording();

    // Close audio context to prevent memory leak
    if (this.audioContext) {
      this.audioContext.close().then(() => {
        debugLog('🎵 Audio context closed');
      }).catch(err => {
        debugWarn('⚠️ Error closing audio context:', err);
      });
      this.audioContext = null;
    }
  }

  /**
   * Calculate effective pixels per second based on user preference
   * @param {number} canvasWidth - The canvas width
   * @returns {number} - Effective pixels per second for positioning
   */
  getEffectivePixelsPerSecond(canvasWidth) {
    if (this.measuresPerStaffPreference === 0) {
      // Auto mode: use default spacing
      return this.pixelsPerSecond;
    } else {
      // User-specified number of measures: calculate adjusted spacing
      const maxStaffWidth = canvasWidth - 100;
      const secondsPerBeat = 60 / this.bpm;
      const pixelsPerMeasure = maxStaffWidth / this.measuresPerStaffPreference;
      const pixelsPerBeat = pixelsPerMeasure / this.beatsPerMeasure;
      return pixelsPerBeat / secondsPerBeat;
    }
  }

  /**
   * Calculate position based on selected layout
   * @param {string} drumId - The drum ID
   * @param {number} beatCount - Current beat count from start
   * @param {number} timeElapsed - Time elapsed in seconds
   * @param {number} centerX - Canvas center X
   * @param {number} centerY - Canvas center Y
   * @param {number} canvasWidth - Canvas width for spacing calculations
   * @returns {Object} - { x, y } coordinates for painting
   */
  getLayoutPosition(drumId, beatCount, timeElapsed, centerX, centerY, canvasWidth) {
    const laneIndex = this.timelineLanes[drumId];
    const secondsPerBeat = 60 / this.bpm;

    switch (this.layout) {
      case 'rings':
        // Concentric circles - each drum gets a ring, angle represents time
        const ringRadius = TIMELINE_RING_BASE_RADIUS + (laneIndex * this.ringSpacing);
        const angle = (beatCount / this.beatsPerMeasure) * Math.PI * 2;
        return {
          x: centerX + ringRadius * Math.cos(angle),
          y: centerY + ringRadius * Math.sin(angle)
        };

      case 'radial':
        // Spokes/rays - each drum gets a spoke, distance from center represents time
        const spokeAngle = (laneIndex / this.timelineLaneCount) * Math.PI * 2;
        const distance = TIMELINE_RADIAL_BASE_DISTANCE + (beatCount * TIMELINE_RADIAL_STEP);
        return {
          x: centerX + distance * Math.cos(spokeAngle),
          y: centerY + distance * Math.sin(spokeAngle)
        };

      case 'petals':
        // Flower petals - each drum traces a petal curve
        const petalAngle = (laneIndex / this.timelineLaneCount) * Math.PI * 2;
        const petalRadius = TIMELINE_PETAL_BASE_RADIUS + (beatCount * TIMELINE_PETAL_STEP);
        const petalOscillation = Math.sin(beatCount * 0.5) * TIMELINE_PETAL_OSCILLATION;
        const petalX = centerX + (petalRadius + petalOscillation) * Math.cos(petalAngle);
        const petalY = centerY + (petalRadius + petalOscillation) * Math.sin(petalAngle);
        return { x: petalX, y: petalY };

      case 'polygon':
        // Rotating, pulsing polygon - drums at vertices
        // Creates a spiraling geometric pattern with organic breathing effect

        // Base vertex angle (evenly distributed around circle)
        const baseVertexAngle = (laneIndex / this.timelineLaneCount) * Math.PI * 2;

        // Add rotation that increases with each beat (creates spiral effect)
        const rotationOffset = (beatCount * Math.PI * 2) / TIMELINE_POLYGON_ROTATION_BEATS;
        const rotatedVertexAngle = baseVertexAngle + rotationOffset;

        // Base radius expands with each beat
        const baseRadius = TIMELINE_POLYGON_BASE_RADIUS + (beatCount * TIMELINE_POLYGON_STEP);

        // Add subtle pulsing effect (breathing)
        // Slower oscillation than flower mode for more geometric feel
        const pulseAmount = Math.sin(beatCount * 0.25) * TIMELINE_POLYGON_PULSE;
        const polygonRadius = baseRadius + pulseAmount;

        return {
          x: centerX + polygonRadius * Math.cos(rotatedVertexAngle),
          y: centerY + polygonRadius * Math.sin(rotatedVertexAngle)
        };

      case 'spiral':
        // Archimedean spiral - notes appear exactly where/when played
        // One full rotation per measure, wraps back to center when reaching edge

        // Complete one rotation per measure to match metronome pattern
        const measurePosition = beatCount % this.beatsPerMeasure;
        const measureNumber = Math.floor(beatCount / this.beatsPerMeasure);

        // Angle within current measure (0 to 2π per measure)
        // Uses exact beatCount for precise positioning along the spiral
        const theta = (measurePosition / this.beatsPerMeasure) * Math.PI * 2;

        // Calculate max radius based on canvas size
        const canvasHeight = centerY * 2;
        const maxRadius = Math.min(canvasWidth, canvasHeight) / 2 * TIMELINE_SPIRAL_MAX_RADIUS_MULT;
        const radiusRange = maxRadius - this.spiralSettings.startRadius;

        // Calculate how many measures fit in one cycle (out and back)
        const measuresPerCycle = Math.max(1, Math.floor(radiusRange / this.spiralSettings.tightness) * 2);

        // Cycle the measure number to create out-and-back pattern
        const cycledMeasure = measureNumber % measuresPerCycle;
        const halfCycle = measuresPerCycle / 2;

        // Go outward for first half, inward for second half
        const effectiveMeasure = cycledMeasure < halfCycle
          ? cycledMeasure
          : measuresPerCycle - cycledMeasure;

        // Radius increases with each complete measure (now cycled)
        const spiralRadius = this.spiralSettings.startRadius +
                           (effectiveMeasure * this.spiralSettings.tightness);

        // Offset each drum slightly radially based on lane
        const laneOffset = (laneIndex - this.timelineLaneCount / 2) * TIMELINE_LANE_OFFSET;
        const finalRadius = spiralRadius + laneOffset;

        return {
          x: centerX + finalRadius * Math.cos(theta),
          y: centerY + finalRadius * Math.sin(theta)
        };

      case 'staff':
      default:
        // Original horizontal staff layout
        const effectivePixelsPerSecond = this.getEffectivePixelsPerSecond(canvasWidth);
        const totalX = timeElapsed * effectivePixelsPerSecond;
        const staffIndex = Math.floor(totalX / this.staffWidth);
        const xInStaff = totalX % this.staffWidth;
        const staffY = staffIndex * (this.staffHeight + this.rowSpacing);
        const laneY = staffY + (laneIndex * this.drumLineSpacing) + this.drumLineSpacing;
        return { x: xInStaff, y: laneY };
    }
  }

  /**
   * Check if we're still in the warm-up period
   * @returns {boolean} - True if in warm-up, false if ready to paint
   */
  isInWarmup() {
    if (!this.recording || !this.startTime || this.warmupMeasures === 0) {
      return false;
    }

    const currentTime = Date.now();
    const timeElapsed = (currentTime - this.startTime - this.pausedTime) / 1000.0;
    const secondsPerBeat = 60 / this.bpm;
    const secondsPerMeasure = secondsPerBeat * this.beatsPerMeasure;
    const warmupDuration = secondsPerMeasure * this.warmupMeasures;

    return timeElapsed < warmupDuration;
  }

  /**
   * Get the effective time elapsed for visual/painting purposes
   * During warm-up, returns 0. After warm-up, returns actual time minus warm-up duration.
   * @returns {number} - Time in seconds for visual timeline position
   */
  getEffectiveTimeElapsed() {
    if (!this.startTime) return 0;

    // Use stopTime if stopped, otherwise use current time
    const currentTime = this.recording ? Date.now() : (this.stopTime || Date.now());
    const actualTimeElapsed = (currentTime - this.startTime - this.pausedTime) / 1000.0;

    if (this.warmupMeasures === 0) {
      return actualTimeElapsed;
    }

    const secondsPerBeat = 60 / this.bpm;
    const secondsPerMeasure = secondsPerBeat * this.beatsPerMeasure;
    const warmupDuration = secondsPerMeasure * this.warmupMeasures;

    // During warm-up, return 0. After warm-up, return time minus warm-up duration
    return Math.max(0, actualTimeElapsed - warmupDuration);
  }

  /**
   * Paint method - draws notes on timeline lanes
   */
  paint(note, velocity, context) {
    // Delegate to layout-specific modes (Fibonacci, Radial)
    if (this.layout === 'fibonacci' && this.layoutModes.fibonacci) {
      this.layoutModes.fibonacci.paint(note, velocity, context);
      return;
    }
    if (this.layout === 'radial' && this.layoutModes.radial) {
      this.layoutModes.radial.paint(note, velocity, context);
      return;
    }

    // Staff and Spiral layouts use timeline recording logic
    const { paintCanvas, drumSettings, midiDeviceId, debugPanel, drumId: contextDrumId } = context;

    // Find which drum this is (use contextDrumId if available, otherwise find it)
    const drumId = contextDrumId || this.findDrumIdByNote(note, midiDeviceId, drumSettings);
    if (!drumId) {
      debugWarn(`⚠️ Note ${note} - No drum ID found in drumSettings`);
      debugWarn(`   Available drums:`, Object.keys(drumSettings));
      return;
    }
    if (!(drumId in this.timelineLanes)) {
      debugWarn(`⚠️ Note ${note} (${drumId}) - Drum ID not in timeline lanes`);
      debugWarn(`   Timeline lanes:`, this.timelineLanes);
      debugWarn(`   This drum exists in settings but was not added to timeline lanes!`);
      return;
    }

    // Determine if this layout is time-based or point-based
    // Time-based: position determined by elapsed time, requires Start button, syncs with metronome
    // Point-based: position determined by hit count, no temporal relationship
    const isTimeBased = ['staff', 'spiral', 'rings', 'petals', 'polygon'].includes(this.layout);
    const isPointBased = ['fibonacci', 'radial'].includes(this.layout);

    // Only require recording for time-based layouts
    // Point-based layouts (fibonacci, radial) can paint anytime
    if (isTimeBased && !this.recording) {
      debugLog('Timeline not recording - press Start button first');
      return;
    }

    // Don't paint if we're still in warm-up period (only for time-based layouts)
    if (isTimeBased && this.isInWarmup()) {
      return;
    }

    // Calculate beat count based on layout type
    let beatCount;
    let timeElapsed;

    if (isPointBased) {
      // Point-based layouts: use hit count instead of time
      // Initialize per-drum counter if needed
      if (this.perDrumHitCount[drumId] === undefined) {
        this.perDrumHitCount[drumId] = 0;
      }

      // Increment counters
      this.globalHitCount++;
      this.perDrumHitCount[drumId]++;

      // Use global hit count for position (all drums contribute to progression)
      beatCount = this.globalHitCount;
      timeElapsed = 0; // Not used for point-based layouts
    } else {
      // Time-based layouts: use elapsed time
      // Calculate effective time elapsed (accounts for warm-up period)
      // Also subtract MIDI latency compensation to align notes with grid
      timeElapsed = this.getEffectiveTimeElapsed() - (this.midiLatencyMs / 1000.0);
      const secondsPerBeat = 60 / this.bpm;
      beatCount = timeElapsed / secondsPerBeat;
    }

    // Get position based on selected layout
    const centerX = paintCanvas.width / 2;
    const centerY = paintCanvas.height / 2;
    const { x, y } = this.getLayoutPosition(drumId, beatCount, timeElapsed, centerX, centerY, paintCanvas.width);

    // For staff layout, ensure canvas is tall enough (other layouts don't need this)
    if (this.layout === 'staff') {
      const effectivePixelsPerSecond = this.getEffectivePixelsPerSecond(paintCanvas.width);
      const totalX = timeElapsed * effectivePixelsPerSecond;
      const staffIndex = Math.floor(totalX / this.staffWidth);
      const requiredHeight = (staffIndex + 1) * (this.staffHeight + this.rowSpacing) + 100;
      if (paintCanvas.height < requiredHeight) {
        this.expandCanvasHeight(paintCanvas, requiredHeight, context);
      }
    }

    // Get drum settings
    const settings = drumSettings[drumId];
    const scaledVelSize = this.applyScalingCurve(velocity, settings?.sizeScaling || 'linear');
    const scaledVelOpacity = this.applyScalingCurve(velocity, settings?.opacityScaling || 'linear');

    const col = this.getDrumColor(note, midiDeviceId, scaledVelOpacity, drumSettings);
    if (!col) return; // Safety check - should not happen but handle gracefully
    const shape = settings?.shape || 'circle';
    const sizeMultiplier = settings?.size || 1.0;
    const opacityMult = settings?.opacity || 1.0;
    const stroke = settings?.strokeEnabled ? {
      enabled: true,
      weight: settings.strokeWeight || 2,
      color: settings.strokeColor || '#000000'
    } : { enabled: false };
    const rotation = settings?.rotation || 0;

    // Size based on velocity
    const size = (TIMELINE_DOT_BASE_SIZE + scaledVelSize * TIMELINE_DOT_VELOCITY_MULT) * sizeMultiplier * context.globalSizeMultiplier;
    const alpha = TIMELINE_DOT_ALPHA * scaledVelOpacity * opacityMult;

    // Paint the dot
    paintCanvas.push();
    this.paintDot(paintCanvas, x, y, size, col, alpha, shape, stroke, rotation);
    paintCanvas.pop();

    // Add particle for visual feedback
    if (context.particles) {
      context.particles.push({
        x: x,
        y: y,
        size: size,
        color: col,
        life: TIMELINE_PARTICLE_LIFE,
        maxLife: TIMELINE_PARTICLE_LIFE,
        update: function() { this.life--; },
        display: function(offsetX, offsetY, scale) {
          if (this.life > 0) {
            const alpha = (this.life / this.maxLife) * TIMELINE_PARTICLE_ALPHA;
            window.push();
            window.fill(window.red(this.color), window.green(this.color), window.blue(this.color), alpha);
            window.noStroke();
            window.circle(offsetX + this.x * scale, offsetY + this.y * scale, this.size * scale * 0.5);
            window.pop();
          }
        },
        isDead: function() { return this.life <= 0; }
      });
    }

    // Record actual calculated values for debug panel
    if (debugPanel && drumId) {
      debugPanel.recordPaint(drumId, note, velocity, {
        size: size,
        opacity: alpha / 255,
        color: col.toString('#rrggbb'),
        rotation: rotation,
        strokeColor: stroke?.enabled ? stroke.color : null,
        strokeWeight: stroke?.enabled ? stroke.weight : null
      });
    }
  }

  /**
   * Update method - called every frame
   * Handles metronome updates
   */
  update(context) {
    // Update metronome if enabled AND actively recording
    if (this.metronomeEnabled && this.startTime && this.recording) {
      this.updateMetronome();
    }
  }

  /**
   * Draw circular visual metronome on window canvas
   * Called from main draw loop when metronome is enabled
   */
  drawCircularMetronome(p5Instance, canvasWidth, canvasHeight) {
    if (!this.metronomeEnabled) return;
    if (!this.startTime) return;
    if (!this.recording) return; // Stop visual metronome when recording ends

    const currentTime = Date.now();
    const timeElapsed = (currentTime - this.startTime - this.pausedTime) / 1000.0;

    // Calculate timing
    const secondsPerBeat = 60 / this.bpm;
    const secondsPerSubdivision = secondsPerBeat / (this.subdivision / 4);
    const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);

    // Position (use custom position if set, otherwise default to bottom right)
    const defaultX = canvasWidth - METRONOME_DEFAULT_MARGIN;
    const defaultY = canvasHeight - METRONOME_DEFAULT_MARGIN;
    const centerX = this.metronomeX !== null ? this.metronomeX : defaultX;
    const centerY = this.metronomeY !== null ? this.metronomeY : defaultY;
    const radius = METRONOME_RADIUS;

    // Check if mouse is over metronome (for drag detection)
    const mouseX = p5Instance.mouseX;
    const mouseY = p5Instance.mouseY;
    const distFromCenter = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));
    const isMouseOver = distFromCenter < radius;

    p5Instance.push();
    p5Instance.colorMode(p5Instance.RGB, 255);

    // Draw outer circle with hover effect
    p5Instance.noFill();
    if (isMouseOver || this.metronomeDragging) {
      p5Instance.stroke(150, 200, 255, 220);
      p5Instance.strokeWeight(3);
      // Change cursor
      p5Instance.cursor(p5Instance.MOVE);
    } else {
      p5Instance.stroke(200, 200, 200, 180);
      p5Instance.strokeWeight(2);
    }
    p5Instance.circle(centerX, centerY, radius * 2);

    // Calculate current subdivision in measure
    const currentSubdivision = timeElapsed / secondsPerSubdivision;
    const subdivisionInMeasure = currentSubdivision % subdivisionsPerMeasure;

    // Draw subdivision markers
    const subdivisionsPerQuarter = this.subdivision / 4;
    for (let i = 0; i < subdivisionsPerMeasure; i++) {
      const angle = (i / subdivisionsPerMeasure) * Math.PI * 2 - Math.PI / 2; // Start at top
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // Determine if this is a beat or first beat
      const isBeat = (i % subdivisionsPerQuarter) === 0;
      const isFirstBeat = i === 0;

      // Check if marker should pulse (within threshold subdivisions of current position)
      const distance = Math.abs(subdivisionInMeasure - i);
      const wrappedDistance = Math.min(distance, subdivisionsPerMeasure - distance);
      const isPulsing = wrappedDistance < METRONOME_PULSE_THRESHOLD;

      // Size and color based on type and pulse
      let markerSize = METRONOME_MARKER_SIZE_SUB;
      let markerAlpha = 150;

      if (isFirstBeat) {
        markerSize = METRONOME_MARKER_SIZE_FIRST;
        p5Instance.fill(255, 100, 100, isPulsing ? 255 : markerAlpha);
      } else if (isBeat) {
        markerSize = METRONOME_MARKER_SIZE_BEAT;
        p5Instance.fill(100, 150, 255, isPulsing ? 255 : markerAlpha);
      } else {
        markerSize = METRONOME_MARKER_SIZE_SUB;
        p5Instance.fill(150, 150, 150, isPulsing ? 220 : markerAlpha);
      }

      // Add pulse glow effect
      if (isPulsing) {
        p5Instance.noStroke();
        p5Instance.fill(255, 255, 255, 80);
        p5Instance.circle(x, y, markerSize * 2.5);
      }

      p5Instance.noStroke();
      p5Instance.circle(x, y, markerSize);
    }

    // Draw sweeping hand
    const handAngle = (subdivisionInMeasure / subdivisionsPerMeasure) * Math.PI * 2 - Math.PI / 2;
    const handLength = radius - METRONOME_HAND_OFFSET;
    const handX = centerX + Math.cos(handAngle) * handLength;
    const handY = centerY + Math.sin(handAngle) * handLength;

    p5Instance.stroke(255, 150, 50, 200);
    p5Instance.strokeWeight(3);
    p5Instance.line(centerX, centerY, handX, handY);

    // Draw center dot
    p5Instance.fill(255, 150, 50, 255);
    p5Instance.noStroke();
    p5Instance.circle(centerX, centerY, 8);

    // Draw BPM text below circle
    p5Instance.fill(200, 200, 200, 200);
    p5Instance.noStroke();
    p5Instance.textAlign(p5Instance.CENTER, p5Instance.CENTER);
    p5Instance.textSize(12);
    p5Instance.text(`${this.bpm} BPM`, centerX, centerY + radius + 15);

    // Draw current beat text
    const currentBeat = Math.floor(currentSubdivision / subdivisionsPerQuarter) % this.beatsPerMeasure + 1;
    const currentMeasure = Math.floor(currentSubdivision / subdivisionsPerMeasure) + 1;
    p5Instance.textSize(10);
    p5Instance.text(`M${currentMeasure} B${currentBeat}`, centerX, centerY + radius + 28);

    p5Instance.pop();
  }

  /**
   * Handle mouse press on metronome
   * Returns true if metronome was clicked (to prevent other interactions)
   */
  handleMetronomeMousePressed(mouseX, mouseY) {
    if (!this.metronomeEnabled) return false;

    // Use default position if not set
    const centerX = this.metronomeX !== null ? this.metronomeX : (window.width - METRONOME_DEFAULT_MARGIN);
    const centerY = this.metronomeY !== null ? this.metronomeY : (window.height - METRONOME_DEFAULT_MARGIN);
    const radius = METRONOME_RADIUS;

    const distFromCenter = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));
    if (distFromCenter < radius) {
      this.metronomeDragging = true;
      this.metronomeDragOffsetX = mouseX - centerX;
      this.metronomeDragOffsetY = mouseY - centerY;
      return true;
    }
    return false;
  }

  /**
   * Handle mouse drag on metronome
   */
  handleMetronomeMouseDragged(mouseX, mouseY) {
    if (this.metronomeDragging) {
      this.metronomeX = mouseX - this.metronomeDragOffsetX;
      this.metronomeY = mouseY - this.metronomeDragOffsetY;
    }
  }

  /**
   * Handle mouse release on metronome
   */
  handleMetronomeMouseReleased() {
    this.metronomeDragging = false;
  }

  /**
   * Expand canvas height dynamically
   */
  expandCanvasHeight(paintCanvas, requiredHeight, context) {
    const oldHeight = paintCanvas.height;
    const tempImg = paintCanvas.get();

    // Resize canvas
    paintCanvas.resizeCanvas(paintCanvas.width, requiredHeight);

    // Draw saved content back
    paintCanvas.image(tempImg, 0, 0);

    // Fill new area with background color
    paintCanvas.push();
    paintCanvas.noStroke();
    const bgColor = context.currentBgColor || '#ffffff';
    paintCanvas.fill(bgColor);
    paintCanvas.rect(0, oldHeight, paintCanvas.width, requiredHeight - oldHeight);
    paintCanvas.pop();
  }

  /**
   * Start recording
   */
  startRecording(startOver = false) {
    debugLog('⏯️ Start button clicked - startRecording() called');
    debugLog('  metronomeEnabled:', this.metronomeEnabled);
    debugLog('  audioContext exists:', !!this.audioContext);

    this.recording = true;

    // Hide quick settings panel when recording starts
    const quickSettingsPanel = document.getElementById('drum-settings');
    if (quickSettingsPanel) {
      quickSettingsPanel.style.display = 'none';
    }

    // Initialize audio context for metronome (user interaction = browser allows audio)
    if (this.metronomeEnabled) {
      if (!this.audioContext) {
        debugLog('  → Initializing audio context...');
        this.initializeAudioContext();
        debugLog('  → Audio context state after init:', this.audioContext?.state);
      } else {
        debugLog('  → Audio context already exists, state:', this.audioContext.state);
      }
    } else {
      debugLog('  → Metronome is disabled, skipping audio init');
    }

    if (startOver) {
      // Start from beginning
      this.startTime = Date.now();
      this.pausedTime = 0;
      this.stopTime = null;
      this.lastMetronomeClick = -1;
      debugLog('Timeline recording started (from beginning)');
    } else {
      // Continue recording
      if (this.startTime !== null && this.stopTime !== null) {
        // Calculate paused duration
        const pauseDuration = Date.now() - this.stopTime;
        this.pausedTime += pauseDuration;
        this.stopTime = null;

        // Sync metronome to current position
        const currentTime = Date.now();
        const timeElapsed = (currentTime - this.startTime - this.pausedTime) / 1000.0;
        const secondsPerBeat = 60 / this.bpm;
        const secondsPerSubdivision = secondsPerBeat / (this.subdivision / 4);
        const exactSubdivision = timeElapsed / secondsPerSubdivision;
        this.lastMetronomeClick = Math.round(exactSubdivision) - 1;

        debugLog(`Timeline recording continued (paused for ${pauseDuration}ms)`);
      } else {
        // First time starting
        this.startTime = Date.now();
        this.pausedTime = 0;
        this.stopTime = null;
        this.lastMetronomeClick = -1;
        debugLog('Timeline recording started');
      }
    }
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (!this.recording) return;

    this.recording = false;
    this.stopTime = Date.now();
    debugLog('Timeline recording stopped');

    // Show quick settings panel when recording stops
    const quickSettingsPanel = document.getElementById('drum-settings');
    if (quickSettingsPanel) {
      quickSettingsPanel.style.display = 'block';
    }
  }

  /**
   * Clear timeline and reset
   */
  clearTimeline(paintCanvas, context) {
    this.recording = false;
    this.startTime = null;
    this.pausedTime = 0;
    this.stopTime = null;
    this.lastMetronomeClick = -1;

    // Reset hit counters for point-based layouts
    this.globalHitCount = 0;
    this.perDrumHitCount = {};

    // Clear canvas
    const bgColor = context.currentBgColor || '#ffffff';

    // Temporarily reset blend mode to normal for clearing
    const BLEND_MODES = window.BLEND_MODES || [window.BLEND];
    const currentBlendMode = window.currentBlendMode || 0;
    paintCanvas.blendMode(window.BLEND);
    paintCanvas.background(bgColor);
    paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

    debugLog('Timeline cleared');
  }

  /**
   * Clear mode-specific state (called when canvas is cleared)
   * @param {Object} context - Painting context
   */
  clear(context) {
    this.recording = false;
    this.startTime = null;
    this.pausedTime = 0;
    this.stopTime = null;
    this.lastMetronomeClick = -1;

    // Reset hit counters for point-based layouts
    this.globalHitCount = 0;
    this.perDrumHitCount = {};

    debugLog('Timeline state cleared');
  }

  /**
   * Update metronome - play click sounds based on BPM and subdivision
   */
  updateMetronome() {
    if (!this.startTime) {
      debugWarn('⚠️ No startTime for metronome');
      return;
    }
    if (!this.audioContext) {
      debugWarn('⚠️ No audioContext for metronome');
      return;
    }

    // Reset if BPM or subdivision changed
    if (this.lastMetronomeBPM !== this.bpm || this.lastMetronomeSubdivision !== this.subdivision) {
      this.lastMetronomeClick = -1;
      this.lastMetronomeBPM = this.bpm;
      this.lastMetronomeSubdivision = this.subdivision;
    }

    const currentTime = Date.now();
    const timeElapsed = (currentTime - this.startTime - this.pausedTime) / 1000.0;

    const secondsPerBeat = 60 / this.bpm;
    const secondsPerSubdivision = secondsPerBeat / (this.subdivision / 4);

    // Calculate which subdivision we're on
    const currentSubdivision = Math.floor(timeElapsed / secondsPerSubdivision);

    // Play click if we've crossed into a new subdivision
    if (currentSubdivision > this.lastMetronomeClick) {
      this.lastMetronomeClick = currentSubdivision;

      const subdivisionsPerQuarter = this.subdivision / 4;
      const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);

      const isFirstBeat = (currentSubdivision % subdivisionsPerMeasure) === 0;
      const isBeat = (currentSubdivision % subdivisionsPerQuarter) === 0;

      // Play click
      debugLog(`🎵 Metronome click: subdivision ${currentSubdivision}, firstBeat=${isFirstBeat}, beat=${isBeat}`);
      this.playMetronomeClick(isFirstBeat, isBeat);
    }
  }

  /**
   * Play metronome click sound
   */
  playMetronomeClick(isFirstBeat, isBeat) {
    if (!this.audioContext) {
      debugWarn('⚠️ No audio context for metronome');
      return;
    }

    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Different tones for different beats
    if (isFirstBeat) {
      oscillator.frequency.value = METRONOME_FREQ_FIRST_BEAT;
      gainNode.gain.value = METRONOME_GAIN_FIRST;
    } else if (isBeat) {
      oscillator.frequency.value = METRONOME_FREQ_BEAT;
      gainNode.gain.value = METRONOME_GAIN_BEAT;
    } else {
      oscillator.frequency.value = METRONOME_FREQ_SUBDIVISION;
      gainNode.gain.value = METRONOME_GAIN_SUB;
    }

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + METRONOME_CLICK_DURATION);
  }

  /**
   * Initialize audio context for metronome
   */
  initializeAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      infoLog('🎵 Audio context created for metronome');
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        infoLog('🎵 Audio context resumed');
      });
    }
  }

  /**
   * Get current recording state
   */
  getRecordingState() {
    if (!this.startTime) return 'initial';
    if (this.recording) return 'recording';
    return 'stopped';
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime() {
    if (!this.startTime) return 0;

    const currentTime = Date.now();
    if (this.recording) {
      return (currentTime - this.startTime - this.pausedTime) / 1000.0;
    } else if (this.stopTime) {
      return (this.stopTime - this.startTime - this.pausedTime) / 1000.0;
    }
    return 0;
  }

  /**
   * Draw timeline lane guides overlay
   */
  drawLaneGuides(p5Instance, offsetX, offsetY, scale, paintCanvas) {
    // Only draw staff grid when using staff layout
    if (this.layout !== 'staff') {
      return;
    }

    p5Instance.push();
    p5Instance.colorMode(p5Instance.RGB, 255);

    // Calculate beat/measure metrics
    const secondsPerBeat = 60 / this.bpm;
    const secondsPerSubdivision = secondsPerBeat / (this.subdivision / 4);
    const maxStaffWidth = paintCanvas.width - 100;

    // Calculate staff width and spacing based on user preference
    const effectivePixelsPerSecond = this.getEffectivePixelsPerSecond(paintCanvas.width);
    let pixelsPerBeat, pixelsPerMeasure, pixelsPerSubdivision;

    if (this.measuresPerStaffPreference === 0) {
      // Auto mode: use default spacing and fit as many measures as possible
      pixelsPerBeat = secondsPerBeat * this.pixelsPerSecond;
      pixelsPerMeasure = pixelsPerBeat * this.beatsPerMeasure;
      pixelsPerSubdivision = secondsPerSubdivision * this.pixelsPerSecond;
      this.measuresPerStaff = Math.max(1, Math.floor(maxStaffWidth / pixelsPerMeasure));
      this.staffWidth = this.measuresPerStaff * pixelsPerMeasure;
    } else {
      // User-specified number of measures: adjust spacing to fill canvas width
      this.measuresPerStaff = this.measuresPerStaffPreference;
      this.staffWidth = maxStaffWidth;
      pixelsPerMeasure = this.staffWidth / this.measuresPerStaff;
      pixelsPerBeat = pixelsPerMeasure / this.beatsPerMeasure;
      pixelsPerSubdivision = pixelsPerBeat / (this.subdivision / 4);
    }

    // Calculate how many staffs to show
    // Use effective time (excludes warm-up) for visual timeline
    const timeElapsed = this.getEffectiveTimeElapsed();
    const totalX = timeElapsed * effectivePixelsPerSecond;
    const maxStaffs = Math.max(1, Math.ceil(totalX / this.staffWidth) + 1);
    const maxStaffsToShow = Math.min(maxStaffs, Math.floor(paintCanvas.height / (this.staffHeight + this.rowSpacing)) + 1);

    // Draw staffs
    for (let staffIdx = 0; staffIdx < maxStaffsToShow; staffIdx++) {
      const staffY = staffIdx * (this.staffHeight + this.rowSpacing);

      if (this.showGrid) {
        // Draw horizontal staff lines for each drum
        p5Instance.stroke(200, 200, 200, 120);
        p5Instance.strokeWeight(1);

        for (let i = 0; i < this.timelineLaneCount; i++) {
          const y = (staffY + (i * this.drumLineSpacing) + this.drumLineSpacing) * scale + offsetY;
          const x1 = offsetX;
          const x2 = offsetX + this.staffWidth * scale;
          p5Instance.line(x1, y, x2, y);
        }

        // Draw subdivision lines
        const maxBeats = Math.ceil(this.staffWidth / pixelsPerBeat);
        const subdivisionsPerBeat = this.subdivision / 4;

        p5Instance.stroke(190, 190, 190, 200);
        p5Instance.strokeWeight(1);
        for (let beat = 0; beat <= maxBeats; beat++) {
          for (let sub = 1; sub < subdivisionsPerBeat; sub++) {
            const xPos = beat * pixelsPerBeat + sub * pixelsPerSubdivision;
            if (xPos <= this.staffWidth) {
              const x = offsetX + xPos * scale;
              const y1 = offsetY + staffY * scale;
              const y2 = offsetY + (staffY + this.staffHeight) * scale;
              p5Instance.line(x, y1, x, y2);
            }
          }
        }

        // Draw beat lines
        p5Instance.stroke(170, 170, 170, 180);
        p5Instance.strokeWeight(1.5);
        for (let beat = 0; beat <= maxBeats; beat++) {
          if (beat % this.beatsPerMeasure !== 0) {
            const xPos = beat * pixelsPerBeat;
            if (xPos <= this.staffWidth) {
              const x = offsetX + xPos * scale;
              const y1 = offsetY + staffY * scale;
              const y2 = offsetY + (staffY + this.staffHeight) * scale;
              p5Instance.line(x, y1, x, y2);
            }
          }
        }

        // Draw measure lines
        p5Instance.stroke(150, 150, 150, 180);
        p5Instance.strokeWeight(2);
        for (let measure = 0; measure <= maxBeats / this.beatsPerMeasure; measure++) {
          const xPos = measure * pixelsPerBeat * this.beatsPerMeasure;
          if (xPos <= this.staffWidth) {
            const x = offsetX + xPos * scale;
            const y1 = offsetY + staffY * scale;
            const y2 = offsetY + (staffY + this.staffHeight) * scale;
            p5Instance.line(x, y1, x, y2);
          }
        }
      }

      // Draw two thin separator lines between staff rows
      if (staffIdx > 0 && this.rowSpacing > 0) {
        const gapStart = (staffY - this.rowSpacing) * scale + offsetY;
        const gapEnd = staffY * scale + offsetY;
        const lineSpacing = this.rowSpacing * scale / 3; // Divide gap into thirds

        // First thin line (1/3 into the gap)
        const line1Y = gapStart + lineSpacing;
        p5Instance.stroke(180, 180, 180, 150);
        p5Instance.strokeWeight(0.5);
        p5Instance.line(offsetX, line1Y, offsetX + this.staffWidth * scale, line1Y);

        // Second thin line (2/3 into the gap)
        const line2Y = gapStart + lineSpacing * 2;
        p5Instance.line(offsetX, line2Y, offsetX + this.staffWidth * scale, line2Y);
      }

      // Draw top line for staff when spacing is significant (> 6px)
      if (this.rowSpacing > 6) {
        const topLineY = staffY * scale + offsetY;
        p5Instance.stroke(150, 150, 150, 200);
        p5Instance.strokeWeight(1);
        p5Instance.line(offsetX, topLineY, offsetX + this.staffWidth * scale, topLineY);
      }

      // Draw staff index/measure marker
      p5Instance.textAlign(p5Instance.LEFT, p5Instance.TOP);
      p5Instance.textSize(10 * scale);
      p5Instance.fill(0, 0, 0, 80);
      const startTime = staffIdx * (this.staffWidth / effectivePixelsPerSecond);
      const startBeat = Math.floor(startTime / secondsPerBeat);
      const startMeasure = Math.floor(startBeat / this.beatsPerMeasure);
      p5Instance.text(`M${startMeasure + 1}`, offsetX + 5 * scale, offsetY + staffY * scale + 5 * scale);

      // Draw staff separator line (darker horizontal line between staffs)
      if (staffIdx < maxStaffsToShow - 1) {
        p5Instance.stroke(100, 100, 100, 180);
        p5Instance.strokeWeight(2 * scale);
        const separatorY = offsetY + (staffY + this.staffHeight) * scale;
        p5Instance.line(offsetX, separatorY, offsetX + this.staffWidth * scale, separatorY);
      }
    }

    // Draw playhead line (current time position)
    // Don't draw during warm-up period
    if (this.startTime !== null && totalX > 0 && !this.isInWarmup()) {
      const staffIndex = Math.floor(totalX / this.staffWidth);
      const xInStaff = totalX % this.staffWidth;
      const staffY = staffIndex * (this.staffHeight + this.rowSpacing);

      // Calculate beat pulse for visual effect
      let pulseAmount = 0;
      if (this.recording && this.metronomeEnabled) {
        const currentTime = Date.now();
        const timeElapsed = (currentTime - this.startTime - this.pausedTime) / 1000.0;
        const secondsPerBeat = 60 / this.bpm;
        const beatProgress = (timeElapsed % secondsPerBeat) / secondsPerBeat;

        // Create a sharp pulse at the start of each beat that decays quickly
        // Pulse is strongest at beat (0) and decays over first portion of the beat
        if (beatProgress < PLAYHEAD_PULSE_DECAY) {
          pulseAmount = 1 - (beatProgress / PLAYHEAD_PULSE_DECAY); // 1.0 at beat start, 0.0 at decay point
        }
      }

      // Red when recording, grey when stopped
      // Add pulse effect to brightness and alpha
      if (this.recording) {
        const baseBrightness = 50;
        const pulseBrightness = baseBrightness + (pulseAmount * 205); // Pulses from 50 to 255
        const baseAlpha = 200;
        const pulseAlpha = baseAlpha + (pulseAmount * 55); // Pulses from 200 to 255
        p5Instance.stroke(255, pulseBrightness, pulseBrightness, pulseAlpha);
      } else {
        p5Instance.stroke(100, 100, 100, 150);
      }

      // Add pulse effect to line thickness
      const pulseWeight = PLAYHEAD_BASE_WEIGHT + (pulseAmount * PLAYHEAD_PULSE_WEIGHT);
      p5Instance.strokeWeight(pulseWeight);

      const x = offsetX + xInStaff * scale;
      const y1 = offsetY + staffY * scale;
      const y2 = offsetY + (staffY + this.staffHeight) * scale;
      p5Instance.line(x, y1, x, y2);
    }

    p5Instance.pop();
  }

  /**
   * Helper functions
   */
  findDrumIdByNote(note, midiDeviceId, drumSettings) {
    for (const drumId in drumSettings) {
      const settings = drumSettings[drumId];
      if (settings.midiDevice === midiDeviceId && settings.midiNote === note) {
        return drumId;
      }
    }
    return null;
  }

  getDrumColor(note, midiDeviceId, velocityNorm, drumSettings) {
    const drumId = this.findDrumIdByNote(note, midiDeviceId, drumSettings);
    if (drumId && drumSettings[drumId]) {
      const settings = drumSettings[drumId];
      const colorHex = settings.color;
      const r = parseInt(colorHex.slice(1, 3), 16);
      const g = parseInt(colorHex.slice(3, 5), 16);
      const b = parseInt(colorHex.slice(5, 7), 16);

      // Use p5 color function from window
      return window.color ? window.color(r, g, b) : { r, g, b };
    }
    return window.color ? window.color(255, 255, 255) : { r: 255, g: 255, b: 255 };
  }

  applyScalingCurve(value, curve) {
    switch (curve) {
      case 'log':
        return Math.log(1 + value * 9) / Math.log(10);
      case 'exp':
        return (Math.exp(value * 2) - 1) / (Math.exp(2) - 1);
      case 'quad':
        return value * value;
      default: // linear
        return value;
    }
  }

  paintDot(canvas, x, y, size, col, alpha, shape, stroke, rotation) {
    const r = window.red ? window.red(col) : (col.r || 255);
    const g = window.green ? window.green(col) : (col.g || 255);
    const b = window.blue ? window.blue(col) : (col.b || 255);

    canvas.fill(r, g, b, alpha);

    if (stroke && stroke.enabled) {
      const sr = parseInt(stroke.color.slice(1, 3), 16);
      const sg = parseInt(stroke.color.slice(3, 5), 16);
      const sb = parseInt(stroke.color.slice(5, 7), 16);
      canvas.stroke(sr, sg, sb);
      canvas.strokeWeight(stroke.weight);
    } else {
      canvas.noStroke();
    }

    // Simple shapes for now
    switch (shape) {
      case 'square':
        canvas.rectMode(canvas.CENTER);
        canvas.square(x, y, size);
        break;
      case 'triangle':
        const h = size * 0.866;
        canvas.triangle(x, y - size / 2, x - size / 2, y + h / 2, x + size / 2, y + h / 2);
        break;
      default:
        canvas.circle(x, y, size);
    }
  }
}
