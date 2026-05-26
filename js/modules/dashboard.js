import { getData, getDBStatic } from '../state.js';
import { navigate }             from '../router.js';
import { renderAlertas }        from '../ui/alerts.js';
import { formatDate, calcSemaforo } from '../utils.js';

export function render() {
  const m   = getData('mantenimientos');
  const b   = getData('backups');
  const inc = getData('incidencias');
  const eq  = getData('equipos');

  const pendientes = m.filter(x => !x.firmado).length + b.filter(x => !x.firmado).length;
  const abiertas   = inc.filter(i => ['Iniciada','En proceso','abierta'].includes(i.estadoTexto || i.estado)).length;

  return `
    <div class="page" id="page-dashboard">
      <div class="page-header">
        <div class="section-title">👋 Gestión TI</div>
        <div class="section-sub">Alcaldía Municipal de Nemocón</div>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-num" id="stat-equipos">${eq.length}</div>
          <div class="stat-label">💻 Equipos</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" id="stat-pendientes">${pendientes}</div>
          <div class="stat-label">⏳ Pendientes</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" id="stat-incidencias">${abiertas}</div>
          <div class="stat-label">🚨 Incidencias</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" id="stat-mantenimientos">${m.length}</div>
          <div class="stat-label">🔧 Mantenimientos</div>
        </div>
      </div>

      <div class="section-title" style="font-size:13px;margin-bottom:10px;">Acciones rápidas</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        <div class="card" onclick="navigate('mantenimientos')" style="cursor:pointer;">
          <div class="card-header">
            <div class="card-icon" style="background:rgba(192,57,43,.1)">🔧</div>
            <div><div class="card-title">Mantenimiento</div></div>
          </div>
        </div>
        <div class="card" onclick="navigate('backups')" style="cursor:pointer;">
          <div class="card-header">
            <div class="card-icon" style="background:rgba(37,99,235,.1)">💾</div>
            <div><div class="card-title">Backup</div></div>
          </div>
        </div>
        <div class="card" onclick="navigate('incidencias')" style="cursor:pointer;">
          <div class="card-header">
            <div class="card-icon" style="background:rgba(220,38,38,.1)">🚨</div>
            <div><div class="card-title">Incidencia</div></div>
          </div>
        </div>
        <div class="card" onclick="navigate('inventario')" style="cursor:pointer;">
          <div class="card-header">
            <div class="card-icon" style="background:rgba(22,163,74,.1)">📦</div>
            <div><div class="card-title">Inventario</div></div>
          </div>
        </div>
      </div>

      <div class="section-title" style="font-size:13px;margin-bottom:8px;">⚠️ Alertas del sistema</div>
      <div id="alertas-container"></div>

      <div class="section-title" style="font-size:13px;margin:16px 0 8px;">📅 Próximos mantenimientos</div>
      <div id="proximos-container"></div>
    </div>
  `;
}

export function onEnter() {
  renderAlertas('alertas-container');
  renderProximos();
  // Exponer navigate globalmente para onclick en HTML inline
  window.navigate = navigate;
}

function renderProximos() {
  const prox = getData('mantenimientos')
    .filter(m => !m.firmado)
    .slice(0, 4);

  const container = document.getElementById('proximos-container');
  if (!container) return;

  if (!prox.length) {
    container.innerHTML = `<div class="card" style="text-align:center;color:var(--text3);font-size:13px;">✅ Todo al día</div>`;
    return;
  }

  const DB = getDBStatic();
  container.innerHTML = prox.map(m => {
    const eq  = (getData('equipos') || []).find(e => e.serial === m.serial);
    const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
    const sem = calcSemaforo(m.fechaProxima);
    return `
      <div class="card" style="margin-bottom:8px;cursor:pointer;"
           onclick="navigate('mantenimientos')">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:13px;font-weight:600">${p?.nombre || 'Sin asignar'}</div>
            <div class="mono" style="font-size:11px;color:var(--text3)">${m.serial} · ${m.tipo}</div>
            ${m.fechaProxima ? `<div style="font-size:11px;color:var(--text3);">📅 ${formatDate(m.fechaProxima)}</div>` : ''}
          </div>
          <div style="text-align:right;">
            ${sem ? `<div class="semaforo ${sem.clase}">${sem.icon} ${sem.label}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}