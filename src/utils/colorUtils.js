/**
 * Color utility for getting drum color with hue variation applied.
 * Uses the already-resolved settings object to avoid redundant drum lookups.
 * HSB math is done in plain JS (no colorMode/push/pop per hit).
 */

import { applyScalingCurve } from './scaling.js';

/** Cache of parsed base colors: color string -> { r, g, b, a, h, s, v } */
const baseColorCache = new Map();
const BASE_COLOR_CACHE_LIMIT = 64;

/**
 * Convert RGB (0-255) to HSB/HSV (h: 0-360, s: 0-1, v: 0-1)
 * Matches p5's color conversion (hue()/saturation()/brightness() in HSB mode)
 * @param {number} r - Red
 * @param {number} g - Green
 * @param {number} b - Blue
 * @returns {number[]} [h, s, v]
 */
function rgbToHsb(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const chroma = max - min;
  let h = 0;
  let s = 0;

  if (chroma !== 0) {
    s = chroma / max;
    if (rn === max) {
      h = (gn - bn) / chroma;
    } else if (gn === max) {
      h = 2 + (bn - rn) / chroma;
    } else {
      h = 4 + (rn - gn) / chroma;
    }
    if (h < 0) {
      h += 6;
    } else if (h >= 6) {
      h -= 6;
    }
  }

  return [h * 60, s, max];
}

/**
 * Convert HSB/HSV (h: 0-360, s: 0-1, v: 0-1) to RGB (0-255)
 * Same sector formula as p5's hsbaToRGBA
 * @param {number} h - Hue in degrees
 * @param {number} s - Saturation 0-1
 * @param {number} v - Brightness 0-1
 * @returns {number[]} [r, g, b]
 */
function hsbToRgb(h, s, v) {
  let rn, gn, bn;
  if (s === 0) {
    rn = gn = bn = v;
  } else {
    const hue = (h / 360) * 6;
    const sector = Math.floor(hue);
    const tint1 = v * (1 - s);
    const tint2 = v * (1 - s * (hue - sector));
    const tint3 = v * (1 - s * (1 + sector - hue));
    switch (sector) {
      case 1: rn = tint2; gn = v; bn = tint1; break;
      case 2: rn = tint1; gn = v; bn = tint3; break;
      case 3: rn = tint1; gn = tint2; bn = v; break;
      case 4: rn = tint3; gn = tint1; bn = v; break;
      case 5: rn = v; gn = tint1; bn = tint2; break;
      default: rn = v; gn = tint3; bn = tint1; break;
    }
  }
  return [rn * 255, gn * 255, bn * 255];
}

/**
 * Parse a base color (string or p5.Color) once and cache its RGB/HSB values
 * @param {string|p5.Color} colorValue - Base color from settings
 * @returns {Object} { r, g, b, a, h, s, v }
 */
function getBaseColor(colorValue) {
  const isString = typeof colorValue === 'string';
  if (isString) {
    const cached = baseColorCache.get(colorValue);
    if (cached) return cached;
  }

  // Let p5 parse any supported format once (hex, rgb(), named colors...)
  const levels = (colorValue && colorValue.levels) ? colorValue.levels : color(colorValue).levels;
  const [h, s, v] = rgbToHsb(levels[0], levels[1], levels[2]);
  const parsed = { r: levels[0], g: levels[1], b: levels[2], a: levels[3], h, s, v };

  if (isString) {
    if (baseColorCache.size >= BASE_COLOR_CACHE_LIMIT) {
      baseColorCache.clear();
    }
    baseColorCache.set(colorValue, parsed);
  }
  return parsed;
}

/**
 * Get a p5 color from drum settings with hue variation applied.
 * @param {Object} settings - The drum settings object (drumSettings[drumId])
 * @param {number} velocityNorm - Normalized velocity (0-1) for hue scaling
 * @returns {p5.Color} - Color with hue variation applied
 */
export function getColorWithHueVariation(settings, velocityNorm) {
  const base = getBaseColor(settings.color);

  if (settings.hueVariation > 0) {
    const scaledVelocity = applyScalingCurve(velocityNorm, settings.hueScaling || 'linear');
    const hueShift = settings.hueVariation * scaledVelocity;
    const h = (base.h + hueShift) % 360;

    // Saturation and brightness preserved; alpha is opaque (as with color(h, s, b))
    const rgb = hsbToRgb(h, base.s, base.v);
    return color(rgb[0], rgb[1], rgb[2]);
  }

  return color(base.r, base.g, base.b, base.a);
}
