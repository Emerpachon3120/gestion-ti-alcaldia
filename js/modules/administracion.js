import { getData, getDBStatic, setState } from '../state.js';
import { apiPost }     from '../api.js';
import { showToast }   from '../ui/toast.js';
import { abrirModal, cerrarModal } from '../ui/modal.js';

export function render() {
  const DB = getDBStatic();
  return `
    <div class="page">
      <div class="section-title">⚙️ Administración</div>
      <div class="section-sub">Gestión de dependencias, oficinas y personas</div>

      <!-- DEPENDENCIAS -->
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;">🏛️ Dependencias (${DB.dependencias.length})</div>
          <button class="btn btn-primary" style="margin:0;padding:6px 12px;font-size:12px;width:auto;"
            id="btn-nueva-dep">+ Nueva</button>
        </div>
        <div id="lista-deps">
          ${DB.dependencias.map(d => `
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
              <div>
                <div style="font-weight:600;">${d.nombre}</div>
                <div style="font-size:11px;color:var(--text3);">ID: ${d.id}</div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="action-btn" data-action="editar-dep" data-id="${d.id}">✏️</button>
                <button class="action-btn del" data-action="eliminar-dep" data-id="${d.id}">🗑️</button>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- OFICINAS -->
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;">🏢 Oficinas (${DB.oficinas.length})</div>
          <button class="btn btn-primary" style="margin:0;padding:6px 12px;font-size:12px;width:auto;"
            id="btn-nueva-of">+ Nueva</button>
        </div>
        <div id="lista-ofs">
          ${DB.oficinas.map(o => {
            const dep = DB.dependencias.find(d => d.id === o.depId);
            return `
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
              <div>
                <div style="font-weight:600;">${o.nombre}</div>
                <div style="font-size:11px;color:var(--text3);">
                  ${dep?.nombre || '—'} · ID: ${o.id}
                </div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="action-btn" data-action="editar-of" data-id="${o.id}">✏️</button>
                <button class="action-btn del" data-action="eliminar-of" data-id="${o.id}">🗑️</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- PERSONAS -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;">👤 Funcionarios (${DB.personas.length})</div>
          <button class="btn btn-primary" style="margin:0;padding:6px 12px;font-size:12px;width:auto;"
            id="btn-nueva-persona">+ Nuevo</button>
        </div>
        <div id="lista-personas">
          ${DB.personas.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
              <div>
                <div style="font-weight:600;">${p.nombre}</div>
                <div style="font-size:11px;color:var(--text3);">${p.cargo || '—'}</div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="action-btn" data-action="editar-persona" data-id="${p.id}">✏️</button>
                <button class="action-btn del" data-action="eliminar-persona" data-id="${p.id}">🗑️</button>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- MODAL DEPENDENCIA -->
    <div class="modal-overlay" id="modal-dep">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="dep-title">🏛️ Nueva Dependencia</div>
        <input type="hidden" id="dep-edit-id">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="dep-nombre"
            placeholder="Ej: Secretaría de Hacienda">
        </div>
        <div class="form-group">
          <label class="form-label">Responsable</label>
          <input type="text" class="form-input" id="dep-responsable"
            placeholder="Nombre del jefe de dependencia">
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;"
            onclick="cerrarModal('modal-dep')">Cancelar</button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;"
            id="dep-save-btn">💾 Guardar</button>
        </div>
      </div>
    </div>

    <!-- MODAL OFICINA -->
    <div class="modal-overlay" id="modal-of">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="of-title">🏢 Nueva Oficina</div>
        <input type="hidden" id="of-edit-id">
        <div class="form-group">
          <label class="form-label">Nombre *</label>
          <input type="text" class="form-input" id="of-nombre"
            placeholder="Ej: Tesorería">
        </div>
        <div class="form-group">
          <label class="form-label">Dependencia *</label>
          <select class="form-select" id="of-dep">
            ${DB.dependencias.map(d =>
              `<option value="${d.id}">${d.nombre}</option>`
            ).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;"
            onclick="cerrarModal('modal-of')">Cancelar</button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;"
            id="of-save-btn">💾 Guardar</button>
        </div>
      </div>
    </div>

    <!-- MODAL PERSONA -->
    <div class="modal-overlay" id="modal-persona-admin">
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-title" id="persona-title">👤 Nuevo Funcionario</div>
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
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;"
            onclick="cerrarModal('modal-persona-admin')">Cancelar</button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;"
            id="persona-save-btn">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

export function onEnter() {
  _bindEvents();
}

function _bindEvents() {
  // Nueva dependencia
  document.getElementById('btn-nueva-dep')?.addEventListener('click', () => {
    document.getElementById('dep-title').textContent = '🏛️ Nueva Dependencia';
    document.getElementById('dep-edit-id').value = '';
    document.getElementById('dep-nombre').value  = '';
    document.getElementById('dep-responsable').value = '';
    abrirModal('modal-dep');
  });

  // Nueva oficina
  document.getElementById('btn-nueva-of')?.addEventListener('click', () => {
    document.getElementById('of-title').textContent = '🏢 Nueva Oficina';
    document.getElementById('of-edit-id').value = '';
    document.getElementById('of-nombre').value  = '';
    abrirModal('modal-of');
  });

  // Nuevo funcionario
  document.getElementById('btn-nueva-persona')?.addEventListener('click', () => {
    document.getElementById('persona-title').textContent = '👤 Nuevo Funcionario';
    document.getElementById('persona-edit-id').value = '';
    ['persona-nombre','persona-cargo','persona-correo','persona-tel']
      .forEach(id => { document.getElementById(id).value = ''; });
    abrirModal('modal-persona-admin');
  });

  // Guardar dependencia
  document.getElementById('dep-save-btn')?.addEventListener('click', () => {
    const nombre      = document.getElementById('dep-nombre').value.trim();
    const responsable = document.getElementById('dep-responsable').value.trim();
    const editId      = document.getElementById('dep-edit-id').value;
    if (!nombre) { showToast('⚠️ El nombre es obligatorio','#d97706'); return; }
    const DB = getDBStatic();
    if (editId) {
      const dep = DB.dependencias.find(d => d.id === editId);
      if (dep) { dep.nombre = nombre; dep.responsable = responsable; }
      apiPost('Dependencias','update',{ Nombre:nombre, Responsable:responsable },'ID',editId).catch(console.warn);
      showToast('✅ Dependencia actualizada');
    } else {
      const id = 'DEP' + Date.now();
      DB.dependencias.push({ id, nombre, responsable });
      apiPost('Dependencias','insert',{ ID:id, Nombre:nombre, Responsable:responsable }).catch(console.warn);
      showToast('✅ Dependencia registrada');
    }
    cerrarModal('modal-dep');
    _recargar();
  });

  // Guardar oficina
  document.getElementById('of-save-btn')?.addEventListener('click', () => {
    const nombre = document.getElementById('of-nombre').value.trim();
    const depId  = document.getElementById('of-dep').value;
    const editId = document.getElementById('of-edit-id').value;
    if (!nombre || !depId) { showToast('⚠️ Nombre y dependencia son obligatorios','#d97706'); return; }
    const DB = getDBStatic();
    if (editId) {
      const of = DB.oficinas.find(o => o.id === editId);
      if (of) { of.nombre = nombre; of.depId = depId; }
      apiPost('Oficinas','update',{ Nombre:nombre, DepID:depId },'ID',editId).catch(console.warn);
      showToast('✅ Oficina actualizada');
    } else {
      const id = 'OF' + Date.now();
      DB.oficinas.push({ id, nombre, depId });
      apiPost('Oficinas','insert',{ ID:id, Nombre:nombre, DepID:depId }).catch(console.warn);
      showToast('✅ Oficina registrada');
    }
    cerrarModal('modal-of');
    _recargar();
  });

  // Guardar persona
  document.getElementById('persona-save-btn')?.addEventListener('click', () => {
    const nombre  = document.getElementById('persona-nombre').value.trim();
    const cargo   = document.getElementById('persona-cargo').value;
    const correo  = document.getElementById('persona-correo').value;
    const tel     = document.getElementById('persona-tel').value;
    const editId  = document.getElementById('persona-edit-id').value;
    if (!nombre) { showToast('⚠️ El nombre es obligatorio','#d97706'); return; }
    const DB = getDBStatic();
    if (editId) {
      const p = DB.personas.find(x => x.id === editId);
      if (p) { p.nombre = nombre; p.cargo = cargo; p.correo = correo; }
      apiPost('Personas','update',{ Nombre:nombre, Cargo:cargo, Correo:correo, Telefono:tel },'ID',editId).catch(console.warn);
      showToast('✅ Funcionario actualizado');
    } else {
      const id = 'P' + Date.now();
      DB.personas.push({ id, nombre, cargo, correo, imagen:'' });
      apiPost('Personas','insert',{ ID:id, Nombre:nombre, Cargo:cargo, Correo:correo, Telefono:tel }).catch(console.warn);
      showToast('✅ Funcionario registrado');
    }
    cerrarModal('modal-persona-admin');
    _recargar();
  });

  // Acciones de lista
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset;
      const DB = getDBStatic();

      if (action === 'editar-dep') {
        const dep = DB.dependencias.find(d => d.id === id);
        if (!dep) return;
        document.getElementById('dep-title').textContent = '✏️ Editar Dependencia';
        document.getElementById('dep-edit-id').value     = id;
        document.getElementById('dep-nombre').value      = dep.nombre;
        document.getElementById('dep-responsable').value = dep.responsable || '';
        abrirModal('modal-dep');
      }

      if (action === 'eliminar-dep') {
        if (!confirm('¿Eliminar esta dependencia?')) return;
        const DB = getDBStatic();
        DB.dependencias = DB.dependencias.filter(d => d.id !== id);
        apiPost('Dependencias','delete',{},'ID',id).catch(console.warn);
        showToast('🗑️ Eliminada');
        _recargar();
      }

      if (action === 'editar-of') {
        const of = DB.oficinas.find(o => o.id === id);
        if (!of) return;
        document.getElementById('of-title').textContent = '✏️ Editar Oficina';
        document.getElementById('of-edit-id').value     = id;
        document.getElementById('of-nombre').value      = of.nombre;
        document.getElementById('of-dep').value         = of.depId;
        abrirModal('modal-of');
      }

      if (action === 'eliminar-of') {
        if (!confirm('¿Eliminar esta oficina?')) return;
        DB.oficinas = DB.oficinas.filter(o => o.id !== id);
        apiPost('Oficinas','delete',{},'ID',id).catch(console.warn);
        showToast('🗑️ Eliminada');
        _recargar();
      }

      if (action === 'editar-persona') {
        const p = DB.personas.find(x => x.id === id);
        if (!p) return;
        document.getElementById('persona-title').textContent = '✏️ Editar Funcionario';
        document.getElementById('persona-edit-id').value     = id;
        document.getElementById('persona-nombre').value      = p.nombre;
        document.getElementById('persona-cargo').value       = p.cargo || '';
        document.getElementById('persona-correo').value      = p.correo || '';
        document.getElementById('persona-tel').value         = p.tel || '';
        abrirModal('modal-persona-admin');
      }

      if (action === 'eliminar-persona') {
        if (!confirm('¿Eliminar este funcionario?')) return;
        DB.personas = DB.personas.filter(x => x.id !== id);
        apiPost('Personas','delete',{},'ID',id).catch(console.warn);
        showToast('🗑️ Eliminado');
        _recargar();
      }
    });
  });
}

function _recargar() {
  import('../router.js').then(({ navigate }) => navigate('administracion'));
}