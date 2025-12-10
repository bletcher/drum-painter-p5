/**
 * Metronome Controller
 * Handles audio and visual metronome for timeline mode
 */

import {
  METRONOME_RADIUS,
  METRONOME_DEFAULT_MARGIN,
  METRONOME_PULSE_THRESHOLD,
  METRONOME_MARKER_SIZE_FIRST,
  METRONOME_MARKER_SIZE_BEAT,
  METRONOME_MARKER_SIZE_SUB,
  METRONOME_HAND_OFFSET,
  METRONOME_FREQ_FIRST_BEAT,
  METRONOME_FREQ_BEAT,
  METRONOME_FREQ_SUBDIVISION,
  METRONOME_GAIN_FIRST,
  METRONOME_GAIN_BEAT,
  METRONOME_GAIN_SUB,
  METRONOME_CLICK_DURATION
} from '../config/constants.js';
import { debugLog, debugWarn } from '../utils/debug.js';

/**
 * Metronome Controller
 * Manages audio clicks and visual metronome display
 */
export class MetronomeController {
  constructor() {
    this.audioContext = null;
    this.enabled = false;
    this.lastClickSubdivision = -1;

    // Position (draggable)
    this.x = null; // null = use default position
    this.y = null;
    this.dragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
  }

  /**
   * Initialize audio context
   * Must be called after user interaction due to browser autoplay policy
   */
  initAudioContext() {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      debugLog('Audio context initialized for metronome');
    } catch (error) {
      debugWarn('Failed to initialize audio context:', error);
    }
  }

  /**
   * Close audio context
   */
  async closeAudioContext() {
    if (!this.audioContext) return;

    try {
      await this.audioContext.close();
      debugLog('Audio context closed');
    } catch (error) {
      debugWarn('Error closing audio context:', error);
    }
    this.audioContext = null;
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Get enabled state
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Set position
   */
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Get position (or default)
   */
  getPosition(canvasWidth, canvasHeight) {
    const defaultX = canvasWidth - METRONOME_DEFAULT_MARGIN;
    const defaultY = canvasHeight - METRONOME_DEFAULT_MARGIN;
    return {
      x: this.x !== null ? this.x : defaultX,
      y: this.y !== null ? this.y : defaultY
    };
  }

  /**
   * Check if point is within metronome circle
   */
  isPointInside(px, py, canvasWidth, canvasHeight) {
    const pos = this.getPosition(canvasWidth, canvasHeight);
    const dist = Math.sqrt(Math.pow(px - pos.x, 2) + Math.pow(py - pos.y, 2));
    return dist < METRONOME_RADIUS;
  }

  /**
   * Start dragging
   */
  startDrag(mouseX, mouseY, canvasWidth, canvasHeight) {
    const pos = this.getPosition(canvasWidth, canvasHeight);
    this.dragging = true;
    this.dragOffsetX = mouseX - pos.x;
    this.dragOffsetY = mouseY - pos.y;
    return true;
  }

  /**
   * Update position while dragging
   */
  updateDrag(mouseX, mouseY) {
    if (!this.dragging) return;
    this.x = mouseX - this.dragOffsetX;
    this.y = mouseY - this.dragOffsetY;
  }

  /**
   * Stop dragging
   */
  stopDrag() {
    this.dragging = false;
  }

  /**
   * Play metronome click sound
   * @param {boolean} isFirstBeat - Is this the first beat of a measure
   * @param {boolean} isBeat - Is this a main beat (not subdivision)
   */
  playClick(isFirstBeat, isBeat) {
    if (!this.audioContext) {
      debugWarn('No audio context for metronome');
      return;
    }

    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Different tones for different beats
    if (isFirstBeat) {
      oscillator.frequency.value = METRONOME_FREQ_FIRST_BEAT;
      gainNode.gain.value = METRONOME_GAIN_FIRST;
    } else if (isBeat) {
      oscillator.frequency.value = METRONOME_FREQ_BEAT;
      gainNode.gain.value = METRONOME_GAIN_BEAT;
    } else {
      oscillator.frequency.value = METRONOME_FREQ_SUBDIVISION;
      gainNode.gain.value = METRONOME_GAIN_SUB;
    }

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + METRONOME_CLICK_DURATION);
  }

  /**
   * Update metronome and play clicks as needed
   * @param {number} timeElapsed - Time elapsed in seconds
   * @param {number} bpm - Beats per minute
   * @param {number} subdivision - Subdivision (4, 8, 12, 16)
   * @param {number} beatsPerMeasure - Beats per measure
   */
  update(timeElapsed, bpm, subdivision, beatsPerMeasure) {
    if (!this.enabled) return;

    const secondsPerBeat = 60 / bpm;
    const secondsPerSubdivision = secondsPerBeat / (subdivision / 4);
    const subdivisionsPerMeasure = subdivision * (beatsPerMeasure / 4);

    const currentSubdivision = Math.floor(timeElapsed / secondsPerSubdivision);

    if (currentSubdivision !== this.lastClickSubdivision) {
      this.lastClickSubdivision = currentSubdivision;

      const positionInMeasure = currentSubdivision % subdivisionsPerMeasure;
      const isFirstBeat = positionInMeasure === 0;
      const isBeat = positionInMeasure % (subdivision / 4) === 0;

      debugLog(`Metronome click: subdivision ${currentSubdivision}, firstBeat=${isFirstBeat}, beat=${isBeat}`);
      this.playClick(isFirstBeat, isBeat);
    }
  }

  /**
   * Reset last click counter
   */
  reset() {
    this.lastClickSubdivision = -1;
  }

  /**
   * Draw visual metronome
   * @param {Object} p5 - p5.js instance
   * @param {number} canvasWidth - Canvas width
   * @param {number} canvasHeight - Canvas height
   * @param {number} timeElapsed - Time elapsed in seconds
   * @param {number} bpm - Beats per minute
   * @param {number} subdivision - Subdivision
   * @param {number} beatsPerMeasure - Beats per measure
   * @param {boolean} isRecording - Whether we're actively recording
   */
  draw(p5, canvasWidth, canvasHeight, timeElapsed, bpm, subdivision, beatsPerMeasure, isRecording) {
    if (!this.enabled || !isRecording) return;

    const pos = this.getPosition(canvasWidth, canvasHeight);
    const centerX = pos.x;
    const centerY = pos.y;
    const radius = METRONOME_RADIUS;

    // Calculate timing
    const secondsPerBeat = 60 / bpm;
    const secondsPerSubdivision = secondsPerBeat / (subdivision / 4);
    const subdivisionsPerMeasure = subdivision * (beatsPerMeasure / 4);

    // Check if mouse is over metronome (for drag detection)
    const mouseX = p5.mouseX;
    const mouseY = p5.mouseY;
    const distFromCenter = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));
    const isMouseOver = distFromCenter < radius;

    p5.push();
    p5.colorMode(p5.RGB, 255);

    // Draw outer circle with hover effect
    p5.noFill();
    if (this.dragging) {
      p5.stroke(100, 200, 255, 200);
      p5.strokeWeight(3);
    } else if (isMouseOver) {
      p5.stroke(150, 150, 150, 200);
      p5.strokeWeight(2);
    } else {
      p5.stroke(100, 100, 100, 150);
      p5.strokeWeight(1);
    }
    p5.ellipse(centerX, centerY, radius * 2);

    // Calculate current position in measure
    const currentSubdivision = Math.floor(timeElapsed / secondsPerSubdivision);
    const positionInMeasure = currentSubdivision % subdivisionsPerMeasure;

    // Draw subdivision markers around the circle
    const totalSubdivisions = subdivisionsPerMeasure;
    for (let i = 0; i < totalSubdivisions; i++) {
      const angle = (i / totalSubdivisions) * Math.PI * 2 - Math.PI / 2;
      const isFirstBeat = i === 0;
      const isBeat = i % (subdivision / 4) === 0;

      let markerSize;
      if (isFirstBeat) {
        markerSize = METRONOME_MARKER_SIZE_FIRST;
        p5.fill(255, 100, 100, 200);
      } else if (isBeat) {
        markerSize = METRONOME_MARKER_SIZE_BEAT;
        p5.fill(200, 200, 200, 180);
      } else {
        markerSize = METRONOME_MARKER_SIZE_SUB;
        p5.fill(150, 150, 150, 120);
      }

      const markerX = centerX + (radius - 10) * Math.cos(angle);
      const markerY = centerY + (radius - 10) * Math.sin(angle);

      p5.noStroke();
      p5.ellipse(markerX, markerY, markerSize);
    }

    // Draw rotating hand
    const handAngle = (positionInMeasure / totalSubdivisions) * Math.PI * 2 - Math.PI / 2;
    const handLength = radius - METRONOME_HAND_OFFSET;

    // Pulse effect on beats
    const pulseProgress = (timeElapsed % secondsPerSubdivision) / secondsPerSubdivision;
    const isPulsing = pulseProgress < METRONOME_PULSE_THRESHOLD;

    if (isPulsing) {
      const pulse = 1 - pulseProgress / METRONOME_PULSE_THRESHOLD;
      p5.stroke(255, 100, 100, 200 * pulse);
      p5.strokeWeight(4);
    } else {
      p5.stroke(200, 200, 200, 180);
      p5.strokeWeight(2);
    }

    p5.line(centerX, centerY,
      centerX + handLength * Math.cos(handAngle),
      centerY + handLength * Math.sin(handAngle));

    // Center dot
    p5.noStroke();
    p5.fill(255, 255, 255, 200);
    p5.ellipse(centerX, centerY, 8);

    p5.pop();
  }
}

export default MetronomeController;
