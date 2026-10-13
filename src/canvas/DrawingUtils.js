/**
 * Canvas Drawing Utilities
 * Functions for drawing shapes and dots on the canvas
 */

import { getBrushTextureCache, randomTextureVariant } from './BrushTextureCache.js';
import {
  INK_BLOT_CORE_RADIUS,
  INK_BLOT_CORE_ALPHA,
  INK_BLOT_CORE_VERTICES,
  INK_BLOT_BLEED_LAYERS,
  INK_BLOT_BLEED_SPREAD_MIN,
  INK_BLOT_BLEED_SPREAD_MAX,
  INK_BLOT_BLEED_ALPHA_START,
  INK_BLOT_BLEED_ALPHA_DECAY,
  INK_BLOT_EDGE_NOISE_SCALE,
  INK_BLOT_EDGE_NOISE_AMOUNT,
  INK_BLOT_FEATHER_COUNT_MIN,
  INK_BLOT_FEATHER_COUNT_MAX,
  INK_BLOT_FEATHER_LENGTH_MIN,
  INK_BLOT_FEATHER_LENGTH_MAX,
  INK_BLOT_FEATHER_WIDTH,
  INK_BLOT_FEATHER_ALPHA_MIN,
  INK_BLOT_FEATHER_ALPHA_MAX
} from '../config/constants.js';

/** Cache of parsed stroke hex colors: '#rrggbb' -> [r, g, b] */
const strokeColorCache = new Map();
const STROKE_COLOR_CACHE_LIMIT = 64;

/**
 * Get [r, g, b] for a p5.Color, using the fast .levels array when available
 * @param {p5.Color} col - Color object
 * @returns {number[]} Array whose first three entries are r, g, b (0-255)
 */
function getRGB(col) {
  if (col && col.levels) {
    return col.levels;
  }
  return [red(col), green(col), blue(col)];
}

/**
 * Parse a '#rrggbb' stroke color, cached per string
 * @param {string} hex - Hex color string
 * @returns {number[]} [r, g, b]
 */
function parseStrokeColor(hex) {
  let rgb = strokeColorCache.get(hex);
  if (!rgb) {
    rgb = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
    if (strokeColorCache.size >= STROKE_COLOR_CACHE_LIMIT) {
      strokeColorCache.clear();
    }
    strokeColorCache.set(hex, rgb);
  }
  return rgb;
}

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
  const rgb = getRGB(col);
  const r = rgb[0], g = rgb[1], b = rgb[2];

  // Textured shapes colorize their texture directly; others use p5 fill
  if (shape !== 'brushstroke') {
    paintCanvas.fill(r, g, b, alpha);
  }

  // Apply stroke if enabled
  if (stroke && stroke.enabled) {
    const srgb = parseStrokeColor(stroke.color);
    // Use provided strokeAlpha if available, otherwise use same alpha as fill
    let sa = strokeAlpha !== null ? strokeAlpha : alpha;
    paintCanvas.stroke(srgb[0], srgb[1], srgb[2], sa);
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
        drawSplatterRGB(paintCanvas, 0, 0, size, r, g, b, alpha);
        break;
      case 'inkblot':
        drawInkBlotRGB(paintCanvas, 0, 0, size, r, g, b, alpha);
        break;
      case 'brushstroke':
        drawBrushStrokeTexturedRGB(paintCanvas, 0, 0, size, 0, r, g, b, alpha);
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
        drawSplatterRGB(paintCanvas, x, y, size, r, g, b, alpha);
        break;
      case 'inkblot':
        drawInkBlotRGB(paintCanvas, x, y, size, r, g, b, alpha);
        break;
      case 'brushstroke':
        drawBrushStrokeTexturedRGB(paintCanvas, x, y, size, radians(rotation), r, g, b, alpha);
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
 * Draw a realistic paint splatter with organic core and connected droplets
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the splatter effect
 * @param {p5.Color} col - Color object
 * @param {number} alpha - Alpha/opacity value
 */
export function drawSplatter(canvas, x, y, size, col, alpha) {
  const rgb = getRGB(col);
  drawSplatterRGB(canvas, x, y, size, rgb[0], rgb[1], rgb[2], alpha);
}

/**
 * Splatter implementation taking pre-extracted RGB components
 * Uses a cached canonical-size texture variant drawn scaled to the requested size,
 * with random rotation and flip to hide repetition.
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the splatter effect
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @param {number} alpha - Alpha/opacity value (0-255)
 */
function drawSplatterRGB(canvas, x, y, size, r, g, b, alpha) {
  const texture = getBrushTextureCache().getSplatterTexture(size, randomTextureVariant());
  const scale = size / (texture.textureBaseSize || size);

  canvas.push();
  canvas.translate(x, y);
  drawColorizedTexture(canvas, texture, r, g, b, alpha,
    texture.width * scale, texture.height * scale,
    Math.random() * Math.PI * 2, Math.random() < 0.5, false);
  canvas.pop();
}

/**
 * Draw an ink blot with organic bleeding edges
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the ink blot
 * @param {p5.Color} col - Color object
 * @param {number} alpha - Alpha/opacity value
 */
export function drawInkBlot(canvas, x, y, size, col, alpha) {
  const rgb = getRGB(col);
  drawInkBlotRGB(canvas, x, y, size, rgb[0], rgb[1], rgb[2], alpha);
}

/**
 * Ink blot implementation taking pre-extracted RGB components
 * Uses a cached canonical-size texture variant drawn scaled to the requested size,
 * with random rotation and flip to hide repetition.
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the ink blot
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @param {number} alpha - Alpha/opacity value (0-255)
 */
function drawInkBlotRGB(canvas, x, y, size, r, g, b, alpha) {
  const texture = getBrushTextureCache().getInkBlotTexture(size, randomTextureVariant());
  const scale = size / (texture.textureBaseSize || size);

  canvas.push();
  canvas.translate(x, y);
  drawColorizedTexture(canvas, texture, r, g, b, alpha,
    texture.width * scale, texture.height * scale,
    Math.random() * Math.PI * 2, Math.random() < 0.5, false);
  canvas.pop();
}

/**
 * Draw a brush stroke using p5.brush technique: position-based stepping with pressure
 * Places multiple "tips" along path with Gaussian pressure distribution
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the brush stroke
 * @param {number} rotation - Rotation angle in radians
 * @param {p5.Color} col - Color object
 * @param {number} alpha - Alpha/opacity value
 * @param {string} method - Rendering method: 'textured' (default) or 'procedural'
 */
export function drawBrushStroke(canvas, x, y, size, rotation, col, alpha, method = 'textured') {
  if (method === 'textured') {
    drawBrushStrokeTextured(canvas, x, y, size, rotation, col, alpha);
  } else {
    drawBrushStrokeProcedural(canvas, x, y, size, rotation, col, alpha);
  }
}

/**
 * Draw a brush stroke using cached texture approach
 * Generates realistic brush texture with organic bristle patterns
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the brush stroke
 * @param {number} rotation - Rotation angle in radians
 * @param {p5.Color} col - Color object
 * @param {number} alpha - Alpha/opacity value
 */
function drawBrushStrokeTextured(canvas, x, y, size, rotation, col, alpha) {
  const rgb = getRGB(col);
  drawBrushStrokeTexturedRGB(canvas, x, y, size, rotation, rgb[0], rgb[1], rgb[2], alpha);
}

/**
 * Textured brush stroke implementation taking pre-extracted RGB components
 * Orientation comes from the caller's rotation; a random vertical flip is
 * added to hide repetition of the cached texture variants.
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the brush stroke
 * @param {number} rotation - Rotation angle in radians
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @param {number} alpha - Alpha/opacity value (0-255)
 */
function drawBrushStrokeTexturedRGB(canvas, x, y, size, rotation, r, g, b, alpha) {
  const strokeLength = size * 2.5;
  const strokeWidth = size * 0.8;

  const texture = getBrushTextureCache().getTexture(strokeLength, strokeWidth, randomTextureVariant());
  const scaleX = strokeLength / (texture.textureBaseWidth || strokeLength);
  const scaleY = strokeWidth / (texture.textureBaseHeight || strokeWidth);

  canvas.push();
  canvas.translate(x, y);
  canvas.rotate(rotation);
  drawColorizedTexture(canvas, texture, r, g, b, alpha,
    texture.width * scaleX, texture.height * scaleY,
    0, false, Math.random() < 0.5);
  canvas.pop();
}

/** Reusable scratch canvas for colorizing textures (grown as needed) */
let scratchCanvas = null;
let scratchCtx = null;

/**
 * Get the scratch 2D context, growing the canvas to at least w x h
 * @param {number} w - Required width in device pixels
 * @param {number} h - Required height in device pixels
 * @returns {CanvasRenderingContext2D}
 */
function getScratchContext(w, h) {
  if (!scratchCanvas) {
    scratchCanvas = document.createElement('canvas');
    scratchCanvas.width = Math.max(1, w);
    scratchCanvas.height = Math.max(1, h);
    scratchCtx = scratchCanvas.getContext('2d');
  } else if (scratchCanvas.width < w || scratchCanvas.height < h) {
    // Resizing resets the context state, which is fine (we set it every use)
    scratchCanvas.width = Math.max(scratchCanvas.width, w);
    scratchCanvas.height = Math.max(scratchCanvas.height, h);
  }
  return scratchCtx;
}

/**
 * Draw a white/alpha texture colorized with an RGB color, centered at the
 * current origin of the destination graphics (callers translate/rotate first).
 * GPU-friendly replacement for p5 tint(), which reads back pixels on the CPU
 * in the 2D renderer. RGB is multiplied (like tint) and the texture's own
 * alpha is preserved; overall opacity is applied with globalAlpha.
 * Always draws with source-over (BLEND), regardless of the canvas blend mode.
 * @param {p5.Graphics} canvas - Destination graphics
 * @param {p5.Graphics} texture - Source texture
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @param {number} alpha - Opacity (0-255)
 * @param {number} dw - Destination width (logical units)
 * @param {number} dh - Destination height (logical units)
 * @param {number} angle - Extra rotation in radians
 * @param {boolean} flipX - Mirror horizontally
 * @param {boolean} flipY - Mirror vertically
 */
function drawColorizedTexture(canvas, texture, r, g, b, alpha, dw, dh, angle, flipX, flipY) {
  if (!(alpha > 0) || !(dw > 0) || !(dh > 0)) return;

  const src = texture.elt || texture.canvas;
  const dctx = canvas.drawingContext;
  if (!src || !dctx) return;

  // Source size in backing (device) pixels
  const sw = src.width;
  const sh = src.height;

  // 1. Colorize on the scratch canvas
  const sctx = getScratchContext(sw, sh);
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, sw, sh);
  sctx.drawImage(src, 0, 0);
  sctx.globalCompositeOperation = 'multiply';
  sctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  sctx.fillRect(0, 0, sw, sh);
  sctx.globalCompositeOperation = 'destination-in';
  sctx.drawImage(src, 0, 0);
  sctx.globalCompositeOperation = 'source-over';

  // 2. Draw onto destination (already has pixelDensity scale + translate/rotate)
  dctx.save();
  dctx.globalAlpha = Math.min(1, alpha / 255);
  dctx.globalCompositeOperation = 'source-over';
  if (angle) {
    dctx.rotate(angle);
  }
  if (flipX || flipY) {
    dctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  }
  dctx.drawImage(scratchCanvas, 0, 0, sw, sh, -dw / 2, -dh / 2, dw, dh);
  dctx.restore();
}

/**
 * Draw a brush stroke using procedural technique (original p5.brush-style)
 * Places multiple "tips" along path with Gaussian pressure distribution
 * @param {p5.Graphics} canvas - Canvas to draw on
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the brush stroke
 * @param {number} rotation - Rotation angle in radians
 * @param {p5.Color} col - Color object
 * @param {number} alpha - Alpha/opacity value
 */
function drawBrushStrokeProcedural(canvas, x, y, size, rotation, col, alpha) {
  canvas.push();
  canvas.translate(x, y);
  canvas.rotate(rotation);

  const rgb = getRGB(col);
  let r = rgb[0], g = rgb[1], b = rgb[2];
  let strokeLength = size * 2.5;
  let tipSize = size * 0.45;

  canvas.noStroke();

  // Spacing between brush tip placements
  let spacing = tipSize * 0.3;
  let numSteps = Math.floor(strokeLength / spacing);

  // Multiple passes for texture buildup (like p5.brush marker blending)
  let numPasses = 3;

  for (let pass = 0; pass < numPasses; pass++) {
    // Each pass has different opacity
    let passAlpha = alpha * (0.3 - pass * 0.08);

    for (let i = 0; i < numSteps; i++) {
      let t = i / (numSteps - 1); // 0 to 1 along stroke
      let xPos = map(t, 0, 1, -strokeLength / 2, strokeLength / 2);

      // Gaussian pressure distribution (bell curve - thick middle, thin ends)
      // Using gaussian formula: e^(-(x-μ)²/(2σ²))
      let center = 0.5;
      let sigma = 0.25;
      let pressure = exp(-pow(t - center, 2) / (2 * sigma * sigma));
      pressure = constrain(pressure, 0.2, 1.0);

      // Apply pressure to tip size
      let currentTipSize = tipSize * pressure;

      // Vibration/jitter - random offset for organic feel
      let jitterX = randomGaussian() * tipSize * 0.08;
      let jitterY = randomGaussian() * tipSize * 0.15;

      // Draw brush tip (circular)
      let tipAlpha = passAlpha * random(0.8, 1.0);
      canvas.fill(r, g, b, tipAlpha);
      canvas.circle(xPos + jitterX, jitterY, currentTipSize);

      // Add smaller "bristle" details around main tip
      if (pass === 0 && random(1) < 0.3) {
        let numBristles = floor(random(2, 5));
        for (let bi = 0; bi < numBristles; bi++) {
          let bristleOffset = random(currentTipSize * 0.3, currentTipSize * 0.6);
          let bristleAngle = random(TWO_PI);
          let bx = xPos + jitterX + cos(bristleAngle) * bristleOffset;
          let by = jitterY + sin(bristleAngle) * bristleOffset;

          canvas.fill(r, g, b, alpha * random(0.15, 0.3));
          canvas.circle(bx, by, currentTipSize * random(0.2, 0.4));
        }
      }
    }
  }

  canvas.pop();
}

/**
 * Draw a realistic paint splatter (for customization panel preview)
 * Organic core with connected droplets
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the splatter
 */
export function drawSplatterCanvas(ctx, x, y, size) {
  ctx.save();

  // Simple noise function using sine waves
  const noise = (n) => {
    return (Math.sin(n * 12.9898) * 43758.5453) % 1;
  };

  // Generate droplet data first
  const numDroplets = Math.floor(size / 6) + 8;
  const droplets = [];
  for (let i = 0; i < numDroplets; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * size * 0.4 + size * 0.25;
    const dropletX = x + Math.cos(angle) * distance;
    const dropletY = y + Math.sin(angle) * distance;
    const dropletSize = (Math.random() * size * 0.08 + size * 0.05) * (1 - distance / (size * 0.8));

    droplets.push({ x: dropletX, y: dropletY, size: dropletSize, angle });
  }

  // 1. Draw connection lines FIRST (behind everything)
  const blobRadius = size * 0.2; // Match the core radius
  for (let droplet of droplets) {
    if (Math.random() < 0.7) {
      // Calculate starting point slightly inside blob edge to ensure overlap (no gap)
      const startRadius = blobRadius * 0.85;
      const edgeX = x + Math.cos(droplet.angle) * startRadius;
      const edgeY = y + Math.sin(droplet.angle) * startRadius;

      // Base width proportional to blob, tapers to droplet size
      const baseWidth = size * 0.15;

      // Draw organic blob-like connection
      const numSegments = 15;
      const perpAngle = droplet.angle + Math.PI / 2;

      ctx.globalAlpha = 0.5;
      ctx.beginPath();

      // Draw one side of the connection
      for (let i = 0; i <= numSegments; i++) {
        const t = i / numSegments;
        const cx = edgeX + (droplet.x - edgeX) * t;
        const cy = edgeY + (droplet.y - edgeY) * t;

        // Create pinch in middle: wide at blob, narrow in middle, wider at droplet
        const pinchPoint = 0.5;
        const minPinchWidth = baseWidth * 0.25; // Minimum width at pinch point
        const widthAtBlob = baseWidth;
        const widthAtDroplet = droplet.size * 0.8;

        // Distance from pinch point (0 at pinch, 0.5 at ends)
        const distFromPinch = Math.abs(t - pinchPoint);
        // Normalize to 0-1 (0 at pinch, 1 at ends)
        const pinchFactor = distFromPinch / 0.5;

        // Target width at the end we're approaching
        const targetEndWidth = t < 0.5 ? widthAtBlob : widthAtDroplet;

        // Width varies from narrow at pinch to wide at ends
        const width = baseWidth * 0.25 + (targetEndWidth - baseWidth * 0.25) * pinchFactor;

        const noiseOffset = noise(i * 0.4) * width * 0.3;
        const edgeWidth = (width / 2) + noiseOffset;

        const vx = cx + Math.cos(perpAngle) * edgeWidth;
        const vy = cy + Math.sin(perpAngle) * edgeWidth;

        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }

      // Draw back along the other side
      for (let i = numSegments; i >= 0; i--) {
        const t = i / numSegments;
        const cx = edgeX + (droplet.x - edgeX) * t;
        const cy = edgeY + (droplet.y - edgeY) * t;

        // Same pinch calculation
        const pinchPoint = 0.5;
        const minPinchWidth = baseWidth * 0.25;
        const widthAtBlob = baseWidth;
        const widthAtDroplet = droplet.size * 0.8;

        const distFromPinch = Math.abs(t - pinchPoint);
        const pinchFactor = distFromPinch / 0.5;
        const targetEndWidth = t < 0.5 ? widthAtBlob : widthAtDroplet;
        const width = baseWidth * 0.25 + (targetEndWidth - baseWidth * 0.25) * pinchFactor;

        const noiseOffset = noise(i * 0.4 + 100) * width * 0.3;
        const edgeWidth = (width / 2) + noiseOffset;

        const vx = cx - Math.cos(perpAngle) * edgeWidth;
        const vy = cy - Math.sin(perpAngle) * edgeWidth;

        ctx.lineTo(vx, vy);
      }

      ctx.closePath();
      ctx.fill();
    }
  }

  // 2. Draw organic central core (on top of connections)
  // First erase the blob area to mask connections
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  let numCorePoints = 20;
  for (let i = 0; i < numCorePoints; i++) {
    const angle = (i / numCorePoints) * Math.PI * 2;
    const radiusVariation = noise(i * 0.5) * 0.4 + 0.8;
    const r = size * 0.2 * radiusVariation;
    const vx = x + Math.cos(angle) * r;
    const vy = y + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(vx, vy);
    } else {
      ctx.lineTo(vx, vy);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Now draw the actual visible blob
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  numCorePoints = 20;
  for (let i = 0; i < numCorePoints; i++) {
    const angle = (i / numCorePoints) * Math.PI * 2;
    const radiusVariation = noise(i * 0.5) * 0.4 + 0.8;
    const r = size * 0.2 * radiusVariation;
    const vx = x + Math.cos(angle) * r;
    const vy = y + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(vx, vy);
    } else {
      ctx.lineTo(vx, vy);
    }
  }
  ctx.closePath();
  ctx.fill();

  // 3. Draw droplets and tails (on top of core)
  for (let droplet of droplets) {
    // Draw droplet
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(droplet.x, droplet.y, droplet.size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Some droplets have tails (40% chance)
    if (Math.random() < 0.4) {
      const tailLength = droplet.size * (Math.random() + 1);
      const tailAngle = droplet.angle + Math.PI;
      const tailEndX = droplet.x + Math.cos(tailAngle) * tailLength;
      const tailEndY = droplet.y + Math.sin(tailAngle) * tailLength;

      ctx.globalAlpha = 0.3;
      ctx.lineWidth = droplet.size * 0.3;
      ctx.beginPath();
      ctx.moveTo(droplet.x, droplet.y);
      ctx.lineTo(tailEndX, tailEndY);
      ctx.stroke();
    }
  }

  // 3. Add small spray dots
  const numSpray = Math.floor(size / 4) + 5;
  for (let i = 0; i < numSpray; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * size * 0.3 + size * 0.4;

    const sprayX = x + Math.cos(angle) * distance;
    const sprayY = y + Math.sin(angle) * distance;
    const spraySize = Math.random() * size * 0.03 + size * 0.01;

    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(sprayX, sprayY, spraySize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw an ink blot with organic bleeding edges (for customization panel preview)
 * @param {CanvasRenderingContext2D} ctx - 2D canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size of the ink blot
 */
export function drawInkBlotCanvas(ctx, x, y, size) {
  ctx.save();

  // Simple noise function using sine waves
  const noise = (n) => {
    return (Math.sin(n * 12.9898) * 43758.5453) % 1;
  };

  const baseRadius = size * INK_BLOT_CORE_RADIUS;

  // 1. Draw bleeding layers (from outermost to innermost)
  let currentAlpha = INK_BLOT_BLEED_ALPHA_START / 255;

  for (let layer = INK_BLOT_BLEED_LAYERS; layer > 0; layer--) {
    const spreadAmount = INK_BLOT_BLEED_SPREAD_MIN + Math.random() * (INK_BLOT_BLEED_SPREAD_MAX - INK_BLOT_BLEED_SPREAD_MIN);
    const layerRadius = baseRadius + (size * spreadAmount * layer);

    ctx.globalAlpha = currentAlpha;
    ctx.beginPath();

    const numVertices = INK_BLOT_CORE_VERTICES;
    for (let i = 0; i < numVertices; i++) {
      const angle = (i / numVertices) * Math.PI * 2;
      const noiseVal = noise(Math.cos(angle) * INK_BLOT_EDGE_NOISE_SCALE + layer * 10);
      const radiusVariation = 1 + (noiseVal - 0.5) * INK_BLOT_EDGE_NOISE_AMOUNT;
      const r = layerRadius * radiusVariation;

      const vx = x + Math.cos(angle) * r;
      const vy = y + Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }

    ctx.closePath();
    ctx.fill();

    currentAlpha *= INK_BLOT_BLEED_ALPHA_DECAY;
  }

  // 2. Draw core blob
  ctx.globalAlpha = INK_BLOT_CORE_ALPHA / 255;
  ctx.beginPath();

  const numCoreVertices = INK_BLOT_CORE_VERTICES;
  for (let i = 0; i < numCoreVertices; i++) {
    const angle = (i / numCoreVertices) * Math.PI * 2;
    const noiseVal = noise(Math.cos(angle) * INK_BLOT_EDGE_NOISE_SCALE);
    const radiusVariation = 1 + (noiseVal - 0.5) * INK_BLOT_EDGE_NOISE_AMOUNT;
    const r = baseRadius * radiusVariation;

    const vx = x + Math.cos(angle) * r;
    const vy = y + Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }

  ctx.closePath();
  ctx.fill();

  // 3. Draw feathering (organic tendrils) - ON TOP
  const featherCount = Math.floor(INK_BLOT_FEATHER_COUNT_MIN + Math.random() * (INK_BLOT_FEATHER_COUNT_MAX - INK_BLOT_FEATHER_COUNT_MIN));
  for (let i = 0; i < featherCount; i++) {
    const angle = (i / featherCount) * Math.PI * 2 + Math.random() * 0.3;
    const startDist = baseRadius * (0.6 + Math.random() * 0.3); // Start closer to center
    const length = size * (INK_BLOT_FEATHER_LENGTH_MIN + Math.random() * (INK_BLOT_FEATHER_LENGTH_MAX - INK_BLOT_FEATHER_LENGTH_MIN));
    const width = size * INK_BLOT_FEATHER_WIDTH * (0.8 + Math.random() * 0.4); // Vary width

    const startX = x + Math.cos(angle) * startDist;
    const startY = y + Math.sin(angle) * startDist;
    const endX = x + Math.cos(angle) * (startDist + length);
    const endY = y + Math.sin(angle) * (startDist + length);

    const alpha = (INK_BLOT_FEATHER_ALPHA_MIN + Math.random() * (INK_BLOT_FEATHER_ALPHA_MAX - INK_BLOT_FEATHER_ALPHA_MIN)) / 255;
    ctx.globalAlpha = alpha;

    const perpAngle = angle + Math.PI / 2;
    const numSegments = 8;

    ctx.beginPath();

    // Draw one side with tapering
    for (let j = 0; j <= numSegments; j++) {
      const t = j / numSegments;
      const cx = startX + (endX - startX) * t;
      const cy = startY + (endY - startY) * t;

      const taper = 1 - t;
      const noiseOffset = noise(j * 0.5 + i * 10) * width * 0.3;
      const edgeWidth = (width / 2) * taper + noiseOffset;

      const vx = cx + Math.cos(perpAngle) * edgeWidth;
      const vy = cy + Math.sin(perpAngle) * edgeWidth;

      if (j === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }

    // Draw back along other side
    for (let j = numSegments; j >= 0; j--) {
      const t = j / numSegments;
      const cx = startX + (endX - startX) * t;
      const cy = startY + (endY - startY) * t;

      const taper = 1 - t;
      const noiseOffset = noise(j * 0.5 + i * 10 + 100) * width * 0.3;
      const edgeWidth = (width / 2) * taper + noiseOffset;

      const vx = cx - Math.cos(perpAngle) * edgeWidth;
      const vy = cy - Math.sin(perpAngle) * edgeWidth;

      ctx.lineTo(vx, vy);
    }

    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw a brush stroke with textured bristles (for customization panel preview)
 * Matches the new textured brushstroke appearance
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

  const strokeLength = size * 2.5;
  const strokeWidth = size * 0.8;

  // Simple gaussian function
  const gaussianRandom = () => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  // Number of bristle clusters along the stroke
  const numClusters = Math.floor(strokeLength / 6) + 8;

  for (let i = 0; i < numClusters; i++) {
    const xPos = -strokeLength / 2 + (i / (numClusters - 1)) * strokeLength;

    // Pressure variation (thicker in middle) - Gaussian distribution
    const t = i / (numClusters - 1);
    const center = 0.5;
    const sigma = 0.3;
    const pressure = Math.exp(-Math.pow(t - center, 2) / (2 * sigma * sigma));
    const clusterPressure = Math.max(0.3, Math.min(1.0, pressure));

    // Height variation based on pressure (organic edges)
    const edgeHeight = strokeWidth * clusterPressure * (Math.random() * 0.2 + 0.8);

    // Each cluster has multiple bristles
    const bristlesInCluster = Math.floor(Math.random() * 6 + 4);

    for (let b = 0; b < bristlesInCluster; b++) {
      // Y position within the organic edge boundary
      const yOffset = gaussianRandom() * edgeHeight * 0.35;

      // Bristle dimensions - running PARALLEL to stroke (horizontal)
      const bristleThickness = clusterPressure * strokeWidth * (Math.random() * 0.07 + 0.08);
      const bristleLength = strokeLength * (Math.random() * 0.2 + 0.15);

      // Slight rotation variation
      const bristleRotation = gaussianRandom() * 0.08;

      // Draw bristle as elongated ellipse
      ctx.save();
      ctx.translate(xPos, yOffset);
      ctx.rotate(bristleRotation);

      // Semi-transparent for texture
      ctx.globalAlpha = Math.random() * 0.25 + 0.25;
      ctx.beginPath();
      ctx.ellipse(0, 0, bristleLength / 2, bristleThickness / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Add some finer detail lines
      if (Math.random() < 0.4) {
        ctx.globalAlpha = Math.random() * 0.15 + 0.1;
        const detailLength = bristleLength * (Math.random() * 0.3 + 0.4);
        const detailThickness = bristleThickness * (Math.random() * 0.3 + 0.3);
        const detailOffset = (Math.random() - 0.5) * detailLength * 0.5;
        ctx.beginPath();
        ctx.ellipse(detailOffset, 0, detailLength / 2, detailThickness / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  ctx.restore();
}
