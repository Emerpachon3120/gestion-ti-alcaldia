import { CONFIG } from './config.js';

// GET genérico
export async function apiGet(sheet, extraParams = '') {
  const url = `${CONFIG.BACKEND_URL}?sheet=${encodeURIComponent(sheet)}${extraParams}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer ${sheet}`);
  const json = await res.json();
  if (json.status !== 200) throw new Error(json.error || `Error leyendo ${sheet}`);
  return json.data;
}

// POST genérico
export async function apiPost(sheet, action, data, keyField, keyValue) {
  console.log('BACKEND_URL:', CONFIG.BACKEND_URL);
  const body = JSON.stringify({ sheet, action, data, keyField, keyValue });
  const res  = await fetch(CONFIG.BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 200) throw new Error(json.error || 'Error backend');
  return json.data;
}

// Cargar todos los datos iniciales
export async function cargarDatosDesdeSheets() {
  const [deps, ofs, pers, eqs, mantsSheet, bksSheet] = await Promise.all([
    apiGet('Dependencias'),
    apiGet('Oficinas'),
    apiGet('Personas'),
    apiGet('Equipos'),
    apiGet('Mantenimientos'),
    apiGet('Backups'),
  ]);
  return { deps, ofs, pers, eqs, mantsSheet, bksSheet };
}