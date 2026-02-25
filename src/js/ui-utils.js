/**
 * UI utility functions
 */

let toastTimer;
export function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
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
