import { MENU_ITEMS } from '../config.js';
import { navigate } from '../router.js';

const CONFIG = window.APP_CONFIG;

export function renderMenu() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  const items = [
    { page: 'dashboard',     icon: '🏠', label: 'Inicio' },
    { page: 'mantenimientos',icon: '🔧', label: 'Mantto' },
    { page: 'backups',       icon: '💾', label: 'Backups' },
    { page: 'inventario',    icon: '💻', label: 'Equipos' },
    { page: 'incidencias',   icon: '🚨', label: 'Incidencias' },
  ];

  nav.innerHTML = items.map(item => `
    <div class="bottom-nav-item" data-page="${item.page}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </div>
  `).join('');

  nav.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.addEventListener('click', () => {
      import('../router.js').then(({ navigate }) => navigate(el.dataset.page));
    });
  });

  // Actualizar activo cuando cambia la página
  window._updateBottomNav = (page) => {
    nav.querySelectorAll('.bottom-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  };
}

export function renderHeader() {
  const header = document.getElementById('app-header');
  header.innerHTML = `
    <button class="header-menu-btn" onclick="toggleMenu()" aria-label="Menú">
      <span></span><span></span><span></span>
    </button>
    <span style="font-size:20px;">🏛️</span>
    <div class="header-title">${CONFIG.APP_NAME}</div>
    <div class="header-right">
      <span class="header-date" id="headerDate"></span>
      <button class="header-sync-btn" id="sync-btn" onclick="syncData()" title="Sincronizar">🔄</button>
    </div>
  `;
  document.getElementById('headerDate').textContent =
    new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).toUpperCase();
}

function toggleMenu() {
  document.getElementById('app-menu').classList.toggle('open');
  document.getElementById('menu-overlay').classList.toggle('open');
}

function closeMenu() {
  document.getElementById('app-menu').classList.remove('open');
  document.getElementById('menu-overlay').classList.remove('open');
}