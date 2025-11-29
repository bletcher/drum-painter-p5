/**
 * MIDI Mapping Panel
 * Configures Bank Mode MIDI mappings (Alesis workflow)
 */

import { DRUM_KIT_CONFIG } from '../config/drumKit.js';
import { MIDI_MAPPING_PANEL, COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../config/theme.js';
import { debugLog, debugWarn, debugError, infoLog } from '../utils/debug.js';

export class MidiMappingPanel {
  constructor(drumSettings, midiManager, notificationSystem, updateIndicatorCallback) {
    this.drumSettings = drumSettings;
    this.midiManager = midiManager;
    this.notificationSystem = notificationSystem;
    this.updateIndicatorCallback = updateIndicatorCallback;
    this.isVisible = false;

    // Track open/closed state of collapsible sections
    this.sectionStates = {
      'Pad Assignments (Select Drum)': true,
      'Per-Drum Parameters': true,
      'Splatter Parameters (Global)': false,
      'Brush Parameters (Global)': false
    };
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

    // Save current section states before rebuilding (except on first build)
    this.saveSectionStates();

    container.innerHTML = '';

    // Clean up bank pad assignments - remove drums that no longer exist
    const validDrumIds = DRUM_KIT_CONFIG.map(d => d.id);
    for (const drumId in this.midiManager.bankPadAssignments) {
      if (!validDrumIds.includes(drumId)) {
        delete this.midiManager.bankPadAssignments[drumId];
      }
    }

    // Enable bank mode
    this.midiManager.bankModeEnabled = true;

    // Info section
    container.appendChild(this.createInfoSection());

    // Bank mode sections
    container.appendChild(this.createPadAssignments());
    container.appendChild(this.createVariableAssignments());
  }

  /**
   * Create info section explaining Bank Mode
   */
  createInfoSection() {
    const section = document.createElement('div');
    section.style.cssText = `margin-bottom: 25px; padding: 15px; background: ${COLORS.background.secondary}; border-radius: ${RADIUS.xl};`;

    const title = document.createElement('h3');
    title.textContent = 'Bank Mode - Alesis Workflow';
    title.style.cssText = `margin: 0 0 10px 0; font-size: ${TYPOGRAPHY.fontSize.lg}; color: ${COLORS.text.primary};`;
    section.appendChild(title);

    const description = document.createElement('p');
    description.style.cssText = `margin: 0; font-size: ${TYPOGRAPHY.fontSize.base}; color: ${COLORS.text.secondary}; line-height: 1.5;`;
    description.innerHTML = `
      <strong>How it works:</strong><br>
      1. Hit a pad to select which drum you want to control<br>
      2. Use faders/dials to adjust parameters for the selected drum<br>
      3. Direct drum-to-MIDI note mappings are configured in the <strong>Customize Drums</strong> panel (🎹 buttons)
    `;
    section.appendChild(description);

    return section;
  }

  /**
   * Save current open/closed state of sections before rebuild
   */
  saveSectionStates() {
    const container = document.getElementById('midi-mapping-container');
    if (!container) return;

    // Find all section headers and save their state
    const headers = container.querySelectorAll('[data-section-title]');
    headers.forEach(header => {
      const titleText = header.getAttribute('data-section-title');
      const content = header.nextElementSibling;
      if (content && titleText) {
        this.sectionStates[titleText] = content.style.display !== 'none';
      }
    });
  }

  /**
   * Create collapsible section wrapper
   */
  createCollapsibleSection(titleText, defaultOpen = true) {
    // Use saved state if available, otherwise use default
    const isOpen = this.sectionStates.hasOwnProperty(titleText)
      ? this.sectionStates[titleText]
      : defaultOpen;

    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 25px;';

    const header = document.createElement('div');
    header.setAttribute('data-section-title', titleText); // Mark for state tracking
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      padding: 12px;
      background: ${COLORS.background.secondary};
      border-radius: ${RADIUS.md};
      margin-bottom: 15px;
      transition: background 0.2s;
    `;
    header.onmouseover = () => header.style.background = COLORS.background.tertiary;
    header.onmouseout = () => header.style.background = COLORS.background.secondary;

    const title = document.createElement('h3');
    title.textContent = titleText;
    title.style.cssText = `margin: 0; font-size: ${TYPOGRAPHY.fontSize.lg}; color: ${COLORS.text.primary};`;

    const icon = document.createElement('span');
    icon.textContent = isOpen ? '▼' : '▶';
    icon.style.cssText = `font-size: ${TYPOGRAPHY.fontSize.sm}; color: ${COLORS.text.secondary}; transition: transform 0.2s;`;

    header.appendChild(title);
    header.appendChild(icon);

    const content = document.createElement('div');
    content.style.display = isOpen ? 'block' : 'none';
    content.style.cssText += ' transition: all 0.3s ease;';

    header.onclick = () => {
      const isOpen = content.style.display !== 'none';
      content.style.display = isOpen ? 'none' : 'block';
      icon.textContent = isOpen ? '▶' : '▼';
      // Save state when manually toggled
      this.sectionStates[titleText] = !isOpen;
    };

    section.appendChild(header);
    section.appendChild(content);

    return { section, content };
  }

  /**
   * Create pad assignments section (Bank Mode pads)
   */
  createPadAssignments() {
    const { section, content } = this.createCollapsibleSection('Pad Assignments (Select Drum)', true);

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

    content.appendChild(grid);
    return section;
  }

  /**
   * Create global variable assignments section (Bank Mode faders)
   */
  createVariableAssignments() {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 25px;';

    const note = document.createElement('div');
    note.textContent = 'Faders/dials control the selected drum\'s parameters';
    note.style.cssText = `font-size: ${TYPOGRAPHY.fontSize.base}; color: ${COLORS.text.secondary}; margin-bottom: 15px; font-style: italic;`;
    section.appendChild(note);

    // Per-Drum Parameters
    const perDrumVars = [
      { key: 'size', label: 'Size' },
      { key: 'opacity', label: 'Opacity' },
      { key: 'hueVariation', label: 'Hue Variation' },
      { key: 'rotation', label: 'Rotation' },
      { key: 'strokeWeight', label: 'Stroke Weight' }
    ];
    section.appendChild(this.createVariableSubsection('Per-Drum Parameters', perDrumVars, true));

    // Splatter Parameters
    const splatterVars = [
      { key: 'splatterDensity', label: 'Splatter Density' },
      { key: 'splatterConnectionThickness', label: 'Connection Thickness' },
      { key: 'splatterSprayIntensity', label: 'Spray Intensity' },
      { key: 'splatterConnectionAmount', label: 'Connection Amount' },
      { key: 'splatterCoreSize', label: 'Core Size' },
      { key: 'splatterSpraySize', label: 'Spray Dot Size' }
    ];
    section.appendChild(this.createVariableSubsection('Splatter Parameters (Global)', splatterVars, false));

    // Brush Parameters
    const brushVars = [
      { key: 'brushDensity', label: 'Brush Density' },
      { key: 'brushOpacity', label: 'Brush Opacity' },
      { key: 'brushEdgeSoftness', label: 'Edge Softness' },
      { key: 'brushStrokeVariation', label: 'Stroke Variation' }
    ];
    section.appendChild(this.createVariableSubsection('Brush Parameters (Global)', brushVars, false));

    return section;
  }

  /**
   * Create a collapsible subsection for a group of variables
   */
  createVariableSubsection(title, variables, defaultOpen) {
    const { section: subsection, content } = this.createCollapsibleSection(title, defaultOpen);

    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; gap: 10px;';

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

      if (assignment && assignment.cc !== null) {
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
      removeBtn.style.display = (assignment && assignment.cc !== null) ? 'inline-block' : 'none';
      removeBtn.onclick = () => {
        if (this.midiManager.globalVariableAssignments[variable.key]) {
          this.midiManager.globalVariableAssignments[variable.key].cc = null;
          this.midiManager.globalVariableAssignments[variable.key].ccMin = 0;
          this.midiManager.globalVariableAssignments[variable.key].ccMax = 127;
          this.midiManager.globalVariableAssignments[variable.key].deviceId = null;
          this.build();
        }
      };

      row.appendChild(label);
      row.appendChild(assignmentDisplay);
      row.appendChild(learnBtn);
      row.appendChild(removeBtn);
      grid.appendChild(row);
    }

    content.appendChild(grid);
    return subsection;
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

    debugLog(`Bank Learn: Waiting for ${type === 'pad' ? 'pad hit' : 'fader/dial movement'} for ${target}...`);

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
        debugLog('Bank learn timeout');
      }
    }, 4000);
  }
}
