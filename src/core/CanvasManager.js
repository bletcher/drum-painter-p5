/**
 * Canvas Manager
 * Handles canvas scaling, scrolling, and display logic
 */

import {
  PAINT_CANVAS_WIDTH,
  PAINT_CANVAS_HEIGHT,
  SCROLLBAR_WIDTH,
  SCROLLBAR_TRACK_PADDING,
  SCROLLBAR_THUMB_MIN_HEIGHT,
  CANVAS_FIT_SCALE,
  VIEWPORT_MARGIN_BOTTOM,
  VIEWPORT_MARGIN_TOP,
  AUTO_SCROLL_PADDING,
  SCROLL_MAX_PADDING
} from '../config/constants.js';

/**
 * Canvas Manager
 * Centralizes canvas scaling, scrolling, and display logic
 */
export class CanvasManager {
  constructor() {
    this.paintCanvas = null;
    this.displayCanvas = null;
    this.scrollY = 0;
  }

  /**
   * Initialize the canvas manager
   * @param {Object} paintCanvas - The p5.Graphics paint canvas
   * @param {Object} displayCanvas - The p5 canvas element
   */
  init(paintCanvas, displayCanvas) {
    this.paintCanvas = paintCanvas;
    this.displayCanvas = displayCanvas;
  }

  /**
   * Get the paint canvas
   */
  getPaintCanvas() {
    return this.paintCanvas;
  }

  /**
   * Get the display canvas
   */
  getDisplayCanvas() {
    return this.displayCanvas;
  }

  /**
   * Calculate display dimensions and offsets
   * @param {number} windowWidth - Current window width
   * @param {number} windowHeight - Current window height
   * @param {boolean} isTimeBased - Whether we're in a time-based layout
   * @returns {Object} { scaleFactor, displayWidth, displayHeight, offsetX, offsetY }
   */
  calculateDisplay(windowWidth, windowHeight, isTimeBased = false) {
    const scaleFactor = (windowWidth / this.paintCanvas.width) * CANVAS_FIT_SCALE;
    const displayWidth = this.paintCanvas.width * scaleFactor;
    const displayHeight = this.paintCanvas.height * scaleFactor;
    const offsetX = (windowWidth - displayWidth) / 2;

    let offsetY;
    if (isTimeBased) {
      // Time-based layouts: apply scroll offset
      offsetY = this.scrollY;
    } else {
      // Other modes: center if fits, otherwise scroll
      if (displayHeight <= windowHeight) {
        offsetY = (windowHeight - displayHeight) / 2;
        this.scrollY = 0; // Reset scroll when canvas fits
      } else {
        offsetY = this.scrollY;
      }
    }

    return {
      scaleFactor,
      displayWidth,
      displayHeight,
      offsetX,
      offsetY
    };
  }

  /**
   * Draw the scrollbar
   * @param {Object} p5 - The p5 instance (for drawing functions)
   * @param {number} displayWidth - Canvas display width
   * @param {number} displayHeight - Canvas display height
   * @param {number} offsetX - Canvas X offset
   * @param {number} windowHeight - Window height
   */
  drawScrollbar(p5, displayWidth, displayHeight, offsetX, windowHeight) {
    const scrollbarX = offsetX + displayWidth + 5;
    const scrollbarTrackHeight = windowHeight - (SCROLLBAR_TRACK_PADDING * 2);
    const scrollbarY = SCROLLBAR_TRACK_PADDING;

    // Only show scrollbar if content is larger than viewport
    if (displayHeight > windowHeight) {
      // Calculate scrollbar thumb size and position
      const visibleRatio = windowHeight / displayHeight;
      const thumbHeight = Math.max(SCROLLBAR_THUMB_MIN_HEIGHT, scrollbarTrackHeight * visibleRatio);
      const scrollRange = displayHeight - windowHeight;
      const scrollRatio = Math.abs(this.scrollY) / scrollRange;
      const thumbY = scrollbarY + scrollRatio * (scrollbarTrackHeight - thumbHeight);

      // Draw scrollbar track
      p5.push();
      p5.fill(220);
      p5.noStroke();
      p5.rect(scrollbarX, scrollbarY, SCROLLBAR_WIDTH, scrollbarTrackHeight, 6);

      // Draw scrollbar thumb
      const isMouseOver = this.isMouseOverScrollbarThumb(
        scrollbarX, thumbY, SCROLLBAR_WIDTH, thumbHeight
      );
      if (isMouseOver) {
        p5.fill(100);
      } else {
        p5.fill(150);
      }
      p5.rect(scrollbarX, thumbY, SCROLLBAR_WIDTH, thumbHeight, 6);
      p5.pop();

      // Store scrollbar bounds for mouse interaction
      window.scrollbarBounds = {
        x: scrollbarX,
        y: scrollbarY,
        width: SCROLLBAR_WIDTH,
        trackHeight: scrollbarTrackHeight,
        thumbY: thumbY,
        thumbHeight: thumbHeight,
        scrollRange: scrollRange
      };
    } else {
      window.scrollbarBounds = null;
    }
  }

  /**
   * Check if mouse is over scrollbar thumb
   */
  isMouseOverScrollbarThumb(x, y, w, h) {
    return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  }

  /**
   * Auto-scroll to keep playhead visible
   * @param {Object} chronicleMode - The chronicle/timeline mode
   * @param {number} scaleFactor - Current scale factor
   * @param {number} windowHeight - Window height
   */
  autoScrollToPlayhead(chronicleMode, scaleFactor, windowHeight) {
    if (!chronicleMode.recording || chronicleMode.startTime === null) return;

    const timeElapsed = chronicleMode.getElapsedTime();
    const totalX = timeElapsed * chronicleMode.pixelsPerSecond;
    const staffIndex = Math.floor(totalX / chronicleMode.staffWidth);
    const currentStaffY = staffIndex * chronicleMode.staffHeight * scaleFactor;
    const currentStaffBottomY = (staffIndex + 1) * chronicleMode.staffHeight * scaleFactor;

    // Auto-scroll if playhead is below viewport
    const viewportBottom = -this.scrollY + windowHeight - VIEWPORT_MARGIN_BOTTOM;
    const viewportTop = -this.scrollY + VIEWPORT_MARGIN_TOP;

    if (currentStaffBottomY > viewportBottom) {
      // Scroll down to show current staff
      this.scrollY = -(currentStaffBottomY - windowHeight + AUTO_SCROLL_PADDING);
    } else if (currentStaffY < viewportTop) {
      // Scroll up to show current staff
      this.scrollY = -currentStaffY + VIEWPORT_MARGIN_BOTTOM;
    }

    // Clamp auto-scroll to valid range
    const displayHeight = this.paintCanvas.height * scaleFactor;
    const maxScroll = Math.max(0, displayHeight - windowHeight + SCROLL_MAX_PADDING);
    this.scrollY = Math.max(-maxScroll, Math.min(SCROLLBAR_TRACK_PADDING, this.scrollY));
  }

  /**
   * Set scroll position
   */
  setScrollY(value) {
    this.scrollY = value;
  }

  /**
   * Get scroll position
   */
  getScrollY() {
    return this.scrollY;
  }

  /**
   * Reset scroll to top
   */
  resetScroll() {
    this.scrollY = 0;
  }
}

// Export singleton instance
export const canvasManager = new CanvasManager();
export default CanvasManager;
