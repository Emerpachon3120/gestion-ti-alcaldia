import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }           from '../storage.js';
import { apiPost }           from '../api.js';
import { showToast }         from '../ui/toast.js';
import { abrirModal, cerrarModal, registrarModal } from '../ui/modal.js';
import { uid, formatDate, parseFecha, calcSemaforo, calcFechaProxima } from '../utils.js';
import { buildSearchSelect, getSSValue, setSSValue, llenarSSEquipos, llenarSSPersonas } from '../ui/searchselect.js';

let currentFilter = 'todos';
let currentSearch = '';
let fDesde = '', fHasta = '';
let mtFotos = [];

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
      </div>

      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" id="mant-search" placeholder="Buscar por serial o funcionario...">
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
  window.abrirNuevoMantto  = abrirNuevo;
  window.editarMantto      = editar;
  window.eliminarMantto    = eliminar;
}

export function onLeave() {
  // cleanup si es necesario
}

// ── Render lista ─────────────────────────────────────────────
export function renderLista() {
  const DB = getDBStatic();
  let data = getData('mantenimientos').slice().reverse();

  if (currentFilter === 'pendiente')  data = data.filter(m => !m.firmado);
  if (currentFilter === 'firmado')    data = data.filter(m => m.firmado);
  if (currentFilter === 'preventivo') data = data.filter(m => m.tipo?.toLowerCase().includes('preventivo'));
  if (currentFilter === 'correctivo') data = data.filter(m => m.tipo?.toLowerCase().includes('correctivo'));

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    data = data.filter(m => {
      const eq = getData('equipos').find(e => e.serial === m.serial);
      const p  = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
      return m.serial.toLowerCase().includes(q) || (p?.nombre || '').toLowerCase().includes(q);
    });
  }
  if (fDesde) data = data.filter(m => { const d = parseFecha(m.fecha); return d && d >= new Date(fDesde); });
  if (fHasta) data = data.filter(m => { const d = parseFecha(m.fecha); return d && d <= new Date(fHasta); });

  const container = document.getElementById('mant-list');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <p>Sin mantenimientos</p>
    </div>`;
    return;
  }

  container.innerHTML = data.map(m => _cardHTML(m)).join('');
  // Bind botones de acción de cada card
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      const { action, id } = btn.dataset;
      if (action === 'editar')   editar(id);
      if (action === 'eliminar') eliminar(id);
      if (action === 'firmar')   abrirFirma(id);
      if (action === 'verdoc')   verDocumento(id);
    });
  });
}

function _cardHTML(m) {
  const DB  = getDBStatic();
  const eq  = getData('equipos').find(e => e.serial === m.serial);
  const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
  const of  = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
  const sem = calcSemaforo(m.fechaProxima);

  return `
    <div class="mant-card">
      <div class="mant-header">
        <div>
          <div class="mant-serial">${m.serial}</div>
          <div class="mant-person">${p?.nombre || 'Sin asignar'}</div>
          <div style="font-size:11px;color:var(--text3)">${of?.nombre || ''}</div>
        </div>
        <div style="text-align:right;">
          <span class="badge ${m.tipo?.includes('Correctivo') ? 'badge-red' : 'badge-blue'}">${m.tipo || 'Preventivo'}</span>
          ${sem ? `<div class="semaforo ${sem.clase}" style="margin-top:4px">${sem.icon} ${sem.label}</div>` : ''}
        </div>
      </div>
      ${m.obs ? `<div class="mant-obs">${m.obs}</div>` : ''}
      <div class="mant-meta">
        <span class="tag">📅 ${formatDate(m.fecha)}</span>
        ${m.fechaProxima ? `<span class="tag">⏭️ ${formatDate(m.fechaProxima)}</span>` : ''}
        ${m.frecuencia ? `<span class="tag">🔁 ${m.frecuencia}</span>` : ''}
      </div>
      ${m.firmado
        ? `<div style="display:flex;gap:6px;margin-top:10px;">
            <button class="sign-btn signed" disabled style="flex:2;margin-top:0;">✅ Firmado</button>
            <button class="doc-viewer-btn" data-action="verdoc" data-id="${m.id}" style="flex:1;margin-top:0;">📄 Ver</button>
           </div>`
        : `<button class="sign-btn" data-action="firmar" data-id="${m.id}">✍️ Solicitar firma</button>`
      }
      <div class="card-actions">
        <button class="action-btn" data-action="editar" data-id="${m.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
        <button class="action-btn del" data-action="eliminar" data-id="${m.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Eliminar
        </button>
      </div>
    </div>`;
}

// ── Modal HTML ────────────────────────────────────────────────
function _modalHTML() {
  return `
    <div class="modal-overlay" id="modal-mantto">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="mt-title">🔧 Nuevo Mantenimiento</div>
        <input type="hidden" id="mt-edit-id">

        <div class="form-group"><label class="form-label">Equipo *</label><div id="mt-equipo-ss"></div></div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Tipo *</label>
            <select class="form-select" id="mt-tipo">
              <option>Mantenimiento Preventivo</option>
              <option>Mantenimiento Correctivo</option>
              <option>Mantenimiento Predictivo</option>
              <option>Mantenimiento de Emergencia</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Frecuencia</label>
            <select class="form-select" id="mt-frecuencia">
              <option>Mensual</option><option selected>Semestral</option>
              <option>Trimestral</option><option>Anual</option><option>Ocasional</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Fecha ejecución</label>
            <input type="date" class="form-input" id="mt-fecha">
          </div>
          <div class="form-group">
            <label class="form-label">Próximo (auto)</label>
            <input type="date" class="form-input" id="mt-fecha-proxima" style="background:var(--bg2)">
          </div>
        </div>

        <div class="form-group"><label class="form-label">Responsable TI</label>
          <input type="text" class="form-input" id="mt-responsable" value="Emerson Pachon">
        </div>

        <div class="form-group"><label class="form-label">Estado equipo post-mantenimiento</label>
          <select class="form-select" id="mt-estado-equipo">
            <option>Operativo</option><option>Con fallas menores</option>
            <option>Requiere repuesto</option><option>Dado de baja</option>
          </select>
        </div>

        <div class="form-group"><label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="mt-obs" placeholder="Actividades realizadas..."></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">📸 Evidencia fotográfica</label>
          <div class="foto-upload-area" id="mt-foto-area">
            <label class="foto-upload-label" for="mt-foto-input">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Tomar foto o elegir de galería
            </label>
            <input type="file" id="mt-foto-input" accept="image/*" multiple>
          </div>
          <div class="foto-grid" id="mt-fotos-preview"></div>
        </div>

        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" style="flex:1" id="mt-cancel-btn">Cancelar</button>
          <button class="btn btn-primary" style="flex:2" id="mt-save-btn">✅ Registrar</button>
        </div>
      </div>
    </div>`;
}

// ── Bind eventos ──────────────────────────────────────────────
function _bindEvents() {
  // Filtros tabs
  document.querySelectorAll('#page-mantenimientos .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-mantenimientos .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderLista();
    });
  });

  // Búsqueda
  document.getElementById('mant-search')?.addEventListener('input', e => {
    currentSearch = e.target.value;
    renderLista();
  });

  // Fechas
  document.getElementById('mant-desde')?.addEventListener('change', e => { fDesde = e.target.value; renderLista(); });
  document.getElementById('mant-hasta')?.addEventListener('change', e => { fHasta = e.target.value; renderLista(); });

  // Modal botones
  document.getElementById('mt-cancel-btn')?.addEventListener('click', () => cerrarModal('modal-mantto'));
  document.getElementById('mt-save-btn')?.addEventListener('click', guardar);

  // Fecha → calcular próxima
  document.getElementById('mt-fecha')?.addEventListener('change', e => {
    const frec = document.getElementById('mt-frecuencia').value;
    const prox = calcFechaProxima(e.target.value, frec);
    document.getElementById('mt-fecha-proxima').value = prox;
  });

  // Fotos
  document.getElementById('mt-foto-input')?.addEventListener('change', e => {
    _procesarFotos(e.target.files, mtFotos, 'mt-fotos-preview');
  });
}

// ── CRUD ──────────────────────────────────────────────────────
function abrirNuevo() {
  document.getElementById('mt-title').textContent = '🔧 Nuevo Mantenimiento';
  document.getElementById('mt-edit-id').value = '';
  document.getElementById('mt-tipo').value = 'Mantenimiento Preventivo';
  document.getElementById('mt-frecuencia').value = 'Semestral';
  document.getElementById('mt-obs').value = '';
  document.getElementById('mt-responsable').value = 'Emerson Pachon';
  document.getElementById('mt-estado-equipo').value = 'Operativo';
  document.getElementById('mt-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('mt-fecha-proxima').value = calcFechaProxima(new Date().toISOString().split('T')[0], 'Semestral');
  mtFotos = [];
  document.getElementById('mt-fotos-preview').innerHTML = '';
  llenarSSEquipos('mt-equipo-ss');
  abrirModal('modal-mantto');
}

function editar(id) {
  const m = getData('mantenimientos').find(x => x.id === id);
  if (!m) return;
  document.getElementById('mt-title').textContent = '✏️ Editar Mantenimiento';
  document.getElementById('mt-edit-id').value = id;
  document.getElementById('mt-tipo').value = m.tipo || 'Mantenimiento Preventivo';
  document.getElementById('mt-frecuencia').value = m.frecuencia || 'Semestral';
  document.getElementById('mt-obs').value = m.obs || '';
  document.getElementById('mt-responsable').value = m.responsable || 'Emerson Pachon';
  document.getElementById('mt-estado-equipo').value = m.estadoEquipo || 'Operativo';

  const d = parseFecha(m.fecha);
  if (d) document.getElementById('mt-fecha').value = d.toISOString().split('T')[0];
  const dp = parseFecha(m.fechaProxima);
  if (dp) document.getElementById('mt-fecha-proxima').value = dp.toISOString().split('T')[0];

  mtFotos = [...(m.fotos || [])];
  _renderFotosPreview(mtFotos, 'mt-fotos-preview');

  llenarSSEquipos('mt-equipo-ss');
  const eq = getData('equipos').find(e => e.serial === m.serial);
  const DB = getDBStatic();
  const p  = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
  setSSValue('mt-equipo-ss', m.serial, `${m.serial}${p ? ' — ' + p.nombre : ''}`);

  abrirModal('modal-mantto');
}

async function guardar() {
  const serial    = getSSValue('mt-equipo-ss');
  const tipo      = document.getElementById('mt-tipo').value;
  const frecuencia= document.getElementById('mt-frecuencia').value;
  const obs       = document.getElementById('mt-obs').value;
  const responsable = document.getElementById('mt-responsable').value;
  const estadoEquipo = document.getElementById('mt-estado-equipo').value;
  const fechaRaw  = document.getElementById('mt-fecha').value;
  const proxRaw   = document.getElementById('mt-fecha-proxima').value;
  const editId    = document.getElementById('mt-edit-id').value;

  if (!serial) { showToast('⚠️ Selecciona un equipo', '#d97706'); return; }

  const fmt = raw => raw ? new Date(raw + 'T00:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' }) : '';
  const fecha = fmt(fechaRaw) || new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
  const fechaProxima = fmt(proxRaw);

  const lista = [...getData('mantenimientos')];

  if (editId) {
    const idx = lista.findIndex(x => x.id === editId);
    if (idx >= 0) lista[idx] = { ...lista[idx], serial, tipo, frecuencia, obs, responsable, estadoEquipo, fecha, fechaProxima, fotos: mtFotos };
    apiPost('Mantenimientos', 'update', { Tipo: tipo, Frecuencia: frecuencia, Fecha_Ultima: fecha, Fecha_Proxima: fechaProxima, Observaciones: obs, Responsable: responsable }, 'ID', editId).catch(console.warn);
    showToast('✅ Mantenimiento actualizado');
  } else {
    const id = uid();
    lista.push({ id, serial, tipo, frecuencia, obs, responsable, estadoEquipo, fecha, fechaProxima, firmado: false, firma: null, fotos: mtFotos });
    apiPost('Mantenimientos', 'insert', { ID: id, EquipoID: serial, Tipo: tipo, Frecuencia: frecuencia, Fecha_Ultima: fecha, Fecha_Proxima: fechaProxima, Firmado: 'No', Responsable: responsable, Observaciones: obs, Imagen_Base64: '' }).catch(console.warn);
    showToast('🔧 Mantenimiento registrado');
  }

  setState('mantenimientos', lista);
  saveKey('mantenimientos');
  cerrarModal('modal-mantto');
  renderLista();
}

function eliminar(id) {
  import('../ui/toast.js').then(({ showConfirm }) => {
    showConfirm({
      icon: '🗑️', title: 'Eliminar mantenimiento',
      msg: '¿Estás seguro? Esta acción no se puede deshacer.',
      okLabel: 'Eliminar',
      onOk: () => {
        const lista = getData('mantenimientos').filter(m => m.id !== id);
        setState('mantenimientos', lista);
        saveKey('mantenimientos');
        apiPost('Mantenimientos', 'delete', {}, 'ID', id).catch(console.warn);
        showToast('🗑️ Eliminado');
        renderLista();
      },
    });
  });
}

function abrirFirma(id) {
  showToast('✍️ Función de firma — integra tu canvas de firma aquí');
}

function verDocumento(id) {
  showToast('📄 Función ver documento');
}

// ── Fotos helpers ─────────────────────────────────────────────
function _procesarFotos(files, arr, previewId) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      arr.push(e.target.result);
      _renderFotosPreview(arr, previewId);
    };
    reader.readAsDataURL(file);
  });
}

function _renderFotosPreview(arr, previewId) {
  const grid = document.getElementById(previewId);
  if (!grid) return;
  grid.innerHTML = arr.map((src, i) => `
    <div class="foto-thumb">
      <img src="${src}" alt="foto ${i + 1}">
      <button class="foto-del" data-idx="${i}">✕</button>
    </div>`).join('');
  grid.querySelectorAll('.foto-del').forEach(btn => {
    btn.addEventListener('click', () => {
      arr.splice(+btn.dataset.idx, 1);
      _renderFotosPreview(arr, previewId);
    });
  });
}