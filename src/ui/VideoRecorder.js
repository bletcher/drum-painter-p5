/**
 * Video Recorder
 * Records canvas content to video file using MediaRecorder API
 */

import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';
import { showUserFriendlyError } from '../utils/errorMessages.js';

export class VideoRecorder {
  constructor(canvas, notificationSystem) {
    this.canvas = canvas;
    this.notificationSystem = notificationSystem;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.stream = null;
    this.startTime = null;
    this.timerInterval = null;

    // Quality presets: bits per second for a 1080p recording (scaled for other sizes)
    this.qualityPresets = {
      low: 3000000,      // 3 Mbps
      medium: 6000000,   // 6 Mbps
      high: 10000000,    // 10 Mbps
      ultra: 16000000    // 16 Mbps
    };

    // Format presets. 'auto' prefers MP4/H.264: hardware-encoded on most machines
    // and it plays everywhere (phones, social media), unlike WebM.
    this.formatPresets = {
      'auto': null,
      'mp4': 'video/mp4;codecs=avc1.42E01F',
      'webm-vp9': 'video/webm;codecs=vp9',
      'webm-vp8': 'video/webm;codecs=vp8',
      'webm': 'video/webm'
    };
    this.autoFormatOrder = ['video/mp4;codecs=avc1.42E01F', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

    this.currentQuality = 'medium';
    this.currentFormat = 'auto';

    // Recordings are scaled down to at most this size and frame rate; full-res
    // 60fps capture of a high-DPI screen costs a lot of CPU while playing
    this.maxCaptureWidth = 1920;
    this.maxCaptureHeight = 1080;
    this.frameRate = 30;

    // Storage for recorded videos
    this.recordings = [];
    this.maxRecordings = 10; // Keep last 10 recordings

    // Callbacks fired when recording state changes (used e.g. to send MIDI out)
    this.onRecordingStart = null;
    this.onRecordingStop = null;

    // Holds the completed recording blob until user chooses Save or Discard
    this.pendingRecording = null;

    // Set to true when user discards so async ondataavailable/onstop don't reshow modal
    this.cancelled = false;

    // When true, saveRecording() calls confirmSave() automatically (used by timeline Save flow)
    this.autoConfirmNext = false;

    // Optional callback returning {sx,sy,sw,sh,includeOverlay} in device pixels — the
    // region of the source canvas to capture. When set, a relay canvas is used.
    this.getCaptureRect = null;
    this.captureRect = null;
    this.relayCanvas = null;

    // Optional overlay canvas composited on top of each relay frame when
    // captureRect.includeOverlay is true (used for staff mode to include the
    // metronome + deviation graph that are drawn on the overlay, not the main canvas).
    this.relayOverlay = null;
  }

  /**
   * Set video quality
   */
  setQuality(quality) {
    if (this.qualityPresets[quality]) {
      this.currentQuality = quality;
    }
  }

  /**
   * Set video format
   */
  setFormat(format) {
    if (format in this.formatPresets) {
      this.currentFormat = format;
    }
  }

  /**
   * Pick a MIME type the browser can record, honoring the chosen format if possible
   * @returns {string|null}
   */
  chooseMimeType() {
    const preferred = this.formatPresets[this.currentFormat];
    if (preferred && MediaRecorder.isTypeSupported(preferred)) {
      return preferred;
    }
    if (preferred) {
      debugWarn(`Format ${this.currentFormat} not supported, falling back`);
    }
    return this.autoFormatOrder.find(type => MediaRecorder.isTypeSupported(type)) || null;
  }

  /**
   * File extension for a recording's MIME type
   */
  static extensionFor(mimeType) {
    return (mimeType || '').includes('mp4') ? 'mp4' : 'webm';
  }

  /**
   * Start recording
   */
  async startRecording() {
    if (this.isRecording) {
      debugWarn('Already recording');
      return false;
    }

    this.cancelled = false;

    try {
      // Get the underlying HTML canvas element
      // p5.Graphics objects use .canvas or .elt property
      const htmlCanvas = this.canvas.canvas || this.canvas.elt || this.canvas;

      if (!htmlCanvas || !htmlCanvas.captureStream) {
        throw new Error('Canvas does not support captureStream');
      }

      debugLog('Starting canvas capture...');
      debugLog('Canvas element:', htmlCanvas);
      debugLog('Canvas size:', htmlCanvas.width, 'x', htmlCanvas.height);

      // The bottom panel (metronome + deviation graph) is rendered on a separate
      // overlay canvas in main.js, so it never appears in the video.
      // getCaptureRect crops and/or centers the recording region. For circular
      // layouts a square crop is returned; for staff just the bottom is trimmed.
      // Always record through a relay canvas so the output size is capped
      // (and optionally cropped) independent of the screen's pixel density
      const captureRect = (this.getCaptureRect && this.getCaptureRect()) ||
        { sx: 0, sy: 0, sw: htmlCanvas.width, sh: htmlCanvas.height, includeOverlay: false };
      const fit = Math.min(1, this.maxCaptureWidth / captureRect.sw, this.maxCaptureHeight / captureRect.sh);
      const outWidth = Math.max(2, Math.round(captureRect.sw * fit / 2) * 2); // encoders need even sizes
      const outHeight = Math.max(2, Math.round(captureRect.sh * fit / 2) * 2);

      this.captureRect = captureRect;
      this.relayCanvas = document.createElement('canvas');
      this.relayCanvas.width = outWidth;
      this.relayCanvas.height = outHeight;
      this.stream = this.relayCanvas.captureStream(this.frameRate);
      debugLog('Recording', outWidth, 'x', outHeight, 'from source region', captureRect);

      if (!this.stream) {
        throw new Error('Failed to capture canvas stream');
      }

      const mimeType = this.chooseMimeType();
      if (!mimeType) {
        throw new Error('No supported video format found');
      }

      // Scale bitrate with resolution relative to 1080p
      const pixelScale = (outWidth * outHeight) / (1920 * 1080);
      const options = {
        mimeType,
        videoBitsPerSecond: Math.round(this.qualityPresets[this.currentQuality] * Math.max(0.35, Math.min(1.5, pixelScale)))
      };
      this.currentMimeType = mimeType;

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.recordedChunks = [];

      // Collect data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (this.cancelled) return;
        if (event.data && event.data.size > 0) {
          debugLog('Data chunk received:', event.data.size, 'bytes');
          this.recordedChunks.push(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        debugLog('MediaRecorder stopped, total chunks:', this.recordedChunks.length);
        this.saveRecording();
      };

      // Handle errors
      this.mediaRecorder.onerror = (error) => {
        debugError('MediaRecorder error:', error);
        showUserFriendlyError(this.notificationSystem, 'VIDEO_START_ERROR', error);
        this.stopRecording();
      };

      // Start recording - request data every 1000ms (1 second)
      this.mediaRecorder.start(1000);
      this.isRecording = true;
      this.startTime = Date.now();
      this.startTimer();

      // Suppress notifications during recording to avoid visual distraction
      this.notificationSystem.muted = true;
      infoLog('✓ Video recording started');
      debugLog(`  Quality: ${this.currentQuality} (${(options.videoBitsPerSecond / 1000000).toFixed(1)} Mbps)`);
      debugLog(`  MIME type: ${options.mimeType}`);

      if (this.onRecordingStart) this.onRecordingStart();

      return true;
    } catch (error) {
      debugError('Failed to start recording:', error);
      showUserFriendlyError(this.notificationSystem, 'VIDEO_START_ERROR', error);
      return false;
    }
  }

  /**
   * Stop recording
   */
  stopRecording(showSaveModal = true) {
    if (!this.isRecording) {
      debugWarn('Not currently recording');
      return false;
    }

    try {
      this.isRecording = false;
      this.stopTimer();

      // Show the modal immediately so the user's next click lands on the
      // Save/Discard buttons rather than falling through to the canvas.
      // The Save button is disabled until onstop fires and the blob is ready.
      // showSaveModal=false when called from the timeline flow (modal already managed there).
      if (showSaveModal) {
        const backdrop = document.getElementById('save-recording-backdrop');
        const saveBtn = document.getElementById('save-recording-save-btn');
        if (backdrop) {
          backdrop.dataset.context = 'video';
          backdrop.style.display = 'flex';
        }
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.style.opacity = '0.5';
          saveBtn.style.cursor = 'not-allowed';
        }
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        // Stop the media recorder - this will trigger onstop event
        this.mediaRecorder.stop();
      } else {
        // If already inactive, save immediately
        this.saveRecording();
      }

      if (this.onRecordingStop) this.onRecordingStop();

      debugLog('✓ Video recording stopped');
      return true;
    } catch (error) {
      debugError('Failed to stop recording:', error);
      showUserFriendlyError(this.notificationSystem, 'VIDEO_SAVE_ERROR', error);
      return false;
    }
  }

  /**
   * Save recording to file
   */
  saveRecording() {
    if (this.cancelled) {
      debugLog('saveRecording: cancelled, skipping');
      this.cleanup();
      return;
    }
    debugLog('saveRecording called, chunks:', this.recordedChunks.length);

    if (this.recordedChunks.length === 0) {
      debugWarn('⚠️ No recorded data to save');
      this.notificationSystem.muted = false;
      this.notificationSystem.show('No video data to save', 'warning');
      this.cleanup();
      return;
    }

    try {
      // Create blob from chunks
      const blob = new Blob(this.recordedChunks, { type: this.currentMimeType || 'video/webm' });
      debugLog('Blob created, size:', blob.size, 'bytes');

      if (blob.size === 0) {
        debugWarn('⚠️ Blob is empty');
        this.notificationSystem.muted = false;
        this.notificationSystem.show('Video file is empty', 'warning');
        this.cleanup();
        return;
      }

      const durationSec = Math.floor((Date.now() - this.startTime) / 1000);
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);

      const recording = {
        id: Date.now(),
        blob: blob,
        timestamp: new Date(),
        duration: durationSec,
        size: sizeMB,
        quality: this.currentQuality
      };

      infoLog('✓ Video recorded — awaiting user save/discard decision');
      debugLog(`  Duration: ${durationSec}s`);
      debugLog(`  Size: ${sizeMB}MB`);
      debugLog(`  Chunks: ${this.recordedChunks.length}`);

      // Store pending recording and re-enable the Save button now that data is ready.
      // (The modal was already shown by stopRecording().)
      this.pendingRecording = recording;

      // autoConfirmNext: timeline Save flow — skip modal, download immediately
      if (this.autoConfirmNext) {
        this.autoConfirmNext = false;
        this.confirmSave();
        return;
      }

      const saveBtn = document.getElementById('save-recording-save-btn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '';
        saveBtn.style.cursor = '';
      }
      // Fallback: if modal wasn't shown yet (e.g. inactive branch), show it now
      const backdrop = document.getElementById('save-recording-backdrop');
      if (backdrop && backdrop.style.display !== 'flex') {
        backdrop.dataset.context = 'video';
        backdrop.style.display = 'flex';
      }
    } catch (error) {
      debugError('Failed to save recording:', error);
      this.notificationSystem.muted = false;
      showUserFriendlyError(this.notificationSystem, 'VIDEO_SAVE_ERROR', error);
      this.cleanup();
    }
  }

  /**
   * Confirm save of the pending recording: add to list and download
   */
  confirmSave() {
    const recording = this.pendingRecording;
    if (!recording) {
      debugWarn('No pending recording to save');
      return;
    }

    this.recordings.unshift(recording);

    if (this.recordings.length > this.maxRecordings) {
      const removed = this.recordings.pop();
      if (removed.url) URL.revokeObjectURL(removed.url);
    }

    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `drum-painter-${new Date().toISOString().replace(/[:.]/g, '-')}.${VideoRecorder.extensionFor(recording.blob.type)}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    this.notificationSystem.muted = false;
    this.notificationSystem.show(`Video saved! (${recording.duration}s, ${recording.size}MB)`, 'success');
    infoLog('✓ Video downloaded');

    window.dispatchEvent(new CustomEvent('recording-saved', { detail: { recording } }));
    this.cleanup();
  }

  /**
   * Discard the pending recording without saving or adding to the list
   */
  discardRecording() {
    this.cancelled = true; // Prevent async ondataavailable/onstop from reshowing modal
    // Always hide the modal and clean up, even if called redundantly
    const backdrop = document.getElementById('save-recording-backdrop');
    if (backdrop) backdrop.style.display = 'none';
    this.notificationSystem.muted = false;
    if (this.pendingRecording) {
      this.notificationSystem.show('Recording discarded', 'info');
      infoLog('Recording discarded by user');
    }
    this.cleanup();
  }

  /**
   * Get all recordings
   */
  getRecordings() {
    return this.recordings;
  }

  /**
   * Download a specific recording
   */
  downloadRecording(id) {
    const recording = this.recordings.find(r => r.id === id);
    if (!recording) {
      debugWarn('Recording not found:', id);
      return;
    }

    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drum-painter-${recording.id}.${VideoRecorder.extensionFor(recording.blob.type)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    this.notificationSystem.show('Video downloaded!', 'success');
  }

  /**
   * Delete a specific recording
   */
  deleteRecording(id) {
    const index = this.recordings.findIndex(r => r.id === id);
    if (index === -1) {
      debugWarn('Recording not found:', id);
      return;
    }

    const recording = this.recordings[index];
    if (recording.url) {
      URL.revokeObjectURL(recording.url);
    }

    this.recordings.splice(index, 1);

    // Trigger UI update
    window.dispatchEvent(new CustomEvent('recording-deleted', {
      detail: { id }
    }));

    this.notificationSystem.show('Recording deleted', 'info');
  }

  /**
   * Clear all recordings
   */
  clearAllRecordings() {
    this.recordings.forEach(recording => {
      if (recording.url) {
        URL.revokeObjectURL(recording.url);
      }
    });
    this.recordings = [];

    window.dispatchEvent(new CustomEvent('recordings-cleared'));
    this.notificationSystem.show('All recordings cleared', 'info');
  }

  /**
   * Clean up recording resources
   */
  cleanup() {
    // Stop all tracks in the stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.relayCanvas = null;
    this.captureRect = null;
    this.pendingRecording = null;

    // Ensure notifications are unblocked
    this.notificationSystem.muted = false;

    // Restore Save button in case it's still in the disabled/loading state
    const saveBtn = document.getElementById('save-recording-save-btn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.style.opacity = '';
      saveBtn.style.cursor = '';
    }

    // Reset state
    this.recordedChunks = [];
    this.startTime = null;
    this.mediaRecorder = null;
  }

  /**
   * Copy the top portion of sourceCanvas into the relay canvas.
   * Called each frame from the draw loop when cropping is active.
   */
  relayFrame(sourceCanvas) {
    if (!this.relayCanvas || !sourceCanvas || !this.captureRect) return;
    if (!this.relayCtx || this.relayCtx.canvas !== this.relayCanvas) {
      this.relayCtx = this.relayCanvas.getContext('2d');
    }
    const ctx = this.relayCtx;
    const { sx, sy, sw, sh, includeOverlay } = this.captureRect;
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, this.relayCanvas.width, this.relayCanvas.height);
    // For layouts that include the bottom panel (e.g. staff), composite the overlay
    // on top so the metronome and deviation graph appear in the recording.
    if (includeOverlay && this.relayOverlay) {
      ctx.drawImage(this.relayOverlay, sx, sy, sw, sh, 0, 0, this.relayCanvas.width, this.relayCanvas.height);
    }
  }

  /**
   * Start timer display
   */
  startTimer() {
    this.updateTimer();
    this.timerInterval = setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  /**
   * Stop timer display
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Update timer display
   */
  updateTimer() {
    if (!this.isRecording || !this.startTime) return;

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const timeDisplay = document.getElementById('video-recording-time');
    if (timeDisplay) {
      timeDisplay.textContent = timeString;
    }
  }

  /**
   * Check if recording is supported
   */
  static isSupported() {
    return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
  }

  /**
   * Get recording state
   */
  getState() {
    return {
      isRecording: this.isRecording,
      quality: this.currentQuality,
      duration: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
    };
  }
}
