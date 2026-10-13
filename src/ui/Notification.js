/**
 * Notification System
 * Shows temporary toast notifications as DOM elements (not on the canvas), so
 * they never end up in video recordings and are announced by screen readers.
 */

const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
const DURATION_MS = 3000;
const ACTION_DURATION_MS = 7000;

export class NotificationSystem {
  constructor() {
    this.maxNotifications = 3; // Maximum visible notifications
    this.muted = false; // When true, non-error notifications are suppressed

    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);
  }

  /**
   * Show a notification
   * @param {string} text - Text to display
   * @param {string} type - Type of notification: 'info', 'success', 'warning', 'error'
   * @param {{actionLabel?: string, onAction?: Function}} options - Optional action button
   */
  show(text, type = 'info', options = {}) {
    if (this.muted && type !== 'error') return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[type] || ICONS.info;

    const message = document.createElement('span');
    message.className = 'toast-text';
    message.textContent = text;

    toast.append(icon, message);

    if (options.actionLabel && options.onAction) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'toast-action';
      action.textContent = options.actionLabel;
      action.addEventListener('click', () => {
        options.onAction();
        this.dismiss(toast);
      });
      toast.appendChild(action);
    }

    this.container.appendChild(toast);
    // Trigger the CSS enter transition on the next frame
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    while (this.container.children.length > this.maxNotifications) {
      this.container.firstElementChild.remove();
    }

    const duration = options.actionLabel ? ACTION_DURATION_MS : DURATION_MS;
    toast._timer = setTimeout(() => this.dismiss(toast), duration);
  }

  /**
   * Fade out and remove a toast
   */
  dismiss(toast) {
    clearTimeout(toast._timer);
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 250);
  }

  // Kept for compatibility with the old canvas-drawn notifications
  update() {}
  draw() {}
}
