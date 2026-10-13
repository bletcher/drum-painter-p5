/**
 * Session Recording UI
 * Record / Stop / Export / Clear buttons for the MIDI session recorder.
 */

import { debugWarn } from '../utils/debug.js';

let sessionRecorder;

/**
 * @param {SessionRecorder} recorder
 */
export function initSessionUI(recorder) {
  sessionRecorder = recorder;
  setupSessionRecordingUI();
}

/**
 * Setup Session Recording UI
 */
function setupSessionRecordingUI() {
  const recordBtn = document.getElementById('session-record-btn');
  const stopBtn = document.getElementById('session-stop-btn');
  const exportBtn = document.getElementById('session-export-btn');
  const clearBtn = document.getElementById('session-clear-btn');
  const statusEl = document.getElementById('session-status');

  if (!recordBtn || !stopBtn || !exportBtn || !clearBtn || !statusEl) {
    debugWarn('Session recording UI elements not found');
    return;
  }

  // Update UI based on recording status
  function updateUI() {
    const status = sessionRecorder.getStatus();
    const stats = sessionRecorder.getStats();

    if (status.isRecording) {
      // Recording in progress
      recordBtn.disabled = true;
      recordBtn.style.cursor = 'not-allowed';
      recordBtn.style.background = '#f0f0f0';

      stopBtn.disabled = false;
      stopBtn.style.cursor = 'pointer';
      stopBtn.style.background = 'white';
      stopBtn.style.fontWeight = 'bold';

      exportBtn.disabled = true;
      clearBtn.disabled = true;

      statusEl.textContent = `Recording... ${status.eventCount} events (${status.duration.toFixed(1)}s)`;
      statusEl.style.color = '#c00';
      statusEl.style.fontWeight = 'bold';
    } else if (stats.hasData) {
      // Has recorded data
      recordBtn.disabled = false;
      recordBtn.style.cursor = 'pointer';
      recordBtn.style.background = 'white';
      recordBtn.style.fontWeight = 'bold';

      stopBtn.disabled = true;
      stopBtn.style.cursor = 'not-allowed';
      stopBtn.style.background = '#f0f0f0';

      exportBtn.disabled = false;
      exportBtn.style.cursor = 'pointer';
      exportBtn.style.background = 'white';

      clearBtn.disabled = false;
      clearBtn.style.cursor = 'pointer';
      clearBtn.style.background = 'white';

      statusEl.textContent = `${stats.totalEvents} events recorded (${stats.duration.toFixed(1)}s)`;
      statusEl.style.color = '#060';
      statusEl.style.fontWeight = 'normal';
    } else {
      // Ready to record
      recordBtn.disabled = false;
      recordBtn.style.cursor = 'pointer';
      recordBtn.style.background = 'white';
      recordBtn.style.fontWeight = 'bold';

      stopBtn.disabled = true;
      stopBtn.style.cursor = 'not-allowed';
      stopBtn.style.background = '#f0f0f0';

      exportBtn.disabled = true;
      exportBtn.style.cursor = 'not-allowed';
      exportBtn.style.background = '#f0f0f0';

      clearBtn.disabled = true;
      clearBtn.style.cursor = 'not-allowed';
      clearBtn.style.background = '#f0f0f0';

      statusEl.textContent = 'Ready to record';
      statusEl.style.color = '#666';
      statusEl.style.fontWeight = 'normal';
    }
  }

  // Refresh the event count while recording only
  let refreshTimer = null;

  // Record button
  recordBtn.addEventListener('click', () => {
    sessionRecorder.startRecording();
    updateUI();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(updateUI, 250);
  });

  // Stop button
  stopBtn.addEventListener('click', () => {
    sessionRecorder.stopRecording();
    clearInterval(refreshTimer);
    refreshTimer = null;
    updateUI();
  });

  // Export button
  exportBtn.addEventListener('click', () => {
    sessionRecorder.exportToFile();
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear session data? This cannot be undone.')) {
      sessionRecorder.clearSession();
      updateUI();
    }
  });

  // Initial UI update
  updateUI();
}
