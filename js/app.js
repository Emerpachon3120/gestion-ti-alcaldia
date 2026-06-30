import { CONFIG }           from './config.js';
import { initStorage, loadFromStorage, saveToStorage, saveKey } from './storage.js';
import { setState, getState }   from './state.js';
import { apiGet, cargarDatosDesdeSheets } from './api.js';
import { navigate, registerRoute, forceNavigate } from './router.js';
import { showToast }        from './ui/toast.js';
import { renderMenu, renderHeader } from './ui/menu.js';
import { cerrarDocViewer, docViewerPrint } from './ui/documento.js';
import { abrirFirma } from './ui/firma.js';

// Módulos de páginas
import * as Dashboard      from './modules/dashboard.js';
import * as Mantenimientos from './modules/mantenimientos.js';
import * as Backups        from './modules/backups.js';
import * as Inventario     from './modules/inventario.js';
import * as Incidencias    from './modules/incidencias.js';
import * as Estadisticas   from './modules/estadisticas.js';
import * as Reportes       from './modules/reportes.js';
import * as Calendario     from './modules/calendario.js';
import * as Administracion from './modules/administracion.js';

// ─── REGISTRO DE RUTAS ────────────────────────────────────────
registerRoute('dashboard',      Dashboard);
registerRoute('mantenimientos', Mantenimientos);
registerRoute('backups',        Backups);
registerRoute('inventario',     Inventario);
registerRoute('incidencias',    Incidencias);
registerRoute('estadisticas',   Estadisticas);
registerRoute('reportes',       Reportes);
registerRoute('calendario',     Calendario);
registerRoute('administracion', Administracion);

window._abrirFirmaGlobal = abrirFirma;

async function init() {
  initStorage();
  loadFromStorage();

  renderHeader();
  renderMenu();

  await new Promise(resolve => setTimeout(resolve, 0));

  // Mostrar loader mientras sincroniza
  try {
    await syncData();
  } catch(err) {
    console.warn('[Sync]', err);
  }

  // Ocultar loader
  const loader = document.getElementById('page-loader');
  if (loader) loader.classList.add('hidden');

  // Pequeño delay antes de renderizar dashboard
  await new Promise(resolve => setTimeout(resolve, 100));
  await forceNavigate('dashboard');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  window.cerrarDocViewer = cerrarDocViewer;
  window.docViewerPrint  = docViewerPrint;

  // Swipe entre módulos
const pages = ['dashboard','mantenimientos','backups','inventario','incidencias'];
let touchStartX = 0;
let touchStartY = 0;

document.getElementById('app-main').addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.getElementById('app-main').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;

  // Solo swipe horizontal y que sea mayor a 60px
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;

  const current = getState('currentPage');
  const idx = pages.indexOf(current);
  if (idx === -1) return;

  if (dx < 0 && idx < pages.length - 1) {
    // Swipe izquierda → siguiente módulo
    navigate(pages[idx + 1]);
  } else if (dx > 0 && idx > 0) {
    // Swipe derecha → módulo anterior
    navigate(pages[idx - 1]);
  }
}, { passive: true });
}

// ─── SINCRONIZACIÓN ───────────────────────────────────────────
export async function syncData() {
  const btn = document.getElementById('sync-btn');
  if (btn) btn.classList.add('syncing');
  setState('syncStatus', 'syncing');
  saveKey('DB_STATIC');

  try {
    const { deps, ofs, pers, eqs, mantsSheet, bksSheet, cronogramaSheet } =
      await cargarDatosDesdeSheets();

    // DB_STATIC
    setState('DB_STATIC', {
      dependencias: deps.map(r => ({
        id:            String(r.ID),
        nombre:        r.Nombre || '',
        responsable:   r.Responsable || '',
        responsableId: String(r.ResponsableID || ''),
      })),
      oficinas: ofs.map(r => ({
        id: String(r.ID), nombre: r.Nombre || '', depId: String(r.DepID)
      })),
      personas: pers.map(r => ({
        id: String(r.ID), nombre: r.Nombre || '', imagen: r.Imagen_Base64 || '',
        cargo: r.Cargo || '', correo: r.Correo || ''
      })),
    });

    saveKey('DB_STATIC');

   // Equipos — preservar fotos y componentes locales
const localEqMap = {};
(getState('equipos') || []).forEach(e => { localEqMap[e.serial] = e; });

setState('equipos', eqs.map(r => {
  const base = {
    serial:     String(r.Serial),
    oficina:    String(r.OficinaID),
    usuarioId:  String(r.UsuarioID || ''),
    so:         r.SO || '', office: r.Office || '',
    disco:      r.Disco || '', cap: r.Capacidad || '',
    ram:        r.RAM || '', obs: r.Observaciones || '',
    marca:      r.Marca || '', modelo: r.Modelo || '',
    procesador: r.Procesador || '', estado: r.Estado || 'Operativo',
    ubicacion:  r.Ubicacion || '', fechaCompra: r.Fecha_Compra || '',
    garantia:   r.Garantia || '', tipoEquipo: r.Tipo_Equipo || '',
    componentes: r.Componentes ? r.Componentes.split(',').filter(Boolean) : [],
  };
  // Preservar fotos locales
  const local = localEqMap[base.serial];
  if (local) {
    base.fotosComponentes = local.fotosComponentes || {};
    base.fotos = local.fotos || [];
  }
  return base;
}));
saveKey('equipos');

    // Mantenimientos — preservar firmas y fotos locales
    // La firma (Imagen_Base64) ahora viaja en el Sheet, así que prevalece
    // la del Sheet si existe; si no, cae al respaldo local.
    const localMantMap = {};
    (getState('mantenimientos') || []).forEach(m => { localMantMap[m.id] = m; });
    setState('mantenimientos', mantsSheet.map(r => {
      const firmaSheet = r.Imagen_Base64 && r.Imagen_Base64.startsWith('data:image')
        ? r.Imagen_Base64
        : null;

      const base = {
        id:           String(r.ID),
        serial:       String(r.EquipoID || r.Serial || ''),
        tipo:         r.Tipo || '',
        frecuencia:   r.Frecuencia || '',
        fecha:        r.Fecha_Ultima || r.Fecha || '',
        fechaProxima: r.Fecha_Proxima || '',
        firmado:      r.Firmado === 'TRUE' || r.Firmado === 'Sí',
        responsable:  r.Responsable || '',
        obs:          r.Observaciones || '',
        periodo:      r.Periodo || '',
        respEquipoId: String(r.Resp_Equipo_ID || ''),
        cambioResp:   r.Cambio_Resp || 'No',
        nuevoRespId:  String(r.Nuevo_Resp_ID || ''),
        userWin:      r.User_Win || '',
        passWin:      r.Pass_Win || '',
        userAdmin:    r.User_Admin || '',
        passAdmin:    r.Pass_Admin || '',
        cambioCred:   r.Cambio_Cred || 'No',
        traslado:     r.Traslado || 'No',
        depAnterior:  r.Dep_Anterior || '',
        depNueva:     r.Dep_Nueva || '',
        fechaTraslado:r.Fecha_Traslado || '',
        estadoEquipo: r.Estado_Equipo || '',
        firma: firmaSheet, fotos: [],
      };
      const local = localMantMap[base.id];
      if (local) {
          // Firma: prioridad → Sheet (fuente de verdad multi-dispositivo) → local
          if (r.Firmado === 'No') {
            base.firmado    = false;
            base.firma      = null;
            base.firmaFecha = null;
          } else {
            base.firmado    = true;
            base.firma      = firmaSheet || local.firma || null;
            base.firmaFecha = local.firmaFecha || null;
          }
          base.fotos      = local.fotos || [];
          base.userWin       = local.userWin      || base.userWin;
          base.passWin       = local.passWin      || base.passWin;
          base.userAdmin     = local.userAdmin    || base.userAdmin;
          base.passAdmin     = local.passAdmin    || base.passAdmin;
          base.cambioCred    = local.cambioCred   || base.cambioCred;
          base.cambioResp    = local.cambioResp   || base.cambioResp;
          base.respEquipoId  = local.respEquipoId || base.respEquipoId;
          base.nuevoRespId   = local.nuevoRespId  || base.nuevoRespId;
          base.traslado      = local.traslado     || base.traslado;
          base.depAnterior   = local.depAnterior  || base.depAnterior;
          base.depNueva      = local.depNueva     || base.depNueva;
          base.fechaTraslado = local.fechaTraslado|| base.fechaTraslado;
          base.estadoEquipo  = local.estadoEquipo || base.estadoEquipo;
          base.periodo       = local.periodo      || base.periodo;
          base.obs           = local.obs          || base.obs;
        } else {
          // Sin registro local: la firma viene solo del Sheet
          base.firma = firmaSheet;
        }
        return base;
    }));

    // Backups — preservar firmas y fotos locales
    // Igual que mantenimientos: el Sheet es la fuente de verdad para la firma
    const localBkMap = {};
    (getState('backups') || []).forEach(b => { localBkMap[b.id] = b; });
    setState('backups', bksSheet.map(r => {
      const firmaSheet = r.Imagen_Base64 && r.Imagen_Base64.startsWith('data:image')
        ? r.Imagen_Base64
        : null;

      const base = {
        id:           String(r.ID),
        serial:       String(r.EquipoID || ''),
        tipo:         r.Tipo || '',
        destino:      r.Ubicacion || '',
        fecha:        r.Fecha_Ultima || '',
        fechaProxima: r.Fecha_Proxima || '',
        firmado:      r.Firmado === 'TRUE' || r.Firmado === 'Sí',
        responsable:  r.Responsable || '',
        obs:          r.Observaciones || '',
        estadoBk:     r.Estado || 'Completado',
        frecuencia:   r.Frecuencia || '',
        respTI:       r.Resp_TI || '',
        personaId:    String(r.Persona_ID || ''),
        firma: firmaSheet,
        fotos: [],
      };
      const local = localBkMap[base.id];
      if (local) {
        if (r.Firmado === 'No') {
          base.firmado    = false;
          base.firma      = null;
          base.firmaFecha = null;
        } else {
          base.firmado    = true;
          base.firma      = firmaSheet || local.firma || null;
          base.firmaFecha = local.firmaFecha || null;
        }
        base.fotos      = local.fotos || [];
        base.responsableEquipo = local.responsableEquipo || '';
      }
      return base;
    }));

    // Incidencias
    let incsSheet = [];
    try {
      incsSheet = await apiGet('Incidencias',
        `&formSpreadId=${CONFIG.FORMS_SPREAD_ID}`);
    } catch(e) {
      console.warn('Incidencias no cargaron:', e);
    }
    const localIncMap = {};
    (getState('incidencias') || []).forEach(i => { localIncMap[i.id] = i; });
    setState('incidencias', incsSheet.map(r => {
      const ticket = r['Ticket'] || r['id'] || '';
      const base = {
        id:          ticket,
        ticket,
        fromForm:    true,
        fecha:       r['Marca temporal'] || '',
        secretaria:  r['Secretaria (Secretaria de la que depende)'] || '',
        oficina:     r['Oficina'] || '',
        nombre:      r['Nombre completo del funcionario'] || '',
        cargo:       r['Cargo'] || '',
        correo:      r['Correo institucional'] || '',
        telefono:    r['Teléfono'] || '',
        tipo:        r['Tipo de incidencia'] || '',
        desc:        r['Descripción del problema'] || '',
        prioridad:   (r['Grado de importancia'] || 'media').toLowerCase(),
        estadoTexto: r['Estado'] || 'Iniciada',
        estado:      ['Finalizado','Cancelada'].includes(r['Estado']) ? 'cerrada' : 'abierta',
        observacion: r['Observación'] || '',
        responsableAtencion: r['Responsable_Atencion'] || '',
        fechaApertura: r['Fecha_Apertura'] || '',
        fechaCierre:   r['Fecha_Cierre'] || '',
        fotos: [],
      };
      const local = localIncMap[ticket];
      if (local) { base.fotos = local.fotos || []; }
      return base;
    }));

    // Cronograma anual (informativo, editable desde el módulo de Calendario)
    setState('cronograma', (cronogramaSheet || []).map(r => {
      const row = {
        id:            String(r.ID || ''),
        dependenciaId: String(r.DependenciaID || ''),
        tipo:          (r.Tipo || '').toLowerCase() === 'mantenimiento' ? 'mantenimientos' : 'backups',
        anio:          Number(r.Anio) || new Date().getFullYear(),
      };
      for (let i = 1; i <= 12; i++) {
        row[`mes${i}`] = r[`Mes${i}`] || 'No';
      }
      return row;
    }));

    saveToStorage();
    setState('syncStatus', 'idle');
    showToast('Datos sincronizados correctamente');
// Re-renderizar dashboard si está activo
    if (typeof navigate === 'function') {
      navigate('dashboard');
    }

  } catch(err) {
    console.error('[Sync]', err);
    setState('syncStatus', 'error');
    showToast('⚠️ Sin conexión — usando datos locales', '#d97706');
  } finally {
    if (btn) btn.classList.remove('syncing');
  }
}

// Exponer globalmente funciones que se usan en onclick HTML
window.syncData    = syncData;
window.navigate    = navigate;
window.fabAction   = fabAction;

function fabAction() {
  const page = getState('currentPage');
  const actions = {
    mantenimientos: () => window.abrirNuevoMantto?.(),
    backups:        () => window.abrirNuevoBackup?.(),
    incidencias:    () => window.abrirNuevaIncidencia?.(),
    inventario:     () => window.abrirNuevoEquipo?.(),
    dashboard:      () => navigate('mantenimientos'),
  };
  actions[page]?.();
}

// ─── ARRANCAR ─────────────────────────────────────────────────
init();
