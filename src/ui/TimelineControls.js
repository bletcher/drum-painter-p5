/**
 * Timeline Controls UI
 * Provides BPM, time signature, subdivision, latency controls
 * Plus record, stop, start over, continue buttons
 */

export class TimelineControls {
  constructor(timelineMode, notificationSystem, videoRecorder = null) {
    this.timelineMode = timelineMode;
    this.notificationSystem = notificationSystem;
    this.videoRecorder = videoRecorder;
    this.updateInterval = null;
  }

  /**
   * Initialize the controls
   */
  initialize() {
    // BPM input
    const bpmInput = document.getElementById('timeline-bpm');
    if (bpmInput) {
      bpmInput.addEventListener('change', (e) => {
        const bpm = parseInt(e.target.value);
        this.timelineMode.bpm = Math.max(40, Math.min(240, bpm));
        this.updateBPMDisplay();
      });
    }

    // Grid subdivision selector
    const subdivisionSelect = document.getElementById('timeline-subdivision');
    if (subdivisionSelect) {
      subdivisionSelect.addEventListener('change', (e) => {
        this.timelineMode.subdivision = parseInt(e.target.value);
        this.timelineMode.lastMetronomeClick = -1; // Reset metronome
      });
    }

    // Time signature selector
    const timeSignatureSelect = document.getElementById('timeline-time-signature');
    if (timeSignatureSelect) {
      timeSignatureSelect.addEventListener('change', (e) => {
        this.timelineMode.beatsPerMeasure = parseInt(e.target.value);
        this.timelineMode.lastMetronomeClick = -1; // Reset metronome
      });
    }

    // Layout selector
    const layoutSelect = document.getElementById('timeline-layout');
    if (layoutSelect) {
      layoutSelect.addEventListener('change', (e) => {
        this.timelineMode.layout = e.target.value;
        this.notificationSystem.show(`Layout: ${e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1)}`);
      });
    }

    // Measures per staff selector
    const measuresPerStaffSelect = document.getElementById('timeline-measures-per-staff');
    if (measuresPerStaffSelect) {
      measuresPerStaffSelect.addEventListener('change', (e) => {
        this.timelineMode.measuresPerStaffPreference = parseInt(e.target.value);
        if (e.target.value === '0') {
          this.notificationSystem.show('Measures per row: Auto');
        } else {
          this.notificationSystem.show(`${e.target.value} measure${e.target.value === '1' ? '' : 's'} per row`);
        }
      });
    }

    // Metronome checkbox
    const metronomeCheckbox = document.getElementById('metronome-enabled');
    if (metronomeCheckbox) {
      metronomeCheckbox.addEventListener('change', (e) => {
        this.timelineMode.metronomeEnabled = e.target.checked;
        if (e.target.checked) {
          this.timelineMode.initializeAudioContext();
          this.notificationSystem.show('Metronome enabled');
        } else {
          this.notificationSystem.show('Metronome disabled');
        }
      });
    }

    // MIDI latency input
    const latencyInput = document.getElementById('midi-latency');
    if (latencyInput) {
      latencyInput.addEventListener('change', (e) => {
        this.timelineMode.midiLatencyMs = Math.max(0, Math.min(200, parseInt(e.target.value)));
      });
    }

    // Show grid checkbox
    const showGridCheckbox = document.getElementById('timeline-show-grid');
    if (showGridCheckbox) {
      showGridCheckbox.addEventListener('change', (e) => {
        this.timelineMode.showGrid = e.target.checked;
      });
    }

    // Row spacing slider
    const rowSpacingSlider = document.getElementById('timeline-row-spacing');
    if (rowSpacingSlider) {
      rowSpacingSlider.addEventListener('input', (e) => {
        this.timelineMode.rowSpacing = parseInt(e.target.value);
        this.updateRowSpacingDisplay();
      });
    }

    // Auto-record checkbox
    const autoRecordCheckbox = document.getElementById('timeline-auto-record');
    if (autoRecordCheckbox) {
      autoRecordCheckbox.addEventListener('change', () => {
        this.updateStatusText();
      });
    }

    // Video quality selector
    const videoQualitySelect = document.getElementById('timeline-video-quality');
    if (videoQualitySelect && this.videoRecorder) {
      videoQualitySelect.addEventListener('change', (e) => {
        this.videoRecorder.setQuality(e.target.value);
      });
    }

    // Video format selector
    const videoFormatSelect = document.getElementById('timeline-video-format');
    if (videoFormatSelect && this.videoRecorder) {
      videoFormatSelect.addEventListener('change', (e) => {
        this.videoRecorder.setFormat(e.target.value);
      });
    }

    // Warm-up measures selector
    const warmupSelect = document.getElementById('timeline-warmup-measures');
    if (warmupSelect) {
      warmupSelect.addEventListener('change', (e) => {
        this.timelineMode.warmupMeasures = parseInt(e.target.value);
      });
    }

    // Start button
    const startBtn = document.getElementById('timeline-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.handleStart(false));
    }

    // Pause button
    const pauseBtn = document.getElementById('timeline-pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.handlePause());
    }

    // End & Save button
    const endBtn = document.getElementById('timeline-end-btn');
    if (endBtn) {
      endBtn.addEventListener('click', () => this.handleEnd());
    }

    // Start Over button
    const startOverBtn = document.getElementById('timeline-start-over-btn');
    if (startOverBtn) {
      startOverBtn.addEventListener('click', () => this.handleStartOver());
    }

    // Continue button
    const continueBtn = document.getElementById('timeline-continue-btn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => this.handleStart(false));
    }

    // Start update loop for UI
    this.startUpdateLoop();
  }

  /**
   * Show Chronicle recording info in Quick Settings (disables video button)
   */
  showChronicleRecordingInfo() {
    const recordBtn = document.getElementById('video-record-btn');
    const infoDiv = document.getElementById('chronicle-recording-info');
    if (recordBtn) {
      recordBtn.disabled = true;
      recordBtn.style.opacity = '0.5';
      recordBtn.style.cursor = 'not-allowed';
    }
    if (infoDiv) {
      infoDiv.style.display = 'block';
    }
  }

  /**
   * Hide Chronicle recording info in Quick Settings (re-enables video button)
   */
  hideChronicleRecordingInfo() {
    const recordBtn = document.getElementById('video-record-btn');
    const infoDiv = document.getElementById('chronicle-recording-info');
    if (recordBtn) {
      recordBtn.disabled = false;
      recordBtn.style.opacity = '1';
      recordBtn.style.cursor = 'pointer';
    }
    if (infoDiv) {
      infoDiv.style.display = 'none';
    }
  }

  /**
   * Handle start button click
   */
  handleStart(startOver) {
    // Check if video recording should start with timeline
    const recordVideoCheckbox = document.getElementById('timeline-auto-record');
    const shouldRecordVideo = recordVideoCheckbox ? recordVideoCheckbox.checked : false;

    if (startOver) {
      // Clear canvas if starting over
      const paintCanvas = window.paintCanvas;
      const currentBgColor = window.currentBgColor || 0;
      const BG_COLORS = [255, 0, 32, 240, 200];
      if (paintCanvas) {
        // Get current blend mode and temporarily reset to normal for clearing
        const BLEND_MODES = window.BLEND_MODES || [window.BLEND];
        const currentBlendMode = window.currentBlendMode || 0;
        paintCanvas.blendMode(window.BLEND);
        paintCanvas.background(BG_COLORS[currentBgColor]);
        paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
      }
      // Reset scroll position when starting over
      if (window.resetTimelineScroll) {
        window.resetTimelineScroll();
      }
      if (shouldRecordVideo) {
        this.notificationSystem.show('Timeline started • Recording video');
      } else {
        this.notificationSystem.show('Timeline started');
      }
    } else {
      if (shouldRecordVideo) {
        this.notificationSystem.show(this.timelineMode.startTime ? 'Timeline continued • Recording video' : 'Timeline started • Recording video');
      } else {
        this.notificationSystem.show(this.timelineMode.startTime ? 'Timeline continued' : 'Timeline started');
      }
    }

    // Always start timeline recording (painting at time positions)
    this.timelineMode.startRecording(startOver);

    // Start video recording if checkbox is checked
    if (shouldRecordVideo && this.videoRecorder && !this.videoRecorder.isRecording) {
      this.videoRecorder.startRecording().then(success => {
        if (success && window.updateVideoRecordingUI) {
          window.updateVideoRecordingUI(true);
        }
        // Disable Quick Settings video button while Chronicle is recording
        if (success) {
          this.showChronicleRecordingInfo();
        }
      });
    }

    this.updateButtonsUI();
    this.updateStatusText();
  }

  /**
   * Handle pause button click
   */
  handlePause() {
    this.timelineMode.stopRecording();
    // Note: Video recording continues, we just pause the timeline
    this.notificationSystem.show('Timeline paused');
    this.updateButtonsUI();
    this.updateStatusText();
  }

  /**
   * Handle end & save button click
   */
  handleEnd() {
    this.timelineMode.stopRecording();

    // Stop and save video recording if it's running
    if (this.videoRecorder && this.videoRecorder.isRecording) {
      this.videoRecorder.stopRecording();
      if (window.updateVideoRecordingUI) {
        window.updateVideoRecordingUI(false);
      }
      // Re-enable Quick Settings video button
      this.hideChronicleRecordingInfo();
      this.notificationSystem.show('Timeline ended • Video saved');
    } else {
      this.notificationSystem.show('Timeline ended');
    }

    this.updateButtonsUI();
    this.updateStatusText();
  }

  /**
   * Handle start over button click
   */
  handleStartOver() {
    // Save video first if recording
    if (this.videoRecorder && this.videoRecorder.isRecording) {
      this.videoRecorder.stopRecording();
      if (window.updateVideoRecordingUI) {
        window.updateVideoRecordingUI(false);
      }
      // Re-enable Quick Settings video button
      this.hideChronicleRecordingInfo();
    }

    // Clear canvas
    const paintCanvas = window.paintCanvas;
    const currentBgColor = window.currentBgColor || 0;
    const BG_COLORS = [255, 0, 32, 240, 200];
    if (paintCanvas) {
      const BLEND_MODES = window.BLEND_MODES || [window.BLEND];
      const currentBlendMode = window.currentBlendMode || 0;
      paintCanvas.blendMode(window.BLEND);
      paintCanvas.background(BG_COLORS[currentBgColor]);
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
    }

    // Reset scroll position
    if (window.resetTimelineScroll) {
      window.resetTimelineScroll();
    }

    // Reset timeline
    this.timelineMode.startTime = null;
    this.timelineMode.stopTime = null;
    this.timelineMode.pausedTime = 0;
    this.timelineMode.recording = false;

    this.notificationSystem.show('Canvas cleared • Ready to start');
    this.updateButtonsUI();
    this.updateStatusText();
  }

  /**
   * Update button visibility based on recording state
   */
  updateButtonsUI() {
    const state = this.timelineMode.getRecordingState();

    const startBtn = document.getElementById('timeline-start-btn');
    const pauseBtn = document.getElementById('timeline-pause-btn');
    const endBtn = document.getElementById('timeline-end-btn');
    const startOverBtn = document.getElementById('timeline-start-over-btn');
    const continueBtn = document.getElementById('timeline-continue-btn');

    // Initial state: Show only Start button
    if (state === 'initial') {
      if (startBtn) startBtn.style.display = 'block';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (endBtn) endBtn.style.display = 'none';
      if (startOverBtn) startOverBtn.style.display = 'none';
      if (continueBtn) continueBtn.style.display = 'none';
    }
    // Recording state: Show Pause and End buttons
    else if (state === 'recording') {
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'block';
      if (endBtn) endBtn.style.display = 'block';
      if (startOverBtn) startOverBtn.style.display = 'none';
      if (continueBtn) continueBtn.style.display = 'none';
    }
    // Stopped state: Show Start Over and Continue buttons
    else if (state === 'stopped') {
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (endBtn) endBtn.style.display = 'none';
      if (startOverBtn) startOverBtn.style.display = 'block';
      if (continueBtn) continueBtn.style.display = 'block';
    }
  }

  /**
   * Update status text
   */
  updateStatusText() {
    const statusDiv = document.getElementById('timeline-status');
    if (!statusDiv) return;

    const state = this.timelineMode.getRecordingState();
    const elapsed = this.timelineMode.getElapsedTime();
    const recordVideoCheckbox = document.getElementById('timeline-auto-record');
    const shouldRecordVideo = recordVideoCheckbox ? recordVideoCheckbox.checked : false;

    if (state === 'initial') {
      statusDiv.textContent = shouldRecordVideo ? 'Press Start (will record video)' : 'Press Start';
    } else if (state === 'recording') {
      // Check if we're in warm-up period
      if (this.timelineMode.isInWarmup()) {
        statusDiv.textContent = `⏱ Warming up... ${elapsed.toFixed(1)}s`;
      } else {
        const recordingText = shouldRecordVideo && this.videoRecorder && this.videoRecorder.isRecording ? ' • 🔴 Recording' : '';
        statusDiv.textContent = `▶ Timeline: ${elapsed.toFixed(1)}s${recordingText}`;
      }
    } else if (state === 'stopped') {
      statusDiv.textContent = `⏸ Timeline paused at ${elapsed.toFixed(1)}s`;
    }
  }

  /**
   * Update BPM display
   */
  updateBPMDisplay() {
    const bpmDisplay = document.getElementById('bpm-display');
    const bpmInput = document.getElementById('timeline-bpm');

    if (bpmDisplay) {
      bpmDisplay.textContent = this.timelineMode.bpm;
    }
    if (bpmInput) {
      bpmInput.value = this.timelineMode.bpm;
    }
  }

  /**
   * Update row spacing display
   */
  updateRowSpacingDisplay() {
    const rowSpacingDisplay = document.getElementById('row-spacing-display');
    if (rowSpacingDisplay) {
      rowSpacingDisplay.textContent = `${this.timelineMode.rowSpacing}px`;
    }
  }

  /**
   * Sync UI with current timeline mode settings
   */
  syncUI() {
    const bpmInput = document.getElementById('timeline-bpm');
    const bpmDisplay = document.getElementById('bpm-display');
    const subdivisionSelect = document.getElementById('timeline-subdivision');
    const timeSignatureSelect = document.getElementById('timeline-time-signature');
    const metronomeCheckbox = document.getElementById('metronome-enabled');
    const latencyInput = document.getElementById('midi-latency');
    const showGridCheckbox = document.getElementById('timeline-show-grid');
    const rowSpacingSlider = document.getElementById('timeline-row-spacing');
    const rowSpacingDisplay = document.getElementById('row-spacing-display');
    const warmupSelect = document.getElementById('timeline-warmup-measures');
    const measuresPerStaffSelect = document.getElementById('timeline-measures-per-staff');

    if (bpmInput) bpmInput.value = this.timelineMode.bpm;
    if (bpmDisplay) bpmDisplay.textContent = this.timelineMode.bpm;
    if (subdivisionSelect) subdivisionSelect.value = this.timelineMode.subdivision;
    if (timeSignatureSelect) timeSignatureSelect.value = this.timelineMode.beatsPerMeasure;
    if (metronomeCheckbox) metronomeCheckbox.checked = this.timelineMode.metronomeEnabled;
    if (latencyInput) latencyInput.value = this.timelineMode.midiLatencyMs;
    if (showGridCheckbox) showGridCheckbox.checked = this.timelineMode.showGrid;
    if (rowSpacingSlider) rowSpacingSlider.value = this.timelineMode.rowSpacing;
    if (rowSpacingDisplay) rowSpacingDisplay.textContent = `${this.timelineMode.rowSpacing}px`;
    if (warmupSelect) warmupSelect.value = this.timelineMode.warmupMeasures;
    if (measuresPerStaffSelect) measuresPerStaffSelect.value = this.timelineMode.measuresPerStaffPreference;

    this.updateButtonsUI();
    this.updateStatusText();
  }

  /**
   * Start update loop for continuous UI updates
   */
  startUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Update UI every 100ms
    this.updateInterval = setInterval(() => {
      if (this.timelineMode.recording) {
        this.updateStatusText();
      }
    }, 100);
  }

  /**
   * Stop update loop
   */
  stopUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Show timeline controls
   */
  show() {
    const container = document.getElementById('timeline-controls');
    if (container) {
      container.style.display = 'block';
      this.syncUI();
    }
  }

  /**
   * Hide timeline controls
   */
  hide() {
    const container = document.getElementById('timeline-controls');
    if (container) {
      container.style.display = 'none';
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopUpdateLoop();
  }
}
