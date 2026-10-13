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
  PLAYHEAD_BASE_WEIGHT,
  PLAYHEAD_PULSE_WEIGHT,
  PLAYHEAD_PULSE_DECAY
} from '../config/constants.js';
import { debugLog, debugWarn } from '../utils/debug.js';
import { getColorWithHueVariation } from '../utils/colorUtils.js';
import { applyScalingCurve } from '../utils/scaling.js';
import { findDrumByMidiNote } from '../utils/drumHelpers.js';
import { paintDot } from '../canvas/DrawingUtils.js';
import { Particle } from '../canvas/Particle.js';
import { beatsAtTime, timeAtBeats, nearestGridDeviation } from '../timing/tempoMath.js';
import { ClickPlayer } from '../timing/ClickPlayer.js';
import { Ticker } from '../timing/Ticker.js';

// Layouts whose positions come from elapsed time (need Start, follow the metronome)
export const TIME_BASED_LAYOUTS = ['staff', 'spiral', 'rings', 'petals', 'polygon'];

// How far ahead metronome clicks are scheduled (ms). Larger when the tab is hidden,
// because even worker timers can be delayed then.
const SCHEDULE_LOOKAHEAD_MS = 120;
const SCHEDULE_LOOKAHEAD_HIDDEN_MS = 1500;

// Delay between pressing Start and the first click, so it can be scheduled on time
const START_LEAD_MS = 150;

// Largest paint canvas we'll allocate, in device pixels per side. Browsers refuse
// canvases taller than ~32k px and big canvases cost a lot of memory.
const MAX_CANVAS_DEVICE_PX = 16384;

/**
 * Parse '#rrggbb' into [r, g, b] (white if missing/invalid)
 */
function hexToRgb(hex) {
  if (typeof hex !== 'string' || hex.length < 7) return [255, 255, 255];
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}

export class TimelineMode {
  constructor(drumKitConfig) {
    this.name = 'Timeline/Sequencer';
    this.drumKitConfig = drumKitConfig;

    // Timeline state. All times are performance.now() milliseconds — the same clock
    // as MIDI event timestamps — so hits can be placed exactly.
    this.recording = false;
    this.startTime = null; // When timeline zero (first warm-up click) is heard
    this.pausedTime = 0; // Accumulated paused time in milliseconds
    this.stopTime = null; // When we last stopped recording

    // Musical settings
    this.bpm = 80; // Beats per minute
    this.subdivision = DEFAULT_TIMELINE_SUBDIVISION; // Beat subdivision (4 = quarter notes, 8 = eighth notes, 12 = eighth triplets, 16 = sixteenth notes)
    this.beatsPerMeasure = 4; // Time signature numerator (2/4, 3/4, 4/4, etc.)
    this.midiLatencyMs = 0; // Timing offset subtracted from hit times (set by calibration)
    this.warmupMeasures = 0; // Number of measures to wait before painting (0-4)
    this.activeWarmupMeasures = 0; // Warm-up length captured when the current take started

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
    this.gridColor = '#b0b0b0'; // Grid line color (hex)
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
    this.clickPlayer = new ClickPlayer();
    this.nextSubdivision = 0; // Next grid line (counted from the first warm-up click) to schedule
    this.scheduler = new Ticker(() => this.scheduleAhead(), 25);
    this.pendingBpm = null; // Manual BPM change, applied at the next bar line
    this.onTempoChange = null; // Callback(bpm) when the tempo actually changes (e.g. MIDI clock)

    // Tempo automation settings
    this.tempoAutomationEnabled = false;
    this.tempoAutomationDirection = 'increase'; // 'increase' or 'decrease'
    this.tempoAutomationBpmChange = 5; // BPM to change each interval
    this.tempoAutomationBars = 4; // Number of bars between tempo changes
    this.tempoAutomationMaxBpm = 200; // Maximum BPM cap (for increase)
    this.tempoAutomationMinBpm = 40; // Minimum BPM floor (for decrease)
    this.baseBpm = 80; // Starting BPM (captured when recording starts)
    this.lastTempoChangeMeasure = -1; // Last tempo-automation interval applied

    // Tempo map: tempo changes during the take, always on bar lines.
    // Each entry: { time: seconds after warm-up, bpm, measure (1-indexed) }
    this.tempoHistory = [];

    // Deviation tracking (staff mode only)
    this.showDeviationGraph = false; // Toggle for displaying deviation graph
    this.deviationData = {}; // Per-drum deviation data: { drumId: [{ time, deviation, cumulativeDeviation }] }
    this.deviationStats = {}; // Running per-drum sums so stats don't rescan every frame
    this.deviationVersion = 0; // Bumped on every new data point; invalidates the graph cache
    this.deviationGraphCache = null; // Off-screen render of the graph body

    // Staff rows scrolled off the top of the paint canvas in very long sessions
    this.rowOffset = 0;

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

    // Release the audio context; it is recreated on the next Start
    this.clickPlayer.close();
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
        const staffY = this.getStaffY(staffPos.staffIndex);
        const laneY = staffY + (laneIndex * this.drumLineSpacing) + this.drumLineSpacing;

        return { x: staffPos.xInStaff, y: laneY };
    }
  }

  /**
   * Check if we're still in the warm-up period
   * @returns {boolean} - True if in warm-up, false if ready to paint
   */
  isInWarmup() {
    if (!this.recording || !this.startTime) {
      return false;
    }
    return this.getRawTime(performance.now()) < this.getWarmupDuration();
  }

  /**
   * Length of the warm-up in seconds (always at the starting tempo)
   */
  getWarmupDuration() {
    return (60 / this.baseBpm) * this.beatsPerMeasure * this.activeWarmupMeasures;
  }

  /**
   * Seconds since timeline zero (the first warm-up click), excluding pauses
   * @param {number} perfMs - A performance.now() time
   */
  getRawTime(perfMs) {
    if (!this.startTime) return 0;
    const now = this.recording ? perfMs : Math.min(perfMs, this.stopTime ?? perfMs);
    return (now - this.startTime - this.pausedTime) / 1000;
  }

  /**
   * Seconds since the end of the warm-up (negative during warm-up)
   * @param {number} perfMs - A performance.now() time
   */
  getEffectiveTimeAt(perfMs) {
    return this.getRawTime(perfMs) - this.getWarmupDuration();
  }

  /**
   * Get the effective time elapsed for visual/painting purposes
   * During warm-up, returns 0. After warm-up, returns actual time minus warm-up duration.
   * @returns {number} - Time in seconds for visual timeline position
   */
  getEffectiveTimeElapsed() {
    if (!this.startTime) return 0;
    return Math.max(0, this.getEffectiveTimeAt(performance.now()));
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
    const drumId = contextDrumId || findDrumByMidiNote(note, midiDeviceId, drumSettings);
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
    const isTimeBased = TIME_BASED_LAYOUTS.includes(this.layout);

    // Only require recording for time-based layouts
    // Point-based layouts (fibonacci, radial) can paint anytime
    if (isTimeBased && !this.recording) {
      debugLog('Timeline not recording - press Start button first');
      return;
    }

    // When the hit actually happened (MIDI timestamp), minus the calibrated offset
    const hitPerf = (context.hitTime ?? performance.now()) - this.midiLatencyMs;

    // Don't paint if the hit was during the warm-up period (only for time-based layouts)
    if (isTimeBased && this.getEffectiveTimeAt(hitPerf) < 0) {
      return;
    }

    // Calculate beat count based on layout type
    let beatCount;
    let timeElapsed;

    if (!isTimeBased) {
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
      // Make sure tempo changes up to the hit time are in the tempo map
      this.scheduleUpTo(hitPerf);

      // Time-based layouts: position comes from when the hit happened
      timeElapsed = this.getEffectiveTimeAt(hitPerf);

      // Use tempo-aware beat calculation to handle tempo changes correctly
      beatCount = this.getBeatCountForTime(timeElapsed);

      // Track deviation from the grid (always, so the graph has data when switched on)
      if (this.layout === 'staff') {
        this.recordDeviation(drumId, timeElapsed);
      }
    }

    // Get position based on selected layout
    const centerX = paintCanvas.width / 2;
    const centerY = paintCanvas.height / 2;
    let { x, y } = this.getLayoutPosition(drumId, beatCount, timeElapsed, centerX, centerY, paintCanvas.width);

    // For staff layout, make sure the canvas is tall enough for this row
    if (this.layout === 'staff') {
      const rowHeight = this.staffHeight + this.rowSpacing;
      const requiredHeight = y + rowHeight + 100;
      if (paintCanvas.height < requiredHeight) {
        const before = this.rowOffset;
        this.expandCanvasHeight(paintCanvas, requiredHeight, context);
        // Rows may have scrolled off the top to make room
        y -= (this.rowOffset - before) * rowHeight;
      }
    }

    // Get drum settings
    const settings = drumSettings[drumId];
    const scaledVelSize = applyScalingCurve(velocity, settings?.sizeScaling || 'linear');
    const scaledVelOpacity = applyScalingCurve(velocity, settings?.opacityScaling || 'linear');

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
      context.particles.push(new Particle(x, y, size, col));
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
   * Y position (in paint canvas pixels) of the top of a staff row
   * @param {number} staffIndex - Row number counted from the start of the take
   */
  getStaffY(staffIndex) {
    return (staffIndex - this.rowOffset) * (this.staffHeight + this.rowSpacing);
  }

  /**
   * Update method - called every frame
   * The metronome runs on its own scheduler; this is a backstop in case the
   * worker timer is unavailable or delayed.
   */
  update(context) {
    if (this.recording && this.startTime) {
      this.scheduleAhead();
    }
  }

  // ===== METRONOME SCHEDULER =====

  /**
   * Subdivisions per quarter note and per measure for the current grid
   */
  getGridInfo() {
    const perBeat = this.subdivision / 4;
    return { perBeat, perMeasure: perBeat * this.beatsPerMeasure };
  }

  /**
   * Time (seconds from timeline zero) of grid line k, counted from the first warm-up click
   * @param {number} k - Global subdivision index
   */
  getRawTimeOfSubdivision(k) {
    const { perBeat, perMeasure } = this.getGridInfo();
    const warmupSubdivisions = this.activeWarmupMeasures * perMeasure;
    if (k < warmupSubdivisions) {
      return (k / perBeat) * (60 / this.baseBpm);
    }
    return this.getWarmupDuration() + this.getTimeForSubdivision(k - warmupSubdivisions);
  }

  /**
   * Called by the ticker: schedule everything due in the next look-ahead window
   */
  scheduleAhead() {
    if (!this.recording || !this.startTime) return;
    const lookahead = document.hidden ? SCHEDULE_LOOKAHEAD_HIDDEN_MS : SCHEDULE_LOOKAHEAD_MS;
    this.scheduleUpTo(performance.now() + lookahead);
  }

  /**
   * Walk the grid up to a time, applying tempo changes at bar lines and
   * scheduling metronome clicks.
   * @param {number} horizonPerf - performance.now() time to schedule up to
   */
  scheduleUpTo(horizonPerf) {
    if (!this.recording || !this.startTime) return;

    // Guard against runaway loops (e.g. the tab was asleep for a long time)
    for (let guard = 0; guard < 10000; guard++) {
      const k = this.nextSubdivision;
      const clickPerf = this.startTime + this.pausedTime + this.getRawTimeOfSubdivision(k) * 1000;
      if (clickPerf > horizonPerf) break;

      this.onGridLine(k, clickPerf);
      this.nextSubdivision++;
    }
  }

  /**
   * Handle one grid line: tempo changes on bar lines, then the click
   * @param {number} k - Global subdivision index
   * @param {number} clickPerf - performance.now() time the grid line is heard
   */
  onGridLine(k, clickPerf) {
    const { perBeat, perMeasure } = this.getGridInfo();
    const warmupSubdivisions = this.activeWarmupMeasures * perMeasure;
    const postWarmup = k - warmupSubdivisions;

    if (postWarmup >= 0 && postWarmup % perMeasure === 0) {
      this.applyTempoChangesAtBar(postWarmup / perMeasure, this.getTimeForSubdivision(postWarmup));
    }

    // Don't play clicks that are already in the past (tab was asleep, etc.)
    if (this.metronomeEnabled && this.clickPlayer.isReady && clickPerf >= performance.now() - 5) {
      const type = k % perMeasure === 0 ? 'downbeat' : (k % perBeat === 0 ? 'beat' : 'sub');
      this.clickPlayer.scheduleClick(clickPerf, type);
    }
  }

  /**
   * Apply tempo automation or a pending manual BPM change at a bar line
   * @param {number} measureIndex - 0-indexed measure (after warm-up)
   * @param {number} barTime - Effective time of the bar line in seconds
   */
  applyTempoChangesAtBar(measureIndex, barTime) {
    let newBpm = null;

    if (this.tempoAutomationEnabled && this.tempoAutomationBars > 0) {
      const interval = Math.floor(measureIndex / this.tempoAutomationBars);
      if (interval > this.lastTempoChangeMeasure) {
        this.lastTempoChangeMeasure = interval;
        newBpm = this.getPlannedBpmForMeasure(measureIndex);
      }
    }

    if (this.pendingBpm !== null) {
      newBpm = this.pendingBpm;
      this.pendingBpm = null;
    }

    const currentBpm = this.tempoHistory.length > 0
      ? this.tempoHistory[this.tempoHistory.length - 1].bpm
      : this.baseBpm;

    if (newBpm !== null && newBpm !== currentBpm) {
      this.tempoHistory.push({ time: barTime, bpm: newBpm, measure: measureIndex + 1 });
      this.bpm = newBpm;
      this.deviationVersion++; // Tempo lines in the graph changed
      debugLog(`🎵 Tempo → ${newBpm} BPM at measure ${measureIndex + 1}`);
      this.updateBpmDisplay();
      if (this.onTempoChange) this.onTempoChange(newBpm);
    }
  }

  /**
   * Change BPM. Before the take starts it applies immediately; during a take it
   * applies at the next bar line so the grid stays continuous.
   * @param {number} bpm
   */
  setBpm(bpm) {
    if (!this.startTime) {
      this.bpm = bpm;
      this.baseBpm = bpm;
      return;
    }
    this.bpm = bpm;
    this.pendingBpm = bpm;
  }

  /**
   * After a pause or a grid setting change, continue scheduling from the
   * next grid line after the current position.
   */
  resyncScheduler() {
    if (!this.startTime) return;
    const position = this.getGlobalSubdivisionAt(performance.now());
    this.nextSubdivision = Math.max(0, Math.ceil(position - 1e-6));
  }

  /**
   * performance.now() time at which a beat (counted from the end of the warm-up) is heard
   * @param {number} beats - Quarter notes after the warm-up
   */
  getPerfTimeOfBeat(beats) {
    const effective = timeAtBeats(this.tempoHistory, beats, this.baseBpm || this.bpm);
    return this.startTime + this.pausedTime + (this.getWarmupDuration() + effective) * 1000;
  }

  /**
   * Fractional grid position at a time, counted from the first warm-up click
   * (negative before the first click)
   * @param {number} perfMs - A performance.now() time
   */
  getGlobalSubdivisionAt(perfMs) {
    const { perBeat, perMeasure } = this.getGridInfo();
    const raw = this.getRawTime(perfMs);
    const warmupDuration = this.getWarmupDuration();
    if (raw < warmupDuration) {
      return (raw / (60 / this.baseBpm)) * perBeat;
    }
    return this.activeWarmupMeasures * perMeasure +
      this.getBeatCountForTime(raw - warmupDuration) * perBeat;
  }

  /**
   * Draw circular visual metronome on window canvas
   * Called from main draw loop when metronome is enabled
   */
  drawCircularMetronome(p5Instance, canvasWidth, canvasHeight) {
    if (!this.metronomeEnabled) return;
    if (!this.startTime) return;
    if (!this.recording) return; // Stop visual metronome when recording ends

    const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);
    // Before the first click (start lead-in) show the hand at the top
    const currentSubdivision = Math.max(0, this.getGlobalSubdivisionAt(performance.now()));

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
    const bgColor = context.currentBgColor || '#ffffff';
    const rowHeight = this.staffHeight + this.rowSpacing;
    let density = paintCanvas.pixelDensity();

    // Grow in big steps so this (expensive) resize happens rarely
    let newHeight = Math.ceil(Math.max(requiredHeight, paintCanvas.height * 1.5));

    // Very long session: drop to 1x density before giving up history
    if (newHeight * density > MAX_CANVAS_DEVICE_PX && density > 1) {
      density = 1;
    }

    // Still too tall: scroll the oldest rows off the top
    let rowsToDrop = 0;
    const maxHeight = Math.floor(MAX_CANVAS_DEVICE_PX / density);
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      const overflow = requiredHeight - maxHeight;
      // Drop at least a third of the canvas so this doesn't happen every row
      rowsToDrop = Math.ceil(Math.max(overflow, maxHeight / 3) / rowHeight);
      if (!this._warnedRowsDropped && window.notificationSystem) {
        window.notificationSystem.show('Long session: the oldest rows are scrolling off the top. Save an image (S) to keep them.', 'warning');
        this._warnedRowsDropped = true;
      }
    }

    // Copy the current content on the GPU (no pixel readback)
    const snapshot = document.createElement('canvas');
    snapshot.width = paintCanvas.elt.width;
    snapshot.height = paintCanvas.elt.height;
    snapshot.getContext('2d').drawImage(paintCanvas.elt, 0, 0);
    const oldLogicalWidth = paintCanvas.width;
    const oldLogicalHeight = paintCanvas.height;

    if (density !== paintCanvas.pixelDensity()) {
      paintCanvas.pixelDensity(density);
    }
    paintCanvas.resizeCanvas(paintCanvas.width, newHeight);

    // resizeCanvas resets the context state, so clear to the background
    // and restore the blend mode afterwards
    const ctx = paintCanvas.drawingContext;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, paintCanvas.elt.width, paintCanvas.elt.height);
    ctx.restore();

    const shiftY = rowsToDrop * rowHeight;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(snapshot, 0, -shiftY, oldLogicalWidth, oldLogicalHeight);
    ctx.restore();

    this.rowOffset += rowsToDrop;

    // p5 caches the last fill/stroke style and skips re-setting an identical one,
    // but the resize wiped the real context state — forget the cache
    if (paintCanvas._renderer) {
      paintCanvas._renderer._cachedFillStyle = undefined;
      paintCanvas._renderer._cachedStrokeStyle = undefined;
    }

    const blendModes = window.BLEND_MODES;
    if (blendModes) {
      paintCanvas.blendMode(blendModes[window.currentBlendMode || 0]);
    }
  }

  /**
   * Start recording
   * @param {boolean} startOver - Restart from the beginning instead of continuing
   */
  startRecording(startOver = false) {
    if (this.recording && !startOver) return; // Already running
    this.recording = true;

    // Hide quick settings panel when recording starts
    const quickSettingsPanel = document.getElementById('drum-settings');
    if (quickSettingsPanel) {
      quickSettingsPanel.style.display = 'none';
    }

    // Create/resume audio for the metronome (Start is a user gesture, so the
    // browser allows audio to start here)
    if (this.metronomeEnabled) {
      this.initializeAudioContext();
    }

    const now = performance.now();

    if (startOver || this.startTime === null || this.stopTime === null) {
      // Fresh take. The first click lands slightly in the future so it can be
      // scheduled on time.
      this.clickPlayer.cancelPending();
      this.startTime = now + START_LEAD_MS;
      this.pausedTime = 0;
      this.stopTime = null;
      this.nextSubdivision = 0;
      this.activeWarmupMeasures = this.warmupMeasures;

      // Reset tempo state
      this.baseBpm = this.bpm;
      this.pendingBpm = null;
      this.lastTempoChangeMeasure = -1;
      this.tempoHistory = [{ time: 0, bpm: this.bpm, measure: 1 }];

      // Clear deviation tracking data
      this.clearDeviationData();

      debugLog('Timeline recording started');
    } else {
      // Continue after a pause
      const pauseDuration = now - this.stopTime;
      this.pausedTime += pauseDuration;
      this.stopTime = null;

      // BPM may have been edited while paused — apply at the next bar line
      const currentBpm = this.tempoHistory.length > 0
        ? this.tempoHistory[this.tempoHistory.length - 1].bpm
        : this.baseBpm;
      if (this.bpm !== currentBpm) {
        this.pendingBpm = this.bpm;
      }

      // Grid settings may also have changed; continue from the next grid line
      this.resyncScheduler();

      debugLog(`Timeline recording continued (paused for ${Math.round(pauseDuration)}ms)`);
    }

    this.scheduler.start();
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (!this.recording) return;

    this.recording = false;
    this.stopTime = performance.now();
    this.scheduler.stop();
    this.clickPlayer.cancelPending();
    debugLog('Timeline recording stopped');

    // Show quick settings panel when recording stops
    const quickSettingsPanel = document.getElementById('drum-settings');
    if (quickSettingsPanel) {
      quickSettingsPanel.style.display = 'block';
    }
  }

  /**
   * Restart the clock without changing settings (used by Reset Spiral)
   */
  restartClock() {
    const wasRecording = this.recording;
    this.stopRecording();
    this.startTime = null;
    this.stopTime = null;
    if (wasRecording) {
      this.startRecording(true);
    }
  }

  /**
   * Shrink the paint canvas back to its normal size after a long staff session
   * @param {p5.Graphics} paintCanvas
   * @param {string} bgColor
   */
  resetCanvasSize(paintCanvas, bgColor) {
    this.rowOffset = 0;
    this._warnedRowsDropped = false;
    if (!paintCanvas) return;

    const defaultHeight = window.PAINT_CANVAS_DEFAULT_HEIGHT || paintCanvas.height;
    const defaultDensity = window.PAINT_CANVAS_DEFAULT_DENSITY || paintCanvas.pixelDensity();
    if (paintCanvas.height === defaultHeight && paintCanvas.pixelDensity() === defaultDensity) {
      return;
    }

    if (paintCanvas.pixelDensity() !== defaultDensity) {
      paintCanvas.pixelDensity(defaultDensity);
    }
    paintCanvas.resizeCanvas(paintCanvas.width, defaultHeight);
    if (paintCanvas._renderer) {
      paintCanvas._renderer._cachedFillStyle = undefined;
      paintCanvas._renderer._cachedStrokeStyle = undefined;
    }
    paintCanvas.blendMode(window.BLEND);
    paintCanvas.background(bgColor || '#ffffff');
    if (window.BLEND_MODES) {
      paintCanvas.blendMode(window.BLEND_MODES[window.currentBlendMode || 0]);
    }
  }

  /**
   * Clear timeline and reset
   */
  clearTimeline(paintCanvas, context) {
    this.clear({ ...context, paintCanvas });
  }

  /**
   * Clear mode-specific state (called when canvas is cleared)
   * @param {Object} context - Painting context
   */
  clear(context = {}) {
    this.stopRecording();
    this.recording = false;
    this.startTime = null;
    this.pausedTime = 0;
    this.stopTime = null;
    this.nextSubdivision = 0;

    // Reset hit counters for point-based layouts
    this.globalHitCount = 0;
    this.perDrumHitCount = {};

    // Reset tempo automation state (but keep settings)
    this.baseBpm = this.bpm;
    this.pendingBpm = null;
    this.lastTempoChangeMeasure = -1;
    this.tempoHistory = [];

    // Clear deviation tracking data
    this.clearDeviationData();

    // A long staff session may have grown the canvas — shrink it back
    this.resetCanvasSize(context.paintCanvas || window.paintCanvas, context.currentBgColor);

    debugLog('Timeline state cleared');
  }

  /**
   * Average timing per tempo section (for the graph's per-tempo labels).
   * A section ends at each tempo change; only finished sections are returned.
   * @returns {Array<{bpm, avgDeviation, avgAbsDeviation, stdDeviation, absStdDeviation, hitCount, endTime}>}
   */
  getTempoAverages() {
    const averages = [];
    for (let i = 0; i < this.tempoHistory.length - 1; i++) {
      const startTime = this.tempoHistory[i].time;
      const endTime = this.tempoHistory[i + 1].time;
      const deviations = [];
      for (const drumId in this.deviationData) {
        for (const point of this.deviationData[drumId]) {
          if (point.time >= startTime && point.time < endTime) {
            deviations.push(point.deviation);
          }
        }
      }
      if (deviations.length === 0) continue;

      const n = deviations.length;
      const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / n;
      const avgAbsDeviation = deviations.reduce((sum, d) => sum + Math.abs(d), 0) / n;
      const stdDeviation = Math.sqrt(deviations.reduce((sum, d) => sum + (d - avgDeviation) ** 2, 0) / n);
      const absStdDeviation = Math.sqrt(deviations.reduce((sum, d) => sum + (Math.abs(d) - avgAbsDeviation) ** 2, 0) / n);

      averages.push({
        bpm: this.tempoHistory[i].bpm,
        avgDeviation,
        avgAbsDeviation,
        stdDeviation,
        absStdDeviation,
        hitCount: n,
        endTime
      });
    }
    return averages;
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
   * Record how far a hit was from the nearest grid line
   * @param {string} drumId - The drum that was hit
   * @param {number} timeElapsed - Effective time of the hit in seconds
   */
  recordDeviation(drumId, timeElapsed) {
    const { deviationMs } = nearestGridDeviation(
      this.tempoHistory, timeElapsed, this.subdivision / 4, this.baseBpm || this.bpm
    );

    if (!this.deviationData[drumId]) {
      this.deviationData[drumId] = [];
      this.deviationStats[drumId] = { count: 0, sumAbs: 0, sumAbsSq: 0 };
    }

    const data = this.deviationData[drumId];
    const stats = this.deviationStats[drumId];
    const absDeviation = Math.abs(deviationMs);
    const prevCumulative = data.length > 0 ? data[data.length - 1].cumulativeDeviation : 0;

    data.push({
      time: timeElapsed,
      deviation: deviationMs,
      cumulativeDeviation: prevCumulative + absDeviation
    });

    stats.count++;
    stats.sumAbs += absDeviation;
    stats.sumAbsSq += absDeviation * absDeviation;
    this.deviationVersion++;

    debugLog(`📊 Deviation: ${drumId} ${deviationMs.toFixed(1)}ms`);
  }

  /**
   * Get the time (in seconds) at which a given subdivision occurs, accounting for tempo history
   * This is the inverse of getBeatCountForTime - given a beat/subdivision count, find the time
   * @param {number} targetSubdivision - The subdivision index to find the time for
   * @returns {number} - Time in seconds when this subdivision occurs
   */
  getTimeForSubdivision(targetSubdivision) {
    return timeAtBeats(this.tempoHistory, targetSubdivision / (this.subdivision / 4), this.baseBpm || this.bpm);
  }

  /**
   * Clear deviation data (called when timeline is cleared)
   */
  clearDeviationData() {
    this.deviationData = {};
    this.deviationStats = {};
    this.deviationVersion++;
  }

  /**
   * Draw the deviation graph overlay.
   * The graph body (axes, points, stats) is rendered into an off-screen buffer
   * that is only rebuilt when new hits arrive or the graph is resized; each frame
   * just draws the buffer plus the hover/drag chrome.
   * @param {Object} p5Instance - The p5 instance (or graphics) to draw on
   * @param {number} offsetX - Unused, kept for API consistency
   * @param {number} offsetY - Unused, kept for API consistency
   * @param {number} scale - Unused, kept for API consistency
   * @param {Object} drumSettings - Current drum settings for colors
   */
  drawDeviationGraph(p5Instance, offsetX, offsetY, scale, drumSettings) {
    const hasData = this.showDeviationGraph && this.layout === 'staff' &&
      Object.keys(this.deviationData).length > 0;

    if (!hasData) {
      // Reset cursor when the graph isn't shown
      if (this._deviationGraphCursorSet) {
        p5Instance.cursor(p5Instance.ARROW);
        this._deviationGraphCursorSet = false;
      }
      return;
    }

    const { graphWidth, graphHeight, totalWidth, totalHeight, baseX, baseY, resizeHandleSize } =
      this.getDeviationGraphDimensions();

    // Check mouse position for drag/resize detection
    const mouseX = p5Instance.mouseX;
    const mouseY = p5Instance.mouseY;
    const isMouseOver = mouseX >= baseX && mouseX <= baseX + totalWidth &&
                        mouseY >= baseY && mouseY <= baseY + totalHeight;
    const nearRightEdge = isMouseOver && mouseX >= baseX + totalWidth - resizeHandleSize;
    const nearBottomEdge = isMouseOver && mouseY >= baseY + totalHeight - resizeHandleSize;
    const nearCorner = nearRightEdge && nearBottomEdge;

    p5Instance.push();

    // Background with hover effect
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

    // Cursor feedback
    if (this.deviationGraphResizing) {
      const cursors = { corner: 'nwse-resize', right: 'ew-resize', bottom: 'ns-resize' };
      p5Instance.cursor(cursors[this.deviationGraphResizeEdge] || 'nwse-resize');
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

    // Graph body from cache
    const body = this.getDeviationGraphBody(totalWidth, totalHeight, graphWidth, graphHeight, drumSettings);
    if (body) {
      p5Instance.image(body, baseX, baseY, totalWidth, totalHeight);
    }

    // Current BPM (changes independently of the data, so drawn live)
    p5Instance.noStroke();
    p5Instance.fill(180, 100, 50);
    p5Instance.textSize(14);
    p5Instance.textAlign(p5Instance.RIGHT, p5Instance.TOP);
    p5Instance.text(`${this.bpm} BPM`, baseX + totalWidth - 10, baseY + 4);

    // Resize handle in the corner
    if (isMouseOver || this.deviationGraphResizing) {
      const cornerX = baseX + totalWidth - 3;
      const cornerY = baseY + totalHeight - 3;
      p5Instance.stroke(120, 120, 120, 200);
      p5Instance.strokeWeight(1.5);
      for (let i = 0; i < 3; i++) {
        const offset = i * 4;
        p5Instance.line(cornerX - 10 + offset, cornerY, cornerX, cornerY - 10 + offset);
      }
    }

    p5Instance.pop();
  }

  /**
   * Return the cached graph body, re-rendering it if the data or size changed
   * (at most a few times per second while hits are streaming in)
   */
  getDeviationGraphBody(totalWidth, totalHeight, graphWidth, graphHeight, drumSettings) {
    const colorKey = Object.keys(this.deviationData)
      .map(id => drumSettings[id]?.color || '').join(',');
    const sizeKey = `${totalWidth}x${totalHeight}|${this.deviationGraphMode}|${colorKey}`;
    const cache = this.deviationGraphCache;
    const now = performance.now();

    const sizeChanged = !cache || cache.sizeKey !== sizeKey;
    const dataChanged = cache && cache.version !== this.deviationVersion;
    const throttled = cache && now - cache.renderedAt < 150;

    if (!sizeChanged && (!dataChanged || throttled)) {
      return cache.graphics;
    }

    let graphics = cache?.graphics;
    if (!graphics || graphics.width !== Math.ceil(totalWidth) || graphics.height !== Math.ceil(totalHeight)) {
      if (graphics) graphics.remove();
      graphics = createGraphics(Math.ceil(totalWidth), Math.ceil(totalHeight));
    }

    graphics.clear();
    this.renderDeviationGraphBody(graphics, totalWidth, graphWidth, graphHeight, drumSettings);

    this.deviationGraphCache = {
      graphics,
      sizeKey,
      version: this.deviationVersion,
      renderedAt: now
    };
    return graphics;
  }

  /**
   * Render axes, measure/tempo lines, points and the stats table into a buffer
   * whose origin is the graph panel's top-left corner
   */
  renderDeviationGraphBody(g, totalWidth, graphWidth, graphHeight, drumSettings) {
    const drumIds = Object.keys(this.deviationData);
    const isActualMode = this.deviationGraphMode === 'actual';

    // Scales
    let maxCumulative = 0;
    let maxAbsDeviation = 10;
    let maxTime = 0;
    for (const drumId of drumIds) {
      const data = this.deviationData[drumId];
      if (data.length === 0) continue;
      const last = data[data.length - 1];
      maxCumulative = Math.max(maxCumulative, last.cumulativeDeviation);
      maxTime = Math.max(maxTime, last.time);
      if (isActualMode) {
        for (const point of data) {
          const abs = Math.abs(point.deviation);
          if (abs > maxAbsDeviation) maxAbsDeviation = abs;
        }
      }
    }
    if (maxTime <= 0) maxTime = 1;
    if (maxCumulative <= 0) maxCumulative = 1;

    const graphX = 35;
    const graphY = 25;

    g.push();

    // Title
    g.noStroke();
    g.fill(40, 40, 40);
    g.textSize(11);
    g.textAlign(g.LEFT, g.TOP);
    g.text(isActualMode ? 'Timing Deviation (ms) [+late/-early]' : 'Cumulative Timing Deviation (ms)', graphX, 5);

    // Axes
    g.stroke(120, 120, 120);
    g.strokeWeight(1);
    const xAxisY = isActualMode ? graphY + graphHeight / 2 : graphY + graphHeight;
    g.line(graphX, xAxisY, graphX + graphWidth, xAxisY);
    g.line(graphX, graphY, graphX, graphY + graphHeight);

    // Axis labels
    g.noStroke();
    g.fill(80, 80, 80);
    g.textSize(9);
    g.textAlign(g.CENTER, g.TOP);
    g.text('Time (s)', graphX + graphWidth / 2, graphY + graphHeight + 5);
    g.text('0', graphX, graphY + graphHeight + 5);
    g.text(maxTime.toFixed(1), graphX + graphWidth, graphY + graphHeight + 5);

    g.textAlign(g.RIGHT, g.CENTER);
    if (isActualMode) {
      g.text(`+${maxAbsDeviation.toFixed(0)}`, graphX - 5, graphY);
      g.text('0', graphX - 5, graphY + graphHeight / 2);
      g.text(`-${maxAbsDeviation.toFixed(0)}`, graphX - 5, graphY + graphHeight);
    } else {
      g.text(maxCumulative.toFixed(0), graphX - 5, graphY);
      g.text('0', graphX - 5, graphY + graphHeight);
    }

    // Measure boundaries (skip when there are so many they'd be a grey smear)
    const subdivisionsPerMeasure = this.subdivision * (this.beatsPerMeasure / 4);
    const totalMeasures = Math.ceil(this.getBeatCountForTime(maxTime) / this.beatsPerMeasure);
    if (totalMeasures < graphWidth / 4) {
      g.stroke(180, 180, 180, 180);
      g.strokeWeight(0.75);
      for (let m = 1; m <= totalMeasures; m++) {
        const measureTime = this.getTimeForSubdivision(m * subdivisionsPerMeasure);
        if (measureTime > 0 && measureTime < maxTime) {
          const lineX = graphX + (measureTime / maxTime) * graphWidth;
          g.line(lineX, graphY, lineX, graphY + graphHeight);
        }
      }
    }

    // Tempo changes with labels
    if (this.tempoHistory.length > 0) {
      g.noStroke();
      g.fill(180, 120, 60, 200);
      g.textSize(10);
      g.textAlign(g.LEFT, g.BOTTOM);
      g.text(`${this.tempoHistory[0].bpm}`, graphX + 3, graphY + graphHeight - 3);

      for (let i = 1; i < this.tempoHistory.length; i++) {
        const entry = this.tempoHistory[i];
        if (entry.time > 0 && entry.time < maxTime) {
          const lineX = graphX + (entry.time / maxTime) * graphWidth;
          g.stroke(160, 100, 40, 200);
          g.strokeWeight(1.5);
          g.line(lineX, graphY, lineX, graphY + graphHeight);
          g.noStroke();
          g.text(`${entry.bpm}`, lineX + 3, graphY + graphHeight - 3);
        }
      }
    }

    // Average per finished tempo section (actual mode)
    if (isActualMode) {
      g.noStroke();
      g.textAlign(g.RIGHT, g.TOP);
      for (const avg of this.getTempoAverages()) {
        if (avg.endTime > maxTime) continue;
        const endX = graphX + (avg.endTime / maxTime) * graphWidth;
        g.fill(80, 80, 80);
        g.textSize(16);
        g.text(`${avg.avgDeviation >= 0 ? '+' : ''}${avg.avgDeviation.toFixed(0)}ms ±${avg.stdDeviation.toFixed(0)}`, endX - 3, graphY + 3);
        g.textSize(12);
        g.fill(120, 120, 120);
        g.text(`|avg| ${avg.avgAbsDeviation.toFixed(0)}ms ±${avg.absStdDeviation.toFixed(0)}`, endX - 3, graphY + 21);
      }
    }

    // Data per drum
    for (const drumId of drumIds) {
      const data = this.deviationData[drumId];
      if (data.length < 1) continue;
      const [r, gr, b] = hexToRgb(drumSettings[drumId]?.color);

      if (isActualMode) {
        g.noStroke();
        g.fill(r, gr, b, 180);
        for (const point of data) {
          const x = graphX + (point.time / maxTime) * graphWidth;
          const y = graphY + graphHeight / 2 - (point.deviation / maxAbsDeviation) * (graphHeight / 2);
          g.circle(x, y, 5);
        }
      } else if (data.length >= 2) {
        g.stroke(r, gr, b, 220);
        g.strokeWeight(2);
        g.noFill();
        g.beginShape();
        for (const point of data) {
          g.vertex(
            graphX + (point.time / maxTime) * graphWidth,
            graphY + graphHeight - (point.cumulativeDeviation / maxCumulative) * graphHeight
          );
        }
        g.endShape();
      }
    }

    // Stats table to the right of the graph
    const tableX = graphX + graphWidth + 15;
    const tableY = graphY - 5;
    g.noStroke();
    g.fill(60, 60, 60);
    g.textSize(16);
    g.textAlign(g.LEFT, g.TOP);
    g.text('Drum', tableX, tableY);
    g.textAlign(g.RIGHT, g.TOP);
    g.text('Hits', tableX + 100, tableY);
    g.text('Avg', tableX + 150, tableY);
    g.text('Std', tableX + 200, tableY);

    g.stroke(150, 150, 150);
    g.strokeWeight(1);
    g.line(tableX, tableY + 20, tableX + 205, tableY + 20);

    let rowY = tableY + 26;
    for (const drumId of drumIds) {
      const stats = this.deviationStats[drumId];
      if (!stats || stats.count === 0) continue;
      const avg = stats.sumAbs / stats.count;
      const std = Math.sqrt(Math.max(0, stats.sumAbsSq / stats.count - avg * avg));
      const [r, gr, b] = hexToRgb(drumSettings[drumId]?.color);

      g.noStroke();
      g.fill(r, gr, b);
      g.circle(tableX + 6, rowY + 8, 10);

      g.fill(40, 40, 40);
      g.textSize(16);
      g.textAlign(g.LEFT, g.TOP);
      const drumName = drumSettings[drumId]?.name || drumId;
      g.text(drumName.length > 8 ? drumName.slice(0, 8) : drumName, tableX + 16, rowY);

      g.textAlign(g.RIGHT, g.TOP);
      g.text(String(stats.count), tableX + 100, rowY);
      g.text(avg.toFixed(1), tableX + 150, rowY);
      g.text(std.toFixed(1), tableX + 200, rowY);

      rowY += 22;
      if (rowY > graphY + graphHeight - 10) break; // Limit table height to graph area
    }

    g.pop();
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
   * Returns 0 if no panel is needed right now.
   */
  getBottomPanelHeight() {
    // Staff-specific: deviation graph takes priority (larger panel)
    if (this.layout === 'staff') {
      const hasGraph = this.showDeviationGraph && Object.keys(this.deviationData).length > 0;
      if (hasGraph) {
        const graphHeight = this.deviationGraphHeight !== null ? this.deviationGraphHeight : 150;
        return graphHeight + 70;
      }
    }

    // All layouts: metronome reserves bottom space when recording
    if (this.metronomeEnabled && this.recording && this.startTime) {
      return METRONOME_RADIUS * 2 + 40;
    }

    return 0;
  }

  /**
   * Get the panel height that WILL appear once recording starts.
   * Used by the video recorder to pre-size the crop before the panel becomes visible.
   * Unlike getBottomPanelHeight(), this does not require recording to already be active.
   */
  getPotentialBottomPanelHeight() {
    // Staff-specific: deviation graph takes priority
    if (this.layout === 'staff' && this.showDeviationGraph) {
      const graphHeight = this.deviationGraphHeight !== null ? this.deviationGraphHeight : 150;
      return graphHeight + 70;
    }

    // All layouts: metronome reserves bottom space
    if (this.metronomeEnabled) {
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
   * Initialize audio for the metronome (call from a user gesture)
   */
  initializeAudioContext() {
    this.clickPlayer.init();
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
   * Get elapsed time in seconds (including warm-up)
   */
  getElapsedTime() {
    if (!this.startTime) return 0;
    return Math.max(0, this.getRawTime(performance.now()));
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
    const staffY = this.getStaffY(staffIndex);
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
    return beatsAtTime(this.tempoHistory, effectiveTime, this.baseBpm || this.bpm);
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
  // Parse this.gridColor hex string into [r, g, b] array
  _parseGridColor() {
    const hex = (this.gridColor || '#b0b0b0').replace('#', '');
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }

  drawLaneGuides(p5Instance, offsetX, offsetY, scale, paintCanvas, viewportHeight = p5Instance.height) {
    if (!this.showGrid) return;

    p5Instance.push();
    p5Instance.colorMode(p5Instance.RGB, 255);

    // Dispatch to circular-layout grid for non-staff time-based layouts
    if (['spiral', 'rings', 'petals', 'polygon'].includes(this.layout)) {
      this._drawCircularGrid(p5Instance, offsetX, offsetY, scale, paintCanvas);
      p5Instance.pop();
      return;
    }

    // Staff layout only below this point
    if (this.layout !== 'staff') {
      p5Instance.pop();
      return;
    }

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
    const rowHeight = this.staffHeight + this.rowSpacing;
    const maxStaffsToShow = Math.min(currentStaffIdx + 2, this.rowOffset + Math.floor(paintCanvas.height / rowHeight) + 1);

    // Only draw rows that are on screen (long sessions have hundreds of rows)
    const firstVisible = Math.max(this.rowOffset, this.rowOffset + Math.floor((-offsetY / scale) / rowHeight) - 1);
    const lastVisible = Math.min(maxStaffsToShow - 1,
      this.rowOffset + Math.ceil(((viewportHeight - offsetY) / scale) / rowHeight) + 1);

    const [gr, gg, gb] = this._parseGridColor();

    // Draw staffs
    for (let staffIdx = firstVisible; staffIdx <= lastVisible; staffIdx++) {
      const staffY = this.getStaffY(staffIdx);

      // Calculate the starting measure for this staff (0-indexed)
      const staffStartMeasure = staffIdx * measuresPerStaff;

      {
        // Draw horizontal staff lines for each drum
        p5Instance.stroke(gr, gg, gb, 120);
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

        p5Instance.stroke(gr, gg, gb, 200);
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
        p5Instance.stroke(gr, gg, gb, 180);
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
        p5Instance.stroke(gr, gg, gb, 180);
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
      if (staffIdx > this.rowOffset && this.rowSpacing > 0) {
        const gapStart = (staffY - this.rowSpacing) * scale + offsetY;
        const lineSpacing = this.rowSpacing * scale / 3; // Divide gap into thirds

        // First thin line (1/3 into the gap)
        const line1Y = gapStart + lineSpacing;
        p5Instance.stroke(gr, gg, gb, 150);
        p5Instance.strokeWeight(0.5);
        p5Instance.line(offsetX, line1Y, offsetX + this.staffWidth * scale, line1Y);

        // Second thin line (2/3 into the gap)
        const line2Y = gapStart + lineSpacing * 2;
        p5Instance.line(offsetX, line2Y, offsetX + this.staffWidth * scale, line2Y);
      }

      // Draw top line for staff when spacing is significant (> 6px)
      if (this.rowSpacing > 6) {
        const topLineY = staffY * scale + offsetY;
        p5Instance.stroke(gr, gg, gb, 200);
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
        const playheadY1 = offsetY + this.getStaffY(staffPos.staffIndex) * scale;
        const playheadY2 = offsetY + (this.getStaffY(staffPos.staffIndex) + this.staffHeight) * scale;
        p5Instance.line(playheadX, playheadY1, playheadX, playheadY2);
      }
    }

    p5Instance.pop();
  }

  // Draw radial beat/subdivision grid for circular time-based layouts (spiral, rings, petals, polygon)
  _drawCircularGrid(p5Instance, offsetX, offsetY, scale, paintCanvas) {
    const [gr, gg, gb] = this._parseGridColor();
    const cx = offsetX + (paintCanvas.width / 2) * scale;
    const cy = offsetY + (paintCanvas.height / 2) * scale;
    const maxR = Math.min(paintCanvas.width, paintCanvas.height) / 2 * TIMELINE_SPIRAL_MAX_RADIUS_MULT * scale;
    const subdivisionsPerBeat = this.subdivision / 4;
    const totalDivisions = this.beatsPerMeasure * subdivisionsPerBeat;

    p5Instance.noFill();

    // Layout-specific structural guides
    if (this.layout === 'rings') {
      // Concentric ring circles — one per drum lane (bold = lane boundary)
      p5Instance.strokeWeight(1);
      for (let i = 0; i < this.timelineLaneCount; i++) {
        const r = (TIMELINE_RING_BASE_RADIUS + i * this.ringSpacing) * scale;
        p5Instance.stroke(gr, gg, gb, 80);
        p5Instance.ellipse(cx, cy, r * 2);
        // Sub-circle between this lane and the next
        if (i < this.timelineLaneCount - 1) {
          const rMid = r + (this.ringSpacing / 2) * scale;
          p5Instance.stroke(gr, gg, gb, 35);
          p5Instance.strokeWeight(0.5);
          p5Instance.ellipse(cx, cy, rMid * 2);
          p5Instance.strokeWeight(1);
        }
      }

    } else if (this.layout === 'polygon') {
      // Polygon outline at base radius
      const baseR = TIMELINE_POLYGON_BASE_RADIUS * scale;
      const sides = this.polygonSides;
      p5Instance.stroke(gr, gg, gb, 60);
      p5Instance.strokeWeight(1);
      p5Instance.beginShape();
      for (let i = 0; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        p5Instance.vertex(cx + baseR * Math.cos(angle), cy + baseR * Math.sin(angle));
      }
      p5Instance.endShape(p5Instance.CLOSE);

      // Concentric circles at even intervals to form polar spider-web
      const circleStep = maxR / 6;
      p5Instance.strokeWeight(0.75);
      for (let n = 1; n <= 6; n++) {
        const r = circleStep * n;
        p5Instance.stroke(gr, gg, gb, n === 1 ? 70 : 40);
        p5Instance.ellipse(cx, cy, r * 2);
      }

    } else if (this.layout === 'petals') {
      // Concentric circles at even intervals for petals
      const circleStep = maxR / 6;
      p5Instance.strokeWeight(0.75);
      for (let n = 1; n <= 6; n++) {
        const r = circleStep * n;
        p5Instance.stroke(gr, gg, gb, n === 1 ? 70 : 40);
        p5Instance.ellipse(cx, cy, r * 2);
      }
    }

    // Radial beat/subdivision spokes — all circular layouts
    for (let i = 0; i < totalDivisions; i++) {
      const angle = (i / totalDivisions) * Math.PI * 2 - Math.PI / 2;
      const isMeasureStart = (i === 0);
      const isBeat = (i % subdivisionsPerBeat === 0);

      if (isMeasureStart) {
        p5Instance.stroke(gr, gg, gb, 160);
        p5Instance.strokeWeight(1.5);
      } else if (isBeat) {
        p5Instance.stroke(gr, gg, gb, 100);
        p5Instance.strokeWeight(1.0);
      } else {
        p5Instance.stroke(gr, gg, gb, 50);
        p5Instance.strokeWeight(0.5);
      }
      p5Instance.line(cx, cy, cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle));
    }
  }
}
