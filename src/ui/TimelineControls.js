/**
 * Timeline Controls UI
 * Provides BPM, time signature, subdivision, latency controls
 * Plus record, stop, start over, continue buttons
 */

import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';

export class TimelineControls {
  constructor(timelineMode, notificationSystem, videoRecorder = null) {
    this.timelineMode = timelineMode;
    this.notificationSystem = notificationSystem;
    this.videoRecorder = videoRecorder;
    this.updateInterval = null;
    this.onBpmOrTimeSigChange = null; // Callback(bpm, beatsPerMeasure) — used to update MIDI clock display
  }

  /**
   * Schedule auto-save via global stateManager
   */
  scheduleAutoSave() {
    if (window.stateManager && window.stateManager.scheduleAutoSave) {
      window.stateManager.scheduleAutoSave();
    }
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
        if (this.onBpmOrTimeSigChange) {
          this.onBpmOrTimeSigChange(this.timelineMode.bpm, this.timelineMode.beatsPerMeasure);
        }
        this.scheduleAutoSave();
      });
    }

    // Grid subdivision selector
    const subdivisionSelect = document.getElementById('timeline-subdivision');
    if (subdivisionSelect) {
      subdivisionSelect.addEventListener('change', (e) => {
        this.timelineMode.subdivision = parseInt(e.target.value);
        this.timelineMode.lastMetronomeClick = -1; // Reset metronome
        this.scheduleAutoSave();
      });
    }

    // Time signature selector
    const timeSignatureSelect = document.getElementById('timeline-time-signature');
    if (timeSignatureSelect) {
      timeSignatureSelect.addEventListener('change', (e) => {
        this.timelineMode.beatsPerMeasure = parseInt(e.target.value);
        this.timelineMode.lastMetronomeClick = -1; // Reset metronome
        if (this.onBpmOrTimeSigChange) {
          this.onBpmOrTimeSigChange(this.timelineMode.bpm, this.timelineMode.beatsPerMeasure);
        }
        this.scheduleAutoSave();
      });
    }

    // Layout selector
    const layoutSelect = document.getElementById('timeline-layout');
    if (layoutSelect) {
      layoutSelect.addEventListener('change', (e) => {
        this.timelineMode.layout = e.target.value;
        this.notificationSystem.show(`Layout: ${e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1)}`);
        this.scheduleAutoSave();
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
        this.scheduleAutoSave();
      });
    }

    // Metronome checkbox
    const metronomeCheckbox = document.getElementById('metronome-enabled');
    if (metronomeCheckbox) {
      metronomeCheckbox.addEventListener('change', (e) => {
        debugLog('🔘 Metronome checkbox changed to:', e.target.checked);
        this.timelineMode.metronomeEnabled = e.target.checked;
        debugLog('🔘 timelineMode.metronomeEnabled is now:', this.timelineMode.metronomeEnabled);
        if (e.target.checked) {
          this.timelineMode.initializeAudioContext();
          this.notificationSystem.show('Metronome enabled');
        } else {
          this.notificationSystem.show('Metronome disabled');
        }
        // Show/hide tempo automation section
        this.updateTempoAutomationVisibility();
        this.scheduleAutoSave();
      });
    } else {
      debugWarn('⚠️ Metronome checkbox element not found!');
    }

    // Tempo automation checkbox
    const tempoAutoCheckbox = document.getElementById('tempo-automation-enabled');
    if (tempoAutoCheckbox) {
      tempoAutoCheckbox.addEventListener('change', (e) => {
        this.timelineMode.tempoAutomationEnabled = e.target.checked;
        // Show/hide the detail controls
        const controlsDiv = document.getElementById('tempo-automation-controls');
        if (controlsDiv) {
          controlsDiv.style.display = e.target.checked ? 'block' : 'none';
        }
        if (e.target.checked) {
          this.notificationSystem.show('Tempo automation enabled');
        }
        this.scheduleAutoSave();
      });
    }

    // Tempo automation direction dropdown
    const tempoAutoDirectionSelect = document.getElementById('tempo-automation-direction');
    if (tempoAutoDirectionSelect) {
      tempoAutoDirectionSelect.addEventListener('change', (e) => {
        this.timelineMode.tempoAutomationDirection = e.target.value;
        this.updateTempoLimitVisibility();
        this.scheduleAutoSave();
      });
    }

    // Tempo automation BPM change amount
    const tempoAutoBpmInput = document.getElementById('tempo-automation-bpm');
    if (tempoAutoBpmInput) {
      tempoAutoBpmInput.addEventListener('change', (e) => {
        this.timelineMode.tempoAutomationBpmChange = Math.max(1, Math.min(20, parseInt(e.target.value) || 5));
        e.target.value = this.timelineMode.tempoAutomationBpmChange;
        this.scheduleAutoSave();
      });
    }

    // Tempo automation bars interval
    const tempoAutoBarsInput = document.getElementById('tempo-automation-bars');
    if (tempoAutoBarsInput) {
      tempoAutoBarsInput.addEventListener('change', (e) => {
        this.timelineMode.tempoAutomationBars = Math.max(1, Math.min(16, parseInt(e.target.value) || 4));
        e.target.value = this.timelineMode.tempoAutomationBars;
        this.scheduleAutoSave();
      });
    }

    // Tempo automation max BPM
    const tempoAutoMaxInput = document.getElementById('tempo-automation-max');
    if (tempoAutoMaxInput) {
      tempoAutoMaxInput.addEventListener('change', (e) => {
        this.timelineMode.tempoAutomationMaxBpm = Math.max(60, Math.min(300, parseInt(e.target.value) || 200));
        e.target.value = this.timelineMode.tempoAutomationMaxBpm;
        this.scheduleAutoSave();
      });
    }

    // Tempo automation min BPM
    const tempoAutoMinInput = document.getElementById('tempo-automation-min');
    if (tempoAutoMinInput) {
      tempoAutoMinInput.addEventListener('change', (e) => {
        this.timelineMode.tempoAutomationMinBpm = Math.max(20, Math.min(120, parseInt(e.target.value) || 40));
        e.target.value = this.timelineMode.tempoAutomationMinBpm;
        this.scheduleAutoSave();
      });
    }

    // MIDI latency input
    const latencyInput = document.getElementById('midi-latency');
    if (latencyInput) {
      latencyInput.addEventListener('change', (e) => {
        this.timelineMode.midiLatencyMs = Math.max(0, Math.min(200, parseInt(e.target.value)));
        this.scheduleAutoSave();
      });
    }

    // Show grid checkbox
    const showGridCheckbox = document.getElementById('timeline-show-grid');
    if (showGridCheckbox) {
      showGridCheckbox.addEventListener('change', (e) => {
        this.timelineMode.showGrid = e.target.checked;
        this.scheduleAutoSave();
      });
    }

    // Show deviation graph checkbox
    const showDeviationCheckbox = document.getElementById('timeline-show-deviation');
    if (showDeviationCheckbox) {
      showDeviationCheckbox.addEventListener('change', (e) => {
        this.timelineMode.showDeviationGraph = e.target.checked;
        if (e.target.checked) {
          this.notificationSystem.show('Timing deviation graph enabled');
        }
        this.scheduleAutoSave();
      });
    }

    // Deviation graph mode select (cumulative vs actual)
    const deviationGraphModeSelect = document.getElementById('deviation-graph-mode');
    if (deviationGraphModeSelect) {
      deviationGraphModeSelect.addEventListener('change', (e) => {
        this.timelineMode.deviationGraphMode = e.target.value;
        this.scheduleAutoSave();
      });
    }

    // Row spacing slider
    const rowSpacingSlider = document.getElementById('timeline-row-spacing');
    if (rowSpacingSlider) {
      rowSpacingSlider.addEventListener('input', (e) => {
        this.timelineMode.rowSpacing = parseInt(e.target.value);
        this.updateRowSpacingDisplay();
        this.scheduleAutoSave();
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

    // Save Recording Modal buttons
    const saveBtn = document.getElementById('save-recording-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSaveRecording());
    }

    const discardBtn = document.getElementById('save-recording-discard-btn');
    if (discardBtn) {
      discardBtn.addEventListener('click', () => this.handleDiscardRecording());
    }

    const cancelBtn = document.getElementById('save-recording-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.handleCancelSave());
    }

    // Keyboard shortcuts for Save Recording Modal
    this.saveRecordingKeyHandler = (e) => {
      const modal = document.getElementById('save-recording-backdrop');
      if (modal && modal.style.display === 'flex') {
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          this.handleSaveRecording();
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          this.handleDiscardRecording();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.handleCancelSave();
        }
      }
    };
    document.addEventListener('keydown', this.saveRecordingKeyHandler);

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
      const bgColor = window.currentBgColor || '#ffffff';
      if (paintCanvas) {
        // Get current blend mode and temporarily reset to normal for clearing
        const BLEND_MODES = window.BLEND_MODES || [window.BLEND];
        const currentBlendMode = window.currentBlendMode || 0;
        paintCanvas.blendMode(window.BLEND);
        paintCanvas.background(bgColor);
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
   * Handle end button click - show save/discard modal only if video is recording
   */
  handleEnd() {
    // If video recording is active, show modal to save/discard video
    if (this.videoRecorder && this.videoRecorder.isRecording) {
      // Pause the recording (don't stop yet)
      if (this.timelineMode.recording) {
        this.timelineMode.stopRecording();
      }

      // Show the save/discard modal
      const modal = document.getElementById('save-recording-backdrop');
      if (modal) {
        modal.style.display = 'flex';
      }
    } else {
      // No video recording - just end the session directly
      if (this.timelineMode.recording) {
        this.timelineMode.stopRecording();
      }

      this.notificationSystem.show('Recording ended');
      this.updateButtonsUI();
      this.updateStatusText();
    }
  }

  /**
   * Handle save recording from modal
   */
  handleSaveRecording() {
    // Close modal
    const modal = document.getElementById('save-recording-backdrop');
    if (modal) {
      modal.style.display = 'none';
    }

    // Stop recording (keeps the recording)
    this.timelineMode.stopRecording();

    // Stop and save video recording if it's running
    if (this.videoRecorder && this.videoRecorder.isRecording) {
      this.videoRecorder.stopRecording();
      if (window.updateVideoRecordingUI) {
        window.updateVideoRecordingUI(false);
      }
      // Re-enable Quick Settings video button
      this.hideChronicleRecordingInfo();
      this.notificationSystem.show('Timeline saved • Video saved');
    } else {
      this.notificationSystem.show('Timeline saved');
    }

    this.updateButtonsUI();
    this.updateStatusText();
  }

  /**
   * Handle discard recording from modal
   */
  handleDiscardRecording() {
    // Close modal
    const modal = document.getElementById('save-recording-backdrop');
    if (modal) {
      modal.style.display = 'none';
    }

    // Stop video recording if it's running (without saving)
    if (this.videoRecorder && this.videoRecorder.isRecording) {
      this.videoRecorder.stopRecording();
      if (window.updateVideoRecordingUI) {
        window.updateVideoRecordingUI(false);
      }
      // Re-enable Quick Settings video button
      this.hideChronicleRecordingInfo();
    }

    // Clear the timeline by starting over
    this.handleStartOver();

    this.notificationSystem.show('Recording discarded');
  }

  /**
   * Handle cancel from save modal - resume recording
   */
  handleCancelSave() {
    // Close modal
    const modal = document.getElementById('save-recording-backdrop');
    if (modal) {
      modal.style.display = 'none';
    }

    // Resume recording (unpause) - false means don't start over, resume from where we paused
    this.timelineMode.startRecording(false);

    this.updateButtonsUI();
    this.updateStatusText();
    this.notificationSystem.show('Resuming recording');
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
    const bgColor = window.currentBgColor || '#ffffff';
    if (paintCanvas) {
      const BLEND_MODES = window.BLEND_MODES || [window.BLEND];
      const currentBlendMode = window.currentBlendMode || 0;
      paintCanvas.blendMode(window.BLEND);
      paintCanvas.background(bgColor);
      paintCanvas.blendMode(BLEND_MODES[currentBlendMode]);
    }

    // Reset scroll position
    if (window.resetTimelineScroll) {
      window.resetTimelineScroll();
    }

    // Reset timeline state using the proper clear method
    // This ensures all state is reset (hit counters, metronome, etc.)
    this.timelineMode.clear({ currentBgColor: bgColor });

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

    // Sections to show/hide during recording
    const mainPanelSections = document.getElementById('main-panel-sections');
    const settingsSection = document.getElementById('timeline-settings-section');
    const recordingOptions = document.getElementById('timeline-recording-options');

    // Initial state: Show only Start button
    if (state === 'initial') {
      if (startBtn) startBtn.style.display = 'block';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (endBtn) endBtn.style.display = 'none';
      if (startOverBtn) startOverBtn.style.display = 'none';
      if (continueBtn) continueBtn.style.display = 'none';
      // Show all sections
      if (mainPanelSections) mainPanelSections.style.display = 'block';
      if (settingsSection) settingsSection.style.display = 'block';
      if (recordingOptions) recordingOptions.style.display = 'block';
    }
    // Recording state: Show ONLY Playing section with Pause and End buttons
    else if (state === 'recording') {
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'block';
      if (endBtn) endBtn.style.display = 'block';
      if (startOverBtn) startOverBtn.style.display = 'none';
      if (continueBtn) continueBtn.style.display = 'none';
      // Hide everything except the Playing section
      if (mainPanelSections) mainPanelSections.style.display = 'none';
      if (settingsSection) settingsSection.style.display = 'none';
      if (recordingOptions) recordingOptions.style.display = 'none';
    }
    // Stopped state: Show Start Over and Continue buttons
    else if (state === 'stopped') {
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (endBtn) endBtn.style.display = 'none';
      if (startOverBtn) startOverBtn.style.display = 'block';
      if (continueBtn) continueBtn.style.display = 'block';
      // Show all sections
      if (mainPanelSections) mainPanelSections.style.display = 'block';
      if (settingsSection) settingsSection.style.display = 'block';
      if (recordingOptions) recordingOptions.style.display = 'block';
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
   * Update tempo automation section visibility based on metronome state
   */
  updateTempoAutomationVisibility() {
    const tempoAutoSection = document.getElementById('tempo-automation-section');
    const metronomeEnabled = this.timelineMode.metronomeEnabled;

    if (tempoAutoSection) {
      tempoAutoSection.style.display = metronomeEnabled ? 'block' : 'none';
    }
  }

  /**
   * Update visibility of max/min BPM fields based on direction
   */
  updateTempoLimitVisibility() {
    const direction = this.timelineMode.tempoAutomationDirection || 'increase';
    const maxInput = document.getElementById('tempo-automation-max');
    const minInput = document.getElementById('tempo-automation-min');
    const label = document.getElementById('tempo-limit-label');

    if (direction === 'increase') {
      if (maxInput) maxInput.style.display = 'inline-block';
      if (minInput) minInput.style.display = 'none';
      if (label) label.textContent = 'Max BPM:';
    } else {
      if (maxInput) maxInput.style.display = 'none';
      if (minInput) minInput.style.display = 'inline-block';
      if (label) label.textContent = 'Min BPM:';
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

    // Tempo automation elements
    const tempoAutoCheckbox = document.getElementById('tempo-automation-enabled');
    const tempoAutoBpmInput = document.getElementById('tempo-automation-bpm');
    const tempoAutoBarsInput = document.getElementById('tempo-automation-bars');
    const tempoAutoMaxInput = document.getElementById('tempo-automation-max');
    const tempoAutoControls = document.getElementById('tempo-automation-controls');

    // Deviation graph element
    const showDeviationCheckbox = document.getElementById('timeline-show-deviation');

    if (bpmInput) bpmInput.value = this.timelineMode.bpm;
    if (bpmDisplay) bpmDisplay.textContent = this.timelineMode.bpm;
    if (subdivisionSelect) subdivisionSelect.value = this.timelineMode.subdivision;
    if (timeSignatureSelect) timeSignatureSelect.value = this.timelineMode.beatsPerMeasure;
    if (metronomeCheckbox) metronomeCheckbox.checked = this.timelineMode.metronomeEnabled;
    if (latencyInput) latencyInput.value = this.timelineMode.midiLatencyMs;
    if (showGridCheckbox) showGridCheckbox.checked = this.timelineMode.showGrid;
    if (showDeviationCheckbox) showDeviationCheckbox.checked = this.timelineMode.showDeviationGraph;

    // Deviation graph mode select
    const deviationGraphModeSelect = document.getElementById('deviation-graph-mode');
    if (deviationGraphModeSelect) deviationGraphModeSelect.value = this.timelineMode.deviationGraphMode || 'cumulative';

    if (rowSpacingSlider) rowSpacingSlider.value = this.timelineMode.rowSpacing;
    if (rowSpacingDisplay) rowSpacingDisplay.textContent = `${this.timelineMode.rowSpacing}px`;
    if (warmupSelect) warmupSelect.value = this.timelineMode.warmupMeasures;
    if (measuresPerStaffSelect) measuresPerStaffSelect.value = this.timelineMode.measuresPerStaffPreference;

    // Sync tempo automation settings
    if (tempoAutoCheckbox) tempoAutoCheckbox.checked = this.timelineMode.tempoAutomationEnabled;
    if (tempoAutoBpmInput) tempoAutoBpmInput.value = this.timelineMode.tempoAutomationBpmChange;
    if (tempoAutoBarsInput) tempoAutoBarsInput.value = this.timelineMode.tempoAutomationBars;
    if (tempoAutoMaxInput) tempoAutoMaxInput.value = this.timelineMode.tempoAutomationMaxBpm;
    if (tempoAutoControls) tempoAutoControls.style.display = this.timelineMode.tempoAutomationEnabled ? 'block' : 'none';

    // Sync direction dropdown and min BPM
    const tempoAutoDirectionSelect = document.getElementById('tempo-automation-direction');
    const tempoAutoMinInput = document.getElementById('tempo-automation-min');
    if (tempoAutoDirectionSelect) tempoAutoDirectionSelect.value = this.timelineMode.tempoAutomationDirection || 'increase';
    if (tempoAutoMinInput) tempoAutoMinInput.value = this.timelineMode.tempoAutomationMinBpm;

    // Update tempo automation visibility
    this.updateTempoAutomationVisibility();
    this.updateTempoLimitVisibility();

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
