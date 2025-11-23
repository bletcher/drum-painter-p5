/**
 * Brush Texture Cache
 * Generates and caches brush stroke textures for realistic painting effects
 * Uses organic noise patterns and bristle simulation
 */

import {
  BRUSH_CLUSTER_SPACING_DIVISOR,
  BRUSH_CLUSTER_SPACING_OFFSET,
  BRUSH_BRISTLES_PER_CLUSTER_MIN,
  BRUSH_BRISTLES_PER_CLUSTER_MAX,
  BRUSH_BRISTLE_THICKNESS_MIN,
  BRUSH_BRISTLE_THICKNESS_MAX,
  BRUSH_BRISTLE_LENGTH_MIN,
  BRUSH_BRISTLE_LENGTH_MAX,
  BRUSH_BRISTLE_ROTATION_VARIATION,
  BRUSH_BRISTLE_ALPHA_MIN,
  BRUSH_BRISTLE_ALPHA_MAX,
  BRUSH_DETAIL_PROBABILITY,
  BRUSH_DETAIL_ALPHA_MIN,
  BRUSH_DETAIL_ALPHA_MAX,
  BRUSH_DETAIL_LENGTH_MIN,
  BRUSH_DETAIL_LENGTH_MAX,
  BRUSH_DETAIL_THICKNESS_MIN,
  BRUSH_DETAIL_THICKNESS_MAX,
  BRUSH_PRESSURE_SIGMA,
  BRUSH_PRESSURE_MIN,
  BRUSH_EDGE_MASK_TOP_MIN,
  BRUSH_EDGE_MASK_TOP_MAX,
  BRUSH_EDGE_MASK_BOTTOM_MIN,
  BRUSH_EDGE_MASK_BOTTOM_MAX,
  BRUSH_EDGE_MASK_LEFT_MAX,
  BRUSH_EDGE_MASK_RIGHT_MIN,
  SPLATTER_DROPLET_COUNT_MIN,
  SPLATTER_DROPLET_COUNT_MAX,
  SPLATTER_DROPLET_DISTANCE_MIN,
  SPLATTER_DROPLET_DISTANCE_MAX,
  SPLATTER_DROPLET_SIZE_MIN,
  SPLATTER_DROPLET_SIZE_MAX,
  SPLATTER_DROPLET_ALPHA_MIN,
  SPLATTER_DROPLET_ALPHA_MAX,
  SPLATTER_BLOB_RADIUS,
  SPLATTER_BLOB_ALPHA,
  SPLATTER_BLOB_CORE_POINTS,
  SPLATTER_BLOB_RADIUS_VARIATION,
  SPLATTER_CONNECTION_PROBABILITY,
  SPLATTER_CONNECTION_START_RADIUS,
  SPLATTER_CONNECTION_BASE_WIDTH,
  SPLATTER_CONNECTION_STRENGTH_MIN,
  SPLATTER_CONNECTION_STRENGTH_MAX,
  SPLATTER_CONNECTION_PINCH_WIDTH,
  SPLATTER_CONNECTION_ALPHA_MIN,
  SPLATTER_CONNECTION_ALPHA_MAX,
  SPLATTER_TAIL_PROBABILITY,
  SPLATTER_SPRAY_COUNT_MIN,
  SPLATTER_SPRAY_COUNT_MAX,
  SPLATTER_SPRAY_DISTANCE_MIN,
  SPLATTER_SPRAY_DISTANCE_MAX,
  SPLATTER_SPRAY_SIZE_MIN,
  SPLATTER_SPRAY_SIZE_MAX,
  SPLATTER_SPRAY_ALPHA_MIN,
  SPLATTER_SPRAY_ALPHA_MAX,
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

/**
 * Cache for brush textures
 * Generates textures on-demand and caches them by size
 */
export class BrushTextureCache {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 50; // Limit cache to prevent memory issues
  }

  /**
   * Get or generate a brush texture
   * @param {number} width - Width of the brush stroke
   * @param {number} height - Height of the brush stroke
   * @param {number} seed - Random seed for variation
   * @returns {p5.Graphics} Graphics buffer with brush texture
   */
  getTexture(width, height, seed = 0) {
    const key = `brush_${Math.round(width)}_${Math.round(height)}_${seed}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const texture = this.generateTexture(width, height, seed);

    // Add to cache with size limit
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Get or generate a splatter texture
   * @param {number} size - Size of the splatter
   * @param {number} seed - Random seed for variation
   * @returns {p5.Graphics} Graphics buffer with splatter texture
   */
  getSplatterTexture(size, seed = 0) {
    const key = `splatter_${Math.round(size)}_${seed}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const texture = this.generateSplatterTexture(size, seed);

    // Add to cache with size limit
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Generate a new brush texture with organic bristle patterns
   * @param {number} width - Width of the brush stroke
   * @param {number} height - Height of the brush stroke
   * @param {number} seed - Random seed for variation
   * @returns {p5.Graphics} Graphics buffer with brush texture
   */
  generateTexture(width, height, seed) {
    const pg = createGraphics(Math.ceil(width), Math.ceil(height));

    randomSeed(seed);
    noiseSeed(seed);

    pg.clear();
    pg.background(255, 255, 255, 0); // Transparent background

    // Create bristle-based texture
    this.drawBristlePattern(pg, width, height);

    // Add organic noise overlay
    this.addNoiseTexture(pg, width, height);

    // Add edge variation (missing bristles)
    this.addEdgeVariation(pg, width, height);

    // Apply organic edge mask AFTER all drawing is complete
    this.createOrganicEdgeMask(pg, width, height);

    return pg;
  }

  /**
   * Draw individual bristle marks
   * @param {p5.Graphics} pg - Graphics buffer
   * @param {number} width - Width
   * @param {number} height - Height
   */
  drawBristlePattern(pg, width, height) {
    pg.push();
    pg.noStroke();

    // Number of bristle clusters along the stroke
    const numClusters = Math.floor(width / 6) + 8;

    for (let i = 0; i < numClusters; i++) {
      const x = map(i, 0, numClusters - 1, width * 0.05, width * 0.95);

      // Pressure variation (thicker in middle)
      const t = i / (numClusters - 1);
      const center = 0.5;
      const sigma = 0.3;
      const pressure = exp(-pow(t - center, 2) / (2 * sigma * sigma));
      const clusterPressure = constrain(pressure, 0.3, 1.0);

      // Height variation based on pressure (organic edges)
      const edgeHeight = height * clusterPressure * random(0.8, 1.0);

      // Each cluster has multiple bristles
      const bristlesInCluster = floor(random(4, 10));

      for (let b = 0; b < bristlesInCluster; b++) {
        // Y position within the organic edge boundary
        const yOffset = randomGaussian() * edgeHeight * 0.35;
        const y = height / 2 + yOffset;

        // Bristle dimensions - running PARALLEL to stroke (horizontal)
        const bristleThickness = clusterPressure * height * random(0.08, 0.15);
        const bristleLength = width * random(0.15, 0.35); // Length along x-axis

        // Draw bristle as elongated shape parallel to stroke
        pg.push();
        pg.translate(x, y);
        pg.rotate(randomGaussian() * 0.08); // Slight rotation variation

        // Use WHITE with alpha so tint() can apply color properly
        pg.fill(255, 255, 255, random(60, 120));
        // Width x Height - horizontal bristles parallel to stroke
        pg.ellipse(0, 0, bristleLength, bristleThickness);

        // Add some finer detail lines
        if (random(1) < 0.4) {
          pg.fill(255, 255, 255, random(20, 50));
          const detailLength = bristleLength * random(0.4, 0.7);
          const detailThickness = bristleThickness * random(0.3, 0.6);
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
      const y = map(noiseVal, 0, 1, -height * 0.7, height * 0.15);
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
      const y = map(noiseVal, 0, 1, height * 0.85, height * 1.7);
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
      const x = map(noiseVal, 0, 1, -10, width * 0.15);
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
      const x = map(noiseVal, 0, 1, width * 0.85, width + 10);
      pg.vertex(x, y);
    }
    pg.endShape(CLOSE);

    pg.noErase();
    pg.pop();
  }

  /**
   * Add organic noise texture overlay
   * @param {p5.Graphics} pg - Graphics buffer
   * @param {number} width - Width
   * @param {number} height - Height
   */
  addNoiseTexture(pg, width, height) {
    pg.loadPixels();

    const noiseScale = 0.05;
    const noiseStrength = 30;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const idx = (x + y * width) * 4;

        // Only add noise where there's already some alpha
        if (pg.pixels[idx + 3] > 10) {
          const n = noise(x * noiseScale, y * noiseScale);
          const variation = map(n, 0, 1, -noiseStrength, noiseStrength);

          // Darken based on noise
          pg.pixels[idx] = constrain(pg.pixels[idx] + variation, 0, 255);
          pg.pixels[idx + 1] = constrain(pg.pixels[idx + 1] + variation, 0, 255);
          pg.pixels[idx + 2] = constrain(pg.pixels[idx + 2] + variation, 0, 255);
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
    const canvasSize = Math.ceil(size * 2.5); // Extra space for droplets
    const pg = createGraphics(canvasSize, canvasSize);

    randomSeed(seed);
    noiseSeed(seed);

    pg.clear();
    pg.background(255, 255, 255, 0);

    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    pg.noStroke();

    // Generate droplet data first
    const numDroplets = floor(random(12, 25));
    const droplets = [];
    for (let i = 0; i < numDroplets; i++) {
      const angle = random(TWO_PI);
      const distance = random(size * 0.5, size * 1.0);
      const dropletX = centerX + cos(angle) * distance;
      const dropletY = centerY + sin(angle) * distance;
      const dropletSize = random(size * 0.08, size * 0.2) * (1 - distance / (size * 1.2));

      droplets.push({ x: dropletX, y: dropletY, size: dropletSize, angle, distance });
    }

    // 1. Draw connection lines FIRST (so they appear behind everything)
    const blobRadius = size * 0.4; // Match the core radius
    for (let droplet of droplets) {
      const connectionStrength = random(0.5, 1.0);
      if (random(1) < 0.7) { // 70% of droplets have visible connections
        // Calculate starting point slightly inside blob edge to ensure overlap (no gap)
        const startRadius = blobRadius * 0.85; // Start inside blob to prevent gaps
        const edgeX = centerX + cos(droplet.angle) * startRadius;
        const edgeY = centerY + sin(droplet.angle) * startRadius;
        // Draw organic blob-like connection from edge to droplet
        // Base width on blob size, will taper down to droplet
        const baseWidth = size * 0.1; // Width at blob end (proportional to blob)
        this.drawOrganicConnection(pg, edgeX, edgeY, droplet.x, droplet.y, baseWidth * connectionStrength, droplet.size, droplet.angle);
      }
    }

    // 2. Draw organic central core (on top of connections)
    // First erase the blob area to mask connections underneath
    pg.push();
    pg.erase(255, 255); // Erase both color and alpha
    this.drawOrganicCore(pg, centerX, centerY, size * 0.4);
    pg.noErase();
    pg.pop();

    // Now draw the actual visible blob
    this.drawOrganicCore(pg, centerX, centerY, size * 0.4);

    // 3. Draw droplets and tails (on top of core)
    for (let droplet of droplets) {
      // Draw droplet
      pg.fill(255, 255, 255, random(100, 180));
      pg.circle(droplet.x, droplet.y, droplet.size);

      // Some droplets have directional tails
      if (random(1) < 0.4) {
        this.drawDropletTail(pg, droplet.x, droplet.y, droplet.angle, droplet.size);
      }
    }

    // 3. Add small spray dots (smaller disconnected dots)
    const numSpray = floor(random(15, 30));
    for (let i = 0; i < numSpray; i++) {
      const angle = random(TWO_PI);
      const distance = random(size * 0.8, size * 1.3);

      const sprayX = centerX + cos(angle) * distance;
      const sprayY = centerY + sin(angle) * distance;
      const spraySize = random(size * 0.02, size * 0.06);

      pg.fill(255, 255, 255, random(60, 120));
      pg.circle(sprayX, sprayY, spraySize);
    }

    return pg;
  }

  /**
   * Draw organic central core (irregular blob, not circle)
   */
  drawOrganicCore(pg, x, y, radius) {
    pg.push();
    pg.translate(x, y);

    pg.fill(255, 255, 255, 200);
    pg.beginShape();

    const numPoints = 20;
    for (let i = 0; i < numPoints; i++) {
      const angle = map(i, 0, numPoints, 0, TWO_PI);
      // Use noise for organic variation
      const radiusVariation = noise(i * 0.5) * 0.4 + 0.8; // 0.8 to 1.2
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
    pg.push();

    const numSegments = 15;

    // Calculate perpendicular angle for width
    const perpAngle = angle + HALF_PI;

    // Build organic shape with irregular edges
    pg.fill(255, 255, 255, random(100, 160));
    pg.noStroke();
    pg.beginShape();

    // Draw one side of the connection (with noise variation)
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      const cx = lerp(x1, x2, t);
      const cy = lerp(y1, y2, t);

      // Create pinch in middle: wide at blob, narrow in middle, wider at droplet
      const pinchPoint = 0.5;
      const minPinchWidth = baseWidth * 0.25; // Minimum width at pinch point
      const widthAtBlob = baseWidth;
      const widthAtDroplet = dropletSize * 0.8;

      // Distance from pinch point (0 at pinch, 0.5 at ends)
      const distFromPinch = abs(t - pinchPoint);
      // Normalize to 0-1 (0 at pinch, 1 at ends)
      const pinchFactor = distFromPinch / 0.5;

      // Target width at the end we're approaching
      const targetEndWidth = t < 0.5 ? widthAtBlob : widthAtDroplet;

      // Width varies from narrow at pinch to wide at ends
      const width = lerp(minPinchWidth, targetEndWidth, pinchFactor);

      // Add organic noise variation to edge
      const noiseOffset = noise(i * 0.4) * width * 0.3;
      const edgeWidth = (width / 2) + noiseOffset;

      const edgeX = cx + cos(perpAngle) * edgeWidth;
      const edgeY = cy + sin(perpAngle) * edgeWidth;
      pg.vertex(edgeX, edgeY);
    }

    // Draw back along the other side (with different noise)
    for (let i = numSegments; i >= 0; i--) {
      const t = i / numSegments;
      const cx = lerp(x1, x2, t);
      const cy = lerp(y1, y2, t);

      // Same pinch calculation
      const pinchPoint = 0.5;
      const minPinchWidth = baseWidth * 0.25;
      const widthAtBlob = baseWidth;
      const widthAtDroplet = dropletSize * 0.8;

      const distFromPinch = abs(t - pinchPoint);
      const pinchFactor = distFromPinch / 0.5;
      const targetEndWidth = t < 0.5 ? widthAtBlob : widthAtDroplet;
      const width = lerp(minPinchWidth, targetEndWidth, pinchFactor);

      // Different noise offset for opposite edge
      const noiseOffset = noise(i * 0.4 + 100) * width * 0.3;
      const edgeWidth = (width / 2) + noiseOffset;

      const edgeX = cx - cos(perpAngle) * edgeWidth;
      const edgeY = cy - sin(perpAngle) * edgeWidth;
      pg.vertex(edgeX, edgeY);
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
   * Get or generate an ink blot texture
   * @param {number} size - Size of the ink blot
   * @param {number} seed - Random seed for variation
   * @returns {p5.Graphics} Graphics buffer with ink blot texture
   */
  getInkBlotTexture(size, seed = 0) {
    const key = `inkblot_${Math.round(size)}_${seed}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const texture = this.generateInkBlotTexture(size, seed);

    // Add to cache with size limit
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Generate an ink blot texture with organic bleeding edges
   * @param {number} size - Size of the ink blot
   * @param {number} seed - Random seed for variation
   * @returns {p5.Graphics} Graphics buffer with ink blot texture
   */
  generateInkBlotTexture(size, seed) {
    randomSeed(seed);
    noiseSeed(seed);

    // Calculate buffer size to fit everything without truncation
    const baseRadius = size * INK_BLOT_CORE_RADIUS;
    const maxBleedRadius = baseRadius + (size * INK_BLOT_BLEED_SPREAD_MAX * INK_BLOT_BLEED_LAYERS);
    const maxFeatherExtent = maxBleedRadius + (size * INK_BLOT_FEATHER_LENGTH_MAX);
    const edgeNoiseMargin = maxFeatherExtent * INK_BLOT_EDGE_NOISE_AMOUNT;
    const bufferSize = Math.ceil((maxFeatherExtent + edgeNoiseMargin) * 2.2); // 2.2x for safety margin

    const pg = createGraphics(bufferSize, bufferSize);
    const centerX = bufferSize / 2;
    const centerY = bufferSize / 2;

    pg.clear();
    pg.noStroke();

    // 1. Draw bleeding layers (from outermost to innermost for proper layering)
    let currentAlpha = INK_BLOT_BLEED_ALPHA_START;

    for (let layer = INK_BLOT_BLEED_LAYERS; layer > 0; layer--) {
      const spreadAmount = random(INK_BLOT_BLEED_SPREAD_MIN, INK_BLOT_BLEED_SPREAD_MAX);
      const layerRadius = baseRadius + (size * spreadAmount * layer);

      pg.fill(255, 255, 255, currentAlpha);
      this.drawOrganicBlob(pg, centerX, centerY, layerRadius, seed + layer);

      currentAlpha *= INK_BLOT_BLEED_ALPHA_DECAY;
    }

    // 2. Draw core blob
    pg.fill(255, 255, 255, INK_BLOT_CORE_ALPHA);
    this.drawOrganicBlob(pg, centerX, centerY, baseRadius, seed);

    // 3. Draw feathering (organic tendrils extending from edges) - ON TOP
    const featherCount = floor(random(INK_BLOT_FEATHER_COUNT_MIN, INK_BLOT_FEATHER_COUNT_MAX));
    for (let i = 0; i < featherCount; i++) {
      const angle = (i / featherCount) * TWO_PI + random(-0.3, 0.3);
      const startDist = baseRadius * random(0.6, 0.9); // Start closer to center so they're visible
      const length = size * random(INK_BLOT_FEATHER_LENGTH_MIN, INK_BLOT_FEATHER_LENGTH_MAX);
      const width = size * INK_BLOT_FEATHER_WIDTH * random(0.8, 1.2); // Vary width
      const alpha = random(INK_BLOT_FEATHER_ALPHA_MIN, INK_BLOT_FEATHER_ALPHA_MAX);

      const startX = centerX + cos(angle) * startDist;
      const startY = centerY + sin(angle) * startDist;
      const endX = centerX + cos(angle) * (startDist + length);
      const endY = centerY + sin(angle) * (startDist + length);

      this.drawFeatherTendril(pg, startX, startY, endX, endY, width, alpha, seed + i + 1000);
    }

    return pg;
  }

  /**
   * Draw an organic blob shape with noise-based edge variation
   */
  drawOrganicBlob(pg, x, y, radius, seed) {
    pg.push();
    pg.beginShape();

    for (let i = 0; i < INK_BLOT_CORE_VERTICES; i++) {
      const angle = (i / INK_BLOT_CORE_VERTICES) * TWO_PI;
      const noiseVal = noise(
        cos(angle) * INK_BLOT_EDGE_NOISE_SCALE + seed,
        sin(angle) * INK_BLOT_EDGE_NOISE_SCALE + seed
      );
      const radiusVariation = 1 + (noiseVal - 0.5) * INK_BLOT_EDGE_NOISE_AMOUNT;
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
   * Clear the entire cache
   */
  clearCache() {
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
