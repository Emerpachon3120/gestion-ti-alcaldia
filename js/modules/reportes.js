import { getData, getDBStatic } from '../state.js';
import { showToast }            from '../ui/toast.js';
import { formatDate, parseFecha } from '../utils.js';
import {
  generarInformeMensual,
  generarActaDependencia,
  abrirDocViewer,
} from '../ui/documento.js';

export function render() {
  const DB = getDBStatic();
  return `
    <div class="page">
      <div class="section-title">📋 Reportes</div>
      <div class="section-sub">Informes, actas y exportaciones</div>

      <!-- Informe mensual -->
      <div class="card" style="margin-bottom:12px;">
        <div style="font-weight:700;margin-bottom:10px;">📄 Informe mensual PDF</div>
        <div class="form-group">
          <label class="form-label">Mes del informe</label>
          <input type="month" class="form-input" id="informe-mes">
        </div>
        <button class="btn btn-primary" id="btn-informe-mensual">
          🖨️ Generar informe mensual
        </button>
      </div>

      <!-- Actas por dependencia -->
      <div class="card" style="margin-bottom:12px;">
        <div style="font-weight:700;margin-bottom:10px;">📝 Actas por dependencia</div>
        <div class="form-group">
          <label class="form-label">Dependencia</label>
          <select class="form-select" id="acta-dep">
            <option value="">Seleccionar...</option>
            ${DB.dependencias.map(d =>
              `<option value="${d.id}">${d.nombre}</option>`
            ).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Fecha inicio</label>
            <input type="date" class="form-input" id="acta-ini">
          </div>
          <div class="form-group">
            <label class="form-label">Fecha fin</label>
            <input type="date" class="form-input" id="acta-fin">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Observaciones adicionales</label>
          <textarea class="form-textarea" id="acta-obs" style="height:60px;"
            placeholder="Opcional..."></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button class="btn btn-primary" style="margin-top:0;background:#c0392b;"
            data-acta="mantenimiento">🔧 Acta Mantenimiento</button>
          <button class="btn btn-primary" style="margin-top:0;background:#2563eb;"
            data-acta="backup">💾 Acta Backup</button>
        </div>
      </div>

      <!-- Reportes rápidos -->
      <div class="card" style="margin-bottom:12px;">
        <div style="font-weight:700;margin-bottom:10px;">⚡ Reportes rápidos</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button class="btn btn-secondary" style="margin-top:0;font-size:11px;"
            data-reporte="mant-pendientes">🔴 Mant. pendientes</button>
          <button class="btn btn-secondary" style="margin-top:0;font-size:11px;"
            data-reporte="bk-fallidos">❌ Backups fallidos</button>
          <button class="btn btn-secondary" style="margin-top:0;font-size:11px;"
            data-reporte="inc-abiertas">🚨 Inc. abiertas</button>
          <button class="btn btn-secondary" style="margin-top:0;font-size:11px;"
            data-reporte="eq-baja">🗑️ Equipos de baja</button>
          <button class="btn btn-secondary" style="margin-top:0;font-size:11px;"
            data-reporte="eq-por-dep">🏢 Equipos por dep.</button>
          <button class="btn btn-secondary" style="margin-top:0;font-size:11px;"
            data-reporte="eq-por-resp">👤 Equipos por resp.</button>
        </div>
      </div>

      <!-- Exportar CSV -->
      <div class="card">
        <div style="font-weight:700;margin-bottom:10px;">📊 Exportar CSV</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button class="btn btn-secondary" style="margin-top:0;" data-export="mantenimientos">🔧 Mantenimientos</button>
          <button class="btn btn-secondary" style="margin-top:0;" data-export="backups">💾 Backups</button>
          <button class="btn btn-secondary" style="margin-top:0;" data-export="equipos">💻 Equipos</button>
          <button class="btn btn-secondary" style="margin-top:0;" data-export="incidencias">🚨 Incidencias</button>
        </div>
      </div>
    </div>`;
}

export function onEnter() {
  // Informe mensual
  document.getElementById('btn-informe-mensual')?.addEventListener('click', () => {
    const mes = document.getElementById('informe-mes').value;
    if (!mes) { showToast('⚠️ Selecciona el mes'); return; }
    generarInformeMensual(mes);
  });

  // Actas por dependencia
  document.querySelectorAll('[data-acta]').forEach(btn => {
    btn.addEventListener('click', () => {
      const depId  = document.getElementById('acta-dep').value;
      const ini    = document.getElementById('acta-ini').value;
      const fin    = document.getElementById('acta-fin').value;
      const obs    = document.getElementById('acta-obs').value;
      if (!depId) { showToast('⚠️ Selecciona una dependencia'); return; }
      if (!ini || !fin) { showToast('⚠️ Selecciona el rango de fechas'); return; }
      generarActaDependencia(btn.dataset.acta, depId, ini, fin, obs);
    });
  });

  // Reportes rápidos
  document.querySelectorAll('[data-reporte]').forEach(btn => {
    btn.addEventListener('click', () => _reporteRapido(btn.dataset.reporte));
  });

  // Exportar CSV
  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => _exportarCSV(btn.dataset.export));
  });

  // Fechas por defecto (mes actual)
  const hoy    = new Date();
  const ini    = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fmt    = d => d.toISOString().split('T')[0];
  const mesEl  = document.getElementById('informe-mes');
  if (mesEl) mesEl.value = fmt(hoy).slice(0, 7);
  const iniEl  = document.getElementById('acta-ini');
  const finEl  = document.getElementById('acta-fin');
  if (iniEl) iniEl.value = fmt(ini);
  if (finEl) finEl.value = fmt(hoy);
}

// ── Reportes rápidos ──────────────────────────────────────────
function _reporteRapido(tipo) {
  const DB   = getDBStatic();
  let rows   = [], headers = [], titulo = '';

  if (tipo === 'mant-pendientes') {
    titulo  = '🔴 Mantenimientos Pendientes de Firma';
    headers = ['Serial','Funcionario','Dependencia','Tipo','Fecha','Próximo','Responsable'];
    rows = getData('mantenimientos')
      .filter(m => !m.firmado)
      .map(m => {
        const eq  = getData('equipos').find(e => e.serial === m.serial);
        const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
        const of  = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
        const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
        return [m.serial, p?.nombre||'—', dep?.nombre||'—', m.tipo||'—',
                formatDate(m.fecha), formatDate(m.fechaProxima), m.responsable||'—'];
      });
  }

  if (tipo === 'bk-fallidos') {
    titulo  = '❌ Backups Fallidos';
    headers = ['Serial','Responsable','Dependencia','Tipo','Fecha','Destino','Obs'];
    rows = getData('backups')
      .filter(b => b.estadoBk === 'Fallido')
      .map(b => {
        const resp = b.responsableEquipo || DB.personas.find(x=>x.id===b.personaId)?.nombre||'—';
        const eq   = getData('equipos').find(e => e.serial === b.serial);
        const of   = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
        const dep  = of ? DB.dependencias.find(x => x.id === of.depId) : null;
        return [b.serial, resp, dep?.nombre||'—', b.tipo||'—', formatDate(b.fecha), b.destino||'—', b.obs||'—'];
      });
  }

  if (tipo === 'inc-abiertas') {
    titulo  = '🚨 Incidencias Abiertas';
    headers = ['Ticket','Tipo','Funcionario','Secretaría','Prioridad','Estado','Días abierta'];
    const hoy = new Date();
    rows = getData('incidencias')
      .filter(i => ['Iniciada','En proceso','Pendiente','abierta'].includes(i.estadoTexto||i.estado))
      .map(i => {
        const d    = parseFecha(i.fecha);
        const dias = d ? Math.floor((hoy-d)/86400000) : '—';
        return [i.ticket||i.id, i.tipo, i.nombre||'—', i.secretaria||'—',
                i.prioridad||'—', i.estadoTexto||i.estado||'—', dias];
      });
  }

  if (tipo === 'eq-baja') {
    titulo  = '🗑️ Equipos Dados de Baja';
    headers = ['Serial','Marca','Modelo','Oficina','Último responsable','Obs'];
    rows = getData('equipos')
      .filter(e => e.estado === 'Dado de baja')
      .map(e => {
        const of = DB.oficinas.find(x => x.id === e.oficina);
        const p  = DB.personas.find(x => x.id === e.usuarioId);
        return [e.serial, e.marca||'—', e.modelo||'—', of?.nombre||'—', p?.nombre||'—', e.obs||'—'];
      });
  }

  if (tipo === 'eq-por-dep') {
    titulo  = '🏢 Equipos por Dependencia';
    headers = ['Dependencia','Oficina','Serial','Funcionario','SO','RAM','Estado'];
    DB.dependencias.forEach(dep => {
      const ofsDep = DB.oficinas.filter(o => o.depId === dep.id);
      ofsDep.forEach(of => {
        getData('equipos').filter(e => e.oficina === of.id).forEach(e => {
          const p = DB.personas.find(x => x.id === e.usuarioId);
          rows.push([dep.nombre, of.nombre, e.serial, p?.nombre||'—',
                     e.so||'—', e.ram||'—', e.estado||'Operativo']);
        });
      });
    });
  }

  if (tipo === 'eq-por-resp') {
    titulo  = '👤 Equipos por Responsable';
    headers = ['Funcionario','Serial','Marca','Modelo','Oficina','Dependencia','Estado'];
    DB.personas.forEach(p => {
      getData('equipos').filter(e => e.usuarioId === p.id).forEach(e => {
        const of  = DB.oficinas.find(x => x.id === e.oficina);
        const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
        rows.push([p.nombre, e.serial, e.marca||'—', e.modelo||'—',
                   of?.nombre||'—', dep?.nombre||'—', e.estado||'Operativo']);
      });
    });
  }

  if (!rows.length) { showToast('ℹ️ Sin datos para este reporte'); return; }
  _abrirTablaHTML(titulo, headers, rows);
}

function _abrirTablaHTML(titulo, headers, rows) {
  const fecha = new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});
  const html  = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;font-size:10pt;color:#111;padding:20px 30px;}
    h1{font-size:14pt;color:#c0392b;margin-bottom:4px;}
    .sub{color:#666;font-size:9pt;margin-bottom:16px;}
    table{width:100%;border-collapse:collapse;font-size:9.5pt;}
    th{background:#c0392b;color:#fff;padding:6px 8px;text-align:left;font-size:9pt;}
    td{padding:5px 8px;border:1px solid #e0e0e0;vertical-align:top;}
    tr:nth-child(even) td{background:#f9f9f9;}
    .total{margin-top:10px;font-size:10pt;color:#555;}
    @media print{@page{size:landscape;margin:10mm;}body{padding:5px;}}
  </style></head><body>
  <h1>${titulo}</h1>
  <div class="sub">Alcaldía Municipal de Nemocón · ${fecha} · Total: ${rows.length} registro(s)</div>
  <table>
    <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??'—'}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <div class="total">Total: <b>${rows.length}</b> registro(s)</div>
  </body></html>`;
  abrirDocViewer(html, titulo);
}

function _exportarCSV(tipo) {
  const data = getData(tipo === 'equipos' ? 'equipos' : tipo) || [];
  if (!data.length) { showToast('ℹ️ Sin datos'); return; }
  const keys = Object.keys(data[0]).filter(k => !['firma','fotos','imagen','IMG_'].includes(k));
  const csv  = [
    keys.join(','),
    ...data.map(r => keys.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(','))
  ].join('\n');
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download = `${tipo}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast(`📊 Exportando ${tipo}...`);
}