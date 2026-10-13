/**
 * Session Recorder
 * Records MIDI events with timing for external export
 */

import { debugWarn, infoLog } from '../utils/debug.js';
import { showUserFriendlyError } from '../utils/errorMessages.js';

export class SessionRecorder {
  constructor(notificationSystem) {
    this.notificationSystem = notificationSystem;
    this.isRecording = false;
    this.sessionData = null;
    this.events = [];
    this.startTime = null;
    this.resetTotals();
  }

  resetTotals() {
    this.velocitySum = 0;
    this.minVelocity = Infinity;
    this.maxVelocity = -Infinity;
    this.eventsByDrum = {};
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
    this.resetTotals();
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
   * @param {number} velocityNormalized - Velocity scaled to 0-1
   * @param {string} deviceId - MIDI device ID
   * @param {string} drumId - Drum ID that was triggered
   * @param {number} hitTime - performance.now() time of the hit (MIDI timestamp)
   */
  recordEvent(note, velocityNormalized, deviceId, drumId, hitTime = performance.now()) {
    if (!this.isRecording) return;

    const velocity = Math.round(velocityNormalized * 127);
    this.events.push({
      timestamp: hitTime - this.startTime, // Time since recording started (ms)
      note,
      velocity,
      deviceId,
      drumId,
      velocityNormalized
    });

    this.velocitySum += velocity;
    this.minVelocity = Math.min(this.minVelocity, velocity);
    this.maxVelocity = Math.max(this.maxVelocity, velocity);
    this.eventsByDrum[drumId] = (this.eventsByDrum[drumId] || 0) + 1;
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
    this.resetTotals();

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

    // Running totals, so this stays cheap however long the session is
    const count = this.events.length;
    return {
      hasData: true,
      totalEvents: count,
      duration: this.sessionData.durationSeconds || 0,
      eventsByDrum: { ...this.eventsByDrum },
      averageVelocity: count > 0 ? this.velocitySum / count : 0,
      minVelocity: count > 0 ? this.minVelocity : 0,
      maxVelocity: count > 0 ? this.maxVelocity : 0,
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
