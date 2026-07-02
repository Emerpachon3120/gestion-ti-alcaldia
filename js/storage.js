// ─── storage.js ───────────────────────────────────────────────
// Caché en localStorage — misma interfaz que antes
// Compatible con la migración a Firebase
// ──────────────────────────────────────────────────────────────

import { CONFIG }           from './config.js';
import { setState, getState } from './state.js';

// Claves que se persisten en localStorage
// (cronograma se agrega respecto a la versión anterior)
const KEYS = [
  'equipos',
  'mantenimientos',
  'backups',
  'incidencias',
  'cronograma',
  'DB_STATIC',
];

// ─── Inicializar caché ────────────────────────────────────────
// Si cambia CONFIG.CACHE_VERSION se borra todo y se vuelve a
// descargar desde Firestore en el próximo syncData()
export function initStorage() {
  if (localStorage.getItem('cache_version') !== CONFIG.CACHE_VERSION) {
    KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.setItem('cache_version', CONFIG.CACHE_VERSION);
    console.info('[Storage] Cache limpiada, versión:', CONFIG.CACHE_VERSION);
  }
}

// ─── Cargar desde localStorage al estado ─────────────────────
export function loadFromStorage() {
  KEYS.forEach(key => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { setState(key, JSON.parse(raw)); }
      catch (e) { console.warn('[Storage] Error parseando', key, e); }
    }
  });
}

// ─── Persistir todo el estado en localStorage ─────────────────
export function saveToStorage() {
  KEYS.forEach(key => {
    const data = getState(key);
    if (data !== undefined) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  });
}

// ─── Guardar una clave específica ─────────────────────────────
export function saveKey(key) {
  const data = getState(key);
  if (data !== undefined) {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

// ─── Limpiar todo el caché ────────────────────────────────────
export function clearStorage() {
  KEYS.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('cache_version');
  console.info('[Storage] Cache limpiada manualmente');
}
