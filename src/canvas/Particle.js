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
  }

  update() {
    this.life--;
  }

  display(offsetX, offsetY, scaleFactor) {
    let alpha = map(this.life, 0, PARTICLE_LIFETIME, 0, 255);
    let x = offsetX + this.x * scaleFactor;
    let y = offsetY + this.y * scaleFactor;
    let s = this.size * scaleFactor * (1 + (PARTICLE_LIFETIME - this.life) * PARTICLE_SIZE_GROWTH);
    let r = red(this.col), g = green(this.col), b = blue(this.col);

    push();
    noFill();
    stroke(r, g, b, alpha);
    strokeWeight(2);
    circle(x, y, s);
    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}
