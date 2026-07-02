import { CONFIG }           from './config.js';
import { initStorage, loadFromStorage, saveToStorage, saveKey } from './storage.js';
import { setState, getState }   from './state.js';
import { apiGet, cargarDatosDesdeSheets } from './firebase.js';  // ← antes: ./api.js
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

  try {
    await syncData();
  } catch(err) {
    console.warn('[Sync]', err);
  }

  const loader = document.getElementById('page-loader');
  if (loader) loader.classList.add('hidden');

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
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    const current = getState('currentPage');
    const idx = pages.indexOf(current);
    if (idx === -1) return;
    if (dx < 0 && idx < pages.length - 1) navigate(pages[idx + 1]);
    else if (dx > 0 && idx > 0)           navigate(pages[idx - 1]);
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
      await cargarDatosDesdeSheets();   // viene de firebase.js

    // ── DB_STATIC ──────────────────────────────────────────────
    setState('DB_STATIC', {
      dependencias: deps.map(r => ({
        id:            String(r.id || r.ID || r._id),
        nombre:        r.nombre        || r.Nombre        || '',
        responsable:   r.responsable   || r.Responsable   || '',
        responsableId: String(r.responsableId || r.ResponsableID || ''),
      })),
      oficinas: ofs.map(r => ({
        id:    String(r.id || r.ID || r._id),
        nombre: r.nombre || r.Nombre || '',
        depId:  String(r.depId || r.DepID || ''),
      })),
      personas: pers.map(r => ({
        id:     String(r.id || r.ID || r._id),
        nombre: r.nombre || r.Nombre || '',
        imagen: r.imagen || r.Imagen_Base64 || '',
        cargo:  r.cargo  || r.Cargo  || '',
        correo: r.correo || r.Correo || '',
      })),
    });
    saveKey('DB_STATIC');

    // ── Equipos ────────────────────────────────────────────────
    const localEqMap = {};
    (getState('equipos') || []).forEach(e => { localEqMap[e.serial] = e; });

    setState('equipos', eqs.map(r => {
      const base = {
        serial:      String(r.serial      || r.Serial      || r._id),
        oficina:     String(r.oficina     || r.OficinaID   || ''),
        usuarioId:   String(r.usuarioId   || r.UsuarioID   || ''),
        so:          r.so          || r.SO          || '',
        office:      r.office      || r.Office      || '',
        disco:       r.disco       || r.Disco       || '',
        cap:         r.cap         || r.Capacidad   || '',
        ram:         r.ram         || r.RAM         || '',
        obs:         r.obs         || r.Observaciones|| '',
        marca:       r.marca       || r.Marca       || '',
        modelo:      r.modelo      || r.Modelo      || '',
        procesador:  r.procesador  || r.Procesador  || '',
        estado:      r.estado      || r.Estado      || 'Operativo',
        ubicacion:   r.ubicacion   || r.Ubicacion   || '',
        fechaCompra: r.fechaCompra || r.Fecha_Compra|| '',
        garantia:    r.garantia    || r.Garantia    || '',
        tipoEquipo:  r.tipoEquipo  || r.Tipo_Equipo || '',
        componentes: Array.isArray(r.componentes)
          ? r.componentes
          : (r.Componentes ? r.Componentes.split(',').filter(Boolean) : []),
      };
      const local = localEqMap[base.serial];
      if (local) {
        base.fotosComponentes = local.fotosComponentes || {};
        base.fotos = local.fotos || [];
      }
      return base;
    }));
    saveKey('equipos');

    // ── Mantenimientos ─────────────────────────────────────────
    const localMantMap = {};
    (getState('mantenimientos') || []).forEach(m => { localMantMap[m.id] = m; });

    setState('mantenimientos', mantsSheet.map(r => {
      // Firma: en Firestore ya viene como base64 directo en el campo 'firma'
      const firmaFS = (r.firma || r.Imagen_Base64 || '').startsWith('data:image')
        ? (r.firma || r.Imagen_Base64)
        : null;

      const base = {
        id:           String(r.id || r.ID || r._id),
        serial:       String(r.serial       || r.EquipoID    || r.Serial || ''),
        tipo:         r.tipo         || r.Tipo         || '',
        frecuencia:   r.frecuencia   || r.Frecuencia   || '',
        fecha:        r.fecha        || r.Fecha_Ultima  || r.Fecha || '',
        fechaProxima: r.fechaProxima || r.Fecha_Proxima || '',
        firmado:      r.firmado      ?? (r.Firmado === 'TRUE' || r.Firmado === 'Sí'),
        responsable:  r.responsable  || r.Responsable   || '',
        obs:          r.obs          || r.Observaciones  || '',
        periodo:      r.periodo      || r.Periodo        || '',
        respEquipoId: String(r.respEquipoId  || r.Resp_Equipo_ID || ''),
        cambioResp:   r.cambioResp   || r.Cambio_Resp   || 'No',
        nuevoRespId:  String(r.nuevoRespId   || r.Nuevo_Resp_ID  || ''),
        userWin:      r.userWin      || r.User_Win      || '',
        passWin:      r.passWin      || r.Pass_Win      || '',
        userAdmin:    r.userAdmin    || r.User_Admin    || '',
        passAdmin:    r.passAdmin    || r.Pass_Admin    || '',
        cambioCred:   r.cambioCred   || r.Cambio_Cred   || 'No',
        traslado:     r.traslado     || r.Traslado      || 'No',
        depAnterior:  r.depAnterior  || r.Dep_Anterior  || '',
        depNueva:     r.depNueva     || r.Dep_Nueva     || '',
        fechaTraslado:r.fechaTraslado|| r.Fecha_Traslado|| '',
        estadoEquipo: r.estadoEquipo || r.Estado_Equipo || '',
        firma: firmaFS,
        fotos: [],
      };

      const local = localMantMap[base.id];
      if (local) {
        if (!base.firmado) {
          base.firmado    = false;
          base.firma      = null;
          base.firmaFecha = null;
        } else {
          base.firma      = firmaFS || local.firma || null;
          base.firmaFecha = local.firmaFecha || null;
        }
        base.fotos         = local.fotos         || [];
        base.userWin       = local.userWin       || base.userWin;
        base.passWin       = local.passWin       || base.passWin;
        base.userAdmin     = local.userAdmin     || base.userAdmin;
        base.passAdmin     = local.passAdmin     || base.passAdmin;
        base.cambioCred    = local.cambioCred    || base.cambioCred;
        base.cambioResp    = local.cambioResp    || base.cambioResp;
        base.respEquipoId  = local.respEquipoId  || base.respEquipoId;
        base.nuevoRespId   = local.nuevoRespId   || base.nuevoRespId;
        base.traslado      = local.traslado      || base.traslado;
        base.depAnterior   = local.depAnterior   || base.depAnterior;
        base.depNueva      = local.depNueva      || base.depNueva;
        base.fechaTraslado = local.fechaTraslado || base.fechaTraslado;
        base.estadoEquipo  = local.estadoEquipo  || base.estadoEquipo;
        base.periodo       = local.periodo       || base.periodo;
        base.obs           = local.obs           || base.obs;
      } else {
        base.firma = firmaFS;
      }
      return base;
    }));

    // ── Backups ────────────────────────────────────────────────
    const localBkMap = {};
    (getState('backups') || []).forEach(b => { localBkMap[b.id] = b; });

    setState('backups', bksSheet.map(r => {
      const firmaFS = (r.firma || r.Imagen_Base64 || '').startsWith('data:image')
        ? (r.firma || r.Imagen_Base64)
        : null;

      const base = {
        id:           String(r.id || r.ID || r._id),
        serial:       String(r.serial      || r.EquipoID   || ''),
        tipo:         r.tipo         || r.Tipo        || '',
        destino:      r.destino      || r.Ubicacion   || '',
        fecha:        r.fecha        || r.Fecha_Ultima || '',
        fechaProxima: r.fechaProxima || r.Fecha_Proxima|| '',
        firmado:      r.firmado      ?? (r.Firmado === 'TRUE' || r.Firmado === 'Sí'),
        responsable:  r.responsable  || r.Responsable  || '',
        obs:          r.obs          || r.Observaciones|| '',
        estadoBk:     r.estadoBk     || r.Estado       || 'Completado',
        frecuencia:   r.frecuencia   || r.Frecuencia   || '',
        respTI:       r.respTI       || r.Resp_TI      || '',
        personaId:    String(r.personaId || r.Persona_ID || ''),
        firma: firmaFS,
        fotos: [],
      };

      const local = localBkMap[base.id];
      if (local) {
        if (!base.firmado) {
          base.firmado    = false;
          base.firma      = null;
          base.firmaFecha = null;
        } else {
          base.firma      = firmaFS || local.firma || null;
          base.firmaFecha = local.firmaFecha || null;
        }
        base.fotos             = local.fotos             || [];
        base.responsableEquipo = local.responsableEquipo || '';
      }
      return base;
    }));

    // ── Incidencias (ahora desde Firestore, no del Form directamente) ──
    let incsSheet = [];
    try {
      incsSheet = await apiGet('Incidencias');  // ← ya no necesita formSpreadId
    } catch(e) {
      console.warn('Incidencias no cargaron:', e);
    }

    const localIncMap = {};
    (getState('incidencias') || []).forEach(i => { localIncMap[i.id] = i; });

    setState('incidencias', incsSheet.map(r => {
      const ticket = r.ticket || r.Ticket || r.id || r.ID || r._id || '';
      const base = {
        id:          ticket,
        ticket,
        fromForm:    true,
        fecha:       r.fecha       || r['Marca temporal']                          || '',
        secretaria:  r.secretaria  || r['Secretaria (Secretaria de la que depende)']|| '',
        oficina:     r.oficina     || r['Oficina']                                  || '',
        nombre:      r.nombre      || r['Nombre completo del funcionario']           || '',
        cargo:       r.cargo       || r['Cargo']                                    || '',
        correo:      r.correo      || r['Correo institucional']                     || '',
        telefono:    r.telefono    || r['Teléfono']                                 || '',
        tipo:        r.tipo        || r['Tipo de incidencia']                       || '',
        desc:        r.desc        || r['Descripción del problema']                 || '',
        prioridad:   (r.prioridad  || r['Grado de importancia'] || 'media').toLowerCase(),
        estadoTexto: r.estadoTexto || r['Estado']     || 'Iniciada',
        estado:      r.estado      ||
          (['Finalizado','Cancelada'].includes(r['Estado']) ? 'cerrada' : 'abierta'),
        observacion:         r.observacion         || r['Observación']           || '',
        responsableAtencion: r.responsableAtencion || r['Responsable_Atencion'] || '',
        fechaApertura:       r.fechaApertura       || r['Fecha_Apertura']       || '',
        fechaCierre:         r.fechaCierre         || r['Fecha_Cierre']         || '',
        fotos: [],
      };
      const local = localIncMap[ticket];
      if (local) { base.fotos = local.fotos || []; }
      return base;
    }));

    // ── Cronograma ─────────────────────────────────────────────
    setState('cronograma', (cronogramaSheet || []).map(r => {
      const row = {
        id:            String(r.id || r.ID || r._id || ''),
        dependenciaId: String(r.dependenciaId || r.DependenciaID || ''),
        tipo:          (r.tipo || r.Tipo || '').toLowerCase() === 'mantenimiento'
                        ? 'mantenimientos' : 'backups',
        anio:          Number(r.anio || r.Anio) || new Date().getFullYear(),
      };
      for (let i = 1; i <= 12; i++) {
        row[`mes${i}`] = r[`mes${i}`] || r[`Mes${i}`] || 'No';
      }
      return row;
    }));

    saveToStorage();
    setState('syncStatus', 'idle');
    showToast('Datos sincronizados correctamente');
    if (typeof navigate === 'function') navigate('dashboard');

  } catch(err) {
    console.error('[Sync]', err);
    setState('syncStatus', 'error');
    showToast('⚠️ Sin conexión — usando datos locales', '#d97706');
  } finally {
    if (btn) btn.classList.remove('syncing');
  }
}

// ─── Exponer globalmente ───────────────────────────────────────
window.syncData  = syncData;
window.navigate  = navigate;
window.fabAction = fabAction;

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
