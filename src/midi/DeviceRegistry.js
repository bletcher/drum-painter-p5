/**
 * MIDI Device Registry
 * Tracks connected devices and provides stable device identification
 * across reconnects using name+manufacturer as stable key
 */

import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';

export class DeviceRegistry {
  constructor() {
    // Map of stable device keys to current device info
    // stableKey (name:manufacturer) -> { id, name, manufacturer, state, lastSeen }
    this.devices = new Map();

    // Map of volatile IDs to stable keys for fast lookup
    // volatileId -> stableKey
    this.idToStable = new Map();

    // Callback for when device registry changes
    this.onRegistryChange = null;
  }

  /**
   * Generate stable device key from name and manufacturer
   */
  static getStableKey(name, manufacturer) {
    return `${name}::${manufacturer || 'unknown'}`;
  }

  /**
   * Register or update a device
   */
  registerDevice(device) {
    const stableKey = DeviceRegistry.getStableKey(device.name, device.manufacturer);

    // Store device info
    this.devices.set(stableKey, {
      id: device.id,
      name: device.name,
      manufacturer: device.manufacturer || 'Unknown',
      state: device.state || 'connected',
      lastSeen: Date.now()
    });

    // Update reverse lookup
    this.idToStable.set(device.id, stableKey);

    debugLog(`📱 Device registered: ${stableKey} (ID: ${device.id})`);

    if (this.onRegistryChange) {
      this.onRegistryChange('register', stableKey, device.id);
    }

    return stableKey;
  }

  /**
   * Mark device as disconnected (but keep in registry)
   */
  markDisconnected(deviceId) {
    const stableKey = this.idToStable.get(deviceId);
    if (stableKey && this.devices.has(stableKey)) {
      const device = this.devices.get(stableKey);
      device.state = 'disconnected';
      device.lastSeen = Date.now();

      debugLog(`📴 Device disconnected: ${stableKey}`);

      if (this.onRegistryChange) {
        this.onRegistryChange('disconnect', stableKey, deviceId);
      }
    }
  }

  /**
   * Get current volatile ID for a stable device key
   */
  getCurrentId(stableKey) {
    const device = this.devices.get(stableKey);
    return device?.id || null;
  }

  /**
   * Get stable key from volatile ID
   */
  getStableKey(volatileId) {
    return this.idToStable.get(volatileId) || null;
  }

  /**
   * Get device info by stable key
   */
  getDevice(stableKey) {
    return this.devices.get(stableKey) || null;
  }

  /**
   * Get device info by volatile ID
   */
  getDeviceById(volatileId) {
    const stableKey = this.idToStable.get(volatileId);
    return stableKey ? this.devices.get(stableKey) : null;
  }

  /**
   * Get all connected devices
   */
  getConnectedDevices() {
    const connected = [];
    for (const [stableKey, device] of this.devices.entries()) {
      if (device.state === 'connected') {
        connected.push({ stableKey, ...device });
      }
    }
    return connected;
  }

  /**
   * Get all devices (including disconnected)
   */
  getAllDevices() {
    const all = [];
    for (const [stableKey, device] of this.devices.entries()) {
      all.push({ stableKey, ...device });
    }
    return all;
  }

  /**
   * Check if a stable device is currently connected
   */
  isConnected(stableKey) {
    const device = this.devices.get(stableKey);
    return device?.state === 'connected';
  }

  /**
   * Clear old disconnected devices (older than 7 days)
   */
  pruneOldDevices(maxAge = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const toRemove = [];

    for (const [stableKey, device] of this.devices.entries()) {
      if (device.state === 'disconnected' && (now - device.lastSeen) > maxAge) {
        toRemove.push(stableKey);
      }
    }

    toRemove.forEach(key => {
      const device = this.devices.get(key);
      if (device) {
        this.idToStable.delete(device.id);
        this.devices.delete(key);
        debugLog(`🗑️ Pruned old device: ${key}`);
      }
    });

    return toRemove.length;
  }

  /**
   * Get registry state for saving
   */
  getState() {
    const state = {
      devices: [],
      timestamp: Date.now()
    };

    for (const [stableKey, device] of this.devices.entries()) {
      state.devices.push({
        stableKey,
        name: device.name,
        manufacturer: device.manufacturer,
        lastSeen: device.lastSeen
      });
    }

    return state;
  }

  /**
   * Load registry state
   */
  loadState(state) {
    if (!state || !state.devices) return;

    // Don't restore volatile IDs - they will be updated on next connection
    // Just restore the stable keys so we remember which devices existed
    state.devices.forEach(deviceInfo => {
      if (deviceInfo.stableKey) {
        this.devices.set(deviceInfo.stableKey, {
          id: null, // Will be updated on reconnect
          name: deviceInfo.name,
          manufacturer: deviceInfo.manufacturer,
          state: 'disconnected',
          lastSeen: deviceInfo.lastSeen || Date.now()
        });
      }
    });

    infoLog(`📂 Loaded ${state.devices.length} known devices from registry`);
  }
}
