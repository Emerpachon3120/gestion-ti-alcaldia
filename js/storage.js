import { CONFIG } from './config.js';
import { setState, getState } from './state.js';

const KEYS = ['equipos', 'mantenimientos', 'backups', 'incidencias', 'DB_STATIC'];
// Limpiar caché si cambia la versión
export function initStorage() {
  if (localStorage.getItem('cache_version') !== CONFIG.CACHE_VERSION) {
    KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.setItem('cache_version', CONFIG.CACHE_VERSION);
    console.info('[Storage] Cache limpiada, versión:', CONFIG.CACHE_VERSION);
  }
}

// Cargar datos desde localStorage al estado
export function loadFromStorage() {
  KEYS.forEach(key => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { setState(key, JSON.parse(raw)); }
      catch (e) { console.warn('[Storage] Error parseando', key, e); }
    }
  });
}

// Persistir estado actual en localStorage
export function saveToStorage() {
  KEYS.forEach(key => {
    const data = getState(key);
    if (data) localStorage.setItem(key, JSON.stringify(data));
  });
}

// Guardar clave específica
export function saveKey(key) {
  const data = getState(key);
  if (data !== undefined) localStorage.setItem(key, JSON.stringify(data));
}

// Limpiar todo
export function clearStorage() {
  KEYS.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('cache_version');
}