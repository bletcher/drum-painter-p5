/**
 * Demo Groove
 * Plays a simple rock beat with fills through the normal hit pipeline, so people
 * without a kit (or a browser without Web MIDI) can see what the app does.
 * When the timeline is running, the groove locks to its grid.
 */

import { Ticker } from '../timing/Ticker.js';

const STEPS_PER_BAR = 16; // 16th notes in 4/4
const LOOKAHEAD_MS = 150;

// Patterns per 16th step: velocity (0-1) or 0 for rest
const BEAT = {
  kick:  [1, 0, 0, 0, 0, 0, 0, 0.6, 0.9, 0, 0.7, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.35],
  hat:   [0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0]
};
const FILL = {
  kick:  [1, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0.7, 0.6, 0.8, 0.7, 0, 0, 0, 0],
  tomHigh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.8, 0, 0],
  tomLow: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.9],
  hat:   [0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};

// Which kit drum plays each part (first match wins)
const ROLE_MATCHERS = {
  kick: [/^kick$/, /kick|bass/i],
  snare: [/^snare$/, /snare(?!.*rim)/i],
  hat: [/^hihat_closed$/, /hi.?hat|hh/i, /^ride$/, /ride/i],
  crash: [/^crash$/, /crash|cymbal/i],
  tomHigh: [/^tom_high$/, /high tom|tom.?1|rack/i, /tom/i],
  tomLow: [/^floor_tom$/, /floor/i, /tom/i]
};

export class DemoGroove {
  /**
   * @param {Object} deps
   * @param {Function} deps.getDrums - () => [{ id, name, midiNote }]
   * @param {Function} deps.onHit - ({ note, velocity, deviceId, drumId, timeStamp }) => void
   * @param {Function} deps.getTimeline - () => TimelineMode instance or null
   * @param {Function} deps.getBpm - () => tempo to use when the timeline isn't running
   */
  constructor(deps) {
    this.deps = deps;
    this.playing = false;
    this.ticker = new Ticker(() => this.schedule(), 25);
    this.pending = [];
  }

  toggle() {
    if (this.playing) {
      this.stop();
    } else {
      this.start();
    }
    return this.playing;
  }

  start() {
    this.roles = this.assignRoles(this.deps.getDrums());
    this.playing = true;
    this.step = null;
    this.freeStart = performance.now() + 100;
    this.ticker.start();
  }

  stop() {
    this.playing = false;
    this.ticker.stop();
    this.pending.forEach(clearTimeout);
    this.pending = [];
  }

  assignRoles(drums) {
    const roles = {};
    for (const [role, matchers] of Object.entries(ROLE_MATCHERS)) {
      for (const re of matchers) {
        const drum = drums.find(d => re.test(d.id) || re.test(d.name));
        if (drum) {
          roles[role] = drum;
          break;
        }
      }
    }
    // Small or unusual kits: fall back to whatever drums exist
    const fallback = drums.filter(d => d.midiNote !== null && d.midiNote !== undefined);
    ['kick', 'snare', 'hat'].forEach((role, i) => {
      if (!roles[role] && fallback.length) roles[role] = fallback[i % fallback.length];
    });
    return roles;
  }

  /**
   * performance.now() time of a 16th-note step
   */
  stepTime(step) {
    const timeline = this.deps.getTimeline();
    if (timeline && timeline.recording && timeline.startTime) {
      return timeline.getPerfTimeOfBeat(step / 4);
    }
    const bpm = this.deps.getBpm() || 100;
    return this.freeStart + step * (60000 / bpm / 4);
  }

  schedule() {
    if (!this.playing) return;
    const now = performance.now();
    const timeline = this.deps.getTimeline();
    const locked = timeline && timeline.recording && timeline.startTime;

    if (this.step === null || this.locked !== !!locked) {
      // (Re)align to the next step of whichever clock we're following
      this.locked = !!locked;
      if (locked) {
        const beatsNow = timeline.getBeatCountForTime(Math.max(0, timeline.getEffectiveTimeAt(now)));
        this.step = Math.ceil(beatsNow * 4);
      } else {
        this.freeStart = now + 100;
        this.step = 0;
      }
    }

    for (let guard = 0; guard < 64; guard++) {
      const t = this.stepTime(this.step);
      if (t > now + LOOKAHEAD_MS) break;
      if (t >= now - 20) this.playStep(this.step, t);
      this.step++;
    }
  }

  playStep(step, time) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const pos = step % STEPS_PER_BAR;
    const isFillBar = bar % 4 === 3;
    const pattern = isFillBar ? FILL : BEAT;

    const parts = Object.entries(pattern).map(([role, steps]) => [role, steps[pos]]);
    if (pos === 0 && bar % 4 === 0) parts.push(['crash', 1]);

    for (const [role, velocity] of parts) {
      const drum = this.roles[role];
      if (!velocity || !drum) continue;
      // A little human feel: ±4ms and some velocity variation
      const hitTime = time + (Math.random() - 0.5) * 8;
      const vel = Math.max(0.1, Math.min(1, velocity * (0.85 + Math.random() * 0.2)));
      const delay = Math.max(0, hitTime - performance.now());
      const timer = setTimeout(() => {
        this.pending = this.pending.filter(t => t !== timer);
        if (!this.playing) return;
        this.deps.onHit({ note: drum.midiNote, velocity: vel, deviceId: 'demo', drumId: drum.id, timeStamp: hitTime });
      }, delay);
      this.pending.push(timer);
    }
  }
}
