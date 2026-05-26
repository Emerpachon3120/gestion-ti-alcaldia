// js/modules/calendario.js
import { getData } from '../state.js';
import { parseFecha, formatDate } from '../utils.js';

export function render() {
  const now   = new Date();
  return `
    <div class="page">
      <div class="section-title">📅 Calendario</div>
      <div class="section-sub">Cronograma de mantenimientos y backups</div>
      <div id="cal-container"></div>
    </div>`;
}

export function onEnter() {
  _renderCalendario();
}

function _renderCalendario() {
  const now   = new Date();
  const year  = now.getFullYear();
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const mants = getData('mantenimientos');
  const bks   = getData('backups');

  const rows = MESES.map((mes, mi) => {
    const mMes = mants.filter(m => { const d = parseFecha(m.fechaProxima); return d && d.getFullYear()===year && d.getMonth()===mi; });
    const bMes = bks.filter(b   => { const d = parseFecha(b.fechaProxima); return d && d.getFullYear()===year && d.getMonth()===mi; });
    const esActual = mi === now.getMonth();
    return `
      <div class="card" style="margin-bottom:8px;${esActual?'border-color:var(--accent);':''}" >
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${(mMes.length||bMes.length)?'8px':'0'}">
          <span style="font-weight:700;font-size:14px;">${mes} ${year}${esActual?' <span style="font-size:10px;color:var(--accent)">← HOY</span>':''}</span>
          <div style="display:flex;gap:6px;">
            ${mMes.length ? `<span class="badge badge-blue">🔧 ${mMes.length}</span>` : ''}
            ${bMes.length ? `<span class="badge badge-purple">💾 ${bMes.length}</span>` : ''}
          </div>
        </div>
        ${mMes.map(m => `<div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);">🔧 ${m.serial} — ${formatDate(m.fechaProxima)}</div>`).join('')}
        ${bMes.map(b => `<div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);">💾 ${b.serial} — ${formatDate(b.fechaProxima)}</div>`).join('')}
      </div>`;
  });

  document.getElementById('cal-container').innerHTML = rows.join('');
}