export function showToast(msg, color = '#1a1a18', duration = 3000) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.background = color;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function showLoader() {
  const main = document.getElementById('app-main');
  main.innerHTML = '<div class="page-loader"><div class="loader-spinner"></div></div>';
}

export function hideLoader() {
  // El router ya reemplaza el contenido, esto es un noop
}

export function showConfirm({ icon, title, msg, okLabel = 'Aceptar', onOk }) {
  document.getElementById('confirm-icon').textContent  = icon || '⚠️';
  document.getElementById('confirm-title').textContent = title || '';
  document.getElementById('confirm-msg').textContent   = msg   || '';
  document.getElementById('confirm-ok-btn').textContent = okLabel;
  document.getElementById('confirm-ok-btn').onclick = () => { cerrarConfirm(); onOk(); };
  document.getElementById('confirm-overlay').classList.add('open');
}

export function cerrarConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
}

// Exponer globalmente para onclick en HTML
window.cerrarConfirm = cerrarConfirm;