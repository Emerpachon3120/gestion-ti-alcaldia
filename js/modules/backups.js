import { uid, formatDate, parseFecha, calcSemaforo, calcFechaProxima, soloLetras, alfaNumerico } from '../utils.js';
import { abrirFirma as _abrirFirma }     from '../ui/firma.js';
import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }                        from '../storage.js';
import { apiPost }                        from '../api.js';
import { showToast }                      from '../ui/toast.js';
import { abrirModal, cerrarModal }        from '../ui/modal.js';
import { buildSearchSelect, getSSValue, setSSValue, llenarSSEquipos, llenarSSPersonas } from '../ui/searchselect.js';
import { verActaBackup } from '../ui/documento.js';
import { abrirNuevo as abrirNuevoEquipo } from './inventario.js';

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
          ? `<div style="display:flex;gap:6px;margin-top:10px;">
               <button class="sign-btn signed" disabled style="flex:2;margin-top:0;">
                 ✅ Firmado ${b.firmaFecha ? '· ' + formatDate(b.firmaFecha.split('T')[0]) : ''}
               </button>
               <button class="doc-viewer-btn" data-action="verdoc" data-id="${b.id}"
                 style="flex:1;margin-top:0;padding:10px;border:1px solid var(--border);
                        border-radius:var(--radius-sm);background:var(--bg2);
                        font-family:var(--font-main);font-size:12px;cursor:pointer;">
                 📄 Ver acta
               </button>
             </div>`
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
      if (action === 'verdoc')   verActaBackup(id);
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
        <input type="text" class="form-input" id="bk-resp-ti" value="Emerson Judiño Pachón Ayala">
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
        <label class="form-label">Ruta de origen del backup</label>
        <input type="text" class="form-input" id="bk-ubicacion"
          placeholder=" Ubicacion dentro del equipo Ej: C:/">
      </div>

      <div class="form-group">
        <label class="form-label">Actividades realizadas</label>
        <div id="bk-actividades-lista" style="
          background:var(--bg2);border:1px solid var(--border);
          border-radius:var(--radius-sm);padding:10px;
          display:grid;grid-template-columns:1fr 1fr;gap:6px;
          margin-bottom:8px;">
        </div>
        <label class="form-label" style="margin-top:8px;">Observaciones adicionales</label>
        <textarea class="form-textarea" id="bk-obs"
          placeholder="Observaciones adicionales..."></textarea>
      </div>

      <!-- Fotos -->
      <div class="form-group">
        <label class="form-label">📸 Evidencia / Soporte</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <button type="button" style="
            padding:12px 8px;border:2px dashed var(--accent);
            border-radius:var(--radius-sm);background:var(--accent-bg);
            color:var(--accent);font-family:var(--font-main);
            font-size:13px;font-weight:600;cursor:pointer;"
            onclick="document.getElementById('bk-foto-camara').click()">
            📷 Tomar foto
          </button>
          <button type="button" style="
            padding:12px 8px;border:2px dashed var(--border);
            border-radius:var(--radius-sm);background:var(--bg2);
            color:var(--text2);font-family:var(--font-main);
            font-size:13px;font-weight:600;cursor:pointer;"
            onclick="document.getElementById('bk-foto-galeria').click()">
            🖼️ Desde galería
          </button>
        </div>
        <input type="file" id="bk-foto-camara" accept="image/*" capture="environment">
        <input type="file" id="bk-foto-galeria" accept="image/*" multiple>
        <div class="foto-grid" id="bk-fotos-preview"></div>
      </div>

      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn btn-secondary" style="flex:1;margin-top:0;" id="bk-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" style="flex:2;margin-top:0;"  onclick="window._guardarBackup()">💾 Registrar</button>
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

  document.getElementById('bk-foto-camara')?.addEventListener('change', e => {
    _procesarFotos(e.target.files, bkFotos, 'bk-fotos-preview');
    e.target.value = '';
  });
  document.getElementById('bk-foto-galeria')?.addEventListener('change', e => {
    _procesarFotos(e.target.files, bkFotos, 'bk-fotos-preview');
    e.target.value = '';
  });
  // Validaciones
  ['bk-resp-ti','bk-ubicacion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) soloLetras(el);
  });
}
function _crearFuncionarioRapido() {
  _modalFuncionarioRapido();
  document.getElementById('modal-func-rapido').classList.add('open');
}

function abrirNuevo() {
  document.getElementById('bk-title').textContent = '💾 Nueva Copia de Seguridad';
  document.getElementById('bk-edit-id').value     = '';
  document.getElementById('bk-tipo').value        = 'Completo';
  document.getElementById('bk-destino').value     = 'Disco externo';
  document.getElementById('bk-estado').value      = 'Completado';
  document.getElementById('bk-obs').value         = '';
  document.getElementById('bk-ubicacion').value   = '';
  document.getElementById('bk-resp-ti').value     = 'Emerson Judiño Pachón Ayala';

  // Limpiar info box del equipo anterior
  const equipoInfo = document.getElementById('bk-equipo-info');
  if (equipoInfo) equipoInfo.innerHTML = '';

  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('bk-fecha').value         = hoy;
  document.getElementById('bk-fecha-proxima').value = calcFechaProxima(hoy, 'Trimestral');

  bkFotos = [];
  _renderFotosPreview([], 'bk-fotos-preview');

  // Recargar SearchSelects limpios desde cero
  llenarSSEquipos('bk-equipo-ss', (serial) => {
    const DB = getDBStatic();
    const eq = getData('equipos').find(e => e.serial === serial);
    if (!eq) return;

    const p  = DB.personas.find(x => x.id === eq.usuarioId);
    if (p) setSSValue('bk-persona-ss', p.id, p.nombre);

    const of  = DB.oficinas.find(x => x.id === eq.oficina);
    const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;

    let infoBox = document.getElementById('bk-equipo-info');
    if (!infoBox) {
      infoBox = document.createElement('div');
      infoBox.id = 'bk-equipo-info';
      document.getElementById('bk-equipo-ss').insertAdjacentElement('afterend', infoBox);
    }
    infoBox.innerHTML = `
      <div style="background:var(--bg2);border:1px solid var(--border);
        border-radius:var(--radius-sm);padding:8px 12px;
        font-size:11px;color:var(--text2);margin-top:6px;">
        <b>${dep?.nombre || '—'}</b> · ${of?.nombre || '—'}<br>
        ${eq.so || '—'} · RAM: ${eq.ram || '—'} · ${eq.disco || ''} ${eq.cap || ''}
        ${eq.marca ? `<br>${eq.marca} ${eq.modelo || ''}` : ''}
      </div>`;
  }, _crearEquipoRapido);

  llenarSSPersonas('bk-persona-ss', ()=>{}, _crearFuncionarioRapido);

  setTimeout(() => {
    window._actualizarActividadesBk?.();
    document.querySelectorAll('#bk-actividades-lista input[type="checkbox"]')
      .forEach(cb => cb.checked = false);
  }, 150);

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
  document.getElementById('bk-resp-ti').value        = b.respTI    || 'Emerson Judiño Pachón Ayala';
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
  const serial = getSSValue('bk-equipo-ss');
  if (!serial) { showToast('⚠️ Selecciona un equipo', '#d97706'); return; }
  const editId = document.getElementById('bk-edit-id').value;
  if (!editId) {
    _pedirFirmaYGuardarBk();
  } else {
    _ejecutarGuardarBk(null);
  }
}

function _pedirFirmaYGuardarBk() {
  _abrirFirma('backup', 'nuevo', (firmaBase64) => {
    _ejecutarGuardarBk(firmaBase64);
  });
}

async function _ejecutarGuardarBk(firmaBase64 = null) {
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

  const fmt = r => r
    ? new Date(r+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'})
    : '';

  const fecha        = fmt(fechaRaw) || new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
  const fechaProxima = fmt(proxRaw);

  const DB = getDBStatic();
  const p  = DB.personas.find(x => x.id === personaId);

  // Actividades marcadas
  const actividadesMarcadas = Array.from(
    document.querySelectorAll('#bk-actividades-lista input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  const obsCompleto = actividadesMarcadas.length
    ? 'Actividades realizadas:\n' + actividadesMarcadas.map(a => `• ${a}`).join('\n')
      + (obs ? '\n\nObservaciones adicionales:\n' + obs : '')
    : obs;

  const campos = {
    serial, personaId, tipo, destino, estadoBk,
    obs: obsCompleto,  // ← obsCompleto
    ubicacion, respTI, frecuencia, fechaProxima, fotos: bkFotos,
    responsableEquipo: p?.nombre || '',
    firmado:    firmaBase64 ? true : false,
    firma:      firmaBase64,
    firmaFecha: firmaBase64 ? new Date().toISOString() : null,
  };

  const lista = [...getData('backups')];

  if (editId) {
    const idx = lista.findIndex(x => x.id === editId);
    if (idx >= 0) lista[idx] = { ...lista[idx], ...campos, fecha };
    apiPost('Backups', 'update', {
      EquipoID: serial, Tipo: tipo, Frecuencia: frecuencia,
      Fecha_Ultima: fecha, Fecha_Proxima: fechaProxima,
      Ubicacion: destino, Estado: estadoBk,
      Observaciones: obsCompleto,  // ← obsCompleto
      Responsable: respTI, Persona_ID: personaId, Resp_TI: respTI,
      Fotos_Base64: bkFotos.join('||'),
      Firmado: firmaBase64 ? 'Sí' : 'No',
      Imagen_Base64: firmaBase64 ? 'firmado_digitalmente' : '',
    }, 'ID', editId).catch(console.warn);
    showToast('✅ Backup actualizado');
  } else {
    const id = uid();
    lista.push({ id, fecha, ...campos });
    apiPost('Backups', 'insert', {
      ID: id, EquipoID: serial, Tipo: tipo, Frecuencia: frecuencia,
      Fecha_Ultima: fecha, Fecha_Proxima: fechaProxima,
      Firmado: firmaBase64 ? 'Sí' : 'No',
      Responsable: respTI,
      Observaciones: obsCompleto,  // ← obsCompleto
      Imagen_Base64: firmaBase64 ? 'firmado_digitalmente' : '',
      Ubicacion: destino, Estado: estadoBk,
      Persona_ID: personaId, Resp_TI: respTI,
      Fotos_Base64: bkFotos.length > 0 ? `${bkFotos.length} foto(s)` : '',
    }).catch(console.warn);
    showToast('💾 Backup registrado y firmado');
  }

  setState('backups', lista);
  saveKey('backups');
  cerrarModal('modal-backup');
  renderLista();
}

window._guardarBackup = _guardar;

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
  grid.innerHTML = arr.map((src,i) => `
    <div class="foto-thumb">
      <img src="${src}" alt="foto ${i+1}">
      <button class="foto-del" data-idx="${i}">✕</button>
    </div>`).join('');
  grid.querySelectorAll('.foto-del').forEach(btn => {
    btn.addEventListener('click', () => { arr.splice(+btn.dataset.idx,1); _renderFotosPreview(arr,previewId); });
  });
}

function _crearEquipoRapido() {
  const modalBk = document.getElementById('modal-backup');
  modalBk?.classList.remove('open');

  // Usar el formulario completo de inventario
  import('./inventario.js').then(mod => {
    mod.abrirNuevo();

    // Observar cuando se cierre el modal de equipo
    const modalEq = document.getElementById('modal-equipo');
    if (!modalEq) return;

    const observer = new MutationObserver(() => {
      if (!modalEq.classList.contains('open')) {
        observer.disconnect();
        setTimeout(() => {
          // Reabrir modal backup
          modalBk?.classList.add('open');

          // Tomar el último equipo registrado
          const equipos = getData('equipos');
          const ultimo  = equipos[equipos.length - 1];
          if (!ultimo) return;

          const DB = getDBStatic();

          // Auto-rellenar serial
          llenarSSEquipos('bk-equipo-ss', () => {}, _crearEquipoRapido);
          setSSValue('bk-equipo-ss', ultimo.serial,
            `${ultimo.serial}${ultimo.marca ? ' — ' + ultimo.marca : ''}`);

          // Auto-rellenar responsable
          const p = DB.personas.find(x => x.id === ultimo.usuarioId);
          if (p) {
            llenarSSPersonas('bk-persona-ss', () => {}, _crearFuncionarioRapido);
            setSSValue('bk-persona-ss', p.id, p.nombre);
          }

          // Mostrar info
          const of  = DB.oficinas.find(x => x.id === ultimo.oficina);
          const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
          let infoBox = document.getElementById('bk-equipo-info');
          if (!infoBox) {
            infoBox = document.createElement('div');
            infoBox.id = 'bk-equipo-info';
            document.getElementById('bk-equipo-ss')
              .insertAdjacentElement('afterend', infoBox);
          }
          infoBox.innerHTML = `
            <div style="background:var(--bg2);border:1px solid var(--border);
              border-radius:var(--radius-sm);padding:8px 12px;
              font-size:11px;color:var(--text2);margin-top:6px;">
              <b>${dep?.nombre || '—'}</b> · ${of?.nombre || '—'}<br>
              ${ultimo.so || '—'} · RAM: ${ultimo.ram || '—'}
            </div>`;
        }, 200);
      }
    });

    observer.observe(modalEq, { attributes: true, attributeFilter: ['class'] });
  });
}

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
        <div class="modal-footer">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary" style="flex:1;margin-top:0;"
              onclick="document.getElementById('modal-equipo-rapido').classList.remove('open')">
              Cancelar
            </button>
            <button class="btn btn-primary" style="flex:2;margin-top:0;"
              id="eq-r-save-btn">💻 Guardar equipo</button>
          </div>
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

    llenarSSEquipos('bk-equipo-ss', ()=>{}, _crearEquipoRapido);
    setSSValue('bk-equipo-ss', serial, `${serial} — ${marca} ${modelo}`);
    document.getElementById('modal-equipo-rapido').classList.remove('open');
    document.body.style.overflow = ''; // ← AGREGA ESTA
    showToast(`💻 Equipo ${serial} registrado`);
  });

  import('../ui/searchselect.js').then(({ buildSearchSelect }) => {
    const DB = getDBStatic();
    const items = DB.oficinas.map(o => {
      const dep = DB.dependencias.find(d => d.id === o.depId);
      return { value: o.id, label: `${o.nombre} — ${dep?.nombre||''}` };
    });
    buildSearchSelect('eq-r-oficina-ss', items, 'Buscar oficina...',()=>{});
  });
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

    llenarSSPersonas('bk-persona-ss', ()=>{}, _crearFuncionarioRapido);
    setSSValue('bk-persona-ss', id, nombre);
    document.getElementById('modal-func-rapido').classList.remove('open');
    showToast(`👤 ${nombre} registrado`);
  });
}

const ACTIVIDADES_BACKUP = [
  'Verificación del espacio disponible en destino',
  'Copia de documentos institucionales',
  'Copia de correos y configuraciones',
  'Copia de base de datos local',
  'Copia de escritorio y descargas',
  'Copia de software instalado (lista)',
  'Verificación de integridad del backup',
  'Prueba de restauración parcial',
  'Eliminación de backups anteriores obsoletos',
  'Registro de ruta y nombre del archivo backup',
  'Notificación al funcionario del resultado',
  'Etiquetado del medio de almacenamiento',
];

window._actualizarActividadesBk = function() {
  const lista = document.getElementById('bk-actividades-lista');
  if (!lista) return;
  lista.innerHTML = ACTIVIDADES_BACKUP.map((act, i) => `
    <label style="display:flex;align-items:center;gap:6px;
      font-size:12px;cursor:pointer;padding:3px 0;">
      <input type="checkbox" id="bk-act-${i}" value="${act}"
        style="width:14px;height:14px;cursor:pointer;">
      ${act}
    </label>`).join('');
};

window._guardarBackup = _guardar;