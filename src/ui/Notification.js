/**
 * Notification System
 * Shows temporary toast notifications with icons and animations
 */

export class NotificationSystem {
  constructor() {
    this.notifications = []; // Queue of notifications
    this.maxNotifications = 3; // Maximum visible notifications
  }

  /**
   * Show a notification
   * @param {string} text - Text to display
   * @param {string} type - Type of notification: 'info', 'success', 'warning', 'error'
   */
  show(text, type = 'info') {
    const notification = {
      text,
      type,
      alpha: 0, // Start transparent
      targetAlpha: 255,
      life: 180, // Frames to show (3 seconds at 60fps)
      slideOffset: 50, // Slide in animation
      id: Date.now() + Math.random()
    };

    this.notifications.push(notification);

    // Remove oldest if too many
    if (this.notifications.length > this.maxNotifications) {
      this.notifications.shift();
    }
  }

  /**
   * Update all notifications
   */
  update() {
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      const notif = this.notifications[i];

      // Fade in animation
      if (notif.alpha < notif.targetAlpha) {
        notif.alpha += 15;
      }

      // Slide in animation
      if (notif.slideOffset > 0) {
        notif.slideOffset -= 3;
      }

      // Decrease life
      notif.life--;

      // Fade out when life is low
      if (notif.life < 30) {
        notif.targetAlpha = 0;
        if (notif.alpha > 0) {
          notif.alpha -= 10;
        }
      }

      // Remove when faded out
      if (notif.life <= 0 && notif.alpha <= 0) {
        this.notifications.splice(i, 1);
      }
    }
  }

  /**
   * Get icon for notification type
   */
  getIcon(type) {
    switch(type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  }

  /**
   * Get color for notification type
   */
  getColor(type) {
    switch(type) {
      case 'success':
        return { r: 72, g: 187, b: 120 }; // Green
      case 'error':
        return { r: 239, g: 68, b: 68 }; // Red
      case 'warning':
        return { r: 251, g: 191, b: 36 }; // Yellow
      default:
        return { r: 59, g: 130, b: 246 }; // Blue
    }
  }

  /**
   * Draw all notifications on screen
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   */
  draw(canvasWidth, canvasHeight) {
    if (this.notifications.length === 0) return;

    push();

    const notifWidth = 320;
    const notifHeight = 60;
    const spacing = 10;
    const rightMargin = 20;
    const topMargin = 80;

    // Draw from top to bottom
    this.notifications.forEach((notif, index) => {
      if (notif.alpha <= 0) return;

      const x = canvasWidth - notifWidth - rightMargin + notif.slideOffset;
      const y = topMargin + (notifHeight + spacing) * index;

      const color = this.getColor(notif.type);
      const icon = this.getIcon(notif.type);

      // Shadow
      fill(0, 0, 0, notif.alpha * 0.15);
      noStroke();
      rect(x + 4, y + 4, notifWidth, notifHeight, 8);

      // Background
      fill(255, 255, 255, notif.alpha);
      rect(x, y, notifWidth, notifHeight, 8);

      // Left accent bar
      fill(color.r, color.g, color.b, notif.alpha);
      rect(x, y, 5, notifHeight, 8, 0, 0, 8);

      // Icon circle
      fill(color.r, color.g, color.b, notif.alpha * 0.15);
      circle(x + 30, y + notifHeight / 2, 32);

      // Icon
      fill(color.r, color.g, color.b, notif.alpha);
      textAlign(CENTER, CENTER);
      textSize(18);
      textStyle(BOLD);
      text(icon, x + 30, y + notifHeight / 2);

      // Text
      fill(60, 60, 60, notif.alpha);
      textAlign(LEFT, CENTER);
      textSize(13);
      textStyle(NORMAL);
      text(notif.text, x + 55, y + notifHeight / 2);
    });

    pop();
  }
}
