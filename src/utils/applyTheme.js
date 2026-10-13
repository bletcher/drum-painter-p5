/**
 * Apply Theme to HTML Elements
 *
 * Buttons and panels in index.html are now styled with classes in
 * src/styles/app.css (.btn-primary, .btn-success, .btn-danger, ...), and the
 * light/dark palette lives in CSS variables. Nothing needs to be painted from
 * JS any more, so these functions are intentionally no-ops. They are kept
 * because main.js (and possibly other callers) import them.
 */

/**
 * Formerly applied theme colors to Quick Settings buttons. No-op.
 */
export function applyQuickSettingsTheme() {}

/**
 * Formerly applied theme colors to the Controls panel. No-op.
 */
export function applyControlsPanelTheme() {}

/**
 * Apply all theme styles. No-op; styling is handled by app.css.
 */
export function applyAllThemes() {
  applyQuickSettingsTheme();
  applyControlsPanelTheme();
}
