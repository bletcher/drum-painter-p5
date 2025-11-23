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
 * @param {string} shape - Shape type ('circle', 'square', 'triangle', 'diamond', 'star', 'hexagon', 'splatter', 'brushstroke')
 * @param {Object} stroke - Stroke settings {enabled, weight, color}
 * @param {number} rotation - Rotation angle in degrees
 * @param {number} strokeAlpha - Optional alpha for stroke (defaults to same as fill alpha)
 */
export function paintDot(paintCanvas, x, y, size, col, alpha, shape = 'circle', stroke = null, rotation = 0, strokeAlpha = null) {
  let r = red(col), g = green(col), b = blue(col);

  // For brushstroke, use p5.brush which has its own color system
  if (shape === 'brushstroke') {
    // p5.brush handles colors differently, pass them to the drawing function
    // We'll set colors inside drawBrushStroke
  } else {
    paintCanvas.fill(r, g, b, alpha);
  }

  // Apply stroke if enabled
  if (stroke && stroke.enabled) {
    let sr = parseInt(stroke.color.slice(1, 3), 16);
    let sg = parseInt(stroke.color.slice(3, 5), 16);
    let sb = parseInt(stroke.color.slice(5, 7), 16);
    // Use provided strokeAlpha if available, otherwise use same alpha as fill
    let sa = strokeAlpha !== null ? strokeAlpha : alpha;
    paintCanvas.stroke(sr, sg, sb, sa);
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
      case 'splatter':
        drawSplatter(paintCanvas, 0, 0, size);
        break;
      case 'brushstroke':
        drawBrushStroke(paintCanvas, 0, 0, size, 0, col, alpha);
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
      case 'splatter':
        drawSplatter(paintCanvas, x, y, size);
        break;
      case 'brushstroke':
        drawBrushStroke(paintCanvas, x, y, size, radians(rotation), col, alpha);
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

/**
 * Draw a splatter effect - burst of small dots radiating from center
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the splatter effect
 */
export function drawSplatter(canvas, x, y, size) {
  // Number of droplets based on size (more for larger splatters)
  let dropletCount = Math.floor(size / 3) + 8;
  let maxRadius = size / 2;

  for (let i = 0; i < dropletCount; i++) {
    // Random angle and distance from center
    let angle = random(TWO_PI);
    let distance = random(maxRadius * 0.2, maxRadius);

    // Calculate droplet position
    let dx = x + cos(angle) * distance;
    let dy = y + sin(angle) * distance;

    // Droplet size decreases with distance from center
    let dropletSize = random(size * 0.05, size * 0.15) * (1 - distance / maxRadius);

    // Draw individual droplet
    canvas.circle(dx, dy, dropletSize);
  }

  // Add a larger central blob
  canvas.circle(x, y, size * 0.25);
}

/**
 * Draw a high-quality custom brush stroke with realistic paint characteristics
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the brush stroke
 * @param {number} rotation - Rotation angle in radians
 * @param {p5.Color} col - Color object
 * @param {number} alpha - Alpha/opacity value
 */
export function drawBrushStroke(canvas, x, y, size, rotation, col, alpha) {
  canvas.push();
  canvas.translate(x, y);
  canvas.rotate(rotation);

  let r = red(col), g = green(col), b = blue(col);
  let strokeLength = size * 2.0;
  let baseWidth = size * 0.4;

  // Draw multiple layers for depth and texture (3 layers)
  for (let layer = 0; layer < 3; layer++) {
    // Slight random offset for each layer
    let offsetX = random(-size * 0.04, size * 0.04);
    let offsetY = random(-size * 0.04, size * 0.04);

    // Layer opacity decreases for outer layers
    let layerAlpha = alpha * (1 - layer * 0.15);

    // Draw the main body using a soft gradient approach
    canvas.noStroke();

    // Number of segments for smooth taper
    let segments = 25;

    for (let i = 0; i < segments; i++) {
      let t = i / segments; // 0 to 1
      let nextT = (i + 1) / segments;

      // Position along stroke
      let x1 = map(t, 0, 1, -strokeLength / 2, strokeLength / 2) + offsetX;
      let x2 = map(nextT, 0, 1, -strokeLength / 2, strokeLength / 2) + offsetX;

      // Pressure curve: starts thick, tapers to thin
      // Using power curve for natural taper
      let pressure1 = pow(1 - t, 1.3) * 0.9 + 0.1;
      let pressure2 = pow(1 - nextT, 1.3) * 0.9 + 0.1;

      let width1 = baseWidth * pressure1;
      let width2 = baseWidth * pressure2;

      // Opacity fades slightly toward the end
      let segmentAlpha = layerAlpha * (0.7 + pressure1 * 0.3);

      // Draw segment as a quad with slight width variation
      canvas.fill(r, g, b, segmentAlpha);
      canvas.quad(
        x1, -width1 / 2 + offsetY,
        x2, -width2 / 2 + offsetY,
        x2, width2 / 2 + offsetY,
        x1, width1 / 2 + offsetY
      );
    }
  }

  // Add bristle texture marks for realism
  let numBristles = Math.floor(size * 0.5);
  canvas.strokeWeight(1);

  for (let i = 0; i < numBristles; i++) {
    // Focus bristles in the first 60% of stroke (where paint is thickest)
    let t = random(0.05, 0.65);
    let xPos = map(t, 0, 1, -strokeLength / 2, strokeLength / 2);

    // Bristle position based on pressure curve
    let pressure = pow(1 - t, 1.3) * 0.9 + 0.1;
    let currentWidth = baseWidth * pressure;

    // Random bristle within the stroke width
    let yPos = random(-currentWidth / 2, currentWidth / 2);

    // Bristle length and angle
    let bristleLength = random(size * 0.15, size * 0.3);
    let bristleAngle = random(-PI / 8, PI / 8);

    let endX = xPos + cos(bristleAngle) * bristleLength;
    let endY = yPos + sin(bristleAngle) * bristleLength;

    // Bristle opacity (more subtle)
    let bristleAlpha = alpha * random(0.2, 0.4);
    canvas.stroke(r, g, b, bristleAlpha);
    canvas.line(xPos, yPos, endX, endY);
  }

  canvas.pop();
}

/**
 * Draw a splatter on a 2D canvas context (for customization panel preview)
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the splatter
 */
export function drawSplatterCanvas(ctx, x, y, size) {
  let dropletCount = Math.floor(size / 3) + 8;
  let maxRadius = size / 2;

  // Check if stroke is enabled
  const hasStroke = ctx.lineWidth > 0 && ctx.strokeStyle && ctx.strokeStyle !== 'transparent';

  for (let i = 0; i < dropletCount; i++) {
    let angle = Math.random() * Math.PI * 2;
    let distance = Math.random() * (maxRadius - maxRadius * 0.2) + maxRadius * 0.2;

    let dx = x + Math.cos(angle) * distance;
    let dy = y + Math.sin(angle) * distance;

    let dropletSize = (Math.random() * (size * 0.1) + size * 0.05) * (1 - distance / maxRadius);

    ctx.beginPath();
    ctx.arc(dx, dy, dropletSize / 2, 0, Math.PI * 2);
    ctx.fill();
    if (hasStroke) ctx.stroke();
  }

  // Central blob
  ctx.beginPath();
  ctx.arc(x, y, size * 0.125, 0, Math.PI * 2);
  ctx.fill();
  if (hasStroke) ctx.stroke();
}

/**
 * Draw a high-quality custom brush stroke (for customization panel preview)
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the brush stroke
 * @param {number} rotation - Rotation angle in radians
 */
export function drawBrushStrokeCanvas(ctx, x, y, size, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  let strokeLength = size * 2.0;
  let baseWidth = size * 0.4;

  // Get current fill style for color
  const fillStyle = ctx.fillStyle;

  // Draw 3 layers for depth
  for (let layer = 0; layer < 3; layer++) {
    let offsetX = (Math.random() - 0.5) * size * 0.08;
    let offsetY = (Math.random() - 0.5) * size * 0.08;

    let segments = 25;

    for (let i = 0; i < segments; i++) {
      let t = i / segments;
      let nextT = (i + 1) / segments;

      let x1 = (t - 0.5) * strokeLength + offsetX;
      let x2 = (nextT - 0.5) * strokeLength + offsetX;

      // Pressure taper
      let pressure1 = Math.pow(1 - t, 1.3) * 0.9 + 0.1;
      let pressure2 = Math.pow(1 - nextT, 1.3) * 0.9 + 0.1;

      let width1 = baseWidth * pressure1;
      let width2 = baseWidth * pressure2;

      // Draw segment
      ctx.fillStyle = fillStyle;
      ctx.globalAlpha = ctx.globalAlpha * (1 - layer * 0.15) * (0.7 + pressure1 * 0.3);

      ctx.beginPath();
      ctx.moveTo(x1, -width1 / 2 + offsetY);
      ctx.lineTo(x2, -width2 / 2 + offsetY);
      ctx.lineTo(x2, width2 / 2 + offsetY);
      ctx.lineTo(x1, width1 / 2 + offsetY);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Bristle marks
  let numBristles = Math.floor(size * 0.5);
  ctx.lineWidth = 1;

  for (let i = 0; i < numBristles; i++) {
    let t = Math.random() * 0.6 + 0.05;
    let xPos = (t - 0.5) * strokeLength;

    let pressure = Math.pow(1 - t, 1.3) * 0.9 + 0.1;
    let currentWidth = baseWidth * pressure;

    let yPos = (Math.random() - 0.5) * currentWidth;
    let bristleLength = Math.random() * size * 0.15 + size * 0.15;
    let bristleAngle = (Math.random() - 0.5) * Math.PI / 4;

    let endX = xPos + Math.cos(bristleAngle) * bristleLength;
    let endY = yPos + Math.sin(bristleAngle) * bristleLength;

    ctx.globalAlpha = Math.random() * 0.2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(xPos, yPos);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  ctx.restore();
}
