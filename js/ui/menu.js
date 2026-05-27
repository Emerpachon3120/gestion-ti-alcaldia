import { MENU_ITEMS } from '../config.js';
import { navigate } from '../router.js';

const CONFIG = window.APP_CONFIG;

export function renderMenu() {
  const nav = document.getElementById('app-menu');

  nav.innerHTML = `
    <div class="menu-header">
      <div style="text-align:center;padding:8px 0;">
        <div style="font-size:32px;">🏛️</div>
        <div style="font-weight:700;font-size:13px;color:var(--text1);margin-top:4px;">
          ${CONFIG.APP_NAME}
        </div>
      </div>
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