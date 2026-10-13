/**
 * Particle Class
 * Visual feedback particles that appear when painting
 */

import { PARTICLE_LIFETIME, PARTICLE_SIZE_GROWTH } from '../config/constants.js';

export class Particle {
  constructor(x, y, size, col) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.col = col;
    this.life = PARTICLE_LIFETIME;

    // Cache RGB once (p5.Color.levels is [r, g, b, a]); avoids per-frame red()/green()/blue()
    if (col && col.levels) {
      this.r = col.levels[0];
      this.g = col.levels[1];
      this.b = col.levels[2];
    } else {
      this.r = red(col);
      this.g = green(col);
      this.b = blue(col);
    }
  }

  update() {
    this.life--;
  }

  display(offsetX, offsetY, scaleFactor) {
    if (this.life <= 0) return; // Fully transparent, nothing to draw

    const alpha = (this.life / PARTICLE_LIFETIME) * 255;
    const x = offsetX + this.x * scaleFactor;
    const y = offsetY + this.y * scaleFactor;
    const s = this.size * scaleFactor * (1 + (PARTICLE_LIFETIME - this.life) * PARTICLE_SIZE_GROWTH);

    // push/pop kept so the global fill/stroke state is not leaked to later drawing
    push();
    noFill();
    stroke(this.r, this.g, this.b, alpha);
    strokeWeight(2);
    circle(x, y, s);
    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}
