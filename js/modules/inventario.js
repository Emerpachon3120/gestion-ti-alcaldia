import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }     from '../storage.js';
import { apiPost }     from '../api.js';
import { showToast }   from '../ui/toast.js';
import { abrirModal, cerrarModal } from '../ui/modal.js';
import { formatDate, parseFecha, calcSemaforo } from '../utils.js';
import { llenarSSOficinas, llenarSSPersonas, getSSValue, setSSValue } from '../ui/searchselect.js';

let currentDep = 'todas';
let currentSearch = '';

export function render() {
  const DB = getDBStatic();
  return `
    <div class="page" id="page-inventario">
      <div class="page-header">
        <div class="section-title">📦 Inventario</div>
        <div class="section-sub">Equipos por dependencia y oficina</div>
      </div>
      <div class="filter-tabs" id="dep-tabs">
        <button class="filter-tab active" data-dep="todas">Todas</button>
        ${DB.dependencias.map(d => `<button class="filter-tab" data-dep="${d.id}">${d.nombre.replace(/Secretar[ií]a de /i,'Sec. ')}</button>`).join('')}
      </div>
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" id="inv-search" placeholder="Buscar serial, funcionario, oficina...">
      </div>
      <div id="inv-list"></div>
    </div>
    ${_modalHTML()}`;
}

export function onEnter() {
  _bindEvents();
  renderLista();
  window.abrirNuevoEquipo = abrirNuevo;
  window.editarEquipo     = editar;
}

export function renderLista() {
  const DB  = getDBStatic();
  let equips = getData('equipos').slice();

  if (currentDep !== 'todas') {
    const ofIds = DB.oficinas.filter(o => o.depId === currentDep).map(o => o.id);
    equips = equips.filter(e => ofIds.includes(e.oficina));
  }
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    equips = equips.filter(e => {
      const of = DB.oficinas.find(x => x.id === e.oficina);
      const p  = DB.personas.find(x => x.id === e.usuarioId);
      return e.serial.toLowerCase().includes(q) || (of?.nombre||'').toLowerCase().includes(q) || (p?.nombre||'').toLowerCase().includes(q);
    });
  }

  const container = document.getElementById('inv-list');
  if (!container) return;
  if (!equips.length) { container.innerHTML = `<div class="empty"><p>No hay equipos</p></div>`; return; }

  container.innerHTML = equips.map(e => {
    const of  = DB.oficinas.find(x => x.id === e.oficina);
    const p   = DB.personas.find(x => x.id === e.usuarioId);
    const dep = DB.dependencias.find(x => x.id === of?.depId);
    const mantsEq = getData('mantenimientos').filter(m => m.serial === e.serial);
    const ultimo  = mantsEq.sort((a,b) => (parseFecha(b.fecha)||0) - (parseFecha(a.fecha)||0))[0];
    const sem     = calcSemaforo(ultimo?.fechaProxima);
    const estColor = { Operativo:'badge-green','Con fallas':'badge-yellow','En mantenimiento':'badge-yellow','Dado de baja':'badge-red' }[e.estado||'Operativo'] || 'badge-green';
    return `
      <div class="card" style="margin-bottom:10px;">
        <div class="card-header" style="margin-bottom:10px;">
          <div class="card-icon" style="background:rgba(34,197,94,.1)">💻</div>
          <div style="flex:1">
            <div class="card-title mono">${e.serial}</div>
            <div class="card-sub">${e.marca ? e.marca+' ' : ''}${e.modelo || ''} · ${of?.nombre || 'Sin oficina'}</div>
          </div>
          <div style="text-align:right;">
            <span class="badge ${estColor}">${e.estado || 'Operativo'}</span>
            ${sem ? `<div class="semaforo ${sem.clase}" style="margin-top:4px">${sem.icon} ${sem.label}</div>` : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:12px;">
          <div><span style="color:var(--text3)">SO:</span> ${e.so || '—'}</div>
          <div><span style="color:var(--text3)">RAM:</span> ${e.ram || '—'}</div>
          <div><span style="color:var(--text3)">Disco:</span> ${e.disco || '—'} ${e.cap || ''}</div>
          <div><span style="color:var(--text3)">Office:</span> ${e.office || '—'}</div>
          ${e.procesador ? `<div style="grid-column:1/-1"><span style="color:var(--text3)">CPU:</span> ${e.procesador}</div>` : ''}
        </div>
        ${p ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;">👤 <b>${p.nombre}</b> — ${dep?.nombre || ''}</div>` : ''}
        <div class="card-actions">
          <button class="action-btn" data-action="editar" data-serial="${e.serial}">✏️ Editar</button>
          <button class="action-btn" data-action="historial" data-serial="${e.serial}">📄 Historial</button>
          <button class="action-btn del" data-action="eliminar" data-serial="${e.serial}">🗑️</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, serial } = btn.dataset;
      if (action === 'editar')   editar(serial);
      if (action === 'historial') _historial(serial);
      if (action === 'eliminar') _eliminar(serial);
    });
  });
}

function _modalHTML() {
  return `
    <div class="modal-overlay" id="modal-equipo">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="eq-title">💻 Nuevo Equipo</div>
        <input type="hidden" id="eq-edit-serial">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Serial *</label>
            <input class="form-input mono" id="eq-serial" placeholder="YJ01RNPG">
          </div>
          <div class="form-group"><label class="form-label">Estado</label>
            <select class="form-select" id="eq-estado">
              <option>Operativo</option><option>Con fallas</option><option>En mantenimiento</option><option>Dado de baja</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">Marca</label><input class="form-input" id="eq-marca" placeholder="HP, Lenovo..."></div>
          <div class="form-group"><label class="form-label">Modelo</label><input class="form-input" id="eq-modelo" placeholder="ProBook 450"></div>
        </div>
        <div class="form-group"><label class="form-label">Oficina *</label><div id="eq-oficina-ss"></div></div>
        <div class="form-group"><label class="form-label">Usuario asignado</label><div id="eq-usuario-ss"></div></div>
        <div class="form-group"><label class="form-label">Sistema Operativo</label><input class="form-input" id="eq-so" placeholder="Windows 11 Pro"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group"><label class="form-label">RAM</label><input class="form-input" id="eq-ram" placeholder="8 GB"></div>
          <div class="form-group"><label class="form-label">Disco</label>
            <select class="form-select" id="eq-disco"><option>SSD</option><option>HDD</option><option>NVMe</option></select>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Capacidad</label><input class="form-input" id="eq-cap" placeholder="480 GB"></div>
        <div class="form-group"><label class="form-label">Procesador</label><input class="form-input" id="eq-procesador" placeholder="Intel Core i5..."></div>
        <div class="form-group"><label class="form-label">Observaciones</label><textarea class="form-textarea" id="eq-obs"></textarea></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" style="flex:1" id="eq-cancel-btn">Cancelar</button>
          <button class="btn btn-primary"   style="flex:2" id="eq-save-btn">💻 Guardar</button>
        </div>
      </div>
    </div>`;
}

function _bindEvents() {
  document.querySelectorAll('#dep-tabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#dep-tabs .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDep = btn.dataset.dep;
      renderLista();
    });
  });
  document.getElementById('inv-search')?.addEventListener('input', e => { currentSearch = e.target.value; renderLista(); });
  document.getElementById('eq-cancel-btn')?.addEventListener('click', () => cerrarModal('modal-equipo'));
  document.getElementById('eq-save-btn')?.addEventListener('click', _guardar);
}

function abrirNuevo() {
  document.getElementById('eq-title').textContent = '💻 Nuevo Equipo';
  document.getElementById('eq-edit-serial').value = '';
  document.getElementById('eq-serial').value = ''; document.getElementById('eq-serial').disabled = false;
  ['eq-marca','eq-modelo','eq-so','eq-ram','eq-cap','eq-procesador','eq-obs'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('eq-estado').value = 'Operativo';
  document.getElementById('eq-disco').value  = 'SSD';
  llenarSSOficinas('eq-oficina-ss');
  llenarSSPersonas('eq-usuario-ss');
  abrirModal('modal-equipo');
}

function editar(serial) {
  const e = getData('equipos').find(x => x.serial === serial);
  if (!e) return;
  document.getElementById('eq-title').textContent = '✏️ Editar Equipo';
  document.getElementById('eq-edit-serial').value = serial;
  document.getElementById('eq-serial').value = serial; document.getElementById('eq-serial').disabled = true;
  document.getElementById('eq-marca').value = e.marca || '';
  document.getElementById('eq-modelo').value = e.modelo || '';
  document.getElementById('eq-so').value = e.so || '';
  document.getElementById('eq-ram').value = e.ram || '';
  document.getElementById('eq-cap').value = e.cap || '';
  document.getElementById('eq-procesador').value = e.procesador || '';
  document.getElementById('eq-obs').value = e.obs || '';
  document.getElementById('eq-estado').value = e.estado || 'Operativo';
  document.getElementById('eq-disco').value  = e.disco || 'SSD';
  llenarSSOficinas('eq-oficina-ss');
  llenarSSPersonas('eq-usuario-ss');
  const DB = getDBStatic();
  const of = DB.oficinas.find(x => x.id === e.oficina);
  if (of) setSSValue('eq-oficina-ss', of.id, of.nombre);
  const p = DB.personas.find(x => x.id === e.usuarioId);
  if (p)  setSSValue('eq-usuario-ss', p.id, p.nombre);
  abrirModal('modal-equipo');
}

async function _guardar() {
  const editSerial = document.getElementById('eq-edit-serial').value;
  const serial     = editSerial || document.getElementById('eq-serial').value.trim().toUpperCase();
  const oficina    = getSSValue('eq-oficina-ss');
  const usuarioId  = getSSValue('eq-usuario-ss');
  const fields     = { marca: 'eq-marca', modelo: 'eq-modelo', so: 'eq-so', ram: 'eq-ram', cap: 'eq-cap', procesador: 'eq-procesador', obs: 'eq-obs' };
  const vals       = {};
  Object.entries(fields).forEach(([k, id]) => { vals[k] = document.getElementById(id).value; });
  vals.estado = document.getElementById('eq-estado').value;
  vals.disco  = document.getElementById('eq-disco').value;

  if (!serial || !oficina) { showToast('⚠️ Serial y oficina son obligatorios', '#d97706'); return; }

  const lista = [...getData('equipos')];
  if (editSerial) {
    const idx = lista.findIndex(x => x.serial === editSerial);
    if (idx >= 0) lista[idx] = { ...lista[idx], ...vals, oficina, usuarioId };
    apiPost('Equipos','update',{ OficinaID:oficina, UsuarioID:usuarioId, SO:vals.so, RAM:vals.ram, Disco:vals.disco, Capacidad:vals.cap, Marca:vals.marca, Modelo:vals.modelo, Procesador:vals.procesador, Estado:vals.estado, Observaciones:vals.obs },'Serial',editSerial).catch(console.warn);
    showToast('✅ Equipo actualizado');
  } else {
    if (lista.find(x => x.serial === serial)) { showToast('⚠️ Ya existe ese serial','#d97706'); return; }
    lista.push({ serial, oficina, usuarioId, ...vals, fotos:[] });
    apiPost('Equipos','insert',{ Serial:serial, OficinaID:oficina, UsuarioID:usuarioId, SO:vals.so, RAM:vals.ram, Disco:vals.disco, Capacidad:vals.cap, Marca:vals.marca, Modelo:vals.modelo, Estado:vals.estado, Observaciones:vals.obs, Imagen_Base64:'' }).catch(console.warn);
    showToast('💻 Equipo registrado');
  }
  setState('equipos', lista);
  saveKey('equipos');
  cerrarModal('modal-equipo');
  renderLista();
}

function _eliminar(serial) {
  const lista = getData('equipos').filter(e => e.serial !== serial);
  setState('equipos', lista);
  saveKey('equipos');
  apiPost('Equipos','delete',{},'Serial',serial).catch(console.warn);
  showToast('🗑️ Equipo eliminado');
  renderLista();
}

function _historial(serial) {
  showToast(`📄 Historial de ${serial} — función disponible en reportes`);
}