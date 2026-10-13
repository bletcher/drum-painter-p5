/**
 * Accessibility helpers
 *
 * initAccessibility():
 *   - Watches the app's dialogs (and any `.modal-backdrop` added later). When
 *     one becomes visible, remembers the focused element, moves focus into the
 *     dialog and keeps Tab / Shift+Tab inside it. When it hides, focus returns
 *     to where it was.
 *   - Stops Space/Enter on focused buttons from also reaching the p5 keyboard
 *     shortcuts (Space = record video), so keyboard users can press buttons.
 *
 * Visibility is detected with a MutationObserver on style/class/hidden, so the
 * existing code that toggles `element.style.display` keeps working unchanged.
 */

// Elements that are (or contain) a modal dialog
const DIALOG_IDS = [
  'customization-panel',
  'midi-mapping-panel',
  'shortcuts-panel',
  'user-guide-backdrop',
  'midi-devices-backdrop',
  'save-recording-backdrop',
  'sync-preview-backdrop',
  'debug-panel'
];
const RUNTIME_DIALOG_CLASS = 'modal-backdrop';

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable="true"]',
  '[tabindex]'
].join(',');

// Elements whose native activation keys should not trigger global shortcuts
const ACTIVATABLE = 'button, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], a[href], summary';

let initialized = false;
/** @type {Array<{el: HTMLElement, returnFocus: Element|null}>} */
const openStack = [];
const wasVisible = new WeakMap();
const observed = new WeakSet();
let attrObserver = null;

function isVisible(el) {
  if (!el || !el.isConnected || el.hidden) return false;
  if (el.getClientRects().length === 0) return false; // display:none on it or an ancestor
  return getComputedStyle(el).visibility !== 'hidden';
}

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (el.tabIndex < 0) return false;
    if (el.closest('[hidden], [inert]')) return false;
    return isVisible(el);
  });
}

function topDialog() {
  for (let i = openStack.length - 1; i >= 0; i--) {
    if (isVisible(openStack[i].el)) return openStack[i].el;
  }
  return null;
}

function focusInto(el) {
  if (!isVisible(el) || el.contains(document.activeElement)) return;
  const focusables = getFocusable(el);
  const target = focusables[0];
  if (target) {
    target.focus({ preventScroll: true });
  } else {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
}

function onOpened(el) {
  // Ignore duplicate notifications
  if (openStack.some((entry) => entry.el === el)) return;
  const active = document.activeElement;
  openStack.push({ el, returnFocus: active && active !== document.body ? active : null });
  // Content is often built right after the element is shown; wait a frame
  requestAnimationFrame(() => focusInto(el));
}

function onClosed(el) {
  const index = openStack.findIndex((entry) => entry.el === el);
  if (index === -1) return;
  const [entry] = openStack.splice(index, 1);

  // Only move focus if it was inside the closing dialog (or got dropped to body)
  const active = document.activeElement;
  const focusWasInside = !active || active === document.body || el.contains(active);
  if (!focusWasInside) return;

  const fallbackDialog = topDialog();
  const target = entry.returnFocus;
  if (target && target.isConnected && isVisible(target) &&
      (!fallbackDialog || fallbackDialog.contains(target))) {
    target.focus({ preventScroll: true });
  } else if (fallbackDialog) {
    focusInto(fallbackDialog);
  } else if (active && active !== document.body && typeof active.blur === 'function') {
    active.blur();
  }
}

function check(el) {
  const visible = isVisible(el);
  const before = wasVisible.get(el) || false;
  if (visible === before) return;
  wasVisible.set(el, visible);
  if (visible) onOpened(el);
  else onClosed(el);
}

function watch(el) {
  if (!el || observed.has(el)) return;
  observed.add(el);
  attrObserver.observe(el, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  wasVisible.set(el, false);
  check(el);
}

function isDialogCandidate(node) {
  return node.nodeType === 1 &&
    (DIALOG_IDS.includes(node.id) || node.classList.contains(RUNTIME_DIALOG_CLASS));
}

function onKeyDown(e) {
  if (e.key !== 'Tab') return;
  const dialog = topDialog();
  if (!dialog) return;

  const focusables = getFocusable(dialog);
  if (focusables.length === 0) {
    e.preventDefault();
    focusInto(dialog);
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  const inside = dialog.contains(active);

  if (e.shiftKey) {
    if (!inside || active === first || active === dialog) {
      e.preventDefault();
      last.focus();
    }
  } else if (!inside || active === last) {
    e.preventDefault();
    first.focus();
  }
}

// Bubble-phase listener on document runs before p5's listener on window
function onActivationKey(e) {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  const target = e.target;
  if (!(target instanceof Element) || !target.closest(ACTIVATABLE)) return;
  // Only for keyboard focus: after a mouse click the button keeps focus, and
  // Space should still mean "record" rather than "click that button again".
  let keyboardFocused = true;
  try {
    keyboardFocused = target.matches(':focus-visible');
  } catch {
    // :focus-visible unsupported — assume keyboard use
  }
  if (keyboardFocused) e.stopPropagation();
}

/**
 * Set up dialog focus management. Safe to call more than once.
 */
export function initAccessibility() {
  if (initialized) return;
  initialized = true;

  attrObserver = new MutationObserver((mutations) => {
    const seen = new Set();
    for (const m of mutations) {
      if (seen.has(m.target)) continue;
      seen.add(m.target);
      check(m.target);
    }
  });

  DIALOG_IDS.forEach((id) => watch(document.getElementById(id)));
  document.querySelectorAll(`.${RUNTIME_DIALOG_CLASS}`).forEach(watch);

  // Dialogs created later (Modal.js, DebugPanel)
  const treeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (isDialogCandidate(node)) watch(node);
        node.querySelectorAll?.(`.${RUNTIME_DIALOG_CLASS}, ${DIALOG_IDS.map((id) => `#${id}`).join(', ')}`)
          .forEach(watch);
      });
      m.removedNodes.forEach((node) => {
        if (node.nodeType === 1 && openStack.some((entry) => entry.el === node)) {
          wasVisible.set(node, false);
          onClosed(node);
        }
      });
    }
  });
  treeObserver.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keydown', onActivationKey);
}
