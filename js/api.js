const CONFIG = window.APP_CONFIG;


// GET genérico
export async function apiGet(sheet, extraParams = '') {
  const url = `${CONFIG.BACKEND_URL}?sheet=${encodeURIComponent(sheet)}${extraParams}`;
  const res  = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer ${sheet}`);
  const json = await res.json();
  if (json.status !== 200) throw new Error(json.error || `Error leyendo ${sheet}`);
  return json.data;
}

// POST genérico
export async function apiPost(sheet, action, data, keyField, keyValue, spreadId = null) {
  const body = JSON.stringify({
    sheet, action, data, keyField, keyValue,
    spreadId: spreadId || null
  });

  const res = await fetch(CONFIG.BACKEND_URL, {
    method:   'POST',
    headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
    mode:     'cors',
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json.status !== 200) throw new Error(json.error || 'Error backend');
    return json.data;
  } catch(e) {
    console.warn('Response no es JSON:', text);
    return { ok: true };
  }
}

// Cargar todos los datos iniciales
export async function cargarDatosDesdeSheets() {
  const [deps, ofs, pers, eqs, mantsSheet, bksSheet, cronogramaSheet] = await Promise.all([
    apiGet('Dependencias'),
    apiGet('Oficinas'),
    apiGet('Personas'),
    apiGet('Equipos'),
    apiGet('Mantenimientos'),
    apiGet('Backups'),
    apiGet('Cronograma'),
  ]);
  return { deps, ofs, pers, eqs, mantsSheet, bksSheet, cronogramaSheet };
}