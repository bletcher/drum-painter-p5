/**
 * MIDI Connect Card
 * Explains why the app needs MIDI permission and asks for it when the user
 * clicks Connect, instead of the browser prompt popping up unexplained on
 * page load. Prompts that follow a click are also less likely to be hidden
 * by the browser's "quiet" permission UI. If access is blocked, shows how to
 * unblock it in the user's browser.
 */

import { Modal } from '../ui/Modal.js';
import { getBrowserName } from '../utils/browserCompat.js';

/**
 * Current MIDI permission without prompting
 * @returns {Promise<'granted'|'prompt'|'denied'|'unknown'>}
 */
export async function queryMidiPermission() {
  try {
    const status = await navigator.permissions.query({ name: 'midi', sysex: false });
    return status.state;
  } catch (e) {
    return 'unknown'; // Permissions API doesn't know about MIDI in this browser
  }
}

export class MidiConnectCard {
  /**
   * @param {Object} deps
   * @param {Function} deps.connect - async () => boolean; requests MIDI access
   * @param {Function} deps.getDeviceCount - () => number of connected inputs
   * @param {Function} deps.onConnected - Called after a successful connection
   * @param {Function} deps.tryWithoutKit - Turns on keyboard pads
   */
  constructor(deps) {
    this.deps = deps;
    this.modal = new Modal('Connect your drum kit');
  }

  /**
   * @param {'prompt'|'denied'|'unknown'} permission - Known permission state
   */
  open(permission) {
    if (permission === 'denied') {
      this.renderBlocked();
    } else {
      this.renderIntro();
    }
    this.modal.open();
  }

  setBody(...nodes) {
    this.modal.body.replaceChildren(...nodes);
  }

  paragraph(text) {
    const p = document.createElement('p');
    p.textContent = text;
    return p;
  }

  withoutKitButton() {
    return {
      label: 'Try without a kit',
      onClick: () => {
        this.modal.close();
        this.deps.tryWithoutKit();
      }
    };
  }

  renderIntro() {
    this.setBody(
      this.paragraph('Drum Painter listens to your electronic drum kit (or any MIDI pad or controller) over USB.'),
      this.paragraph('Plug your kit in, then click Connect. Your browser will ask whether this site may use MIDI devices: choose Allow.')
    );
    this.modal.setButtons([
      this.withoutKitButton(),
      { label: 'Connect', variant: 'primary', onClick: () => this.connect() }
    ]);
  }

  async connect() {
    this.setBody(this.paragraph('Waiting for your browser… If nothing appears, look for a prompt or a small icon near the address bar.'));
    this.modal.setButtons([]);

    const ok = await this.deps.connect();
    if (!ok) {
      this.renderBlocked();
      return;
    }

    if (this.deps.getDeviceCount() === 0) {
      this.setBody(
        this.paragraph('MIDI is on, but no kit was found.'),
        this.paragraph('Plug your kit in with USB (and switch it on). It will be picked up automatically, no need to reload.')
      );
      this.modal.setButtons([
        this.withoutKitButton(),
        { label: 'OK', variant: 'primary', onClick: () => this.modal.close() }
      ]);
    } else {
      this.modal.close();
    }
    this.deps.onConnected();
  }

  renderBlocked() {
    const browser = getBrowserName();
    const steps = document.createElement('ol');
    const addStep = (text) => {
      const li = document.createElement('li');
      li.textContent = text;
      steps.appendChild(li);
    };

    if (browser === 'Firefox') {
      addStep('Click Try again. Firefox asks you to add a small "site permission" add-on for MIDI: click Continue, then Add.');
      addStep('If you blocked it before: click the permissions icon left of the address bar and clear the MIDI block, then reload.');
    } else {
      addStep('Click the icon just left of the address (ⓘ or a slider icon) and open Site settings.');
      addStep('Set "MIDI devices" to Allow (and "MIDI device control & reprogram" if it is listed).');
      addStep('Reload the page.');
      addStep('If you see a crossed-out icon at the right end of the address bar, you can click it and choose Allow instead.');
    }

    this.setBody(
      this.paragraph('Your browser didn\'t allow MIDI access, so the app can\'t hear your kit yet.'),
      steps
    );
    this.modal.setButtons([
      this.withoutKitButton(),
      { label: 'Try again', variant: 'primary', onClick: () => this.connect() }
    ]);
  }
}
