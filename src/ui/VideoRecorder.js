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

    this.currentQuality = 'medium';
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

      // Configure MediaRecorder with quality settings
      const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: this.qualityPresets[this.currentQuality]
      };

      // Fallback to vp8 if vp9 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
      }

      // Fallback to default if webm not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
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

      const url = URL.createObjectURL(blob);

      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `drum-painter-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const durationSec = Math.floor((Date.now() - this.startTime) / 1000);
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);

      this.notificationSystem.show(`Video saved! (${durationSec}s, ${sizeMB}MB)`, 'success');
      console.log('✓ Video saved');
      console.log(`  Duration: ${durationSec}s`);
      console.log(`  Size: ${sizeMB}MB`);
      console.log(`  Chunks: ${this.recordedChunks.length}`);

      // Clean up
      this.cleanup();
    } catch (error) {
      console.error('Failed to save recording:', error);
      this.notificationSystem.show('Failed to save video', 'error');
      this.cleanup();
    }
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
