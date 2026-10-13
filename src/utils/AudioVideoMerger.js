/**
 * Audio Video Merger
 * Uses FFmpeg.wasm to merge audio and video files in the browser
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { debugLog, debugError, infoLog } from './debug.js';
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
   * @param {number} audioOffsetMs - Audio offset in milliseconds.
   *   Positive = delay audio (audio starts this many ms into the video).
   *   Negative = trim audio start (skip this many ms off the beginning of the audio file).
   * @param {number} trimStartSec - Start time for video trim (0 = no trim)
   * @param {number} trimDurationSec - Duration to keep (0 = full video)
   * @returns {Promise<Blob>} Merged video blob
   */
  async merge(videoBlob, audioFile, onProgress = null, audioOffsetMs = 0, trimStartSec = 0, trimDurationSec = 0) {
    // Ensure FFmpeg is loaded
    if (!this.isLoaded) {
      const loaded = await this.load();
      if (!loaded) {
        throw new Error('Failed to load FFmpeg');
      }
    }

    // Collect FFmpeg log lines so we can surface a real error message on failure
    const ffmpegLogs = [];
    const logHandler = ({ message }) => {
      ffmpegLogs.push(message);
      debugLog('[ffmpeg]', message);
    };
    this.ffmpeg.on('log', logHandler);

    const progressHandler = onProgress
      ? ({ progress }) => onProgress(Math.round(progress * 100))
      : null;
    if (progressHandler) this.ffmpeg.on('progress', progressHandler);

    try {
      this.notificationSystem.show('Merging audio and video...', 'info');
      debugLog('Starting merge...');
      debugLog('  Video size:', (videoBlob.size / 1024 / 1024).toFixed(2), 'MB');
      debugLog('  Audio size:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');

      // Recordings are MP4/H.264 where the browser supports it, otherwise WebM.
      // VP8 can't go in an MP4 container without re-encoding, so VP8 recordings
      // are merged into WebM with Opus audio instead.
      const videoType = videoBlob.type || 'video/webm';
      const inputName = videoType.includes('mp4') ? 'input_video.mp4' : 'input_video.webm';
      const webmOutput = videoType.includes('vp8');
      const outputName = webmOutput ? 'output.webm' : 'output.mp4';
      const audioArgs = webmOutput ? ['-c:a', 'libopus', '-b:a', '160k'] : ['-c:a', 'aac', '-b:a', '192k'];

      // Write input files to FFmpeg virtual filesystem
      await this.ffmpeg.writeFile(inputName, await fetchFile(videoBlob));
      await this.ffmpeg.writeFile('input_audio', await fetchFile(audioFile));

      // Build FFmpeg command
      // -c:v copy = copy video without re-encoding (fast)
      // -c:a aac = encode audio as AAC
      // -shortest = trim to shortest input
      const offsetSec = audioOffsetMs / 1000;
      const hasTrim = trimStartSec > 0 || trimDurationSec > 0;
      const ffmpegArgs = [];

      // Video input — optional seek to trim start
      if (hasTrim && trimStartSec > 0) {
        ffmpegArgs.push('-ss', trimStartSec.toFixed(3));
      }
      ffmpegArgs.push('-i', inputName);

      // Audio input — optional offset
      if (audioOffsetMs > 0) {
        ffmpegArgs.push('-itsoffset', offsetSec.toFixed(3));
      } else if (audioOffsetMs < 0) {
        ffmpegArgs.push('-ss', (-offsetSec).toFixed(3));
      }
      ffmpegArgs.push('-i', 'input_audio');

      // Output options
      ffmpegArgs.push('-c:v', 'copy', ...audioArgs);

      // Trim duration
      if (hasTrim && trimDurationSec > 0) {
        ffmpegArgs.push('-t', trimDurationSec.toFixed(3));
      }

      ffmpegArgs.push('-shortest', outputName);

      debugLog(`Audio offset: ${audioOffsetMs}ms`);
      if (hasTrim) debugLog(`  Trim: start=${trimStartSec.toFixed(1)}s, duration=${trimDurationSec.toFixed(1)}s`);
      const exitCode = await this.ffmpeg.exec(ffmpegArgs);

      // exec() resolves even on failure — a non-zero exit code means FFmpeg errored
      if (exitCode !== 0) {
        // Pull the last few relevant log lines for the error message
        const errorLines = ffmpegLogs
          .filter(l => /error|invalid|failed|not found|unsupported/i.test(l))
          .slice(-5)
          .join(' | ');
        throw new Error(
          `FFmpeg exited with code ${exitCode}${errorLines ? `: ${errorLines}` : ''}`
        );
      }

      // Read output file — use Uint8Array directly (not .buffer) to avoid
      // including extra padding bytes from a shared ArrayBuffer
      const data = await this.ffmpeg.readFile(outputName);
      const mergedBlob = new Blob([data], { type: webmOutput ? 'video/webm' : 'video/mp4' });

      if (mergedBlob.size === 0) {
        throw new Error('FFmpeg produced an empty output file');
      }

      // Clean up FFmpeg filesystem
      try {
        await this.ffmpeg.deleteFile(inputName);
        await this.ffmpeg.deleteFile('input_audio');
        await this.ffmpeg.deleteFile(outputName);
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
    } finally {
      this.ffmpeg.off('log', logHandler);
      if (progressHandler) this.ffmpeg.off('progress', progressHandler);
    }
  }

  /**
   * Check if FFmpeg is loaded
   */
  isReady() {
    return this.isLoaded;
  }
}
