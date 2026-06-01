import { setState, getState } from './state.js';
import { showLoader, hideLoader } from './ui/toast.js';

const _routes = {};

// Registrar una ruta/página
export function registerRoute(name, { render, onEnter, onLeave } = {}) {
  _routes[name] = { render, onEnter, onLeave };
}

// Navegar a una página
export async function navigate(page, params = {}) {
  const current = getState('currentPage');
  if (current === page) return;

  // Callback de salida de página anterior
  const prev = _routes[current];
  if (prev?.onLeave) prev.onLeave();

  setState('currentPage', page);
  updateMenuActive(page);
  updateFab(page);

  const route = _routes[page];
  if (!route) {
    console.warn('[Router] Ruta no registrada:', page);
    return;
  }

  const main = document.getElementById('app-main');
  showLoader();

  try {
    const html = route.render ? await route.render(params) : '';
    main.innerHTML = html;
    if (route.onEnter) await route.onEnter(params);
  } catch (err) {
    console.error('[Router] Error en página', page, err);
    main.innerHTML = `<div class="page"><div class="empty"><p>Error cargando la página</p></div></div>`;
  } finally {
    hideLoader();
  }

  // Scroll al top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Historial del navegador
  history.pushState({ page }, '', `#${page}`);
}

function updateMenuActive(page) {
  window._updateBottomNav?.(page);
}

function updateFab(page) {
  const fab = document.getElementById('fab-btn');
  if (!fab) return;
  const pagesWithFab = ['dashboard','mantenimientos','backups','incidencias','inventario'];
  fab.classList.toggle('hidden', !pagesWithFab.includes(page));
}

// Manejar botón atrás del navegador
window.addEventListener('popstate', e => {
  const page = e.state?.page || 'dashboard';
  navigate(page);
});

export async function forceNavigate(page, params = {}) {
  setState('currentPage', null);
  await navigate(page, params);
}