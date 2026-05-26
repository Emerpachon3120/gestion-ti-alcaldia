// Estado global reactivo
const _listeners = {};
const _state = {
  equipos:        [],
  mantenimientos: [],
  backups:        [],
  incidencias:    [],
  DB_STATIC: {
    dependencias: [],
    oficinas:     [],
    personas:     [],
  },
  currentPage:    'dashboard',
  loading:        false,
  syncStatus:     'idle', // 'idle' | 'syncing' | 'error'
};

// Suscribirse a cambios
export function subscribe(key, fn) {
  if (!_listeners[key]) _listeners[key] = [];
  _listeners[key].push(fn);
  return () => { _listeners[key] = _listeners[key].filter(f => f !== fn); };
}

// Leer estado
export function getState(key) {
  return key ? _state[key] : { ..._state };
}

// Actualizar estado y notificar
export function setState(key, value) {
  _state[key] = value;
  (_listeners[key] || []).forEach(fn => fn(value));
  (_listeners['*']  || []).forEach(fn => fn({ key, value }));
}

// Atajo para datos de módulos
export const getData     = (key) => _state[key] || [];
export const setData     = (key, val) => setState(key, val);
export const getDBStatic = () => _state.DB_STATIC;