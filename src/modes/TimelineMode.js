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
  SPIRAL_SEPARATE_TRACKS_DEFAULT,
  SPIRAL_TRACK_SPACING_DEFAULT,
  TIMELINE_SPIRAL_TIGHTNESS,
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
import { getColorWithHueVariation } from '../utils/colorUtils.js';
import { paintDot } from '../canvas/DrawingUtils.js';

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
      startRadius: TIMELINE_SPIRAL_START_RADIUS,       // Initial radius at center
      syncToBPM: false,      // Whether to sync rotation speed to BPM
      separateTracks: SPIRAL_SEPARATE_TRACKS_DEFAULT,  // Whether to separate drums into tracks
      trackSpacing: SPIRAL_TRACK_SPACING_DEFAULT       // Spacing between tracks (pixels)
    };

    // Metronome state
    this.metronomeEnabled = false;
    this.lastMetronomeClick = -1; // Last subdivision index that played a click
    this.lastMetronomeBPM = 120;
    this.lastMetronomeSubdivision = 4;
    this.audioContext = null; // Web Audio API context

    // Tempo automation settings
    this.tempoAutomationEnabled = false;
    this.tempoAutomationDirection = 'increase'; // 'increase' or 'decrease'
    this.tempoAutomationBpmChange = 5; // BPM to change each interval
    this.tempoAutomationBars = 4; // Number of bars between tempo changes
    this.tempoAutomationMaxBpm = 200; // Maximum BPM cap (for increase)
    this.tempoAutomationMinBpm = 40; // Minimum BPM floor (for decrease)
    this.baseBpm = 80; // Starting BPM (captured when recording starts)
    this.lastTempoChangeMeasure = -1; // Track which measure we last changed tempo
    this.tempoAverages = []; // Average deviation per tempo period: [{ bpm, avgDeviation, hitCount }]

    // Tempo change tracking for continuous metronome
    this.tempoChangeTime = 0; // Time (in seconds) when last tempo change occurred
    this.tempoChangeSubdivisionOffset = 0; // Subdivision count at the time of tempo change

    // Tempo history for drawing staff grids with correct BPM at each staff
    // Each entry: { time: seconds, bpm: number, staffX: pixels }
    this.tempoHistory = [];

    // Deviation tracking (staff mode only)
    this.showDeviationGraph = false; // Toggle for displaying deviation graph
    this.deviationData = {}; // Per-drum deviation data: { drumId: [{ time, deviation, cumulativeDeviation }] }
    this.clickTimes = []; // Actual metronome click timestamps for accurate deviation measurement

    // Deviation graph position (draggable) and size (resizable)
    this.deviationGraphX = null; // null = use default position (bottom-left)
    this.deviationGraphY = null;
    this.deviationGraphWidth = null; // null = use default (80% of screen)
    this.deviationGraphHeight = null; // null = use default (150px)
    this.deviationGraphDragging = false;
    this.deviationGraphResizing = false; // true when resizing
    this.deviationGraphResizeEdge = null; // 'right', 'bottom', 'corner'
    this.deviationGraphDragOffsetX = 0;
    this.deviationGraphDragOffsetY = 0;
    this.deviationGraphMode = 'cumulative'; // 'cumulative' or 'actual' timing error

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

      // Also add any drums that are in drumSettings but missing from drumOrder
      // This handles cases where drums were added but drumOrder wasn't synced
      if (drumSettings) {
        let nextIndex = Object.keys(this.timelineLanes).length;
        for (const drumId of Object.keys(drumSettings)) {
          if (!(drumId in this.timelineLanes)) {
            debugLog(`📋 Adding missing drum to lanes: ${drumId} (was in settings but not in order)`);
            this.timelineLanes[drumId] = nextIndex++;
          }
        }
      }

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
        // Offset by -π/2 so beat 1 starts at 12 o'clock (matching circular metronome)
        const theta = (measurePosition / this.beatsPerMeasure) * Math.PI * 2 - Math.PI / 2;

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

        // Optionally offset each drum to its own track
        const laneOffset = this.spiralSettings.separateTracks
          ? (laneIndex - this.timelineLaneCount / 2) * this.spiralSettings.trackSpacing
          : 0;
        const finalRadius = spiralRadius + laneOffset;

        return {
          x: centerX + finalRadius * Math.cos(theta),
          y: centerY + finalRadius * Math.sin(theta)
        };

      case 'staff':
      default:
        // Measure-based horizontal staff layout (handles tempo changes correctly)
        // beatCount is the continuous beat count that accounts for tempo changes
        const measureNum = Math.floor(beatCount / this.beatsPerMeasure);
        const beatInMeasure = beatCount % this.beatsPerMeasure;

        const staffPos = this.getStaffPositionForMeasure(measureNum, beatInMeasure, canvasWidth);
        const staffY = staffPos.staffIndex * (this.staffHeight + this.rowSpacing);
        const laneY = staffY + (laneIndex * this.drumLineSpacing) + this.drumLineSpacing;

        return { x: staffPos.xInStaff, y: laneY };
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
    // Use baseBpm for warm-up calculation (not current bpm which may have changed)
    const secondsPerBeat = 60 / this.baseBpm;
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

    // Use baseBpm for warm-up calculation (not current bpm which may have changed)
    // This ensures consistent warm-up duration even with tempo automation
    const secondsPerBeat = 60 / this.baseBpm;
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

      // Use tempo-aware beat calculation to handle tempo changes correctly
      beatCount = this.getBeatCountForTime(timeElapsed);

      // Track deviation from grid for staff mode
      if (this.layout === 'staff' && this.showDeviationGraph) {
        this.recordDeviation(drumId, timeElapsed);
      }
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

    const col = getColorWithHueVariation(settings, scaledVelOpacity);
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
    paintDot(paintCanvas, x, y, size, col, alpha, shape, stroke, rotation);
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
    const rawTimeElapsed = (currentTime - this.startTime - this.pausedTime) / 1000.0;

    // Calculate warmup duration
    const warmupSecondsPerBeat = 60 / this.baseBpm;
    const warmupDuration = this.warmupMeasures > 0
      ? warmupSecondsPerBeat * this.beatsPerMeasure * this.warmupMeasures
      : 0;
    const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);
    const warmupSubdivisions = this.warmupMeasures * subdivisionsPerMeasure;

    let currentSubdivision;

    if (rawTimeElapsed < warmupDuration) {
      // During warmup: use simple calculation at base BPM
      const secondsPerSubdivision = warmupSecondsPerBeat / (this.subdivision / 4);
      currentSubdivision = rawTimeElapsed / secondsPerSubdivision;
    } else {
      // After warmup: use getBeatCountForTime for consistency with grid painting
      const effectiveTime = rawTimeElapsed - warmupDuration;
      const beatCount = this.getBeatCountForTime(effectiveTime);
      const subdivisionsPerBeat = this.subdivision / 4;
      // Add warmup subdivisions to get continuous subdivision count
      currentSubdivision = warmupSubdivisions + (beatCount * subdivisionsPerBeat);
    }

    // Position within the fixed bottom panel (or bottom-right if no panel)
    const panelHeight = this.getBottomPanelHeight();
    const panelTop = canvasHeight - panelHeight;
    const defaultX = canvasWidth - METRONOME_DEFAULT_MARGIN;
    const defaultY = panelHeight > 0 ? panelTop + panelHeight / 2 : canvasHeight - METRONOME_DEFAULT_MARGIN;
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

    // Calculate current subdivision position within measure
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

    // Use default position if not set (within bottom panel)
    const panelHeight = this.getBottomPanelHeight();
    const panelTop = window.height - panelHeight;
    const centerX = this.metronomeX !== null ? this.metronomeX : (window.width - METRONOME_DEFAULT_MARGIN);
    const centerY = this.metronomeY !== null ? this.metronomeY : (panelHeight > 0 ? panelTop + panelHeight / 2 : window.height - METRONOME_DEFAULT_MARGIN);
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

      // Reset tempo automation state
      this.baseBpm = this.bpm;
      this.lastTempoChangeMeasure = -1;
      this.tempoChangeTime = 0;
      this.tempoChangeSubdivisionOffset = 0;
      this.tempoHistory = [{ time: 0, bpm: this.bpm, staffX: 0 }]; // Initialize with starting BPM

      // Clear deviation tracking data
      this.clearDeviationData();
      this.clickTimes = []; // Clear recorded click times
      this.tempoAverages = []; // Clear tempo period averages

      debugLog('Timeline recording started (from beginning)');
    } else {
      // Continue recording
      if (this.startTime !== null && this.stopTime !== null) {
        // Calculate paused duration
        const pauseDuration = Date.now() - this.stopTime;
        this.pausedTime += pauseDuration;
        this.stopTime = null;

        // Sync metronome to current position using consistent timing calculation
        const rawTimeElapsed = (Date.now() - this.startTime - this.pausedTime) / 1000.0;
        const warmupSecondsPerBeat = 60 / this.baseBpm;
        const warmupDuration = this.warmupMeasures > 0
          ? warmupSecondsPerBeat * this.beatsPerMeasure * this.warmupMeasures
          : 0;
        const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);
        const warmupSubdivisions = this.warmupMeasures * subdivisionsPerMeasure;

        let exactSubdivision;
        if (rawTimeElapsed < warmupDuration) {
          // During warmup: use simple calculation at base BPM
          const secondsPerSubdivision = warmupSecondsPerBeat / (this.subdivision / 4);
          exactSubdivision = rawTimeElapsed / secondsPerSubdivision;
        } else {
          // After warmup: use getBeatCountForTime for consistency
          const effectiveTime = rawTimeElapsed - warmupDuration;
          const beatCount = this.getBeatCountForTime(effectiveTime);
          const subdivisionsPerBeat = this.subdivision / 4;
          exactSubdivision = warmupSubdivisions + (beatCount * subdivisionsPerBeat);
        }
        this.lastMetronomeClick = Math.round(exactSubdivision) - 1;

        debugLog(`Timeline recording continued (paused for ${pauseDuration}ms)`);
      } else {
        // First time starting
        this.startTime = Date.now();
        this.pausedTime = 0;
        this.stopTime = null;
        this.lastMetronomeClick = -1;

        // Initialize tempo automation state
        this.baseBpm = this.bpm;
        this.lastTempoChangeMeasure = -1;
        this.tempoChangeTime = 0;
        this.tempoChangeSubdivisionOffset = 0;
        this.tempoHistory = [{ time: 0, bpm: this.bpm, staffX: 0 }]; // Initialize with starting BPM
        this.clickTimes = []; // Clear recorded click times
        this.tempoAverages = []; // Clear tempo period averages

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

    // Reset tempo automation state (but keep settings)
    this.baseBpm = this.bpm;
    this.lastTempoChangeMeasure = -1;
    this.tempoChangeTime = 0;
    this.tempoChangeSubdivisionOffset = 0;
    this.tempoHistory = [];

    // Clear deviation tracking data
    this.clearDeviationData();
    this.clickTimes = []; // Clear recorded click times
    this.tempoAverages = []; // Clear tempo period averages

    debugLog('Timeline state cleared');
  }

  /**
   * Update metronome - play click sounds based on BPM and subdivision
   * Uses continuous subdivision counting that handles tempo changes smoothly
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

    const currentTime = Date.now();
    const rawTimeElapsed = (currentTime - this.startTime - this.pausedTime) / 1000.0;

    // Calculate warmup duration and subdivisions
    const warmupSecondsPerBeat = 60 / this.baseBpm;
    const warmupDuration = this.warmupMeasures > 0
      ? warmupSecondsPerBeat * this.beatsPerMeasure * this.warmupMeasures
      : 0;
    const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);
    const warmupSubdivisions = this.warmupMeasures * subdivisionsPerMeasure;

    let currentSubdivision;
    let currentMeasure;

    if (rawTimeElapsed < warmupDuration) {
      // During warmup: use simple calculation at base BPM
      const secondsPerSubdivision = warmupSecondsPerBeat / (this.subdivision / 4);
      currentSubdivision = Math.floor(rawTimeElapsed / secondsPerSubdivision);
      currentMeasure = Math.floor(currentSubdivision / subdivisionsPerMeasure) + 1;
    } else {
      // After warmup: use getBeatCountForTime for consistency with grid painting
      const effectiveTime = rawTimeElapsed - warmupDuration;
      const beatCount = this.getBeatCountForTime(effectiveTime);
      const subdivisionsPerBeat = this.subdivision / 4;

      // Add warmup subdivisions to get continuous subdivision count
      currentSubdivision = Math.floor(warmupSubdivisions + (beatCount * subdivisionsPerBeat));

      // Calculate measure (1-indexed) relative to post-warmup position
      const postWarmupSubdivision = currentSubdivision - warmupSubdivisions;
      currentMeasure = Math.floor(postWarmupSubdivision / subdivisionsPerMeasure) + 1;
    }

    // Check for tempo automation (only after warmup)
    if (rawTimeElapsed >= warmupDuration) {
      this.updateTempoAutomation(currentMeasure, currentSubdivision - warmupSubdivisions);
    }

    // Play click if we've crossed into a new subdivision
    if (currentSubdivision > this.lastMetronomeClick) {
      this.lastMetronomeClick = currentSubdivision;

      const subdivisionsPerQuarter = this.subdivision / 4;

      const isFirstBeat = (currentSubdivision % subdivisionsPerMeasure) === 0;
      const isBeat = (currentSubdivision % subdivisionsPerQuarter) === 0;

      // Play click
      debugLog(`🎵 Metronome click: subdivision ${currentSubdivision}, firstBeat=${isFirstBeat}, beat=${isBeat}`);
      this.playMetronomeClick(isFirstBeat, isBeat);

      // Record click timestamp for deviation measurement (only after warmup)
      const warmupSubdivisions = this.warmupMeasures * subdivisionsPerMeasure;
      if (currentSubdivision >= warmupSubdivisions) {
        this.clickTimes.push({
          time: currentTime,
          subdivision: currentSubdivision
        });
        // Keep only last 200 clicks to avoid memory buildup
        if (this.clickTimes.length > 200) {
          this.clickTimes.shift();
        }
      }
    }
  }

  /**
   * Update tempo automation - increase BPM at specified bar intervals
   * @param {number} currentMeasure - Current measure number (1-indexed)
   * @param {number} currentSubdivision - Current subdivision count (post-warmup)
   */
  updateTempoAutomation(currentMeasure, currentSubdivision) {
    if (!this.tempoAutomationEnabled) return;
    if (this.tempoAutomationBars <= 0) return;

    // Calculate which tempo change interval we're in
    // Measure 1-4 = interval 0, Measure 5-8 = interval 1, etc. (for 4 bar intervals)
    const currentInterval = Math.floor((currentMeasure - 1) / this.tempoAutomationBars);

    // Check if we've entered a new interval
    if (currentInterval > this.lastTempoChangeMeasure) {
      // Calculate average deviation for the tempo period that just ended
      this.recordTempoAverageDeviation();

      this.lastTempoChangeMeasure = currentInterval;

      // Calculate new BPM based on interval number and direction
      const bpmDelta = this.tempoAutomationDirection === 'decrease'
        ? -this.tempoAutomationBpmChange
        : this.tempoAutomationBpmChange;
      let newBpm = this.baseBpm + (currentInterval * bpmDelta);

      // Apply limits based on direction
      if (this.tempoAutomationDirection === 'increase') {
        newBpm = Math.min(newBpm, this.tempoAutomationMaxBpm);
      } else {
        newBpm = Math.max(newBpm, this.tempoAutomationMinBpm);
      }

      // Apply the new BPM if it's different
      if (newBpm !== this.bpm) {
        // Record tempo change in history (uses effective time for consistency with grid)
        const effectiveTime = this.getEffectiveTimeElapsed();
        this.tempoHistory.push({
          time: effectiveTime,
          bpm: newBpm,
          measure: currentMeasure
        });

        const direction = this.tempoAutomationDirection === 'decrease' ? 'decreased' : 'increased';
        this.bpm = newBpm;
        this.lastMetronomeBPM = newBpm;
        debugLog(`🎵 Tempo automation: BPM ${direction} to ${newBpm} at measure ${currentMeasure}, subdivision ${currentSubdivision}`);

        // Update the UI display
        this.updateBpmDisplay();
      }
    }
  }

  /**
   * Record average deviation for the current tempo period
   * Called when tempo changes to capture stats for the period that just ended
   */
  recordTempoAverageDeviation() {
    // Get all deviation data recorded since the last tempo change
    const allDeviations = [];
    for (const drumId of Object.keys(this.deviationData)) {
      const data = this.deviationData[drumId];
      // Find deviations that occurred during the current tempo period
      // (after the last recorded tempo average, if any)
      const lastRecordedTime = this.tempoAverages.length > 0
        ? this.tempoAverages[this.tempoAverages.length - 1].endTime
        : 0;
      for (const point of data) {
        if (point.time > lastRecordedTime) {
          allDeviations.push(point.deviation);
        }
      }
    }

    if (allDeviations.length > 0) {
      const avgDeviation = allDeviations.reduce((sum, d) => sum + d, 0) / allDeviations.length;

      // Calculate average absolute deviation (mean of |deviation|)
      const absDeviations = allDeviations.map(d => Math.abs(d));
      const avgAbsDeviation = absDeviations.reduce((sum, d) => sum + d, 0) / absDeviations.length;

      // Calculate standard deviation of signed deviations
      const squaredDiffs = allDeviations.map(d => Math.pow(d - avgDeviation, 2));
      const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / allDeviations.length;
      const stdDeviation = Math.sqrt(avgSquaredDiff);

      // Calculate standard deviation of absolute deviations
      const absSquaredDiffs = absDeviations.map(d => Math.pow(d - avgAbsDeviation, 2));
      const absAvgSquaredDiff = absSquaredDiffs.reduce((sum, d) => sum + d, 0) / absDeviations.length;
      const absStdDeviation = Math.sqrt(absAvgSquaredDiff);

      const effectiveTime = this.getEffectiveTimeElapsed();
      this.tempoAverages.push({
        bpm: this.bpm,
        avgDeviation: avgDeviation,
        avgAbsDeviation: avgAbsDeviation,
        stdDeviation: stdDeviation,
        absStdDeviation: absStdDeviation,
        hitCount: allDeviations.length,
        endTime: effectiveTime
      });
      debugLog(`📊 Tempo average: ${this.bpm} BPM, avg: ${avgDeviation.toFixed(1)}ms, |avg|: ${avgAbsDeviation.toFixed(1)}ms, std: ${stdDeviation.toFixed(1)}ms (${allDeviations.length} hits)`);
    }
  }

  /**
   * Update BPM display in UI (called from tempo automation)
   */
  updateBpmDisplay() {
    const bpmDisplay = document.getElementById('bpm-display');
    const bpmInput = document.getElementById('timeline-bpm');
    if (bpmDisplay) {
      bpmDisplay.textContent = this.bpm;
    }
    if (bpmInput) {
      bpmInput.value = this.bpm;
    }
  }

  /**
   * Find the nearest recorded metronome click to a given timestamp
   * @param {number} hitTime - The hit timestamp (Date.now() format, adjusted for MIDI latency)
   * @returns {object|null} - The nearest click { time, subdivision } or null if no clicks recorded
   */
  findNearestClick(hitTime) {
    if (this.clickTimes.length === 0) return null;

    let nearest = this.clickTimes[this.clickTimes.length - 1];
    let minDiff = Math.abs(hitTime - nearest.time);

    // Search backwards from most recent click (most likely to be nearest)
    for (let i = this.clickTimes.length - 2; i >= 0; i--) {
      const diff = Math.abs(hitTime - this.clickTimes[i].time);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = this.clickTimes[i];
      } else {
        // Getting further away, stop searching
        break;
      }
    }
    return nearest;
  }

  /**
   * Record deviation from the nearest grid line for a hit
   * Uses actual recorded click times for accurate measurement
   * @param {string} drumId - The drum that was hit
   * @param {number} timeElapsed - Time elapsed in seconds (for storing in data)
   */
  recordDeviation(drumId, timeElapsed) {
    // Get the actual hit timestamp, adjusted for MIDI latency
    const hitTime = Date.now() - this.midiLatencyMs;

    // Find the nearest actual metronome click
    const nearestClick = this.findNearestClick(hitTime);

    if (!nearestClick) {
      debugLog(`📊 Deviation: ${drumId} - no clicks recorded yet`);
      return;
    }

    // Calculate deviation in milliseconds (positive = late, negative = early)
    const deviationMs = hitTime - nearestClick.time;

    // Initialize drum's deviation array if needed
    if (!this.deviationData[drumId]) {
      this.deviationData[drumId] = [];
    }

    // Calculate cumulative deviation for this drum
    const prevData = this.deviationData[drumId];
    const prevCumulative = prevData.length > 0 ? prevData[prevData.length - 1].cumulativeDeviation : 0;
    const cumulativeDeviation = prevCumulative + Math.abs(deviationMs);

    // Record the deviation
    this.deviationData[drumId].push({
      time: timeElapsed,
      deviation: deviationMs,
      cumulativeDeviation: cumulativeDeviation
    });

    debugLog(`📊 Deviation: ${drumId} at ${timeElapsed.toFixed(3)}s, nearest click: ${nearestClick.subdivision}, deviation: ${deviationMs.toFixed(1)}ms`);
  }

  /**
   * Get the time (in seconds) at which a given subdivision occurs, accounting for tempo history
   * This is the inverse of getBeatCountForTime - given a beat/subdivision count, find the time
   * @param {number} targetSubdivision - The subdivision index to find the time for
   * @returns {number} - Time in seconds when this subdivision occurs
   */
  getTimeForSubdivision(targetSubdivision) {
    const subdivisionFactor = this.subdivision / 4; // subdivisions per beat
    const targetBeats = targetSubdivision / subdivisionFactor;

    // If no tempo history, use simple calculation with starting BPM
    if (!this.tempoHistory || this.tempoHistory.length === 0) {
      const secondsPerBeat = 60 / (this.baseBpm || this.bpm);
      return targetBeats * secondsPerBeat;
    }


    // Walk through tempo history to find when this beat count is reached
    let accumulatedBeats = 0;
    let accumulatedTime = 0;
    let previousBpm = this.tempoHistory[0].bpm;

    for (let i = 1; i < this.tempoHistory.length; i++) {
      const entry = this.tempoHistory[i];
      const entryTime = entry.time;

      // Calculate beats during the previous tempo period
      const periodDuration = entryTime - accumulatedTime;
      const secondsPerBeat = 60 / previousBpm;
      const beatsInPeriod = periodDuration / secondsPerBeat;

      // Check if target falls within this period
      if (accumulatedBeats + beatsInPeriod >= targetBeats) {
        // Target is in this period - calculate exact time
        const remainingBeats = targetBeats - accumulatedBeats;
        return accumulatedTime + (remainingBeats * secondsPerBeat);
      }

      accumulatedBeats += beatsInPeriod;
      accumulatedTime = entryTime;
      previousBpm = entry.bpm;
    }

    // Target is after the last tempo change - use current tempo
    const remainingBeats = targetBeats - accumulatedBeats;
    const secondsPerBeat = 60 / previousBpm;
    return accumulatedTime + (remainingBeats * secondsPerBeat);
  }

  /**
   * Clear deviation data (called when timeline is cleared)
   */
  clearDeviationData() {
    this.deviationData = {};
  }

  /**
   * Draw the deviation graph overlay
   * @param {Object} p5Instance - The p5 instance for drawing
   * @param {number} offsetX - X offset for pan (unused, kept for API consistency)
   * @param {number} offsetY - Y offset for pan (unused, kept for API consistency)
   * @param {number} scale - Current zoom scale (unused, kept for API consistency)
   * @param {Object} drumSettings - Current drum settings for colors
   */
  drawDeviationGraph(p5Instance, offsetX, offsetY, scale, drumSettings) {
    if (!this.showDeviationGraph || this.layout !== 'staff') {
      // Reset cursor when graph is not shown
      if (this._deviationGraphCursorSet) {
        p5Instance.cursor(p5Instance.ARROW);
        this._deviationGraphCursorSet = false;
      }
      return;
    }

    // Check if we have any deviation data
    const drumIds = Object.keys(this.deviationData);
    if (drumIds.length === 0) {
      // Reset cursor when no data
      if (this._deviationGraphCursorSet) {
        p5Instance.cursor(p5Instance.ARROW);
        this._deviationGraphCursorSet = false;
      }
      return;
    }

    // Find the max deviation values and max time for scaling
    // Also calculate stats for each drum
    let maxCumulative = 0;
    let maxActualDeviation = 0; // Max absolute deviation for actual mode
    let minActualDeviation = 0; // Min deviation (most negative/early)
    let maxTime = 0;
    const drumStats = {};
    for (const drumId of drumIds) {
      const data = this.deviationData[drumId];
      if (data.length > 0) {
        const lastEntry = data[data.length - 1];
        maxCumulative = Math.max(maxCumulative, lastEntry.cumulativeDeviation);
        maxTime = Math.max(maxTime, lastEntry.time);

        // Track min/max actual deviations for scaling in actual mode
        for (const point of data) {
          maxActualDeviation = Math.max(maxActualDeviation, point.deviation);
          minActualDeviation = Math.min(minActualDeviation, point.deviation);
        }

        // Calculate stats: hits, average deviation, and standard deviation
        const deviations = data.map(d => Math.abs(d.deviation));
        const totalAbsDeviation = deviations.reduce((sum, d) => sum + d, 0);
        const avgDeviation = totalAbsDeviation / data.length;

        // Standard deviation calculation
        const squaredDiffs = deviations.map(d => Math.pow(d - avgDeviation, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / data.length;
        const stdDeviation = Math.sqrt(avgSquaredDiff);

        drumStats[drumId] = {
          hits: data.length,
          avgDeviation: avgDeviation,
          stdDeviation: stdDeviation
        };
      }
    }

    // For actual mode, ensure symmetric range around zero
    const actualRange = Math.max(Math.abs(maxActualDeviation), Math.abs(minActualDeviation), 10);

    const isActualMode = this.deviationGraphMode === 'actual';
    if ((isActualMode && actualRange === 0) || (!isActualMode && maxCumulative === 0) || maxTime === 0) {
      // Reset cursor when no valid data
      if (this._deviationGraphCursorSet) {
        p5Instance.cursor(p5Instance.ARROW);
        this._deviationGraphCursorSet = false;
      }
      return;
    }

    // Graph dimensions - 80% of screen width by default, resizable
    const graphMargin = 20;
    const statsTableWidth = 220; // Width for stats table on the right
    const resizeHandleSize = 12; // Size of resize handles

    // Calculate default graph width (80% of screen minus stats table)
    const defaultGraphWidth = Math.max(300, (p5Instance.width * 0.8) - statsTableWidth - 60);
    const defaultGraphHeight = 150;

    // Use custom dimensions if set, otherwise use defaults
    const graphWidth = this.deviationGraphWidth !== null ? this.deviationGraphWidth : defaultGraphWidth;
    const graphHeight = this.deviationGraphHeight !== null ? this.deviationGraphHeight : defaultGraphHeight;

    const totalWidth = graphWidth + statsTableWidth + 60; // Graph + table + margins
    const totalHeight = graphHeight + 50; // Graph height + margins for title and axis labels

    // Position within the fixed bottom panel
    const panelHeight = this.getBottomPanelHeight();
    const panelTop = p5Instance.height - panelHeight;
    const defaultX = graphMargin;
    const defaultY = panelTop + 10; // Position near top of panel
    const baseX = this.deviationGraphX !== null ? this.deviationGraphX : defaultX;
    const baseY = this.deviationGraphY !== null ? this.deviationGraphY : defaultY;

    // Graph content starts offset from base position
    const graphX = baseX + 35;
    const graphY = baseY + 25;

    // Check mouse position for drag/resize detection
    const mouseX = p5Instance.mouseX;
    const mouseY = p5Instance.mouseY;
    const isMouseOver = mouseX >= baseX && mouseX <= baseX + totalWidth &&
                        mouseY >= baseY && mouseY <= baseY + totalHeight;

    // Detect resize edges (right edge, bottom edge, corner)
    const nearRightEdge = mouseX >= baseX + totalWidth - resizeHandleSize && mouseX <= baseX + totalWidth &&
                          mouseY >= baseY && mouseY <= baseY + totalHeight;
    const nearBottomEdge = mouseY >= baseY + totalHeight - resizeHandleSize && mouseY <= baseY + totalHeight &&
                           mouseX >= baseX && mouseX <= baseX + totalWidth;
    const nearCorner = nearRightEdge && nearBottomEdge;

    p5Instance.push();

    // Draw light grey background with hover effect
    if (isMouseOver || this.deviationGraphDragging || this.deviationGraphResizing) {
      p5Instance.fill(240, 240, 240, 245);
      p5Instance.stroke(100, 150, 200, 220);
      p5Instance.strokeWeight(2);
    } else {
      p5Instance.fill(235, 235, 235, 240);
      p5Instance.stroke(180, 180, 180);
      p5Instance.strokeWeight(1);
    }
    p5Instance.rect(baseX, baseY, totalWidth, totalHeight, 5);

    // Set cursor based on position
    if (this.deviationGraphResizing) {
      // Keep resize cursor while resizing
      if (this.deviationGraphResizeEdge === 'corner') {
        p5Instance.cursor('nwse-resize');
      } else if (this.deviationGraphResizeEdge === 'right') {
        p5Instance.cursor('ew-resize');
      } else if (this.deviationGraphResizeEdge === 'bottom') {
        p5Instance.cursor('ns-resize');
      }
      this._deviationGraphCursorSet = true;
    } else if (nearCorner) {
      p5Instance.cursor('nwse-resize');
      this._deviationGraphCursorSet = true;
    } else if (nearRightEdge) {
      p5Instance.cursor('ew-resize');
      this._deviationGraphCursorSet = true;
    } else if (nearBottomEdge) {
      p5Instance.cursor('ns-resize');
      this._deviationGraphCursorSet = true;
    } else if (isMouseOver || this.deviationGraphDragging) {
      p5Instance.cursor(p5Instance.MOVE);
      this._deviationGraphCursorSet = true;
    } else if (this._deviationGraphCursorSet) {
      p5Instance.cursor(p5Instance.ARROW);
      this._deviationGraphCursorSet = false;
    }

    // Draw resize handle in corner (visual indicator)
    if (isMouseOver || this.deviationGraphResizing) {
      p5Instance.fill(150, 150, 150, 180);
      p5Instance.noStroke();
      // Draw diagonal lines in corner as resize indicator
      const cornerX = baseX + totalWidth - 3;
      const cornerY = baseY + totalHeight - 3;
      p5Instance.stroke(120, 120, 120, 200);
      p5Instance.strokeWeight(1.5);
      for (let i = 0; i < 3; i++) {
        const offset = i * 4;
        p5Instance.line(cornerX - 10 + offset, cornerY, cornerX, cornerY - 10 + offset);
      }
    }

    // Draw title and BPM (dark text on light background)
    p5Instance.fill(40, 40, 40);
    p5Instance.textSize(11);
    p5Instance.textAlign(p5Instance.LEFT, p5Instance.TOP);
    const graphTitle = isActualMode ? 'Timing Deviation (ms) [+late/-early]' : 'Cumulative Timing Deviation (ms)';
    p5Instance.text(graphTitle, graphX, baseY + 5);

    // Draw current BPM (right-aligned in title area, 25% larger font)
    p5Instance.fill(180, 100, 50);
    p5Instance.textSize(14); // 25% larger than 11
    p5Instance.textAlign(p5Instance.RIGHT, p5Instance.TOP);
    p5Instance.text(`${this.bpm} BPM`, baseX + totalWidth - 10, baseY + 4);

    // Draw axes
    p5Instance.stroke(120, 120, 120);
    p5Instance.strokeWeight(1);
    // X-axis (at bottom for cumulative, at center for actual mode)
    const xAxisY = isActualMode ? graphY + graphHeight / 2 : graphY + graphHeight;
    p5Instance.line(graphX, xAxisY, graphX + graphWidth, xAxisY);
    // Y-axis
    p5Instance.line(graphX, graphY, graphX, graphY + graphHeight);

    // Draw axis labels (dark text)
    p5Instance.fill(80, 80, 80);
    p5Instance.noStroke();
    p5Instance.textSize(9);
    p5Instance.textAlign(p5Instance.CENTER, p5Instance.TOP);
    p5Instance.text('Time (s)', graphX + graphWidth / 2, graphY + graphHeight + 5);

    p5Instance.textAlign(p5Instance.RIGHT, p5Instance.CENTER);
    if (isActualMode) {
      // Symmetric scale for actual mode (+/- around zero)
      p5Instance.text(`+${actualRange.toFixed(0)}`, graphX - 5, graphY);
      p5Instance.text('0', graphX - 5, graphY + graphHeight / 2);
      p5Instance.text(`-${actualRange.toFixed(0)}`, graphX - 5, graphY + graphHeight);
    } else {
      p5Instance.text(maxCumulative.toFixed(0), graphX - 5, graphY);
      p5Instance.text('0', graphX - 5, graphY + graphHeight);
    }

    // Time labels
    p5Instance.textAlign(p5Instance.CENTER, p5Instance.TOP);
    p5Instance.text('0', graphX, graphY + graphHeight + 5);
    p5Instance.text(maxTime.toFixed(1), graphX + graphWidth, graphY + graphHeight + 5);

    // Draw light grey vertical lines for measure boundaries
    if (maxTime > 0) {
      const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);
      // Calculate how many measures fit in the current time
      const totalBeats = this.getBeatCountForTime(maxTime);
      const totalMeasures = Math.ceil(totalBeats / this.beatsPerMeasure);

      p5Instance.stroke(180, 180, 180, 180); // Medium grey
      p5Instance.strokeWeight(0.75);
      for (let m = 1; m <= totalMeasures; m++) {
        const measureTime = this.getTimeForSubdivision(m * subdivisionsPerMeasure);
        if (measureTime > 0 && measureTime < maxTime) {
          const lineX = graphX + (measureTime / maxTime) * graphWidth;
          p5Instance.line(lineX, graphY, lineX, graphY + graphHeight);
        }
      }
    }

    // Draw darker vertical lines for tempo changes with tempo labels
    if (this.tempoHistory && this.tempoHistory.length > 0 && maxTime > 0) {
      // Draw first section tempo label
      const firstBpm = this.tempoHistory[0].bpm;
      p5Instance.noStroke();
      p5Instance.fill(180, 120, 60, 200);
      p5Instance.textSize(10);
      p5Instance.textAlign(p5Instance.LEFT, p5Instance.BOTTOM);
      p5Instance.text(`${firstBpm}`, graphX + 3, graphY + graphHeight - 3);

      if (this.tempoHistory.length > 1) {
        p5Instance.strokeWeight(1.5);
        for (let i = 1; i < this.tempoHistory.length; i++) {
          const tempoEntry = this.tempoHistory[i];
          if (tempoEntry.time > 0 && tempoEntry.time < maxTime) {
            const lineX = graphX + (tempoEntry.time / maxTime) * graphWidth;
            // Darker orange/brown for tempo change lines
            p5Instance.stroke(160, 100, 40, 200);
            p5Instance.line(lineX, graphY, lineX, graphY + graphHeight);

            // Draw tempo label just inside the new section
            p5Instance.noStroke();
            p5Instance.fill(180, 120, 60, 200);
            p5Instance.textSize(10);
            p5Instance.textAlign(p5Instance.LEFT, p5Instance.BOTTOM);
            p5Instance.text(`${tempoEntry.bpm}`, lineX + 3, graphY + graphHeight - 3);
          }
        }
      }
    }

    // Draw tempo average stats in upper right of each tempo block (only in actual mode)
    if (isActualMode && this.tempoAverages && this.tempoAverages.length > 0 && maxTime > 0) {
      p5Instance.noStroke();

      for (let i = 0; i < this.tempoAverages.length; i++) {
        const avg = this.tempoAverages[i];
        const endTime = avg.endTime;

        if (endTime <= maxTime) {
          // Calculate position in upper right of tempo block
          const endX = graphX + (endTime / maxTime) * graphWidth;
          const stdDev = avg.stdDeviation !== undefined ? avg.stdDeviation : 0;
          const avgAbsDev = avg.avgAbsDeviation !== undefined ? avg.avgAbsDeviation : 0;
          const absStdDev = avg.absStdDeviation !== undefined ? avg.absStdDeviation : 0;

          // Draw stats text in upper right of the tempo block
          p5Instance.fill(80, 80, 80);
          p5Instance.textAlign(p5Instance.RIGHT, p5Instance.TOP);
          // Line 1: mean deviation ± std
          p5Instance.textSize(16);
          const avgText = `${avg.avgDeviation >= 0 ? '+' : ''}${avg.avgDeviation.toFixed(0)}ms ±${stdDev.toFixed(0)}`;
          p5Instance.text(avgText, endX - 3, graphY + 3);
          // Line 2: mean absolute deviation ± std
          p5Instance.textSize(12);
          p5Instance.fill(120, 120, 120);
          p5Instance.text(`|avg| ${avgAbsDev.toFixed(0)}ms ±${absStdDev.toFixed(0)}`, endX - 3, graphY + 21);
        }
      }
    }

    // Draw data for each drum
    for (const drumId of drumIds) {
      const data = this.deviationData[drumId];
      if (data.length < 1) continue;

      // Get drum color
      const settings = drumSettings[drumId];
      const colorHex = settings?.color || '#ffffff';
      const r = parseInt(colorHex.slice(1, 3), 16);
      const g = parseInt(colorHex.slice(3, 5), 16);
      const b = parseInt(colorHex.slice(5, 7), 16);

      if (isActualMode) {
        // Draw individual points for actual deviation mode
        p5Instance.noStroke();
        p5Instance.fill(r, g, b, 180);
        for (const point of data) {
          const x = graphX + (point.time / maxTime) * graphWidth;
          // Map deviation to Y: positive (late) above center, negative (early) below
          // Center line is at graphY + graphHeight/2
          const normalizedDev = point.deviation / actualRange; // -1 to +1
          const y = graphY + graphHeight / 2 - (normalizedDev * graphHeight / 2);
          p5Instance.circle(x, y, 5);
        }
      } else {
        // Draw cumulative line (existing behavior)
        if (data.length < 2) continue;
        p5Instance.stroke(r, g, b, 220);
        p5Instance.strokeWeight(2);
        p5Instance.noFill();

        p5Instance.beginShape();
        for (const point of data) {
          const x = graphX + (point.time / maxTime) * graphWidth;
          const y = graphY + graphHeight - (point.cumulativeDeviation / maxCumulative) * graphHeight;
          p5Instance.vertex(x, y);
        }
        p5Instance.endShape();
      }
    }

    // Draw stats table to the right of the graph
    const tableX = graphX + graphWidth + 15;
    const tableY = graphY - 5;

    // Table header (larger text - 16px, 2x the original 8px)
    p5Instance.fill(60, 60, 60);
    p5Instance.textSize(16);
    p5Instance.textAlign(p5Instance.LEFT, p5Instance.TOP);
    p5Instance.text('Drum', tableX, tableY);
    p5Instance.textAlign(p5Instance.RIGHT, p5Instance.TOP);
    p5Instance.text('Hits', tableX + 100, tableY); // Added 30px spacing from drum name
    p5Instance.text('Avg', tableX + 150, tableY);
    p5Instance.text('Std', tableX + 200, tableY);

    // Separator line
    p5Instance.stroke(150, 150, 150);
    p5Instance.strokeWeight(1);
    p5Instance.line(tableX, tableY + 20, tableX + 205, tableY + 20);

    // Table rows (larger text - 16px)
    let rowY = tableY + 26;
    for (const drumId of drumIds) {
      const stats = drumStats[drumId];
      if (!stats) continue;

      const settings = drumSettings[drumId];
      const colorHex = settings?.color || '#ffffff';
      const r = parseInt(colorHex.slice(1, 3), 16);
      const g = parseInt(colorHex.slice(3, 5), 16);
      const b = parseInt(colorHex.slice(5, 7), 16);

      // Color dot (larger)
      p5Instance.fill(r, g, b);
      p5Instance.noStroke();
      p5Instance.circle(tableX + 6, rowY + 8, 10);

      // Drum name - use settings.name instead of drumId
      p5Instance.fill(40, 40, 40);
      p5Instance.textSize(16);
      p5Instance.textAlign(p5Instance.LEFT, p5Instance.TOP);
      const drumName = settings?.name || drumId;
      const shortName = drumName.length > 8 ? drumName.slice(0, 8) : drumName;
      p5Instance.text(shortName, tableX + 16, rowY);

      // Hits count (shifted right to add spacing from drum name)
      p5Instance.textAlign(p5Instance.RIGHT, p5Instance.TOP);
      p5Instance.text(stats.hits.toString(), tableX + 100, rowY);

      // Average deviation
      p5Instance.text(stats.avgDeviation.toFixed(1), tableX + 150, rowY);

      // Standard deviation
      p5Instance.text(stats.stdDeviation.toFixed(1), tableX + 200, rowY);

      rowY += 22;
      if (rowY > graphY + graphHeight - 10) break; // Limit table height to graph area
    }

    p5Instance.pop();
  }

  /**
   * Get current graph dimensions (shared between draw and mouse handlers)
   */
  getDeviationGraphDimensions() {
    const graphMargin = 20;
    const statsTableWidth = 220;
    const resizeHandleSize = 12;
    const windowWidth = window.innerWidth || 800;
    const windowHeight = window.innerHeight || 600;

    // Calculate default graph width (80% of screen minus stats table)
    const defaultGraphWidth = Math.max(300, (windowWidth * 0.8) - statsTableWidth - 60);
    const defaultGraphHeight = 150;

    // Use custom dimensions if set, otherwise use defaults
    const graphWidth = this.deviationGraphWidth !== null ? this.deviationGraphWidth : defaultGraphWidth;
    const graphHeight = this.deviationGraphHeight !== null ? this.deviationGraphHeight : defaultGraphHeight;

    const totalWidth = graphWidth + statsTableWidth + 60;
    const totalHeight = graphHeight + 50;

    const panelHeight = this.getBottomPanelHeight();
    const panelTop = windowHeight - panelHeight;
    const defaultX = graphMargin;
    const defaultY = panelTop + 10;
    const baseX = this.deviationGraphX !== null ? this.deviationGraphX : defaultX;
    const baseY = this.deviationGraphY !== null ? this.deviationGraphY : defaultY;

    return {
      graphWidth, graphHeight, totalWidth, totalHeight,
      baseX, baseY, resizeHandleSize, statsTableWidth
    };
  }

  /**
   * Get the height of the fixed bottom panel for graph/metronome.
   * Returns 0 if no panel is needed.
   */
  getBottomPanelHeight() {
    if (this.layout !== 'staff') return 0;

    const hasGraph = this.showDeviationGraph && Object.keys(this.deviationData).length > 0;
    const hasMetronome = this.metronomeEnabled && this.recording && this.startTime;

    if (hasGraph) {
      const graphHeight = this.deviationGraphHeight !== null ? this.deviationGraphHeight : 150;
      // Graph height + margins (title, axis labels) + padding
      return graphHeight + 70;
    }

    if (hasMetronome) {
      return METRONOME_RADIUS * 2 + 40;
    }

    return 0;
  }

  /**
   * Handle mouse press on deviation graph
   * Returns true if graph was clicked (to prevent other interactions)
   */
  handleDeviationGraphMousePressed(mouseX, mouseY) {
    if (!this.showDeviationGraph || this.layout !== 'staff') return false;

    // Check if we have any data to display
    const drumIds = Object.keys(this.deviationData);
    if (drumIds.length === 0) return false;

    const dims = this.getDeviationGraphDimensions();
    const { totalWidth, totalHeight, baseX, baseY, resizeHandleSize } = dims;

    // Check if within graph bounds
    if (mouseX >= baseX && mouseX <= baseX + totalWidth &&
        mouseY >= baseY && mouseY <= baseY + totalHeight) {

      // Check for resize edges
      const nearRightEdge = mouseX >= baseX + totalWidth - resizeHandleSize;
      const nearBottomEdge = mouseY >= baseY + totalHeight - resizeHandleSize;

      if (nearRightEdge && nearBottomEdge) {
        // Corner resize
        this.deviationGraphResizing = true;
        this.deviationGraphResizeEdge = 'corner';
        this.deviationGraphDragOffsetX = mouseX;
        this.deviationGraphDragOffsetY = mouseY;
        return true;
      } else if (nearRightEdge) {
        // Right edge resize
        this.deviationGraphResizing = true;
        this.deviationGraphResizeEdge = 'right';
        this.deviationGraphDragOffsetX = mouseX;
        return true;
      } else if (nearBottomEdge) {
        // Bottom edge resize
        this.deviationGraphResizing = true;
        this.deviationGraphResizeEdge = 'bottom';
        this.deviationGraphDragOffsetY = mouseY;
        return true;
      } else {
        // Dragging
        this.deviationGraphDragging = true;
        this.deviationGraphDragOffsetX = mouseX - baseX;
        this.deviationGraphDragOffsetY = mouseY - baseY;
        return true;
      }
    }
    return false;
  }

  /**
   * Handle mouse drag on deviation graph (drag or resize)
   */
  handleDeviationGraphMouseDragged(mouseX, mouseY) {
    if (this.deviationGraphResizing) {
      const dims = this.getDeviationGraphDimensions();

      if (this.deviationGraphResizeEdge === 'corner' || this.deviationGraphResizeEdge === 'right') {
        // Resize width
        const deltaX = mouseX - this.deviationGraphDragOffsetX;
        const currentWidth = this.deviationGraphWidth !== null ? this.deviationGraphWidth : dims.graphWidth;
        const newWidth = Math.max(200, Math.min(1200, currentWidth + deltaX));
        this.deviationGraphWidth = newWidth;
        this.deviationGraphDragOffsetX = mouseX;
      }

      if (this.deviationGraphResizeEdge === 'corner' || this.deviationGraphResizeEdge === 'bottom') {
        // Resize height
        const deltaY = mouseY - this.deviationGraphDragOffsetY;
        const currentHeight = this.deviationGraphHeight !== null ? this.deviationGraphHeight : dims.graphHeight;
        const newHeight = Math.max(100, Math.min(400, currentHeight + deltaY));
        this.deviationGraphHeight = newHeight;
        this.deviationGraphDragOffsetY = mouseY;
      }
    } else if (this.deviationGraphDragging) {
      this.deviationGraphX = mouseX - this.deviationGraphDragOffsetX;
      this.deviationGraphY = mouseY - this.deviationGraphDragOffsetY;
    }
  }

  /**
   * Handle mouse release on deviation graph
   */
  handleDeviationGraphMouseReleased() {
    this.deviationGraphDragging = false;
    this.deviationGraphResizing = false;
    this.deviationGraphResizeEdge = null;
  }

  /**
   * Play metronome click sound using a short noise burst for precise timing perception
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

    const now = this.audioContext.currentTime;

    // Create a short noise burst filtered to sound like a click
    // This is more precise than a sine wave oscillator
    const bufferSize = Math.floor(this.audioContext.sampleRate * 0.015); // 15ms click
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate noise with exponential decay for sharp attack
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.exp(-i / (bufferSize * 0.15)); // Fast decay
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = buffer;

    // Bandpass filter to give the click a tonal character
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5;

    const gainNode = this.audioContext.createGain();

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Different tones and volumes for different beats
    if (isFirstBeat) {
      filter.frequency.value = 2500; // Higher pitch for downbeat
      gainNode.gain.value = 0.5;
    } else if (isBeat) {
      filter.frequency.value = 1800; // Medium pitch for beats
      gainNode.gain.value = 0.35;
    } else {
      filter.frequency.value = 1200; // Lower pitch for subdivisions
      gainNode.gain.value = 0.2;
    }

    noiseSource.start(now);
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
   * Get the planned BPM for a specific measure based on automation settings
   * Precalculates forward from baseBpm rather than looking at history
   * @param {number} measureNum - Measure number (0-indexed)
   * @returns {number} - BPM that will be active during this measure
   */
  getPlannedBpmForMeasure(measureNum) {
    if (!this.tempoAutomationEnabled || this.tempoAutomationBars <= 0) {
      return this.baseBpm || this.bpm;
    }

    // Calculate which tempo interval this measure falls in
    // Measures are 0-indexed, intervals are 0-indexed
    const interval = Math.floor(measureNum / this.tempoAutomationBars);

    const bpmDelta = this.tempoAutomationDirection === 'decrease'
      ? -this.tempoAutomationBpmChange
      : this.tempoAutomationBpmChange;

    let bpm = (this.baseBpm || this.bpm) + (interval * bpmDelta);

    // Apply limits
    if (this.tempoAutomationDirection === 'increase') {
      bpm = Math.min(bpm, this.tempoAutomationMaxBpm);
    } else {
      bpm = Math.max(bpm, this.tempoAutomationMinBpm);
    }

    return bpm;
  }

  /**
   * Get BPM at a specific measure number, using tempo history
   * @param {number} measureNum - Measure number (0-indexed)
   * @returns {number} - BPM for that measure
   */
  getBpmAtMeasure(measureNum) {
    if (!this.tempoHistory || this.tempoHistory.length === 0) {
      return this.bpm;
    }

    // Find the tempo entry that was active at this measure
    let activeBpm = this.tempoHistory[0].bpm;
    for (const entry of this.tempoHistory) {
      // entry.measure is 1-indexed (the measure when tempo changed)
      if (entry.measure && entry.measure <= measureNum + 1) {
        activeBpm = entry.bpm;
      } else if (!entry.measure) {
        // Initial entry at time 0
        activeBpm = entry.bpm;
      }
    }
    return activeBpm;
  }

  /**
   * Get the current continuous subdivision count (accounts for tempo changes)
   * This is the authoritative measure of position in the timeline
   * @returns {number} - Current subdivision count
   */
  getCurrentSubdivision() {
    if (!this.startTime) return 0;

    // Use effective time (excludes warmup) - same coordinate system as grid painting
    const effectiveTime = this.getEffectiveTimeElapsed();
    if (effectiveTime <= 0) return 0;

    // Use getBeatCountForTime which properly handles tempo history
    // This ensures consistency with how grid positions are calculated
    const beatCount = this.getBeatCountForTime(effectiveTime);

    // Convert beats to subdivisions
    const subdivisionsPerBeat = this.subdivision / 4;
    return beatCount * subdivisionsPerBeat;
  }

  /**
   * Get the current measure number (0-indexed) based on continuous subdivision counting
   * @returns {number} - Current measure number (0-indexed)
   */
  getCurrentMeasure() {
    const currentSubdivision = this.getCurrentSubdivision();
    const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);
    return Math.floor(currentSubdivision / subdivisionsPerMeasure);
  }

  /**
   * Get current staff index and position info for auto-scrolling
   * Uses the same calculation as the playhead drawing for consistency
   * @returns {Object} - { staffIndex, staffY, staffBottomY, rowHeight }
   */
  getCurrentStaffInfo() {
    if (!this.startTime || this.isInWarmup()) {
      return { staffIndex: 0, staffY: 0, staffBottomY: this.staffHeight, rowHeight: this.staffHeight + this.rowSpacing };
    }

    const currentSubdivision = this.getCurrentSubdivision();
    const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);
    const currentMeasureFloat = currentSubdivision / subdivisionsPerMeasure;

    if (currentMeasureFloat <= 0) {
      return { staffIndex: 0, staffY: 0, staffBottomY: this.staffHeight, rowHeight: this.staffHeight + this.rowSpacing };
    }

    // Use the same calculation as the playhead
    const measureNum = Math.floor(currentMeasureFloat);
    const measuresPerStaff = this.measuresPerStaffPreference > 0 ? this.measuresPerStaffPreference : 4;
    const staffIndex = Math.floor(measureNum / measuresPerStaff);

    const rowHeight = this.staffHeight + this.rowSpacing;
    const staffY = staffIndex * rowHeight;
    const staffBottomY = staffY + this.staffHeight;

    return { staffIndex, staffY, staffBottomY, rowHeight };
  }


  /**
   * Get beat count for a given effective time, accounting for tempo changes
   * This ensures dots are positioned correctly even when tempo changes during recording
   * @param {number} effectiveTime - Time elapsed since recording started (excluding warm-up)
   * @returns {number} - Beat count at this time
   */
  getBeatCountForTime(effectiveTime) {
    // If no tempo history, use simple calculation with starting BPM
    if (!this.tempoHistory || this.tempoHistory.length === 0) {
      const secondsPerBeat = 60 / (this.baseBpm || this.bpm);
      return effectiveTime / secondsPerBeat;
    }


    // Walk through tempo history to calculate beats accumulated at each tempo
    let totalBeats = 0;
    let previousTime = 0;
    let previousBpm = this.tempoHistory[0].bpm;

    for (let i = 1; i < this.tempoHistory.length; i++) {
      const entry = this.tempoHistory[i];
      const entryTime = entry.time;

      // If this tempo change is after our target time, stop here
      if (entryTime > effectiveTime) {
        break;
      }

      // Calculate beats during the previous tempo period
      const duration = entryTime - previousTime;
      const secondsPerBeat = 60 / previousBpm;
      totalBeats += duration / secondsPerBeat;

      previousTime = entryTime;
      previousBpm = entry.bpm;
    }

    // Add remaining time at current tempo
    const remainingTime = effectiveTime - previousTime;
    const secondsPerBeat = 60 / previousBpm;
    totalBeats += remainingTime / secondsPerBeat;

    return totalBeats;
  }

  /**
   * Calculate staff position based on measure number (measure-based positioning)
   * @param {number} measureNum - Measure number (0-indexed)
   * @param {number} beatInMeasure - Beat position within the measure (0 to beatsPerMeasure)
   * @param {number} canvasWidth - Canvas width for calculating staff width
   * @returns {Object} - { staffIndex, xInStaff, staffWidth, pixelsPerBeat }
   */
  getStaffPositionForMeasure(measureNum, beatInMeasure, canvasWidth) {
    const maxStaffWidth = canvasWidth - 100;
    const measuresPerStaff = this.measuresPerStaffPreference > 0 ? this.measuresPerStaffPreference : 4;

    // Which staff row is this measure on?
    const staffIndex = Math.floor(measureNum / measuresPerStaff);

    // Which measure within this staff (0-indexed)?
    const measureInStaff = measureNum % measuresPerStaff;

    // Calculate staff width and pixels per measure
    const staffWidth = maxStaffWidth;
    const pixelsPerMeasure = staffWidth / measuresPerStaff;
    const pixelsPerBeat = pixelsPerMeasure / this.beatsPerMeasure;

    // Calculate x position within staff
    const xInStaff = (measureInStaff * pixelsPerMeasure) + (beatInMeasure * pixelsPerBeat);

    return {
      staffIndex,
      xInStaff,
      staffWidth,
      pixelsPerBeat,
      pixelsPerMeasure
    };
  }

  /**
   * Draw timeline lane guides overlay
   * Uses measure-based positioning for correct behavior with tempo automation
   */
  drawLaneGuides(p5Instance, offsetX, offsetY, scale, paintCanvas) {
    // Only draw staff grid when using staff layout
    if (this.layout !== 'staff') {
      return;
    }

    p5Instance.push();
    p5Instance.colorMode(p5Instance.RGB, 255);

    const maxStaffWidth = paintCanvas.width - 100;
    const measuresPerStaff = this.measuresPerStaffPreference > 0 ? this.measuresPerStaffPreference : 4;

    // Set staff dimensions
    this.measuresPerStaff = measuresPerStaff;
    this.staffWidth = maxStaffWidth;

    // Calculate grid spacing (same for all staffs when using fixed measures per staff)
    const pixelsPerMeasure = this.staffWidth / measuresPerStaff;
    const pixelsPerBeat = pixelsPerMeasure / this.beatsPerMeasure;
    const pixelsPerSubdivision = pixelsPerBeat / (this.subdivision / 4);

    // Calculate how many staffs to show based on current measure
    const currentMeasure = this.getCurrentMeasure();
    const currentStaffIdx = Math.floor(currentMeasure / measuresPerStaff);
    const maxStaffsToShow = Math.min(currentStaffIdx + 2, Math.floor(paintCanvas.height / (this.staffHeight + this.rowSpacing)) + 1);

    // Draw staffs
    for (let staffIdx = 0; staffIdx < maxStaffsToShow; staffIdx++) {
      const staffY = staffIdx * (this.staffHeight + this.rowSpacing);

      // Calculate the starting measure for this staff (0-indexed)
      const staffStartMeasure = staffIdx * measuresPerStaff;

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
        const totalBeats = measuresPerStaff * this.beatsPerMeasure;
        const subdivisionsPerBeat = this.subdivision / 4;

        p5Instance.stroke(190, 190, 190, 200);
        p5Instance.strokeWeight(1);
        for (let beat = 0; beat <= totalBeats; beat++) {
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
        for (let beat = 0; beat <= totalBeats; beat++) {
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
        for (let measure = 0; measure <= measuresPerStaff; measure++) {
          const xPos = measure * pixelsPerMeasure;
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
      p5Instance.text(`M${staffStartMeasure + 1}`, offsetX + 5 * scale, offsetY + staffY * scale + 5 * scale);

      // Show planned BPM for this staff based on automation settings
      if (this.tempoAutomationEnabled) {
        const plannedBpm = this.getPlannedBpmForMeasure(staffStartMeasure);
        p5Instance.fill(100, 100, 100, 140);
        p5Instance.textSize(12.5 * scale);
        p5Instance.textAlign(p5Instance.RIGHT, p5Instance.TOP);
        p5Instance.text(`${plannedBpm} BPM`, offsetX + this.staffWidth * scale - 5 * scale, offsetY + staffY * scale + 5 * scale);
      }

      // Draw staff separator line (darker horizontal line between staffs)
      if (staffIdx < maxStaffsToShow - 1) {
        p5Instance.stroke(100, 100, 100, 180);
        p5Instance.strokeWeight(2 * scale);
        const separatorY = offsetY + (staffY + this.staffHeight) * scale;
        p5Instance.line(offsetX, separatorY, offsetX + this.staffWidth * scale, separatorY);
      }
    }

    // Draw playhead line (current position based on measure/beat)
    // Don't draw during warm-up period
    if (this.startTime !== null && !this.isInWarmup()) {
      const currentSubdivision = this.getCurrentSubdivision();
      const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);
      const currentMeasureFloat = currentSubdivision / subdivisionsPerMeasure;

      if (currentMeasureFloat > 0) {
        // Calculate staff position from measure
        const measureNum = Math.floor(currentMeasureFloat);
        const beatInMeasure = (currentMeasureFloat - measureNum) * this.beatsPerMeasure;
        const staffPos = this.getStaffPositionForMeasure(measureNum, beatInMeasure, paintCanvas.width);

        const playheadStaffY = staffPos.staffIndex * (this.staffHeight + this.rowSpacing);

        // Calculate beat pulse for visual effect
        let pulseAmount = 0;
        if (this.recording && this.metronomeEnabled) {
          const subdivisionInBeat = currentSubdivision % (this.subdivision / 4);
          const beatProgress = subdivisionInBeat / (this.subdivision / 4);

          // Create a sharp pulse at the start of each beat that decays quickly
          if (beatProgress < PLAYHEAD_PULSE_DECAY) {
            pulseAmount = 1 - (beatProgress / PLAYHEAD_PULSE_DECAY);
          }
        }

        // Red when recording, grey when stopped
        if (this.recording) {
          const baseBrightness = 50;
          const pulseBrightness = baseBrightness + (pulseAmount * 205);
          const baseAlpha = 200;
          const pulseAlpha = baseAlpha + (pulseAmount * 55);
          p5Instance.stroke(255, pulseBrightness, pulseBrightness, pulseAlpha);
        } else {
          p5Instance.stroke(100, 100, 100, 150);
        }

        // Add pulse effect to line thickness
        const pulseWeight = PLAYHEAD_BASE_WEIGHT + (pulseAmount * PLAYHEAD_PULSE_WEIGHT);
        p5Instance.strokeWeight(pulseWeight);

        const playheadX = offsetX + staffPos.xInStaff * scale;
        const playheadY1 = offsetY + (staffPos.staffIndex * (this.staffHeight + this.rowSpacing)) * scale;
        const playheadY2 = offsetY + (staffPos.staffIndex * (this.staffHeight + this.rowSpacing) + this.staffHeight) * scale;
        p5Instance.line(playheadX, playheadY1, playheadX, playheadY2);
      }
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
}
