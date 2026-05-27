import { MENU_ITEMS, CONFIG } from '../config.js';
import { navigate } from '../router.js';
import { getState } from '../state.js';

export function renderMenu() {
  const nav = document.getElementById('app-menu');

  nav.innerHTML = `
    <div class="menu-header">
      <img src="${CONFIG.IMG_ESCUDO}" 
           class="menu-logo" 
           alt="Escudo Nemocón"
           style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto 8px;">
      <div class="menu-entity">${CONFIG.ENTIDAD}</div>
    </div>
    <div class="menu-nav">
      ${MENU_ITEMS.map(item => `
        <button class="menu-item" data-page="${item.page}">
          <span class="menu-icon">${item.icon}</span>
          <span class="menu-label">${item.label}</span>
        </button>
      `).join('')}
    </div>
    <div class="menu-footer">
      <div class="menu-version">${CONFIG.APP_NAME} v${CONFIG.VERSION}</div>
    </div>
  `;

  nav.querySelectorAll('.menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      closeMenu();
      navigate(btn.dataset.page);
    });
  });

  document.getElementById('menu-overlay').onclick = closeMenu;
  window.toggleMenu = toggleMenu;
  window.closeMenu  = closeMenu;
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