/**
 * Notification System
 * Shows temporary text notifications on screen
 */

export class NotificationSystem {
  constructor() {
    this.text = '';
    this.alpha = 0;
  }

  /**
   * Show a notification
   * @param {string} text - Text to display
   */
  show(text) {
    this.text = text;
    this.alpha = 255;
  }

  /**
   * Update notification (fade out)
   */
  update() {
    if (this.alpha > 0) {
      this.alpha -= 5;
    }
  }

  /**
   * Draw notification on screen
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   */
  draw(canvasWidth, canvasHeight) {
    if (this.alpha <= 0) return;

    push();

    // Center text
    textAlign(CENTER, CENTER);
    textSize(48);
    textStyle(BOLD);

    // Background shadow
    fill(0, 0, 0, this.alpha * 0.7);
    text(this.text, canvasWidth / 2 + 3, canvasHeight / 2 + 3);

    // Main text
    fill(255, 255, 255, this.alpha);
    text(this.text, canvasWidth / 2, canvasHeight / 2);

    pop();
  }
}
