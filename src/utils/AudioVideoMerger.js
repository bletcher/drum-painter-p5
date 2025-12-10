/**
 * Audio Video Merger
 * Uses FFmpeg.wasm to merge audio and video files in the browser
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { debugLog, debugWarn, debugError, infoLog } from './debug.js';
import { showUserFriendlyError } from './errorMessages.js';

export class AudioVideoMerger {
  constructor(notificationSystem) {
    this.notificationSystem = notificationSystem;
    this.ffmpeg = null;
    this.isLoaded = false;
    this.isLoading = false;
  }

  /**
   * Load FFmpeg.wasm (lazy loading)
   */
  async load() {
    if (this.isLoaded) return true;
    if (this.isLoading) {
      // Wait for existing load to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.isLoaded;
    }

    try {
      this.isLoading = true;
      this.notificationSystem.show('Loading FFmpeg... (one-time setup)', 'info');

      this.ffmpeg = new FFmpeg();

      // Load from CDN
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      this.isLoading = false;
      this.notificationSystem.show('FFmpeg ready!', 'success');
      infoLog('✓ FFmpeg.wasm loaded');
      return true;
    } catch (error) {
      this.isLoading = false;
      debugError('Failed to load FFmpeg:', error);
      showUserFriendlyError(this.notificationSystem, 'VIDEO_MERGE_ERROR', error);
      return false;
    }
  }

  /**
   * Merge video and audio files
   * @param {Blob} videoBlob - Video file blob
   * @param {File} audioFile - Audio file from user upload
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Promise<Blob>} Merged video blob
   */
  async merge(videoBlob, audioFile, onProgress = null) {
    // Ensure FFmpeg is loaded
    if (!this.isLoaded) {
      const loaded = await this.load();
      if (!loaded) {
        throw new Error('Failed to load FFmpeg');
      }
    }

    try {
      // Setup progress logging
      if (onProgress) {
        this.ffmpeg.on('progress', ({ progress }) => {
          onProgress(Math.round(progress * 100));
        });
      }

      this.notificationSystem.show('Merging audio and video...', 'info');
      debugLog('Starting merge...');
      debugLog('  Video size:', (videoBlob.size / 1024 / 1024).toFixed(2), 'MB');
      debugLog('  Audio size:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');

      // Write input files to FFmpeg virtual filesystem
      await this.ffmpeg.writeFile('input_video.webm', await fetchFile(videoBlob));
      await this.ffmpeg.writeFile('input_audio', await fetchFile(audioFile));

      // Run FFmpeg command
      // -c:v copy = copy video without re-encoding (fast)
      // -c:a aac = encode audio as AAC
      // -shortest = trim to shortest input
      await this.ffmpeg.exec([
        '-i', 'input_video.webm',
        '-i', 'input_audio',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        'output.mp4'
      ]);

      // Read output file
      const data = await this.ffmpeg.readFile('output.mp4');
      const mergedBlob = new Blob([data.buffer], { type: 'video/mp4' });

      // Clean up FFmpeg filesystem
      try {
        await this.ffmpeg.deleteFile('input_video.webm');
        await this.ffmpeg.deleteFile('input_audio');
        await this.ffmpeg.deleteFile('output.mp4');
      } catch (e) {
        // Ignore cleanup errors
      }

      infoLog('✓ Merge complete');
      debugLog('  Output size:', (mergedBlob.size / 1024 / 1024).toFixed(2), 'MB');

      this.notificationSystem.show('Audio merged successfully!', 'success');
      return mergedBlob;
    } catch (error) {
      debugError('Merge failed:', error);
      showUserFriendlyError(this.notificationSystem, 'VIDEO_MERGE_ERROR', error);
      throw error;
    }
  }

  /**
   * Check if FFmpeg is loaded
   */
  isReady() {
    return this.isLoaded;
  }
}
