import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }     from '../storage.js';
import { apiPost }     from '../firebase.js';
import { showToast }   from '../ui/toast.js';
import { abrirModal, cerrarModal } from '../ui/modal.js';
import { uid, formatDate, parseFecha } from '../utils.js';
import { llenarSSPersonas, llenarSSEquipos, getSSValue, setSSValue } from '../ui/searchselect.js';

let currentFilter = 'todas';

export function render() {
  return `
    <div class="page" id="page-incidencias">
      <div class="section-title">🚨 Incidencias</div>
      <div class="section-sub">Gestión de fallas y solicitudes</div>
      <div class="filter-tabs" style="flex-wrap:wrap;">
        <button class="filter-tab active" data-filter="todas">Todas</button>
        <button class="filter-tab" data-filter="alta">🔴 Alta</button>
        <button class="filter-tab" data-filter="media">🟡 Media</button>
        <button class="filter-tab" data-filter="baja">🟢 Baja</button>
        <button class="filter-tab" data-filter="abierta">Abiertas</button>
        <button class="filter-tab" data-filter="enproceso">En proceso</button>
        <button class="filter-tab" data-filter="cerrada">Cerradas</button>
      </div>
      <div id="inc-list"></div>
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
  if (currentFilter === 'alta')      data = data.filter(i => ['alta','crítica'].includes(i.prioridad));
  if (currentFilter === 'media')     data = data.filter(i => i.prioridad === 'media');
  if (currentFilter === 'baja')      data = data.filter(i => i.prioridad === 'baja');
  if (currentFilter === 'abierta')   data = data.filter(i => ['Iniciada','En proceso','Pendiente','abierta'].includes(i.estadoTexto||i.estado));
  if (currentFilter === 'enproceso') data = data.filter(i => i.estadoTexto === 'En proceso');
  if (currentFilter === 'cerrada')   data = data.filter(i => ['Finalizado','Cancelada','cerrada'].includes(i.estadoTexto||i.estado));

  const container = document.getElementById('inc-list');
  if (!container) return;
  if (!data.length) { container.innerHTML = `<div class="empty"><p>Sin incidencias</p></div>`; return; }

  const prioColor = { alta:'var(--red)', crítica:'var(--red)', media:'var(--yellow)', baja:'var(--green)' };
  const estadoConfig = {
    'Iniciada':   { bg:'#eff6ff',color:'#1e40af',icon:'🆕' },
    'En proceso': { bg:'#fef9c3',color:'#854d0e',icon:'🟡' },
    'En pausa':   { bg:'#f3f4f6',color:'#374151',icon:'⏸️' },
    'Finalizado': { bg:'#d1fae5',color:'#065f46',icon:'✅' },
    'Cancelada':  { bg:'#fee2e2',color:'#991b1b',icon:'❌' },
    'Pendiente':  { bg:'#f3f4f6',color:'#374151',icon:'⚪' },
    'abierta':    { bg:'#fee2e2',color:'#991b1b',icon:'🔴' },
    'cerrada':    { bg:'#d1fae5',color:'#065f46',icon:'✅' },
  };

  container.innerHTML = data.map(i => {
    const DB     = getDBStatic();
    const nombre = i.nombre || DB.personas.find(x => x.id === i.personaId)?.nombre || '—';
    const est    = i.estadoTexto || i.estado || 'Iniciada';
    const eCfg   = estadoConfig[est] || { bg:'#f3f4f6',color:'#374151',icon:'⚪' };
    const pColor = prioColor[i.prioridad] || 'var(--text3)';
    return `
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${pColor};flex-shrink:0;"></div>
            <div>
              <div style="font-size:13px;font-weight:600">${i.tipo}</div>
              <div style="font-size:11px;color:var(--text3)">👤 ${nombre}</div>
              ${i.secretaria ? `<div style="font-size:11px;color:var(--text3)">🏢 ${i.secretaria}</div>` : ''}
            </div>
          </div>
          <span style="background:${eCfg.bg};color:${eCfg.color};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;white-space:nowrap;">${eCfg.icon} ${est}</span>
        </div>
        ${i.ticket ? `<div style="font-size:11px;color:var(--text3);margin-bottom:6px;">🎫 <span class="mono">${i.ticket}</span></div>` : ''}
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px;padding:6px 8px;background:var(--bg2);border-radius:5px;">${i.desc}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span class="tag">📅 ${formatDate(i.fecha)||'—'}</span>
          <span class="tag" style="color:${pColor}">${i.prioridad}</span>
        </div>
        <div class="card-actions">
          <select class="action-btn" data-action="estado" data-id="${i.id}"
            style="cursor:pointer;font-size:11px;padding:6px;">
            <option value="Iniciada"   ${est==='Iniciada'   ?'selected':''}>Iniciada</option>
            <option value="En proceso" ${est==='En proceso' ?'selected':''}>En proceso</option>
            <option value="En pausa"   ${est==='En pausa'   ?'selected':''}>En pausa</option>
            <option value="Finalizado" ${est==='Finalizado' ?'selected':''}>Finalizado</option>
            <option value="Cancelada"  ${est==='Cancelada'  ?'selected':''}>Cancelada</option>
            <option value="Pendiente"  ${est==='Pendiente'  ?'selected':''}>Pendiente</option>
          </select>
          ${['Iniciada','En proceso','Pendiente','abierta'].includes(est)
            ? `<button class="action-btn" data-action="resolver" data-id="${i.id}"
                style="color:var(--green);font-weight:600;">Resolver</button>`
            : ''}
          <button class="action-btn del" data-action="eliminar" data-id="${i.id}">🗑️</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset;
      if (action === 'resolver') _resolver(id);
      if (action === 'eliminar') _eliminar(id);
    });
  });

  // Cambio de estado con el select
  container.querySelectorAll('select[data-action="estado"]').forEach(sel => {
    sel.addEventListener('change', () => {
      const id = sel.dataset.id;
      const nuevoEstado = sel.value;
      const estadoCerrado = ['Finalizado','Cancelada'].includes(nuevoEstado);
      const lista = getData('incidencias').map(i => i.id !== id ? i : {
        ...i,
        estadoTexto: nuevoEstado,
        estado: estadoCerrado ? 'cerrada' : 'abierta',
      });
      setState('incidencias', lista);
      saveKey('incidencias');
      // Actualizar en Firestore
      apiPost('Incidencias', 'update', { estadoTexto: nuevoEstado, estado: estadoCerrado ? 'cerrada' : 'abierta' }, 'id', id).catch(console.warn);
      showToast(`Estado actualizado: ${nuevoEstado}`);
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
            <option>Secretaría General y de Gobierno</option><option>Secretaría de Hacienda</option>
            <option>Secretaría de Planeación</option><option>Secretaría Agropecuaria y Ambiental</option>
            <option>Coordinación Salud</option><option>Control Interno</option><option>Otro</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Funcionario *</label><div id="inc-persona-ss"></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Tipo *</label>
            <select class="form-select" id="inc-tipo">
              <option>Hardware</option><option>Software</option><option>Internet / Red</option>
              <option>Impresora</option><option>Office</option><option>Claves</option><option>Otro</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Prioridad</label>
            <select class="form-select" id="inc-prioridad">
              <option value="alta">🔴 Alta</option><option value="media">🟡 Media</option><option value="baja">🟢 Baja</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Estado</label>
            <select class="form-select" id="inc-estado">
              <option>Iniciada</option><option>En proceso</option><option>En pausa</option>
              <option>Finalizado</option><option>Cancelada</option><option>Pendiente</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Responsable atención</label>
            <input type="text" class="form-input" id="inc-responsable" value="Emerson Judiño Pachón Ayala">
          </div>
        </div>
        <div class="form-group"><label class="form-label">Descripción *</label>
          <textarea class="form-textarea" id="inc-desc" placeholder="Describe el problema..."></textarea>
        </div>
        <div class="form-group"><label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="inc-obs" style="height:60px;"></textarea>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" style="flex:1" id="inc-cancel-btn">Cancelar</button>
          <button class="btn btn-danger"    style="flex:2" id="inc-save-btn">🚨 Reportar</button>
        </div>
      </div>
    </div>`;
}

function _bindEvents() {
  document.querySelectorAll('#page-incidencias .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-incidencias .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderLista();
    });
  });
  document.getElementById('inc-cancel-btn')?.addEventListener('click', () => cerrarModal('modal-incidencia'));
  document.getElementById('inc-save-btn')?.addEventListener('click', _guardar);
}

function abrirNuevo() {
  document.getElementById('inc-title').textContent = '🚨 Nueva Incidencia';
  document.getElementById('inc-edit-id').value = '';
  document.getElementById('inc-secretaria').value = '';
  document.getElementById('inc-tipo').value = 'Hardware';
  document.getElementById('inc-prioridad').value = 'alta';
  document.getElementById('inc-estado').value = 'Iniciada';
  document.getElementById('inc-desc').value = '';
  document.getElementById('inc-obs').value = '';
  document.getElementById('inc-responsable').value = 'Emerson Judiño Pachon Ayala';
  llenarSSPersonas('inc-persona-ss');
  abrirModal('modal-incidencia');
}

function editar(id) {
  const i = getData('incidencias').find(x => x.id === id);
  if (!i) return;
  document.getElementById('inc-title').textContent = '✏️ Editar Incidencia';
  document.getElementById('inc-edit-id').value = id;
  document.getElementById('inc-secretaria').value = i.secretaria || '';
  document.getElementById('inc-tipo').value = i.tipo || 'Hardware';
  document.getElementById('inc-prioridad').value = i.prioridad || 'alta';
  document.getElementById('inc-estado').value = i.estadoTexto || 'Iniciada';
  document.getElementById('inc-desc').value = i.desc || '';
  document.getElementById('inc-obs').value = i.observacion || '';
  document.getElementById('inc-responsable').value = i.responsableAtencion || 'Emerson Judiño Pachón Ayala';
  llenarSSPersonas('inc-persona-ss');
  const DB = getDBStatic();
  const p  = DB.personas.find(x => x.id === i.personaId);
  if (p) setSSValue('inc-persona-ss', p.id, p.nombre);
  abrirModal('modal-incidencia');
}

async function _guardar() {
  const personaId   = getSSValue('inc-persona-ss');
  const secretaria  = document.getElementById('inc-secretaria').value;
  const tipo        = document.getElementById('inc-tipo').value;
  const prioridad   = document.getElementById('inc-prioridad').value;
  const estadoTexto = document.getElementById('inc-estado').value;
  const desc        = document.getElementById('inc-desc').value;
  const observacion = document.getElementById('inc-obs').value;
  const responsableAtencion = document.getElementById('inc-responsable').value;
  const editId      = document.getElementById('inc-edit-id').value;
  if (!desc) { showToast('⚠️ Describe el problema'); return; }

  const DB  = getDBStatic();
  const p   = DB.personas.find(x => x.id === personaId);
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fecha = now.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
  const estadoCerrada = ['Finalizado','Cancelada'].includes(estadoTexto);
  const lista = [...getData('incidencias')];

  if (editId) {
    const idx = lista.findIndex(x => x.id === editId);
    if (idx >= 0) {
      lista[idx] = {
        ...lista[idx], personaId,
        nombre: p?.nombre || lista[idx].nombre,
        secretaria, tipo, prioridad, estadoTexto,
        estado: estadoCerrada ? 'cerrada' : 'abierta',
        desc, observacion, responsableAtencion,
      };
      // Actualizar en Firestore
      apiPost('Incidencias', 'update', lista[idx], 'id', editId).catch(console.warn);
    }
    showToast('✅ Incidencia actualizada');
  } else {
    const ticket = `INC-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${Math.floor(Math.random()*9000)+1000}`;
    const nueva = {
      id: ticket, ticket, personaId,
      nombre: p?.nombre || '—',
      secretaria, tipo, prioridad, estadoTexto,
      estado: estadoCerrada ? 'cerrada' : 'abierta',
      desc, observacion, responsableAtencion,
      fecha, fromForm: false, fotos: [],
    };
    lista.push(nueva);
    // Guardar en Firestore
    apiPost('Incidencias', 'insert', nueva, 'id', ticket).catch(console.warn);
    showToast(`🚨 Incidencia creada — ${ticket}`);
  }

  setState('incidencias', lista);
  saveKey('incidencias');
  cerrarModal('modal-incidencia');
  renderLista();
}

function _resolver(id) {
  const lista = getData('incidencias').map(i =>
    i.id === id ? { ...i, estadoTexto: 'Finalizado', estado: 'cerrada' } : i
  );
  setState('incidencias', lista);
  saveKey('incidencias');
  apiPost('Incidencias', 'update', { estadoTexto: 'Finalizado', estado: 'cerrada' }, 'id', id).catch(console.warn);
  showToast('✅ Incidencia resuelta');
  renderLista();
}

function _eliminar(id) {
  const lista = getData('incidencias').filter(i => i.id !== id);
  setState('incidencias', lista);
  saveKey('incidencias');
  showToast('🗑️ Eliminada');
  renderLista();
}
