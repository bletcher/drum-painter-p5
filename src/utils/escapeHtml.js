/**
 * Escape text for safe insertion into HTML markup (element content or a
 * quoted attribute). Use for anything that can come from a settings file,
 * a MIDI device name or user input.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
