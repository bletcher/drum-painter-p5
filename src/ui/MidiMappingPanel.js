/**
 * MIDI Mapping Panel
 * Configures Bank Mode (Alesis pads) and Direct Mode mappings
 */

import { DRUM_KIT_CONFIG } from '../config/drumKit.js';

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
    section.style.cssText = 'margin-bottom: 25px; padding: 15px; background: #f8f9fa; border-radius: 8px;';

    const title = document.createElement('h3');
    title.textContent = 'Control Mode';
    title.style.cssText = 'margin: 0 0 15px 0; font-size: 14px; color: #333;';
    section.appendChild(title);

    // Direct Mode option
    const directLabel = document.createElement('label');
    directLabel.style.cssText = `
      display: block;
      cursor: pointer;
      margin-bottom: 10px;
      padding: 10px;
      background: white;
      border-radius: 5px;
      border: 2px solid ${this.midiManager.bankModeEnabled ? '#ddd' : '#667eea'};
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
    directText.innerHTML = '<strong>Direct Mode</strong><br><span style="font-size: 11px; color: #666;">Each fader/dial controls a specific drum + variable (use 🎛 buttons in Drum Customization)</span>';
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
      background: white;
      border-radius: 5px;
      border: 2px solid ${this.midiManager.bankModeEnabled ? '#667eea' : '#ddd'};
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
    bankText.innerHTML = '<strong>Bank Mode</strong><br><span style="font-size: 11px; color: #666;">Hit pad to select drum, faders control selected drum\'s variables (Alesis workflow)</span>';
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
    title.style.cssText = 'margin: 0 0 15px 0; font-size: 14px; color: #333;';
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;';

    for (const drum of DRUM_KIT_CONFIG) {
      const drumId = drum.id;

      // Skip if no settings exist
      if (!this.drumSettings[drumId]) continue;

      // Ensure assignment exists
      if (!this.midiManager.bankPadAssignments[drumId]) {
        this.midiManager.bankPadAssignments[drumId] = { note: null };
      }

      const assignment = this.midiManager.bankPadAssignments[drumId];

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 5px;
      `;

      const label = document.createElement('span');
      label.textContent = this.drumSettings[drumId]?.name || drum.name;
      label.style.cssText = 'font-weight: bold; font-size: 12px; flex: 1;';

      const assignmentDisplay = document.createElement('span');
      if (assignment.note !== null) {
        assignmentDisplay.textContent = `Note ${assignment.note}`;
        assignmentDisplay.style.cssText = 'font-size: 11px; color: #667eea; font-weight: bold; padding: 3px 8px; background: #e8eaff; border-radius: 3px; margin-right: 5px;';
      } else {
        assignmentDisplay.textContent = 'Not Set';
        assignmentDisplay.style.cssText = 'font-size: 11px; color: #999; margin-right: 5px;';
      }

      const learnBtn = document.createElement('button');
      learnBtn.textContent = '🎛';
      learnBtn.title = 'Learn Pad';
      learnBtn.style.cssText = 'padding: 4px 8px; font-size: 11px; background: #667eea; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;';
      learnBtn.onclick = () => {
        this.startBankLearn('pad', drumId, learnBtn);
      };

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove';
      removeBtn.style.cssText = 'padding: 2px 6px; font-size: 10px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;';
      removeBtn.style.display = assignment.note !== null ? 'inline-block' : 'none';
      removeBtn.onclick = () => {
        this.midiManager.bankPadAssignments[drumId].note = null;
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
    title.style.cssText = 'margin: 0 0 10px 0; font-size: 14px; color: #333;';
    section.appendChild(title);

    const note = document.createElement('div');
    note.textContent = 'These faders/dials will control the selected drum\'s parameters';
    note.style.cssText = 'font-size: 11px; color: #666; margin-bottom: 15px; font-style: italic;';
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
        background: #f8f9fa;
        border-radius: 5px;
      `;

      const label = document.createElement('span');
      label.textContent = variable.label;
      label.style.cssText = 'font-weight: bold; font-size: 12px; flex: 1;';

      const assignmentDisplay = document.createElement('span');
      if (assignment.cc !== null) {
        const rangeInfo = (assignment.ccMin === 0 && assignment.ccMax === 127) ? '' : ` (${assignment.ccMin}-${assignment.ccMax})`;
        assignmentDisplay.textContent = `CC${assignment.cc}${rangeInfo}`;
        assignmentDisplay.style.cssText = 'font-size: 11px; color: #667eea; font-weight: bold; padding: 3px 8px; background: #e8eaff; border-radius: 3px; margin-right: 5px;';
      } else {
        assignmentDisplay.textContent = 'Not Set';
        assignmentDisplay.style.cssText = 'font-size: 11px; color: #999; margin-right: 5px;';
      }

      const learnBtn = document.createElement('button');
      learnBtn.textContent = '🎛';
      learnBtn.title = 'Learn Fader/Dial';
      learnBtn.style.cssText = 'padding: 4px 8px; font-size: 11px; background: #667eea; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 5px;';
      learnBtn.onclick = () => {
        this.startBankLearn('variable', variable.key, learnBtn);
      };

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove';
      removeBtn.style.cssText = 'padding: 2px 6px; font-size: 10px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;';
      removeBtn.style.display = assignment.cc !== null ? 'inline-block' : 'none';
      removeBtn.onclick = () => {
        this.midiManager.globalVariableAssignments[variable.key].cc = null;
        this.midiManager.globalVariableAssignments[variable.key].ccMin = 0;
        this.midiManager.globalVariableAssignments[variable.key].ccMax = 127;
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
   * Create direct mode message
   */
  createDirectModeMessage() {
    const message = document.createElement('div');
    message.style.cssText = 'padding: 20px; background: #e8eaff; border-radius: 8px; text-align: center;';
    message.innerHTML = `
      <p style="margin: 0; font-size: 13px; color: #667eea;"><strong>Direct Mode Active</strong></p>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
        Use the 🎛 learn buttons in the Drum Customization panel to assign controllers to specific drum parameters.
      </p>
    `;
    return message;
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
    buttonEl.style.background = '#ff6b35';

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
