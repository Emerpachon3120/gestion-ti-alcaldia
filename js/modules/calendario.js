import { getData, getDBStatic, setState } from '../state.js';
import { parseFecha } from '../utils.js';
import { navigate } from '../router.js';
import { apiPost, apiGet } from '../api.js';
import { showToast } from '../ui/toast.js';
const CONFIG = window.APP_CONFIG;

let _mesActual  = new Date().getMonth();
let _anioActual = new Date().getFullYear();
let _tabActiva  = 'calendario';
let _vistaActiva = 'mantenimientos';

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── HELPERS CRONOGRAMA ───────────────────────────────────────
function _getCronogramaData() {
  return getData('cronograma') || [];
}

function _getRowCronograma(depId, tipo, anio) {
  return _getCronogramaData().find(r =>
    String(r.dependenciaId) === String(depId) &&
    r.tipo === tipo &&
    String(r.anio) === String(anio)
  );
}

function _mesesProgramados(depId, tipo, anio) {
  const row = _getRowCronograma(depId, tipo, anio);
  if (!row) return [];
  const meses = [];
  for (let i = 1; i <= 12; i++) {
    const val = row[`mes${i}`];
    if (val === 'Sí' || val === 'Si' || val === 'si' || val === 'sí' || val === true) {
      meses.push(i);
    }
  }
  return meses;
}

// ─── RENDER PRINCIPAL ─────────────────────────────────────────
export function render() {
  return `
    <div class="page" id="page-calendario">
      <div class="page-header">
        <div class="section-title">📅 Calendario</div>
        <div class="section-sub">Cronograma de mantenimientos y backups</div>
      </div>

      <!-- TABS -->
      <div style="display:flex;gap:8px;margin-bottom:20px;background:var(--bg2);
        padding:4px;border-radius:12px;">
        <button id="tab-calendario" style="flex:1;padding:10px 16px;border:none;
          border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;
          font-family:var(--font-main);transition:all .2s;
          background:var(--accent);color:#fff;">
          🗓️ Calendario
        </button>
        <button id="tab-cronograma" style="flex:1;padding:10px 16px;border:none;
          border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;
          font-family:var(--font-main);transition:all .2s;
          background:transparent;color:var(--text2);">
          📊 Cronograma Anual
        </button>
      </div>

      <!-- SECCIÓN CALENDARIO -->
      <div id="seccion-calendario">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <button id="cal-prev" style="background:var(--card);border:1px solid var(--border);
            border-radius:8px;padding:8px 14px;color:var(--text1);cursor:pointer;
            font-size:16px;font-family:var(--font-main);">‹</button>
          <div id="cal-mes-label" style="font-size:16px;font-weight:700;"></div>
          <button id="cal-next" style="background:var(--card);border:1px solid var(--border);
            border-radius:8px;padding:8px 14px;color:var(--text1);cursor:pointer;
            font-size:16px;font-family:var(--font-main);">›</button>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
            <div style="width:10px;height:10px;border-radius:50%;background:#2563eb;"></div>Mantenimiento
          </div>
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
            <div style="width:10px;height:10px;border-radius:50%;background:#7c3aed;"></div>Backup
          </div>
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
            <div style="width:10px;height:10px;border-radius:50%;background:#dc2626;"></div>Incidencia
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">
          ${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d =>
            `<div style="text-align:center;font-size:10px;font-weight:700;
              color:var(--text3);padding:4px 0;">${d}</div>`
          ).join('')}
        </div>
        <div id="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;"></div>
        <div id="cal-eventos" style="margin-top:16px;"></div>
      </div>

      <!-- SECCIÓN CRONOGRAMA -->
      <div id="seccion-cronograma" style="display:none;">

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:18px;font-weight:800;color:var(--text1);">
              Cronograma Anual
            </div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px;">
              Alcaldía Municipal de Nemocón — Gestión TI
            </div>
          </div>
          <!-- Selector año -->
          <div style="display:flex;align-items:center;gap:8px;">
            <button id="cron-prev-anio" style="background:var(--card);border:1px solid var(--border);
              border-radius:8px;padding:6px 12px;color:var(--text1);cursor:pointer;
              font-size:14px;font-family:var(--font-main);">‹</button>
            <span id="cron-anio-label" style="font-size:15px;font-weight:700;
              min-width:50px;text-align:center;">${_anioActual}</span>
            <button id="cron-next-anio" style="background:var(--card);border:1px solid var(--border);
              border-radius:8px;padding:6px 12px;color:var(--text1);cursor:pointer;
              font-size:14px;font-family:var(--font-main);">›</button>
          </div>
        </div>

        <!-- Pestañas vista -->
        <div style="display:flex;gap:6px;margin-bottom:16px;">
          <button id="vista-mant" style="padding:8px 18px;border:none;border-radius:20px;
            cursor:pointer;font-size:12px;font-weight:700;font-family:var(--font-main);
            background:#2563eb;color:#fff;transition:all .2s;">
            🔧 Mantenimientos
          </button>
          <button id="vista-back" style="padding:8px 18px;border:1px solid var(--border);
            border-radius:20px;cursor:pointer;font-size:12px;font-weight:700;
            font-family:var(--font-main);background:var(--card);color:var(--text2);
            transition:all .2s;">
            💾 Backups
          </button>
        </div>

        <!-- Tabla -->
        <div id="cron-tabla"></div>

        <!-- Leyenda -->
        <div style="display:flex;gap:16px;margin-top:16px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);">
            <div style="width:22px;height:22px;border-radius:6px;background:#16a34a;
              display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;">✓</div>
            Mes actual programado
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);">
            <div id="leyenda-prog" style="width:22px;height:22px;border-radius:6px;background:#2563eb;
              display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;">✓</div>
            Programado
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);">
            <div style="width:22px;height:22px;border-radius:6px;background:var(--bg2);
              border:1px dashed var(--border);"></div>
            Sin programar
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);">
            <div style="padding:3px 8px;border-radius:6px;background:var(--accent);
              color:#fff;font-size:10px;font-weight:700;">✎ Editar</div>
            Clic en dependencia para editar
          </div>
        </div>

        <!-- Stats -->
        <div id="cron-stats" style="margin-top:20px;"></div>
      </div>

      <!-- MODAL EDICIÓN -->
      <div id="modal-cron-edit" style="display:none;position:fixed;inset:0;
        background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;">
        <div style="background:var(--card);border-radius:16px;padding:24px;
          width:90%;max-width:420px;max-height:90vh;overflow-y:auto;">
          <div style="font-size:16px;font-weight:800;margin-bottom:4px;" id="modal-cron-titulo"></div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:16px;" id="modal-cron-sub"></div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px;"
            id="modal-cron-meses"></div>
          <div style="display:flex;gap:8px;">
            <button id="modal-cron-cancel" style="flex:1;padding:12px;border:1px solid var(--border);
              border-radius:8px;background:transparent;color:var(--text2);cursor:pointer;
              font-family:var(--font-main);font-size:13px;">Cancelar</button>
            <button id="modal-cron-save" style="flex:2;padding:12px;border:none;
              border-radius:8px;background:var(--accent);color:#fff;cursor:pointer;
              font-family:var(--font-main);font-size:13px;font-weight:700;">
              💾 Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── ON ENTER ──────────────────────────────────────────────────
export function onEnter() {
  setTimeout(() => {
    // Tabs
    document.getElementById('tab-calendario')?.addEventListener('click', () => _cambiarTab('calendario'));
    document.getElementById('tab-cronograma')?.addEventListener('click', () => _cambiarTab('cronograma'));

    // Calendario nav
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

    // Cronograma año
    document.getElementById('cron-prev-anio')?.addEventListener('click', () => {
      _anioActual--;
      document.getElementById('cron-anio-label').textContent = _anioActual;
      _renderCronograma();
    });
    document.getElementById('cron-next-anio')?.addEventListener('click', () => {
      _anioActual++;
      document.getElementById('cron-anio-label').textContent = _anioActual;
      _renderCronograma();
    });

    // Vistas
    document.getElementById('vista-mant')?.addEventListener('click', () => _cambiarVista('mantenimientos'));
    document.getElementById('vista-back')?.addEventListener('click', () => _cambiarVista('backups'));

    // Modal
    document.getElementById('modal-cron-cancel')?.addEventListener('click', _cerrarModal);

    _renderCalendario();
  }, 100);
}

// ─── TABS ─────────────────────────────────────────────────────
function _cambiarTab(tab) {
  _tabActiva = tab;
  const btnCal  = document.getElementById('tab-calendario');
  const btnCron = document.getElementById('tab-cronograma');
  const secCal  = document.getElementById('seccion-calendario');
  const secCron = document.getElementById('seccion-cronograma');

  if (tab === 'calendario') {
    btnCal.style.background  = 'var(--accent)'; btnCal.style.color = '#fff';
    btnCron.style.background = 'transparent';   btnCron.style.color = 'var(--text2)';
    secCal.style.display = 'block'; secCron.style.display = 'none';
  } else {
    btnCron.style.background = 'var(--accent)'; btnCron.style.color = '#fff';
    btnCal.style.background  = 'transparent';   btnCal.style.color = 'var(--text2)';
    secCal.style.display = 'none'; secCron.style.display = 'block';
    _renderCronograma();
  }
}

// ─── VISTA CRONOGRAMA ─────────────────────────────────────────
function _cambiarVista(vista) {
  _vistaActiva = vista;
  const btnMant = document.getElementById('vista-mant');
  const btnBack = document.getElementById('vista-back');
  const leyProg = document.getElementById('leyenda-prog');

  if (vista === 'mantenimientos') {
    btnMant.style.background = '#2563eb'; btnMant.style.color = '#fff'; btnMant.style.border = 'none';
    btnBack.style.background = 'var(--card)'; btnBack.style.color = 'var(--text2)';
    btnBack.style.border = '1px solid var(--border)';
    if (leyProg) leyProg.style.background = '#2563eb';
  } else {
    btnBack.style.background = '#7c3aed'; btnBack.style.color = '#fff'; btnBack.style.border = 'none';
    btnMant.style.background = 'var(--card)'; btnMant.style.color = 'var(--text2)';
    btnMant.style.border = '1px solid var(--border)';
    if (leyProg) leyProg.style.background = '#7c3aed';
  }
  _renderCronograma();
}

// ─── RENDER CRONOGRAMA ────────────────────────────────────────
function _renderCronograma() {
  const contenedor = document.getElementById('cron-tabla');
  if (!contenedor) return;

  const DB          = getDBStatic();
  const deps        = DB.dependencias || [];
  const colorBase   = _vistaActiva === 'mantenimientos' ? '#2563eb' : '#7c3aed';
  const colorLight  = _vistaActiva === 'mantenimientos' ? '#eff6ff' : '#f5f3ff';
  const mesHoy      = new Date().getMonth() + 1;
  const anioHoy     = new Date().getFullYear();
  const esteAnio    = _anioActual === anioHoy;

  let totalProg = 0;

  let html = `
    <div style="background:var(--card);border-radius:16px;overflow:hidden;
      border:1px solid var(--border);box-shadow:0 2px 12px rgba(0,0,0,.06);">

      <!-- Header degradado -->
      <div style="background:linear-gradient(135deg,${colorBase}ee,${colorBase}88);
        padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:20px;">${_vistaActiva === 'mantenimientos' ? '🔧' : '💾'}</div>
          <div>
            <div style="font-size:15px;font-weight:800;color:#fff;">
              ${_vistaActiva === 'mantenimientos' ? 'Plan de Mantenimiento Preventivo' : 'Plan de Backups'}
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,.75);">
              Año ${_anioActual} · Toca una dependencia para editar
            </div>
          </div>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:680px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 14px;font-size:11px;font-weight:700;
                color:var(--text3);text-transform:uppercase;letter-spacing:.5px;
                background:var(--bg2);border-bottom:1px solid var(--border);
                position:sticky;left:0;z-index:2;min-width:180px;">
                Dependencia
              </th>
              ${MESES_CORTOS.map((m, i) => {
                const n = i + 1;
                const esAct = esteAnio && n === mesHoy;
                return `<th style="text-align:center;padding:8px 2px;font-size:10px;font-weight:700;
                  color:${esAct ? colorBase : 'var(--text3)'};text-transform:uppercase;
                  background:${esAct ? colorLight : 'var(--bg2)'};
                  border-bottom:1px solid var(--border);min-width:46px;
                  ${esAct ? `border-top:2px solid ${colorBase};` : ''}">
                  ${m}${esAct ? '<div style="width:4px;height:4px;border-radius:50%;background:currentColor;margin:2px auto 0;"></div>' : ''}
                </th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${deps.map((dep, idx) => {
              const meses = _mesesProgramados(dep.id, _vistaActiva, _anioActual);
              totalProg += meses.length;
              return `
                <tr style="border-bottom:1px solid var(--border);cursor:pointer;"
                  data-dep-id="${dep.id}" data-dep-nombre="${dep.nombre}"
                  class="cron-row"
                  onmouseover="this.style.background='${colorLight}'"
                  onmouseout="this.style.background=''">
                  <td style="padding:10px 14px;font-size:12px;font-weight:600;
                    color:var(--text1);background:var(--card);
                    position:sticky;left:0;z-index:1;
                    border-right:1px solid var(--border);">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                      <div style="display:flex;align-items:center;gap:6px;">
                        <div style="width:6px;height:6px;border-radius:50%;
                          background:${colorBase};flex-shrink:0;"></div>
                        <div>
                          <div style="font-size:12px;">${dep.nombre}</div>
                          <div style="font-size:10px;font-weight:400;color:var(--text3);">
                            ${meses.length} mes${meses.length !== 1 ? 'es' : ''} programado${meses.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div style="font-size:10px;padding:2px 8px;border-radius:10px;
                        background:${colorBase}22;color:${colorBase};font-weight:700;
                        white-space:nowrap;">✎ Editar</div>
                    </div>
                  </td>
                  ${MESES_CORTOS.map((m, i) => {
                    const n = i + 1;
                    const prog    = meses.includes(n);
                    const esAct   = esteAnio && n === mesHoy;
                    const esPas   = esteAnio && n < mesHoy;
                    let bg = 'transparent'; let content = ''; let opacity = '1';
                    if (prog) {
                      if (esAct)      { bg = 'linear-gradient(135deg,#16a34a,#22c55e)'; content = '✓'; }
                      else if (esPas) { bg = `${colorBase}bb`; content = '✓'; opacity = '0.65'; }
                      else            { bg = `linear-gradient(135deg,${colorBase},${colorBase}cc)`; content = '✓'; }
                    }
                    return `<td style="text-align:center;padding:5px 2px;
                      background:${esAct ? colorLight : (idx%2===0 ? 'var(--card)' : 'var(--bg2)')};
                      ${esAct ? `border-left:1px solid ${colorBase}33;border-right:1px solid ${colorBase}33;` : ''}">
                      ${prog
                        ? `<div style="width:30px;height:30px;border-radius:7px;background:${bg};
                            display:inline-flex;align-items:center;justify-content:center;
                            color:#fff;font-size:13px;font-weight:700;opacity:${opacity};
                            box-shadow:0 2px 5px rgba(0,0,0,.12);margin:0 auto;">${content}</div>`
                        : `<div style="width:30px;height:30px;border-radius:7px;
                            background:var(--bg2);border:1px dashed var(--border);
                            display:inline-flex;align-items:center;justify-content:center;
                            color:var(--text3);font-size:9px;margin:0 auto;">—</div>`}
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

  // Bind click edición
  contenedor.querySelectorAll('.cron-row').forEach(row => {
    row.addEventListener('click', () => {
      _abrirModalEdicion(row.dataset.depId, row.dataset.depNombre);
    });
  });

  // Stats
  const statsEl = document.getElementById('cron-stats');
  const pct = deps.length > 0 ? Math.round((totalProg / (deps.length * 12)) * 100) : 0;
  if (statsEl) {
    statsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;
          padding:14px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:${colorBase};">${deps.length}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">Dependencias</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;
          padding:14px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#16a34a;">${totalProg}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">Visitas programadas</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;
          padding:14px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:var(--text1);">${pct}%</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">Cobertura anual</div>
        </div>
      </div>`;
  }
}

// ─── MODAL EDICIÓN ────────────────────────────────────────────
let _editDepId = null;
let _editTipo  = null;
let _editAnio  = null;
let _editMeses = {};

function _abrirModalEdicion(depId, depNombre) {
  _editDepId = depId;
  _editTipo  = _vistaActiva;
  _editAnio  = _anioActual;

  const row   = _getRowCronograma(depId, _vistaActiva, _anioActual);
  _editMeses  = {};
  for (let i = 1; i <= 12; i++) {
    const val = row ? row[`mes${i}`] : '';
    _editMeses[i] = (val === 'Sí' || val === 'Si' || val === 'si' || val === 'sí' || val === true);
  }

  const colorBase = _vistaActiva === 'mantenimientos' ? '#2563eb' : '#7c3aed';

  document.getElementById('modal-cron-titulo').textContent =
    `✎ ${_vistaActiva === 'mantenimientos' ? 'Mantenimiento' : 'Backup'} — ${depNombre}`;
  document.getElementById('modal-cron-sub').textContent =
    `Año ${_anioActual} · Activa los meses en que se realizará la actividad`;

  const contenedorMeses = document.getElementById('modal-cron-meses');
  contenedorMeses.innerHTML = MESES_LARGOS.map((nombre, i) => {
    const n = i + 1;
    const activo = _editMeses[n];
    return `
      <button data-mes="${n}" style="
        padding:10px 6px;border-radius:10px;cursor:pointer;
        font-size:12px;font-weight:700;font-family:var(--font-main);
        border:2px solid ${activo ? colorBase : 'var(--border)'};
        background:${activo ? colorBase : 'var(--card)'};
        color:${activo ? '#fff' : 'var(--text2)'};
        transition:all .15s;text-align:center;">
        <div style="font-size:14px;">${activo ? '✓' : '○'}</div>
        <div style="font-size:10px;margin-top:2px;">${nombre.slice(0,3)}</div>
      </button>`;
  }).join('');

  // Bind toggles
  contenedorMeses.querySelectorAll('[data-mes]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.mes);
      _editMeses[n] = !_editMeses[n];
      const activo = _editMeses[n];
      btn.style.border      = `2px solid ${activo ? colorBase : 'var(--border)'}`;
      btn.style.background  = activo ? colorBase : 'var(--card)';
      btn.style.color       = activo ? '#fff' : 'var(--text2)';
      btn.querySelector('div').textContent = activo ? '✓' : '○';
    });
  });

  // Bind save
  const btnSave = document.getElementById('modal-cron-save');
  btnSave.onclick = _guardarCronograma;

  const modal = document.getElementById('modal-cron-edit');
  modal.style.display = 'flex';
}

function _cerrarModal() {
  document.getElementById('modal-cron-edit').style.display = 'none';
}

async function _guardarCronograma() {
  const btnSave = document.getElementById('modal-cron-save');
  btnSave.textContent = '⏳ Guardando...';
  btnSave.disabled = true;

  try {
    const row = _getRowCronograma(_editDepId, _editTipo, _editAnio);
    const data = {
      DependenciaID: _editDepId,
      Tipo:  _editTipo === 'mantenimientos' ? 'Mantenimiento' : 'Backup',
      Anio:  String(_editAnio),
    };
    for (let i = 1; i <= 12; i++) {
      data[`Mes${i}`] = _editMeses[i] ? 'Sí' : 'No';
    }

    let result;
    if (row && row.id) {
      result = await apiPost('Cronograma', 'update', data, 'ID', row.id);
    } else {
      const uid = 'CRON' + Date.now().toString(36).toUpperCase();
      data.ID = uid;
      result = await apiPost('Cronograma', 'insert', data);
    }

    // Actualizar estado local
    const cronActual = getData('cronograma') || [];
    const normalizado = {
      id: data.ID || (row?.id),
      dependenciaId: _editDepId,
      tipo: _editTipo,
      anio: _editAnio,
    };
    for (let i = 1; i <= 12; i++) normalizado[`mes${i}`] = _editMeses[i] ? 'Sí' : 'No';

    const existe = cronActual.findIndex(r =>
      String(r.dependenciaId) === String(_editDepId) &&
      r.tipo === _editTipo &&
      String(r.anio) === String(_editAnio)
    );
    if (existe >= 0) cronActual[existe] = normalizado;
    else cronActual.push(normalizado);

    setState('cronograma', cronActual);

    showToast('✅ Cronograma guardado');
    _cerrarModal();
    _renderCronograma();

  } catch(err) {
    console.error(err);
    showToast('❌ Error al guardar: ' + err.message);
  } finally {
    btnSave.textContent = '💾 Guardar';
    btnSave.disabled = false;
  }
}

// ─── CALENDARIO MENSUAL ───────────────────────────────────────
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
    const puntos  = eventos.slice(0,3).map(e =>
      `<div style="width:5px;height:5px;border-radius:50%;background:${e.color};"></div>`
    ).join('');

    html += `
      <div data-dia="${dia}" style="min-height:48px;background:var(--card);
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
    container.innerHTML = `<div style="text-align:center;color:var(--text3);font-size:13px;padding:20px;">
      Sin eventos el ${dia} de ${MESES_LARGOS[_mesActual].toLowerCase()}</div>`;
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
