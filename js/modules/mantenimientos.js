import { abrirFirma as _abrirFirma }     from '../ui/firma.js';
import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }                        from '../storage.js';
import { apiPost }                        from '../api.js';
import { showToast }                      from '../ui/toast.js';
import { abrirModal, cerrarModal }        from '../ui/modal.js';
import { verActaMantenimiento }           from '../ui/documento.js';
import { uid, formatDate, parseFecha, calcSemaforo, calcFechaProxima } from '../utils.js';
import { buildSearchSelect, getSSValue, setSSValue, llenarSSEquipos, llenarSSPersonas } from '../ui/searchselect.js';
import { navigate } from '../router.js';

let currentFilter = 'todos';
let currentSearch = '';
let fDesde = '', fHasta = '';
let mtFotos = [];

// ── Render página ─────────────────────────────────────────────
export function render() {
  return `
    <div class="page" id="page-mantenimientos">
      <div class="page-header">
        <div class="section-title">🔧 Mantenimientos</div>
        <div class="section-sub">Registro y firma digital</div>
      </div>

      <div class="filter-tabs">
        <button class="filter-tab active" data-filter="todos">Todos</button>
        <button class="filter-tab" data-filter="pendiente">Sin firmar</button>
        <button class="filter-tab" data-filter="firmado">Firmados</button>
        <button class="filter-tab" data-filter="preventivo">Preventivo</button>
        <button class="filter-tab" data-filter="correctivo">Correctivo</button>
        <button class="filter-tab" data-filter="vencido">🔴 Vencidos</button>
      </div>

      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" id="mant-search" placeholder="Buscar serial, funcionario...">
      </div>

      <div class="date-filter">
        <span class="date-filter-label">Desde:</span>
        <input type="date" id="mant-desde" class="form-input">
        <span class="date-filter-label">Hasta:</span>
        <input type="date" id="mant-hasta" class="form-input">
      </div>

      <div id="mant-list"></div>
    </div>
    ${_modalHTML()}
  `;
}

export function onEnter() {
  _bindEvents();
  renderLista();
  window.abrirNuevoMantto = abrirNuevo;
  window.editarMantto     = editar;
}

// ── Lista ─────────────────────────────────────────────────────
export function renderLista() {
  const DB  = getDBStatic();
  let data  = getData('mantenimientos').slice().reverse();

  if (currentFilter === 'pendiente')  data = data.filter(m => !m.firmado);
  if (currentFilter === 'firmado')    data = data.filter(m => m.firmado);
  if (currentFilter === 'preventivo') data = data.filter(m => m.tipo?.toLowerCase().includes('preventivo'));
  if (currentFilter === 'correctivo') data = data.filter(m => m.tipo?.toLowerCase().includes('correctivo'));
  if (currentFilter === 'vencido')    data = data.filter(m => {
    const s = calcSemaforo(m.fechaProxima);
    return s?.clase === 'semaforo-rojo';
  });

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    data = data.filter(m => {
      const eq = getData('equipos').find(e => e.serial === m.serial);
      const p  = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
      return m.serial.toLowerCase().includes(q) ||
             (p?.nombre || '').toLowerCase().includes(q);
    });
  }
  if (fDesde) data = data.filter(m => { const d = parseFecha(m.fecha); return d && d >= new Date(fDesde); });
  if (fHasta) data = data.filter(m => { const d = parseFecha(m.fecha); return d && d <= new Date(fHasta); });

  const container = document.getElementById('mant-list');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <p>Sin mantenimientos</p>
    </div>`;
    return;
  }

  container.innerHTML = data.map(m => _cardHTML(m)).join('');

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset;
      if (action === 'editar')   editar(id);
      if (action === 'eliminar') eliminar(id);
      if (action === 'firmar')   abrirFirma(id);
      if (action === 'verdoc')   verActaMantenimiento(id);
    });
  });
}

// ── Card HTML ─────────────────────────────────────────────────
function _cardHTML(m) {
  const DB  = getDBStatic();
  const eq  = getData('equipos').find(e => e.serial === m.serial);
  const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
  const of  = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
  const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
  const sem = calcSemaforo(m.fechaProxima);
  const tipoBadge = m.tipo?.includes('Correctivo') ? 'badge-red' :
                    m.tipo?.includes('Predictivo')  ? 'badge-purple' : 'badge-blue';

  return `
    <div class="mant-card">
      <div class="mant-header">
        <div>
          <div class="mant-serial">${m.serial}</div>
          <div class="mant-person">${p?.nombre || 'Sin asignar'}</div>
          <div style="font-size:11px;color:var(--text3)">${dep?.nombre || of?.nombre || ''}</div>
        </div>
        <div style="text-align:right;">
          <span class="badge ${tipoBadge}">${m.tipo || 'Preventivo'}</span>
          ${sem ? `<div class="semaforo ${sem.clase}" style="margin-top:4px">${sem.icon} ${sem.label}</div>` : ''}
          ${m.estadoEquipo ? `<div style="font-size:10px;color:var(--text3);margin-top:2px;">🖥️ ${m.estadoEquipo}</div>` : ''}
        </div>
      </div>

      ${m.obs ? `<div class="mant-obs">${m.obs}</div>` : ''}

      <div class="mant-meta">
        <span class="tag">📅 ${formatDate(m.fecha)}</span>
        ${m.fechaProxima ? `<span class="tag">⏭️ ${formatDate(m.fechaProxima)}</span>` : ''}
        ${m.frecuencia   ? `<span class="tag">🔁 ${m.frecuencia}</span>` : ''}
        ${m.responsable  ? `<span class="tag">👷 ${m.responsable}</span>` : ''}
        ${m.fotos?.length ? `<span class="tag">📸 ${m.fotos.length}</span>` : ''}
      </div>

      ${m.traslado === 'Sí' ? `
        <div style="font-size:11px;background:#fef3c7;color:#92400e;padding:4px 8px;border-radius:6px;margin-top:6px;">
          🚚 Trasladado: ${m.depAnterior || '—'} → ${m.depNueva || '—'}
        </div>` : ''}

      ${m.firmado
        ? `<div style="display:flex;gap:6px;margin-top:10px;">
            <button class="sign-btn signed" disabled style="flex:2;margin-top:0;">
              ✅ Firmado ${m.firmaFecha ? '· ' + formatDate(m.firmaFecha.split('T')[0]) : ''}
            </button>
            <button class="doc-viewer-btn" data-action="verdoc" data-id="${m.id}"
              style="flex:1;margin-top:0;padding:10px;border:1px solid var(--border);
                     border-radius:var(--radius-sm);background:var(--bg2);
                     font-family:var(--font-main);font-size:12px;cursor:pointer;">
              📄 Ver acta
            </button>
          </div>`
        : `<button class="sign-btn" data-action="firmar" data-id="${m.id}">
             ✍️ Solicitar firma del funcionario
           </button>`
      }

      <div class="card-actions">
        <button class="action-btn" data-action="editar" data-id="${m.id}">✏️ Editar</button>
        <button class="action-btn del" data-action="eliminar" data-id="${m.id}">🗑️ Eliminar</button>
      </div>
    </div>`;
}

// ── Modal HTML completo ───────────────────────────────────────
function _modalHTML() {
  return `
  <div class="modal-overlay" id="modal-mantto">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title" id="mt-title">🔧 Nuevo Mantenimiento</div>
      <input type="hidden" id="mt-edit-id">

      <!-- SECCIÓN 1: INFO GENERAL -->
      <div style="font-size:11px;font-weight:700;color:var(--accent);
                  text-transform:uppercase;letter-spacing:.5px;
                  margin:8px 0 10px;padding-bottom:4px;
                  border-bottom:2px solid var(--accent-bg);">
        📋 Información general
      </div>

      <div class="form-group">
        <label class="form-label">Equipo (serial) *</label>
        <div id="mt-equipo-ss"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Tipo *</label>
          <select class="form-select" id="mt-tipo">
            <option>Mantenimiento Preventivo</option>
            <option>Mantenimiento Correctivo</option>
            <option>Mantenimiento Predictivo</option>
            <option>Mantenimiento Adaptativo</option>
            <option>Mantenimiento de Emergencia</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Frecuencia</label>
          <select class="form-select" id="mt-frecuencia">
            <option>Mensual</option>
            <option>Trimestral</option>
            <option selected>Semestral</option>
            <option>Anual</option>
            <option>Ocasional</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Fecha ejecución *</label>
          <input type="date" class="form-input" id="mt-fecha">
        </div>
        <div class="form-group">
          <label class="form-label">Próxima (auto)</label>
          <input type="date" class="form-input" id="mt-fecha-proxima"
            style="background:var(--bg2);" readonly>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Período</label>
        <input type="text" class="form-input" id="mt-periodo" placeholder="Ej: 2025-I, Primer semestre">
      </div>

      <!-- SECCIÓN 2: CONTROL EJECUCIÓN -->
      <div style="font-size:11px;font-weight:700;color:var(--accent);
                  text-transform:uppercase;letter-spacing:.5px;
                  margin:12px 0 10px;padding-bottom:4px;
                  border-bottom:2px solid var(--accent-bg);">
        👷 Control de ejecución
      </div>

      <div class="form-group">
        <label class="form-label">Responsable TI</label>
        <input type="text" class="form-input" id="mt-responsable" value="Emerson Pachón Ayala">
      </div>

      <div class="form-group">
        <label class="form-label">Responsable actual del equipo</label>
        <div id="mt-resp-equipo-ss"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">¿Cambió responsable?</label>
          <select class="form-select" id="mt-cambio-resp">
            <option value="No">No</option>
            <option value="Sí">Sí</option>
          </select>
        </div>
        <div class="form-group" id="mt-nuevo-resp-wrap" style="display:none;">
          <label class="form-label">Nuevo responsable</label>
          <div id="mt-nuevo-resp-ss"></div>
        </div>
      </div>

      <!-- SECCIÓN 3: CREDENCIALES -->
      <div style="font-size:11px;font-weight:700;color:var(--accent);
                  text-transform:uppercase;letter-spacing:.5px;
                  margin:12px 0 10px;padding-bottom:4px;
                  border-bottom:2px solid var(--accent-bg);">
        🔐 Datos de acceso
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Usuario Windows</label>
          <input type="text" class="form-input" id="mt-user-win" placeholder="usuario">
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña Windows</label>
          <input type="text" class="form-input" id="mt-pass-win" placeholder="••••••">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Usuario Admin</label>
          <input type="text" class="form-input" id="mt-user-admin" placeholder="admin">
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña Admin</label>
          <input type="text" class="form-input" id="mt-pass-admin" placeholder="••••••">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">¿Se cambiaron credenciales?</label>
        <select class="form-select" id="mt-cambio-cred">
          <option value="No">No</option>
          <option value="Sí">Sí</option>
        </select>
      </div>

      <!-- SECCIÓN 4: TRASLADO -->
      <div style="font-size:11px;font-weight:700;color:var(--accent);
                  text-transform:uppercase;letter-spacing:.5px;
                  margin:12px 0 10px;padding-bottom:4px;
                  border-bottom:2px solid var(--accent-bg);">
        🚚 Traslado de dependencia
      </div>

      <div class="form-group">
        <label class="form-label">¿El equipo fue trasladado?</label>
        <select class="form-select" id="mt-traslado">
          <option value="No">No</option>
          <option value="Sí">Sí</option>
        </select>
      </div>

      <div id="mt-traslado-wrap" style="display:none;">
        <div class="form-group">
          <label class="form-label">Dependencia anterior</label>
          <input type="text" class="form-input" id="mt-dep-anterior">
        </div>
        <div class="form-group">
          <label class="form-label">Nueva dependencia</label>
          <input type="text" class="form-input" id="mt-dep-nueva">
        </div>
        <div class="form-group">
          <label class="form-label">Fecha traslado</label>
          <input type="date" class="form-input" id="mt-fecha-traslado">
        </div>
      </div>

      <!-- SECCIÓN 5: ADICIONAL -->
      <div style="font-size:11px;font-weight:700;color:var(--accent);
                  text-transform:uppercase;letter-spacing:.5px;
                  margin:12px 0 10px;padding-bottom:4px;
                  border-bottom:2px solid var(--accent-bg);">
        📝 Información adicional
      </div>

      <div class="form-group">
        <label class="form-label">Estado del equipo post-mantenimiento</label>
        <select class="form-select" id="mt-estado-equipo">
          <option>Operativo</option>
          <option>Con fallas menores</option>
          <option>Requiere repuesto</option>
          <option>Dado de baja</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Observaciones / Actividades realizadas</label>
        <textarea class="form-textarea" id="mt-obs"
          placeholder="Describe las actividades realizadas..."></textarea>
      </div>

      <!-- Fotos -->
      <div class="form-group">
        <label class="form-label">📸 Evidencia fotográfica</label>
        <div class="foto-upload-area" onclick="document.getElementById('mt-foto-input').click()">
          <label class="foto-upload-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Tomar foto o elegir de galería
          </label>
          <input type="file" id="mt-foto-input" accept="image/*" multiple
            capture="environment">
        </div>
        <div class="foto-grid" id="mt-fotos-preview"></div>
      </div>

      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-secondary" style="flex:1;margin-top:0;" id="mt-cancel-btn">
          Cancelar
        </button>
        <button class="btn btn-primary" style="flex:2;margin-top:0;" id="mt-save-btn">
          ✅ Registrar
        </button>
      </div>
    </div>
  </div>`;
}

// ── Bind eventos ──────────────────────────────────────────────
function _bindEvents() {
  document.querySelectorAll('#page-mantenimientos .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-mantenimientos .filter-tab')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderLista();
    });
  });

  document.getElementById('mant-search')?.addEventListener('input', e => {
    currentSearch = e.target.value; renderLista();
  });
  document.getElementById('mant-desde')?.addEventListener('change', e => {
    fDesde = e.target.value; renderLista();
  });
  document.getElementById('mant-hasta')?.addEventListener('change', e => {
    fHasta = e.target.value; renderLista();
  });

  document.getElementById('mt-cancel-btn')?.addEventListener('click', () =>
    cerrarModal('modal-mantto')
  );
  document.getElementById('mt-save-btn')?.addEventListener('click', guardar);

  // Auto-calcular fecha próxima
  const calcProx = () => {
    const fecha = document.getElementById('mt-fecha')?.value;
    const frec  = document.getElementById('mt-frecuencia')?.value;
    if (fecha && frec) {
      document.getElementById('mt-fecha-proxima').value = calcFechaProxima(fecha, frec);
    }
  };
  document.getElementById('mt-fecha')?.addEventListener('change', calcProx);
  document.getElementById('mt-frecuencia')?.addEventListener('change', calcProx);

  // Mostrar/ocultar nuevo responsable
  document.getElementById('mt-cambio-resp')?.addEventListener('change', e => {
    document.getElementById('mt-nuevo-resp-wrap').style.display =
      e.target.value === 'Sí' ? 'block' : 'none';
  });

  // Mostrar/ocultar traslado
  document.getElementById('mt-traslado')?.addEventListener('change', e => {
    document.getElementById('mt-traslado-wrap').style.display =
      e.target.value === 'Sí' ? 'block' : 'none';
  });

  // Fotos
  document.getElementById('mt-foto-input')?.addEventListener('change', e => {
    _procesarFotos(e.target.files, mtFotos, 'mt-fotos-preview');
  });
}

// ── CRUD ──────────────────────────────────────────────────────
function abrirNuevo() {
  document.getElementById('mt-title').textContent = '🔧 Nuevo Mantenimiento';
  document.getElementById('mt-edit-id').value     = '';

  // Limpiar todos los campos
  const campos = ['mt-obs','mt-periodo','mt-user-win','mt-pass-win',
                  'mt-user-admin','mt-pass-admin','mt-dep-anterior',
                  'mt-dep-nueva'];
  campos.forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });

  document.getElementById('mt-tipo').value          = 'Mantenimiento Preventivo';
  document.getElementById('mt-frecuencia').value    = 'Semestral';
  document.getElementById('mt-responsable').value   = 'Emerson Pachón Ayala';
  document.getElementById('mt-estado-equipo').value = 'Operativo';
  document.getElementById('mt-cambio-resp').value   = 'No';
  document.getElementById('mt-cambio-cred').value   = 'No';
  document.getElementById('mt-traslado').value      = 'No';
  document.getElementById('mt-nuevo-resp-wrap').style.display = 'none';
  document.getElementById('mt-traslado-wrap').style.display   = 'none';

  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('mt-fecha').value         = hoy;
  document.getElementById('mt-fecha-proxima').value = calcFechaProxima(hoy, 'Semestral');

  mtFotos = [];
  _renderFotosPreview([], 'mt-fotos-preview');

  llenarSSEquipos('mt-equipo-ss');
  llenarSSPersonas('mt-resp-equipo-ss');
  llenarSSPersonas('mt-nuevo-resp-ss');

  abrirModal('modal-mantto');
}

function editar(id) {
  const m = getData('mantenimientos').find(x => x.id === id);
  if (!m) return;

  document.getElementById('mt-title').textContent = '✏️ Editar Mantenimiento';
  document.getElementById('mt-edit-id').value     = id;

  document.getElementById('mt-tipo').value          = m.tipo          || 'Mantenimiento Preventivo';
  document.getElementById('mt-frecuencia').value    = m.frecuencia    || 'Semestral';
  document.getElementById('mt-obs').value           = m.obs           || '';
  document.getElementById('mt-periodo').value       = m.periodo       || '';
  document.getElementById('mt-responsable').value   = m.responsable   || 'Emerson Pachón Ayala';
  document.getElementById('mt-estado-equipo').value = m.estadoEquipo  || 'Operativo';
  document.getElementById('mt-cambio-resp').value   = m.cambioResp    || 'No';
  document.getElementById('mt-cambio-cred').value   = m.cambioCred    || 'No';
  document.getElementById('mt-traslado').value      = m.traslado      || 'No';
  document.getElementById('mt-dep-anterior').value  = m.depAnterior   || '';
  document.getElementById('mt-dep-nueva').value     = m.depNueva      || '';
  document.getElementById('mt-user-win').value      = m.userWin       || '';
  document.getElementById('mt-pass-win').value      = m.passWin       || '';
  document.getElementById('mt-user-admin').value    = m.userAdmin     || '';
  document.getElementById('mt-pass-admin').value    = m.passAdmin     || '';

  document.getElementById('mt-nuevo-resp-wrap').style.display =
    m.cambioResp === 'Sí' ? 'block' : 'none';
  document.getElementById('mt-traslado-wrap').style.display =
    m.traslado === 'Sí' ? 'block' : 'none';

  const d = parseFecha(m.fecha);
  if (d) document.getElementById('mt-fecha').value = d.toISOString().split('T')[0];
  const dp = parseFecha(m.fechaProxima);
  if (dp) document.getElementById('mt-fecha-proxima').value = dp.toISOString().split('T')[0];
  const dt = parseFecha(m.fechaTraslado);
  if (dt) document.getElementById('mt-fecha-traslado').value = dt.toISOString().split('T')[0];

  mtFotos = [...(m.fotos || [])];
  _renderFotosPreview(mtFotos, 'mt-fotos-preview');

  llenarSSEquipos('mt-equipo-ss');
  llenarSSPersonas('mt-resp-equipo-ss');
  llenarSSPersonas('mt-nuevo-resp-ss');

  const DB = getDBStatic();
  const eq = getData('equipos').find(e => e.serial === m.serial);
  const p  = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
  setSSValue('mt-equipo-ss', m.serial, `${m.serial}${p ? ' — ' + p.nombre : ''}`);

  if (m.respEquipoId) {
    const rp = DB.personas.find(x => x.id === m.respEquipoId);
    if (rp) setSSValue('mt-resp-equipo-ss', rp.id, rp.nombre);
  }

  abrirModal('modal-mantto');
}

async function guardar() {
  const serial      = getSSValue('mt-equipo-ss');
  const tipo        = document.getElementById('mt-tipo').value;
  const frecuencia  = document.getElementById('mt-frecuencia').value;
  const obs         = document.getElementById('mt-obs').value;
  const periodo     = document.getElementById('mt-periodo').value;
  const responsable = document.getElementById('mt-responsable').value;
  const estadoEquipo= document.getElementById('mt-estado-equipo').value;
  const cambioResp  = document.getElementById('mt-cambio-resp').value;
  const cambioCred  = document.getElementById('mt-cambio-cred').value;
  const traslado    = document.getElementById('mt-traslado').value;
  const depAnterior = document.getElementById('mt-dep-anterior').value;
  const depNueva    = document.getElementById('mt-dep-nueva').value;
  const userWin     = document.getElementById('mt-user-win').value;
  const passWin     = document.getElementById('mt-pass-win').value;
  const userAdmin   = document.getElementById('mt-user-admin').value;
  const passAdmin   = document.getElementById('mt-pass-admin').value;
  const fechaRaw    = document.getElementById('mt-fecha').value;
  const proxRaw     = document.getElementById('mt-fecha-proxima').value;
  const traslRaw    = document.getElementById('mt-fecha-traslado')?.value;
  const editId      = document.getElementById('mt-edit-id').value;
  const respEquipoId= getSSValue('mt-resp-equipo-ss');
  const nuevoRespId = getSSValue('mt-nuevo-resp-ss');

  if (!serial) { showToast('⚠️ Selecciona un equipo', '#d97706'); return; }

  const fmt = r => r
    ? new Date(r + 'T00:00:00').toLocaleDateString('es-CO', {day:'2-digit',month:'2-digit',year:'numeric'})
    : '';

  const fecha        = fmt(fechaRaw) || new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
  const fechaProxima = fmt(proxRaw);
  const fechaTraslado= fmt(traslRaw);

  const campos = {
    serial, tipo, frecuencia, obs, periodo, responsable, estadoEquipo,
    cambioResp, cambioCred, traslado, depAnterior, depNueva,
    userWin, passWin, userAdmin, passAdmin,
    fechaProxima, fechaTraslado, respEquipoId, nuevoRespId,
    fotos: mtFotos,
  };

  const lista = [...getData('mantenimientos')];

  if (editId) {
    const idx = lista.findIndex(x => x.id === editId);
    if (idx >= 0) lista[idx] = { ...lista[idx], ...campos, fecha };
    apiPost('Mantenimientos', 'update', {
      Tipo: tipo, Frecuencia: frecuencia, Fecha_Ultima: fecha,
      Fecha_Proxima: fechaProxima, Observaciones: obs, Responsable: responsable,
    }, 'ID', editId).catch(console.warn);
    showToast('✅ Mantenimiento actualizado');
  } else {
    const id = uid();
    lista.push({ id, fecha, firmado: false, firma: null, firmaFecha: null, ...campos });
    apiPost('Mantenimientos', 'insert', {
      ID: id, EquipoID: serial, Tipo: tipo, Frecuencia: frecuencia,
      Fecha_Ultima: fecha, Fecha_Proxima: fechaProxima,
      Firmado: 'No', Responsable: responsable, Observaciones: obs,
      Imagen_Base64: '',
    }).catch(console.warn);
    showToast('🔧 Mantenimiento registrado');
  }

  setState('mantenimientos', lista);
  saveKey('mantenimientos');
  cerrarModal('modal-mantto');
  renderLista();
}

function eliminar(id) {
  if (!confirm('¿Eliminar este mantenimiento?')) return;
  const lista = getData('mantenimientos').filter(m => m.id !== id);
  setState('mantenimientos', lista);
  saveKey('mantenimientos');
  apiPost('Mantenimientos', 'delete', {}, 'ID', id).catch(console.warn);
  showToast('🗑️ Eliminado');
  renderLista();
}

function abrirFirma(id) {
  const m = getData('mantenimientos').find(x => x.id === id);
  if (!m) return;

  // Si ya tiene firma, no pedir de nuevo
  if (m.firmado && m.firma) {
    showToast('✅ Este mantenimiento ya está firmado');
    return;
  }

  _abrirFirma('mant', id, (firmaBase64) => {
    const lista = getData('mantenimientos').map(x => x.id !== id ? x : {
      ...x, firmado: true, firma: firmaBase64,
      firmaFecha: new Date().toISOString(),
    });
    setState('mantenimientos', lista);
    saveKey('mantenimientos');
    apiPost('Mantenimientos', 'update', {
      Firmado: 'Sí', Imagen_Base64: firmaBase64,
    }, 'ID', id).catch(console.warn);
    showToast('✅ Firma registrada');
    renderLista();
  });
}

// ── Fotos ─────────────────────────────────────────────────────
function _procesarFotos(files, arr, previewId) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => { arr.push(e.target.result); _renderFotosPreview(arr, previewId); };
    reader.readAsDataURL(file);
  });
}

function _renderFotosPreview(arr, previewId) {
  const grid = document.getElementById(previewId);
  if (!grid) return;
  grid.innerHTML = arr.map((src, i) => `
    <div class="foto-thumb">
      <img src="${src}" alt="foto ${i+1}">
      <button class="foto-del" data-idx="${i}">✕</button>
    </div>`).join('');
  grid.querySelectorAll('.foto-del').forEach(btn => {
    btn.addEventListener('click', () => {
      arr.splice(+btn.dataset.idx, 1);
      _renderFotosPreview(arr, previewId);
    });
  });
}