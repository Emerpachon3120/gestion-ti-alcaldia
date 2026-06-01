import { uid, formatDate, parseFecha, calcSemaforo, calcFechaProxima, soloLetras, alfaNumerico } from '../utils.js';
import { abrirFirma as _abrirFirma }     from '../ui/firma.js';
import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }                        from '../storage.js';
import { apiPost }                        from '../api.js';
import { showToast }                      from '../ui/toast.js';
import { abrirModal, cerrarModal }        from '../ui/modal.js';
import { verActaMantenimiento }           from '../ui/documento.js';
import { buildSearchSelect, getSSValue, setSSValue, llenarSSEquipos, llenarSSPersonas } from '../ui/searchselect.js';
import { navigate } from '../router.js';
import { abrirNuevo as abrirNuevoEquipo } from './inventario.js';

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

// Al inicio del archivo agrega esta función
function _modalEquipoRapido() {
  if (document.getElementById('modal-equipo-rapido')) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="modal-overlay" id="modal-equipo-rapido">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">💻 Registrar equipo rápido</div>
        <div class="form-group">
          <label class="form-label">Serial *</label>
          <input type="text" class="form-input" id="eq-r-serial"
            placeholder="Ej: YJ01RNPG" style="font-family:var(--font-mono)">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">Marca</label>
            <input type="text" class="form-input" id="eq-r-marca" placeholder="HP, Lenovo...">
          </div>
          <div class="form-group">
            <label class="form-label">Modelo</label>
            <input type="text" class="form-input" id="eq-r-modelo" placeholder="ProBook 450">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Sistema Operativo</label>
          <input type="text" class="form-input" id="eq-r-so" placeholder="Windows 11 Pro">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label class="form-label">RAM</label>
            <input type="text" class="form-input" id="eq-r-ram" placeholder="8 GB">
          </div>
          <div class="form-group">
            <label class="form-label">Disco</label>
            <select class="form-select" id="eq-r-disco">
              <option>SSD</option><option>HDD</option><option>NVMe</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Oficina *</label>
          <div id="eq-r-oficina-ss"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;"
            onclick="document.getElementById('modal-equipo-rapido').classList.remove('open')">
            Cancelar
          </button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;"
            id="eq-r-save-btn">💻 Guardar equipo</button>
        </div>
      </div>
    </div>`;
  document.getElementById('modals-container').appendChild(div.firstElementChild);

  document.getElementById('eq-r-save-btn').addEventListener('click', () => {
    const serial  = document.getElementById('eq-r-serial').value.trim().toUpperCase();
    const marca   = document.getElementById('eq-r-marca').value;
    const modelo  = document.getElementById('eq-r-modelo').value;
    const so      = document.getElementById('eq-r-so').value;
    const ram     = document.getElementById('eq-r-ram').value;
    const disco   = document.getElementById('eq-r-disco').value;
    const oficina = getSSValue('eq-r-oficina-ss');
    if (!serial || !oficina) { showToast('⚠️ Serial y oficina son obligatorios','#d97706'); return; }

    const lista = [...getData('equipos')];
    if (lista.find(e => e.serial === serial)) {
      showToast('⚠️ Ya existe ese serial','#d97706'); return;
    }
    lista.push({ serial, marca, modelo, so, ram, disco, oficina,
                 usuarioId:'', estado:'Operativo', fotos:[] });
    setState('equipos', lista);
    saveKey('equipos');
    apiPost('Equipos','insert',{
      Serial:serial, OficinaID:oficina, SO:so, RAM:ram,
      Disco:disco, Marca:marca, Modelo:modelo, Estado:'Operativo',
    }).catch(console.warn);

    // Seleccionar el nuevo equipo en el formulario
    llenarSSEquipos('mt-equipo-ss', null, _crearEquipoRapido);
    setSSValue('mt-equipo-ss', serial, `${serial} — ${marca} ${modelo}`);
    document.getElementById('modal-equipo-rapido').classList.remove('open');
    showToast(`💻 Equipo ${serial} registrado`);
  });
}

function _crearEquipoRapido() {
  // Guardar referencia al modal actual para volver
  const modalMantto = document.getElementById('modal-mantto');
  
  // Cerrar modal de mantenimiento temporalmente
  modalMantto?.classList.remove('open');
  
  // Abrir formulario completo de equipo
  abrirNuevoEquipo();
  
  // Cuando se guarde el equipo, volver al mantenimiento
  const observer = new MutationObserver(() => {
    const modalEq = document.getElementById('modal-equipo');
    if (modalEq && !modalEq.classList.contains('open')) {
      observer.disconnect();
      // Reabrir modal de mantenimiento
      setTimeout(() => {
        modalMantto?.classList.add('open');
        // Recargar lista de equipos en el SearchSelect
        llenarSSEquipos('mt-equipo-ss', () => {}, _crearEquipoRapido);
      }, 200);
    }
  });
  
  const modalEq = document.getElementById('modal-equipo');
  if (modalEq) {
    observer.observe(modalEq, { attributes: true, attributeFilter: ['class'] });
  }
}

function _modalFuncionarioRapido() {
  if (document.getElementById('modal-func-rapido')) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="modal-overlay" id="modal-func-rapido">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title">👤 Registrar funcionario</div>
        <div class="form-group">
          <label class="form-label">Nombre completo *</label>
          <input type="text" class="form-input" id="func-r-nombre"
            placeholder="Nombre del funcionario">
        </div>
        <div class="form-group">
          <label class="form-label">Cargo</label>
          <input type="text" class="form-input" id="func-r-cargo"
            placeholder="Ej: Técnico Administrativo">
        </div>
        <div class="form-group">
          <label class="form-label">Correo institucional</label>
          <input type="email" class="form-input" id="func-r-correo"
            placeholder="correo@nemocon.gov.co">
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;"
            onclick="document.getElementById('modal-func-rapido').classList.remove('open')">
            Cancelar
          </button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;"
            id="func-r-save-btn">👤 Guardar funcionario</button>
        </div>
      </div>
    </div>`;
  document.getElementById('modals-container').appendChild(div.firstElementChild);

  document.getElementById('func-r-save-btn').addEventListener('click', () => {
    const nombre = document.getElementById('func-r-nombre').value.trim();
    const cargo  = document.getElementById('func-r-cargo').value;
    const correo = document.getElementById('func-r-correo').value;
    if (!nombre) { showToast('⚠️ El nombre es obligatorio','#d97706'); return; }

    const DB  = getDBStatic();
    const id  = 'P' + Date.now();
    DB.personas.push({ id, nombre, cargo, correo, imagen:'' });
    apiPost('Personas','insert',{
      ID:id, Nombre:nombre, Cargo:cargo, Correo:correo,
    }).catch(console.warn);

    // Seleccionar el nuevo funcionario
    llenarSSPersonas('mt-resp-equipo-ss', null, _crearFuncionarioRapido);
    setSSValue('mt-resp-equipo-ss', id, nombre);
    document.getElementById('modal-func-rapido').classList.remove('open');
    showToast(`👤 ${nombre} registrado`);
  });
}

function _crearFuncionarioRapido() {
  _modalFuncionarioRapido();
  document.getElementById('modal-func-rapido').classList.add('open');
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
    <div class="mant-card" data-serial="${m.serial}">
  <div class="mant-header">
    <div style="flex:1;min-width:0;">
      <div class="mant-serial">${m.serial}</div>
      <div class="mant-person">${p?.nombre || 'Sin asignar'}</div>
      <div style="font-size:11px;color:var(--text3);
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${dep?.nombre || of?.nombre || ''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
      <span class="badge ${tipoBadge}" style="white-space:nowrap;">
        ${m.tipo?.replace('Mantenimiento ','') || 'Preventivo'}
      </span>
      ${sem ? `<div class="semaforo ${sem.clase}">${sem.icon} ${sem.label}</div>` : ''}
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
        <input type="text" class="form-input" id="mt-responsable" value="Emerson Judiño Pachón Ayala">
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
  <label class="form-label">¿Se realizó el mantenimiento?</label>
  <select class="form-select" id="mt-realizado">
    <option value="Si">Sí</option>
    <option value="No realizado">No realizado</option>
    <option value="Parcial">Parcial</option>
  </select>
</div>

<!-- MOTIVO DE NO REALIZACIÓN -->
  <div id="mt-motivo-wrap" style="display:none;">
    <label class="form-label">Motivo de no realización</label>
    <div id="mt-motivo-lista" style="
      background:var(--bg2);border:1px solid var(--border);
      border-radius:var(--radius-sm);padding:10px;
      display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
        <input type="checkbox" value="Equipo dañado o en mal estado" style="width:14px;height:14px;">
        Equipo dañado o en mal estado
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
        <input type="checkbox" value="Funcionario ausente" style="width:14px;height:14px;">
        Funcionario ausente
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
        <input type="checkbox" value="Equipo dado de baja" style="width:14px;height:14px;">
        Equipo dado de baja
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
        <input type="checkbox" value="Acceso denegado al equipo" style="width:14px;height:14px;">
        Acceso denegado al equipo
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
        <input type="checkbox" value="Equipo en uso durante la jornada" style="width:14px;height:14px;">
        Equipo en uso durante la jornada
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
        <input type="checkbox" value="Sin herramientas disponibles" style="width:14px;height:14px;">
        Sin herramientas disponibles
      </label>
    </div>
  </div>
      <div class="form-group">
        <label class="form-label">Actividades realizadas</label>
        <div id="mt-actividades-lista" style="
          background:var(--bg2);border:1px solid var(--border);
          border-radius:var(--radius-sm);padding:10px;
          display:grid;grid-template-columns:1fr 1fr;gap:6px;
          margin-bottom:8px;">
          <div style="font-size:12px;color:var(--text3);grid-column:1/-1;">
            Selecciona el tipo de mantenimiento para ver las actividades
          </div>
        </div>
        <label class="form-label" style="margin-top:8px;">Observaciones adicionales</label>
        <textarea class="form-textarea" id="mt-obs"
          placeholder="Observaciones adicionales..."></textarea>
      </div>

      <!-- Fotos -->
      <div class="form-group">
        <label class="form-label">📸 Evidencia fotográfica</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <button type="button" style="
            padding:12px 8px;border:2px dashed var(--accent);
            border-radius:var(--radius-sm);background:var(--accent-bg);
            color:var(--accent);font-family:var(--font-main);
            font-size:13px;font-weight:600;cursor:pointer;"
            onclick="document.getElementById('mt-foto-camara').click()">
            📷 Tomar foto
          </button>
          <button type="button" style="
            padding:12px 8px;border:2px dashed var(--border);
            border-radius:var(--radius-sm);background:var(--bg2);
            color:var(--text2);font-family:var(--font-main);
            font-size:13px;font-weight:600;cursor:pointer;"
            onclick="document.getElementById('mt-foto-galeria').click()">
            🖼️ Desde galería
          </button>
        </div>
        <input type="file" id="mt-foto-camara" accept="image/*" capture="environment">
        <input type="file" id="mt-foto-galeria" accept="image/*" multiple>
        <div class="foto-grid" id="mt-fotos-preview"></div>
      </div>

      <div class="modal-footer">
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;" id="mt-cancel-btn">Cancelar</button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;" onclick="window._guardarMantto()">✅ Registrar</button>
        </div>
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
  document.getElementById('mt-foto-camara')?.addEventListener('change', e => {
    _procesarFotos(e.target.files, mtFotos, 'mt-fotos-preview');
    e.target.value = '';
  });
  document.getElementById('mt-foto-galeria')?.addEventListener('change', e => {
    _procesarFotos(e.target.files, mtFotos, 'mt-fotos-preview');
    e.target.value = '';
  });

    // Validaciones de campos
  ['mt-responsable','mt-dep-anterior','mt-dep-nueva'].forEach(id => {
    const el = document.getElementById(id);
    if (el) soloLetras(el);
  });
  // Solo periodo usa alfanumérico
  const periodoEl = document.getElementById('mt-periodo');
  if (periodoEl) alfaNumerico(periodoEl);

  // Contraseñas permiten todo — sin validación restrictiva
  // Usuarios solo alfanumérico
  ['mt-user-win','mt-user-admin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) alfaNumerico(el);
  });

  document.getElementById('mt-tipo')?.addEventListener('change', () => {
    window._actualizarActividades();
  });

  document.getElementById('mt-realizado')?.addEventListener('change', () => {
  const val = document.getElementById('mt-realizado').value;
  const motivoWrap = document.getElementById('mt-motivo-wrap');
  if (motivoWrap) {
    motivoWrap.style.display = val === 'Si' ? 'none' : 'block';
  }
});

}

function abrirNuevo() {
  const DB = getDBStatic();

  if (!DB.personas?.length) {
    showToast('⏳ Cargando datos...', '#d97706');
    window.syncData?.().then(() => abrirNuevo());
    return;
  }

  document.getElementById('mt-title').textContent = '🔧 Nuevo Mantenimiento';
  document.getElementById('mt-edit-id').value     = '';

  const campos = ['mt-obs','mt-periodo','mt-user-win','mt-pass-win',
                  'mt-user-admin','mt-pass-admin','mt-dep-anterior','mt-dep-nueva'];
  campos.forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });

  document.getElementById('mt-tipo').value          = 'Mantenimiento Preventivo';
  document.getElementById('mt-frecuencia').value    = 'Semestral';
  document.getElementById('mt-responsable').value   = 'Emerson Judiño Pachón Ayala';
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

  llenarSSEquipos('mt-equipo-ss', (serial) => {
  const DB = getDBStatic();
  const eq = getData('equipos').find(e => e.serial === serial);
  if (!eq) return;

  const p   = DB.personas.find(x => x.id === eq.usuarioId);
  if (p) setSSValue('mt-resp-equipo-ss', p.id, p.nombre);

  const of  = DB.oficinas.find(x => x.id === eq.oficina);
  const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;

  const mantsEq = getData('mantenimientos')
    .filter(m => m.serial === serial)
    .sort((a,b) => (parseFecha(b.fecha)||0) - (parseFecha(a.fecha)||0));

  let infoBox = document.getElementById('mt-equipo-info');
  if (!infoBox) {
    infoBox = document.createElement('div');
    infoBox.id = 'mt-equipo-info';
    document.getElementById('mt-equipo-ss').insertAdjacentElement('afterend', infoBox);
  }
  infoBox.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);
      border-radius:var(--radius-sm);padding:8px 12px;
      font-size:11px;color:var(--text2);margin-top:6px;">
      🏢 <b>${dep?.nombre || '—'}</b> · ${of?.nombre || '—'}<br>
      💻 ${eq.so || '—'} · RAM: ${eq.ram || '—'} · ${eq.disco || ''} ${eq.cap || ''}
      ${eq.marca ? `<br>🏷️ ${eq.marca} ${eq.modelo || ''}` : ''}
      ${mantsEq.length ? `<br>🔧 Último mant: ${formatDate(mantsEq[0].fecha)} — ${mantsEq[0].tipo} ${mantsEq[0].firmado ? '✅' : '⏳'}` : ''}
    </div>`;
}, _crearEquipoRapido);
  llenarSSPersonas('mt-resp-equipo-ss', ()=>{}, _crearFuncionarioRapido);
  llenarSSPersonas('mt-nuevo-resp-ss', ()=>{}, _crearFuncionarioRapido);

  setTimeout(() => window._actualizarActividades(), 100);
  // Reset checkboxes después de que se rendericen
  setTimeout(() => {
    document.querySelectorAll('#mt-actividades-lista input[type="checkbox"]')
      .forEach(cb => cb.checked = false);
  }, 150);

  // Reset realizado y motivos
document.getElementById('mt-realizado').value = 'Si';
document.getElementById('mt-motivo-wrap').style.display = 'none';
document.querySelectorAll('#mt-motivo-lista input[type="checkbox"]')
  .forEach(cb => cb.checked = false);

  abrirModal('modal-mantto');
}

function editar(id) {
  const m = getData('mantenimientos').find(x => x.id === id);
  if (!m) return;

  document.getElementById('mt-title').textContent = '✏️ Editar Mantenimiento';
  document.getElementById('mt-edit-id').value     = id;

  document.getElementById('mt-tipo').value          = m.tipo          || 'Mantenimiento Preventivo';
  document.getElementById('mt-frecuencia').value    = m.frecuencia    || 'Semestral';
  document.getElementById('mt-periodo').value       = m.periodo       || '';
  document.getElementById('mt-responsable').value   = m.responsable   || 'Emerson Judiño Pachón Ayala';
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

  const d  = parseFecha(m.fecha);
  const dp = parseFecha(m.fechaProxima);
  const dt = parseFecha(m.fechaTraslado);
  if (d)  document.getElementById('mt-fecha').value          = d.toISOString().split('T')[0];
  if (dp) document.getElementById('mt-fecha-proxima').value  = dp.toISOString().split('T')[0];
  if (dt) document.getElementById('mt-fecha-traslado').value = dt.toISOString().split('T')[0];

  // Separar observaciones de actividades
  let obsSolo = m.obs || '';
  if (obsSolo.includes('Observaciones adicionales:\n')) {
    obsSolo = obsSolo.split('Observaciones adicionales:\n')[1] || '';
  } else if (obsSolo.startsWith('Actividades realizadas:\n')) {
    obsSolo = '';
  }
  document.getElementById('mt-obs').value = obsSolo;

  mtFotos = [...(m.fotos || [])];
  _renderFotosPreview(mtFotos, 'mt-fotos-preview');

  llenarSSEquipos('mt-equipo-ss', ()=>{}, _crearEquipoRapido);
  llenarSSPersonas('mt-resp-equipo-ss', ()=>{}, _crearFuncionarioRapido);
  llenarSSPersonas('mt-nuevo-resp-ss', ()=>{}, _crearFuncionarioRapido);

  const DB = getDBStatic();
  const eq = getData('equipos').find(e => e.serial === m.serial);
  const p  = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
  setSSValue('mt-equipo-ss', m.serial, `${m.serial}${p ? ' — '+p.nombre : ''}`);

  // Responsable del equipo con fallback al usuario del equipo
  const respId = m.respEquipoId || eq?.usuarioId;
  if (respId) {
    const rp = DB.personas.find(x => x.id === respId);
    if (rp) setSSValue('mt-resp-equipo-ss', rp.id, rp.nombre);
  }

  if (m.nuevoRespId) {
    const nr = DB.personas.find(x => x.id === m.nuevoRespId);
    if (nr) setSSValue('mt-nuevo-resp-ss', nr.id, nr.nombre);
  }

  // Actividades — marcar checkboxes según obs guardado
  setTimeout(() => {
    window._actualizarActividades();
    if (m.obs) {
      const lineas = m.obs.split('\n').map(l => l.replace('• ','').trim());
      document.querySelectorAll('#mt-actividades-lista input[type="checkbox"]')
        .forEach(cb => { cb.checked = lineas.includes(cb.value); });
    }
  }, 150);

// Realizado y motivos
const realizado = m.obs?.startsWith('Motivo de no realización:') ? 'No realizado' : 'Si';
document.getElementById('mt-realizado').value = realizado;
const motivoWrap = document.getElementById('mt-motivo-wrap');
if (motivoWrap) motivoWrap.style.display = realizado !== 'Si' ? 'block' : 'none';

if (m.obs?.includes('Motivo de no realización:')) {
  setTimeout(() => {
    const lineas = m.obs.split('\n').map(l => l.replace('• ','').trim());
    document.querySelectorAll('#mt-motivo-lista input[type="checkbox"]')
      .forEach(cb => { cb.checked = lineas.includes(cb.value); });
  }, 150);
}

  abrirModal('modal-mantto');
}

async function guardar() {
  const serial = getSSValue('mt-equipo-ss');
  if (!serial) { showToast('⚠️ Selecciona un equipo', '#d97706'); return; }
  _ejecutarGuardar(null);
}

function _pedirFirmaYGuardar() {
  // Guardar actividades ANTES de abrir firma
  window._actividadesTemp = Array.from(
    document.querySelectorAll('#mt-actividades-lista input[type="checkbox"]:checked')
  ).map(cb => cb.value);
  window._obsTemp = document.getElementById('mt-obs')?.value || '';

  _abrirFirma('mant', 'nuevo', (firmaBase64) => {
    _ejecutarGuardar(firmaBase64);
  });
}

async function _ejecutarGuardar(firmaBase64 = null) {
  const serial       = getSSValue('mt-equipo-ss');
  const tipo         = document.getElementById('mt-tipo').value;
  const frecuencia   = document.getElementById('mt-frecuencia').value;
  const periodo      = document.getElementById('mt-periodo').value;
  const responsable  = document.getElementById('mt-responsable').value;
  const estadoEquipo = document.getElementById('mt-estado-equipo').value;
  const cambioResp   = document.getElementById('mt-cambio-resp').value;
  const cambioCred   = document.getElementById('mt-cambio-cred').value;
  const traslado     = document.getElementById('mt-traslado').value;
  const depAnterior  = document.getElementById('mt-dep-anterior').value;
  const depNueva     = document.getElementById('mt-dep-nueva').value;
  const userWin      = document.getElementById('mt-user-win').value;
  const passWin      = document.getElementById('mt-pass-win').value;
  const userAdmin    = document.getElementById('mt-user-admin').value;
  const passAdmin    = document.getElementById('mt-pass-admin').value;
  const fechaRaw     = document.getElementById('mt-fecha').value;
  const proxRaw      = document.getElementById('mt-fecha-proxima').value;
  const traslRaw     = document.getElementById('mt-fecha-traslado')?.value;
  const editId       = document.getElementById('mt-edit-id').value;
  const respEquipoId = getSSValue('mt-resp-equipo-ss');
  const nuevoRespId  = getSSValue('mt-nuevo-resp-ss');

  const fmt = r => r
    ? new Date(r+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'})
    : '';

  const fecha         = fmt(fechaRaw) || new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
  const fechaProxima  = fmt(proxRaw);
  const fechaTraslado = fmt(traslRaw);

  // Actividades — usar temporales si vienen de firma
  const actividadesMarcadas = window._actividadesTemp || Array.from(
    document.querySelectorAll('#mt-actividades-lista input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  const obs = window._obsTemp !== undefined && window._obsTemp !== null
    ? window._obsTemp
    : (document.getElementById('mt-obs')?.value || '');

  // Limpiar temporales
  window._actividadesTemp = null;
  window._obsTemp = null;

  // Recoger motivos si no se realizó
  const realizado = document.getElementById('mt-realizado')?.value || 'Si';
  const motivosMarcados = realizado !== 'Si'
    ? Array.from(document.querySelectorAll('#mt-motivo-lista input[type="checkbox"]:checked'))
        .map(cb => cb.value)
    : [];

  const obsCompleto = motivosMarcados.length
    ? 'Motivo de no realización:\n' + motivosMarcados.map(a => `• ${a}`).join('\n')
      + (obs ? '\n\nObservaciones adicionales:\n' + obs : '')
    : actividadesMarcadas.length
      ? 'Actividades realizadas:\n' + actividadesMarcadas.map(a => `• ${a}`).join('\n')
        + (obs ? '\n\nObservaciones adicionales:\n' + obs : '')
      : obs;

  // Preservar firma existente si es edición
  const mantActual = editId ? getData('mantenimientos').find(x => x.id === editId) : null;

  const campos = {
    serial, tipo, frecuencia, obs: obsCompleto, periodo, responsable, estadoEquipo,
    cambioResp, cambioCred, traslado, depAnterior, depNueva,
    userWin, passWin, userAdmin, passAdmin,
    fechaProxima, fechaTraslado, respEquipoId, nuevoRespId,
    fotos: mtFotos,
    firmado:    firmaBase64 ? true : (mantActual?.firmado || false),
    firma:      firmaBase64 || mantActual?.firma || null,
    firmaFecha: firmaBase64 ? new Date().toISOString() : (mantActual?.firmaFecha || null),
  };

  const lista = [...getData('mantenimientos')];

  if (editId) {
    const idx = lista.findIndex(x => x.id === editId);
    if (idx >= 0) lista[idx] = { ...lista[idx], ...campos, fecha };
    apiPost('Mantenimientos', 'update', {
      Tipo: tipo, Frecuencia: frecuencia, Fecha_Ultima: fecha,
      Fecha_Proxima: fechaProxima, Observaciones: obsCompleto, Responsable: responsable,
      Periodo: periodo, Resp_Equipo_ID: respEquipoId, Cambio_Resp: cambioResp,
      Nuevo_Resp_ID: nuevoRespId, User_Win: userWin, Pass_Win: passWin,
      User_Admin: userAdmin, Pass_Admin: passAdmin, Cambio_Cred: cambioCred,
      Traslado: traslado, Dep_Anterior: depAnterior, Dep_Nueva: depNueva,
      Fecha_Traslado: fechaTraslado, Estado_Equipo: estadoEquipo,
      Fotos_Base64: mtFotos.length > 0 ? `${mtFotos.length} foto(s)` : '',
      Firmado: (firmaBase64 || mantActual?.firmado) ? 'Sí' : 'No',
      Imagen_Base64: (firmaBase64 || mantActual?.firma) ? 'firmado_digitalmente' : '',
    }, 'ID', editId).catch(console.warn);
    showToast('✅ Mantenimiento actualizado');
  } else {
    const id = uid();
    lista.push({ id, fecha, ...campos });
    apiPost('Mantenimientos', 'insert', {
      ID: id, EquipoID: serial, Tipo: tipo, Frecuencia: frecuencia,
      Fecha_Ultima: fecha, Fecha_Proxima: fechaProxima,
      Firmado: firmaBase64 ? 'Sí' : 'No',
      Responsable: responsable, Observaciones: obsCompleto,
      Imagen_Base64: firmaBase64 ? 'firmado_digitalmente' : '',
      Periodo: periodo, Resp_Equipo_ID: respEquipoId,
      Cambio_Resp: cambioResp, Nuevo_Resp_ID: nuevoRespId,
      User_Win: userWin, Pass_Win: passWin,
      User_Admin: userAdmin, Pass_Admin: passAdmin,
      Cambio_Cred: cambioCred, Traslado: traslado,
      Dep_Anterior: depAnterior, Dep_Nueva: depNueva,
      Fecha_Traslado: fechaTraslado, Estado_Equipo: estadoEquipo,
      Fotos_Base64: mtFotos.length > 0 ? `${mtFotos.length} foto(s)` : '',
    }).catch(console.warn);
    showToast('🔧 Mantenimiento registrado');
  }

  if (cambioResp === 'Sí' && nuevoRespId && serial) {
    apiPost('Equipos', 'update', {
      UsuarioID: nuevoRespId,
    }, 'Serial', serial).catch(console.warn);

    const equipos = [...getData('equipos')];
    const idx = equipos.findIndex(e => e.serial === serial);
    if (idx >= 0) {
      equipos[idx].usuarioId = nuevoRespId;
      setState('equipos', equipos);
      saveKey('equipos');
    }
  }

  setState('mantenimientos', lista);
  saveKey('mantenimientos');
  cerrarModal('modal-mantto');
  document.querySelectorAll('#mt-actividades-lista input[type="checkbox"]')
    .forEach(cb => cb.checked = false);
  document.body.style.overflow = '';
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
    reader.onload = e => {
      // Comprimir la imagen antes de guardar
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Máximo 800px de ancho
        const maxW = 800;
        const ratio = Math.min(1, maxW / img.width);
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Calidad 0.4 = 40% — suficiente para evidencia
        const compressed = canvas.toDataURL('image/jpeg', 0.4);
        arr.push(compressed);
        _renderFotosPreview(arr, previewId);
      };
      img.src = e.target.result;
    };
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
const ACTIVIDADES_POR_TIPO = {
  'Mantenimiento Preventivo': [
    'Limpieza física interna (polvo y residuos)',
    'Limpieza de ventiladores y disipadores',
    'Eliminación de archivos temporales',
    'Limpieza y optimización del disco',
    'Desfragmentación del disco duro',
    'Actualización del sistema operativo',
    'Actualización de controladores (drivers)',
    'Verificación y limpieza del registro',
    'Análisis y eliminación de malware/virus',
    'Verificación del estado de la batería',
    'Verificación de conexiones internas',
    'Prueba de funcionamiento general',
  ],
  'Mantenimiento Correctivo': [
    'Diagnóstico del fallo reportado',
    'Reemplazo de componente dañado',
    'Reinstalación del sistema operativo',
    'Recuperación de datos',
    'Reparación de conectores o puertos',
    'Sustitución de disco duro/SSD',
    'Sustitución de memoria RAM',
    'Reparación de pantalla',
    'Configuración de red/internet',
    'Instalación de software requerido',
  ],
  'Mantenimiento Predictivo': [
    'Monitoreo de temperatura del procesador',
    'Análisis S.M.A.R.T. del disco duro',
    'Verificación de sectores defectuosos',
    'Prueba de estabilidad de RAM',
    'Revisión de logs del sistema',
    'Medición de voltajes de la fuente',
    'Verificación de velocidad de ventiladores',
  ],
  'Mantenimiento Adaptativo': [
    'Actualización de software institucional',
    'Migración de datos',
    'Cambio de configuración de red',
    'Instalación de nuevas aplicaciones',
    'Actualización de licencias',
    'Adaptación a nuevo hardware',
  ],
  'Mantenimiento de Emergencia': [
    'Atención inmediata al fallo crítico',
    'Diagnóstico de emergencia',
    'Restauración del sistema',
    'Recuperación de información crítica',
    'Reemplazo urgente de componente',
    'Configuración de equipo temporal',
  ],
};

window._actualizarActividades = function() {
  const tipo  = document.getElementById('mt-tipo')?.value;
  const lista = document.getElementById('mt-actividades-lista');
  if (!lista) return;
  const actividades = ACTIVIDADES_POR_TIPO[tipo] || [];
  lista.innerHTML = actividades.map((act, i) => `
    <label style="display:flex;align-items:center;gap:6px;
      font-size:12px;cursor:pointer;padding:3px 0;">
      <input type="checkbox" id="act-${i}" value="${act}"
        style="width:14px;height:14px;cursor:pointer;">
      ${act}
    </label>`).join('');
};

window._guardarMantto = guardar;