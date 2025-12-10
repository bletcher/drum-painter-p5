/**
 * Session Recorder
 * Records MIDI events with timing for external export
 */

import { debugLog, debugWarn, infoLog } from '../utils/debug.js';
import { showUserFriendlyError } from '../utils/errorMessages.js';

export class SessionRecorder {
  constructor(notificationSystem) {
    this.notificationSystem = notificationSystem;
    this.isRecording = false;
    this.sessionData = null;
    this.events = [];
    this.startTime = null;
  }

  /**
   * Start recording a new session
   */
  startRecording() {
    if (this.isRecording) {
      debugWarn('Recording already in progress');
      return;
    }

    this.isRecording = true;
    this.startTime = performance.now();
    this.events = [];
    this.sessionData = {
      version: '1.0',
      startTimestamp: new Date().toISOString(),
      events: this.events
    };

    infoLog('🔴 Session recording started');
    if (this.notificationSystem) {
      this.notificationSystem.show('Recording session...', 'info');
    }
  }

  /**
   * Stop recording the current session
   */
  stopRecording() {
    if (!this.isRecording) {
      debugWarn('No recording in progress');
      return;
    }

    this.isRecording = false;
    const endTime = performance.now();
    const duration = (endTime - this.startTime) / 1000; // Convert to seconds

    if (this.sessionData) {
      this.sessionData.endTimestamp = new Date().toISOString();
      this.sessionData.durationSeconds = duration;
      this.sessionData.totalEvents = this.events.length;
    }

    infoLog(`⏹️ Session recording stopped. Duration: ${duration.toFixed(2)}s, Events: ${this.events.length}`);
    if (this.notificationSystem) {
      this.notificationSystem.show(`Recording stopped: ${this.events.length} events`, 'success');
    }

    return this.sessionData;
  }

  /**
   * Record a MIDI event
   * @param {number} note - MIDI note number
   * @param {number} velocity - MIDI velocity (0-127)
   * @param {string} deviceId - MIDI device ID
   * @param {string} drumId - Drum ID that was triggered
   */
  recordEvent(note, velocity, deviceId, drumId) {
    if (!this.isRecording) return;

    const timestamp = performance.now() - this.startTime; // Time since recording started (ms)

    const event = {
      timestamp,
      note,
      velocity,
      deviceId,
      drumId,
      velocityNormalized: velocity / 127
    };

    this.events.push(event);
    debugLog(`📝 Recorded event: note=${note}, vel=${velocity}, drum=${drumId}, time=${timestamp.toFixed(2)}ms`);
  }

  /**
   * Export session data to JSON file
   */
  exportToFile() {
    if (!this.sessionData || this.events.length === 0) {
      debugWarn('No session data to export');
      if (this.notificationSystem) {
        this.notificationSystem.show('No session data to export', 'error');
      }
      return;
    }

    try {
      const json = JSON.stringify(this.sessionData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `drum-painter-session-${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      infoLog(`💾 Session exported to ${filename}`);
      if (this.notificationSystem) {
        this.notificationSystem.show(`Session exported: ${filename}`, 'success');
      }
    } catch (error) {
      debugWarn('Failed to export session:', error);
      if (this.notificationSystem) {
        showUserFriendlyError(this.notificationSystem, 'FILE_EXPORT_ERROR', error);
      }
    }
  }

  /**
   * Clear the current session data
   */
  clearSession() {
    this.sessionData = null;
    this.events = [];
    this.startTime = null;
    this.isRecording = false;

    infoLog('🗑️ Session data cleared');
    if (this.notificationSystem) {
      this.notificationSystem.show('Session cleared', 'info');
    }
  }

  /**
   * Get session statistics
   */
  getStats() {
    if (!this.sessionData) {
      return {
        hasData: false,
        totalEvents: 0,
        duration: 0
      };
    }

    const eventsByDrum = {};
    this.events.forEach(event => {
      if (!eventsByDrum[event.drumId]) {
        eventsByDrum[event.drumId] = 0;
      }
      eventsByDrum[event.drumId]++;
    });

    const velocities = this.events.map(e => e.velocity);
    const avgVelocity = velocities.length > 0
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length
      : 0;

    return {
      hasData: true,
      totalEvents: this.events.length,
      duration: this.sessionData.durationSeconds || 0,
      eventsByDrum,
      averageVelocity: avgVelocity,
      minVelocity: Math.min(...velocities),
      maxVelocity: Math.max(...velocities),
      startTime: this.sessionData.startTimestamp,
      endTime: this.sessionData.endTimestamp
    };
  }

  /**
   * Get current recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      eventCount: this.events.length,
      duration: this.isRecording && this.startTime
        ? (performance.now() - this.startTime) / 1000
        : 0
    };
  }
}
