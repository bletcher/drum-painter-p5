/**
 * Video Recorder
 * Records canvas content to video file using MediaRecorder API
 */

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

    // Quality presets (in bits per second)
    this.qualityPresets = {
      low: 1000000,      // 1 Mbps
      medium: 2500000,   // 2.5 Mbps
      high: 5000000,     // 5 Mbps
      ultra: 10000000    // 10 Mbps
    };

    // Format presets
    this.formatPresets = {
      'webm-vp9': 'video/webm;codecs=vp9',
      'webm-vp8': 'video/webm;codecs=vp8',
      'webm': 'video/webm'
    };

    this.currentQuality = 'medium';
    this.currentFormat = 'webm-vp9'; // Default to VP9

    // Storage for recorded videos
    this.recordings = [];
    this.maxRecordings = 10; // Keep last 10 recordings
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
    if (this.formatPresets[format]) {
      this.currentFormat = format;
    }
  }

  /**
   * Start recording
   */
  async startRecording() {
    if (this.isRecording) {
      console.warn('Already recording');
      return false;
    }

    try {
      // Get the underlying HTML canvas element
      // p5.Graphics objects use .canvas or .elt property
      const htmlCanvas = this.canvas.canvas || this.canvas.elt || this.canvas;

      if (!htmlCanvas || !htmlCanvas.captureStream) {
        throw new Error('Canvas does not support captureStream');
      }

      console.log('Starting canvas capture...');
      console.log('Canvas element:', htmlCanvas);
      console.log('Canvas size:', htmlCanvas.width, 'x', htmlCanvas.height);

      // Get canvas stream at 60fps
      this.stream = htmlCanvas.captureStream(60);

      if (!this.stream) {
        throw new Error('Failed to capture canvas stream');
      }

      console.log('Stream created:', this.stream);
      console.log('Stream tracks:', this.stream.getTracks().length);

      // Configure MediaRecorder with quality and format settings
      const options = {
        mimeType: this.formatPresets[this.currentFormat],
        videoBitsPerSecond: this.qualityPresets[this.currentQuality]
      };

      // Fallback if selected format not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn(`Format ${this.currentFormat} not supported, trying fallbacks...`);

        // Try VP8 if VP9 was selected
        if (this.currentFormat === 'webm-vp9' && MediaRecorder.isTypeSupported(this.formatPresets['webm-vp8'])) {
          options.mimeType = this.formatPresets['webm-vp8'];
          console.log('Falling back to VP8');
        }
        // Try plain webm
        else if (MediaRecorder.isTypeSupported(this.formatPresets['webm'])) {
          options.mimeType = this.formatPresets['webm'];
          console.log('Falling back to plain WebM');
        }
        else {
          throw new Error('No supported video format found');
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.recordedChunks = [];

      // Collect data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('Data chunk received:', event.data.size, 'bytes');
          this.recordedChunks.push(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, total chunks:', this.recordedChunks.length);
        this.saveRecording();
      };

      // Handle errors
      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        this.notificationSystem.show('Recording error occurred', 'error');
        this.stopRecording();
      };

      // Start recording - request data every 1000ms (1 second)
      this.mediaRecorder.start(1000);
      this.isRecording = true;
      this.startTime = Date.now();
      this.startTimer();

      this.notificationSystem.show('Video recording started', 'success');
      console.log('✓ Video recording started');
      console.log(`  Quality: ${this.currentQuality} (${this.qualityPresets[this.currentQuality] / 1000000} Mbps)`);
      console.log(`  MIME type: ${options.mimeType}`);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.notificationSystem.show('Failed to start recording', 'error');
      return false;
    }
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (!this.isRecording) {
      console.warn('Not currently recording');
      return false;
    }

    try {
      this.isRecording = false;
      this.stopTimer();

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        // Stop the media recorder - this will trigger onstop event
        this.mediaRecorder.stop();
      } else {
        // If already inactive, save immediately
        this.saveRecording();
      }

      console.log('✓ Video recording stopped');
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.notificationSystem.show('Failed to stop recording', 'error');
      return false;
    }
  }

  /**
   * Save recording to file
   */
  saveRecording() {
    console.log('saveRecording called, chunks:', this.recordedChunks.length);

    if (this.recordedChunks.length === 0) {
      console.warn('⚠️ No recorded data to save');
      this.notificationSystem.show('No video data to save', 'warning');
      this.cleanup();
      return;
    }

    try {
      // Create blob from chunks
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      console.log('Blob created, size:', blob.size, 'bytes');

      if (blob.size === 0) {
        console.warn('⚠️ Blob is empty');
        this.notificationSystem.show('Video file is empty', 'warning');
        this.cleanup();
        return;
      }

      const durationSec = Math.floor((Date.now() - this.startTime) / 1000);
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);

      // Store recording
      const recording = {
        id: Date.now(),
        blob: blob,
        timestamp: new Date(),
        duration: durationSec,
        size: sizeMB,
        quality: this.currentQuality
      };

      this.recordings.unshift(recording); // Add to beginning

      // Limit number of stored recordings
      if (this.recordings.length > this.maxRecordings) {
        const removed = this.recordings.pop();
        // Revoke old blob URL if it exists
        if (removed.url) {
          URL.revokeObjectURL(removed.url);
        }
      }

      // Automatically download the video file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `drum-painter-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();

      // Clean up the temporary elements after a short delay
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      this.notificationSystem.show(`Video saved! (${durationSec}s, ${sizeMB}MB)`, 'success');
      console.log('✓ Video recorded and downloaded');
      console.log(`  Duration: ${durationSec}s`);
      console.log(`  Size: ${sizeMB}MB`);
      console.log(`  Chunks: ${this.recordedChunks.length}`);

      // Trigger UI update (will be handled by main.js)
      window.dispatchEvent(new CustomEvent('recording-saved', {
        detail: { recording }
      }));

      // Clean up
      this.cleanup();
    } catch (error) {
      console.error('Failed to save recording:', error);
      this.notificationSystem.show('Failed to save video', 'error');
      this.cleanup();
    }
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
      console.warn('Recording not found:', id);
      return;
    }

    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drum-painter-${recording.id}.webm`;
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
      console.warn('Recording not found:', id);
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

    // Reset state
    this.recordedChunks = [];
    this.startTime = null;
    this.mediaRecorder = null;
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
