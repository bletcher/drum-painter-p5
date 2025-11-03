/**
 * Canvas Drawing Utilities
 * Functions for drawing shapes and dots on the canvas
 */

/**
 * Paint a dot on the canvas with specified shape and style
 * @param {p5.Graphics} paintCanvas - The canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the shape
 * @param {p5.Color} col - Color object
 * @param {number} alpha - Alpha/opacity value
 * @param {string} shape - Shape type ('circle', 'square', 'triangle', 'diamond', 'star', 'hexagon')
 * @param {Object} stroke - Stroke settings {enabled, weight, color}
 * @param {number} rotation - Rotation angle in degrees
 */
export function paintDot(paintCanvas, x, y, size, col, alpha, shape = 'circle', stroke = null, rotation = 0) {
  let r = red(col), g = green(col), b = blue(col);
  paintCanvas.fill(r, g, b, alpha);

  // Apply stroke if enabled
  if (stroke && stroke.enabled) {
    let sr = parseInt(stroke.color.slice(1, 3), 16);
    let sg = parseInt(stroke.color.slice(3, 5), 16);
    let sb = parseInt(stroke.color.slice(5, 7), 16);
    paintCanvas.stroke(sr, sg, sb);
    paintCanvas.strokeWeight(stroke.weight);
  } else {
    paintCanvas.noStroke();
  }

  // Apply rotation for non-circular shapes
  if (rotation !== 0 && shape !== 'circle') {
    paintCanvas.push();
    paintCanvas.translate(x, y);
    paintCanvas.rotate(radians(rotation));

    switch (shape) {
      case 'square':
        paintCanvas.rectMode(CENTER);
        paintCanvas.square(0, 0, size);
        break;
      case 'triangle':
        let h = size * 0.866;
        paintCanvas.triangle(0, -size / 2, -size / 2, h / 2, size / 2, h / 2);
        break;
      case 'diamond':
        paintCanvas.quad(0, -size / 2, size / 2, 0, 0, size / 2, -size / 2, 0);
        break;
      case 'star':
        drawStar(paintCanvas, 0, 0, size / 3, size / 2, 5);
        break;
      case 'hexagon':
        drawHexagon(paintCanvas, 0, 0, size / 2);
        break;
      default:
        paintCanvas.circle(0, 0, size);
    }

    paintCanvas.pop();
  } else {
    // No rotation or circle (rotation doesn't affect circles)
    switch (shape) {
      case 'circle':
        paintCanvas.circle(x, y, size);
        break;
      case 'square':
        paintCanvas.rectMode(CENTER);
        paintCanvas.square(x, y, size);
        break;
      case 'triangle':
        let h = size * 0.866;
        paintCanvas.triangle(x, y - size / 2, x - size / 2, y + h / 2, x + size / 2, y + h / 2);
        break;
      case 'diamond':
        paintCanvas.quad(x, y - size / 2, x + size / 2, y, x, y + size / 2, x - size / 2, y);
        break;
      case 'star':
        drawStar(paintCanvas, x, y, size / 3, size / 2, 5);
        break;
      case 'hexagon':
        drawHexagon(paintCanvas, x, y, size / 2);
        break;
      default:
        paintCanvas.circle(x, y, size);
    }
  }
}

/**
 * Draw a star shape
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius1 - Inner radius
 * @param {number} radius2 - Outer radius
 * @param {number} npoints - Number of points
 */
export function drawStar(canvas, x, y, radius1, radius2, npoints) {
  let angle = TWO_PI / npoints;
  let halfAngle = angle / 2.0;
  canvas.beginShape();
  for (let a = -PI / 2; a < TWO_PI - PI / 2; a += angle) {
    let sx = x + cos(a) * radius2;
    let sy = y + sin(a) * radius2;
    canvas.vertex(sx, sy);
    sx = x + cos(a + halfAngle) * radius1;
    sy = y + sin(a + halfAngle) * radius1;
    canvas.vertex(sx, sy);
  }
  canvas.endShape(CLOSE);
}

/**
 * Draw a hexagon shape
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Radius
 */
export function drawHexagon(canvas, x, y, radius) {
  canvas.beginShape();
  for (let i = 0; i < 6; i++) {
    let angle = (TWO_PI / 6) * i - PI / 2;
    let sx = x + cos(angle) * radius;
    let sy = y + sin(angle) * radius;
    canvas.vertex(sx, sy);
  }
  canvas.endShape(CLOSE);
}

/**
 * Draw a star on a 2D canvas context (for customization panel preview)
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius1 - Inner radius
 * @param {number} radius2 - Outer radius
 * @param {number} npoints - Number of points
 */
export function drawStarCanvas(ctx, x, y, radius1, radius2, npoints) {
  let angle = (Math.PI * 2) / npoints;
  let halfAngle = angle / 2.0;
  ctx.beginPath();
  for (let a = -Math.PI / 2; a < Math.PI * 2 - Math.PI / 2; a += angle) {
    let sx = x + Math.cos(a) * radius2;
    let sy = y + Math.sin(a) * radius2;
    ctx.lineTo(sx, sy);
    sx = x + Math.cos(a + halfAngle) * radius1;
    sy = y + Math.sin(a + halfAngle) * radius1;
    ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a hexagon on a 2D canvas context (for customization panel preview)
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Radius
 */
export function drawHexagonCanvas(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    let angle = ((Math.PI * 2) / 6) * i - Math.PI / 2;
    let sx = x + Math.cos(angle) * radius;
    let sy = y + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(sx, sy);
    } else {
      ctx.lineTo(sx, sy);
    }
  }
  ctx.closePath();
  ctx.fill();
}
