/**
 * Kit Setup Wizard
 * Walks through the kit one drum at a time: "Hit your Snare" → the next pad hit
 * is mapped to that drum and the wizard moves on.
 */

import { Modal } from '../ui/Modal.js';

// Ignore hits this soon after a pad was learned (stick bounce, crosstalk)
const SETTLE_MS = 350;

export class KitSetupWizard {
  /**
   * @param {Object} deps
   * @param {Function} deps.getDrums - () => [{ id, name, color, midiNote }] in kit order
   * @param {Function} deps.assign - (drumId, note, deviceId) => void
   * @param {Function} deps.setHitListener - (fn|null) => void; fn receives raw hits and returns true to consume
   * @param {Function} deps.onFinish - Called when the wizard closes after any change
   * @param {Function} deps.describeDevice - (deviceId) => device name
   */
  constructor(deps) {
    this.deps = deps;
    this.index = 0;
    this.changed = false;
    this.lastLearnAt = 0;

    this.modal = new Modal('Kit Setup', { onClose: () => this.handleClose() });
    this.render = this.render.bind(this);
  }

  open() {
    this.drums = this.deps.getDrums();
    if (this.drums.length === 0) return;
    this.index = 0;
    this.changed = false;
    this.deps.setHitListener((hit) => this.handleHit(hit));
    this.render();
    this.modal.open();
  }

  get isOpen() {
    return this.modal.isOpen;
  }

  handleClose() {
    this.deps.setHitListener(null);
    if (this.changed) this.deps.onFinish();
  }

  /**
   * A pad was hit while the wizard is open
   * @returns {boolean} true — the wizard consumes every hit
   */
  handleHit({ note, deviceId, timeStamp }) {
    if (timeStamp - this.lastLearnAt < SETTLE_MS) return true;
    if (this.index >= this.drums.length) return true;

    const drum = this.drums[this.index];
    this.deps.assign(drum.id, note, deviceId);
    drum.midiNote = note;
    this.changed = true;
    this.lastLearnAt = timeStamp;
    this.lastDevice = this.deps.describeDevice(deviceId);

    // Show the result briefly, then move on
    this.render(true);
    setTimeout(() => {
      if (!this.isOpen) return;
      this.index = Math.min(this.index + 1, this.drums.length);
      this.render();
    }, 300);
    return true;
  }

  render(justLearned = false) {
    const body = this.modal.body;
    body.replaceChildren();

    const step = document.createElement('div');
    step.className = 'kit-step' + (justLearned ? ' kit-step-learned' : '');

    if (this.index >= this.drums.length) {
      const done = document.createElement('div');
      done.className = 'kit-step-drum';
      done.textContent = 'All set!';
      const hint = document.createElement('p');
      hint.textContent = 'Click any drum below to re-learn it, or close and start playing.';
      step.append(done, hint);
    } else {
      const drum = this.drums[this.index];

      const progress = document.createElement('div');
      progress.className = 'kit-step-progress';
      progress.textContent = `Drum ${this.index + 1} of ${this.drums.length}`;

      const prompt = document.createElement('div');
      prompt.className = 'kit-step-prompt';
      prompt.textContent = 'Hit your';

      const name = document.createElement('div');
      name.className = 'kit-step-drum';
      const swatch = document.createElement('span');
      swatch.className = 'kit-swatch';
      swatch.style.background = drum.color;
      const label = document.createElement('span');
      label.textContent = drum.name;
      name.append(swatch, label);

      const current = document.createElement('div');
      current.className = 'kit-step-current';
      current.setAttribute('aria-live', 'polite');
      current.textContent = justLearned
        ? `✓ Note ${drum.midiNote}${this.lastDevice ? ` from ${this.lastDevice}` : ''}`
        : (drum.midiNote !== null && drum.midiNote !== undefined ? `Currently note ${drum.midiNote}` : 'Not mapped yet');

      step.append(progress, prompt, name, current);
    }
    body.appendChild(step);

    // Overview: click any drum to jump to it
    const summary = document.createElement('div');
    summary.className = 'kit-summary';
    this.drums.forEach((drum, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'kit-summary-item';
      if (i === this.index) item.setAttribute('aria-current', 'step');
      const swatch = document.createElement('span');
      swatch.className = 'kit-swatch';
      swatch.style.background = drum.color;
      const name = document.createElement('span');
      name.textContent = drum.name;
      const note = document.createElement('span');
      note.className = 'kit-summary-note';
      note.textContent = drum.midiNote ?? '—';
      item.append(swatch, name, note);
      item.addEventListener('click', () => {
        this.index = i;
        this.render();
      });
      summary.appendChild(item);
    });
    body.appendChild(summary);

    const atEnd = this.index >= this.drums.length;
    this.modal.setButtons([
      ...(!atEnd ? [{ label: 'Skip', onClick: () => { this.index++; this.render(); } }] : []),
      { label: atEnd ? 'Done' : 'Finish later', variant: atEnd ? 'primary' : 'secondary', onClick: () => this.modal.close() }
    ]);
  }
}
