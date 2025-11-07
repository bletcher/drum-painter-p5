/**
 * Timeline/Sequencer Mode
 * DAW-style sequencer with musical grid, staffs, BPM, time signatures
 * Records MIDI hits with precise timing on drum lanes
 */

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
    this.bpm = 120; // Beats per minute
    this.subdivision = 4; // Beat subdivision (4 = quarter notes, 8 = eighth notes, 16 = sixteenth notes)
    this.beatsPerMeasure = 4; // Time signature numerator (2/4, 3/4, 4/4, etc.)
    this.midiLatencyMs = 70; // MIDI latency compensation in milliseconds

    // Grid/Staff layout
    this.pixelsPerSecond = 200; // How many pixels = 1 second
    this.staffWidth = 1800; // Width before wrapping to next staff (calculated dynamically)
    this.staffHeight = 80; // Total height of one staff (all drums)
    this.drumLineSpacing = 15; // Vertical spacing between drum lines
    this.measuresPerStaff = 4; // Number of complete measures per staff row
    this.showGrid = true; // Show/hide grid lines
    this.rowSpacing = 10; // Vertical spacing between staff rows (pixels)

    // Metronome state
    this.metronomeEnabled = false;
    this.lastMetronomeClick = -1; // Last subdivision index that played a click
    this.lastMetronomeBPM = 120;
    this.lastMetronomeSubdivision = 4;
    this.audioContext = null; // Web Audio API context

    // Timeline lanes (generated from drum kit config)
    this.timelineLanes = {};
    this.timelineLaneCount = 0;
    this.regenerateLanes();
  }

  /**
   * Regenerate timeline lanes from drum kit config
   */
  regenerateLanes() {
    this.timelineLanes = {};
    this.drumKitConfig.forEach((drum, index) => {
      this.timelineLanes[drum.id] = index;
    });
    this.timelineLaneCount = this.drumKitConfig.length;
  }

  /**
   * Called when timeline mode is activated
   */
  onActivate({ paintCanvas }) {
    console.log('Timeline Mode activated');
    // Ensure timeline lanes match current drum configuration
    this.regenerateLanes();
  }

  /**
   * Called when timeline mode is deactivated
   */
  onDeactivate({ paintCanvas }) {
    this.stopRecording();
  }

  /**
   * Paint method - draws notes on timeline lanes
   */
  paint(note, velocity, context) {
    const { paintCanvas, drumSettings } = context;

    // Find which drum this is
    const drumId = this.findDrumIdByNote(note, drumSettings);
    if (!drumId || !(drumId in this.timelineLanes)) {
      console.warn(`Drum ${note} not mapped to timeline lane`);
      return;
    }

    // Don't paint if timeline is not recording
    if (!this.recording) {
      console.log('Timeline not recording - press Start button first');
      return;
    }

    const currentTime = Date.now();

    // Calculate time elapsed in seconds (excluding paused time)
    // Subtract MIDI latency compensation to align notes with grid
    const timeElapsed = (currentTime - this.startTime - this.pausedTime - this.midiLatencyMs) / 1000.0;

    // Calculate x position based on time
    const totalX = timeElapsed * this.pixelsPerSecond;

    // Calculate which staff (row) this belongs to based on wrapping
    const staffIndex = Math.floor(totalX / this.staffWidth);
    const xInStaff = totalX % this.staffWidth;

    // Calculate y position within the staff
    const laneIndex = this.timelineLanes[drumId];
    const staffY = staffIndex * (this.staffHeight + this.rowSpacing);
    const laneY = staffY + (laneIndex * this.drumLineSpacing) + this.drumLineSpacing;

    // Ensure paintCanvas is tall enough for this staff
    const requiredHeight = (staffIndex + 1) * (this.staffHeight + this.rowSpacing) + 100;
    if (paintCanvas.height < requiredHeight) {
      this.expandCanvasHeight(paintCanvas, requiredHeight, context);
    }

    // Get drum settings
    const settings = drumSettings[drumId];
    const scaledVelSize = this.applyScalingCurve(velocity, settings?.sizeScaling || 'linear');
    const scaledVelOpacity = this.applyScalingCurve(velocity, settings?.opacityScaling || 'linear');

    const col = this.getDrumColor(note, scaledVelOpacity, drumSettings);
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
    const size = (8 + scaledVelSize * 15) * sizeMultiplier * context.globalSizeMultiplier;
    const alpha = 200 * scaledVelOpacity * opacityMult;

    // Paint the dot
    paintCanvas.push();
    this.paintDot(paintCanvas, xInStaff, laneY, size, col, alpha, shape, stroke, rotation);
    paintCanvas.pop();

    // Add particle for visual feedback
    if (context.particles) {
      context.particles.push({
        x: xInStaff,
        y: laneY,
        size: size,
        color: col,
        life: 30,
        maxLife: 30,
        update: function() { this.life--; },
        display: function(offsetX, offsetY, scale) {
          if (this.life > 0) {
            const alpha = (this.life / this.maxLife) * 150;
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
  }

  /**
   * Update method - called every frame
   * Handles metronome updates
   */
  update(context) {
    // Update metronome if enabled and recording
    if (this.metronomeEnabled && this.recording) {
      this.updateMetronome();
    }
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
    const bgColor = context.currentBgColor !== undefined ? context.currentBgColor : 0;
    const BG_COLORS = [255, 0, 32, 240, 200];
    paintCanvas.fill(BG_COLORS[bgColor]);
    paintCanvas.rect(0, oldHeight, paintCanvas.width, requiredHeight - oldHeight);
    paintCanvas.pop();
  }

  /**
   * Start recording
   */
  startRecording(startOver = false) {
    this.recording = true;

    if (startOver) {
      // Start from beginning
      this.startTime = Date.now();
      this.pausedTime = 0;
      this.stopTime = null;
      this.lastMetronomeClick = -1;
      console.log('Timeline recording started (from beginning)');
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

        console.log(`Timeline recording continued (paused for ${pauseDuration}ms)`);
      } else {
        // First time starting
        this.startTime = Date.now();
        this.pausedTime = 0;
        this.stopTime = null;
        this.lastMetronomeClick = -1;
        console.log('Timeline recording started');
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
    console.log('Timeline recording stopped');
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

    // Clear canvas
    const bgColor = context.currentBgColor !== undefined ? context.currentBgColor : 0;
    const BG_COLORS = [255, 0, 32, 240, 200];

    // Temporarily reset blend mode to normal for clearing
    const BLEND_MODES = window.BLEND_MODES || [window.BLEND];
    const currentBlendMode = window.currentBlendMode || 0;
    paintCanvas.blendMode(window.BLEND);
    paintCanvas.background(BG_COLORS[bgColor]);
    paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);

    console.log('Timeline cleared');
  }

  /**
   * Update metronome - play click sounds based on BPM and subdivision
   */
  updateMetronome() {
    if (!this.startTime || !this.audioContext) return;

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
      this.playMetronomeClick(isFirstBeat, isBeat);
    }
  }

  /**
   * Play metronome click sound
   */
  playMetronomeClick(isFirstBeat, isBeat) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Different tones for different beats
    if (isFirstBeat) {
      oscillator.frequency.value = 1200; // High pitch for first beat
      gainNode.gain.value = 0.3;
    } else if (isBeat) {
      oscillator.frequency.value = 800; // Medium pitch for beats
      gainNode.gain.value = 0.2;
    } else {
      oscillator.frequency.value = 600; // Low pitch for subdivisions
      gainNode.gain.value = 0.1;
    }

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.05);
  }

  /**
   * Initialize audio context for metronome
   */
  initializeAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
    p5Instance.push();
    p5Instance.colorMode(p5Instance.RGB, 255);

    // Calculate beat/measure metrics
    const secondsPerBeat = 60 / this.bpm;
    const pixelsPerBeat = secondsPerBeat * this.pixelsPerSecond;
    const pixelsPerMeasure = pixelsPerBeat * this.beatsPerMeasure;
    const secondsPerSubdivision = secondsPerBeat / (this.subdivision / 4);
    const pixelsPerSubdivision = secondsPerSubdivision * this.pixelsPerSecond;

    // Calculate staff width to fit measures
    const maxStaffWidth = paintCanvas.width - 100;
    this.measuresPerStaff = Math.max(1, Math.floor(maxStaffWidth / pixelsPerMeasure));
    this.staffWidth = this.measuresPerStaff * pixelsPerMeasure;

    // Calculate how many staffs to show
    const timeElapsed = this.getElapsedTime();
    const totalX = timeElapsed * this.pixelsPerSecond;
    const maxStaffs = Math.max(1, Math.ceil(totalX / this.staffWidth) + 1);
    const maxStaffsToShow = Math.min(maxStaffs, Math.floor(paintCanvas.height / this.staffHeight) + 1);

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

      // Draw drum labels on left side with matching colors
      p5Instance.noStroke();
      p5Instance.textAlign(p5Instance.LEFT, p5Instance.CENTER);
      p5Instance.textSize(11 * scale);
      p5Instance.textStyle(p5Instance.BOLD);

      // Generate drum info from config
      const drumInfo = this.drumKitConfig.map(drum => {
        const drumSettings = window.drumSettings || {};
        const settings = drumSettings[drum.id];
        return {
          name: (settings?.name || drum.name).toUpperCase().substring(0, 6),
          drumId: drum.id
        };
      });

      drumInfo.forEach((info, i) => {
        const y = (staffY + (i * this.drumLineSpacing) + this.drumLineSpacing) * scale + offsetY;

        // Get drum color
        const drumSettings = window.drumSettings || {};
        const settings = drumSettings[info.drumId];
        if (settings) {
          const colorHex = settings.color;
          const r = parseInt(colorHex.slice(1, 3), 16);
          const g = parseInt(colorHex.slice(3, 5), 16);
          const b = parseInt(colorHex.slice(5, 7), 16);
          p5Instance.fill(r, g, b, 200);
        } else {
          p5Instance.fill(0, 0, 0, 100);
        }

        p5Instance.text(info.name, offsetX + 5 * scale, y);
      });

      // Draw staff index/measure marker
      p5Instance.textAlign(p5Instance.LEFT, p5Instance.TOP);
      p5Instance.textSize(10 * scale);
      p5Instance.fill(0, 0, 0, 80);
      const startTime = staffIdx * (this.staffWidth / this.pixelsPerSecond);
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
    if (this.startTime !== null && totalX > 0) {
      const staffIndex = Math.floor(totalX / this.staffWidth);
      const xInStaff = totalX % this.staffWidth;
      const staffY = staffIndex * (this.staffHeight + this.rowSpacing);

      // Red when recording, grey when stopped
      if (this.recording) {
        p5Instance.stroke(255, 50, 50, 200);
      } else {
        p5Instance.stroke(100, 100, 100, 150);
      }
      p5Instance.strokeWeight(3);
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
  findDrumIdByNote(note, drumSettings) {
    for (const drumId in drumSettings) {
      if (drumSettings[drumId].midiNote === note) {
        return drumId;
      }
    }
    return null;
  }

  getDrumColor(note, velocityNorm, drumSettings) {
    const drumId = this.findDrumIdByNote(note, drumSettings);
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
