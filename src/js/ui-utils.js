/**
 * UI utility functions
 */

let toastTimer;

/**
 * @param {string} msg      toast text, always treated as untrusted and escaped
 * @param {string} [type]   'success' | 'warn' | 'error' | 'info'
 * @param {string} [iconHtml] optional leading icon, from icons.js iconMarkup()
 */
export function showToast(msg, type = 'info', iconHtml = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // innerHTML rather than textContent because the record confirmation leads
  // with the preset's icon. `msg` is escaped here — it can contain a
  // user-typed note — and iconHtml is only ever built by icons.js from our
  // own sprite ids, never from anything the user supplies.
  toast.innerHTML = iconHtml + escHtml(msg);
  toast.className = `toast toast--${type} toast--visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, 3000);
}

export function closeModal(id) {
  document.getElementById(id)?.setAttribute('hidden', '');
}

/**
 * Not yet used.
 * @param id
 */
export function openModal(id) {
  document.getElementById(id)?.removeAttribute('hidden');
}

export function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
