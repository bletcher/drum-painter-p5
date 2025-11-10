/**
 * Debug Panel
 * Shows original settings vs calculated paint values in real-time
 */

import { DEBUG_PANEL, COLORS, SPACING, RADIUS, SHADOWS } from '../config/theme.js';

export class DebugPanel {
  constructor(drumSettings, midiManager) {
    this.drumSettings = drumSettings;
    this.midiManager = midiManager;
    this.isVisible = false;
    this.lastPaintData = new Map(); // drumId -> last paint data

    // Drag state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.panelStartX = 0;
    this.panelStartY = 0;

    // Resize state
    this.isResizing = false;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.panelStartWidth = 0;
    this.panelStartHeight = 0;

    // Panel dimensions and position
    this.width = 1200;
    this.height = 600;
    this.x = null; // null = centered
    this.y = null; // null = centered

    this.createPanel();
  }

  createPanel() {
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'debug-backdrop';
    backdrop.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
    `;
    backdrop.onclick = () => this.hide();
    document.body.appendChild(backdrop);

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    this.updatePanelPosition(panel);

    // Header (draggable)
    const header = document.createElement('div');
    header.id = 'debug-header';
    header.style.cssText = `
      padding: ${SPACING.lg} ${SPACING.xl};
      background: ${COLORS.primary.main};
      color: ${COLORS.text.light};
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    `;
    header.innerHTML = `
      <h3 style="margin: 0; font-size: 16px; pointer-events: none;">🐛 Debug Panel - Settings vs Paint Values</h3>
      <button id="close-debug-btn" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: ${COLORS.text.light};
        padding: 5px 10px;
        border-radius: ${RADIUS.md};
        cursor: pointer;
        font-size: 18px;
      ">×</button>
    `;

    // Make header draggable
    header.onmousedown = (e) => this.startDrag(e);

    // Content container
    const content = document.createElement('div');
    content.id = 'debug-content';
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    `;

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'debug-resize-handle';
    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, ${COLORS.primary.main} 50%);
      border-bottom-right-radius: ${RADIUS.xl};
    `;
    resizeHandle.onmousedown = (e) => this.startResize(e);

    panel.appendChild(header);
    panel.appendChild(content);
    panel.appendChild(resizeHandle);
    document.body.appendChild(panel);

    // Close button handler
    document.getElementById('close-debug-btn').onclick = (e) => {
      e.stopPropagation(); // Prevent drag
      this.hide();
    };

    // Global mouse handlers
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', () => this.onMouseUp());
  }

  show() {
    this.isVisible = true;
    document.getElementById('debug-backdrop').style.display = 'block';
    this.updatePanelPosition();
    this.update();
  }

  hide() {
    this.isVisible = false;
    document.getElementById('debug-backdrop').style.display = 'none';
    this.updatePanelPosition(); // Update to hide
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Record paint data for a drum
   * Call this from paint modes to capture actual calculated values
   */
  recordPaint(drumId, note, velocity, calculatedValues = {}) {
    // Merge with existing data if present (modes may call this multiple times)
    const existing = this.lastPaintData.get(drumId);

    this.lastPaintData.set(drumId, {
      note,
      velocity,
      calculatedValues: {
        ...(existing?.calculatedValues || {}),
        ...calculatedValues
      },
      timestamp: Date.now()
    });

    // Auto-update if panel is visible
    if (this.isVisible) {
      this.update();
    }
  }

  /**
   * Update the debug panel display
   */
  update() {
    const content = document.getElementById('debug-content');
    if (!content) return;

    content.innerHTML = '';

    // Get all drums that have been painted
    const activeDrums = [];
    for (const drumId in this.drumSettings) {
      if (this.lastPaintData.has(drumId)) {
        activeDrums.push(drumId);
      }
    }

    if (activeDrums.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
          <p style="font-size: 18px; margin-bottom: 10px;">👆 Play some drums to see debug info</p>
          <p style="font-size: 14px;">This panel shows raw settings vs calculated paint values</p>
        </div>
      `;
      return;
    }

    // Sort by most recently played
    activeDrums.sort((a, b) => {
      const aTime = this.lastPaintData.get(a).timestamp;
      const bTime = this.lastPaintData.get(b).timestamp;
      return bTime - aTime;
    });

    // Create a card for each active drum
    activeDrums.forEach(drumId => {
      const card = this.createDrumDebugCard(drumId);
      content.appendChild(card);
    });
  }

  /**
   * Create a debug card for a single drum
   */
  createDrumDebugCard(drumId) {
    const settings = this.drumSettings[drumId];
    const paintData = this.lastPaintData.get(drumId);

    const card = document.createElement('div');
    card.style.cssText = `
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      border-left: 4px solid ${settings.color};
    `;

    // Header with drum name and last played time
    const timeSince = Math.round((Date.now() - paintData.timestamp) / 1000);
    const timeText = timeSince < 60 ? `${timeSince}s ago` : `${Math.round(timeSince / 60)}m ago`;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h4 style="margin: 0; font-size: 16px; color: #333;">
          ${settings.name} <span style="font-size: 12px; color: #999; font-weight: normal;">(${drumId})</span>
        </h4>
        <span style="font-size: 11px; color: #666;">Last played: ${timeText}</span>
      </div>
    `;

    // Create unified table for perfect row alignment
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
      background: white;
      padding: 12px;
      border-radius: 6px;
    `;

    const deviceInfo = this.getDeviceInfo(settings);
    const calc = paintData.calculatedValues || {};

    tableContainer.innerHTML = `
      <!-- Fixed Settings Section -->
      <h5 id="fixed-settings-header-${drumId}" style="margin: 0 0 ${SPACING.sm} 0; font-size: 13px; color: ${DEBUG_PANEL.header.collapsed.textColor}; font-weight: 600; border-bottom: 2px solid ${DEBUG_PANEL.header.collapsed.borderColor}; padding-bottom: ${SPACING.xs}; cursor: pointer; user-select: none; display: flex; align-items: center; gap: ${SPACING.sm};">
        <span id="fixed-settings-chevron-${drumId}" style="transition: transform 0.2s;">▼</span>
        <span>Fixed Settings</span>
      </h5>
      <div id="fixed-settings-content-${drumId}" style="overflow: hidden; transition: max-height 0.3s ease-out;">
        <table style="width: 100%; font-size: 11px; border-collapse: collapse; table-layout: fixed; margin-bottom: ${SPACING.xl};">
          <colgroup>
            <col style="width: 35%;">
            <col style="width: 65%;">
          </colgroup>
          ${this.createFixedRow('Device', deviceInfo)}
          ${this.createFixedRow('Note', paintData.note)}
          ${this.createFixedRow('Color', settings.color, true, settings.color)}
          ${this.createFixedRow('Shape', settings.shape)}
          ${this.createFixedRow('Size', `${(settings.size * 100).toFixed(0)}%`)}
          ${this.createFixedRow('Rotation', `${settings.rotation}°`)}
          ${this.createFixedRow('Opacity', `${(settings.opacity * 100).toFixed(0)}%`)}
          ${this.createFixedRow('Hue Variation', `${settings.hueVariation}°`)}
          ${this.createFixedRow('Stroke Enabled', settings.strokeEnabled ? 'Yes' : 'No')}
          ${this.createFixedRow('Stroke Weight', `${settings.strokeWeight}px`)}
          ${this.createFixedRow('Stroke Color', settings.strokeColor, true, settings.strokeColor)}
          ${this.createFixedRow('Size Scaling', settings.sizeScaling || '1:1')}
          ${this.createFixedRow('Opacity Scaling', settings.opacityScaling || '1:1')}
          ${this.createFixedRow('Hue Scaling', settings.hueScaling || '1:1')}
        </table>
      </div>

      <!-- Velocity Input Display -->
      <div style="background: ${DEBUG_PANEL.velocity.background}; border-radius: ${RADIUS.lg}; padding: ${SPACING.md} 16px; margin-bottom: ${SPACING.md}; border-left: 4px solid ${DEBUG_PANEL.velocity.borderColor}; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: baseline; gap: ${SPACING.sm};">
          <span style="font-size: 10px; font-weight: 600; color: ${DEBUG_PANEL.velocity.badgeColor}; text-transform: uppercase; letter-spacing: 0.5px;">Input</span>
          <span style="font-size: 12px; font-weight: 600; color: ${DEBUG_PANEL.velocity.labelColor};">Velocity</span>
        </div>
        <div style="font-size: 18px; font-weight: 700; color: ${DEBUG_PANEL.velocity.valueColor}; font-family: 'Courier New', monospace;">
          ${paintData.velocity.toFixed(3)}
        </div>
      </div>

      <!-- Calculated Values Table -->
      <div style="background: ${DEBUG_PANEL.calculated.background}; border-radius: ${RADIUS.lg}; padding: ${SPACING.md}; border-left: 4px solid ${DEBUG_PANEL.calculated.borderColor};">
        <div style="font-size: 10px; font-weight: 600; color: ${DEBUG_PANEL.calculated.labelColor}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: ${SPACING.sm};">Calculated Values</div>
        <table style="width: 100%; font-size: 11px; border-collapse: collapse; table-layout: fixed;">
          <colgroup>
            <col style="width: 40%;">
            <col style="width: 60%;">
          </colgroup>
          <tbody>
            ${this.createCalculatedRow('Color', calc.color || '<span style="color: #999;">not calculated</span>', true, calc.color)}
            ${this.createCalculatedRow('Size', calc.size !== undefined ? `${calc.size.toFixed(1)}px` : '<span style="color: #999;">not calculated</span>', false, null)}
            ${this.createCalculatedRow('Rotation', calc.rotation !== undefined ? `${calc.rotation.toFixed(1)}°` : '<span style="color: #999;">not calculated</span>', false, null)}
            ${this.createCalculatedRow('Opacity', calc.opacity !== undefined && calc.opacity !== null ? (calc.opacity * 100).toFixed(0) + '%' : '<span style="color: #999;">not calculated</span>', false, null)}
            ${this.createCalculatedRow('Stroke Weight', calc.strokeWeight !== undefined ? `${calc.strokeWeight}px` : '<span style="color: #999;">not calculated</span>', false, null)}
            ${this.createCalculatedRow('Stroke Color', calc.strokeColor || '<span style="color: #999;">not calculated</span>', true, calc.strokeColor)}
          </tbody>
        </table>
      </div>
    `;

    card.appendChild(tableContainer);

    // Add collapse/expand functionality for fixed settings
    const header = tableContainer.querySelector(`#fixed-settings-header-${drumId}`);
    const content = tableContainer.querySelector(`#fixed-settings-content-${drumId}`);
    const chevron = tableContainer.querySelector(`#fixed-settings-chevron-${drumId}`);

    // Initialize collapsed state (collapsed by default)
    let isCollapsed = true;
    content.style.maxHeight = '0px';
    chevron.style.transform = 'rotate(-90deg)';

    header.onclick = () => {
      isCollapsed = !isCollapsed;

      if (isCollapsed) {
        content.style.maxHeight = '0px';
        chevron.style.transform = 'rotate(-90deg)';
      } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        chevron.style.transform = 'rotate(0deg)';
      }
    };

    return card;
  }

  /**
   * Create a row for fixed settings (doesn't change per hit)
   */
  createFixedRow(label, value, isColor = false, colorValue = null) {
    const colorSwatch = isColor && colorValue
      ? `<span style="display: inline-block; width: 12px; height: 12px; background: ${colorValue}; border: 1px solid ${COLORS.border.dark}; border-radius: 2px; margin-left: 5px; vertical-align: middle;"></span>`
      : '';

    return `
      <tr style="border-bottom: 1px solid ${DEBUG_PANEL.fixedSettings.borderColor};">
        <td style="padding: 6px 8px 6px 0; font-weight: 600; color: ${DEBUG_PANEL.fixedSettings.labelColor}; vertical-align: top;">${label}</td>
        <td style="padding: 6px 8px; color: ${DEBUG_PANEL.fixedSettings.valueColor}; vertical-align: top; word-break: break-word; overflow-wrap: break-word;">${value}${colorSwatch}</td>
      </tr>
    `;
  }

  /**
   * Create a row for calculated values only
   */
  createCalculatedRow(label, value, isColor = false, colorValue = null) {
    const colorSwatch = isColor && colorValue
      ? `<span style="display: inline-block; width: 12px; height: 12px; background: ${colorValue}; border: 1px solid ${COLORS.border.dark}; border-radius: 2px; margin-left: 5px; vertical-align: middle;"></span>`
      : '';

    return `
      <tr style="border-bottom: 1px solid ${DEBUG_PANEL.calculated.tableRowBorder};">
        <td style="padding: 6px 8px 6px 0; font-weight: 600; color: ${DEBUG_PANEL.calculated.labelColor}; vertical-align: top;">${label}</td>
        <td style="padding: 6px 8px; color: ${DEBUG_PANEL.calculated.valueColor}; vertical-align: top; word-break: break-word; overflow-wrap: break-word;">${value}${colorSwatch}</td>
      </tr>
    `;
  }

  /**
   * Get device info string
   */
  getDeviceInfo(settings) {
    if (settings.midiDeviceStable) {
      return settings.midiDeviceStable;
    } else if (settings.midiDevice) {
      const device = this.midiManager.connectedDevices.find(d => d.id === settings.midiDevice);
      return device ? device.name : settings.midiDevice.substring(0, 30);
    } else {
      return 'ANY device';
    }
  }

  /**
   * Update panel position and size
   */
  updatePanelPosition(panel) {
    if (!panel) panel = document.getElementById('debug-panel');
    if (!panel) return;

    const maxWidth = window.innerWidth - 40;
    const maxHeight = window.innerHeight - 40;

    // Constrain size
    this.width = Math.min(this.width, maxWidth);
    this.height = Math.min(this.height, maxHeight);

    // If position not set, center it
    if (this.x === null || this.y === null) {
      this.x = (window.innerWidth - this.width) / 2;
      this.y = (window.innerHeight - this.height) / 2;
    }

    // Constrain position
    this.x = Math.max(0, Math.min(this.x, window.innerWidth - this.width));
    this.y = Math.max(0, Math.min(this.y, window.innerHeight - this.height));

    panel.style.cssText = `
      display: ${this.isVisible ? 'flex' : 'none'};
      position: fixed;
      left: ${this.x}px;
      top: ${this.y}px;
      width: ${this.width}px;
      height: ${this.height}px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 9999;
      overflow: hidden;
      flex-direction: column;
    `;
  }

  /**
   * Start dragging the panel
   */
  startDrag(e) {
    // Don't drag if clicking on close button
    if (e.target.id === 'close-debug-btn') return;

    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.panelStartX = this.x;
    this.panelStartY = this.y;

    e.preventDefault();
  }

  /**
   * Start resizing the panel
   */
  startResize(e) {
    this.isResizing = true;
    this.resizeStartX = e.clientX;
    this.resizeStartY = e.clientY;
    this.panelStartWidth = this.width;
    this.panelStartHeight = this.height;

    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle mouse move (drag or resize)
   */
  onMouseMove(e) {
    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      this.x = this.panelStartX + dx;
      this.y = this.panelStartY + dy;

      this.updatePanelPosition();
    } else if (this.isResizing) {
      const dx = e.clientX - this.resizeStartX;
      const dy = e.clientY - this.resizeStartY;

      this.width = Math.max(400, this.panelStartWidth + dx);
      this.height = Math.max(300, this.panelStartHeight + dy);

      this.updatePanelPosition();
    }
  }

  /**
   * Handle mouse up (stop drag or resize)
   */
  onMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
  }
}
