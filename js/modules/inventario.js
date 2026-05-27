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

      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-secondary" style="flex:1;margin-top:0;" id="eq-cancel-btn">
          Cancelar
        </button>
        <button class="btn btn-primary" style="flex:2;margin-top:0;" id="eq-save-btn">
          💻 Guardar equipo
        </button>
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
  document.getElementById('eq-title').textContent     = '💻 Nuevo Equipo';
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