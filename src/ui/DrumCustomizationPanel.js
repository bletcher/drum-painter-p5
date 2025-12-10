/**
 * Drum Customization Panel
 * Full-featured tabbed UI for drum settings with add/delete functionality
 */

import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { SCALING_CURVES, SCALING_CURVE_NAMES, SHAPE_OPTIONS } from '../config/constants.js';
import { CUSTOMIZATION_PANEL, COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../config/theme.js';
import { drawSplatterCanvas, drawBrushStrokeCanvas, drawInkBlotCanvas } from '../canvas/DrawingUtils.js';
import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';

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
    } else {
      panel.style.display = 'none';
      backdrop.style.display = 'none';
    }
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
    addButton.innerHTML = '+';
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

    // Apply dark mode if enabled
    if (this.darkModeManager) {
      this.darkModeManager.apply();
    }
  }

  /**
   * Create a tab button
   */
  createTabButton(drum, settings, index, isActive) {
    const tabButton = document.createElement('button');
    tabButton.id = `tab-btn-${drum.id}`;
    tabButton.draggable = true;
    tabButton.dataset.drumId = drum.id;
    tabButton.dataset.drumIndex = index;
    tabButton.style.cssText = `
      flex: 1;
      padding: 10px;
      border: none;
      background: ${isActive ? CUSTOMIZATION_PANEL.tab.active : CUSTOMIZATION_PANEL.tab.inactive};
      border-top: 3px solid ${isActive ? settings.color : 'transparent'};
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
    topRow.style.cssText = 'display: grid; grid-template-columns: 2fr 1.5fr 1fr 1.5fr; gap: 6px; margin-bottom: 8px;';
    topRow.appendChild(this.createNameSection(drum.id, settings));
    topRow.appendChild(this.createMidiNoteSection(drum.id, settings));
    topRow.appendChild(this.createColorSection(drum.id, settings));
    topRow.appendChild(this.createShapeSection(drum.id, settings));
    content.appendChild(topRow);

    // Create 2-column grid container for remaining controls
    const grid = document.createElement('div');
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
    group.innerHTML = `
      <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">Name</label>
      <input type="text" id="name-${drumId}" value="${settings.name}"
        style="width: 100%; padding: 5px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.sm}; font-size: ${TYPOGRAPHY.fontSize.md};"
        placeholder="Drum name">
    `;

    const input = group.querySelector(`#name-${drumId}`);
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

    group.innerHTML = `
      <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">Note</label>
      <div style="display: flex; gap: 3px;">
        <input type="number" id="midinote-${drumId}" value="${settings.midiNote !== null && settings.midiNote !== undefined ? settings.midiNote : ''}" min="0" max="127"
          style="width: 100%; padding: 5px 4px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.sm}; font-size: ${TYPOGRAPHY.fontSize.md}; text-align: center;">
        <button id="learn-${drumId}" title="Learn MIDI Note" style="
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

    const input = group.querySelector(`#midinote-${drumId}`);
    input.onchange = () => {
      this.drumSettings[drumId].midiNote = parseInt(input.value);
      this.scheduleAutoSave();
    };

    const learnButton = group.querySelector(`#learn-${drumId}`);
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
    group.innerHTML = `
      <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">Color</label>
      <input type="color" id="color-${drumId}" value="${settings.color}"
        style="width: 100%; height: 28px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.sm}; cursor: pointer;">
    `;

    const input = group.querySelector(`#color-${drumId}`);
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
        tabBtn.style.borderTopColor = newColor;
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
    group.innerHTML = `
      <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">Shape</label>
      <select id="shape-${drumId}" style="width: 100%; padding: 5px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.sm}; font-size: ${TYPOGRAPHY.fontSize.base}; cursor: pointer;">
        ${SHAPE_OPTIONS.map(shape => `<option value="${shape}" ${settings.shape === shape ? 'selected' : ''}>${shape.charAt(0).toUpperCase() + shape.slice(1)}</option>`).join('')}
      </select>
    `;

    const select = group.querySelector(`#shape-${drumId}`);
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
      <label style="font-weight: bold; font-size: 12px;">Stroke Outline</label>
      <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
        <input type="checkbox" id="stroke-enabled-${drumId}" ${settings.strokeEnabled ? 'checked' : ''}>
        <span style="font-size: 11px;">Enabled</span>
      </label>
    `;
    group.appendChild(header);

    const checkbox = header.querySelector(`#stroke-enabled-${drumId}`);
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
    colorDiv.innerHTML = `
      <label style="display: block; margin-bottom: 5px; font-size: ${TYPOGRAPHY.fontSize.base};">Stroke Color</label>
      <input type="color" id="stroke-color-${drumId}" value="${settings.strokeColor || '#000000'}"
        style="width: 100%; height: 30px; border: 1px solid ${COLORS.border.medium}; border-radius: ${RADIUS.md}; cursor: pointer;">
    `;
    controls.appendChild(colorDiv);

    const colorInput = colorDiv.querySelector(`#stroke-color-${drumId}`);
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
    labelDiv.innerHTML = `
      <label style="font-weight: 600; font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary};">${label}</label>
      <span id="${paramKey}-val-${drumId}" style="font-size: ${TYPOGRAPHY.fontSize.sm}; font-weight: bold; color: ${COLORS.text.secondary};">${value}${unit}</span>
    `;
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
      labelDiv.querySelector(`#${paramKey}-val-${drumId}`).textContent = `${val}${unit}`;
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
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove MIDI CC mapping';
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
      learnBtn.textContent = '🎛';
      learnBtn.title = 'Learn MIDI CC';
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
      <div id="preview-${drumId}" style="display: inline-block;"></div>
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
}
