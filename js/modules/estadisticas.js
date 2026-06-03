import { getData, getDBStatic } from '../state.js';
import { parseFecha, formatDate, calcSemaforo } from '../utils.js';

export function render() {
  return `
    <div class="page" id="page-estadisticas">
      <div class="page-header">
        <div class="section-title">Estadísticas</div>
        <div class="section-sub">Resumen general del sistema</div>
      </div>

      <!-- FILTROS -->
      <div class="card" style="margin-bottom:12px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:10px;">Filtros</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Desde</label>
            <input type="date" class="form-input" id="est-desde">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Hasta</label>
            <input type="date" class="form-input" id="est-hasta">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Dependencia</label>
            <select class="form-select" id="est-dep">
              <option value="">Todas</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Responsable TI</label>
            <select class="form-select" id="est-resp">
              <option value="">Todos</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary" style="margin-top:10px;" id="est-filtrar">
          Aplicar filtros
        </button>
      </div>

      <!-- CONTENIDO -->
      <div id="est-contenido"></div>
    </div>`;
}

export function onEnter() {
  const DB = getDBStatic();

  // Llenar dependencias
  const selDep = document.getElementById('est-dep');
  DB.dependencias.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.nombre.replace(/Secretar[ií]a de /i,'Sec. ');
    selDep.appendChild(opt);
  });

  // Llenar responsables
  const resps = [...new Set([
    ...getData('mantenimientos').map(m => m.responsable),
    ...getData('backups').map(b => b.respTI),
  ].filter(Boolean))];
  const selResp = document.getElementById('est-resp');
  resps.forEach(r => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = r;
    selResp.appendChild(opt);
  });

  // Fechas por defecto — año actual
  const hoy = new Date();
  const ini = new Date(hoy.getFullYear(), 0, 1);
  document.getElementById('est-desde').value = ini.toISOString().split('T')[0];
  document.getElementById('est-hasta').value = hoy.toISOString().split('T')[0];

  document.getElementById('est-filtrar').addEventListener('click', _renderEstadisticas);
  _renderEstadisticas();
}

function _getFiltros() {
  return {
    desde: document.getElementById('est-desde')?.value,
    hasta: document.getElementById('est-hasta')?.value,
    depId: document.getElementById('est-dep')?.value,
    resp:  document.getElementById('est-resp')?.value,
  };
}

function _filtrarPorFecha(data, keyFecha) {
  const { desde, hasta } = _getFiltros();
  let r = [...data];
  if (desde) r = r.filter(x => { const d=parseFecha(x[keyFecha]); return d&&d>=new Date(desde); });
  if (hasta) r = r.filter(x => { const d=parseFecha(x[keyFecha]); return d&&d<=new Date(hasta+'T23:59:59'); });
  return r;
}

function _filtrarPorDep(seriales) {
  const { depId } = _getFiltros();
  if (!depId) return seriales;
  const DB   = getDBStatic();
  const ofIds= DB.oficinas.filter(o => o.depId === depId).map(o => o.id);
  const eqsDepSerials = getData('equipos').filter(e => ofIds.includes(e.oficina)).map(e => e.serial);
  return seriales.filter(s => eqsDepSerials.includes(s));
}

function _renderEstadisticas() {
  const { resp } = _getFiltros();
  const DB = getDBStatic();

  // Datos filtrados
  let mants = _filtrarPorFecha(getData('mantenimientos'), 'fecha');
  let bks   = _filtrarPorFecha(getData('backups'), 'fecha');
  let incs  = _filtrarPorFecha(getData('incidencias'), 'fecha');

  // Filtrar por dependencia
  const serialesMant = _filtrarPorDep(mants.map(m => m.serial));
  const serialesBk   = _filtrarPorDep(bks.map(b => b.serial));
  mants = mants.filter(m => serialesMant.includes(m.serial));
  bks   = bks.filter(b => serialesBk.includes(b.serial));

  // Filtrar por responsable
  if (resp) {
    mants = mants.filter(m => m.responsable === resp);
    bks   = bks.filter(b => b.respTI === resp);
  }

  const equipos = getData('equipos');

  // KPIs generales
  const mantFirmados  = mants.filter(m => m.firmado).length;
  const mantPendientes= mants.filter(m => !m.firmado).length;
  const bkOk          = bks.filter(b => b.estadoBk === 'Completado').length;
  const bkFallidos    = bks.filter(b => b.estadoBk === 'Fallido').length;
  const incAbiertas   = incs.filter(i => ['Iniciada','En proceso','Pendiente','abierta'].includes(i.estadoTexto||i.estado)).length;
  const incCerradas   = incs.filter(i => ['Finalizado','Cancelada','cerrada'].includes(i.estadoTexto||i.estado)).length;
  const eqOperativos  = equipos.filter(e => e.estado === 'Operativo' || !e.estado).length;
  const eqBaja        = equipos.filter(e => e.estado === 'Dado de baja').length;

  // Por dependencia
  const mantPorDep = {};
  const bkPorDep   = {};
  DB.dependencias.forEach(dep => {
    const ofIds = DB.oficinas.filter(o => o.depId === dep.id).map(o => o.id);
    const serials = equipos.filter(e => ofIds.includes(e.oficina)).map(e => e.serial);
    mantPorDep[dep.nombre.replace(/Secretar[ií]a de /i,'Sec. ')] =
      mants.filter(m => serials.includes(m.serial)).length;
    bkPorDep[dep.nombre.replace(/Secretar[ií]a de /i,'Sec. ')] =
      bks.filter(b => serials.includes(b.serial)).length;
  });

  // Tendencia mensual mantenimientos
  const mantPorMes = {};
  const bkPorMes   = {};
  mants.forEach(m => {
    const d = parseFecha(m.fecha);
    if (d) { const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; mantPorMes[k]=(mantPorMes[k]||0)+1; }
  });
  bks.forEach(b => {
    const d = parseFecha(b.fecha);
    if (d) { const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; bkPorMes[k]=(bkPorMes[k]||0)+1; }
  });

  const mesesSet = new Set([...Object.keys(mantPorMes), ...Object.keys(bkPorMes)]);
  const meses = [...mesesSet].sort();
  const maxMes = Math.max(...meses.map(m => Math.max(mantPorMes[m]||0, bkPorMes[m]||0)), 1);
  const maxDep = Math.max(...Object.values(mantPorDep), 1);

  document.getElementById('est-contenido').innerHTML = `

    <!-- KPIs GENERALES -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
      <div class="card" style="margin:0;text-align:center;">
        <div style="font-size:26px;font-weight:700;color:var(--accent);">${equipos.length}</div>
        <div style="font-size:11px;color:var(--text3);">Equipos registrados</div>
        <div style="font-size:10px;color:#16a34a;margin-top:4px;">${eqOperativos} operativos · <span style="color:#dc2626;">${eqBaja} de baja</span></div>
      </div>
      <div class="card" style="margin:0;text-align:center;">
        <div style="font-size:26px;font-weight:700;color:#2563eb;">${mants.length}</div>
        <div style="font-size:11px;color:var(--text3);">Mantenimientos</div>
        <div style="font-size:10px;color:#16a34a;margin-top:4px;">${mantFirmados} firmados · <span style="color:#d97706;">${mantPendientes} pendientes</span></div>
      </div>
      <div class="card" style="margin:0;text-align:center;">
        <div style="font-size:26px;font-weight:700;color:#7c3aed;">${bks.length}</div>
        <div style="font-size:11px;color:var(--text3);">Copias de seguridad</div>
        <div style="font-size:10px;color:#16a34a;margin-top:4px;">${bkOk} completados · <span style="color:#dc2626;">${bkFallidos} fallidos</span></div>
      </div>
      <div class="card" style="margin:0;text-align:center;">
        <div style="font-size:26px;font-weight:700;color:#dc2626;">${incs.length}</div>
        <div style="font-size:11px;color:var(--text3);">Incidencias</div>
        <div style="font-size:10px;color:#dc2626;margin-top:4px;">${incAbiertas} abiertas · <span style="color:#16a34a;">${incCerradas} cerradas</span></div>
      </div>
    </div>

    <!-- CUMPLIMIENTO -->
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">Indicadores de cumplimiento</div>
      ${_barra('Mantenimientos firmados', mantFirmados, mants.length, '#16a34a')}
      ${_barra('Backups completados', bkOk, bks.length, '#7c3aed')}
      ${_barra('Incidencias resueltas', incCerradas, incs.length, '#2563eb')}
      ${_barra('Equipos operativos', eqOperativos, equipos.length, '#16a34a')}
    </div>

    <!-- MANTENIMIENTOS POR DEPENDENCIA -->
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">Mantenimientos por dependencia</div>
      ${Object.entries(mantPorDep)
        .sort((a,b) => b[1]-a[1])
        .filter(([,v]) => v > 0)
        .map(([dep, cnt]) => _barra(dep, cnt, Math.max(...Object.values(mantPorDep),1), '#2563eb', true))
        .join('') || '<p style="font-size:12px;color:var(--text3);">Sin datos</p>'}
    </div>

    <!-- TENDENCIA MENSUAL -->
    ${meses.length > 0 ? `
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;">Tendencia mensual</div>
      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <span style="display:flex;align-items:center;gap:4px;font-size:10px;">
          <span style="width:10px;height:10px;background:#2563eb;border-radius:2px;display:inline-block;"></span>Mantenimientos
        </span>
        <span style="display:flex;align-items:center;gap:4px;font-size:10px;margin-left:8px;">
          <span style="width:10px;height:10px;background:#7c3aed;border-radius:2px;display:inline-block;"></span>Backups
        </span>
      </div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:120px;">
        ${meses.map(mes => {
          const cntM = mantPorMes[mes] || 0;
          const cntB = bkPorMes[mes]   || 0;
          const pctM = (cntM/maxMes*100).toFixed(0);
          const pctB = (cntB/maxMes*100).toFixed(0);
          const label= mes.split('-')[1]+'/'+mes.split('-')[0].slice(2);
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
              <div style="width:100%;display:flex;gap:1px;align-items:flex-end;height:90px;">
                <div style="flex:1;background:#2563eb;border-radius:2px 2px 0 0;
                  height:${pctM}%;min-height:${cntM>0?'3px':'0'};"></div>
                <div style="flex:1;background:#7c3aed;border-radius:2px 2px 0 0;
                  height:${pctB}%;min-height:${cntB>0?'3px':'0'};"></div>
              </div>
              <div style="font-size:9px;color:var(--text3);">${label}</div>
            </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- INCIDENCIAS POR TIPO -->
    ${incs.length ? `
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">Incidencias por tipo</div>
      ${(() => {
        const porTipo = {};
        incs.forEach(i => { porTipo[i.tipo||'Otro']=(porTipo[i.tipo||'Otro']||0)+1; });
        const maxT = Math.max(...Object.values(porTipo),1);
        return Object.entries(porTipo).sort((a,b)=>b[1]-a[1])
          .map(([t,c]) => _barra(t, c, maxT, '#dc2626', true)).join('');
      })()}
    </div>` : ''}

    <!-- EQUIPOS POR ESTADO -->
    <div class="card" style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px;">Equipos por estado</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${(() => {
          const porEstado = {};
          equipos.forEach(e => { const s=e.estado||'Operativo'; porEstado[s]=(porEstado[s]||0)+1; });
          const colors = {
            'Operativo':'#16a34a','Con fallas':'#d97706',
            'En mantenimiento':'#2563eb','Dado de baja':'#dc2626'
          };
          return Object.entries(porEstado).map(([est,cnt]) => `
            <div style="flex:1;min-width:80px;background:var(--bg2);
              border-radius:var(--radius-sm);padding:10px;text-align:center;">
              <div style="font-size:20px;font-weight:700;color:${colors[est]||'var(--text1)'};">${cnt}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px;">${est}</div>
            </div>`).join('');
        })()}
      </div>
    </div>
  `;
}

function _barra(label, val, total, color, soloValor=false) {
  const pct = total > 0 ? ((val/total)*100).toFixed(0) : 0;
  return `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span>${label}</span>
        <span style="font-weight:600;">${val}${soloValor ? '' : ` (${pct}%)`}</span>
      </div>
      <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;
          transition:width .6s ease;"></div>
      </div>
    </div>`;
}