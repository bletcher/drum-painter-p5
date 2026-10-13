/**
 * Click Player
 * Plays metronome clicks at exact times on the Web Audio clock.
 *
 * Times are given as performance.now() milliseconds at which the click should be
 * HEARD. They are converted to AudioContext time using getOutputTimestamp(), which
 * accounts for the audio output latency, so MIDI hit timestamps (also on the
 * performance.now() clock) can be compared directly against click times.
 */

import { debugLog, debugWarn } from '../utils/debug.js';

const CLICK_LENGTH_SEC = 0.015;

export class ClickPlayer {
  constructor() {
    this.audioContext = null;
    this.noiseBuffer = null;
    this.scheduled = []; // { source, when } for clicks not yet played
    this.offsetSec = null; // Smoothed (contextTime - performanceTime) mapping
  }

  /**
   * Create/resume the audio context. Must be called from a user gesture the first time.
   */
  init() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
        this.noiseBuffer = this.createNoiseBuffer();
        debugLog('🎵 Click player audio context created');
      } catch (error) {
        debugWarn('Failed to create audio context:', error);
        return;
      }
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * Pre-render one short decaying noise burst; each click reuses it through a filter
   */
  createNoiseBuffer() {
    const ctx = this.audioContext;
    const length = Math.floor(ctx.sampleRate * CLICK_LENGTH_SEC);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.15));
    }
    return buffer;
  }

  /**
   * Convert a performance.now() time (when the sound should be heard) to AudioContext time
   * @param {number} perfMs
   * @returns {number} - AudioContext seconds
   */
  perfToContextTime(perfMs) {
    const ctx = this.audioContext;
    let offset = null;

    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.performanceTime > 0) {
        offset = ts.contextTime - ts.performanceTime / 1000;
      }
    }
    if (offset === null) {
      // No output timestamp yet — estimate from current time and reported latency
      const latency = ctx.outputLatency || ctx.baseLatency || 0;
      offset = ctx.currentTime - performance.now() / 1000 - latency;
    }

    // Smooth jitter in the reported timestamps; jump if the mapping changes a lot
    // (e.g. audio device switched)
    if (this.offsetSec === null || Math.abs(offset - this.offsetSec) > 0.02) {
      this.offsetSec = offset;
    } else {
      this.offsetSec += (offset - this.offsetSec) * 0.05;
    }

    return perfMs / 1000 + this.offsetSec;
  }

  /**
   * Schedule a click
   * @param {number} perfMs - performance.now() time the click should be heard
   * @param {'downbeat'|'beat'|'sub'} type - Accent level
   */
  scheduleClick(perfMs, type) {
    const ctx = this.audioContext;
    if (!ctx || ctx.state === 'closed') return;

    const when = Math.max(ctx.currentTime, this.perfToContextTime(perfMs));

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5;

    const gain = ctx.createGain();

    if (type === 'downbeat') {
      filter.frequency.value = 2500;
      gain.gain.value = 0.5;
    } else if (type === 'beat') {
      filter.frequency.value = 1800;
      gain.gain.value = 0.35;
    } else {
      filter.frequency.value = 1200;
      gain.gain.value = 0.2;
    }

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(when);

    this.scheduled.push({ source, when });
    if (this.scheduled.length > 64) {
      this.scheduled = this.scheduled.filter(s => s.when > ctx.currentTime);
    }
  }

  /**
   * Cancel clicks that haven't played yet (used on pause/stop)
   */
  cancelPending() {
    const ctx = this.audioContext;
    if (!ctx) return;
    for (const { source, when } of this.scheduled) {
      if (when > ctx.currentTime) {
        try { source.stop(); } catch (e) { /* already stopped */ }
      }
    }
    this.scheduled = [];
  }

  /**
   * Release the audio context
   */
  close() {
    this.cancelPending();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.noiseBuffer = null;
      this.offsetSec = null;
    }
  }

  get isReady() {
    return !!this.audioContext && this.audioContext.state !== 'closed';
  }
}
