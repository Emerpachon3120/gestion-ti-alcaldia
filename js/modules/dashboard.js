import { navigate }       from '../router.js';
import { formatDate, calcSemaforo } from '../utils.js';
import { renderAlertas }  from '../ui/alerts.js';
import { getData, getDBStatic, subscribe } from '../state.js';

export function render() {
  const m   = getData('mantenimientos') || [];
  const b   = getData('backups')        || [];
  const inc = getData('incidencias')    || [];
  const eq  = getData('equipos')        || [];

  const pendientes = m.filter(x => !x.firmado).length + b.filter(x => !x.firmado).length;
  const abiertas   = inc.filter(i =>
    ['Iniciada','En proceso','abierta'].includes(i.estadoTexto || i.estado)
  ).length;

  return `
    <div class="page" id="page-dashboard">
      <div class="page-header">
        <div class="section-title">👋 Gestión TI</div>
        <div class="section-sub">Alcaldía Municipal de Nemocón</div>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-num">${eq.length}</div>
          <div class="stat-label">💻 Equipos</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${pendientes}</div>
          <div class="stat-label">⏳ Pendientes</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${abiertas}</div>
          <div class="stat-label">🚨 Incidencias</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${m.length}</div>
          <div class="stat-label">🔧 Mantenimientos</div>
        </div>
      </div>

      <div class="section-title" style="font-size:13px;margin-bottom:10px;">⚡ Acciones rápidas</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        <div class="card" data-nav="mantenimientos" style="cursor:pointer;">
          <div class="card-header">
            <div class="card-icon" style="background:rgba(192,57,43,.1)">🔧</div>
            <div><div class="card-title">Mantenimiento</div></div>
          </div>
        </div>
        <div class="card" data-nav="backups" style="cursor:pointer;">
          <div class="card-header">
            <div class="card-icon" style="background:rgba(37,99,235,.1)">💾</div>
            <div><div class="card-title">Backup</div></div>
          </div>
        </div>
        <div class="card" data-nav="incidencias" style="cursor:pointer;">
          <div class="card-header">
            <div class="card-icon" style="background:rgba(220,38,38,.1)">🚨</div>
            <div><div class="card-title">Incidencia</div></div>
          </div>
        </div>
        <div class="card" data-nav="inventario" style="cursor:pointer;">
          <div class="card-header">
            <div class="card-icon" style="background:rgba(22,163,74,.1)">📦</div>
            <div><div class="card-title">Inventario</div></div>
          </div>
        </div>
      </div>

      <div class="section-title" style="font-size:13px;margin-bottom:8px;">⚠️ Alertas del sistema</div>
      <div id="alertas-container">
        <div class="alert-card alert-green">
          <span class="alert-icon">🔄</span>
          <div class="alert-body">
            <div class="alert-title">Sincronizando datos...</div>
            <div class="alert-sub">Cargando desde Google Sheets</div>
          </div>
        </div>
      </div>

      <div class="section-title" style="font-size:13px;margin:16px 0 8px;">📅 Próximos mantenimientos</div>
      <div id="proximos-container">
        <div class="card" style="text-align:center;color:var(--text3);font-size:13px;padding:20px;">
          Cargando...
        </div>
      </div>
    </div>
  `;
}

export function onEnter() {
  setTimeout(() => {
    document.querySelectorAll('[data-nav]').forEach(card => {
      card.addEventListener('click', () => navigate(card.dataset.nav));
    });

    renderAlertas('alertas-container');
    _renderProximos();
  }, 50);
}

function _renderProximos() {
  const DB    = getDBStatic();
  const prox  = (getData('mantenimientos') || [])
    .filter(m => !m.firmado)
    .slice(0, 4);

  const container = document.getElementById('proximos-container');
  if (!container) return;

  if (!prox.length) {
    container.innerHTML = `
      <div class="card" style="text-align:center;color:var(--text3);font-size:13px;padding:20px;">
        ✅ Todo al día
      </div>`;
    return;
  }

  container.innerHTML = prox.map(m => {
    const eq  = (getData('equipos') || []).find(e => e.serial === m.serial);
    const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
    const sem = calcSemaforo(m.fechaProxima);
    return `
      <div class="card" data-nav="mantenimientos" style="margin-bottom:8px;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:13px;font-weight:600">${p?.nombre || 'Sin asignar'}</div>
            <div class="mono" style="font-size:11px;color:var(--text3)">${m.serial} · ${m.tipo || ''}</div>
            ${m.fechaProxima
              ? `<div style="font-size:11px;color:var(--text3)">📅 ${formatDate(m.fechaProxima)}</div>`
              : ''}
          </div>
          <div style="text-align:right;">
            ${sem
              ? `<div class="semaforo ${sem.clase}">${sem.icon} ${sem.label}</div>`
              : '<span class="badge badge-yellow">Sin firmar</span>'}
          </div>
        </div>
      </div>`;
  }).join('');

  // Bind clicks de los cards de próximos
  container.querySelectorAll('[data-nav]').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.nav));
  });
}