import { uid, formatDate, parseFecha, calcSemaforo, calcFechaProxima, soloLetras } from '../utils.js';
import { abrirFirma as _abrirFirma }     from '../ui/firma.js';
import { getData, getDBStatic, setState } from '../state.js';
import { saveKey }                        from '../storage.js';
import { apiPost }                        from '../firebase.js';
import { showToast }                      from '../ui/toast.js';
import { abrirModal, cerrarModal }        from '../ui/modal.js';
import { getSSValue, setSSValue, llenarSSEquipos, llenarSSPersonas } from '../ui/searchselect.js';
import { verActaBackup } from '../ui/documento.js';

let currentFilter = 'todos';
let fDesde = '', fHasta = '';
let bkFotos = [];

export function render() {
  return `
    <div id="page-backups" class="pb-8">

      <!-- Header -->
      <div class="relative overflow-hidden rounded-b-3xl -mx-4 -mt-4 mb-5 px-5 pt-5 pb-6"
        style="background:linear-gradient(135deg,#4c1d95,#7c3aed)">
        <div class="absolute -top-6 -right-6 w-24 h-24 rounded-full"
          style="background:rgba(255,255,255,.07)"></div>
        <div class="relative z-10">
          <h1 class="text-xl font-extrabold text-white mb-0.5">💾 Copias de Seguridad</h1>
          <p class="text-xs" style="color:rgba(255,255,255,.7)">Registro con firma del funcionario</p>
        </div>
      </div>

      <!-- Filtros -->
      <div class="px-1 mb-3">
        <div class="filter-tabs">
          <button class="filter-tab active" data-filter="todos">Todos</button>
          <button class="filter-tab" data-filter="pendiente">Sin firmar</button>
          <button class="filter-tab" data-filter="firmado">Firmados</button>
          <button class="filter-tab" data-filter="completado">✅ Completados</button>
          <button class="filter-tab" data-filter="fallido">❌ Fallidos</button>
        </div>
      </div>

      <!-- Filtro fechas -->
      <div class="date-filter mx-1 mb-4">
        <span class="date-filter-label">Desde:</span>
        <input type="date" id="bk-desde" class="form-input">
        <span class="date-filter-label">Hasta:</span>
        <input type="date" id="bk-hasta" class="form-input">
      </div>

      <div id="backup-list" class="px-1"></div>
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
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 gap-3" style="color:var(--text3)">
        <div class="text-4xl">💾</div>
        <p class="text-sm">Sin backups registrados</p>
      </div>`;
    return;
  }

  container.innerHTML = data.map(b => {
    const eq   = getData('equipos').find(e => e.serial === b.serial);
    const of   = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
    const dep  = of ? DB.dependencias.find(x => x.id === of.depId) : null;
    const resp = b.responsableEquipo || DB.personas.find(x => x.id === b.personaId)?.nombre || '—';
    const sem  = calcSemaforo(b.fechaProxima);

    const estadoColor = {
      Completado: { bg:'#16a34a', text:'#fff' },
      Fallido:    { bg:'#dc2626', text:'#fff' },
      Pendiente:  { bg:'#d97706', text:'#fff' },
    }[b.estadoBk] || { bg:'#d97706', text:'#fff' };

    const borderColor = sem?.clase === 'semaforo-rojo' ? '#dc2626'
                      : sem?.clase === 'semaforo-amarillo' ? '#d97706' : '#7c3aed';

    let obsDisplay = '';
    if (b.obs) {
      const partes = b.obs.split('Actividades realizadas:\n');
      const bloque = partes[1] || partes[0];
      const lineas = [...new Set(bloque.split('\n').map(l => l.replace('• ','').trim()).filter(l => l && !l.startsWith('Observaciones') && !l.startsWith('Actividades')))];
      obsDisplay = lineas.join(' · ');
      if (b.obs.includes('Observaciones adicionales:\n')) {
        const obsAd = b.obs.split('Observaciones adicionales:\n').pop();
        if (obsAd) obsDisplay += (obsDisplay ? ' — ' : '') + obsAd;
      }
    }

    return `
      <div class="rounded-2xl mb-3 overflow-hidden"
        style="background:var(--card);border:1px solid var(--border);border-left:4px solid ${borderColor}">
        <div class="p-4">
          <!-- Header -->
          <div class="flex justify-between items-start gap-2 mb-3">
            <div class="flex-1 min-w-0">
              <p class="font-mono font-bold text-sm" style="color:var(--text1)">${b.serial}</p>
              <p class="text-xs mt-0.5" style="color:var(--text2)">${resp}</p>
              <p class="text-xs truncate mt-0.5" style="color:var(--text3)">${dep?.nombre || of?.nombre || ''}</p>
            </div>
            <div class="flex flex-col items-end gap-1 flex-shrink-0">
              <div class="flex gap-1 flex-wrap justify-end">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style="background:#7c3aed">${b.tipo || 'Backup'}</span>
                ${b.estadoBk ? `
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style="background:${estadoColor.bg};color:${estadoColor.text}">
                  ${b.estadoBk}
                </span>` : ''}
              </div>
              ${sem ? `<div class="semaforo ${sem.clase}">${sem.icon} ${sem.label}</div>` : ''}
            </div>
          </div>

          ${obsDisplay ? `<p class="text-xs italic mb-3 line-clamp-2" style="color:var(--text3)">${obsDisplay}</p>` : ''}

          <!-- Tags -->
          <div class="flex flex-wrap gap-1 mb-3">
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" style="background:var(--bg2);color:var(--text3)">
              📅 ${formatDate(b.fecha)}
            </span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" style="background:var(--bg2);color:var(--text3)">
              📂 ${b.destino || '—'}
            </span>
            ${b.frecuencia ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" style="background:var(--bg2);color:var(--text3)">🔁 ${b.frecuencia}</span>` : ''}
            ${b.fechaProxima ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" style="background:var(--bg2);color:var(--text3)">⏭️ ${formatDate(b.fechaProxima)}</span>` : ''}
            ${b.fotos?.length ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" style="background:var(--bg2);color:var(--text3)">📸 ${b.fotos.length}</span>` : ''}
          </div>

          <!-- Firma -->
          ${b.firmado
            ? `<div class="flex gap-2">
                 <button class="flex-1 py-2.5 rounded-xl text-xs font-bold text-white cursor-default"
                   style="background:#16a34a" disabled>
                   ✅ Firmado ${b.firmaFecha ? '· ' + formatDate(b.firmaFecha.split('T')[0]) : ''}
                 </button>
                 <button data-action="verdoc" data-id="${b.id}"
                   class="flex-none px-4 py-2.5 rounded-xl text-xs font-bold"
                   style="background:var(--bg2);border:1px solid var(--border);color:var(--text2)">
                   📄 Acta
                 </button>
               </div>`
            : `<button data-action="firmar" data-id="${b.id}"
                 class="w-full py-2.5 rounded-xl text-xs font-bold text-white"
                 style="background:#7c3aed">
                 ✍️ Solicitar firma
               </button>`
          }
        </div>

        <!-- Acciones -->
        <div class="flex border-t" style="border-color:var(--border)">
          <button data-action="editar" data-id="${b.id}"
            class="flex-1 py-2.5 text-xs font-semibold" style="color:var(--text2)">✏️ Editar</button>
          <div style="width:1px;background:var(--border)"></div>
          <button data-action="eliminar" data-id="${b.id}"
            class="flex-1 py-2.5 text-xs font-semibold" style="color:#dc2626">🗑️ Eliminar</button>
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

      <div class="text-[11px] font-bold uppercase tracking-wider mb-3 pb-2" style="color:var(--accent);border-bottom:2px solid var(--accent-bg)">🖥️ Equipo y responsable</div>
      <div class="form-group"><label class="form-label">Equipo (serial) *</label><div id="bk-equipo-ss"></div></div>
      <div class="form-group"><label class="form-label">Responsable del equipo</label><div id="bk-persona-ss"></div></div>
      <div class="form-group"><label class="form-label">Responsable del backup (TI)</label><input type="text" class="form-input" id="bk-resp-ti" value="Emerson Judiño Pachón Ayala"></div>

      <div class="text-[11px] font-bold uppercase tracking-wider mb-3 pb-2 mt-4" style="color:var(--accent);border-bottom:2px solid var(--accent-bg)">📦 Detalles del backup</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group"><label class="form-label">Tipo</label>
          <select class="form-select" id="bk-tipo">
            <option>Completo</option><option>Incremental</option><option>Diferencial</option><option>Solo documentos</option><option>Sistema</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Estado</label>
          <select class="form-select" id="bk-estado">
            <option>Completado</option><option>Fallido</option><option>No realizado</option><option>Pendiente</option>
          </select>
        </div>
      </div>

      <div id="bk-motivo-wrap" style="display:none;margin-top:10px;">
        <label class="form-label">Motivo de no realización</label>
        <div id="bk-motivo-lista" class="rounded-lg p-3 grid grid-cols-2 gap-2" style="background:var(--bg2);border:1px solid var(--border)">
          ${['No tiene información relevante','Equipo dañado o en mal estado','Funcionario ausente','Equipo dado de baja','Sin espacio en destino','Acceso denegado al equipo'].map(m => `
          <label class="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" value="${m}" class="w-3.5 h-3.5"> ${m}
          </label>`).join('')}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
        <div class="form-group"><label class="form-label">Destino</label>
          <select class="form-select" id="bk-destino">
            <option>Disco externo</option><option>Google Drive</option><option>NAS / Servidor</option><option>USB</option><option>OneDrive</option><option>Otro</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Frecuencia</label>
          <select class="form-select" id="bk-frecuencia">
            <option>Mensual</option><option selected>Trimestral</option><option>Semestral</option><option>Anual</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="form-group"><label class="form-label">Fecha ejecución</label><input type="date" class="form-input" id="bk-fecha"></div>
        <div class="form-group"><label class="form-label">Próxima (auto)</label><input type="date" class="form-input" id="bk-fecha-proxima" style="background:var(--bg2)" readonly></div>
      </div>

      <div class="form-group"><label class="form-label">Ruta de origen</label><input type="text" class="form-input" id="bk-ubicacion" placeholder="Ej: C:/"></div>

      <div class="form-group">
        <label class="form-label">Actividades realizadas</label>
        <div id="bk-actividades-lista" class="rounded-lg p-3 grid grid-cols-2 gap-1.5 mb-2" style="background:var(--bg2);border:1px solid var(--border)"></div>
        <label class="form-label mt-2">Observaciones adicionales</label>
        <textarea class="form-textarea" id="bk-obs" placeholder="Observaciones..."></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">📸 Evidencia / Soporte</label>
        <div class="grid grid-cols-2 gap-2 mb-2">
          <button type="button" class="py-3 rounded-xl text-sm font-bold cursor-pointer"
            style="border:2px dashed var(--accent);background:var(--accent-bg);color:var(--accent)"
            onclick="document.getElementById('bk-foto-camara').click()">📷 Tomar foto</button>
          <button type="button" class="py-3 rounded-xl text-sm font-bold cursor-pointer"
            style="border:2px dashed var(--border);background:var(--bg2);color:var(--text2)"
            onclick="document.getElementById('bk-foto-galeria').click()">🖼️ Galería</button>
        </div>
        <input type="file" id="bk-foto-camara" accept="image/*" capture="environment">
        <input type="file" id="bk-foto-galeria" accept="image/*" multiple>
        <div class="foto-grid" id="bk-fotos-preview"></div>
      </div>

      <div class="modal-footer">
        <div class="flex gap-2">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;" id="bk-cancel-btn">Cancelar</button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;" onclick="window._guardarBackup()">💾 Registrar</button>
        </div>
      </div>
    </div>
  </div>`;
}

function _bindEvents() {
  document.querySelectorAll('#page-backups .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#page-backups .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); currentFilter = btn.dataset.filter; renderLista();
    });
  });
  document.getElementById('bk-desde')?.addEventListener('change', e => { fDesde=e.target.value; renderLista(); });
  document.getElementById('bk-hasta')?.addEventListener('change', e => { fHasta=e.target.value; renderLista(); });
  document.getElementById('bk-cancel-btn')?.addEventListener('click', () => cerrarModal('modal-backup'));
  const calcProx = () => {
    const fecha = document.getElementById('bk-fecha')?.value;
    const frec  = document.getElementById('bk-frecuencia')?.value;
    if (fecha && frec) document.getElementById('bk-fecha-proxima').value = calcFechaProxima(fecha, frec);
  };
  document.getElementById('bk-fecha')?.addEventListener('change', calcProx);
  document.getElementById('bk-frecuencia')?.addEventListener('change', calcProx);
  document.getElementById('bk-foto-camara')?.addEventListener('change', e => { _procesarFotos(e.target.files, bkFotos, 'bk-fotos-preview'); e.target.value=''; });
  document.getElementById('bk-foto-galeria')?.addEventListener('change', e => { _procesarFotos(e.target.files, bkFotos, 'bk-fotos-preview'); e.target.value=''; });
  document.getElementById('bk-estado')?.addEventListener('change', () => {
    const estado = document.getElementById('bk-estado').value;
    const wrap = document.getElementById('bk-motivo-wrap');
    if (wrap) wrap.style.display = ['Fallido','No realizado'].includes(estado) ? 'block' : 'none';
  });
  const respTiEl = document.getElementById('bk-resp-ti');
  if (respTiEl) soloLetras(respTiEl);
}

function _crearFuncionarioRapido() { _modalFuncionarioRapido(); document.getElementById('modal-func-rapido').classList.add('open'); }

function abrirNuevo() {
  document.getElementById('bk-title').textContent    = '💾 Nueva Copia de Seguridad';
  document.getElementById('bk-edit-id').value        = '';
  document.getElementById('bk-tipo').value           = 'Completo';
  document.getElementById('bk-destino').value        = 'Disco externo';
  document.getElementById('bk-estado').value         = 'Completado';
  document.getElementById('bk-obs').value            = '';
  document.getElementById('bk-ubicacion').value      = '';
  document.getElementById('bk-resp-ti').value        = 'Emerson Judiño Pachón Ayala';
  const equipoInfo = document.getElementById('bk-equipo-info');
  if (equipoInfo) equipoInfo.innerHTML = '';
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('bk-fecha').value         = hoy;
  document.getElementById('bk-fecha-proxima').value = calcFechaProxima(hoy, 'Trimestral');
  bkFotos = [];
  _renderFotosPreview([], 'bk-fotos-preview');
  llenarSSEquipos('bk-equipo-ss', (serial) => {
    const DB = getDBStatic();
    const eq = getData('equipos').find(e => e.serial === serial);
    if (!eq) return;
    const p = DB.personas.find(x => x.id === eq.usuarioId);
    if (p) setSSValue('bk-persona-ss', p.id, p.nombre);
    const of  = DB.oficinas.find(x => x.id === eq.oficina);
    const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
    let infoBox = document.getElementById('bk-equipo-info');
    if (!infoBox) { infoBox = document.createElement('div'); infoBox.id = 'bk-equipo-info'; document.getElementById('bk-equipo-ss').insertAdjacentElement('afterend', infoBox); }
    infoBox.innerHTML = `<div class="rounded-lg p-3 text-xs mt-2" style="background:var(--bg2);border:1px solid var(--border);color:var(--text2)">
      <b>${dep?.nombre || '—'}</b> · ${of?.nombre || '—'}<br>
      ${eq.so || '—'} · RAM: ${eq.ram || '—'} · ${eq.disco || ''} ${eq.cap || ''}
      ${eq.marca ? `<br>${eq.marca} ${eq.modelo || ''}` : ''}
    </div>`;
  }, _crearEquipoRapido);
  llenarSSPersonas('bk-persona-ss', ()=>{}, _crearFuncionarioRapido);
  setTimeout(() => { window._actualizarActividadesBk?.(); document.querySelectorAll('#bk-actividades-lista input[type="checkbox"]').forEach(cb => cb.checked = false); }, 150);
  document.getElementById('bk-motivo-wrap').style.display = 'none';
  document.querySelectorAll('#bk-motivo-lista input[type="checkbox"]').forEach(cb => cb.checked = false);
  abrirModal('modal-backup');
}

function editar(id) {
  const b = getData('backups').find(x => x.id === id);
  if (!b) return;
  document.getElementById('bk-title').textContent = '✏️ Editar Backup';
  document.getElementById('bk-edit-id').value     = id;
  document.getElementById('bk-tipo').value        = b.tipo     || 'Completo';
  document.getElementById('bk-destino').value     = b.destino  || 'Disco externo';
  document.getElementById('bk-estado').value      = b.estadoBk || 'Completado';
  document.getElementById('bk-ubicacion').value   = b.ubicacion || '';
  document.getElementById('bk-resp-ti').value     = b.respTI   || 'Emerson Judiño Pachón Ayala';
  let obsSolo = b.obs || '';
  if (obsSolo.includes('Observaciones adicionales:\n')) obsSolo = obsSolo.split('Observaciones adicionales:\n')[1] || '';
  else if (obsSolo.startsWith('Actividades realizadas:\n')) obsSolo = '';
  let obsSoloFinal = obsSolo;
  if (b.obs?.startsWith('Motivo de no realización:\n')) obsSoloFinal = b.obs.includes('Observaciones adicionales:\n') ? b.obs.split('Observaciones adicionales:\n')[1] || '' : '';
  document.getElementById('bk-obs').value = obsSoloFinal;
  const d  = parseFecha(b.fecha);        if(d)  document.getElementById('bk-fecha').value         = d.toISOString().split('T')[0];
  const dp = parseFecha(b.fechaProxima); if(dp) document.getElementById('bk-fecha-proxima').value = dp.toISOString().split('T')[0];
  bkFotos = [...(b.fotos || [])];
  _renderFotosPreview(bkFotos, 'bk-fotos-preview');
  llenarSSEquipos('bk-equipo-ss');
  llenarSSPersonas('bk-persona-ss');
  setSSValue('bk-equipo-ss', b.serial, b.serial);
  const DB = getDBStatic();
  const p  = DB.personas.find(x => x.id === b.personaId);
  if (p) setSSValue('bk-persona-ss', p.id, p.nombre);
  const motivoWrap = document.getElementById('bk-motivo-wrap');
  if (motivoWrap) motivoWrap.style.display = ['Fallido','No realizado'].includes(b.estadoBk) ? 'block' : 'none';
  setTimeout(() => {
    window._actualizarActividadesBk?.();
    if (b.obs) { const lineas = b.obs.split('\n').map(l => l.replace('• ','').trim()); document.querySelectorAll('#bk-actividades-lista input[type="checkbox"]').forEach(cb => { cb.checked = lineas.includes(cb.value); }); }
    if (b.obs?.includes('Motivo de no realización:')) { const lineas = b.obs.split('\n').map(l => l.replace('• ','').trim()); document.querySelectorAll('#bk-motivo-lista input[type="checkbox"]').forEach(cb => { cb.checked = lineas.includes(cb.value); }); }
  }, 150);
  abrirModal('modal-backup');
}

async function _guardar() {
  const serial = getSSValue('bk-equipo-ss');
  if (!serial) { showToast('⚠️ Selecciona un equipo', '#d97706'); return; }
  _ejecutarGuardarBk(null);
}

function _pedirFirmaYGuardarBk() {
  window._actividadesTempBk = Array.from(document.querySelectorAll('#bk-actividades-lista input[type="checkbox"]:checked')).map(cb => cb.value);
  window._obsTempBk = document.getElementById('bk-obs')?.value || '';
  _abrirFirma('backup', 'nuevo', (firmaBase64) => { _ejecutarGuardarBk(firmaBase64); });
}

async function _ejecutarGuardarBk(firmaBase64 = null) {
  const serial    = getSSValue('bk-equipo-ss');
  const personaId = getSSValue('bk-persona-ss');
  const tipo      = document.getElementById('bk-tipo').value;
  const destino   = document.getElementById('bk-destino').value;
  const estadoBk  = document.getElementById('bk-estado').value;
  const ubicacion = document.getElementById('bk-ubicacion').value;
  const respTI    = document.getElementById('bk-resp-ti').value;
  const frecuencia= document.getElementById('bk-frecuencia').value;
  const fechaRaw  = document.getElementById('bk-fecha').value;
  const proxRaw   = document.getElementById('bk-fecha-proxima').value;
  const editId    = document.getElementById('bk-edit-id').value;
  const fmt = r => r ? new Date(r+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
  const fecha        = fmt(fechaRaw) || new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
  const fechaProxima = fmt(proxRaw);
  const DB = getDBStatic();
  const p  = DB.personas.find(x => x.id === personaId);
  const actividadesMarcadas = window._actividadesTempBk || Array.from(document.querySelectorAll('#bk-actividades-lista input[type="checkbox"]:checked')).map(cb => cb.value);
  const obs = window._obsTempBk !== undefined && window._obsTempBk !== null ? window._obsTempBk : (document.getElementById('bk-obs')?.value || '');
  window._actividadesTempBk = null; window._obsTempBk = null;
  const motivosMarcados = ['Fallido','No realizado'].includes(estadoBk) ? Array.from(document.querySelectorAll('#bk-motivo-lista input[type="checkbox"]:checked')).map(cb => cb.value) : [];
  const obsCompleto = motivosMarcados.length
    ? 'Motivo de no realización:\n' + motivosMarcados.map(a => `• ${a}`).join('\n') + (obs ? '\n\nObservaciones adicionales:\n' + obs : '')
    : actividadesMarcadas.length
      ? 'Actividades realizadas:\n' + actividadesMarcadas.map(a => `• ${a}`).join('\n') + (obs ? '\n\nObservaciones adicionales:\n' + obs : '')
      : obs;
  const bkActual = editId ? getData('backups').find(x => x.id === editId) : null;
  const firmaFinal   = firmaBase64 || bkActual?.firma || null;
  const firmadoFinal = !!firmaFinal;
  const campos = { serial, personaId, tipo, destino, estadoBk, obs: obsCompleto, ubicacion, respTI, frecuencia, fechaProxima, fotos: bkFotos, responsableEquipo: p?.nombre || '', firmado: firmadoFinal, firma: firmaFinal, firmaFecha: firmaBase64 ? new Date().toISOString() : (bkActual?.firmaFecha || null) };
  const lista = [...getData('backups')];
  if (editId) {
    const idx = lista.findIndex(x => x.id === editId);
    if (idx >= 0) lista[idx] = { ...lista[idx], ...campos, fecha };
    apiPost('Backups', 'update', { serial, tipo, frecuencia, fecha, fechaProxima, destino, estadoBk, obs: obsCompleto, respTI, personaId, fotos: bkFotos, firmado: firmadoFinal, firma: firmaFinal || null }, 'id', editId).catch(console.warn);
    showToast('✅ Backup actualizado');
  } else {
    const id = uid();
    lista.push({ id, fecha, ...campos });
    apiPost('Backups', 'insert', { id, serial, tipo, frecuencia, fecha, fechaProxima, destino, estadoBk, obs: obsCompleto, respTI, personaId, fotos: bkFotos, firmado: firmadoFinal, firma: firmaFinal || null, firmaFecha: firmaBase64 ? new Date().toISOString() : null }, 'id', id).catch(console.warn);
    showToast('💾 Backup registrado');
  }
  setState('backups', lista);
  saveKey('backups');
  cerrarModal('modal-backup');
  document.querySelectorAll('#bk-actividades-lista input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.body.style.overflow = '';
  renderLista();
}

window._guardarBackup = _guardar;

function _firmar(id) {
  const b = getData('backups').find(x => x.id === id);
  if (!b) return;
  if (b.firmado) { showToast('✅ Ya está firmado'); return; }
  _abrirFirma('backup', id, (firmaBase64) => {
    const lista = getData('backups').map(x => x.id !== id ? x : { ...x, firmado:true, firma:firmaBase64, firmaFecha:new Date().toISOString() });
    setState('backups', lista);
    saveKey('backups');
    apiPost('Backups','update',{ firmado: true, firma: firmaBase64, firmaFecha: new Date().toISOString() },'id',id).catch(console.warn);
    showToast('✅ Firma de backup registrada');
    renderLista();
  });
}

function _eliminar(id) {
  if (!confirm('¿Eliminar este backup?')) return;
  const lista = getData('backups').filter(b => b.id !== id);
  setState('backups', lista);
  saveKey('backups');
  apiPost('Backups', 'delete', {}, 'id', id).catch(console.warn);
  showToast('🗑️ Eliminado');
  renderLista();
}

function _procesarFotos(files, arr, previewId) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 800; const ratio = Math.min(1, maxW / img.width);
        canvas.width = img.width * ratio; canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        arr.push(canvas.toDataURL('image/jpeg', 0.4));
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
  grid.innerHTML = arr.map((src,i) => `<div class="foto-thumb"><img src="${src}" alt="foto ${i+1}"><button class="foto-del" data-idx="${i}">✕</button></div>`).join('');
  grid.querySelectorAll('.foto-del').forEach(btn => { btn.addEventListener('click', () => { arr.splice(+btn.dataset.idx,1); _renderFotosPreview(arr,previewId); }); });
}

function _crearEquipoRapido() {
  const modalBk = document.getElementById('modal-backup');
  modalBk?.classList.remove('open');
  import('./inventario.js').then(mod => {
    mod.abrirNuevo();
    const modalEq = document.getElementById('modal-equipo');
    if (!modalEq) return;
    const observer = new MutationObserver(() => {
      if (!modalEq.classList.contains('open')) {
        observer.disconnect();
        setTimeout(() => {
          modalBk?.classList.add('open');
          const equipos = getData('equipos');
          const ultimo  = equipos[equipos.length - 1];
          if (!ultimo) return;
          const DB = getDBStatic();
          llenarSSEquipos('bk-equipo-ss', () => {}, _crearEquipoRapido);
          setSSValue('bk-equipo-ss', ultimo.serial, `${ultimo.serial}${ultimo.marca ? ' — ' + ultimo.marca : ''}`);
          const p = DB.personas.find(x => x.id === ultimo.usuarioId);
          if (p) { llenarSSPersonas('bk-persona-ss', () => {}, _crearFuncionarioRapido); setSSValue('bk-persona-ss', p.id, p.nombre); }
        }, 200);
      }
    });
    observer.observe(modalEq, { attributes: true, attributeFilter: ['class'] });
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
        <div class="form-group"><label class="form-label">Nombre *</label><input type="text" class="form-input" id="func-r-nombre" placeholder="Nombre del funcionario"></div>
        <div class="form-group"><label class="form-label">Cargo</label><input type="text" class="form-input" id="func-r-cargo"></div>
        <div class="form-group"><label class="form-label">Correo</label><input type="email" class="form-input" id="func-r-correo" placeholder="correo@nemocon.gov.co"></div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;" onclick="document.getElementById('modal-func-rapido').classList.remove('open')">Cancelar</button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;" id="func-r-save-btn">👤 Guardar</button>
        </div>
      </div>
    </div>`;
  document.getElementById('modals-container').appendChild(div.firstElementChild);
  document.getElementById('func-r-save-btn').addEventListener('click', () => {
    const nombre = document.getElementById('func-r-nombre').value.trim();
    const cargo  = document.getElementById('func-r-cargo').value;
    const correo = document.getElementById('func-r-correo').value;
    if (!nombre) { showToast('⚠️ El nombre es obligatorio','#d97706'); return; }
    const DB = getDBStatic(); const id = 'P' + Date.now();
    DB.personas.push({ id, nombre, cargo, correo, imagen:'' });
    apiPost('Personas','insert',{ id, nombre, cargo, correo },'id',id).catch(console.warn);
    llenarSSPersonas('bk-persona-ss', ()=>{}, _crearFuncionarioRapido);
    setSSValue('bk-persona-ss', id, nombre);
    document.getElementById('modal-func-rapido').classList.remove('open');
    showToast(`👤 ${nombre} registrado`);
  });
}

const ACTIVIDADES_BACKUP = ['Verificación del espacio disponible en destino','Copia de documentos institucionales','Copia de correos y configuraciones','Copia de base de datos local','Copia de escritorio y descargas','Copia de software instalado (lista)','Verificación de integridad del backup','Prueba de restauración parcial','Eliminación de backups anteriores obsoletos','Registro de ruta y nombre del archivo backup','Notificación al funcionario del resultado','Etiquetado del medio de almacenamiento'];

window._actualizarActividadesBk = function() {
  const lista = document.getElementById('bk-actividades-lista');
  if (!lista) return;
  lista.innerHTML = ACTIVIDADES_BACKUP.map((act, i) => `
    <label class="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
      <input type="checkbox" id="bk-act-${i}" value="${act}" class="w-3.5 h-3.5 cursor-pointer"> ${act}
    </label>`).join('');
};

window._guardarBackup = _guardar;
