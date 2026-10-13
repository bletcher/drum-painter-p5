/**
 * Modal
 * Minimal dialog used by the newer feature panels (Kit Setup, latency calibration).
 * Builds its own DOM; styles live in src/styles/features.css.
 */

let modalCount = 0;

export class Modal {
  /**
   * @param {string} title - Dialog heading
   * @param {{onClose?: Function, wide?: boolean}} options
   */
  constructor(title, options = {}) {
    this.onClose = options.onClose || null;
    const titleId = `modal-title-${++modalCount}`;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.style.display = 'none';

    this.dialog = document.createElement('div');
    this.dialog.className = options.wide ? 'modal modal-wide' : 'modal';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', titleId);

    const header = document.createElement('div');
    header.className = 'modal-header';
    const heading = document.createElement('h2');
    heading.id = titleId;
    heading.textContent = title;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'modal-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    header.append(heading, close);

    this.body = document.createElement('div');
    this.body.className = 'modal-body';

    this.footer = document.createElement('div');
    this.footer.className = 'modal-footer';

    this.dialog.append(header, this.body, this.footer);
    this.backdrop.appendChild(this.dialog);
    document.body.appendChild(this.backdrop);

    // Clicks inside must not paint on the canvas underneath
    for (const type of ['mousedown', 'click', 'pointerdown']) {
      this.backdrop.addEventListener(type, (e) => e.stopPropagation());
    }
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    });
  }

  get isOpen() {
    return this.backdrop.style.display !== 'none';
  }

  open() {
    this.backdrop.style.display = 'flex';
  }

  close() {
    if (!this.isOpen) return;
    this.backdrop.style.display = 'none';
    if (this.onClose) this.onClose();
  }

  /**
   * Replace the footer buttons
   * @param {Array<{label: string, onClick: Function, variant?: string, id?: string}>} buttons
   */
  setButtons(buttons) {
    this.footer.replaceChildren();
    for (const { label, onClick, variant = 'secondary', id } of buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn btn-${variant}`;
      btn.textContent = label;
      if (id) btn.id = id;
      btn.addEventListener('click', onClick);
      this.footer.appendChild(btn);
    }
  }
}
