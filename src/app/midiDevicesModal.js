/**
 * MIDI Devices Modal
 * Lists connected MIDI inputs when the MIDI status box is clicked.
 */

import { debugLog } from '../utils/debug.js';
import { escapeHtml } from '../utils/escapeHtml.js';

let getDevices = () => [];

/**
 * @param {Function} devicesGetter - () => [{ id, name, manufacturer, state }]
 */
export function initMidiDevicesModal(devicesGetter) {
  getDevices = devicesGetter;
  setupMidiDevicesModal();
}

/**
 * Setup MIDI Devices Modal
 */
function setupMidiDevicesModal() {
  const midiStatus = document.getElementById('midi-status');
  const backdrop = document.getElementById('midi-devices-backdrop');
  const closeBtn = document.getElementById('close-midi-devices-btn');

  // Open modal when clicking MIDI status
  if (midiStatus) {
    midiStatus.addEventListener('click', () => {
      openMidiDevicesModal();
    });

  }

  // Close modal
  if (closeBtn) {
    closeBtn.addEventListener('click', closeMidiDevicesModal);
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeMidiDevicesModal();
      }
    });
  }
}

/**
 * Open MIDI devices modal
 */
function openMidiDevicesModal() {
  const backdrop = document.getElementById('midi-devices-backdrop');
  const devicesList = document.getElementById('midi-devices-list');

  if (!backdrop || !devicesList) return;

  const devices = getDevices() || [];
  debugLog('🎹 Opening MIDI devices modal, found devices:', devices);

  if (devices.length === 0) {
    devicesList.innerHTML = `
      <div style="text-align: center; padding: 20px; opacity: 0.7;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 12px; opacity: 0.5;">
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/>
          <path d="M6 9V21"/>
          <path d="M18 9V21"/>
        </svg>
        <div style="font-size: 14px;">No MIDI devices connected</div>
      </div>
    `;
  } else {
    devicesList.innerHTML = devices.map((device, index) => `
      <div style="
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: ${index < devices.length - 1 ? '12px' : '0'};
        border: 1px solid rgba(255, 255, 255, 0.2);
      ">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2"/>
            <path d="M6 9V21"/>
            <path d="M18 9V21"/>
          </svg>
          <div style="font-weight: bold; font-size: 14px;">${escapeHtml(device.name)}</div>
        </div>
        <div style="font-size: 12px; opacity: 0.8; display: flex; flex-direction: column; gap: 4px; margin-left: 28px;">
          <div>Manufacturer: ${escapeHtml(device.manufacturer)}</div>
          <div>State: ${device.state === 'connected' ? '✓ Connected' : escapeHtml(device.state)}</div>
          <div style="font-size: 11px; opacity: 0.6; margin-top: 4px;">ID: ${escapeHtml(device.id)}</div>
        </div>
      </div>
    `).join('');
  }

  backdrop.style.display = 'flex';
}

/**
 * Close MIDI devices modal
 */
export function closeMidiDevicesModal() {
  const backdrop = document.getElementById('midi-devices-backdrop');
  if (backdrop) {
    backdrop.style.display = 'none';
  }
}
