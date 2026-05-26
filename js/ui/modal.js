export function abrirModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function cerrarModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

// Inyectar HTML de modal en el contenedor
export function registrarModal(html) {
  const container = document.getElementById('modals-container');
  container.insertAdjacentHTML('beforeend', html);
}

// Exponer globalmente
window.cerrarModal = cerrarModal;