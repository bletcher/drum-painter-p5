/**
 * Panels
 *
 * Behaviour for the static panels in index.html (this used to live in inline
 * <script> blocks):
 *   - dragging the left (#controls) and right (#drum-settings) panels by their
 *     headers, with Pointer Events so mouse, touch and pen all work
 *   - collapsing either panel to its header (remembered in localStorage)
 *   - collapsible sections marked up as [data-collapsible] in the left panel
 *   - stopping pointer/mouse/touch/wheel events on panels from reaching the
 *     p5 canvas handlers (which listen on window)
 *   - keeping the user guide's tabs' aria-selected state in sync
 *
 * Call initPanels() once after the DOM is ready (main.js does this in setup()).
 */

const NARROW_QUERY = '(max-width: 760px)';

const STORAGE = {
  quickSettings: 'quickSettingsCollapsed',
  controls: 'controlsPanelCollapsed',
  sections: 'controlPanelCollapsedSections'
};

// Elements whose events must not reach the canvas
const GUARDED_IDS = [
  'controls',
  'drum-settings',
  'customization-panel',
  'customization-backdrop',
  'midi-mapping-panel',
  'midi-mapping-backdrop',
  'shortcuts-panel',
  'shortcuts-backdrop',
  'midi-devices-panel',
  'midi-devices-backdrop',
  'user-guide-backdrop',
  'save-recording-backdrop',
  'sync-preview-backdrop'
];

// Note: 'mouseup'/'pointerup' are deliberately NOT stopped — canvas drags
// (metronome, scrollbar) rely on the release reaching window even over a panel.
const GUARDED_EVENTS = ['mousedown', 'click', 'dblclick', 'pointerdown', 'touchstart', 'touchmove', 'wheel'];

let initialized = false;

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — state lasts for this session only
  }
}

function isNarrow() {
  return !!window.matchMedia?.(NARROW_QUERY).matches;
}

/**
 * Stop events on an element from bubbling up to window (where p5 listens).
 * @param {HTMLElement} el
 */
export function guardCanvasEvents(el) {
  if (!el || el.dataset.canvasGuard === '1') return;
  el.dataset.canvasGuard = '1';
  for (const type of GUARDED_EVENTS) {
    el.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }
}

/**
 * Make a fixed-position panel draggable by a handle element.
 * The offset is applied as a CSS transform (cleared by CSS on narrow screens).
 */
function makeDraggable(panel, handle) {
  if (!panel || !handle) return;

  let drag = null;
  let offsetX = 0;
  let offsetY = 0;

  const setTranslate = () => {
    panel.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  };

  handle.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Buttons inside the header (collapse) must still be clickable
    if (e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    // Panels are docked sheets on small screens
    if (isNarrow()) return;

    const rect = panel.getBoundingClientRect();
    drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
      // Panel position without any drag offset
      baseLeft: rect.left - offsetX,
      baseTop: rect.top - offsetY,
      width: rect.width
    };

    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers throw for synthetic pointers; dragging still works while over the handle
    }
    window.isDraggingControls = true;
    panel.classList.add('is-dragging');
    e.preventDefault();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();

    let x = drag.startOffsetX + (e.clientX - drag.startX);
    let y = drag.startOffsetY + (e.clientY - drag.startY);

    // Keep at least part of the header on screen so the panel can't be lost
    const minVisible = 60;
    const minX = -(drag.baseLeft + drag.width - minVisible);
    const maxX = window.innerWidth - minVisible - drag.baseLeft;
    const minY = -drag.baseTop;
    const maxY = window.innerHeight - 40 - drag.baseTop;
    x = Math.min(Math.max(x, minX), maxX);
    y = Math.min(Math.max(y, minY), maxY);

    offsetX = x;
    offsetY = y;
    setTranslate();
  });

  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== undefined && e.pointerId !== drag.pointerId)) return;
    try {
      if (handle.hasPointerCapture?.(drag.pointerId)) handle.releasePointerCapture(drag.pointerId);
    } catch {
      // ignore
    }
    drag = null;
    window.isDraggingControls = false;
    panel.classList.remove('is-dragging');
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('lostpointercapture', endDrag);
}

/**
 * Collapse a panel down to its header.
 * @param {object} cfg
 */
function makeCollapsible({ panel, button, content, storageKey, label, defaultCollapsedOnNarrow }) {
  if (!panel || !button || !content) return;

  const saved = storageGet(storageKey);
  const initial = saved === null ? (defaultCollapsedOnNarrow && isNarrow()) : saved === 'true';

  const apply = (collapsed, persist) => {
    content.hidden = collapsed;
    panel.classList.toggle('is-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${label}`);
    button.title = collapsed ? 'Expand' : 'Collapse';
    if (persist) storageSet(storageKey, String(collapsed));
  };

  apply(initial, false);

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    apply(!content.hidden, true);
  });
}

/**
 * Collapsible sections:
 *   <section data-collapsible="paint-mode" data-default-open="true">
 *     <h2><button class="section-toggle">…</button></h2>
 *     <div class="section-body">…</div>
 *   </section>
 * State is stored in localStorage 'controlPanelCollapsedSections' as
 * { [id]: collapsed }.
 */
function initCollapsibleSections(root = document) {
  let state = {};
  try {
    state = JSON.parse(storageGet(STORAGE.sections) || '{}') || {};
  } catch {
    state = {};
  }

  root.querySelectorAll('[data-collapsible]').forEach((section) => {
    const id = section.dataset.collapsible;
    const toggle = section.querySelector('.section-toggle');
    const body = section.querySelector('.section-body');
    if (!id || !toggle || !body) return;

    if (!body.id) body.id = `section-${id}-body`;
    toggle.setAttribute('aria-controls', body.id);

    const defaultOpen = section.dataset.defaultOpen !== 'false';
    // Older versions derived keys from the emoji title, e.g. "-paint-mode"
    const savedValue = state[id] ?? state[`-${id}`];
    const collapsed = typeof savedValue === 'boolean' ? savedValue : !defaultOpen;

    const apply = (isCollapsed) => {
      body.hidden = isCollapsed;
      toggle.setAttribute('aria-expanded', String(!isCollapsed));
    };
    apply(collapsed);

    toggle.addEventListener('click', () => {
      const nowCollapsed = !body.hidden;
      apply(nowCollapsed);
      state[id] = nowCollapsed;
      storageSet(STORAGE.sections, JSON.stringify(state));
    });
  });
}

/**
 * Keep role="tab" state in sync for the user guide tabs. main.js switches the
 * visible content on click; this only maintains aria-selected/tabindex and adds
 * arrow-key navigation between tabs.
 */
function initGuideTabs() {
  const tablist = document.querySelector('.guide-tabs[role="tablist"]');
  if (!tablist) return;
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  if (tabs.length === 0) return;

  const select = (tab) => {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    });
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => select(tab)));

  tablist.addEventListener('keydown', (e) => {
    const index = tabs.indexOf(document.activeElement);
    if (index === -1) return;
    let next = null;
    if (e.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    // Keep the arrow keys away from the global mode-switch shortcuts
    e.preventDefault();
    e.stopPropagation();
    next.focus();
    next.click();
  });
}

/**
 * Wire up all static panel behaviour. Safe to call more than once.
 */
export function initPanels() {
  if (initialized) return;
  initialized = true;

  if (typeof window.isDraggingControls !== 'boolean') {
    window.isDraggingControls = false;
  }

  const controls = document.getElementById('controls');
  const quickSettings = document.getElementById('drum-settings');

  makeDraggable(controls, document.getElementById('controls-header'));
  makeDraggable(quickSettings, document.getElementById('quick-settings-header'));

  makeCollapsible({
    panel: quickSettings,
    button: document.getElementById('quick-settings-collapse-btn'),
    content: document.getElementById('quick-settings-content'),
    storageKey: STORAGE.quickSettings,
    label: 'quick settings',
    defaultCollapsedOnNarrow: true
  });

  makeCollapsible({
    panel: controls,
    button: document.getElementById('controls-collapse-btn'),
    content: document.getElementById('controls-body'),
    storageKey: STORAGE.controls,
    label: 'controls panel',
    defaultCollapsedOnNarrow: false
  });

  initCollapsibleSections(controls || document);
  initGuideTabs();

  GUARDED_IDS.forEach((id) => guardCanvasEvents(document.getElementById(id)));
}
