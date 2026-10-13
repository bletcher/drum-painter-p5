/**
 * Keyboard Pads
 * Play the kit from the computer keyboard (home row) — for trying the app
 * without a MIDI kit, or on browsers without Web MIDI.
 */

// Physical key positions, so it works on any keyboard layout
export const PAD_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
const PAD_LABELS = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';'];
export const TOGGLE_KEY = 'Backquote';

const NORMAL_VELOCITY = 0.7;
const ACCENT_VELOCITY = 1.0; // With Shift held

export class KeyboardPads {
  /**
   * @param {Object} deps
   * @param {Function} deps.getDrums - () => [{ id, name, color, midiNote }] in kit order
   * @param {Function} deps.onHit - ({ note, velocity, deviceId, drumId, timeStamp }) => void
   * @param {Function} deps.onToggle - (enabled) => void
   */
  constructor(deps) {
    this.deps = deps;
    this.enabled = false;
    this.hint = null;

    // Capture phase so pads win over the app's single-key shortcuts
    window.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
    window.addEventListener('keyup', (e) => this.handleKeyUp(e), true);
  }

  toggle(force) {
    this.enabled = force ?? !this.enabled;
    if (this.enabled) {
      this.showHint();
    } else {
      this.hideHint();
    }
    this.deps.onToggle(this.enabled);
  }

  isTypingTarget(target) {
    return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' || target.isContentEditable);
  }

  handleKeyDown(e) {
    if (this.isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === TOGGLE_KEY) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.toggle();
      return;
    }

    if (!this.enabled) return;

    if (e.key === 'Escape') {
      this.toggle(false);
      return; // Let Escape also close any open dialogs
    }

    const index = PAD_KEYS.indexOf(e.code);
    if (index === -1) return;

    // Pads own these keys while enabled
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;

    const drum = this.deps.getDrums()[index];
    if (!drum) return;

    this.deps.onHit({
      note: drum.midiNote,
      velocity: e.shiftKey ? ACCENT_VELOCITY : NORMAL_VELOCITY,
      deviceId: 'computer-keyboard',
      drumId: drum.id,
      timeStamp: e.timeStamp // performance.now() clock, when the key went down
    });
    this.setPressed(index, true);
  }

  handleKeyUp(e) {
    if (!this.enabled) return;
    const index = PAD_KEYS.indexOf(e.code);
    if (index !== -1) {
      e.stopImmediatePropagation();
      this.setPressed(index, false);
    }
  }

  showHint() {
    this.hideHint();
    const drums = this.deps.getDrums().slice(0, PAD_KEYS.length);
    this.hint = document.createElement('div');
    this.hint.id = 'keyboard-pads-hint';
    this.hint.setAttribute('aria-hidden', 'true');
    this.keyEls = drums.map((drum, i) => {
      const key = document.createElement('div');
      key.className = 'pad-key';
      key.style.setProperty('--pad-color', drum.color);
      const kbd = document.createElement('kbd');
      kbd.textContent = PAD_LABELS[i];
      const name = document.createElement('span');
      name.textContent = drum.name;
      key.append(kbd, name);
      this.hint.appendChild(key);
      return key;
    });
    document.body.appendChild(this.hint);
  }

  hideHint() {
    if (this.hint) {
      this.hint.remove();
      this.hint = null;
      this.keyEls = [];
    }
  }

  setPressed(index, pressed) {
    this.keyEls?.[index]?.classList.toggle('pressed', pressed);
  }
}
