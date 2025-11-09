/**
 * Drum Customization Panel
 * Full-featured tabbed UI for drum settings with add/delete functionality
 */

import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { SCALING_CURVES, SCALING_CURVE_NAMES, SHAPE_OPTIONS } from '../config/constants.js';

export class DrumCustomizationPanel {
  constructor(drumSettings, midiManager, stateManager, notificationSystem) {
    this.drumSettings = drumSettings;
    this.midiManager = midiManager;
    this.stateManager = stateManager;
    this.notificationSystem = notificationSystem;
    this.currentTab = DRUM_KIT_CONFIG[0]?.id || 'kick';
    this.isVisible = false;
    this.draggedTabIndex = null;
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
      border-bottom: 2px solid #e9ecef;
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
      border: 2px dashed #ccc;
      background: #f8f9fa;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      color: #666;
      font-size: 18px;
      font-weight: bold;
      transition: all 0.2s;
    `;
    addButton.onmouseover = () => {
      addButton.style.background = '#e9ecef';
      addButton.style.borderColor = '#999';
    };
    addButton.onmouseout = () => {
      addButton.style.background = '#f8f9fa';
      addButton.style.borderColor = '#ccc';
    };
    addButton.onclick = () => this.addNewDrum();
    tabNav.appendChild(addButton);

    container.appendChild(tabNav);
    container.appendChild(tabContent);
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
      background: ${isActive ? 'white' : '#f8f9fa'};
      border-top: 3px solid ${isActive ? settings.color : 'transparent'};
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      font-weight: ${isActive ? 'bold' : 'normal'};
      color: ${isActive ? '#333' : '#666'};
      transition: all 0.2s;
      position: relative;
      font-size: 12px;
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
    midiNote.style.cssText = 'color: #999; font-size: 9px;';

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
        tabButton.style.background = '#e9ecef';
      }
    };
    tabButton.onmouseout = () => {
      if (!isActive) {
        tabButton.style.background = '#f8f9fa';
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
      tabButton.style.background = '#d0d0d0';
    };

    tabButton.ondragleave = (e) => {
      tabButton.style.background = tabButton.dataset.drumId === this.currentTab ? 'white' : '#f8f9fa';
    };

    tabButton.ondrop = (e) => {
      e.preventDefault();
      if (this.draggedTabIndex !== null && this.draggedTabIndex !== index) {
        // Reorder drums
        const movedDrum = DRUM_KIT_CONFIG.splice(this.draggedTabIndex, 1)[0];
        DRUM_KIT_CONFIG.splice(index, 0, movedDrum);
        this.draggedTabIndex = null;
        this.build();
        this.notificationSystem.show('Drum order updated');
      }
      tabButton.style.background = tabButton.dataset.drumId === this.currentTab ? 'white' : '#f8f9fa';
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
      background: white;
      border-radius: 0 8px 8px 8px;
      border: 1px solid #e9ecef;
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
      <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 10px; color: #666;">Name</label>
      <input type="text" id="name-${drumId}" value="${settings.name}"
        style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;"
        placeholder="Drum name">
    `;

    const input = group.querySelector(`#name-${drumId}`);
    input.onchange = () => {
      this.drumSettings[drumId].name = input.value;
      const label = document.getElementById(`tab-label-${drumId}`);
      if (label) label.textContent = input.value;
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
      <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 10px; color: #666;">Note</label>
      <div style="display: flex; gap: 3px;">
        <input type="number" id="midinote-${drumId}" value="${settings.midiNote !== null && settings.midiNote !== undefined ? settings.midiNote : ''}" min="0" max="127"
          style="width: 100%; padding: 5px 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px; text-align: center;">
        <button id="learn-${drumId}" title="Learn MIDI Note" style="
          padding: 5px 7px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          flex-shrink: 0;
        ">🎛</button>
      </div>
    `;

    const input = group.querySelector(`#midinote-${drumId}`);
    input.onchange = () => {
      this.drumSettings[drumId].midiNote = parseInt(input.value);
    };

    const learnButton = group.querySelector(`#learn-${drumId}`);
    learnButton.onclick = () => {
      this.midiManager.startMidiLearn(drumId);
      learnButton.textContent = '⏳';
      learnButton.style.background = '#ff6b35';

      // Update when learn completes
      const originalCallback = this.midiManager.onDrumNoteAssigned;
      this.midiManager.onDrumNoteAssigned = (learnedDrumId, note, deviceId) => {
        if (originalCallback) originalCallback(learnedDrumId, note, deviceId);
        if (learnedDrumId === drumId) {
          input.value = note;
          learnButton.textContent = '🎛';
          learnButton.style.background = '#667eea';
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
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
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
      <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 10px; color: #666;">Color</label>
      <input type="color" id="color-${drumId}" value="${settings.color}"
        style="width: 100%; height: 28px; border: 1px solid #ddd; border-radius: 3px; cursor: pointer;">
    `;

    const input = group.querySelector(`#color-${drumId}`);
    input.oninput = () => {
      this.drumSettings[drumId].color = input.value;
      this.updatePreview(drumId);
      // Update tab color
      const tabBtn = document.getElementById(`tab-btn-${drumId}`);
      if (tabBtn && drumId === this.currentTab) {
        tabBtn.style.borderTopColor = input.value;
      }
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
      <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 10px; color: #666;">Shape</label>
      <select id="shape-${drumId}" style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px; cursor: pointer;">
        ${SHAPE_OPTIONS.map(shape => `<option value="${shape}" ${settings.shape === shape ? 'selected' : ''}>${shape.charAt(0).toUpperCase() + shape.slice(1)}</option>`).join('')}
      </select>
    `;

    const select = group.querySelector(`#shape-${drumId}`);
    select.onchange = () => {
      this.drumSettings[drumId].shape = select.value;
      this.updatePreview(drumId);
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
      settings.sizeScaling || 'linear'
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
      settings.opacityScaling || 'linear'
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
      30,
      1,
      '°',
      settings.hueScaling || 'linear'
    );
  }

  /**
   * Create stroke settings section
   */
  createStrokeSection(drumId, settings) {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px;';

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
    };

    const controls = document.createElement('div');
    controls.style.display = settings.strokeEnabled ? 'block' : 'none';

    // Stroke color
    const colorDiv = document.createElement('div');
    colorDiv.style.cssText = 'margin-bottom: 10px;';
    colorDiv.innerHTML = `
      <label style="display: block; margin-bottom: 5px; font-size: 11px;">Stroke Color</label>
      <input type="color" id="stroke-color-${drumId}" value="${settings.strokeColor || '#000000'}"
        style="width: 100%; height: 30px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">
    `;
    controls.appendChild(colorDiv);

    const colorInput = colorDiv.querySelector(`#stroke-color-${drumId}`);
    colorInput.oninput = () => {
      this.drumSettings[drumId].strokeColor = colorInput.value;
      this.updatePreview(drumId);
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
      <label style="font-weight: 600; font-size: 10px; color: #666;">${label}</label>
      <span id="${paramKey}-val-${drumId}" style="font-size: 10px; font-weight: bold; color: #666;">${value}${unit}</span>
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
    labelEl.style.cssText = 'font-weight: 600; font-size: 10px; color: #666; min-width: 60px;';
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
    };
    controls.appendChild(slider);

    // Value display
    const valueSpan = document.createElement('span');
    valueSpan.id = `${paramKey}-val-${drumId}`;
    valueSpan.textContent = `${value}${unit}`;
    valueSpan.style.cssText = 'min-width: 30px; font-weight: bold; color: #666; font-size: 10px;';
    controls.appendChild(valueSpan);

    // Velocity scaling dropdown
    const scalingSelect = document.createElement('select');
    scalingSelect.id = `${paramKey}-scaling-${drumId}`;
    scalingSelect.style.cssText = 'min-width: 60px; padding: 2px; border: 1px solid #ddd; border-radius: 3px; font-size: 9px; cursor: pointer;';
    scalingSelect.innerHTML = Object.entries(SCALING_CURVE_NAMES).map(([key, name]) =>
      `<option value="${key}" ${scalingCurve === key ? 'selected' : ''}>${name}</option>`
    ).join('');
    scalingSelect.onchange = () => {
      this.drumSettings[drumId][`${paramKey}Scaling`] = scalingSelect.value;
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
      ccDisplay.style.cssText = 'font-size: 9px; color: #667eea; font-weight: bold; padding: 2px 4px; background: #e8eaff; border-radius: 3px;';

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove MIDI CC mapping';
      removeBtn.style.cssText = 'padding: 1px 4px; font-size: 10px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;';
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
      learnBtn.style.cssText = 'padding: 2px 5px; font-size: 11px; background: #667eea; color: white; border: none; border-radius: 3px; cursor: pointer;';
      learnBtn.onclick = () => {
        this.midiManager.startCCLearn(drumId, paramKey);
        learnBtn.textContent = '⏳';
        learnBtn.style.background = '#ff6b35';
        console.log(`CC Learn Mode: Move controller through FULL range for ${drumId}.${paramKey} (3 seconds)`);

        setTimeout(() => {
          if (this.midiManager.ccLearnMode) {
            this.midiManager.exitLearnMode();
            learnBtn.textContent = '🎛';
            learnBtn.style.background = '#667eea';
            console.log('CC Learn timeout - no controller detected');
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
    group.style.cssText = 'text-align: center; padding: 6px; background: white; border-radius: 3px; border: 1px solid #e0e0e0; margin-bottom: 0;';
    group.innerHTML = `
      <small style="color: #666; display: block; margin-bottom: 2px; font-size: 9px;">Preview</small>
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
    const size = 50;
    const canvas = document.createElement('canvas');
    canvas.width = size + 20;
    canvas.height = size + 20;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((settings.rotation || 0) * Math.PI / 180);

    // Set fill
    ctx.fillStyle = settings.color;

    // Set stroke
    if (settings.strokeEnabled) {
      ctx.strokeStyle = settings.strokeColor || '#000000';
      ctx.lineWidth = settings.strokeWeight || 2;
    }

    // Draw shape
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

    ctx.restore();

    previewDiv.innerHTML = '';
    previewDiv.appendChild(canvas);
  }

  /**
   * Add a new drum to the kit
   */
  addNewDrum() {
    const drumNumber = DRUM_KIT_CONFIG.length + 1;
    const newId = `drum_${Date.now()}`;

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
      color: newDrum.defaultColor,
      shape: 'circle',
      opacity: 1.0,
      opacityScaling: 'linear',
      size: 1.0,
      sizeScaling: 'linear',
      strokeEnabled: false,
      strokeWeight: 2,
      strokeColor: '#000000',
      hueVariation: 0,
      hueScaling: 'linear',
      rotation: 0,
      midiCC: {
        size: { cc: null, min: 30, max: 300, ccMin: 0, ccMax: 127 },
        opacity: { cc: null, min: 10, max: 100, ccMin: 0, ccMax: 127 },
        hueVariation: { cc: null, min: 0, max: 30, ccMin: 0, ccMax: 127 },
        rotation: { cc: null, min: 0, max: 360, ccMin: 0, ccMax: 127 },
        strokeWeight: { cc: null, min: 1, max: 10, ccMin: 0, ccMax: 127 }
      }
    };

    this.currentTab = newId;
    this.build();
    this.notificationSystem.show(`Added ${newDrum.name}`);
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

    // Remove settings
    delete this.drumSettings[drumId];

    // Switch to first drum
    this.currentTab = DRUM_KIT_CONFIG[0].id;

    this.build();
    this.notificationSystem.show('Drum deleted');
  }
}
