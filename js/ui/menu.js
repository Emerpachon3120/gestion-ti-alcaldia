import { MENU_ITEMS } from '../config.js';
import { navigate } from '../router.js';

const CONFIG = window.APP_CONFIG;

// Iconos SVG inline (24x24, stroke, heredan color con currentColor)
const ICONS = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z"/></svg>`,
  wrench: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2.6-.6-.6-2.6 2.8-2.8Z"/></svg>`,
  save: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>`,
  monitor: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  alert: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.86 1.8 18a1 1 0 0 0 .86 1.5h18.7a1 1 0 0 0 .86-1.5L13.7 3.86a1 1 0 0 0-1.72 0Z"/><path d="M12 9v4M12 17h.01"/></svg>`,
  landmark: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M12 2 3 7v3h18V7l-9-5ZM6 10v7M10 10v7M14 10v7M18 10v7"/></svg>`,
  refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v6h-6"/></svg>`,
};

export function renderMenu() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  const items = [
    { page: 'dashboard',     icon: ICONS.home,     label: 'Inicio' },
    { page: 'mantenimientos',icon: ICONS.wrench,   label: 'Mantto' },
    { page: 'backups',       icon: ICONS.save,     label: 'Backups' },
    { page: 'inventario',    icon: ICONS.monitor,  label: 'Equipos' },
    { page: 'incidencias',   icon: ICONS.alert,    label: 'Incidencias' },
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
    <span class="header-icon">${ICONS.landmark}</span>
    <div class="header-title">${CONFIG.APP_NAME}</div>
    <div class="header-right">
      <span class="header-date" id="headerDate"></span>
      <button class="header-sync-btn" id="sync-btn" onclick="syncData()" title="Sincronizar">${ICONS.refresh}</button>
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