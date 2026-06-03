import { getData, getDBStatic } from '../state.js';
import { parseFecha } from '../utils.js';
import { navigate } from '../router.js';
 
let _mesActual = new Date().getMonth();
let _anioActual = new Date().getFullYear();
let _tabActiva = 'calendario'; // 'calendario' | 'cronograma'
let _vistaActiva = 'mantenimientos'; // 'mantenimientos' | 'backups'
 
// ─── DATOS CRONOGRAMA ANUAL ───────────────────────────────────────────────────
const CRONOGRAMA = {
  mantenimientos: {
    'Gobierno':                        [2,3,4,5,6,7,8,9,10,11,12],
    'Hacienda':                        [2,3,4,5,6,7,8,9,10,11,12],
    'Servicios Públicos':              [2,3,4,5,6,7,8,9,10,11,12],
    'Planeación':                      [2,3,4,5,6,7,8,9,10,11,12],
    'Agricultura':                     [2,3,4,5,6,7,8,9,10,11,12],
    'Cultura y Turismo':               [2,3,4,5,6,7,8,9,10,11,12],
    'Coord. Programas Sociales':       [2,3,4,5,6,7,8,9,10,11,12],
  },
  backups: {
    'Planeación':                      [2,3,4,5,6,7,8,9,10,11,12],
    'Hacienda':                        [2,3,4,5,6,7,8,9,10,11,12],
    'Servicios Públicos':              [2,3,4,5,6,7,8,9,10,11,12],
    'Gobierno':                        [2,3,4,5,6,7,8,9,10,11,12],
    'Agricultura':                     [2,3,4,5,6,7,8,9,10,11,12],
    'Cultura y Turismo':               [2,3,4,5,6,7,8,9,10,11,12],
    'Coord. Programas Sociales':       [2,3,4,5,6,7,8,9,10,11,12],
  },
};
 
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
 
// ─── RENDER PRINCIPAL ────────────────────────────────────────────────────────
export function render() {
  return `
    <div class="page" id="page-calendario">
      <div class="page-header">
        <div class="section-title">📅 Calendario</div>
        <div class="section-sub">Cronograma de mantenimientos y backups</div>
      </div>
 
      <!-- TABS PRINCIPALES -->
      <div style="display:flex;gap:8px;margin-bottom:20px;background:var(--bg2);
        padding:4px;border-radius:12px;">
        <button id="tab-calendario" onclick="window._calTab('calendario')" style="
          flex:1;padding:10px 16px;border:none;border-radius:9px;cursor:pointer;
          font-size:13px;font-weight:600;font-family:var(--font-main);
          transition:all .2s;background:var(--accent);color:#fff;">
          🗓️ Calendario
        </button>
        <button id="tab-cronograma" onclick="window._calTab('cronograma')" style="
          flex:1;padding:10px 16px;border:none;border-radius:9px;cursor:pointer;
          font-size:13px;font-weight:600;font-family:var(--font-main);
          transition:all .2s;background:transparent;color:var(--text2);">
          📊 Cronograma Anual
        </button>
      </div>
 
      <!-- SECCIÓN CALENDARIO -->
      <div id="seccion-calendario">
        <!-- Navegación mes -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <button id="cal-prev" style="background:var(--card);border:1px solid var(--border);
            border-radius:8px;padding:8px 14px;color:var(--text1);cursor:pointer;
            font-size:16px;font-family:var(--font-main);">‹</button>
          <div id="cal-mes-label" style="font-size:16px;font-weight:700;"></div>
          <button id="cal-next" style="background:var(--card);border:1px solid var(--border);
            border-radius:8px;padding:8px 14px;color:var(--text1);cursor:pointer;
            font-size:16px;font-family:var(--font-main);">›</button>
        </div>
 
        <!-- Leyenda -->
        <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
            <div style="width:10px;height:10px;border-radius:50%;background:#2563eb;"></div>
            Mantenimiento
          </div>
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
            <div style="width:10px;height:10px;border-radius:50%;background:#7c3aed;"></div>
            Backup
          </div>
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
            <div style="width:10px;height:10px;border-radius:50%;background:#dc2626;"></div>
            Incidencia
          </div>
        </div>
 
        <!-- Días de semana -->
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">
          ${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d =>
            `<div style="text-align:center;font-size:10px;font-weight:700;
              color:var(--text3);padding:4px 0;">${d}</div>`
          ).join('')}
        </div>
 
        <!-- Grid del calendario -->
        <div id="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;"></div>
 
        <!-- Eventos del día -->
        <div id="cal-eventos" style="margin-top:16px;"></div>
      </div>
 
      <!-- SECCIÓN CRONOGRAMA ANUAL -->
      <div id="seccion-cronograma" style="display:none;">
 
        <!-- Header cronograma -->
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:18px;font-weight:800;color:var(--text1);">
              Cronograma ${_anioActual}
            </div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px;">
              Alcaldía Municipal de Nemocón — Gestión TI
            </div>
          </div>
          <!-- Selector año -->
          <div style="display:flex;align-items:center;gap:8px;">
            <button onclick="window._calAnio(-1)" style="background:var(--card);border:1px solid var(--border);
              border-radius:8px;padding:6px 12px;color:var(--text1);cursor:pointer;
              font-size:14px;font-family:var(--font-main);">‹</button>
            <span id="cron-anio-label" style="font-size:15px;font-weight:700;min-width:50px;
              text-align:center;">${_anioActual}</span>
            <button onclick="window._calAnio(1)" style="background:var(--card);border:1px solid var(--border);
              border-radius:8px;padding:6px 12px;color:var(--text1);cursor:pointer;
              font-size:14px;font-family:var(--font-main);">›</button>
          </div>
        </div>
 
        <!-- Pestañas vista -->
        <div style="display:flex;gap:6px;margin-bottom:16px;">
          <button id="vista-mant" onclick="window._calVista('mantenimientos')" style="
            padding:8px 18px;border:none;border-radius:20px;cursor:pointer;
            font-size:12px;font-weight:700;font-family:var(--font-main);
            background:#2563eb;color:#fff;transition:all .2s;">
            🔧 Mantenimientos
          </button>
          <button id="vista-back" onclick="window._calVista('backups')" style="
            padding:8px 18px;border:none;border-radius:20px;cursor:pointer;
            font-size:12px;font-weight:700;font-family:var(--font-main);
            background:var(--card);color:var(--text2);
            border:1px solid var(--border);transition:all .2s;">
            💾 Backups
          </button>
        </div>
 
        <!-- Tabla cronograma -->
        <div id="cron-tabla" style="overflow-x:auto;"></div>
 
        <!-- Leyenda cronograma -->
        <div style="display:flex;gap:16px;margin-top:16px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);">
            <div style="width:20px;height:20px;border-radius:6px;background:linear-gradient(135deg,#2563eb,#3b82f6);
              display:flex;align-items:center;justify-content:center;font-size:10px;">✓</div>
            Programado
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);">
            <div style="width:20px;height:20px;border-radius:6px;background:var(--bg2);
              border:1px solid var(--border);"></div>
            Sin programar
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);">
            <div style="width:20px;height:20px;border-radius:6px;
              background:linear-gradient(135deg,#16a34a,#22c55e);
              display:flex;align-items:center;justify-content:center;font-size:10px;">✓</div>
            Mes actual (programado)
          </div>
        </div>
 
        <!-- Stats -->
        <div id="cron-stats" style="margin-top:20px;"></div>
      </div>
    </div>
  `;
}
 
// ─── ON ENTER ────────────────────────────────────────────────────────────────
export function onEnter() {
  // Exponer funciones globales
  window._calTab   = _cambiarTab;
  window._calVista = _cambiarVista;
  window._calAnio  = _cambiarAnio;
 
  setTimeout(() => {
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      _mesActual--;
      if (_mesActual < 0) { _mesActual = 11; _anioActual--; }
      _renderCalendario();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      _mesActual++;
      if (_mesActual > 11) { _mesActual = 0; _anioActual++; }
      _renderCalendario();
    });
 
    _renderCalendario();
 
    if (_tabActiva === 'cronograma') {
      _mostrarCronograma();
    }
  }, 100);
}
 
// ─── CAMBIAR TAB ─────────────────────────────────────────────────────────────
function _cambiarTab(tab) {
  _tabActiva = tab;
 
  const btnCal  = document.getElementById('tab-calendario');
  const btnCron = document.getElementById('tab-cronograma');
  const secCal  = document.getElementById('seccion-calendario');
  const secCron = document.getElementById('seccion-cronograma');
 
  if (tab === 'calendario') {
    btnCal.style.background  = 'var(--accent)';
    btnCal.style.color       = '#fff';
    btnCron.style.background = 'transparent';
    btnCron.style.color      = 'var(--text2)';
    secCal.style.display  = 'block';
    secCron.style.display = 'none';
  } else {
    btnCron.style.background = 'var(--accent)';
    btnCron.style.color      = '#fff';
    btnCal.style.background  = 'transparent';
    btnCal.style.color       = 'var(--text2)';
    secCal.style.display  = 'none';
    secCron.style.display = 'block';
    _mostrarCronograma();
  }
}
 
// ─── CAMBIAR VISTA CRONOGRAMA ─────────────────────────────────────────────────
function _cambiarVista(vista) {
  _vistaActiva = vista;
 
  const btnMant = document.getElementById('vista-mant');
  const btnBack = document.getElementById('vista-back');
 
  if (vista === 'mantenimientos') {
    btnMant.style.background = '#2563eb';
    btnMant.style.color      = '#fff';
    btnMant.style.border     = 'none';
    btnBack.style.background = 'var(--card)';
    btnBack.style.color      = 'var(--text2)';
    btnBack.style.border     = '1px solid var(--border)';
  } else {
    btnBack.style.background = '#7c3aed';
    btnBack.style.color      = '#fff';
    btnBack.style.border     = 'none';
    btnMant.style.background = 'var(--card)';
    btnMant.style.color      = 'var(--text2)';
    btnMant.style.border     = '1px solid var(--border)';
  }
 
  _renderCronograma();
}
 
// ─── CAMBIAR AÑO ──────────────────────────────────────────────────────────────
function _cambiarAnio(delta) {
  _anioActual += delta;
  const label = document.getElementById('cron-anio-label');
  if (label) label.textContent = _anioActual;
  _renderCronograma();
}
 
// ─── MOSTRAR CRONOGRAMA ───────────────────────────────────────────────────────
function _mostrarCronograma() {
  _renderCronograma();
}
 
function _renderCronograma() {
  const contenedor = document.getElementById('cron-tabla');
  if (!contenedor) return;
 
  const datos     = CRONOGRAMA[_vistaActiva];
  const colorBase = _vistaActiva === 'mantenimientos' ? '#2563eb' : '#7c3aed';
  const colorLight = _vistaActiva === 'mantenimientos' ? '#eff6ff' : '#f5f3ff';
  const mesHoy    = new Date().getMonth() + 1; // 1-indexed
  const anioHoy   = new Date().getFullYear();
  const esteAnio  = _anioActual === anioHoy;
 
  const secretarias = Object.keys(datos);
  const totalProg   = secretarias.reduce((acc, s) => acc + datos[s].length, 0);
  const totalCeldas = secretarias.length * 12;
 
  // ── Tabla ────────────────────────────────────────────────────────────────
  let html = `
    <div style="background:var(--card);border-radius:16px;overflow:hidden;
      border:1px solid var(--border);box-shadow:0 2px 12px rgba(0,0,0,.06);">
 
      <!-- Header superior con gradiente -->
      <div style="background:linear-gradient(135deg,${colorBase}ee,${colorBase}99);
        padding:16px 20px;display:flex;align-items:center;gap:10px;">
        <div style="font-size:20px;">${_vistaActiva === 'mantenimientos' ? '🔧' : '💾'}</div>
        <div>
          <div style="font-size:15px;font-weight:800;color:#fff;">
            ${_vistaActiva === 'mantenimientos' ? 'Plan de Mantenimiento Preventivo' : 'Plan de Backups'}
          </div>
          <div style="font-size:11px;color:rgba(255,255,255,.75);">
            Año ${_anioActual} · Alcaldía Municipal de Nemocón
          </div>
        </div>
      </div>
 
      <!-- Tabla -->
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:700px;">
 
          <!-- Cabecera meses -->
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 16px;font-size:11px;font-weight:700;
                color:var(--text3);text-transform:uppercase;letter-spacing:.5px;
                background:var(--bg2);border-bottom:1px solid var(--border);
                position:sticky;left:0;z-index:2;min-width:160px;">
                Secretaría / Dependencia
              </th>
              ${MESES_CORTOS.map((m, i) => {
                const numMes = i + 1;
                const esActual = esteAnio && numMes === mesHoy;
                return `
                  <th style="text-align:center;padding:8px 4px;font-size:11px;font-weight:700;
                    color:${esActual ? colorBase : 'var(--text3)'};
                    text-transform:uppercase;letter-spacing:.3px;
                    background:${esActual ? colorLight : 'var(--bg2)'};
                    border-bottom:1px solid var(--border);
                    min-width:52px;
                    ${esActual ? `border-top:2px solid ${colorBase};` : ''}">
                    ${m}
                    ${esActual ? '<div style="width:4px;height:4px;border-radius:50%;background:currentColor;margin:2px auto 0;"></div>' : ''}
                  </th>`;
              }).join('')}
            </tr>
          </thead>
 
          <!-- Filas secretarías -->
          <tbody>
            ${secretarias.map((sec, idx) => {
              const mesesProg = datos[sec];
              const progCount = mesesProg.length;
              return `
                <tr style="border-bottom:1px solid var(--border);">
                  <!-- Nombre secretaría -->
                  <td style="padding:10px 16px;font-size:12px;font-weight:600;
                    color:var(--text1);background:var(--card);
                    position:sticky;left:0;z-index:1;
                    border-right:1px solid var(--border);">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="width:6px;height:6px;border-radius:50%;
                        background:${colorBase};flex-shrink:0;"></div>
                      <div>
                        <div>${sec}</div>
                        <div style="font-size:10px;font-weight:400;color:var(--text3);">
                          ${progCount} mes${progCount !== 1 ? 'es' : ''} programado${progCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </td>
 
                  <!-- Celdas meses -->
                  ${MESES_CORTOS.map((m, i) => {
                    const numMes = i + 1;
                    const programado = mesesProg.includes(numMes);
                    const esActual   = esteAnio && numMes === mesHoy;
                    const esPasado   = esteAnio && numMes < mesHoy;
                    const esFuturo   = esteAnio && numMes > mesHoy;
 
                    let bg = 'transparent';
                    let content = '';
                    let opacity = '1';
 
                    if (programado) {
                      if (esActual) {
                        bg = 'linear-gradient(135deg,#16a34a,#22c55e)';
                        content = '✓';
                      } else if (esPasado) {
                        bg = `linear-gradient(135deg,${colorBase},${colorBase}cc)`;
                        content = '✓';
                        opacity = '0.7';
                      } else {
                        bg = `linear-gradient(135deg,${colorBase},${colorBase}99)`;
                        content = '✓';
                      }
                    }
 
                    return `
                      <td style="text-align:center;padding:6px 4px;
                        background:${esActual ? colorLight : (idx%2===0 ? 'var(--card)' : 'var(--bg2)')};
                        ${esActual ? `border-left:1px solid ${colorBase}33;border-right:1px solid ${colorBase}33;` : ''}">
                        ${programado ? `
                          <div style="
                            width:32px;height:32px;border-radius:8px;
                            background:${bg};
                            display:inline-flex;align-items:center;justify-content:center;
                            color:#fff;font-size:13px;font-weight:700;
                            opacity:${opacity};
                            box-shadow:0 2px 6px rgba(0,0,0,.15);
                            margin:0 auto;">
                            ${content}
                          </div>` : `
                          <div style="
                            width:32px;height:32px;border-radius:8px;
                            background:var(--bg2);border:1px dashed var(--border);
                            display:inline-flex;align-items:center;justify-content:center;
                            color:var(--text3);font-size:10px;margin:0 auto;">
                            —
                          </div>`}
                      </td>`;
                  }).join('')}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
 
  contenedor.innerHTML = html;
 
  // ── Stats ─────────────────────────────────────────────────────────────────
  const pct = Math.round((totalProg / totalCeldas) * 100);
  const statsEl = document.getElementById('cron-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        <div style="background:var(--card);border:1px solid var(--border);
          border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:${colorBase};">${secretarias.length}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">Dependencias</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);
          border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#16a34a;">${totalProg}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">Visitas programadas</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);
          border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:var(--text1);">${pct}%</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">Cobertura anual</div>
        </div>
      </div>
    `;
  }
}
 
// ─── CALENDARIO MENSUAL ───────────────────────────────────────────────────────
function _getEventosDia(dia, mes, anio) {
  const eventos = [];
 
  getData('mantenimientos').forEach(m => {
    const d = parseFecha(m.fechaProxima);
    if (d && d.getDate()===dia && d.getMonth()===mes && d.getFullYear()===anio)
      eventos.push({ tipo:'mant', serial:m.serial, color:'#2563eb', label:'Mantenimiento', data:m });
  });
 
  getData('backups').forEach(b => {
    const d = parseFecha(b.fechaProxima);
    if (d && d.getDate()===dia && d.getMonth()===mes && d.getFullYear()===anio)
      eventos.push({ tipo:'backup', serial:b.serial, color:'#7c3aed', label:'Backup', data:b });
  });
 
  getData('incidencias').forEach(i => {
    const d = parseFecha(i.fecha);
    if (d && d.getDate()===dia && d.getMonth()===mes && d.getFullYear()===anio)
      eventos.push({ tipo:'inc', color:'#dc2626', label:'Incidencia', data:i });
  });
 
  return eventos;
}
 
function _renderCalendario() {
  document.getElementById('cal-mes-label').textContent =
    `${MESES_LARGOS[_mesActual]} ${_anioActual}`;
 
  const hoy = new Date();
  const primerDia = new Date(_anioActual, _mesActual, 1).getDay();
  const diasMes   = new Date(_anioActual, _mesActual+1, 0).getDate();
 
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
 
  let html = '';
  for (let i = 0; i < primerDia; i++) html += `<div style="min-height:48px;"></div>`;
 
  for (let dia = 1; dia <= diasMes; dia++) {
    const eventos = _getEventosDia(dia, _mesActual, _anioActual);
    const esHoy   = dia === hoy.getDate() && _mesActual === hoy.getMonth() && _anioActual === hoy.getFullYear();
 
    const puntos = eventos.slice(0,3).map(e =>
      `<div style="width:5px;height:5px;border-radius:50%;background:${e.color};"></div>`
    ).join('');
 
    html += `
      <div data-dia="${dia}" style="
        min-height:48px;background:var(--card);
        border:1px solid ${esHoy?'var(--accent)':'var(--border)'};
        border-radius:8px;padding:4px;cursor:pointer;
        ${esHoy?'background:rgba(192,57,43,.1);':''}
        display:flex;flex-direction:column;align-items:center;">
        <div style="font-size:12px;font-weight:${esHoy?'700':'400'};
          color:${esHoy?'var(--accent)':'var(--text1)'};">${dia}</div>
        <div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center;margin-top:2px;">
          ${puntos}
        </div>
        ${eventos.length > 3 ? `<div style="font-size:9px;color:var(--text3);">+${eventos.length-3}</div>` : ''}
      </div>`;
  }
 
  grid.innerHTML = html;
 
  grid.querySelectorAll('[data-dia]').forEach(el => {
    el.addEventListener('click', () => {
      const dia = parseInt(el.dataset.dia);
      _mostrarEventosDia(dia);
      grid.querySelectorAll('[data-dia]').forEach(e =>
        e.style.borderColor = e.dataset.dia == dia ? 'var(--accent)' : 'var(--border)');
    });
  });
 
  if (_mesActual === hoy.getMonth() && _anioActual === hoy.getFullYear())
    _mostrarEventosDia(hoy.getDate());
  else
    document.getElementById('cal-eventos').innerHTML = '';
}
 
function _mostrarEventosDia(dia) {
  const DB = getDBStatic();
  const eventos = _getEventosDia(dia, _mesActual, _anioActual);
  const container = document.getElementById('cal-eventos');
  if (!container) return;
 
  if (!eventos.length) {
    container.innerHTML = `
      <div style="text-align:center;color:var(--text3);font-size:13px;padding:20px;">
        Sin eventos el ${dia} de ${MESES_LARGOS[_mesActual].toLowerCase()}
      </div>`;
    return;
  }
 
  container.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--text3);
      text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
      ${dia} de ${MESES_LARGOS[_mesActual].toLowerCase()} — ${eventos.length} evento${eventos.length>1?'s':''}
    </div>
    ${eventos.map(e => {
      const eq  = e.serial ? getData('equipos').find(x => x.serial === e.serial) : null;
      const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
      const of  = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
      const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
      return `
        <div style="background:var(--card);border:1px solid var(--border);
          border-left:3px solid ${e.color};border-radius:8px;
          padding:10px 12px;margin-bottom:6px;cursor:pointer;"
          onclick="navigate('${e.tipo==='mant'?'mantenimientos':e.tipo==='backup'?'backups':'incidencias'}')">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${e.color};"></div>
            <div style="font-size:12px;font-weight:700;">${e.label}</div>
          </div>
          <div style="font-size:12px;color:var(--text1);">${e.serial || e.data?.tipo || '—'}</div>
          <div style="font-size:11px;color:var(--text3);">
            ${p?.nombre || '—'} · ${dep?.nombre?.replace(/Secretar[ií]a de /i,'Sec. ') || of?.nombre || ''}
          </div>
        </div>`;
    }).join('')}
  `;
}