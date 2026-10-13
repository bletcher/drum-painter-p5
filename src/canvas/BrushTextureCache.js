/**
 * Brush Texture Cache
 * Generates and caches brush stroke textures for realistic painting effects
 * Uses organic noise patterns and bristle simulation
 *
 * Performance design (textures are requested on EVERY drum hit):
 * - Requested sizes are quantized onto a small geometric ladder of canonical
 *   "bucket" sizes (TEXTURE_BUCKET_MIN * TEXTURE_BUCKET_RATIO^n). Callers draw the
 *   texture scaled to the exact requested size, so the visual size is unchanged.
 * - Each (kind, bucket) has a fixed pool of TEXTURE_VARIANTS seeds; callers pick
 *   a variant at random per hit (and add rotation/flip) to hide repetition.
 * - Generation parameters are read through visualStyleManager.getConstant() so
 *   MIDI CC overrides take effect. The style "generation" counter is part of the
 *   cache key, so a knob change invalidates lazily (old entries age out via LRU).
 * - Textures are created at pixelDensity(1) since they are always scaled anyway.
 * - Generation seeds p5's global RNG for reproducible variants, then always
 *   reseeds it with a fresh random value so the rest of the app stays random.
 */

import { visualStyleManager } from './VisualStyleManager.js';
import { debugLog } from '../utils/debug.js';

/** Smallest canonical texture size (px) */
export const TEXTURE_BUCKET_MIN = 16;
/** Geometric ratio between consecutive canonical sizes */
export const TEXTURE_BUCKET_RATIO = 1.25;
/** Sizes above this are clamped before quantizing (bounds texture memory) */
export const TEXTURE_BUCKET_MAX_INPUT = 360;
/** Number of random variants generated per (kind, bucket) */
export const TEXTURE_VARIANTS = 6;

const LOG_BUCKET_RATIO = Math.log(TEXTURE_BUCKET_RATIO);

/**
 * Quantize a requested size onto the canonical bucket ladder
 * @param {number} size - Requested size in pixels
 * @returns {number} Canonical (integer) bucket size
 */
export function quantizeTextureSize(size) {
  if (!(size > TEXTURE_BUCKET_MIN)) return TEXTURE_BUCKET_MIN;
  const clamped = Math.min(size, TEXTURE_BUCKET_MAX_INPUT);
  const step = Math.round(Math.log(clamped / TEXTURE_BUCKET_MIN) / LOG_BUCKET_RATIO);
  return Math.round(TEXTURE_BUCKET_MIN * Math.pow(TEXTURE_BUCKET_RATIO, step));
}

/**
 * Pick a random variant index (uses Math.random so it never touches p5's RNG)
 * @returns {number} Variant index in [0, TEXTURE_VARIANTS)
 */
export function randomTextureVariant() {
  return Math.floor(Math.random() * TEXTURE_VARIANTS);
}

/**
 * Read a (possibly MIDI-overridden) constant
 * @param {string} name - Constant name from config/constants.js
 * @returns {number}
 */
function C(name) {
  return visualStyleManager.getConstant(name);
}

/**
 * Read a MIN/MAX constant pair as a range.
 * Some MIDI mappings set both MIN and MAX to the same value; in that case the
 * override is treated as the center of a ±20% range so variation is preserved.
 * @param {string} minName - Name of the MIN constant
 * @param {string} maxName - Name of the MAX constant
 * @returns {number[]} [min, max]
 */
function range(minName, maxName) {
  const lo = C(minName);
  const hi = C(maxName);
  if (lo === hi) {
    return [lo * 0.8, hi * 1.2];
  }
  return [lo, hi];
}

/**
 * Run a texture generator with p5's global RNG seeded, always restoring
 * non-deterministic randomness afterwards (randomSeed/noiseSeed are global).
 * @param {number} seed - Seed for reproducible variant
 * @param {Function} fn - Generator function
 * @returns {*} Result of fn
 */
function withSeed(seed, fn) {
  randomSeed(seed);
  noiseSeed(seed);
  try {
    return fn();
  } finally {
    randomSeed(Math.floor(Math.random() * 2147483647));
    noiseSeed(Math.floor(Math.random() * 2147483647));
  }
}

/**
 * Create a texture graphics buffer at pixel density 1
 * @param {number} w - Width
 * @param {number} h - Height
 * @returns {p5.Graphics}
 */
function createTextureGraphics(w, h) {
  const pg = createGraphics(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
  pg.pixelDensity(1);
  return pg;
}

/**
 * Cache for brush textures
 * Generates textures on-demand and caches them by kind, bucket size and variant
 */
export class BrushTextureCache {
  constructor() {
    this.cache = new Map();
    // Textures are small and bounded (few buckets x TEXTURE_VARIANTS variants)
    this.maxCacheSize = 200;
  }

  /**
   * Look up a texture (LRU touch on hit) or generate and insert it
   * @param {string} key - Cache key
   * @param {Function} generate - Generator returning a p5.Graphics
   * @returns {p5.Graphics}
   */
  _getOrCreate(key, generate) {
    const cached = this.cache.get(key);
    if (cached) {
      // Move to the end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    const texture = generate();
    texture.textureGeneration = visualStyleManager.generation || 0;

    // Evict least recently used entries
    while (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      const oldTexture = this.cache.get(firstKey);
      if (oldTexture && oldTexture.remove) {
        oldTexture.remove(); // Free canvas memory
      }
      this.cache.delete(firstKey);
    }

    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Get or generate a brush texture.
   * Width/height are quantized to canonical bucket sizes; the returned texture
   * has textureBaseWidth/textureBaseHeight set and should be drawn scaled.
   * @param {number} width - Width of the brush stroke
   * @param {number} height - Height of the brush stroke
   * @param {number} seed - Variant index (wrapped to TEXTURE_VARIANTS)
   * @returns {p5.Graphics} Graphics buffer with brush texture
   */
  getTexture(width, height, seed = 0) {
    const bw = quantizeTextureSize(width);
    const bh = quantizeTextureSize(height);
    const variant = Math.abs(Math.floor(seed)) % TEXTURE_VARIANTS;
    const gen = visualStyleManager.generation || 0;
    const key = `brush_${bw}x${bh}_v${variant}_g${gen}`;

    return this._getOrCreate(key, () => {
      const pg = this.generateTexture(bw, bh, variant);
      pg.textureBaseWidth = bw;
      pg.textureBaseHeight = bh;
      return pg;
    });
  }

  /**
   * Get or generate a splatter texture.
   * Size is quantized; the returned texture has textureBaseSize set.
   * @param {number} size - Size of the splatter
   * @param {number} seed - Variant index (wrapped to TEXTURE_VARIANTS)
   * @returns {p5.Graphics} Graphics buffer with splatter texture
   */
  getSplatterTexture(size, seed = 0) {
    const bucket = quantizeTextureSize(size);
    const variant = Math.abs(Math.floor(seed)) % TEXTURE_VARIANTS;
    const gen = visualStyleManager.generation || 0;
    const key = `splatter_${bucket}_v${variant}_g${gen}`;

    return this._getOrCreate(key, () => {
      const pg = this.generateSplatterTexture(bucket, variant + 100);
      pg.textureBaseSize = bucket;
      return pg;
    });
  }

  /**
   * Generate a new brush texture with organic bristle patterns
   * @param {number} width - Width of the brush stroke
   * @param {number} height - Height of the brush stroke
   * @param {number} seed - Random seed for variation
   * @returns {p5.Graphics} Graphics buffer with brush texture
   */
  generateTexture(width, height, seed) {
    debugLog(`🖌️ Generating brush texture ${width}x${height} (seed ${seed})`);
    const pg = createTextureGraphics(width, height);

    return withSeed(seed, () => {
      pg.clear();

      // Create bristle-based texture
      this.drawBristlePattern(pg, width, height);

      // Add organic noise overlay
      this.addNoiseTexture(pg, width, height);

      // Add edge variation (missing bristles)
      this.addEdgeVariation(pg, width, height);

      // Apply organic edge mask AFTER all drawing is complete
      this.createOrganicEdgeMask(pg, width, height);

      return pg;
    });
  }

  /**
   * Draw individual bristle marks
   * @param {p5.Graphics} pg - Graphics buffer
   * @param {number} width - Width
   * @param {number} height - Height
   */
  drawBristlePattern(pg, width, height) {
    const spacingDivisor = C('BRUSH_CLUSTER_SPACING_DIVISOR');
    const spacingOffset = C('BRUSH_CLUSTER_SPACING_OFFSET');
    const [bristlesMin, bristlesMax] = range('BRUSH_BRISTLES_PER_CLUSTER_MIN', 'BRUSH_BRISTLES_PER_CLUSTER_MAX');
    const thicknessMin = C('BRUSH_BRISTLE_THICKNESS_MIN');
    const thicknessMax = C('BRUSH_BRISTLE_THICKNESS_MAX');
    const lengthMin = C('BRUSH_BRISTLE_LENGTH_MIN');
    const lengthMax = C('BRUSH_BRISTLE_LENGTH_MAX');
    const rotationVariation = C('BRUSH_BRISTLE_ROTATION_VARIATION');
    const [alphaMin, alphaMax] = range('BRUSH_BRISTLE_ALPHA_MIN', 'BRUSH_BRISTLE_ALPHA_MAX');
    const detailProbability = C('BRUSH_DETAIL_PROBABILITY');
    const detailAlphaMin = C('BRUSH_DETAIL_ALPHA_MIN');
    const detailAlphaMax = C('BRUSH_DETAIL_ALPHA_MAX');
    const detailLengthMin = C('BRUSH_DETAIL_LENGTH_MIN');
    const detailLengthMax = C('BRUSH_DETAIL_LENGTH_MAX');
    const detailThicknessMin = C('BRUSH_DETAIL_THICKNESS_MIN');
    const detailThicknessMax = C('BRUSH_DETAIL_THICKNESS_MAX');
    const sigma = C('BRUSH_PRESSURE_SIGMA');
    const pressureMin = C('BRUSH_PRESSURE_MIN');

    pg.push();
    pg.noStroke();

    // Number of bristle clusters along the stroke
    const numClusters = Math.floor(width / spacingDivisor) + spacingOffset;

    for (let i = 0; i < numClusters; i++) {
      const x = map(i, 0, numClusters - 1, width * 0.05, width * 0.95);

      // Pressure variation (thicker in middle)
      const t = i / (numClusters - 1);
      const center = 0.5;
      const pressure = exp(-pow(t - center, 2) / (2 * sigma * sigma));
      const clusterPressure = constrain(pressure, pressureMin, 1.0);

      // Height variation based on pressure (organic edges)
      const edgeHeight = height * clusterPressure * random(0.8, 1.0);

      // Each cluster has multiple bristles
      const bristlesInCluster = floor(random(bristlesMin, bristlesMax));

      for (let b = 0; b < bristlesInCluster; b++) {
        // Y position within the organic edge boundary
        const yOffset = randomGaussian() * edgeHeight * 0.35;
        const y = height / 2 + yOffset;

        // Bristle dimensions - running PARALLEL to stroke (horizontal)
        const bristleThickness = clusterPressure * height * random(thicknessMin, thicknessMax);
        const bristleLength = width * random(lengthMin, lengthMax); // Length along x-axis

        // Draw bristle as elongated shape parallel to stroke
        pg.push();
        pg.translate(x, y);
        pg.rotate(randomGaussian() * rotationVariation); // Slight rotation variation

        // Use WHITE with alpha so colorize can apply color properly
        pg.fill(255, 255, 255, random(alphaMin, alphaMax));
        // Width x Height - horizontal bristles parallel to stroke
        pg.ellipse(0, 0, bristleLength, bristleThickness);

        // Add some finer detail lines
        if (random(1) < detailProbability) {
          pg.fill(255, 255, 255, random(detailAlphaMin, detailAlphaMax));
          const detailLength = bristleLength * random(detailLengthMin, detailLengthMax);
          const detailThickness = bristleThickness * random(detailThicknessMin, detailThicknessMax);
          pg.ellipse(random(-detailLength/4, detailLength/4), 0, detailLength, detailThickness);
        }

        pg.pop();
      }
    }

    pg.pop();
  }

  /**
   * Create organic edge mask for the brush stroke
   * @param {p5.Graphics} pg - Graphics buffer
   * @param {number} width - Width
   * @param {number} height - Height
   */
  createOrganicEdgeMask(pg, width, height) {
    const topMin = C('BRUSH_EDGE_MASK_TOP_MIN');
    const topMax = C('BRUSH_EDGE_MASK_TOP_MAX');
    let bottomMin = C('BRUSH_EDGE_MASK_BOTTOM_MIN');
    const bottomMax = C('BRUSH_EDGE_MASK_BOTTOM_MAX');
    const leftMax = C('BRUSH_EDGE_MASK_LEFT_MAX');
    const rightMin = C('BRUSH_EDGE_MASK_RIGHT_MIN');

    // The "brushEdgeSoftness" MIDI mapping writes the same small value (0.1-0.25)
    // to both TOP_MAX and BOTTOM_MIN. For the bottom edge that value is an inset
    // from the bottom, so mirror it (default 0.85 === 1 - 0.15).
    if (bottomMin < 0.5) {
      bottomMin = 1 - bottomMin;
    }

    pg.push();
    pg.erase(255, 255); // Erase both color and alpha

    // Create irregular top edge - very aggressive
    pg.noStroke();
    pg.fill(255);
    pg.beginShape();
    pg.vertex(-20, -20); // Start well outside canvas
    const numEdgePoints = Math.floor(width / 6) + 12;
    for (let i = 0; i <= numEdgePoints; i++) {
      const x = map(i, 0, numEdgePoints, -10, width + 10);
      const noiseVal = noise(i * 0.2 + random(0, 0.2));
      // Very aggressive variation - erase deeply into the stroke
      const y = map(noiseVal, 0, 1, height * topMin, height * topMax);
      pg.vertex(x, y);
    }
    pg.vertex(width + 20, -20); // End well outside canvas
    pg.endShape(CLOSE);

    // Create irregular bottom edge - very aggressive
    pg.beginShape();
    pg.vertex(-20, height + 20); // Start well outside canvas
    for (let i = 0; i <= numEdgePoints; i++) {
      const x = map(i, 0, numEdgePoints, -10, width + 10);
      const noiseVal = noise(i * 0.2 + 100 + random(0, 0.2));
      // Very aggressive variation - erase deeply into the stroke
      const y = map(noiseVal, 0, 1, height * bottomMin, height * bottomMax);
      pg.vertex(x, y);
    }
    pg.vertex(width + 20, height + 20); // End well outside canvas
    pg.endShape(CLOSE);

    // Add additional irregular masking on left and right edges
    // Left edge - very aggressive
    pg.beginShape();
    pg.vertex(-20, -20);
    pg.vertex(-20, height + 20);
    for (let i = 0; i <= numEdgePoints; i++) {
      const y = map(i, 0, numEdgePoints, height + 10, -10);
      const noiseVal = noise(i * 0.2 + 200 + random(0, 0.2));
      const x = map(noiseVal, 0, 1, -10, width * leftMax);
      pg.vertex(x, y);
    }
    pg.endShape(CLOSE);

    // Right edge - very aggressive
    pg.beginShape();
    pg.vertex(width + 20, -20);
    pg.vertex(width + 20, height + 20);
    for (let i = 0; i <= numEdgePoints; i++) {
      const y = map(i, 0, numEdgePoints, -10, height + 10);
      const noiseVal = noise(i * 0.2 + 300 + random(0, 0.2));
      const x = map(noiseVal, 0, 1, width * rightMin, width + 10);
      pg.vertex(x, y);
    }
    pg.endShape(CLOSE);

    pg.noErase();
    pg.pop();
  }

  /**
   * Add organic noise texture overlay
   * @param {p5.Graphics} pg - Graphics buffer
   * @param {number} width - Width (logical)
   * @param {number} height - Height (logical)
   */
  addNoiseTexture(pg, width, height) {
    pg.loadPixels();

    // Index pixels using the physical backing size (defensive against density != 1)
    const density = pg.pixelDensity();
    const stride = (pg.elt && pg.elt.width) || Math.round(pg.width * density);
    const rows = (pg.elt && pg.elt.height) || Math.round(pg.height * density);
    const cols = Math.min(stride, Math.round(width * density));
    const maxRows = Math.min(rows, Math.round(height * density));
    const pixels = pg.pixels;

    const noiseScale = 0.05 / density;
    const noiseStrength = 30;

    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < maxRows; y++) {
        const idx = (x + y * stride) * 4;

        // Only add noise where there's already some alpha
        if (pixels[idx + 3] > 10) {
          const n = noise(x * noiseScale, y * noiseScale);
          const variation = (n * 2 - 1) * noiseStrength;

          // Darken based on noise (Uint8ClampedArray clamps to 0-255)
          pixels[idx] += variation;
          pixels[idx + 1] += variation;
          pixels[idx + 2] += variation;
        }
      }
    }

    pg.updatePixels();
  }

  /**
   * Add edge variation - random gaps/missing bristles
   * @param {p5.Graphics} pg - Graphics buffer
   * @param {number} width - Width
   * @param {number} height - Height
   */
  addEdgeVariation(pg, width, height) {
    pg.push();
    pg.erase();

    // Create random gaps at the ends
    const numGaps = floor(random(3, 8));

    for (let i = 0; i < numGaps; i++) {
      // Gaps more likely at the ends
      const xBias = random(1) < 0.5 ? random(0, 0.2) : random(0.8, 1);
      const x = xBias * width;
      const y = random(height);

      const gapSize = random(height * 0.1, height * 0.3);
      pg.circle(x, y, gapSize);
    }

    pg.noErase();
    pg.pop();
  }

  /**
   * Generate a realistic paint splatter texture
   * @param {number} size - Size of the splatter
   * @param {number} seed - Random seed for variation
   * @returns {p5.Graphics} Graphics buffer with splatter texture
   */
  generateSplatterTexture(size, seed) {
    debugLog(`💦 Generating splatter texture ${size} (seed ${seed})`);
    const canvasSize = Math.ceil(size * 2.5); // Extra space for droplets
    const pg = createTextureGraphics(canvasSize, canvasSize);

    return withSeed(seed, () => {
      const [dropletCountMin, dropletCountMax] = range('SPLATTER_DROPLET_COUNT_MIN', 'SPLATTER_DROPLET_COUNT_MAX');
      const dropletDistMin = C('SPLATTER_DROPLET_DISTANCE_MIN');
      const dropletDistMax = C('SPLATTER_DROPLET_DISTANCE_MAX');
      const dropletSizeMin = C('SPLATTER_DROPLET_SIZE_MIN');
      const dropletSizeMax = C('SPLATTER_DROPLET_SIZE_MAX');
      const dropletAlphaMin = C('SPLATTER_DROPLET_ALPHA_MIN');
      const dropletAlphaMax = C('SPLATTER_DROPLET_ALPHA_MAX');
      const blobRadiusFactor = C('SPLATTER_BLOB_RADIUS');
      const connectionProbability = C('SPLATTER_CONNECTION_PROBABILITY');
      const connectionStartRadius = C('SPLATTER_CONNECTION_START_RADIUS');
      const connectionBaseWidth = C('SPLATTER_CONNECTION_BASE_WIDTH');
      const strengthMin = C('SPLATTER_CONNECTION_STRENGTH_MIN');
      const strengthMax = C('SPLATTER_CONNECTION_STRENGTH_MAX');
      const tailProbability = C('SPLATTER_TAIL_PROBABILITY');
      const [sprayCountMin, sprayCountMax] = range('SPLATTER_SPRAY_COUNT_MIN', 'SPLATTER_SPRAY_COUNT_MAX');
      const sprayDistMin = C('SPLATTER_SPRAY_DISTANCE_MIN');
      const sprayDistMax = C('SPLATTER_SPRAY_DISTANCE_MAX');
      const [spraySizeMin, spraySizeMax] = range('SPLATTER_SPRAY_SIZE_MIN', 'SPLATTER_SPRAY_SIZE_MAX');
      const sprayAlphaMin = C('SPLATTER_SPRAY_ALPHA_MIN');
      const sprayAlphaMax = C('SPLATTER_SPRAY_ALPHA_MAX');

      pg.clear();

      const centerX = canvasSize / 2;
      const centerY = canvasSize / 2;

      pg.noStroke();

      // Generate droplet data first
      const numDroplets = floor(random(dropletCountMin, dropletCountMax));
      const droplets = [];
      for (let i = 0; i < numDroplets; i++) {
        const angle = random(TWO_PI);
        const distance = random(size * dropletDistMin, size * dropletDistMax);
        const dropletX = centerX + cos(angle) * distance;
        const dropletY = centerY + sin(angle) * distance;
        const dropletSize = random(size * dropletSizeMin, size * dropletSizeMax) * (1 - distance / (size * 1.2));

        droplets.push({ x: dropletX, y: dropletY, size: dropletSize, angle, distance });
      }

      // 1. Draw connection lines FIRST (so they appear behind everything)
      const blobRadius = size * blobRadiusFactor; // Match the core radius
      for (let droplet of droplets) {
        const connectionStrength = random(strengthMin, strengthMax);
        if (random(1) < connectionProbability) {
          // Start slightly inside blob edge to ensure overlap (no gap)
          const startRadius = blobRadius * connectionStartRadius;
          const edgeX = centerX + cos(droplet.angle) * startRadius;
          const edgeY = centerY + sin(droplet.angle) * startRadius;
          // Base width on blob size, will taper down to droplet
          const baseWidth = size * connectionBaseWidth;
          this.drawOrganicConnection(pg, edgeX, edgeY, droplet.x, droplet.y, baseWidth * connectionStrength, droplet.size, droplet.angle);
        }
      }

      // 2. Draw organic central core (on top of connections)
      // First erase the blob area to mask connections underneath
      pg.push();
      pg.erase(255, 255); // Erase both color and alpha
      this.drawOrganicCore(pg, centerX, centerY, blobRadius);
      pg.noErase();
      pg.pop();

      // Now draw the actual visible blob
      this.drawOrganicCore(pg, centerX, centerY, blobRadius);

      // 3. Draw droplets and tails (on top of core)
      for (let droplet of droplets) {
        pg.fill(255, 255, 255, random(dropletAlphaMin, dropletAlphaMax));
        pg.circle(droplet.x, droplet.y, droplet.size);

        // Some droplets have directional tails
        if (random(1) < tailProbability) {
          this.drawDropletTail(pg, droplet.x, droplet.y, droplet.angle, droplet.size);
        }
      }

      // 4. Add small spray dots (smaller disconnected dots)
      const numSpray = floor(random(sprayCountMin, sprayCountMax));
      for (let i = 0; i < numSpray; i++) {
        const angle = random(TWO_PI);
        const distance = random(size * sprayDistMin, size * sprayDistMax);

        const sprayX = centerX + cos(angle) * distance;
        const sprayY = centerY + sin(angle) * distance;
        const spraySize = random(size * spraySizeMin, size * spraySizeMax);

        pg.fill(255, 255, 255, random(sprayAlphaMin, sprayAlphaMax));
        pg.circle(sprayX, sprayY, spraySize);
      }

      return pg;
    });
  }

  /**
   * Draw organic central core (irregular blob, not circle)
   */
  drawOrganicCore(pg, x, y, radius) {
    const numPoints = C('SPLATTER_BLOB_CORE_POINTS');
    const variation = C('SPLATTER_BLOB_RADIUS_VARIATION');

    pg.push();
    pg.translate(x, y);

    pg.fill(255, 255, 255, C('SPLATTER_BLOB_ALPHA'));
    pg.beginShape();

    for (let i = 0; i < numPoints; i++) {
      const angle = map(i, 0, numPoints, 0, TWO_PI);
      // Use noise for organic variation (default 0.8 to 1.2)
      const radiusVariation = noise(i * 0.5) * variation + (1 - variation / 2);
      const r = radius * radiusVariation;
      const vx = cos(angle) * r;
      const vy = sin(angle) * r;
      pg.vertex(vx, vy);
    }

    pg.endShape(CLOSE);
    pg.pop();
  }

  /**
   * Draw organic blob-like connection from edge of blob to droplet
   * Creates an irregular, organic shape like paint flowing
   * Tapers from wide at blob (baseWidth) to narrow at droplet (dropletSize)
   */
  drawOrganicConnection(pg, x1, y1, x2, y2, baseWidth, dropletSize, angle) {
    const pinchWidthFactor = C('SPLATTER_CONNECTION_PINCH_WIDTH');

    pg.push();

    const numSegments = 15;

    // Calculate perpendicular angle for width
    const perpAngle = angle + HALF_PI;
    const perpCos = cos(perpAngle);
    const perpSin = sin(perpAngle);

    // Pinch in middle: wide at blob, narrow in middle, wider at droplet
    const pinchPoint = 0.5;
    const minPinchWidth = baseWidth * pinchWidthFactor; // Minimum width at pinch point
    const widthAtBlob = baseWidth;
    const widthAtDroplet = dropletSize * 0.8;

    // Build organic shape with irregular edges
    pg.fill(255, 255, 255, random(C('SPLATTER_CONNECTION_ALPHA_MIN'), C('SPLATTER_CONNECTION_ALPHA_MAX')));
    pg.noStroke();
    pg.beginShape();

    // Draw one side of the connection (with noise variation)
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const cx = lerp(x1, x2, t);
      const cy = lerp(y1, y2, t);

      // Normalized distance from pinch point (0 at pinch, 1 at ends)
      const pinchFactor = abs(t - pinchPoint) / 0.5;
      const targetEndWidth = t < 0.5 ? widthAtBlob : widthAtDroplet;
      const width = lerp(minPinchWidth, targetEndWidth, pinchFactor);

      // Add organic noise variation to edge
      const noiseOffset = noise(i * 0.4) * width * 0.3;
      const edgeWidth = (width / 2) + noiseOffset;

      pg.vertex(cx + perpCos * edgeWidth, cy + perpSin * edgeWidth);
    }

    // Draw back along the other side (with different noise)
    for (let i = numSegments; i >= 0; i--) {
      const t = i / numSegments;
      const cx = lerp(x1, x2, t);
      const cy = lerp(y1, y2, t);

      const pinchFactor = abs(t - pinchPoint) / 0.5;
      const targetEndWidth = t < 0.5 ? widthAtBlob : widthAtDroplet;
      const width = lerp(minPinchWidth, targetEndWidth, pinchFactor);

      // Different noise offset for opposite edge
      const noiseOffset = noise(i * 0.4 + 100) * width * 0.3;
      const edgeWidth = (width / 2) + noiseOffset;

      pg.vertex(cx - perpCos * edgeWidth, cy - perpSin * edgeWidth);
    }

    pg.endShape(CLOSE);
    pg.pop();
  }

  /**
   * Draw directional tail on droplet (like it's flying through air)
   */
  drawDropletTail(pg, x, y, angle, size) {
    const tailLength = random(size * 0.8, size * 1.5);
    const tailAngle = angle + PI; // Opposite direction of travel

    const tailEndX = x + cos(tailAngle) * tailLength;
    const tailEndY = y + sin(tailAngle) * tailLength;

    // Draw tapered tail
    const numSegments = 5;
    for (let i = 0; i < numSegments; i++) {
      const t = i / numSegments;
      const tx = lerp(x, tailEndX, t);
      const ty = lerp(y, tailEndY, t);
      const tailThickness = size * (1 - t) * 0.3;

      pg.fill(255, 255, 255, (1 - t) * 120);
      pg.circle(tx, ty, tailThickness);
    }
  }

  /**
   * Get or generate an ink blot texture.
   * Size is quantized; the returned texture has textureBaseSize set.
   * @param {number} size - Size of the ink blot
   * @param {number} seed - Variant index (wrapped to TEXTURE_VARIANTS)
   * @returns {p5.Graphics} Graphics buffer with ink blot texture
   */
  getInkBlotTexture(size, seed = 0) {
    const bucket = quantizeTextureSize(size);
    const variant = Math.abs(Math.floor(seed)) % TEXTURE_VARIANTS;
    const gen = visualStyleManager.generation || 0;
    const key = `inkblot_${bucket}_v${variant}_g${gen}`;

    return this._getOrCreate(key, () => {
      const pg = this.generateInkBlotTexture(bucket, variant + 200);
      pg.textureBaseSize = bucket;
      return pg;
    });
  }

  /**
   * Generate an ink blot texture with organic bleeding edges
   * @param {number} size - Size of the ink blot
   * @param {number} seed - Random seed for variation
   * @returns {p5.Graphics} Graphics buffer with ink blot texture
   */
  generateInkBlotTexture(size, seed) {
    debugLog(`🖋️ Generating ink blot texture ${size} (seed ${seed})`);

    const coreRadius = C('INK_BLOT_CORE_RADIUS');
    const coreAlpha = C('INK_BLOT_CORE_ALPHA');
    const bleedLayers = C('INK_BLOT_BLEED_LAYERS');
    const bleedSpreadMin = C('INK_BLOT_BLEED_SPREAD_MIN');
    const bleedSpreadMax = C('INK_BLOT_BLEED_SPREAD_MAX');
    const bleedAlphaStart = C('INK_BLOT_BLEED_ALPHA_START');
    const bleedAlphaDecay = C('INK_BLOT_BLEED_ALPHA_DECAY');
    const edgeNoiseAmount = C('INK_BLOT_EDGE_NOISE_AMOUNT');
    const featherCountMin = C('INK_BLOT_FEATHER_COUNT_MIN');
    const featherCountMax = C('INK_BLOT_FEATHER_COUNT_MAX');
    const featherLengthMin = C('INK_BLOT_FEATHER_LENGTH_MIN');
    const featherLengthMax = C('INK_BLOT_FEATHER_LENGTH_MAX');
    const featherWidth = C('INK_BLOT_FEATHER_WIDTH');
    const featherAlphaMin = C('INK_BLOT_FEATHER_ALPHA_MIN');
    const featherAlphaMax = C('INK_BLOT_FEATHER_ALPHA_MAX');

    // Calculate buffer size to fit everything without truncation
    const baseRadius = size * coreRadius;
    const maxBleedRadius = baseRadius + (size * bleedSpreadMax * bleedLayers);
    const maxFeatherExtent = maxBleedRadius + (size * featherLengthMax);
    const edgeNoiseMargin = maxFeatherExtent * edgeNoiseAmount;
    const bufferSize = Math.ceil((maxFeatherExtent + edgeNoiseMargin) * 2.2); // 2.2x for safety margin

    const pg = createTextureGraphics(bufferSize, bufferSize);
    const centerX = bufferSize / 2;
    const centerY = bufferSize / 2;

    return withSeed(seed, () => {
      pg.clear();
      pg.noStroke();

      // 1. Draw bleeding layers (from outermost to innermost for proper layering)
      let currentAlpha = bleedAlphaStart;

      for (let layer = bleedLayers; layer > 0; layer--) {
        const spreadAmount = random(bleedSpreadMin, bleedSpreadMax);
        const layerRadius = baseRadius + (size * spreadAmount * layer);

        pg.fill(255, 255, 255, currentAlpha);
        this.drawOrganicBlob(pg, centerX, centerY, layerRadius, seed + layer);

        currentAlpha *= bleedAlphaDecay;
      }

      // 2. Draw core blob
      pg.fill(255, 255, 255, coreAlpha);
      this.drawOrganicBlob(pg, centerX, centerY, baseRadius, seed);

      // 3. Draw feathering (organic tendrils extending from edges) - ON TOP
      const featherCount = floor(random(featherCountMin, featherCountMax));
      for (let i = 0; i < featherCount; i++) {
        const angle = (i / featherCount) * TWO_PI + random(-0.3, 0.3);
        const startDist = baseRadius * random(0.6, 0.9); // Start closer to center so they're visible
        const length = size * random(featherLengthMin, featherLengthMax);
        const width = size * featherWidth * random(0.8, 1.2); // Vary width
        const alpha = random(featherAlphaMin, featherAlphaMax);

        const startX = centerX + cos(angle) * startDist;
        const startY = centerY + sin(angle) * startDist;
        const endX = centerX + cos(angle) * (startDist + length);
        const endY = centerY + sin(angle) * (startDist + length);

        this.drawFeatherTendril(pg, startX, startY, endX, endY, width, alpha, seed + i + 1000);
      }

      return pg;
    });
  }

  /**
   * Draw an organic blob shape with noise-based edge variation
   */
  drawOrganicBlob(pg, x, y, radius, seed) {
    const numVertices = C('INK_BLOT_CORE_VERTICES');
    const noiseScale = C('INK_BLOT_EDGE_NOISE_SCALE');
    const noiseAmount = C('INK_BLOT_EDGE_NOISE_AMOUNT');

    pg.push();
    pg.beginShape();

    for (let i = 0; i < numVertices; i++) {
      const angle = (i / numVertices) * TWO_PI;
      const noiseVal = noise(
        cos(angle) * noiseScale + seed,
        sin(angle) * noiseScale + seed
      );
      const radiusVariation = 1 + (noiseVal - 0.5) * noiseAmount;
      const r = radius * radiusVariation;

      const vx = x + cos(angle) * r;
      const vy = y + sin(angle) * r;
      pg.vertex(vx, vy);
    }

    pg.endShape(CLOSE);
    pg.pop();
  }

  /**
   * Draw a feathered tendril extending from the edge
   */
  drawFeatherTendril(pg, x1, y1, x2, y2, width, alpha, seed) {
    pg.push();
    pg.fill(255, 255, 255, alpha);

    const angle = atan2(y2 - y1, x2 - x1);
    const perpAngle = angle + HALF_PI;
    const numSegments = 8;

    pg.beginShape();

    // Draw one side with tapering
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const cx = lerp(x1, x2, t);
      const cy = lerp(y1, y2, t);

      // Taper: wider at start, narrow at end
      const taper = 1 - t;
      const noiseOffset = noise(i * 0.5 + seed) * width * 0.3;
      const edgeWidth = (width / 2) * taper + noiseOffset;

      const edgeX = cx + cos(perpAngle) * edgeWidth;
      const edgeY = cy + sin(perpAngle) * edgeWidth;
      pg.vertex(edgeX, edgeY);
    }

    // Draw back along other side
    for (let i = numSegments; i >= 0; i--) {
      const t = i / numSegments;
      const cx = lerp(x1, x2, t);
      const cy = lerp(y1, y2, t);

      const taper = 1 - t;
      const noiseOffset = noise(i * 0.5 + seed + 100) * width * 0.3;
      const edgeWidth = (width / 2) * taper + noiseOffset;

      const edgeX = cx - cos(perpAngle) * edgeWidth;
      const edgeY = cy - sin(perpAngle) * edgeWidth;
      pg.vertex(edgeX, edgeY);
    }

    pg.endShape(CLOSE);
    pg.pop();
  }

  /**
   * Remove textures generated under an older visual-style generation
   * (called debounced by VisualStyleManager after MIDI CC changes settle)
   * @param {number} currentGeneration - Generation to keep
   */
  evictStaleGenerations(currentGeneration) {
    let removed = 0;
    for (const [key, texture] of this.cache) {
      if (texture && texture.textureGeneration !== currentGeneration) {
        if (texture.remove) {
          texture.remove(); // Free canvas memory
        }
        this.cache.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      debugLog(`🗑️ Evicted ${removed} stale textures`);
    }
  }

  /**
   * Clear the entire cache and dispose all graphics objects
   */
  clearCache() {
    // Dispose all graphics objects before clearing
    for (const texture of this.cache.values()) {
      if (texture && texture.remove) {
        texture.remove(); // Free canvas memory
      }
    }
    this.cache.clear();
  }
}

// Singleton instance
let brushCacheInstance = null;

/**
 * Get the global brush texture cache instance
 * @returns {BrushTextureCache}
 */
export function getBrushTextureCache() {
  if (!brushCacheInstance) {
    brushCacheInstance = new BrushTextureCache();
  }
  return brushCacheInstance;
}
