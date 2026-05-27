import { CONFIG }           from './config.js';
import { initStorage, loadFromStorage, saveToStorage } from './storage.js';
import { setState, getState }   from './state.js';
import { apiGet, cargarDatosDesdeSheets } from './api.js';
import { navigate, registerRoute }        from './router.js';
import { showToast }        from './ui/toast.js';
import { renderMenu, renderHeader } from './ui/menu.js';
import * as Administracion from './modules/administracion.js';
registerRoute('administracion', Administracion);

// Módulos de páginas
import * as Dashboard      from './modules/dashboard.js';
import * as Mantenimientos from './modules/mantenimientos.js';
import * as Backups        from './modules/backups.js';
import * as Inventario     from './modules/inventario.js';
import * as Incidencias    from './modules/incidencias.js';
import * as Estadisticas   from './modules/estadisticas.js';
import * as Reportes       from './modules/reportes.js';
import * as Calendario     from './modules/calendario.js';
import { cerrarDocViewer, docViewerPrint } from './ui/documento.js';


// ─── REGISTRO DE RUTAS ────────────────────────────────────────
registerRoute('dashboard',     Dashboard);
registerRoute('mantenimientos',Mantenimientos);
registerRoute('backups',       Backups);
registerRoute('inventario',    Inventario);
registerRoute('incidencias',   Incidencias);
registerRoute('estadisticas',  Estadisticas);
registerRoute('reportes',      Reportes);
registerRoute('calendario',    Calendario);

async function init() {
  initStorage();
  loadFromStorage();  // ← carga datos locales primero

  renderHeader();
  renderMenu();

  await new Promise(resolve => setTimeout(resolve, 0));

  // Navegar al dashboard con datos locales (rápido)
  const hashPage = location.hash.replace('#', '') || 'dashboard';
  await navigate(hashPage);

  // Sincronizar en background y actualizar dashboard
  syncData().then(() => {
    // Si estamos en dashboard, re-renderizar con datos frescos
    if (getState('currentPage') === 'dashboard') {
      navigate('dashboard');
    }
  }).catch(err => console.warn('[Sync]', err));

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  window.cerrarDocViewer = cerrarDocViewer;
  window.docViewerPrint  = docViewerPrint;
}

// ─── SINCRONIZACIÓN ───────────────────────────────────────────
export async function syncData() {
  const btn = document.getElementById('sync-btn');
  if (btn) btn.classList.add('syncing');

  try {
    const { deps, ofs, pers, eqs, mantsSheet, bksSheet } =
      await cargarDatosDesdeSheets();

    // ← AGREGA ESTA LÍNEA — cargar incidencias del Forms spreadsheet
    let incsSheet = [];
    try {
      incsSheet = await apiGet('Incidencias',
        `&formSpreadId=${CONFIG.FORMS_SPREAD_ID}`);
    } catch(e) {
      console.warn('Incidencias no cargaron:', e);
    }

    // ... resto del setState existente ...

    // ← AGREGA AL FINAL antes de saveToStorage()
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
        estado:      ['Finalizada','Cancelada'].includes(r['Estado']) ? 'cerrada' : 'abierta',
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

    saveToStorage();
    showToast('✅ Datos sincronizados');

  } catch(err) {
    console.error('[Sync]', err);
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