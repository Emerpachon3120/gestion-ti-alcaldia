import { getData, getDBStatic, setState } from '../state.js';
import { apiPost }     from '../firebase.js';
import { showToast, showConfirm, cerrarConfirm } from '../ui/toast.js';
import { abrirModal, cerrarModal } from '../ui/modal.js';
import { saveKey } from '../storage.js';
import { llenarSSPersonas, getSSValue, setSSValue } from '../ui/searchselect.js';


let _tabActual = 'deps';

export function render() {
  const DB = getDBStatic();
  return `
    <div class="page">
      <div class="section-title">Administración</div>
      <div class="section-sub">Gestión de dependencias, oficinas y personas</div>

      <!-- TABS -->
      <div class="filter-tabs" style="margin-bottom:12px;">
        <button class="filter-tab ${_tabActual==='deps'?'active':''}" data-tab="deps">
          Dependencias (${DB.dependencias.length})
        </button>
        <button class="filter-tab ${_tabActual==='ofs'?'active':''}" data-tab="ofs">
          Oficinas (${DB.oficinas.length})
        </button>
        <button class="filter-tab ${_tabActual==='personas'?'active':''}" data-tab="personas">
          Funcionarios (${DB.personas.length})
        </button>
      </div>

      <!-- BARRA SUPERIOR -->
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="text" class="form-input" id="admin-buscar"
          placeholder="Buscar..." style="margin:0;flex:1;">
        <button class="btn btn-primary" style="margin:0;width:auto;padding:8px 16px;"
          id="btn-admin-nuevo">+ Nuevo</button>
      </div>

      <!-- CONTENIDO -->
      <div id="admin-contenido"></div>
    </div>

    <!-- MODAL DEPENDENCIA -->
    <div class="modal-overlay" id="modal-dep">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="dep-title">Nueva Dependencia</div>
        <input type="hidden" id="dep-edit-id">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="dep-nombre"
            placeholder="Ej: Secretaría de Hacienda">
        </div>
        <div class="form-group">
          <label class="form-label">Responsable / Jefe</label>
          <div id="dep-responsable-ss"></div>
        </div>
        <div class="modal-footer">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" style="flex:1;margin-top:0;"
              onclick="cerrarModal('modal-dep')">Cancelar</button>
            <button class="btn btn-primary" style="flex:2;margin-top:0;"
              id="dep-save-btn">Guardar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL OFICINA -->
    <div class="modal-overlay" id="modal-of">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="of-title">Nueva Oficina</div>
        <input type="hidden" id="of-edit-id">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="of-nombre"
            placeholder="Ej: Tesorería">
        </div>
        <div class="form-group">
          <label class="form-label">Dependencia *</label>
          <select class="form-select" id="of-dep">
            ${getDBStatic().dependencias.map(d =>
              `<option value="${d.id}">${d.nombre}</option>`
            ).join('')}
          </select>
        </div>
        <div class="modal-footer">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" style="flex:1;margin-top:0;"
              onclick="cerrarModal('modal-of')">Cancelar</button>
            <button class="btn btn-primary" style="flex:2;margin-top:0;"
              id="of-save-btn">Guardar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL PERSONA -->
    <div class="modal-overlay" id="modal-persona-admin">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="persona-title">Nuevo Funcionario</div>
        <input type="hidden" id="persona-edit-id">
        <div class="form-group">
          <label class="form-label">Nombre completo *</label>
          <input type="text" class="form-input" id="persona-nombre">
        </div>
        <div class="form-group">
          <label class="form-label">Cargo</label>
          <input type="text" class="form-input" id="persona-cargo">
        </div>
        <div class="form-group">
          <label class="form-label">Correo</label>
          <input type="email" class="form-input" id="persona-correo">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" class="form-input" id="persona-tel">
        </div>
        <div class="modal-footer">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" style="flex:1;margin-top:0;"
              onclick="cerrarModal('modal-persona-admin')">Cancelar</button>
            <button class="btn btn-primary" style="flex:2;margin-top:0;"
              id="persona-save-btn">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function onEnter() {
  _renderContenido();
  _bindEvents();
  // Inicializar SearchSelect del modal de dependencia
  llenarSSPersonas('dep-responsable-ss');
}

function _renderContenido(busqueda = '') {
  const DB = getDBStatic();
  const q  = busqueda.toLowerCase();
  const container = document.getElementById('admin-contenido');
  if (!container) return;

  if (_tabActual === 'deps') {
    const items = DB.dependencias.filter(d =>
      !q || d.nombre.toLowerCase().includes(q) ||
      (d.responsable||'').toLowerCase().includes(q)
    );
    container.innerHTML = items.length ? items.map(d => `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:10px 12px;background:var(--card);border:1px solid var(--border);
        border-radius:var(--radius-sm);margin-bottom:6px;">
        <div>
          <div style="font-weight:600;font-size:13px;">${d.nombre}</div>
          ${d.responsable ? `<div style="font-size:11px;color:var(--text3);">Jefe: ${d.responsable}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;">
          <button class="action-btn" data-action="editar-dep" data-id="${d.id}">✏️</button>
          <button class="action-btn del" data-action="eliminar-dep" data-id="${d.id}">🗑️</button>
        </div>
      </div>`).join('')
    : `<div class="empty"><p>Sin resultados</p></div>`;

  } else if (_tabActual === 'ofs') {
    const items = DB.oficinas.filter(o => {
      const dep = DB.dependencias.find(d => d.id === o.depId);
      return !q || o.nombre.toLowerCase().includes(q) ||
        (dep?.nombre||'').toLowerCase().includes(q);
    });
    container.innerHTML = items.length ? items.map(o => {
      const dep = DB.dependencias.find(d => d.id === o.depId);
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:10px 12px;background:var(--card);border:1px solid var(--border);
          border-radius:var(--radius-sm);margin-bottom:6px;">
          <div>
            <div style="font-weight:600;font-size:13px;">${o.nombre}</div>
            <div style="font-size:11px;color:var(--text3);">${dep?.nombre || '—'}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="action-btn" data-action="editar-of" data-id="${o.id}">✏️</button>
            <button class="action-btn del" data-action="eliminar-of" data-id="${o.id}">🗑️</button>
          </div>
        </div>`;
    }).join('')
    : `<div class="empty"><p>Sin resultados</p></div>`;

  } else if (_tabActual === 'personas') {
    const items = DB.personas.filter(p =>
      !q || p.nombre.toLowerCase().includes(q) ||
      (p.cargo||'').toLowerCase().includes(q) ||
      (p.correo||'').toLowerCase().includes(q)
    );
    container.innerHTML = items.length ? items.map(p => `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:10px 12px;background:var(--card);border:1px solid var(--border);
        border-radius:var(--radius-sm);margin-bottom:6px;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;">${p.nombre}</div>
          <div style="font-size:11px;color:var(--text3);">
            ${p.cargo || '—'}${p.correo ? ' · ' + p.correo : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="action-btn" data-action="editar-persona" data-id="${p.id}">✏️</button>
          <button class="action-btn del" data-action="eliminar-persona" data-id="${p.id}">🗑️</button>
        </div>
      </div>`).join('')
    : `<div class="empty"><p>Sin resultados</p></div>`;
  }

  _bindAcciones();
}

function _bindEvents() {
  // Tabs
  document.querySelectorAll('.filter-tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _tabActual = btn.dataset.tab;
      document.getElementById('admin-buscar').value = '';
      _renderContenido();
    });
  });

  // Buscador
  document.getElementById('admin-buscar')?.addEventListener('input', e => {
    _renderContenido(e.target.value);
  });

  // Botón nuevo
  document.getElementById('btn-admin-nuevo')?.addEventListener('click', () => {
    if (_tabActual === 'deps') {
      document.getElementById('dep-title').textContent = 'Nueva Dependencia';
      document.getElementById('dep-edit-id').value = '';
      document.getElementById('dep-nombre').value  = '';
      llenarSSPersonas('dep-responsable-ss');
      abrirModal('modal-dep');
    } else if (_tabActual === 'ofs') {
      document.getElementById('of-title').textContent = 'Nueva Oficina';
      document.getElementById('of-edit-id').value = '';
      document.getElementById('of-nombre').value  = '';
      abrirModal('modal-of');
    } else if (_tabActual === 'personas') {
      document.getElementById('persona-title').textContent = 'Nuevo Funcionario';
      document.getElementById('persona-edit-id').value = '';
      ['persona-nombre','persona-cargo','persona-correo','persona-tel']
        .forEach(id => { document.getElementById(id).value = ''; });
      abrirModal('modal-persona-admin');
    }
  });

  // Guardar dependencia
  document.getElementById('dep-save-btn')?.addEventListener('click', () => {
      const nombre         = document.getElementById('dep-nombre').value.trim();
      const responsableId  = getSSValue('dep-responsable-ss');
      const DB2            = getDBStatic();
      const jefe           = DB2.personas.find(x => x.id === responsableId);
      const responsable    = jefe?.nombre || '';
      const editId         = document.getElementById('dep-edit-id').value;
    if (!nombre) { showToast('El nombre es obligatorio','#d97706'); return; }
    const DB = getDBStatic();
    if (editId) {
      const dep = DB.dependencias.find(d => d.id === editId);
      if (dep) { dep.nombre = nombre; dep.responsable = responsable; }
      apiPost('Dependencias','update',{ Nombre:nombre, Responsable:responsable, ResponsableID:responsableId },'ID',editId).catch(console.warn);
      showToast('Dependencia actualizada');
    } else {
      const id = 'DEP' + Date.now();
      DB.dependencias.push({ id, nombre, responsable, responsableId });
      saveKey('DB_STATIC');
      apiPost('Dependencias','insert',{ ID:id, Nombre:nombre, Responsable:responsable, ResponsableID:responsableId }).catch(console.warn);
      showToast('Dependencia registrada');
    }
    cerrarModal('modal-dep');
    _renderContenido();
  });

  // Guardar oficina
  document.getElementById('of-save-btn')?.addEventListener('click', () => {
    const nombre = document.getElementById('of-nombre').value.trim();
    const depId  = document.getElementById('of-dep').value;
    const editId = document.getElementById('of-edit-id').value;
    if (!nombre || !depId) { showToast('Nombre y dependencia son obligatorios','#d97706'); return; }
    const DB = getDBStatic();
    if (editId) {
      const of = DB.oficinas.find(o => o.id === editId);
      if (of) { of.nombre = nombre; of.depId = depId; }
      apiPost('Oficinas','update',{ Nombre:nombre, DepID:depId },'ID',editId).catch(console.warn);
      showToast('Oficina actualizada');
    } else {
      const id = 'OF' + Date.now();
      DB.oficinas.push({ id, nombre, depId });
      saveKey('DB_STATIC'); // ← AGREGA
      apiPost('Oficinas','insert',{ ID:id, Nombre:nombre, DepID:depId }).catch(console.warn);
      showToast('Oficina registrada');
    }
    cerrarModal('modal-of');
    _renderContenido();
  });

  // Guardar persona
  document.getElementById('persona-save-btn')?.addEventListener('click', () => {
    const nombre  = document.getElementById('persona-nombre').value.trim();
    const cargo   = document.getElementById('persona-cargo').value;
    const correo  = document.getElementById('persona-correo').value;
    const tel     = document.getElementById('persona-tel').value;
    const editId  = document.getElementById('persona-edit-id').value;
    if (!nombre) { showToast('El nombre es obligatorio','#d97706'); return; }
    const DB = getDBStatic();
    if (editId) {
      const p = DB.personas.find(x => x.id === editId);
      if (p) { p.nombre = nombre; p.cargo = cargo; p.correo = correo; p.tel = tel; }
      apiPost('Personas','update',{ Nombre:nombre, Cargo:cargo, Correo:correo, Telefono:tel },'ID',editId).catch(console.warn);
      showToast('Funcionario actualizado');
    } else {
      const id = 'P' + Date.now();
      DB.personas.push({ id, nombre, cargo, correo, tel, imagen:'' });
      saveKey('DB_STATIC');
      apiPost('Personas','insert',{ ID:id, Nombre:nombre, Cargo:cargo, Correo:correo, Telefono:tel }).catch(console.warn);
      showToast('Funcionario registrado');
    }
    cerrarModal('modal-persona-admin');
    _renderContenido();
  });
}

function _bindAcciones() {
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset;
      const DB = getDBStatic();

      if (action === 'editar-dep') {
        const dep = DB.dependencias.find(d => d.id === id);
        if (!dep) return;
        document.getElementById('dep-title').textContent = 'Editar Dependencia';
        document.getElementById('dep-edit-id').value     = id;
        document.getElementById('dep-nombre').value      = dep.nombre;
        llenarSSPersonas('dep-responsable-ss');
        if (dep.responsableId) {
          const jefe = DB.personas.find(x => x.id === dep.responsableId);
          if (jefe) setSSValue('dep-responsable-ss', jefe.id, jefe.nombre);
        }
        abrirModal('modal-dep');
      }

      if (action === 'eliminar-dep') {
        showConfirm({
          icon: '🗑️',
          title: '¿Eliminar dependencia?',
          msg: 'Esta acción no se puede deshacer.',
          okLabel: 'Eliminar',
          onOk: () => {
            DB.dependencias = DB.dependencias.filter(d => d.id !== id);
            apiPost('Dependencias','delete',{},'ID',id).catch(console.warn);
            showToast('Eliminada');
            _renderContenido();
          }
        });
      }

      if (action === 'editar-of') {
        const of = DB.oficinas.find(o => o.id === id);
        if (!of) return;
        document.getElementById('of-title').textContent = 'Editar Oficina';
        document.getElementById('of-edit-id').value     = id;
        document.getElementById('of-nombre').value      = of.nombre;
        document.getElementById('of-dep').value         = of.depId;
        abrirModal('modal-of');
      }

      if (action === 'eliminar-of') {
        showConfirm({
          icon: '🗑️',
          title: '¿Eliminar oficina?',
          msg: 'Esta acción no se puede deshacer.',
          okLabel: 'Eliminar',
          onOk: () => {
            DB.oficinas = DB.oficinas.filter(o => o.id !== id);
            apiPost('Oficinas','delete',{},'ID',id).catch(console.warn);
            showToast('Eliminada');
            _renderContenido();
          }
        });
      }

      if (action === 'editar-persona') {
        const p = DB.personas.find(x => x.id === id);
        if (!p) return;
        document.getElementById('persona-title').textContent = 'Editar Funcionario';
        document.getElementById('persona-edit-id').value     = id;
        document.getElementById('persona-nombre').value      = p.nombre;
        document.getElementById('persona-cargo').value       = p.cargo || '';
        document.getElementById('persona-correo').value      = p.correo || '';
        document.getElementById('persona-tel').value         = p.tel || '';
        abrirModal('modal-persona-admin');
      }

      if (action === 'eliminar-persona') {
        showConfirm({
          icon: '🗑️',
          title: '¿Eliminar funcionario?',
          msg: 'Esta acción no se puede deshacer.',
          okLabel: 'Eliminar',
          onOk: () => {
            DB.personas = DB.personas.filter(x => x.id !== id);
            apiPost('Personas','delete',{},'ID',id).catch(console.warn);
            showToast('Eliminado');
            _renderContenido();
          }
        });
      }
    });
  });
}