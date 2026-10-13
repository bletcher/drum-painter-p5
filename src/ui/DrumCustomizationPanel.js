/**
 * Drum Customization Panel
 * Full-featured tabbed UI for drum settings with add/delete functionality
 */

import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { SCALING_CURVES, SCALING_CURVE_NAMES, SHAPE_OPTIONS } from '../config/constants.js';
import { CUSTOMIZATION_PANEL, COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../config/theme.js';
import { drawSplatterCanvas, drawBrushStrokeCanvas, drawInkBlotCanvas } from '../canvas/DrawingUtils.js';
import { PALETTES, getPalettesForCount } from '../config/palettes.js';
import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Only allow simple color syntaxes into inline CSS (values can come from imported files).
 * @param {*} value
 * @param {string} [fallback]
 */
function safeColor(value, fallback = '#888888') {
  const s = String(value ?? '').trim();
  return /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)|[a-z]{3,20})$/i.test(s) ? s : fallback;
}

export class DrumCustomizationPanel {
  constructor(drumSettings, midiManager, stateManager, notificationSystem, chronicleMode, darkModeManager) {
    this.drumSettings = drumSettings;
    this.midiManager = midiManager;
    this.stateManager = stateManager;
    this.notificationSystem = notificationSystem;
    this.chronicleMode = chronicleMode;
    this.darkModeManager = darkModeManager;
    this.currentTab = DRUM_KIT_CONFIG[0]?.id || 'kick';
    this.isVisible = false;
    this.draggedTabIndex = null;

    // Palette sub-view state
    this.paletteView = null; // null when closed; object when open
    this._draggedAssignmentSlot = null;
    this.lastPaletteDrumIds = null; // remembers the last-applied drum selection

    // Panel drag state
    this._dragState = null;
    this._onDragStart = this._onDragStart.bind(this);
    this._onDragMove = this._onDragMove.bind(this);
    this._onDragEnd = this._onDragEnd.bind(this);
  }

  /**
   * Schedule auto-save after a setting change
   */
  scheduleAutoSave() {
    if (this.stateManager && this.stateManager.scheduleAutoSave) {
      this.stateManager.scheduleAutoSave();
    }
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    this.isVisible = !this.isVisible;
    const panel = document.getElementById('customization-panel');
    const backdrop = document.getElementById('customization-backdrop');

    if (this.isVisible) {
      this.build();
      panel.style.display = 'block';
      backdrop.style.display = 'block';
      this._setupDrag();
    } else {
      // If the palette sub-view is open, cancel it (restore colors) before closing
      if (this.paletteView) {
        this.closePaletteView(false);
      }
      panel.style.display = 'none';
      backdrop.style.display = 'none';
      this._teardownDrag();
      // Reset to centered position for next open
      panel.style.top = '50%';
      panel.style.left = '50%';
      panel.style.transform = 'translate(-50%, -50%)';
    }
  }

  // Dragging the dialog by its header (Pointer Events: mouse, touch and pen)
  _setupDrag() {
    const header = document.getElementById('customization-panel-header');
    if (!header) return;
    header.removeEventListener('pointerdown', this._onDragStart);
    header.addEventListener('pointerdown', this._onDragStart);
  }

  _teardownDrag() {
    const header = document.getElementById('customization-panel-header');
    if (header) {
      header.removeEventListener('pointerdown', this._onDragStart);
      header.removeEventListener('pointermove', this._onDragMove);
      header.removeEventListener('pointerup', this._onDragEnd);
      header.removeEventListener('pointercancel', this._onDragEnd);
    }
    this._dragState = null;
  }

  _onDragStart(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Don't drag from buttons (close) or on small screens where the dialog is docked
    if (e.target.closest('button')) return;
    if (window.matchMedia?.('(max-width: 760px)').matches) return;

    const header = e.currentTarget;
    const panel = document.getElementById('customization-panel');
    const rect = panel.getBoundingClientRect();

    // Switch from centered transform to absolute positioning
    panel.style.transform = 'none';
    panel.style.top = rect.top + 'px';
    panel.style.left = rect.left + 'px';

    this._dragState = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top
    };

    header.style.cursor = 'grabbing';
    try {
      header.setPointerCapture(e.pointerId);
    } catch {
      // ignore — dragging still works while the pointer is over the header
    }
    header.addEventListener('pointermove', this._onDragMove);
    header.addEventListener('pointerup', this._onDragEnd);
    header.addEventListener('pointercancel', this._onDragEnd);
    e.preventDefault();
  }

  _onDragMove(e) {
    if (!this._dragState || e.pointerId !== this._dragState.pointerId) return;
    const panel = document.getElementById('customization-panel');

    let newLeft = e.clientX - this._dragState.offsetX;
    let newTop = e.clientY - this._dragState.offsetY;

    // Keep panel within viewport bounds
    const rect = panel.getBoundingClientRect();
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - 50));

    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
  }

  _onDragEnd(e) {
    const header = document.getElementById('customization-panel-header');
    if (header) {
      header.style.cursor = '';
      try {
        if (e && header.hasPointerCapture?.(e.pointerId)) header.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      header.removeEventListener('pointermove', this._onDragMove);
      header.removeEventListener('pointerup', this._onDragEnd);
      header.removeEventListener('pointercancel', this._onDragEnd);
    }
    this._dragState = null;
  }

  /**
   * Select a specific drum by ID
   * @param {string} drumId - The drum ID to select
   */
  selectDrum(drumId) {
    // Check if drum exists
    const drumExists = DRUM_KIT_CONFIG.find(d => d.id === drumId);
    if (!drumExists) {
      debugWarn(`Drum ${drumId} not found in DRUM_KIT_CONFIG`);
      return;
    }

    this.currentTab = drumId;
    this.build();
  }

  /**
   * Build the entire customization panel UI
   */
  build() {
    const container = document.getElementById('drum-settings-container');
    if (!container) return;

    container.innerHTML = '';

    // Create tab navigation
    const tabNav = document.createElement('div');
    tabNav.className = 'dc-tabs';
    tabNav.setAttribute('aria-label', 'Drums (drag to reorder)');
    tabNav.style.cssText = `
      display: flex;
      gap: 5px;
      margin-bottom: 15px;
      border-bottom: 2px solid ${COLORS.gray[200]};
    `;

    // Create tab content container
    const tabContent = document.createElement('div');
    tabContent.style.cssText = `
      position: relative;
      min-height: 350px;
    `;

    // Create tabs and content for each drum
    DRUM_KIT_CONFIG.forEach((drum, index) => {
      const settings = this.drumSettings[drum.id];
      if (!settings) return;

      const isActive = drum.id === this.currentTab;

      // Create tab button
      const tabButton = this.createTabButton(drum, settings, index, isActive);
      tabNav.appendChild(tabButton);

      // Create tab content panel
      const content = this.createTabContent(drum, settings, isActive);
      tabContent.appendChild(content);
    });

    // Add "+" button to add new drum
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.textContent = '+';
    addButton.title = 'Add a drum';
    addButton.setAttribute('aria-label', 'Add a drum');
    addButton.style.cssText = `
      padding: 10px 20px;
      border: 2px dashed ${COLORS.border.dark};
      background: ${COLORS.background.secondary};
      border-radius: ${RADIUS.xl} ${RADIUS.xl} 0 0;
      cursor: pointer;
      color: ${COLORS.text.secondary};
      font-size: 18px;
      font-weight: bold;
      transition: all 0.2s;
    `;
    addButton.onmouseover = () => {
      addButton.style.background = COLORS.gray[200];
      addButton.style.borderColor = COLORS.gray[400];
    };
    addButton.onmouseout = () => {
      addButton.style.background = COLORS.background.secondary;
      addButton.style.borderColor = COLORS.border.dark;
    };
    addButton.onclick = () => this.addNewDrum();
    tabNav.appendChild(addButton);

    container.appendChild(tabNav);
    container.appendChild(tabContent);
    // Theme colors come from CSS variables (theme.js tokens), so no dark-mode pass is needed here.
  }

  /**
   * Create a tab button
   */
  createTabButton(drum, settings, index, isActive) {
    const tabButton = document.createElement('button');
    tabButton.type = 'button';
    tabButton.id = `tab-btn-${drum.id}`;
    tabButton.className = isActive ? 'dc-tab is-active' : 'dc-tab';
    if (isActive) tabButton.setAttribute('aria-current', 'true');
    tabButton.draggable = true;
    tabButton.dataset.drumId = drum.id;
    tabButton.dataset.drumIndex = index;
    tabButton.style.cssText = `
      flex: 1;
      padding: 10px;
      border: none;
      background: ${isActive ? CUSTOMIZATION_PANEL.tab.active : CUSTOMIZATION_PANEL.tab.inactive};
      border-top: 3px solid ${isActive ? safeColor(settings.color) : 'transparent'};
      border-radius: ${RADIUS.xl} ${RADIUS.xl} 0 0;
      cursor: pointer;
      font-weight: ${isActive ? 'bold' : 'normal'};
      color: ${isActive ? CUSTOMIZATION_PANEL.tab.textActive : CUSTOMIZATION_PANEL.tab.textInactive};
      transition: all 0.2s;
      position: relative;
      font-size: ${TYPOGRAPHY.fontSize.md};
      min-width: 80px;
    `;

    // Tab label with editable name
    const label = document.createElement('span');
    label.id = `tab-label-${drum.id}`;
    label.textContent = settings.name;
    label.contentEditable = false;
    label.style.cssText = 'display: block; margin-bottom: 3px;';

    // MIDI note and device display
    const midiNote = document.createElement('small');
    midiNote.style.cssText = `color: ${COLORS.text.muted}; font-size: ${TYPOGRAPHY.fontSize.xs};`;

    let noteText = `Note ${settings.midiNote}`;

    // Add device name if device-specific mapping exists
    if (settings.midiDevice) {
      const device = this.midiManager.connectedDevices.find(d => d.id === settings.midiDevice);
      const deviceName = device ? device.name : settings.midiDevice.substring(0, 20);
      noteText += ` (${deviceName})`;
    }

    midiNote.textContent = noteText;

    tabButton.appendChild(label);
    tabButton.appendChild(midiNote);

    // Click to switch tab
    tabButton.onclick = () => {
      this.currentTab = drum.id;
      this.build();
    };

    // Hover effect
    tabButton.onmouseover = () => {
      if (!isActive) {
        tabButton.style.background = CUSTOMIZATION_PANEL.tab.hover;
      }
    };
    tabButton.onmouseout = () => {
      if (!isActive) {
        tabButton.style.background = CUSTOMIZATION_PANEL.tab.inactive;
      }
    };

    // Drag and drop for reordering
    this.setupDragAndDrop(tabButton, index);

    return tabButton;
  }

  /**
   * Setup drag and drop for tab reordering
   */
  setupDragAndDrop(tabButton, index) {
    tabButton.ondragstart = (e) => {
      this.draggedTabIndex = index;
      tabButton.style.opacity = '0.5';
    };

    tabButton.ondragend = (e) => {
      tabButton.style.opacity = '1';
    };

    tabButton.ondragover = (e) => {
      e.preventDefault();
      tabButton.style.background = COLORS.gray[300];
    };

    tabButton.ondragleave = (e) => {
      tabButton.style.background = tabButton.dataset.drumId === this.currentTab ? CUSTOMIZATION_PANEL.tab.active : CUSTOMIZATION_PANEL.tab.inactive;
    };

    tabButton.ondrop = (e) => {
      e.preventDefault();
      if (this.draggedTabIndex !== null && this.draggedTabIndex !== index) {
        // Reorder drums in DRUM_KIT_CONFIG
        const movedDrum = DRUM_KIT_CONFIG.splice(this.draggedTabIndex, 1)[0];
        DRUM_KIT_CONFIG.splice(index, 0, movedDrum);

        // Also reorder in drumOrder to keep them in sync
        if (window.drumOrder) {
          const movedDrumId = movedDrum.id;
          const oldOrderIndex = window.drumOrder.indexOf(movedDrumId);
          if (oldOrderIndex > -1) {
            window.drumOrder.splice(oldOrderIndex, 1);
            window.drumOrder.splice(index, 0, movedDrumId);
          }
        }

        // Update timeline lanes with new order
        if (this.chronicleMode) {
          this.chronicleMode.regenerateLanes(this.drumSettings, window.drumOrder);
        }

        this.draggedTabIndex = null;
        this.build();
        this.notificationSystem.show('Drum order updated');

        // Save the new order (this was missing before!)
        this.scheduleAutoSave();
      }
      tabButton.style.background = tabButton.dataset.drumId === this.currentTab ? CUSTOMIZATION_PANEL.tab.active : CUSTOMIZATION_PANEL.tab.inactive;
    };
  }

  /**
   * Create tab content panel for a drum
   */
  createTabContent(drum, settings, isActive) {
    const content = document.createElement('div');
    content.id = `tab-content-${drum.id}`;
    content.style.display = isActive ? 'block' : 'none';
    content.style.cssText += `
      padding: 10px;
      background: ${COLORS.background.primary};
      border-radius: 0 ${RADIUS.xl} ${RADIUS.xl} ${RADIUS.xl};
      border: 1px solid ${COLORS.gray[200]};
    `;

    // First row: Name, MIDI Note, Color, Shape (4 columns)
    const topRow = document.createElement('div');
    topRow.className = 'dc-top-row';
    topRow.style.cssText = 'display: grid; grid-template-columns: 2fr 1.5fr 1fr 1.5fr; gap: 6px; margin-bottom: 8px;';
    topRow.appendChild(this.createNameSection(drum.id, settings));
    topRow.appendChild(this.createMidiNoteSection(drum.id, settings));
    topRow.appendChild(this.createColorSection(drum.id, settings));
    topRow.appendChild(this.createShapeSection(drum.id, settings));
    content.appendChild(topRow);

    // Create 2-column grid container for remaining controls
    const grid = document.createElement('div');
    grid.className = 'dc-grid';
    grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; row-gap: 6px;';

    // Left column
    grid.appendChild(this.createRotationSection(drum.id, settings));
    grid.appendChild(this.createSizeSection(drum.id, settings));
    grid.appendChild(this.createOpacitySection(drum.id, settings));

    // Right column
    grid.appendChild(this.createHueVariationSection(drum.id, settings));
    grid.appendChild(this.createStrokeSection(drum.id, settings));
    grid.appendChild(this.createPreviewSection(drum.id, settings));

    content.appendChild(grid);

    // Delete button (full width at bottom)
    const deleteBtn = this.createDeleteButton(drum.id);
    deleteBtn.style.marginTop = '8px';
    content.appendChild(deleteBtn);

    return content;
  }

  /**
   * Create name section
   */
  createNameSection(drumId, settings) {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 0;';
    const safeId = escapeHtml(drumId);
    group.innerHTML = `
      <label for="name-${safeId}" style="display: block; margin-bottom: 3px; font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">Name</label>
      <input type="text" id="name-${safeId}"
        style="width: 100%; padding: 5px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.sm}; font-size: ${TYPOGRAPHY.fontSize.md};"
        placeholder="Drum name">
    `;

    const input = group.querySelector('input[type="text"]');
    // Set via the DOM property: names can come from imported settings files
    input.value = settings.name ?? '';
    input.onchange = () => {
      const newName = input.value.trim() || 'Untitled Drum';

      // Update drum settings
      this.drumSettings[drumId].name = newName;

      // Update DRUM_KIT_CONFIG (this is what gets saved!)
      const drumConfig = DRUM_KIT_CONFIG.find(d => d.id === drumId);
      if (drumConfig) {
        drumConfig.name = newName;
      }

      // Update tab label
      const label = document.getElementById(`tab-label-${drumId}`);
      if (label) label.textContent = newName;

      debugLog(`✏️ Renamed drum ${drumId} to: ${newName}`);
      this.scheduleAutoSave();
    };

    return group;
  }

  /**
   * Create MIDI note section with Learn button
   */
  createMidiNoteSection(drumId, settings) {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 0;';

    const safeId = escapeHtml(drumId);
    group.innerHTML = `
      <label for="midinote-${safeId}" style="display: block; margin-bottom: 3px; font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">Note</label>
      <div style="display: flex; gap: 3px;">
        <input type="number" id="midinote-${safeId}" min="0" max="127"
          style="width: 100%; padding: 5px 4px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.sm}; font-size: ${TYPOGRAPHY.fontSize.md}; text-align: center;">
        <button type="button" id="learn-${safeId}" title="Learn MIDI note: click, then hit the pad" aria-label="Learn MIDI note from the next pad hit" style="
          padding: 5px 7px;
          background: ${CUSTOMIZATION_PANEL.ccButton.learn};
          color: white;
          border: none;
          border-radius: ${RADIUS.sm};
          cursor: pointer;
          font-size: ${TYPOGRAPHY.fontSize.base};
          flex-shrink: 0;
        ">🎛</button>
      </div>
    `;

    const input = group.querySelector('input[type="number"]');
    input.value = settings.midiNote !== null && settings.midiNote !== undefined ? settings.midiNote : '';
    input.onchange = () => {
      this.drumSettings[drumId].midiNote = parseInt(input.value);
      this.scheduleAutoSave();
    };

    const learnButton = group.querySelector('button');
    learnButton.onclick = () => {
      this.midiManager.startMidiLearn(drumId);
      learnButton.textContent = '⏳';
      learnButton.style.background = CUSTOMIZATION_PANEL.ccButton.learning;

      // Update when learn completes
      const originalCallback = this.midiManager.onDrumNoteAssigned;
      this.midiManager.onDrumNoteAssigned = (learnedDrumId, note, deviceId, stableKey) => {
        if (originalCallback) originalCallback(learnedDrumId, note, deviceId, stableKey);
        if (learnedDrumId === drumId) {
          input.value = note;
          learnButton.textContent = '🎛';
          learnButton.style.background = CUSTOMIZATION_PANEL.ccButton.learn;
          this.notificationSystem.show(`${settings.name}: Note ${note}`);
        }
      };
    };

    return group;
  }

  /**
   * Create delete button
   */
  createDeleteButton(drumId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '🗑 Delete This Drum';
    button.style.cssText = `
      width: 100%;
      padding: 6px;
      background: ${COLORS.error.main};
      color: white;
      border: none;
      border-radius: ${RADIUS.sm};
      cursor: pointer;
      font-size: ${TYPOGRAPHY.fontSize.sm};
      margin-bottom: 0;
    `;
    button.onclick = () => this.deleteDrum(drumId);
    return button;
  }

  /**
   * Create color picker section
   */
  createColorSection(drumId, settings) {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 0;';
    const safeId = escapeHtml(drumId);
    group.innerHTML = `
      <label for="color-${safeId}" style="display: block; margin-bottom: 3px; font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">Color</label>
      <input type="color" id="color-${safeId}"
        style="width: 100%; height: 28px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.sm}; cursor: pointer;">
    `;

    const input = group.querySelector('input[type="color"]');
    input.value = settings.color || '#000000';
    input.oninput = () => {
      const newColor = input.value;

      // Update drum settings
      this.drumSettings[drumId].color = newColor;

      // Update DRUM_KIT_CONFIG (this is what gets saved!)
      const drumConfig = DRUM_KIT_CONFIG.find(d => d.id === drumId);
      if (drumConfig) {
        drumConfig.defaultColor = newColor;
      }

      this.updatePreview(drumId);

      // Update tab color
      const tabBtn = document.getElementById(`tab-btn-${drumId}`);
      if (tabBtn && drumId === this.currentTab) {
        tabBtn.style.borderTopColor = safeColor(newColor);
      }

      this.scheduleAutoSave();
    };

    return group;
  }

  /**
   * Create shape selector section
   */
  createShapeSection(drumId, settings) {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 0;';
    const safeId = escapeHtml(drumId);
    group.innerHTML = `
      <label for="shape-${safeId}" style="display: block; margin-bottom: 3px; font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">Shape</label>
      <select id="shape-${safeId}" style="width: 100%; padding: 5px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.sm}; font-size: ${TYPOGRAPHY.fontSize.base}; cursor: pointer;">
        ${SHAPE_OPTIONS.map(shape => `<option value="${escapeHtml(shape)}" ${settings.shape === shape ? 'selected' : ''}>${escapeHtml(shape.charAt(0).toUpperCase() + shape.slice(1))}</option>`).join('')}
      </select>
    `;

    const select = group.querySelector('select');
    select.onchange = () => {
      this.drumSettings[drumId].shape = select.value;
      this.updatePreview(drumId);

      // Hide stroke section for brushstroke shape
      const strokeSection = document.getElementById(`stroke-section-${drumId}`);
      if (strokeSection) {
        strokeSection.style.display = select.value === 'brushstroke' ? 'none' : 'block';
      }

      this.scheduleAutoSave();
    };

    return group;
  }

  /**
   * Create rotation slider
   */
  createRotationSection(drumId, settings) {
    return this.createSliderWithCCLearn(
      drumId,
      'rotation',
      'Rotation',
      settings.rotation,
      0,
      360,
      1,
      '°'
    );
  }

  /**
   * Create size slider with velocity scaling
   */
  createSizeSection(drumId, settings) {
    return this.createSliderWithScalingAndCC(
      drumId,
      'size',
      'Size',
      settings.size * 100,
      30,
      300,
      5,
      '%',
      settings.sizeScaling || SCALING_CURVES.ONE_TO_ONE
    );
  }

  /**
   * Create opacity slider with velocity scaling
   */
  createOpacitySection(drumId, settings) {
    return this.createSliderWithScalingAndCC(
      drumId,
      'opacity',
      'Opacity',
      settings.opacity * 100,
      10,
      100,
      5,
      '%',
      settings.opacityScaling || SCALING_CURVES.ONE_TO_ONE
    );
  }

  /**
   * Create hue variation slider with velocity scaling
   */
  createHueVariationSection(drumId, settings) {
    return this.createSliderWithScalingAndCC(
      drumId,
      'hueVariation',
      'Hue Variation',
      settings.hueVariation || 0,
      0,
      60,
      1,
      '°',
      settings.hueScaling || SCALING_CURVES.ONE_TO_ONE
    );
  }

  /**
   * Create stroke settings section
   */
  createStrokeSection(drumId, settings) {
    const group = document.createElement('div');
    group.id = `stroke-section-${drumId}`;
    // Hide stroke section if brushstroke shape is selected
    const shouldHide = settings.shape === 'brushstroke';
    group.style.cssText = `margin-bottom: 15px; padding: 15px; background: ${CUSTOMIZATION_PANEL.section.background}; border-radius: ${CUSTOMIZATION_PANEL.section.borderRadius}; ${shouldHide ? 'display: none;' : ''}`;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';
    header.innerHTML = `
      <span style="font-weight: bold; font-size: 12px;">Stroke Outline</span>
      <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
        <input type="checkbox" id="stroke-enabled-${escapeHtml(drumId)}" ${settings.strokeEnabled ? 'checked' : ''}>
        <span style="font-size: 11px;">Enabled</span>
      </label>
    `;
    group.appendChild(header);

    const checkbox = header.querySelector('input[type="checkbox"]');
    checkbox.onchange = () => {
      this.drumSettings[drumId].strokeEnabled = checkbox.checked;
      controls.style.display = checkbox.checked ? 'block' : 'none';
      this.updatePreview(drumId);
      this.scheduleAutoSave();
    };

    const controls = document.createElement('div');
    controls.style.display = settings.strokeEnabled ? 'block' : 'none';

    // Stroke color
    const colorDiv = document.createElement('div');
    colorDiv.style.cssText = 'margin-bottom: 10px;';
    const safeId = escapeHtml(drumId);
    colorDiv.innerHTML = `
      <label for="stroke-color-${safeId}" style="display: block; margin-bottom: 5px; font-size: ${TYPOGRAPHY.fontSize.base};">Stroke Color</label>
      <input type="color" id="stroke-color-${safeId}"
        style="width: 100%; height: 30px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.md}; cursor: pointer;">
    `;
    controls.appendChild(colorDiv);

    const colorInput = colorDiv.querySelector('input[type="color"]');
    colorInput.value = settings.strokeColor || '#000000';
    colorInput.oninput = () => {
      this.drumSettings[drumId].strokeColor = colorInput.value;
      this.updatePreview(drumId);
      this.scheduleAutoSave();
    };

    // Stroke weight
    controls.appendChild(this.createSliderWithCCLearn(
      drumId,
      'strokeWeight',
      'Stroke Weight',
      settings.strokeWeight || 2,
      1,
      10,
      0.5,
      'px'
    ));

    group.appendChild(controls);
    return group;
  }

  /**
   * Create a slider with CC Learn button (no velocity scaling)
   */
  createSliderWithCCLearn(drumId, paramKey, label, value, min, max, step, unit) {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 0;';

    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;';
    const sliderId = `${paramKey}-${drumId}`;
    labelDiv.innerHTML = `
      <label for="${escapeHtml(sliderId)}" style="font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">${escapeHtml(label)}</label>
      <span id="${escapeHtml(`${paramKey}-val-${drumId}`)}" style="font-size: ${TYPOGRAPHY.fontSize.sm}; font-weight: bold; color: ${COLORS.text.secondary};">${escapeHtml(`${value}${unit}`)}</span>
    `;
    const valueLabel = labelDiv.querySelector('span');
    group.appendChild(labelDiv);

    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 4px; align-items: center; flex-wrap: wrap;';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `${paramKey}-${drumId}`;
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.style.cssText = 'flex: 1; min-width: 80px; cursor: pointer;';
    slider.oninput = () => {
      const val = parseFloat(slider.value);
      const displayVal = (paramKey === 'size' || paramKey === 'opacity') ? val / 100 : val;
      this.drumSettings[drumId][paramKey] = displayVal;
      valueLabel.textContent = `${val}${unit}`;
      if (paramKey === 'rotation' || paramKey === 'strokeWeight') {
        this.updatePreview(drumId);
      }
      this.scheduleAutoSave();
    };
    controls.appendChild(slider);

    // CC Learn button
    if (this.drumSettings[drumId].midiCC && this.drumSettings[drumId].midiCC[paramKey]) {
      controls.appendChild(this.createCCLearnButton(drumId, paramKey));
    }

    group.appendChild(controls);
    return group;
  }

  /**
   * Create a slider with velocity scaling dropdown and CC Learn button
   */
  createSliderWithScalingAndCC(drumId, paramKey, label, value, min, max, step, unit, scalingCurve) {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 0;';

    // Compact single line: label, slider, value, velocity curve, CC learn
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; align-items: center; gap: 4px; flex-wrap: wrap;';

    // Label
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = `font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary}; min-width: 60px;`;
    controls.appendChild(labelEl);

    // Slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `${paramKey}-${drumId}`;
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.style.cssText = 'flex: 1; min-width: 80px; cursor: pointer;';
    slider.oninput = () => {
      const val = parseFloat(slider.value);
      const displayVal = (paramKey === 'size' || paramKey === 'opacity') ? val / 100 : val;
      this.drumSettings[drumId][paramKey] = displayVal;
      valueSpan.textContent = `${val}${unit}`;
      this.updatePreview(drumId);
      this.scheduleAutoSave();
    };
    controls.appendChild(slider);

    // Value display
    const valueSpan = document.createElement('span');
    valueSpan.id = `${paramKey}-val-${drumId}`;
    valueSpan.textContent = `${value}${unit}`;
    valueSpan.style.cssText = `min-width: 30px; font-weight: bold; color: ${COLORS.text.secondary}; font-size: ${TYPOGRAPHY.fontSize.sm};`;
    controls.appendChild(valueSpan);

    // Velocity scaling dropdown
    const scalingSelect = document.createElement('select');
    scalingSelect.id = `${paramKey}-scaling-${drumId}`;
    scalingSelect.setAttribute('aria-label', `${label} velocity curve`);
    scalingSelect.title = 'How hit velocity affects this value';
    scalingSelect.style.cssText = `min-width: 60px; padding: 2px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.sm}; font-size: ${TYPOGRAPHY.fontSize.xs}; cursor: pointer;`;
    scalingSelect.innerHTML = Object.entries(SCALING_CURVE_NAMES).map(([key, name]) =>
      `<option value="${key}" ${scalingCurve === key ? 'selected' : ''}>${name}</option>`
    ).join('');
    scalingSelect.onchange = () => {
      this.drumSettings[drumId][`${paramKey}Scaling`] = scalingSelect.value;
      this.scheduleAutoSave();
    };
    controls.appendChild(scalingSelect);

    // CC Learn button
    if (this.drumSettings[drumId].midiCC && this.drumSettings[drumId].midiCC[paramKey]) {
      controls.appendChild(this.createCCLearnButton(drumId, paramKey));
    }

    group.appendChild(controls);
    return group;
  }

  /**
   * Create CC Learn button for a parameter
   */
  createCCLearnButton(drumId, paramKey) {
    const settings = this.drumSettings[drumId];
    const ccData = settings.midiCC[paramKey];

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; align-items: center; gap: 3px;';

    if (ccData.cc !== null) {
      // Show CC number with range info
      const ccMin = ccData.ccMin || 0;
      const ccMax = ccData.ccMax || 127;
      const rangeInfo = (ccMin === 0 && ccMax === 127) ? '' : ` (${ccMin}-${ccMax})`;

      const ccDisplay = document.createElement('span');
      ccDisplay.textContent = `CC${ccData.cc}${rangeInfo}`;
      ccDisplay.style.cssText = `font-size: ${TYPOGRAPHY.fontSize.xs}; color: ${CUSTOMIZATION_PANEL.ccButton.mapped}; font-weight: bold; padding: 2px 4px; background: ${COLORS.primary.bg}; border-radius: ${RADIUS.sm};`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove MIDI CC mapping';
      removeBtn.setAttribute('aria-label', `Remove MIDI CC mapping for ${paramKey}`);
      removeBtn.style.cssText = `padding: 1px 4px; font-size: ${TYPOGRAPHY.fontSize.sm}; background: ${CUSTOMIZATION_PANEL.ccButton.remove}; color: white; border: none; border-radius: ${RADIUS.sm}; cursor: pointer;`;
      removeBtn.onclick = () => {
        this.drumSettings[drumId].midiCC[paramKey].cc = null;
        this.drumSettings[drumId].midiCC[paramKey].ccMin = 0;
        this.drumSettings[drumId].midiCC[paramKey].ccMax = 127;
        this.build();
      };

      wrapper.appendChild(ccDisplay);
      wrapper.appendChild(removeBtn);
    } else {
      // Show learn button
      const learnBtn = document.createElement('button');
      learnBtn.type = 'button';
      learnBtn.textContent = '🎛';
      learnBtn.title = 'Learn MIDI CC';
      learnBtn.setAttribute('aria-label', `Learn MIDI CC for ${paramKey}`);
      learnBtn.style.cssText = `padding: 2px 5px; font-size: ${TYPOGRAPHY.fontSize.base}; background: ${CUSTOMIZATION_PANEL.ccButton.learn}; color: white; border: none; border-radius: ${RADIUS.sm}; cursor: pointer;`;
      learnBtn.onclick = () => {
        this.midiManager.startCCLearn(drumId, paramKey);
        learnBtn.textContent = '⏳';
        learnBtn.style.background = CUSTOMIZATION_PANEL.ccButton.learning;
        debugLog(`CC Learn Mode: Move controller through FULL range for ${drumId}.${paramKey} (3 seconds)`);

        setTimeout(() => {
          if (this.midiManager.ccLearnMode) {
            this.midiManager.exitLearnMode();
            learnBtn.textContent = '🎛';
            learnBtn.style.background = CUSTOMIZATION_PANEL.ccButton.learn;
            debugLog('CC Learn timeout - no controller detected');
          }
        }, 4000);
      };

      wrapper.appendChild(learnBtn);
    }

    return wrapper;
  }

  /**
   * Create preview section
   */
  createPreviewSection(drumId, settings) {
    const group = document.createElement('div');
    group.style.cssText = `text-align: center; padding: 6px; background: ${COLORS.background.primary}; border-radius: ${RADIUS.sm}; border: 1px solid ${COLORS.gray[200]}; margin-bottom: 0;`;
    group.innerHTML = `
      <small style="color: ${COLORS.text.secondary}; display: block; margin-bottom: 2px; font-size: ${TYPOGRAPHY.fontSize.xs};">Preview</small>
      <div id="preview-${escapeHtml(drumId)}" style="display: inline-block;"></div>
    `;

    // Initial preview will be rendered after the element is in DOM
    setTimeout(() => this.updatePreview(drumId), 0);

    return group;
  }

  /**
   * Update shape preview
   */
  updatePreview(drumId) {
    const previewDiv = document.getElementById(`preview-${drumId}`);
    if (!previewDiv) return;

    const settings = this.drumSettings[drumId];
    // Use settings.size (which is a multiplier, e.g., 1.0 = 100%)
    // Scale it to a reasonable preview size (30-70 pixels)
    const baseSize = 40;
    const size = baseSize * (settings.size || 1.0);
    const canvasSize = 80;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((settings.rotation || 0) * Math.PI / 180);

    // Set fill with opacity
    const color = settings.color;
    const opacity = settings.opacity !== undefined ? settings.opacity : 1.0;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;

    // Set stroke
    if (settings.strokeEnabled) {
      const strokeColor = settings.strokeColor || '#000000';
      const sr = parseInt(strokeColor.slice(1, 3), 16);
      const sg = parseInt(strokeColor.slice(3, 5), 16);
      const sb = parseInt(strokeColor.slice(5, 7), 16);
      ctx.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${opacity})`;
      ctx.lineWidth = settings.strokeWeight || 2;
    }

    // Draw shape
    // Special handling for splatter, inkblot, and brushstroke (they use custom drawing functions)
    if (settings.shape === 'splatter') {
      drawSplatterCanvas(ctx, 0, 0, size);
      if (settings.strokeEnabled) {
        // Note: splatter doesn't use stroke in the same way
      }
    } else if (settings.shape === 'inkblot') {
      drawInkBlotCanvas(ctx, 0, 0, size);
      if (settings.strokeEnabled) {
        // Note: inkblot doesn't use stroke in the same way
      }
    } else if (settings.shape === 'brushstroke') {
      drawBrushStrokeCanvas(ctx, 0, 0, size, settings.rotation ? (settings.rotation * Math.PI) / 180 : 0);
      if (settings.strokeEnabled) {
        // Note: brushstroke doesn't use stroke in the same way
      }
    } else {
      // Standard shapes use beginPath/fill pattern
      ctx.beginPath();
      switch (settings.shape) {
        case 'circle':
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          break;
        case 'square':
          ctx.rect(-size / 2, -size / 2, size, size);
          break;
        case 'triangle':
          ctx.moveTo(0, -size / 2);
          ctx.lineTo(-size / 2, size / 2);
          ctx.lineTo(size / 2, size / 2);
          ctx.closePath();
          break;
        case 'diamond':
          ctx.moveTo(0, -size / 2);
          ctx.lineTo(size / 2, 0);
          ctx.lineTo(0, size / 2);
          ctx.lineTo(-size / 2, 0);
          ctx.closePath();
          break;
        case 'star':
          for (let i = 0; i < 10; i++) {
            const radius = i % 2 === 0 ? size / 2 : size / 4;
            const angle = (i * Math.PI) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          break;
        case 'hexagon':
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3 - Math.PI / 2;
            const x = Math.cos(angle) * size / 2;
            const y = Math.sin(angle) * size / 2;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          break;
      }

      ctx.fill();
      if (settings.strokeEnabled) {
        ctx.stroke();
      }
    }

    ctx.restore();

    previewDiv.innerHTML = '';
    previewDiv.appendChild(canvas);
  }

  /**
   * Add a new drum to the kit
   */
  addNewDrum() {
    const drumNumber = DRUM_KIT_CONFIG.length + 1;

    // Generate a meaningful ID (e.g., "drum_5" instead of "drum_1762996582203")
    // Ensure uniqueness by checking existing IDs
    let newId = `drum_${drumNumber}`;
    let counter = drumNumber;
    while (DRUM_KIT_CONFIG.some(d => d.id === newId) || this.drumSettings[newId]) {
      counter++;
      newId = `drum_${counter}`;
    }

    const newDrum = {
      id: newId,
      name: `Drum ${drumNumber}`,
      defaultMidiNote: 60 + DRUM_KIT_CONFIG.length,
      defaultColor: `#${Math.floor(Math.random()*16777215).toString(16)}`
    };

    DRUM_KIT_CONFIG.push(newDrum);

    // Create settings for new drum
    this.drumSettings[newId] = {
      name: newDrum.name,
      midiNote: newDrum.defaultMidiNote,
      midiDevice: null, // Volatile device ID (auto-updated on reconnect)
      midiDeviceStable: null, // Stable device key (name::manufacturer) - persists across reconnects
      color: newDrum.defaultColor,
      shape: 'circle',
      opacity: 1.0,
      opacityScaling: SCALING_CURVES.ONE_TO_ONE,
      size: 1.0,
      sizeScaling: SCALING_CURVES.ONE_TO_ONE,
      strokeEnabled: false,
      strokeWeight: 2,
      strokeColor: '#000000',
      hueVariation: 0,
      hueScaling: SCALING_CURVES.ONE_TO_ONE,
      rotation: 0,
      midiCC: {
        size: { cc: null, min: 30, max: 300, ccMin: 0, ccMax: 127 },
        opacity: { cc: null, min: 10, max: 100, ccMin: 0, ccMax: 127 },
        hueVariation: { cc: null, min: 0, max: 60, ccMin: 0, ccMax: 127 },
        rotation: { cc: null, min: 0, max: 360, ccMin: 0, ccMax: 127 },
        strokeWeight: { cc: null, min: 1, max: 10, ccMin: 0, ccMax: 127 }
      }
    };

    // Add to drumOrder
    if (window.drumOrder) {
      window.drumOrder.push(newId);
    }

    this.currentTab = newId;
    this.build();

    // Update timeline lanes to match new drum count
    if (this.chronicleMode) {
      this.chronicleMode.regenerateLanes(this.drumSettings, window.drumOrder);
    }

    this.notificationSystem.show(`Added ${newDrum.name}`);
    this.scheduleAutoSave();
  }

  /**
   * Delete a drum from the kit
   */
  deleteDrum(drumId) {
    if (DRUM_KIT_CONFIG.length <= 1) {
      this.notificationSystem.show('Cannot delete last drum!');
      return;
    }

    if (!confirm(`Delete ${this.drumSettings[drumId].name}?`)) {
      return;
    }

    // Remove from config
    const index = DRUM_KIT_CONFIG.findIndex(d => d.id === drumId);
    if (index > -1) {
      DRUM_KIT_CONFIG.splice(index, 1);
    }

    // Remove from drumOrder
    if (window.drumOrder) {
      const orderIndex = window.drumOrder.indexOf(drumId);
      if (orderIndex > -1) {
        window.drumOrder.splice(orderIndex, 1);
      }
    }

    // Remove settings
    delete this.drumSettings[drumId];

    // Clean up bank pad assignments if midiManager exists
    if (this.midiManager && this.midiManager.bankPadAssignments && this.midiManager.bankPadAssignments[drumId]) {
      delete this.midiManager.bankPadAssignments[drumId];
    }

    // Switch to first drum
    this.currentTab = DRUM_KIT_CONFIG[0].id;

    this.build();

    // Update timeline lanes to match new drum count
    if (this.chronicleMode) {
      this.chronicleMode.regenerateLanes(this.drumSettings, window.drumOrder);
    }

    this.notificationSystem.show('Drum deleted');
    this.scheduleAutoSave();
  }

  // ═══════════════════════════════════════════════════════════════
  // Palette sub-view: pick a palette and apply it to selected drums
  // ═══════════════════════════════════════════════════════════════

  /**
   * Enter the palette sub-view. Replaces the main drum editor content.
   * Also backs up current colors so Cancel can restore them.
   */
  openPaletteView() {
    const backup = {};
    DRUM_KIT_CONFIG.forEach(d => {
      backup[d.id] = this.drumSettings[d.id]?.color;
    });

    // Use last-applied selection if available, filtered to still-existing drums.
    // Fall back to all drums if there's no prior selection or every prior drum is gone.
    const allDrumIds = DRUM_KIT_CONFIG.map(d => d.id);
    let initialSelection = allDrumIds;
    if (Array.isArray(this.lastPaletteDrumIds) && this.lastPaletteDrumIds.length > 0) {
      const stillPresent = this.lastPaletteDrumIds.filter(id => allDrumIds.includes(id));
      if (stillPresent.length > 0) initialSelection = stillPresent;
    }

    this.paletteView = {
      backup,
      selectedDrumIds: initialSelection,
      selectedPaletteIndex: null, // index into the *filtered* palette list
      assignment: []              // array of { drumId, colorIndex } in render order
    };

    this.rebuildAssignmentFromSelection();

    document.getElementById('drum-settings-container').style.display = 'none';
    const sub = document.getElementById('palette-subview-container');
    sub.style.display = 'block';

    // Swap the sticky footer: hide default controls, show palette Cancel/Apply
    const defaultFooter = document.getElementById('default-footer-content');
    const paletteFooter = document.getElementById('palette-footer-content');
    if (defaultFooter) defaultFooter.style.display = 'none';
    if (paletteFooter) paletteFooter.style.display = 'flex';

    // Wire up the footer buttons (every open — cheap and avoids stale closures)
    const cancelBtn = document.getElementById('palette-cancel-btn');
    const applyBtn = document.getElementById('palette-apply-btn');
    if (cancelBtn) cancelBtn.onclick = () => this.closePaletteView(false);
    if (applyBtn) applyBtn.onclick = () => this.closePaletteView(true);

    this.buildPaletteView();
  }

  /**
   * Leave the palette sub-view. If commit is false, restore original colors.
   */
  closePaletteView(commit) {
    if (!this.paletteView) return;

    if (!commit) {
      // Restore every drum to its pre-open color
      Object.entries(this.paletteView.backup).forEach(([drumId, color]) => {
        if (!color || !this.drumSettings[drumId]) return;
        this.drumSettings[drumId].color = color;
        const cfg = DRUM_KIT_CONFIG.find(d => d.id === drumId);
        if (cfg) cfg.defaultColor = color;
      });
    } else {
      // Remember this selection so the next open starts with the same drums checked
      this.lastPaletteDrumIds = [...this.paletteView.selectedDrumIds];
      this.scheduleAutoSave();
      this.notificationSystem.show('Palette applied');
    }

    this.paletteView = null;
    document.getElementById('palette-subview-container').style.display = 'none';
    document.getElementById('drum-settings-container').style.display = 'block';

    // Restore the default footer
    const defaultFooter = document.getElementById('default-footer-content');
    const paletteFooter = document.getElementById('palette-footer-content');
    if (defaultFooter) defaultFooter.style.display = 'flex';
    if (paletteFooter) paletteFooter.style.display = 'none';

    this.build();
  }

  /**
   * Rebuild the assignment array whenever the selection set changes.
   * Preserves prior slot order for drums that are still selected so the
   * user's drag-reassignments aren't lost, and appends newly-checked drums.
   */
  rebuildAssignmentFromSelection() {
    const pv = this.paletteView;
    if (!pv) return;

    const selected = new Set(pv.selectedDrumIds);
    // Keep existing order for still-selected drums
    const kept = pv.assignment.filter(s => selected.has(s.drumId));
    const keptIds = new Set(kept.map(s => s.drumId));
    // Append newly-added drums in DRUM_KIT_CONFIG order
    const added = DRUM_KIT_CONFIG
      .filter(d => selected.has(d.id) && !keptIds.has(d.id))
      .map(d => ({ drumId: d.id, colorIndex: 0 }));

    const merged = [...kept, ...added];
    // Re-assign colorIndex = slot position (so slot 0 gets palette[0], etc.)
    pv.assignment = merged.map((s, i) => ({ drumId: s.drumId, colorIndex: i }));

    // If the selected palette no longer has enough colors, clear it
    const palette = this.getSelectedPalette();
    if (palette && palette.colors.length !== pv.assignment.length) {
      pv.selectedPaletteIndex = null;
    }
  }

  getMatchingPalettes() {
    const n = this.paletteView?.assignment.length || 0;
    return getPalettesForCount(n);
  }

  getSelectedPalette() {
    const pv = this.paletteView;
    if (!pv || pv.selectedPaletteIndex === null) return null;
    return this.getMatchingPalettes()[pv.selectedPaletteIndex] || null;
  }

  /**
   * Push the current selected palette + assignment to the live drum colors.
   * Called on palette click, drag-reassign, and shuffle for live preview.
   */
  applyPaletteLive() {
    const pv = this.paletteView;
    const palette = this.getSelectedPalette();
    if (!pv || !palette) return;

    pv.assignment.forEach(slot => {
      const color = palette.colors[slot.colorIndex];
      if (!color || !this.drumSettings[slot.drumId]) return;
      this.drumSettings[slot.drumId].color = color;
      const cfg = DRUM_KIT_CONFIG.find(d => d.id === slot.drumId);
      if (cfg) cfg.defaultColor = color;
    });
  }

  /**
   * Build (or rebuild) the palette sub-view DOM.
   */
  buildPaletteView() {
    const container = document.getElementById('palette-subview-container');
    if (!container || !this.paletteView) return;
    container.innerHTML = '';

    // ─── Header: title only (Cancel/Apply live in the footer row) ──
    const title = document.createElement('div');
    title.textContent = 'Apply Palette';
    title.style.cssText = `font-weight: 700; font-size: ${TYPOGRAPHY.fontSize.lg}; color: ${COLORS.text.primary}; margin-bottom: 14px;`;
    container.appendChild(title);

    // ─── Step 1: drum checkboxes ─────────────────────────────
    container.appendChild(this._buildDrumSelectStep());

    // ─── Step 2: palette grid ────────────────────────────────
    container.appendChild(this._buildPaletteGridStep());

    // ─── Step 3: assignment preview ──────────────────────────
    container.appendChild(this._buildAssignmentStep());

    // Keep the sticky footer's Apply button enabled/disabled in sync
    const applyBtn = document.getElementById('palette-apply-btn');
    if (applyBtn) {
      const canApply = this.getSelectedPalette() !== null && this.paletteView.assignment.length > 0;
      applyBtn.disabled = !canApply;
      applyBtn.style.background = canApply ? '#7209b7' : '#c4c4c4';
      applyBtn.style.cursor = canApply ? 'pointer' : 'not-allowed';
      applyBtn.style.opacity = canApply ? '1' : '0.6';
    }
  }

  _buildDrumSelectStep() {
    const pv = this.paletteView;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom: 16px;';

    const heading = document.createElement('div');
    heading.textContent = '① Choose drums to recolor';
    heading.style.cssText = `font-weight: 700; font-size: ${TYPOGRAPHY.fontSize.md}; margin-bottom: 8px; color: ${COLORS.text.primary};`;
    wrap.appendChild(heading);

    const list = document.createElement('div');
    list.style.cssText = `
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 10px; background: ${COLORS.background.secondary};
      border-radius: ${RADIUS.md}; border: 1px solid ${COLORS.gray[200]};
    `;

    DRUM_KIT_CONFIG.forEach(drum => {
      const settings = this.drumSettings[drum.id];
      if (!settings) return;
      const checked = pv.selectedDrumIds.includes(drum.id);

      const label = document.createElement('label');
      label.style.cssText = `
        display: flex; align-items: center; gap: 6px;
        padding: 4px 10px 4px 6px; background: ${COLORS.background.primary};
        border: 1px solid ${checked ? '#7209b7' : COLORS.gray[200]};
        border-radius: ${RADIUS.sm}; cursor: pointer;
        font-size: ${TYPOGRAPHY.fontSize.sm};
      `;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      cb.style.cursor = 'pointer';
      cb.onchange = () => {
        if (cb.checked) {
          if (!pv.selectedDrumIds.includes(drum.id)) pv.selectedDrumIds.push(drum.id);
        } else {
          pv.selectedDrumIds = pv.selectedDrumIds.filter(id => id !== drum.id);
          // Restore this drum's pre-palette color — a live-preview may have
          // tinted it while it was checked, but unchecking means "leave it alone".
          const originalColor = pv.backup[drum.id];
          if (originalColor && this.drumSettings[drum.id]) {
            this.drumSettings[drum.id].color = originalColor;
            const cfg = DRUM_KIT_CONFIG.find(d => d.id === drum.id);
            if (cfg) cfg.defaultColor = originalColor;
          }
        }
        this.rebuildAssignmentFromSelection();
        this.applyPaletteLive();
        this.buildPaletteView();
      };

      const chip = document.createElement('span');
      chip.style.cssText = `
        display: inline-block; width: 14px; height: 14px;
        background: ${safeColor(settings.color)}; border-radius: 3px;
        border: 1px solid ${COLORS.border.medium};
      `;

      const name = document.createElement('span');
      name.textContent = settings.name;

      label.appendChild(cb);
      label.appendChild(chip);
      label.appendChild(name);
      list.appendChild(label);
    });

    wrap.appendChild(list);

    const n = pv.assignment.length;
    const matching = this.getMatchingPalettes();
    const status = document.createElement('div');
    status.style.cssText = `font-size: ${TYPOGRAPHY.fontSize.xs}; color: ${COLORS.text.secondary}; margin-top: 6px;`;
    if (n === 0) {
      status.textContent = 'Select at least one drum.';
    } else {
      status.textContent = `${n} drum${n === 1 ? '' : 's'} selected · ${matching.length} palette${matching.length === 1 ? '' : 's'} with ${n} color${n === 1 ? '' : 's'}`;
    }
    wrap.appendChild(status);

    return wrap;
  }

  _buildPaletteGridStep() {
    const pv = this.paletteView;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom: 16px;';

    const heading = document.createElement('div');
    heading.textContent = '② Pick a palette';
    heading.style.cssText = `font-weight: 700; font-size: ${TYPOGRAPHY.fontSize.md}; margin-bottom: 8px; color: ${COLORS.text.primary};`;
    wrap.appendChild(heading);

    const matching = this.getMatchingPalettes();

    if (matching.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        padding: 14px; background: ${COLORS.background.secondary};
        border: 1px dashed ${COLORS.gray[300]}; border-radius: ${RADIUS.md};
        color: ${COLORS.text.secondary}; font-size: ${TYPOGRAPHY.fontSize.sm}; text-align: center;
      `;
      empty.textContent = pv.assignment.length === 0
        ? 'Select drums above to see matching palettes.'
        : `No bundled palettes with ${pv.assignment.length} colors — try selecting fewer drums.`;
      wrap.appendChild(empty);
      return wrap;
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 4px;';

    matching.forEach((palette, idx) => {
      const isSelected = pv.selectedPaletteIndex === idx;
      const card = document.createElement('button');
      card.type = 'button';
      card.title = palette.name;
      card.setAttribute('aria-pressed', String(isSelected));
      card.style.cssText = `
        display: flex; flex-direction: column; align-items: stretch; gap: 3px;
        padding: 3px; background: ${COLORS.background.primary};
        border: ${isSelected ? '2px' : '1px'} solid ${isSelected ? '#7209b7' : COLORS.gray[200]};
        border-radius: ${RADIUS.sm}; cursor: pointer; text-align: left;
        box-shadow: ${isSelected ? '0 1px 4px rgba(114, 9, 183, 0.3)' : 'none'};
        overflow: hidden;
      `;

      const swatchRow = document.createElement('div');
      swatchRow.style.cssText = 'display: flex; height: 16px; border-radius: 2px; overflow: hidden;';
      palette.colors.forEach(c => {
        const sw = document.createElement('div');
        sw.style.cssText = `flex: 1; background: ${safeColor(c)};`;
        swatchRow.appendChild(sw);
      });

      const nameEl = document.createElement('div');
      nameEl.textContent = palette.name;
      nameEl.style.cssText = `
        font-size: 11px; color: ${COLORS.text.secondary}; font-weight: 600;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        line-height: 1.1;
      `;

      card.appendChild(swatchRow);
      card.appendChild(nameEl);

      card.onclick = () => {
        pv.selectedPaletteIndex = idx;
        this.applyPaletteLive();
        this.buildPaletteView();
      };

      grid.appendChild(card);
    });

    wrap.appendChild(grid);
    return wrap;
  }

  _buildAssignmentStep() {
    const pv = this.paletteView;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom: 8px;';

    const headingRow = document.createElement('div');
    headingRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

    const heading = document.createElement('div');
    heading.textContent = '③ Preview assignment';
    heading.style.cssText = `font-weight: 700; font-size: ${TYPOGRAPHY.fontSize.md}; color: ${COLORS.text.primary};`;
    headingRow.appendChild(heading);

    const palette = this.getSelectedPalette();
    if (palette && pv.assignment.length > 1) {
      const shuffleBtn = document.createElement('button');
      shuffleBtn.type = 'button';
      shuffleBtn.textContent = '⇄ Shuffle';
      shuffleBtn.title = 'Rotate which palette color goes to which drum';
      shuffleBtn.style.cssText = `
        padding: 4px 10px; background: ${COLORS.gray[200]}; color: ${COLORS.text.primary};
        border: none; border-radius: ${RADIUS.sm}; cursor: pointer;
        font-size: ${TYPOGRAPHY.fontSize.xs}; font-weight: 600;
      `;
      shuffleBtn.onclick = () => {
        // Rotate colorIndex values forward by 1
        const n = pv.assignment.length;
        pv.assignment = pv.assignment.map((s, i) => ({
          drumId: s.drumId,
          colorIndex: (s.colorIndex + 1) % n
        }));
        this.applyPaletteLive();
        this.buildPaletteView();
      };
      headingRow.appendChild(shuffleBtn);
    }

    wrap.appendChild(headingRow);

    const hint = document.createElement('div');
    hint.textContent = palette
      ? 'Drag a row to reassign which palette color goes to which drum.'
      : 'Pick a palette above to preview the assignment.';
    hint.style.cssText = `font-size: ${TYPOGRAPHY.fontSize.xs}; color: ${COLORS.text.secondary}; margin-bottom: 6px;`;
    wrap.appendChild(hint);

    const list = document.createElement('div');
    list.style.cssText = `
      display: flex; flex-direction: column; gap: 4px;
      padding: 8px; background: ${COLORS.background.secondary};
      border-radius: ${RADIUS.md}; border: 1px solid ${COLORS.gray[200]};
      min-height: 40px;
    `;

    if (pv.assignment.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `color: ${COLORS.text.muted}; font-size: ${TYPOGRAPHY.fontSize.sm}; text-align: center; padding: 8px;`;
      empty.textContent = 'No drums selected.';
      list.appendChild(empty);
    } else {
      pv.assignment.forEach((slot, slotIndex) => {
        const settings = this.drumSettings[slot.drumId];
        if (!settings) return;

        const color = palette ? palette.colors[slot.colorIndex] : settings.color;
        const row = document.createElement('div');
        row.draggable = !!palette;
        row.dataset.slotIndex = slotIndex;
        row.style.cssText = `
          display: flex; align-items: center; gap: 10px;
          padding: 6px 10px; background: ${COLORS.background.primary};
          border: 1px solid ${COLORS.gray[200]}; border-radius: ${RADIUS.sm};
          cursor: ${palette ? 'grab' : 'default'};
          font-size: ${TYPOGRAPHY.fontSize.sm};
        `;

        const chip = document.createElement('span');
        chip.style.cssText = `
          display: inline-block; width: 22px; height: 22px;
          background: ${safeColor(color)}; border-radius: 4px;
          border: 1px solid ${COLORS.border.medium};
          flex-shrink: 0;
        `;

        const arrow = document.createElement('span');
        arrow.textContent = '→';
        arrow.style.cssText = `color: ${COLORS.text.muted};`;

        const drumName = document.createElement('span');
        drumName.textContent = settings.name;
        drumName.style.fontWeight = '600';

        const handle = document.createElement('span');
        handle.textContent = '⋮⋮';
        handle.style.cssText = `margin-left: auto; color: ${COLORS.text.muted}; font-size: ${TYPOGRAPHY.fontSize.md}; display: ${palette ? 'inline' : 'none'};`;

        row.appendChild(chip);
        row.appendChild(arrow);
        row.appendChild(drumName);
        row.appendChild(handle);

        if (palette) {
          this._setupAssignmentDragDrop(row, slotIndex);
        }

        list.appendChild(row);
      });
    }

    wrap.appendChild(list);
    return wrap;
  }

  /**
   * Drag-and-drop: dropping row A onto row B swaps their colorIndex values
   * (the drums stay put, but the palette colors assigned to them swap).
   */
  _setupAssignmentDragDrop(row, slotIndex) {
    row.ondragstart = (e) => {
      this._draggedAssignmentSlot = slotIndex;
      row.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    };

    row.ondragend = () => {
      row.style.opacity = '1';
    };

    row.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.style.outline = `2px dashed #7209b7`;
      row.style.outlineOffset = '-2px';
    };

    row.ondragleave = () => {
      row.style.outline = 'none';
    };

    row.ondrop = (e) => {
      e.preventDefault();
      row.style.outline = 'none';
      const from = this._draggedAssignmentSlot;
      const to = slotIndex;
      this._draggedAssignmentSlot = null;
      if (from === null || from === to) return;

      const pv = this.paletteView;
      const tmp = pv.assignment[from].colorIndex;
      pv.assignment[from].colorIndex = pv.assignment[to].colorIndex;
      pv.assignment[to].colorIndex = tmp;

      this.applyPaletteLive();
      this.buildPaletteView();
    };
  }
}
