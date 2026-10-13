/**
 * Latency Calibrator
 * Plays a short click track and measures how far the drummer's pad hits land
 * from the clicks. The median difference is the delay between hitting a pad and
 * the MIDI message reaching the browser (plus any audio output delay the browser
 * doesn't report), which becomes the timing offset.
 */

import { Modal } from '../ui/Modal.js';
import { ClickPlayer } from '../timing/ClickPlayer.js';
import { median } from '../timing/tempoMath.js';

const BPM = 100;
const COUNT_IN = 4;
const MEASURED_CLICKS = 16;
const MATCH_WINDOW_MS = 200; // Hits further than this from any click are ignored
const MIN_MATCHED = 8;
const MIN_OFFSET = -50;
const MAX_OFFSET = 200;

export class LatencyCalibrator {
  /**
   * @param {Object} deps
   * @param {Function} deps.setHitListener - (fn|null) => void
   * @param {Function} deps.getOffset - () => current offset in ms
   * @param {Function} deps.applyOffset - (ms) => void
   */
  constructor(deps) {
    this.deps = deps;
    this.clickPlayer = new ClickPlayer();
    this.timers = [];
    this.modal = new Modal('Calibrate timing', { onClose: () => this.stop() });
  }

  open() {
    this.renderIntro();
    this.modal.open();
  }

  renderIntro() {
    const body = this.modal.body;
    body.replaceChildren();
    const intro = document.createElement('p');
    intro.textContent = `You'll hear ${COUNT_IN} count-in clicks, then ${MEASURED_CLICKS} more. ` +
      'Hit any pad exactly with each click after the count-in — as tight as you can, like playing to a metronome.';
    const note = document.createElement('p');
    note.textContent = `Current offset: ${this.deps.getOffset()} ms. ` +
      'Use headphones or speakers you normally practice with; Bluetooth headphones add a lot of delay.';
    body.append(intro, note);
    this.modal.setButtons([
      { label: 'Cancel', onClick: () => this.modal.close() },
      { label: 'Start', variant: 'primary', onClick: () => this.start() }
    ]);
  }

  start() {
    this.stop();
    // Start is a click, so the browser lets audio begin here
    this.clickPlayer.init();

    const interval = 60000 / BPM;
    const first = performance.now() + 800;
    this.clickTimes = [];
    for (let i = 0; i < COUNT_IN + MEASURED_CLICKS; i++) {
      this.clickTimes.push(first + i * interval);
    }
    this.hits = [];

    // Visual beat indicator
    const body = this.modal.body;
    body.replaceChildren();
    const beat = document.createElement('div');
    beat.className = 'calibration-beat';
    this.dots = this.clickTimes.map((t, i) => {
      const dot = document.createElement('span');
      dot.className = 'calibration-dot' + (i < COUNT_IN ? ' count-in' : '');
      beat.appendChild(dot);
      return dot;
    });
    const status = document.createElement('div');
    status.className = 'calibration-result';
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Listen… count-in';
    this.status = status;
    body.append(beat, status);
    this.modal.setButtons([{ label: 'Cancel', onClick: () => this.modal.close() }]);

    this.clickTimes.forEach((t, i) => {
      this.clickPlayer.scheduleClick(t, i % 4 === 0 ? 'downbeat' : 'beat');
      this.timers.push(setTimeout(() => {
        this.dots.forEach(d => d.classList.remove('active'));
        this.dots[i].classList.add('active');
        if (i === COUNT_IN) this.status.textContent = 'Play!';
      }, Math.max(0, t - performance.now())));
    });

    this.deps.setHitListener((hit) => {
      this.hits.push(hit.timeStamp);
      return true; // Don't paint during calibration
    });

    const end = this.clickTimes[this.clickTimes.length - 1] + interval;
    this.timers.push(setTimeout(() => this.finish(), end - performance.now()));
  }

  finish() {
    this.deps.setHitListener(null);
    const measured = this.clickTimes.slice(COUNT_IN);
    const deviations = [];
    for (const hit of this.hits) {
      let best = null;
      for (let i = 0; i < measured.length; i++) {
        const d = hit - measured[i];
        if (Math.abs(d) <= MATCH_WINDOW_MS && (best === null || Math.abs(d) < Math.abs(best.d))) {
          best = { d, i };
        }
      }
      if (best) {
        deviations.push(best.d);
        this.dots[COUNT_IN + best.i]?.classList.add('hit');
      }
    }

    if (deviations.length < MIN_MATCHED) {
      this.status.textContent = `Only ${deviations.length} hits lined up with the clicks — try again.`;
      this.modal.setButtons([
        { label: 'Cancel', onClick: () => this.modal.close() },
        { label: 'Try again', variant: 'primary', onClick: () => this.start() }
      ]);
      return;
    }

    const offset = Math.round(Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, median(deviations))));
    const spread = Math.round(median(deviations.map(d => Math.abs(d - offset))));

    this.status.replaceChildren();
    const value = document.createElement('strong');
    value.textContent = `${offset > 0 ? '+' : ''}${offset} ms`;
    const detail = document.createElement('span');
    detail.textContent = `${deviations.length} hits, typically within ±${spread} ms of each other`;
    this.status.append(value, detail);

    this.modal.setButtons([
      { label: 'Try again', onClick: () => this.start() },
      {
        label: 'Use this offset',
        variant: 'primary',
        onClick: () => {
          this.deps.applyOffset(offset);
          this.modal.close();
        }
      }
    ]);
  }

  stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.clickPlayer.cancelPending();
    this.deps.setHitListener(null);
  }
}
