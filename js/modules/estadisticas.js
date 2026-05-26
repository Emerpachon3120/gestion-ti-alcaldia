// js/modules/estadisticas.js
import { getData } from '../state.js';

export function render() {
  const m   = getData('mantenimientos');
  const b   = getData('backups');
  const inc = getData('incidencias');
  const eq  = getData('equipos');
  const firmados   = m.filter(x => x.firmado).length;
  const sinFirmar  = m.length - firmados;
  const bkOk       = b.filter(x => x.estadoBk === 'Completado').length;
  const bkFallidos = b.filter(x => x.estadoBk === 'Fallido').length;
  const incAbiertas = inc.filter(i => ['Iniciada','En proceso','abierta'].includes(i.estadoTexto||i.estado)).length;

  return `
    <div class="page">
      <div class="section-title">📊 Estadísticas</div>
      <div class="section-sub">Resumen general del sistema</div>
      <div class="stats">
        <div class="stat-card"><div class="stat-num">${eq.length}</div><div class="stat-label">💻 Equipos</div></div>
        <div class="stat-card"><div class="stat-num">${m.length}</div><div class="stat-label">🔧 Mantenimientos</div></div>
        <div class="stat-card"><div class="stat-num">${b.length}</div><div class="stat-label">💾 Backups</div></div>
        <div class="stat-card"><div class="stat-num">${inc.length}</div><div class="stat-label">🚨 Incidencias</div></div>
      </div>
      <div class="card" style="margin-bottom:10px;">
        <div class="card-title" style="margin-bottom:10px;">🔧 Mantenimientos</div>
        ${_barra('Firmados', firmados, m.length, '#16a34a')}
        ${_barra('Sin firmar', sinFirmar, m.length, '#d97706')}
      </div>
      <div class="card" style="margin-bottom:10px;">
        <div class="card-title" style="margin-bottom:10px;">💾 Backups</div>
        ${_barra('Completados', bkOk, b.length, '#16a34a')}
        ${_barra('Fallidos', bkFallidos, b.length, '#dc2626')}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:10px;">🚨 Incidencias</div>
        ${_barra('Abiertas', incAbiertas, inc.length, '#dc2626')}
        ${_barra('Cerradas', inc.length - incAbiertas, inc.length, '#16a34a')}
      </div>
    </div>`;
}

export function onEnter() {}

function _barra(label, val, total, color) {
  const pct = total > 0 ? ((val / total) * 100).toFixed(0) : 0;
  return `
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span>${label}</span><span style="font-weight:600;">${val} (${pct}%)</span>
      </div>
      <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .6s ease;"></div>
      </div>
    </div>`;
}