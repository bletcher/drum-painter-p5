/**
 * Freeform Mode
 * Container for random/unpredictable paint styles
 * Delegates to selected style: Classic (Random), Gravity, Organic, Dendritic, Lightning
 */

import { ModeBase } from './ModeBase.js';
import { ClassicMode } from './ClassicMode.js';
import { GravityMode } from './GravityMode.js';
import { OrganicMode } from './OrganicMode.js';
import { DendriticMode } from './DendriticMode.js';
import { LightningMode } from './LightningMode.js';

export class FreeformMode extends ModeBase {
  constructor() {
    super('Freeform', 40, 80);

    // Current style selection
    this.style = 'classic'; // classic, gravity, organic, dendritic, lightning

    // Initialize all style modes (random/unpredictable patterns)
    this.styles = {
      classic: new ClassicMode(),
      gravity: new GravityMode(),
      organic: new OrganicMode(),
      dendritic: new DendriticMode(),
      lightning: new LightningMode()
    };
  }

  /**
   * Get the currently active style mode
   */
  getActiveStyle() {
    return this.styles[this.style] || this.styles.classic;
  }

  /**
   * Set the active style
   */
  setStyle(styleName) {
    if (this.styles[styleName]) {
      this.style = styleName;
    }
  }

  /**
   * Called when mode is activated
   */
  onActivate(context) {
    const activeStyle = this.getActiveStyle();
    if (activeStyle.onActivate) {
      activeStyle.onActivate(context);
    }
  }

  /**
   * Called when mode is deactivated
   */
  onDeactivate(context) {
    const activeStyle = this.getActiveStyle();
    if (activeStyle.onDeactivate) {
      activeStyle.onDeactivate(context);
    }
  }

  /**
   * Paint method - delegates to active style
   */
  paint(note, velocity, context) {
    const activeStyle = this.getActiveStyle();
    activeStyle.paint(note, velocity, context);
  }

  /**
   * Update method - delegates to active style
   */
  update(context) {
    const activeStyle = this.getActiveStyle();
    if (activeStyle.update) {
      activeStyle.update(context);
    }
  }

  /**
   * Draw method for overlay rendering - delegates to active style
   */
  draw(canvasWidth, canvasHeight) {
    const activeStyle = this.getActiveStyle();
    if (activeStyle.draw) {
      activeStyle.draw(canvasWidth, canvasHeight);
    }
  }

  /**
   * Draw lane guides overlay - delegates to active style if it has this method
   */
  drawLaneGuides(p5Instance, offsetX, offsetY, scale, paintCanvas) {
    const activeStyle = this.getActiveStyle();
    if (activeStyle.drawLaneGuides) {
      activeStyle.drawLaneGuides(p5Instance, offsetX, offsetY, scale, paintCanvas);
    }
  }
}
