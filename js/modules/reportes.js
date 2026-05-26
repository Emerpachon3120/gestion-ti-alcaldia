// js/modules/reportes.js
import { getData, getDBStatic } from '../state.js';
import { formatDate, parseFecha } from '../utils.js';
import { generarInformeMensual, generarActaDependencia } from '../ui/documento.js';

export function render() {
  return `
    <div class="page">
      <div class="section-title">📋 Reportes</div>
      <div class="section-sub">Informes y exportaciones</div>

      <div class="card" style="margin-bottom:10px;">
        <div class="card-title" style="margin-bottom:10px;">📄 Informe mensual PDF</div>
        <div class="form-group">
          <label class="form-label">Mes del informe</label>
          <input type="month" class="form-input" id="informe-mes">
        </div>
        <button class="btn btn-primary" id="btn-informe-mensual">🖨️ Generar informe mensual</button>
      </div>

      <div class="card" style="margin-bottom:10px;">
        <div class="card-title" style="margin-bottom:10px;">📊 Exportar CSV</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button class="btn btn-secondary" data-export="mantenimientos" style="margin-top:0;">🔧 Mantenimientos</button>
          <button class="btn btn-secondary" data-export="backups" style="margin-top:0;">💾 Backups</button>
          <button class="btn btn-secondary" data-export="equipos" style="margin-top:0;">💻 Equipos</button>
          <button class="btn btn-secondary" data-export="incidencias" style="margin-top:0;">🚨 Incidencias</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:10px;">📋 Reportes rápidos</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button class="btn btn-secondary" data-reporte="pendientes" style="margin-top:0;font-size:11px;">🔴 Mant. pendientes</button>
          <button class="btn btn-secondary" data-reporte="fallidos"   style="margin-top:0;font-size:11px;">❌ Backups fallidos</button>
          <button class="btn btn-secondary" data-reporte="abiertas"   style="margin-top:0;font-size:11px;">🚨 Inc. abiertas</button>
          <button class="btn btn-secondary" data-reporte="baja"       style="margin-top:0;font-size:11px;">🗑️ Equipos de baja</button>
        </div>
      </div>
    </div>`;
}

export function onEnter() {
  document.getElementById('btn-informe-mensual')?.addEventListener('click', () => {
    const mes = document.getElementById('informe-mes').value;
    if (!mes) { showToast('⚠️ Selecciona el mes'); return; }
    generarInformeMensual(mes);
  });
  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => _exportarCSV(btn.dataset.export));
  });
  document.querySelectorAll('[data-reporte]').forEach(btn => {
    btn.addEventListener('click', () => _reporteRapido(btn.dataset.reporte));
  });
}

function _generarInformeMensual() {
  const mes = document.getElementById('informe-mes').value;
  if (!mes) { import('../ui/toast.js').then(m => m.showToast('⚠️ Selecciona el mes')); return; }
  const [year, month] = mes.split('-').map(Number);
  const mants = getData('mantenimientos').filter(m => { const d = parseFecha(m.fecha); return d && d.getFullYear()===year && d.getMonth()===month-1; });
  const bks   = getData('backups').filter(b => { const d = parseFecha(b.fecha); return d && d.getFullYear()===year && d.getMonth()===month-1; });
  import('../ui/toast.js').then(m => m.showToast(`📄 Informe ${mes}: ${mants.length} mant., ${bks.length} backups`));
}

function _exportarCSV(tipo) {
  const data = getData(tipo === 'equipos' ? 'equipos' : tipo);
  if (!data.length) { import('../ui/toast.js').then(m => m.showToast('ℹ️ Sin datos')); return; }
  const keys = Object.keys(data[0]).filter(k => !['firma','fotos','imagen'].includes(k));
  const csv  = [keys.join(','), ...data.map(r => keys.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `${tipo}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function _reporteRapido(tipo) {
  import('../ui/toast.js').then(m => m.showToast(`📋 Reporte ${tipo} — generando...`));
}