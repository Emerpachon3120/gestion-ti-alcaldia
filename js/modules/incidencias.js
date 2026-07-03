import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }     from '../storage.js';
import { apiPost }     from '../firebase.js';
import { showToast }   from '../ui/toast.js';
import { abrirModal, cerrarModal } from '../ui/modal.js';
import { uid, formatDate } from '../utils.js';
import { llenarSSPersonas, getSSValue, setSSValue } from '../ui/searchselect.js';

let currentFilter = 'todas';
let filterEstado  = 'todos';
let filterTipo    = 'todos';
let busqueda      = '';

export function render() {
  return `
    <div id="page-incidencias" class="pb-8">

      <!-- Header -->
      <div class="relative overflow-hidden rounded-b-3xl -mx-4 -mt-4 mb-5 px-5 pt-5 pb-6"
        style="background:linear-gradient(135deg,#7b0d0d,#dc2626)">
        <div class="absolute -top-6 -right-6 w-24 h-24 rounded-full" style="background:rgba(255,255,255,.07)"></div>
        <div class="relative z-10">
          <h1 class="text-xl font-extrabold text-white mb-0.5">🚨 Incidencias</h1>
          <p class="text-xs" style="color:rgba(255,255,255,.7)">Gestión de fallas y solicitudes</p>
        </div>
      </div>

      <!-- Buscador -->
      <div class="px-1 mb-3">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" id="inc-search" placeholder="Buscar nombre, tipo, secretaría, ticket...">
        </div>
      </div>

      <!-- Filtros prioridad -->
      <div class="px-1 mb-1">
        <p class="text-[11px] font-bold uppercase tracking-wider mb-2" style="color:var(--text3)">Prioridad</p>
        <div class="filter-tabs" id="inc-prio-tabs" style="flex-wrap:wrap">
          <button class="filter-tab active" data-filter="todas">Todas</button>
          <button class="filter-tab" data-filter="alta">🔴 Alta</button>
          <button class="filter-tab" data-filter="media">🟡 Media</button>
          <button class="filter-tab" data-filter="baja">🟢 Baja</button>
        </div>
      </div>

      <!-- Filtros estado -->
      <div class="px-1 mb-1">
        <p class="text-[11px] font-bold uppercase tracking-wider mb-2" style="color:var(--text3)">Estado</p>
        <div class="filter-tabs" id="inc-estado-tabs" style="flex-wrap:wrap">
          <button class="filter-tab active" data-estado="todos">Todos</button>
          <button class="filter-tab" data-estado="Iniciada">🆕 Iniciada</button>
          <button class="filter-tab" data-estado="En proceso">🟡 En proceso</button>
          <button class="filter-tab" data-estado="En pausa">⏸️ En pausa</button>
          <button class="filter-tab" data-estado="Pendiente">⚪ Pendiente</button>
          <button class="filter-tab" data-estado="Finalizado">✅ Finalizado</button>
          <button class="filter-tab" data-estado="Cancelada">❌ Cancelada</button>
        </div>
      </div>

      <!-- Filtros tipo -->
      <div class="px-1 mb-3">
        <p class="text-[11px] font-bold uppercase tracking-wider mb-2" style="color:var(--text3)">Tipo</p>
        <div class="filter-tabs" id="inc-tipo-tabs" style="flex-wrap:wrap">
          <button class="filter-tab active" data-tipo="todos">Todos</button>
          <button class="filter-tab" data-tipo="Hardware">💻 Hardware</button>
          <button class="filter-tab" data-tipo="Software">🖥️ Software</button>
          <button class="filter-tab" data-tipo="Internet / Red">🌐 Red</button>
          <button class="filter-tab" data-tipo="Impresora">🖨️ Impresora</button>
          <button class="filter-tab" data-tipo="Office">📄 Office</button>
          <button class="filter-tab" data-tipo="Claves">🔑 Claves</button>
          <button class="filter-tab" data-tipo="Otro">📦 Otro</button>
        </div>
      </div>

      <p id="inc-contador" class="px-1 text-xs mb-3" style="color:var(--text3)"></p>
      <div id="inc-list" class="px-1"></div>
    </div>
    ${_modalHTML()}`;
}

export function onEnter() {
  _bindEvents();
  renderLista();
  window.abrirNuevaIncidencia = abrirNuevo;
  window.editarIncidencia     = editar;
}

export function renderLista() {
  let data = getData('incidencias').slice().reverse();

  if (currentFilter === 'alta')  data = data.filter(i => ['alta','crítica'].includes(i.prioridad));
  if (currentFilter === 'media') data = data.filter(i => i.prioridad === 'media');
  if (currentFilter === 'baja')  data = data.filter(i => i.prioridad === 'baja');
  if (filterEstado !== 'todos')  data = data.filter(i => (i.estadoTexto || i.estado) === filterEstado);
  if (filterTipo   !== 'todos')  data = data.filter(i => i.tipo === filterTipo);

  if (busqueda.trim()) {
    const q = busqueda.toLowerCase();
    data = data.filter(i =>
      (i.nombre||'').toLowerCase().includes(q) ||
      (i.tipo||'').toLowerCase().includes(q) ||
      (i.secretaria||'').toLowerCase().includes(q) ||
      (i.ticket||'').toLowerCase().includes(q) ||
      (i.desc||'').toLowerCase().includes(q) ||
      (i.observacion||'').toLowerCase().includes(q) ||
      (i.oficina||'').toLowerCase().includes(q)
    );
  }

  const container = document.getElementById('inc-list');
  const contador  = document.getElementById('inc-contador');
  if (!container) return;
  if (contador) contador.textContent = `${data.length} incidencia${data.length !== 1 ? 's' : ''} encontrada${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 gap-3" style="color:var(--text3)">
        <div class="text-4xl">🚨</div>
        <p class="text-sm">Sin incidencias</p>
      </div>`;
    return;
  }

  const prioColor = { alta:'#dc2626', crítica:'#dc2626', media:'#d97706', baja:'#16a34a' };
  const estadoCfg = {
    'Iniciada':   { bg:'#eff6ff', color:'#1e40af', icon:'🆕' },
    'En proceso': { bg:'#fef9c3', color:'#854d0e', icon:'🟡' },
    'En pausa':   { bg:'#f3f4f6', color:'#374151', icon:'⏸️' },
    'Finalizado': { bg:'#d1fae5', color:'#065f46', icon:'✅' },
    'Cancelada':  { bg:'#fee2e2', color:'#991b1b', icon:'❌' },
    'Pendiente':  { bg:'#f3f4f6', color:'#374151', icon:'⚪' },
    'abierta':    { bg:'#fee2e2', color:'#991b1b', icon:'🔴' },
    'cerrada':    { bg:'#d1fae5', color:'#065f46', icon:'✅' },
  };

  container.innerHTML = data.map(i => {
    const DB     = getDBStatic();
    const nombre = i.nombre || DB.personas.find(x => x.id === i.personaId)?.nombre || '—';
    const est    = i.estadoTexto || i.estado || 'Iniciada';
    const eCfg   = estadoCfg[est] || { bg:'#f3f4f6', color:'#374151', icon:'⚪' };
    const pColor = prioColor[i.prioridad] || '#8a8a85';
    const abierta = ['Iniciada','En proceso','Pendiente','abierta','En pausa'].includes(est);

    return `
      <div class="rounded-2xl mb-3 overflow-hidden"
        style="background:var(--card);border:1px solid var(--border);border-left:4px solid ${pColor}">
        <div class="p-4">

          <!-- Header -->
          <div class="flex justify-between items-start gap-2 mb-3">
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm" style="color:var(--text1)">${i.tipo}</p>
              <p class="text-xs mt-0.5" style="color:var(--text2)">👤 ${nombre}</p>
              ${i.secretaria ? `<p class="text-xs mt-0.5 truncate" style="color:var(--text3)">🏢 ${i.secretaria}</p>` : ''}
              ${i.oficina    ? `<p class="text-xs truncate" style="color:var(--text3)">📍 ${i.oficina}</p>` : ''}
            </div>
            <span class="text-[11px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
              style="background:${eCfg.bg};color:${eCfg.color}">
              ${eCfg.icon} ${est}
            </span>
          </div>

          ${i.ticket ? `
          <p class="text-[11px] mb-2 font-mono" style="color:var(--text3)">🎫 ${i.ticket}</p>` : ''}

          <div class="rounded-lg p-2.5 mb-3 text-xs" style="background:var(--bg2);color:var(--text2)">
            ${i.desc}
          </div>

          ${i.observacion ? `
          <div class="text-xs mb-2 pl-3 italic" style="border-left:3px solid var(--border);color:var(--text3)">
            💬 ${i.observacion}
          </div>` : ''}

          <!-- Tags -->
          <div class="flex flex-wrap gap-1 mb-3">
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" style="background:var(--bg2);color:var(--text3)">
              📅 ${formatDate(i.fecha)||'—'}
            </span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
              style="background:${pColor}">
              ● ${i.prioridad}
            </span>
          </div>

          <!-- Selector estado -->
          <select class="w-full rounded-xl px-3 py-2 text-xs font-semibold mb-2 cursor-pointer"
            data-action="estado" data-id="${i.id}"
            style="border:1px solid var(--border);background:var(--bg2);color:var(--text1)">
            <option value="Iniciada"   ${est==='Iniciada'   ?'selected':''}>🆕 Iniciada</option>
            <option value="En proceso" ${est==='En proceso' ?'selected':''}>🟡 En proceso</option>
            <option value="En pausa"   ${est==='En pausa'   ?'selected':''}>⏸️ En pausa</option>
            <option value="Finalizado" ${est==='Finalizado' ?'selected':''}>✅ Finalizado</option>
            <option value="Cancelada"  ${est==='Cancelada'  ?'selected':''}>❌ Cancelada</option>
            <option value="Pendiente"  ${est==='Pendiente'  ?'selected':''}>⚪ Pendiente</option>
          </select>
        </div>

        <!-- Acciones -->
        <div class="flex border-t" style="border-color:var(--border)">
          <button data-action="editar" data-id="${i.id}"
            class="flex-1 py-2.5 text-xs font-semibold" style="color:var(--text2)">✏️ Editar</button>
          <div style="width:1px;background:var(--border)"></div>
          ${abierta ? `
          <button data-action="resolver" data-id="${i.id}"
            class="flex-1 py-2.5 text-xs font-semibold" style="color:#16a34a">✅ Resolver</button>
          <div style="width:1px;background:var(--border)"></div>` : ''}
          <button data-action="eliminar" data-id="${i.id}"
            class="flex-1 py-2.5 text-xs font-semibold" style="color:#dc2626">🗑️</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset;
      if (action === 'resolver') _resolver(id);
      if (action === 'eliminar') _eliminar(id);
      if (action === 'editar')   editar(id);
    });
  });

  container.querySelectorAll('select[data-action="estado"]').forEach(sel => {
    sel.addEventListener('change', () => {
      const id = sel.dataset.id;
      const nuevoEstado   = sel.value;
      const estadoCerrado = ['Finalizado','Cancelada'].includes(nuevoEstado);
      const lista = getData('incidencias').map(i => i.id !== id ? i : {
        ...i, estadoTexto: nuevoEstado, estado: estadoCerrado ? 'cerrada' : 'abierta',
      });
      setState('incidencias', lista);
      saveKey('incidencias');
      apiPost('Incidencias', 'update', { estadoTexto: nuevoEstado, estado: estadoCerrado ? 'cerrada' : 'abierta' }, 'id', id).catch(console.warn);
      showToast(`Estado: ${nuevoEstado}`);
      renderLista();
    });
  });
}

function _modalHTML() {
  return `
    <div class="modal-overlay" id="modal-incidencia">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="inc-title">🚨 Nueva Incidencia</div>
        <input type="hidden" id="inc-edit-id">

        <div class="form-group"><label class="form-label">Secretaría *</label>
          <select class="form-select" id="inc-secretaria">
            <option value="">Seleccionar...</option>
            <option>Secretaría General y de Gobierno</option>
            <option>Secretaría de Hacienda</option>
            <option>Secretaría de Planeación</option>
            <option>Secretaría Agropecuaria y Ambiental</option>
            <option>Coordinación Salud</option>
            <option>Coordinación Programas Sociales</option>
            <option>Control Interno</option>
            <option>Otro</option>
          </select>
        </div>

        <div class="form-group"><label class="form-label">Funcionario</label>
          <div id="inc-persona-ss"></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Tipo *</label>
            <select class="form-select" id="inc-tipo">
              <option>Hardware</option><option>Software</option>
              <option>Internet / Red</option><option>Impresora</option>
              <option>Office</option><option>Claves</option><option>Otro</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Prioridad</label>
            <select class="form-select" id="inc-prioridad">
              <option value="alta">🔴 Alta</option>
              <option value="media">🟡 Media</option>
              <option value="baja">🟢 Baja</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Estado</label>
            <select class="form-select" id="inc-estado">
              <option>Iniciada</option><option>En proceso</option>
              <option>En pausa</option><option>Finalizado</option>
              <option>Cancelada</option><option>Pendiente</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Responsable</label>
            <input type="text" class="form-input" id="inc-responsable" value="Emerson Judiño Pachón Ayala">
          </div>
        </div>

        <div class="form-group"><label class="form-label">Descripción *</label>
          <textarea class="form-textarea" id="inc-desc" placeholder="Describe el problema..."></textarea>
        </div>
        <div class="form-group"><label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="inc-obs" style="height:60px;"></textarea>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-secondary" style="flex:1" id="inc-cancel-btn">Cancelar</button>
          <button class="btn btn-danger"    style="flex:2" id="inc-save-btn">🚨 Guardar</button>
        </div>
      </div>
    </div>`;
}

function _bindEvents() {
  document.querySelectorAll('#inc-prio-tabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#inc-prio-tabs .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); currentFilter = btn.dataset.filter; renderLista();
    });
  });
  document.querySelectorAll('#inc-estado-tabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#inc-estado-tabs .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); filterEstado = btn.dataset.estado; renderLista();
    });
  });
  document.querySelectorAll('#inc-tipo-tabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#inc-tipo-tabs .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); filterTipo = btn.dataset.tipo; renderLista();
    });
  });
  document.getElementById('inc-search')?.addEventListener('input', e => { busqueda = e.target.value; renderLista(); });
  document.getElementById('inc-cancel-btn')?.addEventListener('click', () => cerrarModal('modal-incidencia'));
  document.getElementById('inc-save-btn')?.addEventListener('click', _guardar);
}

function abrirNuevo() {
  document.getElementById('inc-title').textContent    = '🚨 Nueva Incidencia';
  document.getElementById('inc-edit-id').value        = '';
  document.getElementById('inc-secretaria').value     = '';
  document.getElementById('inc-tipo').value           = 'Hardware';
  document.getElementById('inc-prioridad').value      = 'alta';
  document.getElementById('inc-estado').value         = 'Iniciada';
  document.getElementById('inc-desc').value           = '';
  document.getElementById('inc-obs').value            = '';
  document.getElementById('inc-responsable').value    = 'Emerson Judiño Pachón Ayala';
  llenarSSPersonas('inc-persona-ss');
  abrirModal('modal-incidencia');
}

function editar(id) {
  const i = getData('incidencias').find(x => x.id === id);
  if (!i) return;
  document.getElementById('inc-title').textContent    = '✏️ Editar Incidencia';
  document.getElementById('inc-edit-id').value        = id;
  document.getElementById('inc-secretaria').value     = i.secretaria || '';
  document.getElementById('inc-tipo').value           = i.tipo       || 'Hardware';
  document.getElementById('inc-prioridad').value      = i.prioridad  || 'alta';
  document.getElementById('inc-estado').value         = i.estadoTexto|| 'Iniciada';
  document.getElementById('inc-desc').value           = i.desc       || '';
  document.getElementById('inc-obs').value            = i.observacion|| '';
  document.getElementById('inc-responsable').value    = i.responsableAtencion || 'Emerson Judiño Pachón Ayala';
  llenarSSPersonas('inc-persona-ss');
  const DB = getDBStatic();
  const p  = DB.personas.find(x => x.id === i.personaId);
  if (p) setSSValue('inc-persona-ss', p.id, p.nombre);
  abrirModal('modal-incidencia');
}

async function _guardar() {
  const personaId           = getSSValue('inc-persona-ss');
  const secretaria          = document.getElementById('inc-secretaria').value;
  const tipo                = document.getElementById('inc-tipo').value;
  const prioridad           = document.getElementById('inc-prioridad').value;
  const estadoTexto         = document.getElementById('inc-estado').value;
  const desc                = document.getElementById('inc-desc').value;
  const observacion         = document.getElementById('inc-obs').value;
  const responsableAtencion = document.getElementById('inc-responsable').value;
  const editId              = document.getElementById('inc-edit-id').value;

  if (!desc) { showToast('⚠️ Describe el problema'); return; }

  const DB            = getDBStatic();
  const p             = DB.personas.find(x => x.id === personaId);
  const now           = new Date();
  const pad           = n => String(n).padStart(2,'0');
  const fecha         = now.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
  const estadoCerrada = ['Finalizado','Cancelada'].includes(estadoTexto);
  const lista         = [...getData('incidencias')];

  if (editId) {
    const idx = lista.findIndex(x => x.id === editId);
    if (idx >= 0) {
      lista[idx] = { ...lista[idx], personaId, nombre: p?.nombre || lista[idx].nombre, secretaria, tipo, prioridad, estadoTexto, estado: estadoCerrada ? 'cerrada' : 'abierta', desc, observacion, responsableAtencion };
      apiPost('Incidencias', 'update', lista[idx], 'id', editId).catch(console.warn);
    }
    showToast('✅ Incidencia actualizada');
  } else {
    const ticket = `INC-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Math.floor(Math.random()*9000)+1000}`;
    const nueva = { id: ticket, ticket, personaId, nombre: p?.nombre || '—', secretaria, tipo, prioridad, estadoTexto, estado: estadoCerrada ? 'cerrada' : 'abierta', desc, observacion, responsableAtencion, fecha, fromForm: false, fotos: [] };
    lista.push(nueva);
    apiPost('Incidencias', 'insert', nueva, 'id', ticket).catch(console.warn);
    showToast(`🚨 Incidencia creada — ${ticket}`);
  }

  setState('incidencias', lista);
  saveKey('incidencias');
  cerrarModal('modal-incidencia');
  renderLista();
}

function _resolver(id) {
  const lista = getData('incidencias').map(i => i.id === id ? { ...i, estadoTexto: 'Finalizado', estado: 'cerrada' } : i);
  setState('incidencias', lista);
  saveKey('incidencias');
  apiPost('Incidencias', 'update', { estadoTexto: 'Finalizado', estado: 'cerrada' }, 'id', id).catch(console.warn);
  showToast('✅ Incidencia resuelta');
  renderLista();
}

function _eliminar(id) {
  if (!confirm('¿Eliminar esta incidencia?')) return;
  const lista = getData('incidencias').filter(i => i.id !== id);
  setState('incidencias', lista);
  saveKey('incidencias');
  apiPost('Incidencias', 'delete', {}, 'id', id).catch(console.warn);
  showToast('🗑️ Incidencia eliminada');
  renderLista();
}
