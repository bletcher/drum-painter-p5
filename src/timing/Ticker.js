/**
 * Ticker
 * Fires a callback every ~25ms from a Web Worker timer.
 *
 * Main-thread setTimeout is throttled to 1s (or worse) when the tab is in the
 * background — e.g. while the drummer is looking at their DAW. Worker timers are
 * not throttled that way, so the metronome and MIDI clock schedulers keep their
 * look-ahead window filled. Falls back to setInterval if workers are unavailable.
 */

const WORKER_SOURCE = `
  let timer = null;
  onmessage = (e) => {
    if (e.data.cmd === 'start') {
      clearInterval(timer);
      timer = setInterval(() => postMessage('tick'), e.data.interval);
    } else if (e.data.cmd === 'stop') {
      clearInterval(timer);
      timer = null;
    }
  };
`;

export class Ticker {
  /**
   * @param {Function} onTick - Called on every tick
   * @param {number} intervalMs - Tick interval in milliseconds
   */
  constructor(onTick, intervalMs = 25) {
    this.onTick = onTick;
    this.intervalMs = intervalMs;
    this.running = false;
    this.worker = null;
    this.fallbackTimer = null;

    try {
      const blob = new Blob([WORKER_SOURCE], { type: 'text/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = () => {
        if (this.running) this.onTick();
      };
    } catch (e) {
      this.worker = null; // CSP or old browser — use setInterval instead
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    if (this.worker) {
      this.worker.postMessage({ cmd: 'start', interval: this.intervalMs });
    } else {
      this.fallbackTimer = setInterval(() => this.onTick(), this.intervalMs);
    }
    // Tick immediately so the first look-ahead window is filled without waiting
    this.onTick();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.worker) {
      this.worker.postMessage({ cmd: 'stop' });
    }
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }
}
