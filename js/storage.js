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

// ─── Escritura segura ─────────────────────────────────────────
// localStorage tiene un tope (~5 MB). Las fotos de mantenimientos y backups
// ya viven en Firestore, así que si no caben se guarda la caché local sin
// ellas (se vuelven a leer de Firestore en cada sincronización).
// Nunca lanza error: un fallo de caché no debe romper el guardado.
const KEYS_FOTOS_EN_FIRESTORE = ['mantenimientos', 'backups'];

function _sinFotos(data) {
  if (!Array.isArray(data)) return data;
  return data.map(r => {
    if (!r || typeof r !== 'object') return r;
    const { fotos, ...resto } = r;
    return { ...resto, fotos: [] };
  });
}

function _persistir(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    if (KEYS_FOTOS_EN_FIRESTORE.includes(key)) {
      try {
        localStorage.setItem(key, JSON.stringify(_sinFotos(data)));
        console.warn('[Storage] Sin espacio: caché de', key, 'guardada sin fotos');
        return true;
      } catch (e2) {
        console.warn('[Storage] No se pudo guardar', key, e2);
        return false;
      }
    }
    console.warn('[Storage] No se pudo guardar', key, e);
    return false;
  }
}

// ─── Persistir todo el estado en localStorage ─────────────────
export function saveToStorage() {
  KEYS.forEach(key => {
    const data = getState(key);
    if (data !== undefined) _persistir(key, data);
  });
}

// ─── Guardar una clave específica ─────────────────────────────
export function saveKey(key) {
  const data = getState(key);
  if (data !== undefined) _persistir(key, data);
}

// ─── Limpiar todo el caché ────────────────────────────────────
export function clearStorage() {
  KEYS.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('cache_version');
  console.info('[Storage] Cache limpiada manualmente');
}
