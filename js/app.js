import { CONFIG }           from './config.js';
import { initStorage, loadFromStorage, saveToStorage } from './storage.js';
import { setState, getState }   from './state.js';
import { apiGet, cargarDatosDesdeSheets } from './api.js';
import { navigate, registerRoute }        from './router.js';
import { showToast }        from './ui/toast.js';
import { renderMenu, renderHeader } from './ui/menu.js';

// Módulos de páginas
import * as Dashboard      from './modules/dashboard.js';
import * as Mantenimientos from './modules/mantenimientos.js';
import * as Backups        from './modules/backups.js';
import * as Inventario     from './modules/inventario.js';
import * as Incidencias    from './modules/incidencias.js';
import * as Estadisticas   from './modules/estadisticas.js';
import * as Reportes       from './modules/reportes.js';
import * as Calendario     from './modules/calendario.js';

// ─── REGISTRO DE RUTAS ────────────────────────────────────────
registerRoute('dashboard',     Dashboard);
registerRoute('mantenimientos',Mantenimientos);
registerRoute('backups',       Backups);
registerRoute('inventario',    Inventario);
registerRoute('incidencias',   Incidencias);
registerRoute('estadisticas',  Estadisticas);
registerRoute('reportes',      Reportes);
registerRoute('calendario',    Calendario);

// ─── INICIALIZACIÓN ───────────────────────────────────────────
async function init() {
  initStorage();
  loadFromStorage();

  renderHeader();
  renderMenu();

  // Esperar que el DOM esté completamente listo
  await new Promise(resolve => setTimeout(resolve, 0));

  // Página inicial
  const hashPage = location.hash.replace('#', '') || 'dashboard';
  await navigate(hashPage);

  // Sincronizar en background (sin bloquear)
  syncData().catch(err => console.warn('[Sync]', err));

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

// ─── SINCRONIZACIÓN ───────────────────────────────────────────
export async function syncData() {
  const btn = document.getElementById('sync-btn');
  if (btn) btn.classList.add('syncing');
  setState('syncStatus', 'syncing');

  try {
    const { deps, ofs, pers, eqs, mantsSheet, bksSheet } =
      await cargarDatosDesdeSheets();

    // Normalizar y guardar en estado
    setState('DB_STATIC', {
      dependencias: deps.map(r => ({ id: String(r.ID), nombre: r.Nombre || '', responsable: r.Responsable || '' })),
      oficinas:     ofs.map(r  => ({ id: String(r.ID), nombre: r.Nombre || '', depId: String(r.DepID) })),
      personas:     pers.map(r => ({ id: String(r.ID), nombre: r.Nombre || '', imagen: r.Imagen_Base64 || '' })),
    });

    setState('equipos', eqs.map(r => ({
      serial:   String(r.Serial),
      oficina:  String(r.OficinaID),
      usuarioId:String(r.UsuarioID || ''),
      so:       r.SO || '', office: r.Office || '',
      disco:    r.Disco || '', cap: r.Capacidad || '',
      ram:      r.RAM || '', obs: r.Observaciones || '',
      marca:    r.Marca || '', modelo: r.Modelo || '',
      procesador: r.Procesador || '', estado: r.Estado || 'Operativo',
    })));

    // Mantener firmas/fotos del localStorage al mergear mantenimientos
    const localMantMap = {};
    (getState('mantenimientos') || []).forEach(m => { localMantMap[m.id] = m; });
    setState('mantenimientos', mantsSheet.map(r => {
      const base = {
        id: String(r.ID), serial: String(r.EquipoID || r.Serial || ''),
        tipo: r.Tipo || '', frecuencia: r.Frecuencia || '',
        fecha: r.Fecha_Ultima || r.Fecha || '',
        fechaProxima: r.Fecha_Proxima || '',
        firmado: r.Firmado === 'TRUE' || r.Firmado === 'Sí',
        responsable: r.Responsable || 'Emerson Pachon',
        obs: r.Observaciones || '', firma: null, fotos: [],
      };
      const local = localMantMap[base.id];
      if (local) {
        base.firmado    = local.firmado;
        base.firma      = local.firma;
        base.firmaFecha = local.firmaFecha;
        base.fotos      = local.fotos || [];
      }
      return base;
    }));

    const localBkMap = {};
    (getState('backups') || []).forEach(b => { localBkMap[b.id] = b; });
    setState('backups', bksSheet.map(r => {
      const base = {
        id: String(r.ID), serial: String(r.EquipoID || ''),
        tipo: r.Tipo || '', destino: r.Ubicacion || '',
        fecha: r.Fecha_Ultima || '', fechaProxima: r.Fecha_Proxima || '',
        firmado: r.Firmado === 'TRUE' || r.Firmado === 'Sí',
        responsable: r.Responsable || '', obs: r.Observaciones || '',
        estadoBk: r.Estado || 'Completado', fotos: [],
      };
      const local = localBkMap[base.id];
      if (local) { base.firmado = local.firmado; base.firma = local.firma; base.fotos = local.fotos || []; }
      return base;
    }));

    saveToStorage();
    setState('syncStatus', 'idle');
    showToast('✅ Datos sincronizados');

    // Re-renderizar página actual si es el dashboard
    if (getState('currentPage') === 'dashboard') navigate('dashboard');

  } catch (err) {
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