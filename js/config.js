// Configuración global de la aplicación
export const CONFIG = {
  BACKEND_URL:     'https://script.google.com/macros/s/AKfycbyS3odr-R6Epz4c3wqD7NMVd0xunil8l26ntWxIqP65XRAQ9v-ea3yXk_hmYWBGWbHdDg/exec',
  FORMS_SPREAD_ID: '16lGe0Qz0C_6mviquMLsNcFA3spVwrSFKxA5xJP0qv4E',
  FORMS_SHEET_NAME:'Incidencias',
  CACHE_VERSION:   '3.0',
  APP_NAME:        'Gestión TI',
  ENTIDAD:         'Alcaldía Municipal de Nemocón',
  RESPONSABLE_TI:  'Emerson Pachón Ayala',
  VERSION:         '3.0.0',
};

export const MENU_ITEMS = [
  { id: 'inicio',          label: 'Inicio',         icon: '🏠', page: 'dashboard' },
  { id: 'mantenimientos',  label: 'Mantenimiento',  icon: '🔧', page: 'mantenimientos' },
  { id: 'backups',         label: 'Backups',         icon: '💾', page: 'backups' },
  { id: 'equipos',         label: 'Equipos',         icon: '💻', page: 'inventario' },
  { id: 'incidencias',     label: 'Incidencias',     icon: '🚨', page: 'incidencias' },
  { id: 'estadisticas',    label: 'Estadísticas',    icon: '📊', page: 'estadisticas' },
  { id: 'reportes',        label: 'Reportes',        icon: '📋', page: 'reportes' },
  { id: 'calendario',      label: 'Calendario',      icon: '📅', page: 'calendario' },
];

export const DEPENDENCIAS_STATIC = [
  'Secretaría General y de Gobierno',
  'Secretaría de Hacienda',
  'Secretaría de Planeación',
  'Secretaría Agropecuaria y Ambiental',
  'Secretaría de Servicios Públicos',
  'Coordinación Salud',
  'Coordinación Programas Sociales',
  'Control Interno',
];