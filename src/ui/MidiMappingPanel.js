/**
 * MIDI Mapping Panel
 * Configures Bank Mode (Alesis pads) and Direct Mode mappings
 */

import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { MIDI_MAPPING_PANEL, COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../config/theme.js';

export class MidiMappingPanel {
  constructor(drumSettings, midiManager, notificationSystem, updateIndicatorCallback) {
    this.drumSettings = drumSettings;
    this.midiManager = midiManager;
    this.notificationSystem = notificationSystem;
    this.updateIndicatorCallback = updateIndicatorCallback;
    this.isVisible = false;
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    this.isVisible = !this.isVisible;
    const panel = document.getElementById('midi-mapping-panel');
    const backdrop = document.getElementById('midi-mapping-backdrop');

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
   * Build the MIDI mapping UI
   */
  build() {
    const container = document.getElementById('midi-mapping-container');
    if (!container) return;

    container.innerHTML = '';

    // Clean up bank pad assignments - remove drums that no longer exist
    const validDrumIds = DRUM_KIT_CONFIG.map(d => d.id);
    for (const drumId in this.midiManager.bankPadAssignments) {
      if (!validDrumIds.includes(drumId)) {
        delete this.midiManager.bankPadAssignments[drumId];
      }
    }

    // Mode selector section
    container.appendChild(this.createModeSelector());

    // Bank mode assignments (only show if bank mode enabled)
    if (this.midiManager.bankModeEnabled) {
      container.appendChild(this.createPadAssignments());
      container.appendChild(this.createVariableAssignments());
    } else {
      container.appendChild(this.createDirectModeMessage());
    }
  }

  /**
   * Create mode selector (Bank Mode vs Direct Mode)
   */
  createModeSelector() {
    const section = document.createElement('div');
    section.style.cssText = `margin-bottom: 25px; padding: 15px; background: ${COLORS.background.secondary}; border-radius: ${RADIUS.xl};`;

    const title = document.createElement('h3');
    title.textContent = 'Control Mode';
    title.style.cssText = `margin: 0 0 15px 0; font-size: ${TYPOGRAPHY.fontSize.lg}; color: ${COLORS.text.primary};`;
    section.appendChild(title);

    // Direct Mode option
    const directLabel = document.createElement('label');
    directLabel.style.cssText = `
      display: block;
      cursor: pointer;
      margin-bottom: 10px;
      padding: 10px;
      background: ${COLORS.background.primary};
      border-radius: ${RADIUS.md};
      border: 2px solid ${this.midiManager.bankModeEnabled ? COLORS.border.medium : COLORS.primary.main};
    `;

    const directRadio = document.createElement('input');
    directRadio.type = 'radio';
    directRadio.name = 'control-mode';
    directRadio.checked = !this.midiManager.bankModeEnabled;
    directRadio.onchange = () => {
      this.midiManager.bankModeEnabled = false;
      this.notificationSystem.show('Direct Mode ON');
      if (this.updateIndicatorCallback) this.updateIndicatorCallback();
      this.build();
    };

    const directText = document.createElement('span');
    directText.innerHTML = `<strong>Direct Mode</strong><br><span style="font-size: ${TYPOGRAPHY.fontSize.base}; color: ${COLORS.text.secondary};">Each fader/dial controls a specific drum + variable (use 🎛 buttons in Drum Customization)</span>`;
    directText.style.marginLeft = '8px';

    directLabel.appendChild(directRadio);
    directLabel.appendChild(directText);
    section.appendChild(directLabel);

    // Bank Mode option
    const bankLabel = document.createElement('label');
    bankLabel.style.cssText = `
      display: block;
      cursor: pointer;
      padding: 10px;
      background: ${COLORS.background.primary};
      border-radius: ${RADIUS.md};
      border: 2px solid ${this.midiManager.bankModeEnabled ? COLORS.primary.main : COLORS.border.medium};
    `;

    const bankRadio = document.createElement('input');
    bankRadio.type = 'radio';
    bankRadio.name = 'control-mode';
    bankRadio.checked = this.midiManager.bankModeEnabled;
    bankRadio.onchange = () => {
      this.midiManager.bankModeEnabled = true;
      this.notificationSystem.show('Bank Mode ON');
      if (this.updateIndicatorCallback) this.updateIndicatorCallback();
      this.build();
    };

    const bankText = document.createElement('span');
    bankText.innerHTML = `<strong>Bank Mode</strong><br><span style="font-size: ${TYPOGRAPHY.fontSize.base}; color: ${COLORS.text.secondary};">Hit pad to select drum, faders control selected drum's variables (Alesis workflow)</span>`;
    bankText.style.marginLeft = '8px';

    bankLabel.appendChild(bankRadio);
    bankLabel.appendChild(bankText);
    section.appendChild(bankLabel);

    return section;
  }

  /**
   * Create pad assignments section (Bank Mode pads)
   */
  createPadAssignments() {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 25px;';

    const title = document.createElement('h3');
    title.textContent = 'Pad Assignments (Select Drum)';
    title.style.cssText = `margin: 0 0 15px 0; font-size: ${TYPOGRAPHY.fontSize.lg}; color: ${COLORS.text.primary};`;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;';

    for (const drum of DRUM_KIT_CONFIG) {
      const drumId = drum.id;

      // Skip if no settings exist
      if (!this.drumSettings[drumId]) continue;

      // Ensure assignment exists
      if (!this.midiManager.bankPadAssignments[drumId]) {
        this.midiManager.bankPadAssignments[drumId] = { note: null, deviceId: null };
      }

      const assignment = this.midiManager.bankPadAssignments[drumId];

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        background: ${MIDI_MAPPING_PANEL.drumRow.background};
        border-radius: ${RADIUS.md};
      `;

      const label = document.createElement('span');
      label.textContent = this.drumSettings[drumId]?.name || drum.name;
      label.style.cssText = `font-weight: bold; font-size: ${TYPOGRAPHY.fontSize.md}; flex: 1;`;

      const assignmentDisplay = document.createElement('div');
      assignmentDisplay.style.cssText = 'display: flex; flex-direction: column; gap: 2px; font-size: 10px; margin-right: 5px;';

      if (assignment.note !== null) {
        const noteSpan = document.createElement('span');
        noteSpan.textContent = `Note ${assignment.note}`;
        noteSpan.style.cssText = `color: ${COLORS.primary.main}; font-weight: bold; padding: 3px 8px; background: ${COLORS.primary.bg}; border-radius: ${RADIUS.sm};`;
        assignmentDisplay.appendChild(noteSpan);

        if (assignment.deviceId) {
          // Find device name
          const device = this.midiManager.connectedDevices.find(d => d.id === assignment.deviceId);
          const deviceName = device ? device.name : assignment.deviceId.substring(0, 20);
          const deviceSpan = document.createElement('span');
          deviceSpan.textContent = `${deviceName}`;
          deviceSpan.style.cssText = `color: ${COLORS.success.light}; font-size: ${TYPOGRAPHY.fontSize.xs}; padding: 2px 6px;`;
          assignmentDisplay.appendChild(deviceSpan);
        } else {
          const anyDeviceSpan = document.createElement('span');
          anyDeviceSpan.textContent = 'Any Device';
          anyDeviceSpan.style.cssText = `color: ${COLORS.warning.main}; font-size: ${TYPOGRAPHY.fontSize.xs}; padding: 2px 6px;`;
          assignmentDisplay.appendChild(anyDeviceSpan);
        }
      } else {
        const notSetSpan = document.createElement('span');
        notSetSpan.textContent = 'Not Set';
        notSetSpan.style.cssText = `color: ${COLORS.text.muted};`;
        assignmentDisplay.appendChild(notSetSpan);
      }

      const learnBtn = document.createElement('button');
      learnBtn.textContent = '🎛';
      learnBtn.title = 'Learn Pad';
      learnBtn.style.cssText = `padding: 4px 8px; font-size: ${TYPOGRAPHY.fontSize.base}; background: ${MIDI_MAPPING_PANEL.learnButton.idle}; color: white; border: none; border-radius: ${RADIUS.sm}; cursor: pointer; margin-right: 5px;`;
      learnBtn.onclick = () => {
        this.startBankLearn('pad', drumId, learnBtn);
      };

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove';
      removeBtn.style.cssText = `padding: 2px 6px; font-size: ${TYPOGRAPHY.fontSize.sm}; background: ${COLORS.error.main}; color: white; border: none; border-radius: ${RADIUS.sm}; cursor: pointer;`;
      removeBtn.style.display = assignment.note !== null ? 'inline-block' : 'none';
      removeBtn.onclick = () => {
        this.midiManager.bankPadAssignments[drumId].note = null;
        this.midiManager.bankPadAssignments[drumId].deviceId = null;
        this.build();
      };

      row.appendChild(label);
      row.appendChild(assignmentDisplay);
      row.appendChild(learnBtn);
      row.appendChild(removeBtn);
      grid.appendChild(row);
    }

    section.appendChild(grid);
    return section;
  }

  /**
   * Create global variable assignments section (Bank Mode faders)
   */
  createVariableAssignments() {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 25px;';

    const title = document.createElement('h3');
    title.textContent = 'Global Variable Assignments';
    title.style.cssText = `margin: 0 0 10px 0; font-size: ${TYPOGRAPHY.fontSize.lg}; color: ${COLORS.text.primary};`;
    section.appendChild(title);

    const note = document.createElement('div');
    note.textContent = 'These faders/dials will control the selected drum\'s parameters';
    note.style.cssText = `font-size: ${TYPOGRAPHY.fontSize.base}; color: ${COLORS.text.secondary}; margin-bottom: 15px; font-style: italic;`;
    section.appendChild(note);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; gap: 10px;';

    const variables = [
      { key: 'size', label: 'Size' },
      { key: 'opacity', label: 'Opacity' },
      { key: 'hueVariation', label: 'Hue Variation' },
      { key: 'rotation', label: 'Rotation' },
      { key: 'strokeWeight', label: 'Stroke Weight' }
    ];

    for (const variable of variables) {
      const assignment = this.midiManager.globalVariableAssignments[variable.key];

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        background: ${MIDI_MAPPING_PANEL.drumRow.background};
        border-radius: ${RADIUS.md};
      `;

      const label = document.createElement('span');
      label.textContent = variable.label;
      label.style.cssText = `font-weight: bold; font-size: ${TYPOGRAPHY.fontSize.md}; flex: 1;`;

      const assignmentDisplay = document.createElement('div');
      assignmentDisplay.style.cssText = 'display: flex; flex-direction: column; gap: 2px; font-size: 10px; margin-right: 5px;';

      if (assignment.cc !== null) {
        const rangeInfo = (assignment.ccMin === 0 && assignment.ccMax === 127) ? '' : ` (${assignment.ccMin}-${assignment.ccMax})`;
        const ccSpan = document.createElement('span');
        ccSpan.textContent = `CC${assignment.cc}${rangeInfo}`;
        ccSpan.style.cssText = `color: ${COLORS.primary.main}; font-weight: bold; padding: 3px 8px; background: ${COLORS.primary.bg}; border-radius: ${RADIUS.sm};`;
        assignmentDisplay.appendChild(ccSpan);

        if (assignment.deviceId) {
          // Find device name
          const device = this.midiManager.connectedDevices.find(d => d.id === assignment.deviceId);
          const deviceName = device ? device.name : assignment.deviceId.substring(0, 20);
          const deviceSpan = document.createElement('span');
          deviceSpan.textContent = `${deviceName}`;
          deviceSpan.style.cssText = `color: ${COLORS.success.light}; font-size: ${TYPOGRAPHY.fontSize.xs}; padding: 2px 6px;`;
          assignmentDisplay.appendChild(deviceSpan);
        } else {
          const anyDeviceSpan = document.createElement('span');
          anyDeviceSpan.textContent = 'Any Device';
          anyDeviceSpan.style.cssText = `color: ${COLORS.warning.main}; font-size: ${TYPOGRAPHY.fontSize.xs}; padding: 2px 6px;`;
          assignmentDisplay.appendChild(anyDeviceSpan);
        }
      } else {
        const notSetSpan = document.createElement('span');
        notSetSpan.textContent = 'Not Set';
        notSetSpan.style.cssText = `color: ${COLORS.text.muted};`;
        assignmentDisplay.appendChild(notSetSpan);
      }

      const learnBtn = document.createElement('button');
      learnBtn.textContent = '🎛';
      learnBtn.title = 'Learn Fader/Dial';
      learnBtn.style.cssText = `padding: 4px 8px; font-size: ${TYPOGRAPHY.fontSize.base}; background: ${MIDI_MAPPING_PANEL.learnButton.idle}; color: white; border: none; border-radius: ${RADIUS.sm}; cursor: pointer; margin-right: 5px;`;
      learnBtn.onclick = () => {
        this.startBankLearn('variable', variable.key, learnBtn);
      };

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove';
      removeBtn.style.cssText = `padding: 2px 6px; font-size: ${TYPOGRAPHY.fontSize.sm}; background: ${COLORS.error.main}; color: white; border: none; border-radius: ${RADIUS.sm}; cursor: pointer;`;
      removeBtn.style.display = assignment.cc !== null ? 'inline-block' : 'none';
      removeBtn.onclick = () => {
        this.midiManager.globalVariableAssignments[variable.key].cc = null;
        this.midiManager.globalVariableAssignments[variable.key].ccMin = 0;
        this.midiManager.globalVariableAssignments[variable.key].ccMax = 127;
        this.midiManager.globalVariableAssignments[variable.key].deviceId = null;
        this.build();
      };

      row.appendChild(label);
      row.appendChild(assignmentDisplay);
      row.appendChild(learnBtn);
      row.appendChild(removeBtn);
      grid.appendChild(row);
    }

    section.appendChild(grid);
    return section;
  }

  /**
   * Create direct mode message with drum mappings display
   */
  createDirectModeMessage() {
    const section = document.createElement('div');
    section.style.cssText = `padding: 15px; background: ${COLORS.background.secondary}; border-radius: ${RADIUS.xl};`;

    const title = document.createElement('h3');
    title.textContent = 'Direct Mode - Drum Mappings';
    title.style.cssText = `margin: 0 0 15px 0; font-size: ${TYPOGRAPHY.fontSize.lg}; color: ${COLORS.text.primary};`;
    section.appendChild(title);

    const info = document.createElement('p');
    info.style.cssText = `margin: 0 0 15px 0; font-size: ${TYPOGRAPHY.fontSize.base}; color: ${COLORS.text.secondary};`;
    info.textContent = 'Each drum can be mapped to a specific MIDI device + note. Use 🎹 buttons in Drum Customization to learn mappings.';
    section.appendChild(info);

    // Create table of drum mappings
    const table = document.createElement('div');
    table.style.cssText = 'display: grid; gap: 8px;';

    for (const drum of DRUM_KIT_CONFIG) {
      const drumId = drum.id;
      const settings = this.drumSettings[drumId];
      const midiNote = settings?.midiNote;
      const midiDevice = settings?.midiDevice;

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        background: ${COLORS.background.primary};
        border-radius: ${RADIUS.md};
        border-left: 4px solid ${settings?.color || COLORS.text.secondary};
      `;

      const drumName = document.createElement('span');
      drumName.textContent = settings?.name || drumId;
      drumName.style.cssText = `font-weight: bold; font-size: ${TYPOGRAPHY.fontSize.md}; flex: 1;`;

      const mappingInfo = document.createElement('div');
      mappingInfo.style.cssText = 'display: flex; flex-direction: column; gap: 2px; font-size: 10px;';

      if (midiNote !== undefined && midiNote !== null) {
        const noteSpan = document.createElement('span');
        noteSpan.textContent = `Note: ${midiNote}`;
        noteSpan.style.cssText = `color: ${COLORS.primary.main}; font-weight: bold;`;
        mappingInfo.appendChild(noteSpan);

        if (midiDevice) {
          // Find device name
          const device = this.midiManager.connectedDevices.find(d => d.id === midiDevice);
          const deviceName = device ? device.name : midiDevice.substring(0, 20);
          const deviceSpan = document.createElement('span');
          deviceSpan.textContent = `Device: ${deviceName}`;
          deviceSpan.style.cssText = `color: ${COLORS.success.light};`;
          mappingInfo.appendChild(deviceSpan);
        } else {
          const anyDeviceSpan = document.createElement('span');
          anyDeviceSpan.textContent = 'Device: Any';
          anyDeviceSpan.style.cssText = `color: ${COLORS.warning.main};`;
          mappingInfo.appendChild(anyDeviceSpan);
        }
      } else {
        const notMappedSpan = document.createElement('span');
        notMappedSpan.textContent = 'Not mapped';
        notMappedSpan.style.cssText = `color: ${COLORS.text.muted};`;
        mappingInfo.appendChild(notMappedSpan);
      }

      const clearBtn = document.createElement('button');
      clearBtn.textContent = '×';
      clearBtn.title = 'Clear mapping';
      clearBtn.style.cssText = `padding: 4px 8px; font-size: ${TYPOGRAPHY.fontSize.md}; background: ${COLORS.error.main}; color: white; border: none; border-radius: ${RADIUS.sm}; cursor: pointer;`;
      clearBtn.style.display = midiNote !== undefined && midiNote !== null ? 'block' : 'none';
      clearBtn.onclick = () => {
        settings.midiNote = null;
        settings.midiDevice = null;
        this.notificationSystem.show(`Cleared ${settings.name} mapping`);
        this.build();
      };

      row.appendChild(drumName);
      row.appendChild(mappingInfo);
      row.appendChild(clearBtn);
      table.appendChild(row);
    }

    section.appendChild(table);
    return section;
  }

  /**
   * Start bank mode learn
   */
  startBankLearn(type, target, buttonEl) {
    if (type === 'pad') {
      this.midiManager.startBankPadLearn(target);
    } else {
      this.midiManager.startBankVariableLearn(target);
    }

    buttonEl.textContent = '⏳';
    buttonEl.style.background = MIDI_MAPPING_PANEL.learnButton.active;

    console.log(`Bank Learn: Waiting for ${type === 'pad' ? 'pad hit' : 'fader/dial movement'} for ${target}...`);

    // Setup callback to update UI when learn completes
    const checkLearnComplete = setInterval(() => {
      if (!this.midiManager.bankLearnMode) {
        clearInterval(checkLearnComplete);
        this.build(); // Rebuild to show new assignment
      }
    }, 100);

    // Timeout after 4 seconds
    setTimeout(() => {
      if (this.midiManager.bankLearnMode) {
        this.midiManager.exitLearnMode();
        clearInterval(checkLearnComplete);
        this.build();
        console.log('Bank learn timeout');
      }
    }, 4000);
  }
}
