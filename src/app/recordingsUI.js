/**
 * Recordings UI
 * Video record button, the Recent Recordings list and the Sync & Merge
 * (audio + video) preview modal.
 */

import { VideoRecorder } from '../ui/VideoRecorder.js';
import { URL_REVOKE_DELAY } from '../config/constants.js';
import { debugError, debugWarn } from '../utils/debug.js';
import { showUserFriendlyError } from '../utils/errorMessages.js';

let videoRecorder;
let audioVideoMerger;
let notificationSystem;
let stateManager;

// Sync preview modal state
const syncPreview = {
  recordingId: null,
  videoUrl: null,
  audioFile: null,
  audioUrl: null,
  offsetMs: 0,
  isPlaying: false,
  syncInterval: null,
  trimStartSec: 0,
  trimEndSec: 0, // 0 = use full duration (set when video loads)
};

/**
 * Wire up all recording-related UI
 * @param {Object} deps - { videoRecorder, audioVideoMerger, notificationSystem, stateManager }
 */
export function initRecordingsUI(deps) {
  ({ videoRecorder, audioVideoMerger, notificationSystem, stateManager } = deps);
  setupVideoRecorderUI();
  setupRecordingsUI();
  setupSyncPreview();
  // TimelineControls starts/stops recordings too and updates the button through this
  window.updateVideoRecordingUI = updateVideoRecordingUI;
}

/**
 * Start or stop a video recording and update the button
 */
export function toggleVideoRecording() {
  if (!videoRecorder.isRecording) {
    videoRecorder.startRecording().then(success => {
      if (success) updateVideoRecordingUI(true);
    });
  } else {
    videoRecorder.stopRecording();
    updateVideoRecordingUI(false);
  }
}

/**
 * Setup Video Recorder UI
 */
function setupVideoRecorderUI() {
  const recordBtn = document.getElementById('video-record-btn');
  const recordText = document.getElementById('video-record-text');
  const qualitySelect = document.getElementById('video-quality');

  // Check if recording is supported
  if (!VideoRecorder.isSupported()) {
    if (recordBtn) {
      recordBtn.disabled = true;
      recordBtn.style.opacity = '0.5';
      recordBtn.style.cursor = 'not-allowed';
      recordText.textContent = 'Not Supported';
    }
    debugWarn('⚠️ Video recording not supported in this browser');
    return;
  }

  // Quality selector
  if (qualitySelect) {
    qualitySelect.addEventListener('change', (e) => {
      videoRecorder.setQuality(e.target.value);
      stateManager.scheduleAutoSave();
    });
  }

  // Record button
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      if (!videoRecorder.isRecording) {
        // Start recording
        videoRecorder.startRecording().then(success => {
          if (success) {
            updateVideoRecordingUI(true);
          }
        });
      } else {
        // Stop recording
        videoRecorder.stopRecording();
        updateVideoRecordingUI(false);
      }
    });
  }

}

export function updateVideoRecordingUI(isRecording) {
  const recordBtn = document.getElementById('video-record-btn');
  const recordIcon = document.getElementById('video-record-icon');
  const recordText = document.getElementById('video-record-text');
  const recordingStatus = document.getElementById('video-recording-status');

  if (isRecording) {
    // Recording state
    if (recordBtn) {
      recordBtn.style.background = '#7f1d1d';
    }
    if (recordIcon) {
      recordIcon.textContent = '■';
    }
    if (recordText) {
      recordText.textContent = 'Stop Recording';
    }
    if (recordingStatus) {
      recordingStatus.style.display = 'block';
    }
  } else {
    // Stopped state
    if (recordBtn) {
      recordBtn.style.background = '#dc2626';
    }
    if (recordIcon) {
      recordIcon.textContent = '●';
    }
    if (recordText) {
      recordText.textContent = 'Start Recording';
    }
    if (recordingStatus) {
      recordingStatus.style.display = 'none';
    }
  }
}

/**
 * Setup Recordings UI and event listeners
 */
function setupRecordingsUI() {
  // Clicking the dark backdrop outside the modal card = discard (video context only)
  const backdrop = document.getElementById('save-recording-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target === backdrop && backdrop.dataset.context === 'video') {
        backdrop.style.display = 'none';
        videoRecorder.discardRecording();
      }
    });
  }

  // Save button — add to list and download (video context only)
  const saveBtn = document.getElementById('save-recording-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const backdrop = document.getElementById('save-recording-backdrop');
      if (!backdrop || backdrop.dataset.context !== 'video') return;
      backdrop.style.display = 'none';
      videoRecorder.confirmSave();
    });
  }

  // Discard button — drop the recording (video context only)
  const discardBtn = document.getElementById('save-recording-discard-btn');
  if (discardBtn) {
    discardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const backdrop = document.getElementById('save-recording-backdrop');
      if (!backdrop || backdrop.dataset.context !== 'video') return;
      backdrop.style.display = 'none';
      videoRecorder.discardRecording();
    });
  }

  // Cancel button — same as discard (video context only)
  const cancelBtn = document.getElementById('save-recording-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const backdrop = document.getElementById('save-recording-backdrop');
      if (!backdrop || backdrop.dataset.context !== 'video') return;
      backdrop.style.display = 'none';
      videoRecorder.discardRecording();
    });
  }

  // Keyboard shortcuts for the modal (S = save, D = discard, Esc = cancel) — video context only
  window.addEventListener('keydown', (e) => {
    const backdrop = document.getElementById('save-recording-backdrop');
    if (!backdrop || backdrop.style.display === 'none') return;
    if (backdrop.dataset.context !== 'video') return;
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      backdrop.style.display = 'none';
      videoRecorder.confirmSave();
    } else if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      backdrop.style.display = 'none';
      videoRecorder.discardRecording();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      backdrop.style.display = 'none';
      videoRecorder.discardRecording();
    }
  });

  // Event listeners for recording events
  window.addEventListener('recording-saved', () => {
    updateRecordingsList();
  });

  window.addEventListener('recording-deleted', () => {
    updateRecordingsList();
  });

  window.addEventListener('recordings-cleared', () => {
    updateRecordingsList();
  });

  // Clear all recordings button
  const clearAllBtn = document.getElementById('clear-recordings-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all recordings?')) {
        videoRecorder.clearAllRecordings();
      }
    });
  }

  // Initial update
  updateRecordingsList();
}

/**
 * Update the recordings list UI
 */
function updateRecordingsList() {
  const recordingsList = document.getElementById('recordings-list');
  if (!recordingsList) return;

  const recordings = videoRecorder.getRecordings();

  if (recordings.length === 0) {
    recordingsList.innerHTML = `
      <div style="font-size: 10px; color: #999; text-align: center; padding: 20px;">
        No recordings yet
      </div>
    `;
    return;
  }

  recordingsList.innerHTML = recordings.map((recording, index) => `
    <div class="recording-item" data-recording-id="${recording.id}" style="
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      padding: 10px;
      margin-bottom: ${index < recordings.length - 1 ? '8px' : '0'};
      border: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <div style="flex: 1;">
          <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">
            Recording #${recordings.length - index}
          </div>
          <div style="font-size: 10px; opacity: 0.7; display: flex; flex-direction: column; gap: 2px;">
            <div>${recording.timestamp.toLocaleTimeString()}</div>
            <div>${recording.duration}s • ${recording.size}MB • ${recording.quality}</div>
          </div>
        </div>
        <button class="delete-recording-btn" data-recording-id="${recording.id}"
          style="padding: 4px 8px; font-size: 10px; background: #dc2626; color: white; border: none; border-radius: 3px; cursor: pointer; opacity: 0.8;"
          title="Delete recording">
          Delete
        </button>
      </div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button class="download-recording-btn" data-recording-id="${recording.id}"
          style="padding: 6px 10px; font-size: 10px; background: #059669; color: white; border: none; border-radius: 3px; cursor: pointer; flex: 1; min-width: 80px;">
          Download Video
        </button>
        <button class="sync-merge-btn" data-recording-id="${recording.id}"
          style="padding: 6px 10px; font-size: 10px; background: #7c3aed; color: white; border: none; border-radius: 3px; cursor: pointer; flex: 1; min-width: 80px;">
          Sync &amp; Merge
        </button>
      </div>
      <div id="merge-progress-${recording.id}" style="display: none; margin-top: 8px;">
        <div style="font-size: 10px; margin-bottom: 4px; color: #3b82f6;">
          <span id="merge-status-${recording.id}">Merging...</span>
          <span id="merge-percent-${recording.id}"></span>
        </div>
        <div style="background: rgba(255, 255, 255, 0.1); height: 4px; border-radius: 2px; overflow: hidden;">
          <div id="merge-progress-bar-${recording.id}" style="background: #3b82f6; height: 100%; width: 0%; transition: width 0.3s;"></div>
        </div>
      </div>
    </div>
  `).join('');

  // Attach event listeners to buttons
  recordingsList.querySelectorAll('.download-recording-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.recordingId);
      videoRecorder.downloadRecording(id);
    });
  });

  recordingsList.querySelectorAll('.delete-recording-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.recordingId);
      if (confirm('Delete this recording?')) {
        videoRecorder.deleteRecording(id);
      }
    });
  });

  // Sync & Merge button — opens sync preview modal
  recordingsList.querySelectorAll('.sync-merge-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.recordingId);
      openSyncPreview(id);
    });
  });
}

// ===== SYNC PREVIEW MODAL =====

/**
 * Open the sync preview modal for a given recording
 */
function openSyncPreview(recordingId) {
  const recording = videoRecorder.getRecordings().find(r => r.id === recordingId);
  if (!recording) return;

  // Store recording id and create video object URL
  syncPreview.recordingId = recordingId;
  syncPreview.videoUrl = URL.createObjectURL(recording.blob);
  syncPreview.audioFile = null;
  syncPreview.audioUrl = null;
  syncPreview.offsetMs = 0;
  syncPreview.isPlaying = false;
  if (syncPreview.syncInterval) {
    clearInterval(syncPreview.syncInterval);
    syncPreview.syncInterval = null;
  }

  // Reset trim
  syncPreview.trimStartSec = 0;
  syncPreview.trimEndSec = 0;
  const trimSection = document.getElementById('sync-preview-trim-section');
  if (trimSection) trimSection.style.display = 'none';

  // Set up video element
  const video = document.getElementById('sync-preview-video');
  video.src = syncPreview.videoUrl;
  video.currentTime = 0;

  // When video metadata loads, configure trim sliders
  video.addEventListener('loadedmetadata', () => {
    const dur = video.duration;
    if (!isFinite(dur) || dur <= 0) return;
    syncPreview.trimStartSec = 0;
    syncPreview.trimEndSec = dur;

    const startSlider = document.getElementById('sync-preview-trim-start');
    const endSlider = document.getElementById('sync-preview-trim-end');
    if (startSlider) { startSlider.max = dur; startSlider.value = 0; }
    if (endSlider) { endSlider.max = dur; endSlider.value = dur; }
    updateTrimDisplay();
    if (trimSection) trimSection.style.display = 'block';
  }, { once: true });

  // Reset audio element
  const audio = document.getElementById('sync-preview-audio');
  audio.src = '';

  // Reset UI
  document.getElementById('sync-preview-audio-name').textContent = 'No audio file loaded';
  document.getElementById('sync-preview-offset').value = 0;
  document.getElementById('sync-preview-offset-display').textContent = '0.0s';
  document.getElementById('sync-preview-play-btn').textContent = '▶ Play';
  document.getElementById('sync-preview-merge-btn').disabled = true;
  document.getElementById('sync-preview-merge-btn').style.opacity = '0.5';
  document.getElementById('sync-preview-merge-progress').style.display = 'none';
  document.getElementById('sync-preview-merge-bar').style.width = '0%';
  document.getElementById('sync-preview-merge-status').textContent = 'Merging...';
  document.getElementById('sync-preview-merge-status').style.color = '#89b4fa';
  document.getElementById('sync-preview-merge-percent').textContent = '';
  const dlBtn = document.getElementById('sync-preview-download-btn');
  if (dlBtn) dlBtn.style.display = 'none';

  // Show modal
  const backdrop = document.getElementById('sync-preview-backdrop');
  backdrop.style.display = 'flex';
}

/**
 * Close the sync preview modal and clean up resources
 */
function closeSyncPreview() {
  const video = document.getElementById('sync-preview-video');
  const audio = document.getElementById('sync-preview-audio');

  // Pause playback
  video.pause();
  audio.pause();

  // Clear sync interval
  if (syncPreview.syncInterval) {
    clearInterval(syncPreview.syncInterval);
    syncPreview.syncInterval = null;
  }

  // Revoke object URLs
  if (syncPreview.videoUrl) {
    URL.revokeObjectURL(syncPreview.videoUrl);
    syncPreview.videoUrl = null;
  }
  if (syncPreview.audioUrl) {
    URL.revokeObjectURL(syncPreview.audioUrl);
    syncPreview.audioUrl = null;
  }

  // Clear src to release resources
  video.src = '';
  audio.src = '';

  // Reset state
  syncPreview.recordingId = null;
  syncPreview.audioFile = null;
  syncPreview.offsetMs = 0;
  syncPreview.isPlaying = false;

  // Hide modal
  document.getElementById('sync-preview-backdrop').style.display = 'none';
}

/**
 * Format seconds as M:SS.S
 */
function formatTrimTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

/**
 * Update trim slider displays and duration text
 */
function updateTrimDisplay() {
  const startDisplay = document.getElementById('sync-preview-trim-start-display');
  const endDisplay = document.getElementById('sync-preview-trim-end-display');
  const durationDisplay = document.getElementById('sync-preview-trim-duration');
  if (startDisplay) startDisplay.textContent = formatTrimTime(syncPreview.trimStartSec);
  if (endDisplay) endDisplay.textContent = formatTrimTime(syncPreview.trimEndSec);
  if (durationDisplay) {
    const dur = syncPreview.trimEndSec - syncPreview.trimStartSec;
    durationDisplay.textContent = `Trimmed duration: ${formatTrimTime(dur)}`;
  }
}

/**
 * Apply current offset to audio position (while playing or paused)
 */
function applySyncOffset() {
  const video = document.getElementById('sync-preview-video');
  const audio = document.getElementById('sync-preview-audio');
  if (!audio.src || !audio.duration) return;

  const offsetSec = syncPreview.offsetMs / 1000;
  const desiredAudioTime = video.currentTime - offsetSec;

  if (desiredAudioTime < 0) {
    // Audio hasn't started yet in the timeline
    audio.pause();
    audio.currentTime = 0;
  } else if (desiredAudioTime <= audio.duration) {
    audio.currentTime = desiredAudioTime;
    if (syncPreview.isPlaying) audio.play().catch(() => {});
  }
}

/**
 * Drift correction — called every 100ms while playing
 */
function driftCorrect() {
  const video = document.getElementById('sync-preview-video');
  const audio = document.getElementById('sync-preview-audio');
  if (video.paused) return;

  // Stop playback when we reach the trim end point
  if (syncPreview.trimEndSec > 0 && video.currentTime >= syncPreview.trimEndSec) {
    video.pause();
    audio.pause();
    syncPreview.isPlaying = false;
    clearInterval(syncPreview.syncInterval);
    syncPreview.syncInterval = null;
    document.getElementById('sync-preview-play-btn').textContent = '▶ Play';
    return;
  }

  if (!audio.src || !audio.duration) return;

  const offsetSec = syncPreview.offsetMs / 1000;
  const desiredAudioTime = video.currentTime - offsetSec;

  if (desiredAudioTime < 0) {
    // Audio not started yet — keep it paused at 0
    if (!audio.paused) audio.pause();
    return;
  }

  // Audio should be playing — start it if paused
  if (audio.paused && syncPreview.isPlaying) {
    audio.currentTime = desiredAudioTime;
    audio.play().catch(() => {});
    return;
  }

  // Correct drift if more than 150ms
  const drift = Math.abs(audio.currentTime - desiredAudioTime);
  if (drift > 0.15) {
    audio.currentTime = desiredAudioTime;
  }
}

/**
 * Set up sync preview modal event listeners (called once on app init)
 */
function setupSyncPreview() {
  // Close button & Cancel button
  document.getElementById('sync-preview-close-btn').addEventListener('click', closeSyncPreview);
  document.getElementById('sync-preview-cancel-btn').addEventListener('click', closeSyncPreview);

  // Close on backdrop click (outside modal)
  document.getElementById('sync-preview-backdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('sync-preview-backdrop')) {
      closeSyncPreview();
    }
  });

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('sync-preview-backdrop').style.display === 'flex') {
      closeSyncPreview();
    }
  });

  // Audio file input
  document.getElementById('sync-preview-audio-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    syncPreview.audioFile = file;

    // Revoke old audio URL if any
    if (syncPreview.audioUrl) {
      URL.revokeObjectURL(syncPreview.audioUrl);
    }
    syncPreview.audioUrl = URL.createObjectURL(file);

    const audio = document.getElementById('sync-preview-audio');
    audio.src = syncPreview.audioUrl;

    // Show filename + size
    const audioMB = file.size / 1024 / 1024;
    document.getElementById('sync-preview-audio-name').textContent =
      `${file.name} (${audioMB.toFixed(1)} MB)`;

    // Size warning — FFmpeg.wasm holds both inputs + output in browser memory (~3× input)
    const recording = videoRecorder.getRecordings().find(r => r.id === syncPreview.recordingId);
    const videoMB = recording ? recording.blob.size / 1024 / 1024 : 0;
    const totalMB = audioMB + videoMB;
    const isWav = file.name.toLowerCase().endsWith('.wav') || file.type === 'audio/wav' ||
                  file.type === 'audio/x-wav';
    const sizeWarning = document.getElementById('sync-preview-size-warning');
    if (sizeWarning) {
      if (totalMB > 300) {
        sizeWarning.textContent =
          `⚠️ ${totalMB.toFixed(0)} MB total — merge will likely fail. Convert audio to MP3 first to reduce file size.`;
        sizeWarning.style.display = 'block';
      } else if (totalMB > 150 || (isWav && audioMB > 50)) {
        sizeWarning.textContent =
          `⚠️ ${totalMB.toFixed(0)} MB total — merge may be slow or fail.${isWav ? ' WAV files are large; try MP3.' : ''}`;
        sizeWarning.style.display = 'block';
      } else {
        sizeWarning.style.display = 'none';
      }
    }

    // Enable merge button
    document.getElementById('sync-preview-merge-btn').disabled = false;
    document.getElementById('sync-preview-merge-btn').style.opacity = '1';

    // Pre-seek to correct position for current offset
    audio.addEventListener('loadedmetadata', () => {
      applySyncOffset();
    }, { once: true });

    // Reset file input so same file can be reloaded
    e.target.value = '';
  });

  // Trim start slider
  const trimStartSlider = document.getElementById('sync-preview-trim-start');
  trimStartSlider.addEventListener('input', () => {
    const val = parseFloat(trimStartSlider.value);
    // Constrain: start must be before end (leave at least 0.5s)
    syncPreview.trimStartSec = Math.min(val, syncPreview.trimEndSec - 0.5);
    trimStartSlider.value = syncPreview.trimStartSec;
    updateTrimDisplay();
    // Seek video to show the start frame
    const video = document.getElementById('sync-preview-video');
    if (video && !syncPreview.isPlaying) video.currentTime = syncPreview.trimStartSec;
  });

  // Trim end slider
  const trimEndSlider = document.getElementById('sync-preview-trim-end');
  trimEndSlider.addEventListener('input', () => {
    const val = parseFloat(trimEndSlider.value);
    // Constrain: end must be after start (leave at least 0.5s)
    syncPreview.trimEndSec = Math.max(val, syncPreview.trimStartSec + 0.5);
    trimEndSlider.value = syncPreview.trimEndSec;
    updateTrimDisplay();
    // Seek video to show the end frame
    const video = document.getElementById('sync-preview-video');
    if (video && !syncPreview.isPlaying) video.currentTime = syncPreview.trimEndSec;
  });

  // Offset slider
  const offsetSlider = document.getElementById('sync-preview-offset');
  const offsetDisplay = document.getElementById('sync-preview-offset-display');
  offsetSlider.addEventListener('input', () => {
    syncPreview.offsetMs = parseInt(offsetSlider.value);
    const sec = (syncPreview.offsetMs / 1000).toFixed(1);
    offsetDisplay.textContent = syncPreview.offsetMs > 0 ? `+${sec}s` : `${sec}s`;
    applySyncOffset();
  });

  // Play / Pause button
  const playBtn = document.getElementById('sync-preview-play-btn');
  playBtn.addEventListener('click', () => {
    const video = document.getElementById('sync-preview-video');
    const audio = document.getElementById('sync-preview-audio');

    if (!syncPreview.isPlaying) {
      // Start from trim start if at beginning or outside trim range
      if (video.currentTime < syncPreview.trimStartSec || video.currentTime >= syncPreview.trimEndSec) {
        video.currentTime = syncPreview.trimStartSec;
      }

      // Apply offset and start both
      syncPreview.isPlaying = true;
      applySyncOffset();
      video.play().catch(() => {});

      // Start drift correction loop (also checks trim end)
      syncPreview.syncInterval = setInterval(driftCorrect, 100);
      playBtn.textContent = '⏸ Pause';
    } else {
      // Pause both
      syncPreview.isPlaying = false;
      video.pause();
      audio.pause();
      clearInterval(syncPreview.syncInterval);
      syncPreview.syncInterval = null;
      playBtn.textContent = '▶ Play';
    }
  });

  // Reset button
  document.getElementById('sync-preview-reset-btn').addEventListener('click', () => {
    const video = document.getElementById('sync-preview-video');
    const audio = document.getElementById('sync-preview-audio');

    syncPreview.isPlaying = false;
    clearInterval(syncPreview.syncInterval);
    syncPreview.syncInterval = null;

    video.pause();
    audio.pause();
    video.currentTime = syncPreview.trimStartSec || 0;

    // Seek audio to correct starting position relative to trim start
    if (audio.src && audio.duration) {
      const offsetSec = syncPreview.offsetMs / 1000;
      const audioTime = (syncPreview.trimStartSec || 0) - offsetSec;
      audio.currentTime = Math.max(0, audioTime);
    }

    document.getElementById('sync-preview-play-btn').textContent = '▶ Play';
  });

  // Video ended — stop sync
  document.getElementById('sync-preview-video').addEventListener('ended', () => {
    const audio = document.getElementById('sync-preview-audio');
    syncPreview.isPlaying = false;
    audio.pause();
    clearInterval(syncPreview.syncInterval);
    syncPreview.syncInterval = null;
    document.getElementById('sync-preview-play-btn').textContent = '▶ Play';
  });

  // Merge button
  document.getElementById('sync-preview-merge-btn').addEventListener('click', async () => {
    if (!syncPreview.audioFile || syncPreview.recordingId === null) return;

    const recording = videoRecorder.getRecordings().find(r => r.id === syncPreview.recordingId);
    if (!recording) return;

    // Pause playback during merge
    const video = document.getElementById('sync-preview-video');
    const audio = document.getElementById('sync-preview-audio');
    video.pause();
    audio.pause();
    syncPreview.isPlaying = false;
    clearInterval(syncPreview.syncInterval);
    syncPreview.syncInterval = null;
    document.getElementById('sync-preview-play-btn').textContent = '▶ Play';

    // Show progress UI
    const mergeProgress = document.getElementById('sync-preview-merge-progress');
    const mergeStatus = document.getElementById('sync-preview-merge-status');
    const mergePercent = document.getElementById('sync-preview-merge-percent');
    const mergeBar = document.getElementById('sync-preview-merge-bar');
    mergeProgress.style.display = 'block';
    mergeStatus.textContent = 'Merging...';
    mergeStatus.style.color = '#89b4fa';
    mergeStatus.style.whiteSpace = '';
    mergePercent.textContent = '';
    mergeBar.style.width = '0%';
    const dlBtnReset = document.getElementById('sync-preview-download-btn');
    if (dlBtnReset) dlBtnReset.style.display = 'none';

    const mergeBtn = document.getElementById('sync-preview-merge-btn');
    mergeBtn.disabled = true;
    mergeBtn.style.opacity = '0.5';

    try {
      // Calculate trim bounds — pass 0/0 to skip trimming
      const video = document.getElementById('sync-preview-video');
      const videoDuration = video.duration || 0;
      const trimStart = syncPreview.trimStartSec || 0;
      const trimEnd = syncPreview.trimEndSec || videoDuration;
      // Only pass trim if the user actually changed the bounds from full video
      const hasTrim = trimStart > 0.1 || (trimEnd > 0 && trimEnd < videoDuration - 0.1);

      const mergedBlob = await audioVideoMerger.merge(
        recording.blob,
        syncPreview.audioFile,
        (progress) => {
          mergePercent.textContent = ` ${progress}%`;
          mergeBar.style.width = `${progress}%`;
        },
        syncPreview.offsetMs,
        hasTrim ? trimStart : 0,
        hasTrim ? trimEnd - trimStart : 0
      );

      mergeStatus.textContent = 'Complete! Click below to save.';
      mergeStatus.style.color = '#a6e3a1';
      mergePercent.textContent = '';
      mergeBar.style.width = '100%';

      // Show an explicit download button — programmatic a.click() inside async/setTimeout
      // is blocked by modern browsers as it's not tied to a direct user gesture.
      const downloadBtn = document.getElementById('sync-preview-download-btn');
      if (downloadBtn) {
        downloadBtn.style.display = 'block';
        const filename = `drum-painter-merged-${recording.id}.${mergedBlob.type.includes('webm') ? 'webm' : 'mp4'}`;
        // Replace any previous listener by cloning the button
        const freshBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(freshBtn, downloadBtn);
        freshBtn.addEventListener('click', () => {
          const url = URL.createObjectURL(mergedBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_DELAY);
          closeSyncPreview();
        });
      }
    } catch (error) {
      debugError('Sync preview merge failed:', error);

      // Show the error message in the progress area so it's visible without a timer
      const shortMsg = error?.message ? error.message.slice(0, 120) : 'Unknown error';
      mergeStatus.textContent = `Merge failed: ${shortMsg}`;
      mergeStatus.style.color = '#f38ba8';
      mergeStatus.style.whiteSpace = 'normal';
      mergePercent.textContent = '';
      mergeBar.style.width = '0%';

      showUserFriendlyError(notificationSystem, 'VIDEO_MERGE_ERROR', error);

      // Re-enable the button immediately so the user can retry; keep the error text visible
      mergeBtn.disabled = false;
      mergeBtn.style.opacity = '1';
    }
  });
}
