import { abrirFirma as _abrirFirma }     from '../ui/firma.js';
import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }                        from '../storage.js';
import { apiPost }                        from '../api.js';
import { showToast }                      from '../ui/toast.js';
import { abrirModal, cerrarModal }        from '../ui/modal.js';
import { uid, formatDate, parseFecha, calcSemaforo, calcFechaProxima } from '../utils.js';
import { buildSearchSelect, getSSValue, setSSValue, llenarSSEquipos, llenarSSPersonas } from '../ui/searchselect.js';

let currentFilter = 'todos';
let fDesde = '', fHasta = '';
let bkFotos = [];

export function render() {
  return `
    <div class="page" id="page-backups">
      <div class="page-header">
        <div class="section-title">💾 Copias de Seguridad</div>
        <div class="section-sub">Registro con firma del funcionario</div>
      </div>
      <div class="filter-tabs">
        <button class="filter-tab active" data-filter="todos">Todos</button>
        <button class="filter-tab" data-filter="pendiente">Sin firmar</button>
        <button class="filter-tab" data-filter="firmado">Firmados</button>
        <button class="filter-tab" data-filter="completado">✅ Completados</button>
        <button class="filter-tab" data-filter="fallido">❌ Fallidos</button>
      </div>
      <div class="date-filter">
        <span class="date-filter-label">Desde:</span>
        <input type="date" id="bk-desde" class="form-input">
        <span class="date-filter-label">Hasta:</span>
        <input type="date" id="bk-hasta" class="form-input">
      </div>
      <div id="backup-list"></div>
    </div>
    ${_modalHTML()}`;
}

export function onEnter() {
  _bindEvents();
  renderLista();
  window.abrirNuevoBackup = abrirNuevo;
  window.editarBackup     = editar;
}

export function renderLista() {
  const DB  = getDBStatic();
  let data  = getData('backups').slice().reverse();
  if (currentFilter === 'pendiente')  data = data.filter(b => !b.firmado);
  if (currentFilter === 'firmado')    data = data.filter(b => b.firmado);
  if (currentFilter === 'completado') data = data.filter(b => b.estadoBk === 'Completado');
  if (currentFilter === 'fallido')    data = data.filter(b => b.estadoBk === 'Fallido');
  if (fDesde) data = data.filter(b => { const d=parseFecha(b.fecha); return d&&d>=new Date(fDesde); });
  if (fHasta) data = data.filter(b => { const d=parseFecha(b.fecha); return d&&d<=new Date(fHasta); });

  const container = document.getElementById('backup-list');
  if (!container) return;
  if (!data.length) {
    container.innerHTML = `<div class="empty"><p>Sin backups registrados</p></div>`;
    return;
  }

  container.innerHTML = data.map(b => {
    const eq   = getData('equipos').find(e => e.serial === b.serial);
    const of   = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
    const dep  = of ? DB.dependencias.find(x => x.id === of.depId) : null;
    const resp = b.responsableEquipo || DB.personas.find(x => x.id === b.personaId)?.nombre || '—';
    const sem  = calcSemaforo(b.fechaProxima);
    const stColor = {
      Completado: 'badge-green', Fallido: 'badge-red',
      Pendiente: 'badge-yellow', 'En proceso': 'badge-yellow'
    }[b.estadoBk] || 'badge-yellow';

    return `
      <div class="backup-card">
        <div class="mant-header">
          <div>
            <div class="mant-serial">${b.serial}</div>
            <div class="mant-person">${resp}</div>
            <div style="font-size:11px;color:var(--text3)">
              ${dep?.nombre || of?.nombre || ''}
            </div>
          </div>
          <div style="text-align:right;">
            <span class="badge badge-purple">${b.tipo || 'Backup'}</span>
            ${b.estadoBk
              ? `<div style="margin-top:3px;">
                   <span class="badge ${stColor}">${b.estadoBk}</span>
                 </div>`
              : ''}
            ${sem ? `<div class="semaforo ${sem.clase}" style="margin-top:4px">${sem.icon} ${sem.label}</div>` : ''}
          </div>
        </div>

        ${b.obs ? `<div class="mant-obs">${b.obs}</div>` : ''}

        <div class="mant-meta">
          <span class="tag">📅 ${formatDate(b.fecha)}</span>
          <span class="tag">📂 ${b.destino || '—'}</span>
          ${b.ubicacion    ? `<span class="tag">📍 ${b.ubicacion}</span>`    : ''}
          ${b.frecuencia   ? `<span class="tag">🔁 ${b.frecuencia}</span>`   : ''}
          ${b.fechaProxima ? `<span class="tag">⏭️ ${formatDate(b.fechaProxima)}</span>` : ''}
          ${b.fotos?.length? `<span class="tag">📸 ${b.fotos.length}</span>` : ''}
        </div>

        ${b.firmado
          ? `<button class="sign-btn signed" disabled style="margin-top:10px;">
               ✅ Firmado ${b.firmaFecha ? '· ' + formatDate(b.firmaFecha.split('T')[0]) : ''}
             </button>`
          : `<button class="sign-btn" data-action="firmar" data-id="${b.id}"
               style="margin-top:10px;">
               ✍️ Solicitar firma
             </button>`
        }

        <div class="card-actions">
          <button class="action-btn" data-action="editar"   data-id="${b.id}">✏️ Editar</button>
          <button class="action-btn del" data-action="eliminar" data-id="${b.id}">🗑️ Eliminar</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset;
      if (action === 'editar')   editar(id);
      if (action === 'eliminar') _eliminar(id);
      if (action === 'firmar')   _firmar(id);
    });
  });
}

function _modalHTML() {
  return `
  <div class="modal-overlay" id="modal-backup">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title" id="bk-title">💾 Nueva Copia de Seguridad</div>
      <input type="hidden" id="bk-edit-id">

      <div style="font-size:11px;font-weight:700;color:var(--accent);
                  text-transform:uppercase;letter-spacing:.5px;
                  margin:8px 0 10px;padding-bottom:4px;
                  border-bottom:2px solid var(--accent-bg);">
        🖥️ Equipo y responsable
      </div>

      <div class="form-group">
        <label class="form-label">Equipo (serial) *</label>
        <div id="bk-equipo-ss"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Responsable del equipo</label>
        <div id="bk-persona-ss"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Responsable del backup (TI)</label>
        <input type="text" class="form-input" id="bk-resp-ti" value="Emerson Pachón Ayala">
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--accent);
                  text-transform:uppercase;letter-spacing:.5px;
                  margin:12px 0 10px;padding-bottom:4px;
                  border-bottom:2px solid var(--accent-bg);">
        📦 Detalles del backup
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-select" id="bk-tipo">
            <option>Completo</option>
            <option>Incremental</option>
            <option>Diferencial</option>
            <option>Solo documentos</option>
            <option>Sistema</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-select" id="bk-estado">
            <option>Completado</option>
            <option>Pendiente</option>
            <option>Fallido</option>
            <option>En proceso</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Destino</label>
          <select class="form-select" id="bk-destino">
            <option>Disco externo</option>
            <option>Google Drive</option>
            <option>NAS / Servidor</option>
            <option>USB</option>
            <option>OneDrive</option>
            <option>Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Frecuencia</label>
          <select class="form-select" id="bk-frecuencia">
            <option>Mensual</option>
            <option selected>Trimestral</option>
            <option>Semestral</option>
            <option>Anual</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group">
          <label class="form-label">Fecha ejecución</label>
          <input type="date" class="form-input" id="bk-fecha">
        </div>
        <div class="form-group">
          <label class="form-label">Próxima (auto)</label>
          <input type="date" class="form-input" id="bk-fecha-proxima"
            style="background:var(--bg2);" readonly>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Ubicación física</label>
        <input type="text" class="form-input" id="bk-ubicacion"
          placeholder="Ej: Oficina Sistemas, Sala de servidores...">
      </div>

      <div class="form-group">
        <label class="form-label">Observaciones</label>
        <textarea class="form-textarea" id="bk-obs"
          placeholder="Información relevante del backup..."></textarea>
      </div>

      <!-- Fotos -->
      <div class="form-group">
        <label class="form-label">📸 Evidencia / Soporte</label>
        <div class="foto-upload-area" onclick="document.getElementById('bk-foto-input').click()">
          <label class="foto-upload-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Tomar foto o elegir de galería
          </label>
          <input type="file" id="bk-foto-input" accept="image/*" multiple>
        </div>
        <div class="foto-grid" id="bk-fotos-preview"></div>
      </div>

      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-secondary" style="flex:1;margin-top:0;" id="bk-cancel-btn">Cancelar</button>
        <button class="btn btn-primary"   style="flex:2;margin-top:0;" id="bk-save-btn">💾 Registrar</button>
      </div>
    </div>
  </div>`;
}

function _bindEvents() {
  document.querySelectorAll('#page-backups .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-backups .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderLista();
    });
  });
  document.getElementById('bk-desde')?.addEventListener('change', e => { fDesde=e.target.value; renderLista(); });
  document.getElementById('bk-hasta')?.addEventListener('change', e => { fHasta=e.target.value; renderLista(); });
  document.getElementById('bk-cancel-btn')?.addEventListener('click', () => cerrarModal('modal-backup'));
  document.getElementById('bk-save-btn')?.addEventListener('click', _guardar);

  const calcProx = () => {
    const fecha = document.getElementById('bk-fecha')?.value;
    const frec  = document.getElementById('bk-frecuencia')?.value;
    if (fecha && frec)
      document.getElementById('bk-fecha-proxima').value = calcFechaProxima(fecha, frec);
  };
  document.getElementById('bk-fecha')?.addEventListener('change', calcProx);
  document.getElementById('bk-frecuencia')?.addEventListener('change', calcProx);

  document.getElementById('bk-foto-input')?.addEventListener('change', e => {
    _procesarFotos(e.target.files, bkFotos, 'bk-fotos-preview');
  });
}

function abrirNuevo() {
  document.getElementById('bk-title').textContent = '💾 Nueva Copia de Seguridad';
  document.getElementById('bk-edit-id').value     = '';
  document.getElementById('bk-tipo').value        = 'Completo';
  document.getElementById('bk-destino').value     = 'Disco externo';
  document.getElementById('bk-estado').value      = 'Completado';
  document.getElementById('bk-obs').value         = '';
  document.getElementById('bk-ubicacion').value   = '';
  document.getElementById('bk-resp-ti').value     = 'Emerson Pachón Ayala';
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('bk-fecha').value         = hoy;
  document.getElementById('bk-fecha-proxima').value = calcFechaProxima(hoy, 'Trimestral');
  bkFotos = [];
  _renderFotosPreview([], 'bk-fotos-preview');
  llenarSSEquipos('bk-equipo-ss', (serial) => {
    // Auto-llenar responsable al seleccionar equipo
    const DB = getDBStatic();
    const eq = getData('equipos').find(e => e.serial === serial);
    if (eq) {
      const p = DB.personas.find(x => x.id === eq.usuarioId);
      if (p) setSSValue('bk-persona-ss', p.id, p.nombre);
    }
  });
  llenarSSPersonas('bk-persona-ss');
  abrirModal('modal-backup');
}

function editar(id) {
  const b = getData('backups').find(x => x.id === id);
  if (!b) return;
  document.getElementById('bk-title').textContent    = '✏️ Editar Backup';
  document.getElementById('bk-edit-id').value        = id;
  document.getElementById('bk-tipo').value           = b.tipo      || 'Completo';
  document.getElementById('bk-destino').value        = b.destino   || 'Disco externo';
  document.getElementById('bk-estado').value         = b.estadoBk  || 'Completado';
  document.getElementById('bk-obs').value            = b.obs       || '';
  document.getElementById('bk-ubicacion').value      = b.ubicacion || '';
  document.getElementById('bk-resp-ti').value        = b.respTI    || 'Emerson Pachón Ayala';
  const d  = parseFecha(b.fecha);        if(d)  document.getElementById('bk-fecha').value          = d.toISOString().split('T')[0];
  const dp = parseFecha(b.fechaProxima); if(dp) document.getElementById('bk-fecha-proxima').value  = dp.toISOString().split('T')[0];
  bkFotos = [...(b.fotos || [])];
  _renderFotosPreview(bkFotos, 'bk-fotos-preview');
  llenarSSEquipos('bk-equipo-ss');
  llenarSSPersonas('bk-persona-ss');
  setSSValue('bk-equipo-ss', b.serial, b.serial);
  const DB = getDBStatic();
  const p  = DB.personas.find(x => x.id === b.personaId);
  if (p) setSSValue('bk-persona-ss', p.id, p.nombre);
  abrirModal('modal-backup');
}

async function _guardar() {
  const serial    = getSSValue('bk-equipo-ss');
  const personaId = getSSValue('bk-persona-ss');
  const tipo      = document.getElementById('bk-tipo').value;
  const destino   = document.getElementById('bk-destino').value;
  const estadoBk  = document.getElementById('bk-estado').value;
  const obs       = document.getElementById('bk-obs').value;
  const ubicacion = document.getElementById('bk-ubicacion').value;
  const respTI    = document.getElementById('bk-resp-ti').value;
  const frecuencia= document.getElementById('bk-frecuencia').value;
  const fechaRaw  = document.getElementById('bk-fecha').value;
  const proxRaw   = document.getElementById('bk-fecha-proxima').value;
  const editId    = document.getElementById('bk-edit-id').value;

  if (!serial) { showToast('⚠️ Selecciona un equipo', '#d97706'); return; }

  const fmt = r => r
    ? new Date(r+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'})
    : '';
  const fecha        = fmt(fechaRaw) || new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
  const fechaProxima = fmt(proxRaw);

  const DB = getDBStatic();
  const p  = DB.personas.find(x => x.id === personaId);
  const lista = [...getData('backups')];

  const campos = {
    serial, personaId, tipo, destino, estadoBk, obs, ubicacion,
    respTI, frecuencia, fechaProxima, fotos: bkFotos,
    responsableEquipo: p?.nombre || '',
  };

  if (editId) {
    const idx = lista.findIndex(x => x.id === editId);
    if (idx >= 0) lista[idx] = { ...lista[idx], ...campos, fecha };
    apiPost('Backups','update',{ Tipo:tipo, Ubicacion:destino, Observaciones:obs, Estado:estadoBk, Fecha_Ultima:fecha, Fecha_Proxima:fechaProxima },'ID',editId).catch(console.warn);
    showToast('✅ Backup actualizado');
  } else {
    const id = uid();
    lista.push({ id, fecha, firmado:false, firma:null, firmaFecha:null, ...campos });
    apiPost('Backups','insert',{ ID:id, EquipoID:serial, Tipo:tipo, Frecuencia:frecuencia, Fecha_Ultima:fecha, Fecha_Proxima:fechaProxima, Ubicacion:destino, Estado:estadoBk, Observaciones:obs, Firmado:'No', Imagen_Base64:'' }).catch(console.warn);
    showToast('💾 Backup registrado');
  }

  setState('backups', lista);
  saveKey('backups');
  cerrarModal('modal-backup');
  renderLista();
}

function _firmar(id) {
  const b = getData('backups').find(x => x.id === id);
  if (!b) return;
  if (b.firmado) { showToast('✅ Ya está firmado'); return; }
  _abrirFirma('backup', id, (firmaBase64) => {
    const lista = getData('backups').map(x => x.id !== id ? x : {
      ...x, firmado:true, firma:firmaBase64, firmaFecha:new Date().toISOString(),
    });
    setState('backups', lista);
    saveKey('backups');
    apiPost('Backups','update',{ Firmado:'Sí', Imagen_Base64:firmaBase64 },'ID',id).catch(console.warn);
    showToast('✅ Firma de backup registrada');
    renderLista();
  });
}

function _eliminar(id) {
  if (!confirm('¿Eliminar este backup?')) return;
  const lista = getData('backups').filter(b => b.id !== id);
  setState('backups', lista);
  saveKey('backups');
  apiPost('Backups','delete',{},'ID',id).catch(console.warn);
  showToast('🗑️ Eliminado');
  renderLista();
}

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
  grid.innerHTML = arr.map((src,i) => `
    <div class="foto-thumb">
      <img src="${src}" alt="foto ${i+1}">
      <button class="foto-del" data-idx="${i}">✕</button>
    </div>`).join('');
  grid.querySelectorAll('.foto-del').forEach(btn => {
    btn.addEventListener('click', () => { arr.splice(+btn.dataset.idx,1); _renderFotosPreview(arr,previewId); });
  });
}