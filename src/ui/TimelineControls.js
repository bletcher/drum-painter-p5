/**
 * Timeline Controls UI
 * Provides BPM, time signature, subdivision, latency controls
 * Plus record, stop, start over, continue buttons
 */

export class TimelineControls {
  constructor(timelineMode, notificationSystem) {
    this.timelineMode = timelineMode;
    this.notificationSystem = notificationSystem;
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

    // Start button
    const startBtn = document.getElementById('timeline-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.handleStart(false));
    }

    // Stop button
    const stopBtn = document.getElementById('timeline-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.handleStop());
    }

    // Start Over button
    const startOverBtn = document.getElementById('timeline-start-over-btn');
    if (startOverBtn) {
      startOverBtn.addEventListener('click', () => this.handleStart(true));
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
   * Handle start button click
   */
  handleStart(startOver) {
    // Check if auto-record is enabled
    const autoRecordCheckbox = document.getElementById('timeline-auto-record');
    const shouldAutoRecord = autoRecordCheckbox ? autoRecordCheckbox.checked : true;

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
      if (shouldAutoRecord) {
        this.notificationSystem.show('Recording Started (New)');
      } else {
        this.notificationSystem.show('Timeline Started (Not Recording)');
      }
    } else {
      if (shouldAutoRecord) {
        this.notificationSystem.show(this.timelineMode.startTime ? 'Recording Continued' : 'Recording Started');
      } else {
        this.notificationSystem.show('Timeline Started (Not Recording)');
      }
    }

    // Only start recording if auto-record is enabled
    if (shouldAutoRecord) {
      this.timelineMode.startRecording(startOver);
    } else {
      // Start timeline but don't record
      this.timelineMode.recording = false;
      if (startOver || !this.timelineMode.startTime) {
        this.timelineMode.startTime = Date.now();
      }
    }

    this.updateButtonsUI();
    this.updateStatusText();
  }

  /**
   * Handle stop button click
   */
  handleStop() {
    this.timelineMode.stopRecording();
    this.notificationSystem.show('Recording Stopped');
    this.updateButtonsUI();
    this.updateStatusText();
  }

  /**
   * Update button visibility based on recording state
   */
  updateButtonsUI() {
    const state = this.timelineMode.getRecordingState();

    const initialButtons = document.getElementById('timeline-buttons-initial');
    const recordingButtons = document.getElementById('timeline-buttons-recording');
    const stoppedButtons = document.getElementById('timeline-buttons-stopped');

    if (initialButtons) initialButtons.style.display = 'none';
    if (recordingButtons) recordingButtons.style.display = 'none';
    if (stoppedButtons) stoppedButtons.style.display = 'none';

    if (state === 'initial') {
      if (initialButtons) initialButtons.style.display = 'flex';
    } else if (state === 'recording') {
      if (recordingButtons) recordingButtons.style.display = 'flex';
    } else if (state === 'stopped') {
      if (stoppedButtons) stoppedButtons.style.display = 'flex';
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
    const autoRecordCheckbox = document.getElementById('timeline-auto-record');
    const shouldAutoRecord = autoRecordCheckbox ? autoRecordCheckbox.checked : true;

    if (state === 'initial') {
      statusDiv.textContent = shouldAutoRecord ? 'Press Start to begin recording' : 'Press Start (auto-record OFF)';
    } else if (state === 'recording') {
      statusDiv.textContent = `🔴 Recording... ${elapsed.toFixed(1)}s`;
    } else if (state === 'stopped') {
      // Check if timeline is running but not recording
      if (this.timelineMode.startTime && !this.timelineMode.recording && !shouldAutoRecord) {
        statusDiv.textContent = `⏸ Timeline running... ${elapsed.toFixed(1)}s (not recording)`;
      } else {
        statusDiv.textContent = `Recording paused at ${elapsed.toFixed(1)}s`;
      }
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

    if (bpmInput) bpmInput.value = this.timelineMode.bpm;
    if (bpmDisplay) bpmDisplay.textContent = this.timelineMode.bpm;
    if (subdivisionSelect) subdivisionSelect.value = this.timelineMode.subdivision;
    if (timeSignatureSelect) timeSignatureSelect.value = this.timelineMode.beatsPerMeasure;
    if (metronomeCheckbox) metronomeCheckbox.checked = this.timelineMode.metronomeEnabled;
    if (latencyInput) latencyInput.value = this.timelineMode.midiLatencyMs;
    if (showGridCheckbox) showGridCheckbox.checked = this.timelineMode.showGrid;
    if (rowSpacingSlider) rowSpacingSlider.value = this.timelineMode.rowSpacing;
    if (rowSpacingDisplay) rowSpacingDisplay.textContent = `${this.timelineMode.rowSpacing}px`;

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
