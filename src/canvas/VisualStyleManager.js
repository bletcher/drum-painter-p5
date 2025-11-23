/**
 * Visual Style Manager
 * Manages dynamic updates to brushstroke and splatter visual parameters
 * Handles MIDI CC value mapping to constants and texture cache invalidation
 */

import * as constants from '../config/constants.js';

export class VisualStyleManager {
  constructor() {
    // Store active constant overrides
    this.constantOverrides = {};

    // Reference to texture cache (will be set externally)
    this.brushTextureCache = null;

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
      console.warn(`Unknown visual style parameter: ${paramKey}`);
      return;
    }

    // Map normalized value to parameter range
    const value = mapping.min + normalizedValue * (mapping.max - mapping.min);

    // Update each constant this parameter controls
    for (const constantName of mapping.constants) {
      this.constantOverrides[constantName] = value;
      console.log(`🎨 Visual Style: ${mapping.description} = ${value.toFixed(2)} (${constantName})`);
    }

    // Clear texture cache to force regeneration with new values
    this.invalidateTextureCache();
  }

  /**
   * Get the current value of a constant (override or default)
   */
  getConstant(constantName) {
    if (this.constantOverrides.hasOwnProperty(constantName)) {
      return this.constantOverrides[constantName];
    }
    return constants[constantName];
  }

  /**
   * Clear texture cache to force regeneration
   */
  invalidateTextureCache() {
    if (this.brushTextureCache) {
      this.brushTextureCache.clearCache();
      console.log('🗑️ Texture cache cleared');
    }
  }

  /**
   * Reset all overrides to default values
   */
  resetToDefaults() {
    this.constantOverrides = {};
    this.invalidateTextureCache();
    console.log('♻️ Visual style reset to defaults');
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
