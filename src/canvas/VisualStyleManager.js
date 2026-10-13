/**
 * Visual Style Manager
 * Manages dynamic updates to brushstroke and splatter visual parameters
 * Handles MIDI CC value mapping to constants and texture cache invalidation
 */

import * as constants from '../config/constants.js';
import { debugLog, debugWarn } from '../utils/debug.js';

export class VisualStyleManager {
  constructor() {
    // Store active constant overrides
    this.constantOverrides = {};

    // Reference to texture cache (will be set externally)
    this.brushTextureCache = null;

    // Style generation counter - part of the texture cache key, so changing a
    // parameter invalidates cached textures lazily (old entries age out via LRU)
    this.generation = 0;

    // Debounced memory cleanup after a burst of parameter changes (knob sweep)
    this.cleanupDelayMs = 500;
    this._cleanupTimer = null;

    // Define parameter mappings: paramKey -> { constant, min, max }
    this.parameterMappings = {
      // Splatter parameters
      splatterDensity: {
        constants: ['SPLATTER_DROPLET_COUNT_MIN', 'SPLATTER_DROPLET_COUNT_MAX'],
        min: 8,
        max: 40,
        description: 'Splatter Density'
      },
      splatterConnectionThickness: {
        constants: ['SPLATTER_CONNECTION_BASE_WIDTH'],
        min: 0.05,
        max: 0.2,
        description: 'Connection Thickness'
      },
      splatterSprayIntensity: {
        constants: ['SPLATTER_SPRAY_COUNT_MIN', 'SPLATTER_SPRAY_COUNT_MAX'],
        min: 10,
        max: 50,
        description: 'Spray Intensity'
      },
      splatterConnectionAmount: {
        constants: ['SPLATTER_CONNECTION_PROBABILITY'],
        min: 0.3,
        max: 1.0,
        description: 'Connection Amount'
      },
      splatterCoreSize: {
        constants: ['SPLATTER_BLOB_RADIUS'],
        min: 0.25,
        max: 0.55,
        description: 'Splatter Core Size'
      },
      splatterSpraySize: {
        constants: ['SPLATTER_SPRAY_SIZE_MIN', 'SPLATTER_SPRAY_SIZE_MAX'],
        min: 0.01,
        max: 0.1,
        description: 'Spray Dot Size'
      },

      // Brushstroke parameters
      brushDensity: {
        constants: ['BRUSH_BRISTLES_PER_CLUSTER_MIN', 'BRUSH_BRISTLES_PER_CLUSTER_MAX'],
        min: 3,
        max: 15,
        description: 'Brush Density'
      },
      brushOpacity: {
        constants: ['BRUSH_BRISTLE_ALPHA_MIN', 'BRUSH_BRISTLE_ALPHA_MAX'],
        min: 40,
        max: 180,
        description: 'Brush Opacity'
      },
      brushEdgeSoftness: {
        constants: ['BRUSH_EDGE_MASK_TOP_MAX', 'BRUSH_EDGE_MASK_BOTTOM_MIN'],
        min: 0.1,
        max: 0.25,
        description: 'Edge Softness'
      },
      brushStrokeVariation: {
        constants: ['BRUSH_PRESSURE_SIGMA'],
        min: 0.2,
        max: 0.5,
        description: 'Stroke Variation'
      }
    };
  }

  /**
   * Set texture cache reference
   */
  setBrushTextureCache(cache) {
    this.brushTextureCache = cache;
  }

  /**
   * Update a visual style parameter from MIDI CC
   * @param {string} paramKey - Parameter key (e.g., 'splatterDensity')
   * @param {number} normalizedValue - Normalized value 0-1
   */
  updateParameter(paramKey, normalizedValue) {
    const mapping = this.parameterMappings[paramKey];
    if (!mapping) {
      debugWarn(`Unknown visual style parameter: ${paramKey}`);
      return;
    }

    // Map normalized value to parameter range
    const value = mapping.min + normalizedValue * (mapping.max - mapping.min);

    // Update each constant this parameter controls
    let changed = false;
    for (const constantName of mapping.constants) {
      if (this.constantOverrides[constantName] !== value) {
        this.constantOverrides[constantName] = value;
        changed = true;
        debugLog(`🎨 Visual Style: ${mapping.description} = ${value.toFixed(2)} (${constantName})`);
      }
    }

    // Invalidate textures so new hits regenerate with the new values
    if (changed) {
      this.invalidateTextureCache();
    }
  }

  /**
   * Get the current value of a constant (override or default)
   */
  getConstant(constantName) {
    if (Object.prototype.hasOwnProperty.call(this.constantOverrides, constantName)) {
      return this.constantOverrides[constantName];
    }
    return constants[constantName];
  }

  /**
   * Invalidate cached textures so they regenerate with current values.
   * Cheap and safe to call on every MIDI CC message: bumps the generation
   * counter (part of the cache key) and schedules a debounced cleanup of
   * stale textures once changes settle.
   */
  invalidateTextureCache() {
    this.generation++;

    if (this._cleanupTimer !== null) {
      clearTimeout(this._cleanupTimer);
    }
    this._cleanupTimer = setTimeout(() => {
      this._cleanupTimer = null;
      const cache = this.brushTextureCache;
      if (!cache) return;
      if (typeof cache.evictStaleGenerations === 'function') {
        cache.evictStaleGenerations(this.generation);
      } else {
        cache.clearCache();
      }
      debugLog('🗑️ Stale textures cleared');
    }, this.cleanupDelayMs);
  }

  /**
   * Reset all overrides to default values
   */
  resetToDefaults() {
    this.constantOverrides = {};
    this.invalidateTextureCache();
    debugLog('♻️ Visual style reset to defaults');
  }

  /**
   * Get all constant values with overrides applied
   */
  getAllConstants() {
    const result = { ...constants };
    for (const [key, value] of Object.entries(this.constantOverrides)) {
      result[key] = value;
    }
    return result;
  }
}

// Create singleton instance
export const visualStyleManager = new VisualStyleManager();
