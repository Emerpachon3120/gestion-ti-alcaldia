import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }     from '../storage.js';
import { apiPost }     from '../api.js';
import { showToast }   from '../ui/toast.js';
import { abrirModal, cerrarModal } from '../ui/modal.js';
import { formatDate, parseFecha, calcSemaforo } from '../utils.js';
import { llenarSSOficinas, llenarSSPersonas, getSSValue, setSSValue } from '../ui/searchselect.js';
import { abrirDocViewer } from '../ui/documento.js';

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
  _bindModalEvents();
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
      if (action === 'historial') _verFichaEquipo(serial);
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

      <!-- SECCIÓN 1: IDENTIFICACIÓN -->
      <div style="font-size:11px;font-weight:700;color:var(--accent);
        text-transform:uppercase;letter-spacing:.5px;
        margin:8px 0 10px;padding-bottom:4px;
        border-bottom:2px solid var(--accent-bg);">
        📋 Identificación
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Serial *</label>
          <input class="form-input" id="eq-serial"
            placeholder="Ej: YJ01RNPG"
            style="font-family:var(--font-mono);text-transform:uppercase;">
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de equipo *</label>
          <select class="form-select" id="eq-tipo" onchange="window._toggleComponentes()">
            <option value="Portatil">💻 Portátil</option>
            <option value="Desktop">🖥️ Desktop (Torre)</option>
            <option value="TodoEnUno">🖥️ Todo en uno</option>
            <option value="Tablet">📱 Tablet</option>
            <option value="Impresora">🖨️ Impresora</option>
            <option value="Otro">📦 Otro</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-select" id="eq-estado">
            <option>Operativo</option>
            <option>Con fallas</option>
            <option>En mantenimiento</option>
            <option>Dado de baja</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Oficina *</label>
          <div id="eq-oficina-ss"></div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Usuario asignado</label>
        <div id="eq-usuario-ss"></div>
      </div>

      <!-- SECCIÓN 2: ESPECIFICACIONES -->
      <div style="font-size:11px;font-weight:700;color:var(--accent);
        text-transform:uppercase;letter-spacing:.5px;
        margin:12px 0 10px;padding-bottom:4px;
        border-bottom:2px solid var(--accent-bg);">
        ⚙️ Especificaciones técnicas
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Marca</label>
          <select class="form-select" id="eq-marca">
            <option value="">Seleccionar...</option>
            <option>HP</option><option>Lenovo</option><option>Dell</option>
            <option>Asus</option><option>Acer</option><option>Apple</option>
            <option>Samsung</option><option>Toshiba</option><option>MSI</option>
            <option>Huawei</option><option>LG</option><option>otro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Modelo</label>
          <input class="form-input" id="eq-modelo" placeholder="Ej: ProBook 450 G8">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Sistema Operativo</label>
        <select class="form-select" id="eq-so">
          <option value="">Seleccionar...</option>
          <option>Windows 11 Pro</option>
          <option>Windows 11 Home</option>
          <option>Windows 10 Pro</option>
          <option>Windows 10 Home</option>
          <option>Windows 8.1</option>
          <option>Windows 7</option>
          <option>macOS Sonoma</option>
          <option>macOS Ventura</option>
          <option>Ubuntu 22.04</option>
          <option>Linux Mint</option>
          <option>Sin sistema operativo</option>
          <option>Otro</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Office / Suite ofimática</label>
        <select class="form-select" id="eq-office">
          <option value="">Ninguno</option>
          <option>Microsoft Office 365</option>
          <option>Microsoft Office 2021</option>
          <option>Microsoft Office 2019</option>
          <option>Microsoft Office 2016</option>
          <option>LibreOffice</option>
          <option>Google Workspace</option>
          <option>Otro</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Procesador</label>
        <select class="form-select" id="eq-procesador">
          <option value="">Seleccionar...</option>
          <optgroup label="Intel Core i3">
            <option>Intel Core i3-10100</option>
            <option>Intel Core i3-12100</option>
            <option>Intel Core i3-1215U</option>
          </optgroup>
          <optgroup label="Intel Core i5">
            <option>Intel Core i5-10400</option>
            <option>Intel Core i5-1135G7</option>
            <option>Intel Core i5-1235U</option>
            <option>Intel Core i5-12400</option>
            <option>Intel Core i5-13400</option>
          </optgroup>
          <optgroup label="Intel Core i7">
            <option>Intel Core i7-10700</option>
            <option>Intel Core i7-1165G7</option>
            <option>Intel Core i7-1255U</option>
            <option>Intel Core i7-12700</option>
          </optgroup>
          <optgroup label="Intel Celeron/Pentium">
            <option>Intel Celeron N4020</option>
            <option>Intel Celeron N4120</option>
            <option>Intel Pentium Gold</option>
          </optgroup>
          <optgroup label="AMD">
            <option>AMD Ryzen 3 3200G</option>
            <option>AMD Ryzen 5 5500U</option>
            <option>AMD Ryzen 5 5600G</option>
            <option>AMD Ryzen 7 5700U</option>
          </optgroup>
          <option value="otro">Otro (especificar en obs.)</option>
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">RAM</label>
          <select class="form-select" id="eq-ram">
            <option value="">Seleccionar...</option>
            <option>2 GB</option><option>4 GB</option>
            <option>6 GB</option><option>8 GB</option>
            <option>12 GB</option><option>16 GB</option>
            <option>32 GB</option><option>64 GB</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de disco</label>
          <select class="form-select" id="eq-disco">
            <option value="">Seleccionar...</option>
            <option>HDD — Mecánico</option>
            <option>SSD — SATA</option>
            <option>SSD — NVMe M.2</option>
            <option>SSD + HDD</option>
            <option>eMMC</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Capacidad de almacenamiento</label>
        <select class="form-select" id="eq-cap">
          <option value="">Seleccionar...</option>
          <option>120 GB</option><option>240 GB</option>
          <option>256 GB</option><option>480 GB</option>
          <option>500 GB</option><option>512 GB</option>
          <option>1 TB</option><option>2 TB</option>
          <option>120 GB + 1 TB</option>
          <option>256 GB + 1 TB</option>
          <option>512 GB + 1 TB</option>
        </select>
      </div>

      <!-- SECCIÓN 3: COMPONENTES -->
      <div style="font-size:11px;font-weight:700;color:var(--accent);
        text-transform:uppercase;letter-spacing:.5px;
        margin:12px 0 10px;padding-bottom:4px;
        border-bottom:2px solid var(--accent-bg);">
        🖱️ Componentes / Periféricos
      </div>

      <div id="eq-componentes-wrap">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="comp-monitor" onchange="window._toggleFotoComp('monitor',this.checked)"> 🖥️ Monitor/Pantalla
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="comp-teclado" onchange="window._toggleFotoComp('teclado',this.checked)"> ⌨️ Teclado
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="comp-mouse" onchange="window._toggleFotoComp('mouse',this.checked)"> 🖱️ Mouse
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="comp-cpu" onchange="window._toggleFotoComp('cpu',this.checked)"> 🖥️ CPU/Torre
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="comp-impresora" onchange="window._toggleFotoComp('impresora',this.checked)"> 🖨️ Impresora
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="comp-ups" onchange="window._toggleFotoComp('ups',this.checked)"> 🔋 UPS/Regulador
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="comp-scanner" onchange="window._toggleFotoComp('scanner',this.checked)"> 📄 Scanner
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="comp-diadema" onchange="window._toggleFotoComp('diadema',this.checked)"> 🎧 Diadema/Cámara
          </label>
        </div>

        <!-- Fotos por componente — aparecen al marcar el checkbox -->
        ${['monitor','teclado','mouse','cpu','impresora','ups','scanner','diadema'].map(c => `
          <div id="foto-wrap-${c}" style="display:none;margin-bottom:10px;">
            <label class="form-label">📸 Foto — ${_nombreComp(c)}</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
              <button type="button" style="padding:8px;border:2px dashed var(--accent);
                border-radius:var(--radius-sm);background:var(--accent-bg);
                color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;"
                onclick="document.getElementById('foto-camara-${c}').click()">
                📷 Tomar foto
              </button>
              <button type="button" style="padding:8px;border:2px dashed var(--border);
                border-radius:var(--radius-sm);background:var(--bg2);
                color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;"
                onclick="document.getElementById('foto-galeria-${c}').click()">
                🖼️ Galería
              </button>
            </div>
            <input type="file" id="foto-camara-${c}" accept="image/*" capture="environment">
            <input type="file" id="foto-galeria-${c}" accept="image/*" multiple>
            <div class="foto-grid" id="foto-preview-${c}"></div>
          </div>
        `).join('')}
      </div>

      <!-- SECCIÓN 4: ADQUISICIÓN -->
      <div style="font-size:11px;font-weight:700;color:var(--accent);
        text-transform:uppercase;letter-spacing:.5px;
        margin:12px 0 10px;padding-bottom:4px;
        border-bottom:2px solid var(--accent-bg);">
        📅 Adquisición y garantía
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Fecha de compra</label>
          <input type="date" class="form-input" id="eq-fecha-compra">
        </div>
        <div class="form-group">
          <label class="form-label">Garantía hasta</label>
          <input type="date" class="form-input" id="eq-garantia">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Ubicación física</label>
        <input class="form-input" id="eq-ubicacion"
          placeholder="Ej: Escritorio 3, Sala de reuniones">
      </div>

      <div class="form-group">
        <label class="form-label">Observaciones</label>
        <textarea class="form-textarea" id="eq-obs"
          placeholder="Condiciones especiales, daños visibles, accesorios adicionales...">
        </textarea>
      </div>

      <div class="modal-footer">
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;" id="eq-cancel-btn">
            Cancelar
          </button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;" id="eq-save-btn">
            💻 Guardar equipo
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

// Nombre legible del componente
function _nombreComp(c) {
  const nombres = {
    monitor:'Monitor/Pantalla', teclado:'Teclado', mouse:'Mouse',
    cpu:'CPU/Torre', impresora:'Impresora', ups:'UPS/Regulador',
    scanner:'Scanner', diadema:'Diadema/Cámara'
  };
  return nombres[c] || c;
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

export function abrirNuevo() {

  if (!document.getElementById('modal-equipo')) {
    document.getElementById('modals-container')
      .insertAdjacentHTML('beforeend', _modalHTML());
    _bindModalEvents();
  }

  document.getElementById('eq-title').textContent = '💻 Nuevo Equipo';
  document.getElementById('eq-edit-serial').value     = '';
  document.getElementById('eq-serial').value          = '';
  document.getElementById('eq-serial').disabled       = false;
  document.getElementById('eq-estado').value          = 'Operativo';
  document.getElementById('eq-tipo')?.value && (document.getElementById('eq-tipo').value = 'Portatil');

  // Limpiar campos
  ['eq-marca','eq-modelo','eq-so','eq-ram','eq-cap',
   'eq-procesador','eq-obs','eq-ubicacion','eq-office'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['eq-fecha-compra','eq-garantia'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Reset componentes y fotos
  _COMPS.forEach(c => {
    _fotosComp[c] = [];
    const chk  = document.getElementById(`comp-${c}`);
    const wrap = document.getElementById(`foto-wrap-${c}`);
    const prev = document.getElementById(`foto-preview-${c}`);
    if (chk)  chk.checked = false;
    if (wrap) wrap.style.display = 'none';
    if (prev) prev.innerHTML = '';
  });

  llenarSSOficinas('eq-oficina-ss', ()=>{}, _crearOficinaRapida);
  llenarSSPersonas('eq-usuario-ss', ()=>{}, _crearFuncionarioRapido);
  abrirModal('modal-equipo');
}

function _bindModalEvents() {
  document.getElementById('eq-cancel-btn')?.addEventListener('click', () => cerrarModal('modal-equipo'));
  document.getElementById('eq-save-btn')?.addEventListener('click', _guardar);
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
  llenarSSOficinas('eq-oficina-ss', ()=>{}, _crearOficinaRapida);
  llenarSSPersonas('eq-usuario-ss', ()=>{}, _crearFuncionarioRapido);
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
  const fields     = {
    marca: 'eq-marca', modelo: 'eq-modelo', so: 'eq-so',
    ram: 'eq-ram', cap: 'eq-cap', procesador: 'eq-procesador', obs: 'eq-obs'
  };
  const vals = {};
  Object.entries(fields).forEach(([k, id]) => { vals[k] = document.getElementById(id)?.value || ''; });
  vals.estado       = document.getElementById('eq-estado').value;
  vals.disco        = document.getElementById('eq-disco').value;
  vals.fechaCompra  = document.getElementById('eq-fecha-compra')?.value || '';
  vals.garantia     = document.getElementById('eq-garantia')?.value || '';
  vals.ubicacion    = document.getElementById('eq-ubicacion')?.value || '';
  vals.tipoEquipo   = document.getElementById('eq-tipo')?.value || '';

  if (!serial || !oficina) { showToast('⚠️ Serial y oficina son obligatorios', '#d97706'); return; }

  // Fotos por componente
  const fotosComponentes = _getFotosEquipo();
  const fotosStr = JSON.stringify(fotosComponentes);

  // Componentes marcados
  const componentesMarcados = _COMPS.filter(c =>
    document.getElementById(`comp-${c}`)?.checked
  );

  const lista = [...getData('equipos')];

  if (editSerial) {
    const idx = lista.findIndex(x => x.serial === editSerial);
    if (idx >= 0) lista[idx] = {
      ...lista[idx], ...vals, oficina, usuarioId,
      fotosComponentes, componentes: componentesMarcados
    };
    apiPost('Equipos', 'update', {
      OficinaID:    oficina,
      UsuarioID:    usuarioId,
      SO:           vals.so,
      RAM:          vals.ram,
      Disco:        vals.disco,
      Capacidad:    vals.cap,
      Marca:        vals.marca,
      Modelo:       vals.modelo,
      Procesador:   vals.procesador,
      Estado:       vals.estado,
      Observaciones:vals.obs,
      Fecha_Compra: vals.fechaCompra,
      Garantia:     vals.garantia,
      Ubicacion:    vals.ubicacion,
      Tipo_Equipo:  vals.tipoEquipo,
      Componentes:  componentesMarcados.join(','),
      Fotos_Componentes: fotosStr,
    }, 'Serial', editSerial).catch(console.warn);
    showToast('✅ Equipo actualizado');
  } else {
    if (lista.find(x => x.serial === serial)) {
      showToast('⚠️ Ya existe ese serial', '#d97706'); return;
    }
    lista.push({
      serial, oficina, usuarioId, ...vals,
      fotosComponentes, componentes: componentesMarcados, fotos: []
    });
    apiPost('Equipos', 'insert', {
      Serial:       serial,
      OficinaID:    oficina,
      UsuarioID:    usuarioId,
      SO:           vals.so,
      RAM:          vals.ram,
      Disco:        vals.disco,
      Capacidad:    vals.cap,
      Marca:        vals.marca,
      Modelo:       vals.modelo,
      Procesador:   vals.procesador,
      Estado:       vals.estado,
      Observaciones:vals.obs,
      Imagen_Base64:'',
      Fecha_Compra: vals.fechaCompra,
      Garantia:     vals.garantia,
      Ubicacion:    vals.ubicacion,
      Tipo_Equipo:  vals.tipoEquipo,
      Componentes:  componentesMarcados.join(','),
      Fotos_Componentes: fotosStr,
    }).catch(console.warn);
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

// Fotos por componente
const _fotosComp = {};
const _COMPS = ['monitor','teclado','mouse','cpu','impresora','ups','scanner','diadema'];

window._toggleComponentes = function() {
  const tipo = document.getElementById('eq-tipo')?.value;
  // Según el tipo pre-marcar componentes
  const presets = {
    Portatil:   [],
    Desktop:    ['monitor','teclado','mouse','cpu'],
    TodoEnUno:  ['teclado','mouse'],
    Tablet:     [],
    Impresora:  ['impresora'],
  };
  const preset = presets[tipo] || [];
  _COMPS.forEach(c => {
    const chk = document.getElementById(`comp-${c}`);
    if (chk) {
      chk.checked = preset.includes(c);
      window._toggleFotoComp(c, chk.checked);
    }
  });
};

window._toggleFotoComp = function(comp, mostrar) {
  const wrap = document.getElementById(`foto-wrap-${comp}`);
  if (!wrap) return;
  wrap.style.display = mostrar ? 'block' : 'none';
  if (!_fotosComp[comp]) _fotosComp[comp] = [];

  if (mostrar) {
    // Bind inputs de foto
    const camara  = document.getElementById(`foto-camara-${comp}`);
    const galeria = document.getElementById(`foto-galeria-${comp}`);
    if (camara && !camara._bound) {
      camara._bound = true;
      camara.addEventListener('change', e => {
        _procesarFotosComp(e.target.files, comp);
        e.target.value = '';
      });
    }
    if (galeria && !galeria._bound) {
      galeria._bound = true;
      galeria.addEventListener('change', e => {
        _procesarFotosComp(e.target.files, comp);
        e.target.value = '';
      });
    }
  }
};

function _procesarFotosComp(files, comp) {
  if (!_fotosComp[comp]) _fotosComp[comp] = [];
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      _fotosComp[comp].push(e.target.result);
      _renderFotosComp(comp);
    };
    reader.readAsDataURL(file);
  });
}

function _renderFotosComp(comp) {
  const grid = document.getElementById(`foto-preview-${comp}`);
  if (!grid) return;
  const arr = _fotosComp[comp] || [];
  grid.innerHTML = arr.map((src, i) => `
    <div class="foto-thumb">
      <img src="${src}" alt="foto">
      <button class="foto-del" data-comp="${comp}" data-idx="${i}">✕</button>
    </div>`).join('');
  grid.querySelectorAll('.foto-del').forEach(btn => {
    btn.addEventListener('click', () => {
      _fotosComp[btn.dataset.comp].splice(+btn.dataset.idx, 1);
      _renderFotosComp(btn.dataset.comp);
    });
  });
}

function _getFotosEquipo() {
  // Consolidar todas las fotos de componentes
  const todas = {};
  _COMPS.forEach(c => {
    if (_fotosComp[c]?.length) todas[c] = _fotosComp[c];
  });
  return todas;
}

function _crearFuncionarioRapido() {
  const modalEq = document.getElementById('modal-equipo');
  modalEq?.classList.remove('open');

  import('./administracion.js').then(mod => {
    // Asegurar que el modal de persona existe
    if (!document.getElementById('modal-persona-admin')) {
      document.getElementById('modals-container')
        .insertAdjacentHTML('beforeend', `
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
              <div class="modal-footer">
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-secondary" style="flex:1;margin-top:0;"
                    id="persona-cancel-btn">Cancelar</button>
                  <button class="btn btn-primary" style="flex:2;margin-top:0;"
                    id="persona-save-btn">👤 Guardar</button>
                </div>
              </div>
            </div>
          </div>`);

      document.getElementById('persona-cancel-btn').addEventListener('click', () => {
        document.getElementById('modal-persona-admin').classList.remove('open');
        document.body.style.overflow = '';
        modalEq?.classList.add('open');
        document.body.style.overflow = 'hidden';
      });

      document.getElementById('persona-save-btn').addEventListener('click', () => {
        const nombre = document.getElementById('persona-nombre').value.trim();
        const cargo  = document.getElementById('persona-cargo').value;
        const correo = document.getElementById('persona-correo').value;
        const tel    = document.getElementById('persona-tel').value;
        if (!nombre) { showToast('⚠️ El nombre es obligatorio', '#d97706'); return; }

        const DB = getDBStatic();
        const id = 'P' + Date.now();
        DB.personas.push({ id, nombre, cargo, correo, tel, imagen: '' });

        apiPost('Personas', 'insert', {
          ID: id, Nombre: nombre, Cargo: cargo,
          Correo: correo, Telefono: tel,
        }).catch(console.warn);

        // Seleccionar en el formulario de equipo
        llenarSSPersonas('eq-usuario-ss', () => {}, _crearFuncionarioRapido);
        setSSValue('eq-usuario-ss', id, nombre);

        document.getElementById('modal-persona-admin').classList.remove('open');
        modalEq?.classList.add('open');
        document.body.style.overflow = 'hidden';
        showToast(`👤 ${nombre} registrado`);
      });
    }

    // Limpiar y abrir
    ['persona-nombre','persona-cargo','persona-correo','persona-tel']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    document.getElementById('persona-edit-id').value = '';
    document.getElementById('modal-persona-admin').classList.add('open');
    document.body.style.overflow = 'hidden';
  });
}

function _crearOficinaRapida() {
  const modalEq = document.getElementById('modal-equipo');
  modalEq?.classList.remove('open');

  if (!document.getElementById('modal-oficina-rapida')) {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal-overlay" id="modal-oficina-rapida">
        <div class="modal">
          <div class="modal-handle"></div>
          <div class="modal-title">🏢 Nueva Oficina</div>
          <div class="form-group">
            <label class="form-label">Nombre de la oficina *</label>
            <input type="text" class="form-input" id="of-r-nombre"
              placeholder="Ej: Tesorería, Comisaría de Familia">
          </div>
          <div class="form-group">
            <label class="form-label">Dependencia *</label>
            <select class="form-select" id="of-r-dep">
              ${getDBStatic().dependencias.map(d =>
                `<option value="${d.id}">${d.nombre}</option>`
              ).join('')}
            </select>
          </div>
          <div class="modal-footer">
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary" style="flex:1;margin-top:0;"
                id="of-r-cancel">Cancelar</button>
              <button class="btn btn-primary" style="flex:2;margin-top:0;"
                id="of-r-save">🏢 Guardar oficina</button>
            </div>
          </div>
        </div>
      </div>`;
    document.getElementById('modals-container').appendChild(div.firstElementChild);

    document.getElementById('of-r-cancel').addEventListener('click', () => {
      document.getElementById('modal-oficina-rapida').classList.remove('open');
      document.body.style.overflow = '';
      modalEq?.classList.add('open');
      document.body.style.overflow = 'hidden';
    });

    document.getElementById('of-r-save').addEventListener('click', () => {
      const nombre = document.getElementById('of-r-nombre').value.trim();
      const depId  = document.getElementById('of-r-dep').value;
      if (!nombre || !depId) { showToast('⚠️ Nombre y dependencia son obligatorios','#d97706'); return; }

      const DB = getDBStatic();
      const id = 'OF' + Date.now();
      DB.oficinas.push({ id, nombre, depId });

      apiPost('Oficinas','insert',{
        ID: id, Nombre: nombre, DepID: depId,
      }).catch(console.warn);

      llenarSSOficinas('eq-oficina-ss', ()=>{}, _crearOficinaRapida);
      setSSValue('eq-oficina-ss', id, nombre);

      document.getElementById('modal-oficina-rapida').classList.remove('open');
      modalEq?.classList.add('open');
      document.body.style.overflow = 'hidden';
      showToast(`🏢 Oficina "${nombre}" registrada`);
    });
  }

  document.getElementById('of-r-nombre').value = '';
  document.getElementById('modal-oficina-rapida').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function _verFichaEquipo(serial) {
  const DB  = getDBStatic();
  const eq  = getData('equipos').find(e => e.serial === serial);
  if (!eq) return;

  const CONFIG = window.APP_CONFIG;
  const p   = DB.personas.find(x => x.id === eq.usuarioId);
  const of  = DB.oficinas.find(x => x.id === eq.oficina);
  const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;

  const mants = getData('mantenimientos')
    .filter(m => m.serial === serial)
    .sort((a,b) => (parseFecha(b.fecha)||0) - (parseFecha(a.fecha)||0));

  const bks = getData('backups')
    .filter(b => b.serial === serial)
    .sort((a,b) => (parseFecha(b.fecha)||0) - (parseFecha(a.fecha)||0));

  const fechaDoc = new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});

  // Indicadores de salud
  const ultimoMant = mants[0];
  const ultimoBk   = bks[0];
  const hoy        = new Date();

  const diasMant = ultimoMant?.fecha
    ? Math.floor((hoy - (parseFecha(ultimoMant.fecha)||hoy)) / 86400000)
    : null;
  const diasBk = ultimoBk?.fecha
    ? Math.floor((hoy - (parseFecha(ultimoBk.fecha)||hoy)) / 86400000)
    : null;

  const semColor = dias => {
    if (dias === null) return { bg:'#f3f4f6', color:'#374151', label:'Sin registro' };
    if (dias <= 90)   return { bg:'#dcfce7', color:'#166534', label:`Hace ${dias} días` };
    if (dias <= 180)  return { bg:'#fef3c7', color:'#92400e', label:`Hace ${dias} días` };
    return               { bg:'#fee2e2', color:'#991b1b', label:`Hace ${dias} días` };
  };

  const semMant = semColor(diasMant);
  const semBk   = semColor(diasBk);

  const estadoColor = {
    'Operativo':          { bg:'#dcfce7', color:'#166534' },
    'Con fallas':         { bg:'#fef3c7', color:'#92400e' },
    'En mantenimiento':   { bg:'#dbeafe', color:'#1e40af' },
    'Dado de baja':       { bg:'#fee2e2', color:'#991b1b' },
  }[eq.estado || 'Operativo'] || { bg:'#f3f4f6', color:'#374151' };

  // Línea de tiempo unificada
  const timeline = [
    ...mants.map(m => ({
      fecha: m.fecha,
      tipo: 'Mantenimiento',
      detalle: m.tipo || '—',
      responsable: m.responsable || '—',
      estado: m.estadoEquipo || '—',
      firmado: m.firmado,
      obs: m.obs || '',
    })),
    ...bks.map(b => ({
      fecha: b.fecha,
      tipo: 'Backup',
      detalle: b.tipo || '—',
      responsable: b.respTI || '—',
      estado: b.estadoBk || '—',
      firmado: b.firmado,
      obs: b.obs || '',
    })),
  ].sort((a,b) => (parseFecha(b.fecha)||0) - (parseFecha(a.fecha)||0));

  // Fotos por componente
  const fotosComp = eq.fotosComponentes || {};
  const tienesFotos = Object.values(fotosComp).some(f => f?.length > 0);

  const val = v => v && v !== '' ? v : '—';

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Ficha Técnica ${serial}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{background:#e8e8e8;font-family:Arial,sans-serif;font-size:10.5pt;color:#111;}
    .pagina{width:21.59cm;min-height:33.02cm;margin:0.8cm auto;background:#fff;
      display:flex;flex-direction:column;box-shadow:0 4px 24px rgba(0,0,0,0.18);}
    .header{width:100%;opacity:0.6;}
    .header img{width:100%;display:block;}
    .footer{margin-top:auto;width:100%;opacity:0.35;}
    .footer img{width:100%;display:block;}
    .body-wrap{flex:1;padding:0.5cm 1.8cm 0.4cm;display:flex;flex-direction:column;}
    .titulo{text-align:center;font-size:13pt;font-weight:bold;text-transform:uppercase;
      margin:0.4cm 0 0.5cm;letter-spacing:0.5px;color:#1a1a1a;
      border-bottom:2pt solid #c0392b;padding-bottom:0.2cm;}
    .sec{font-weight:bold;font-size:10.5pt;margin:0.35cm 0 0.15cm;
      color:#c0392b;border-left:3pt solid #c0392b;padding-left:0.2cm;}
    table{width:100%;border-collapse:collapse;margin-bottom:0.3cm;font-size:9.5pt;}
    td,th{padding:5px 10px;vertical-align:top;border:1px solid #ddd;text-align:left;}
    th{background:#c0392b;color:#fff;font-weight:bold;font-size:9pt;}
    tr:nth-child(even) td{background:#f7f7f7;}
    .badge{display:inline-block;padding:2px 8px;border-radius:10px;
      font-size:8.5pt;font-weight:bold;}
    .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0.3cm 0;}
    .kpi{border:1px solid #e0e0e0;border-radius:6px;padding:10px;text-align:center;}
    .kpi-label{font-size:8.5pt;color:#666;margin-bottom:4px;}
    .kpi-val{font-size:11pt;font-weight:bold;}
    .spacer{flex:1;min-height:0.3cm;}
    .fotos-comp{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:0.3cm;}
    .fotos-comp img{width:100%;height:3.5cm;object-fit:cover;
      border-radius:4px;border:1px solid #e0e0e0;}
    @media print{
      @page{size:8.5in 13in;margin:0;}
      html,body{background:#fff;width:8.5in;}
      .pagina{width:8.5in;min-height:13in;margin:0;box-shadow:none;}
      .footer{position:fixed;bottom:0;left:0;right:0;}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    }
  </style>
  </head><body>
  <div class="pagina">
    <div class="header"><img src="${CONFIG.IMG_HEADER}" alt="Encabezado"/></div>
    <div class="body-wrap">

      <div class="titulo">Ficha Técnica del Equipo</div>

      <!-- IDENTIFICACIÓN -->
      <table style="margin-bottom:0.4cm;">
        <tr style="background:#f9f9f9;">
          <td style="border:1px solid #e0e0e0;padding:5px 10px;width:50%;">
            <b style="color:#c0392b;">Serial</b><br>
            <span style="font-family:monospace;font-size:12pt;font-weight:bold;">
              ${val(serial)}
            </span>
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;">Estado</b><br>
            <span class="badge" style="background:${estadoColor.bg};color:${estadoColor.color};">
              ${val(eq.estado)}
            </span>
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;">Funcionario asignado</b><br>${val(p?.nombre)}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;">Cargo</b><br>${val(p?.cargo)}
          </td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;">Dependencia</b><br>${val(dep?.nombre)}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;">Oficina</b><br>${val(of?.nombre)}
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;">Ubicación física</b><br>${val(eq.ubicacion)}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;">Fecha de elaboración</b><br>${fechaDoc}
          </td>
        </tr>
      </table>

      <!-- INDICADORES DE SALUD -->
      <div class="sec">Indicadores de estado</div>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Estado del equipo</div>
          <div class="kpi-val">
            <span class="badge" style="background:${estadoColor.bg};color:${estadoColor.color};">
              ${val(eq.estado)}
            </span>
          </div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Último mantenimiento</div>
          <div class="kpi-val">
            <span class="badge" style="background:${semMant.bg};color:${semMant.color};">
              ${semMant.label}
            </span>
          </div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Último backup</div>
          <div class="kpi-val">
            <span class="badge" style="background:${semBk.bg};color:${semBk.color};">
              ${semBk.label}
            </span>
          </div>
        </div>
      </div>

      <!-- ESPECIFICACIONES -->
      <div class="sec">Especificaciones técnicas</div>
      <table style="margin-bottom:0.4cm;">
        <tr><th>Componente</th><th>Detalle</th><th>Componente</th><th>Detalle</th></tr>
        <tr>
          <td><b>Tipo de equipo</b></td><td>${val(eq.tipoEquipo)}</td>
          <td><b>Marca</b></td><td>${val(eq.marca)}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td><b>Modelo</b></td><td>${val(eq.modelo)}</td>
          <td><b>Sistema Operativo</b></td><td>${val(eq.so)}</td>
        </tr>
        <tr>
          <td><b>Procesador</b></td><td>${val(eq.procesador)}</td>
          <td><b>Memoria RAM</b></td><td>${val(eq.ram)}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td><b>Tipo de disco</b></td><td>${val(eq.disco)}</td>
          <td><b>Capacidad</b></td><td>${val(eq.cap)}</td>
        </tr>
        <tr>
          <td><b>Office / Suite</b></td><td>${val(eq.office)}</td>
          <td><b>Fecha de compra</b></td><td>${val(eq.fechaCompra)}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td><b>Garantia hasta</b></td><td>${val(eq.garantia)}</td>
          <td><b>Componentes</b></td>
          <td>${eq.componentes?.length
            ? eq.componentes.map(c =>
                `<span class="badge" style="background:#eff6ff;color:#1e40af;
                  margin-right:3px;">${c}</span>`
              ).join('')
            : '—'}</td>
        </tr>
      </table>

      ${eq.obs ? `
        <div class="sec">Observaciones del equipo</div>
        <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:4px;
          padding:0.2cm 0.3cm;font-size:10pt;margin-bottom:0.3cm;">
          ${eq.obs}
        </div>` : ''}

      <!-- FOTOS POR COMPONENTE -->
      ${tienesFotos ? `
        <div class="sec">Evidencia fotográfica por componente</div>
        ${Object.entries(fotosComp)
          .filter(([,fotos]) => fotos?.length > 0)
          .map(([comp, fotos]) => `
            <div style="margin-bottom:0.3cm;">
              <div style="font-weight:bold;font-size:9.5pt;margin-bottom:4px;
                text-transform:capitalize;color:#555;">
                ${comp}
              </div>
              <div class="fotos-comp">
                ${fotos.slice(0,3).map(f =>
                  `<img src="${f}" alt="${comp}">`
                ).join('')}
              </div>
            </div>`).join('')}
      ` : ''}

      <!-- LÍNEA DE TIEMPO -->
      <div class="sec">Historial del equipo (${timeline.length} registros)</div>
      ${timeline.length ? `
        <table style="margin-bottom:0.4cm;">
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Detalle</th>
            <th>Responsable</th>
            <th>Estado</th>
            <th>Firmado</th>
          </tr>
          ${timeline.map(t => `
            <tr>
              <td>${val(formatDate(t.fecha))}</td>
              <td>
                <span class="badge" style="background:${t.tipo==='Mantenimiento'?'#dbeafe':'#ede9fe'};
                  color:${t.tipo==='Mantenimiento'?'#1e40af':'#5b21b6'};">
                  ${t.tipo}
                </span>
              </td>
              <td>${val(t.detalle)}</td>
              <td>${val(t.responsable)}</td>
              <td>${val(t.estado)}</td>
              <td>${t.firmado ? 'Si' : 'No'}</td>
            </tr>
            ${t.obs ? `
              <tr>
                <td colspan="6" style="font-size:9pt;color:#555;
                  background:#fafafa;font-style:italic;padding:4px 10px;">
                  ${t.obs.length > 200 ? t.obs.slice(0,200) + '...' : t.obs}
                </td>
              </tr>` : ''}
          `).join('')}
        </table>` :
        `<p style="font-size:10pt;color:#666;margin-bottom:0.3cm;">
          Sin registros de mantenimiento ni backup.
        </p>`
      }

      <div class="spacer"></div>

    </div>
    <div class="footer"><img src="${CONFIG.IMG_FOOTER}" alt="Pie de página"/></div>
  </div>
  </body></html>`;

  abrirDocViewer(html, `Ficha Tecnica — ${serial}`);
}