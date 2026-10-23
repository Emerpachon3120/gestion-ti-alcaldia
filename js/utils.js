// UID único
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// Formatear fecha dd/mm/yyyy
export function formatDate(str) {
  if (!str) return '—';
  const d = parseFecha(str);
  return d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : str;
}

// Parsear fecha desde múltiples formatos
export function parseFecha(str) {
  if (!str) return null;
  str = String(str).trim();
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

// Calcular semáforo de fechas
export function calcSemaforo(fechaProxima) {
  if (!fechaProxima) return null;
  const d = parseFecha(fechaProxima);
  if (!d) return null;
  // Se compara por día (no por hora): un mantenimiento programado para hoy
  // todavía no está vencido.
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diff = Math.round((d - hoy) / 86400000);
  if (diff < 0)   return { clase: 'semaforo-rojo',    icon: '🔴', label: 'Vencido' };
  if (diff <= 30) return { clase: 'semaforo-amarillo', icon: '🟡', label: 'Próximo' };
  return             { clase: 'semaforo-verde',    icon: '🟢', label: 'Al día' };
}

// Calcular fecha próxima según frecuencia
export function calcFechaProxima(fechaBase, frecuencia) {
  const d = new Date(fechaBase + 'T00:00:00');
  const meses = { Mensual: 1, Trimestral: 3, Semestral: 6, Anual: 12, Ocasional: 0 }[frecuencia] || 0;
  if (meses > 0) d.setMonth(d.getMonth() + meses);
  return d.toISOString().split('T')[0];
}

// Debounce
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Escapar HTML
export function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// Solo letras y espacios
export function soloLetras(input) {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
  });
}

// Solo números
export function soloNumeros(input) {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9.]/g, '');
  });
}

// Alfanumérico (letras + números)
export function alfaNumerico(input) {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '');
  });
}

// Texto para comparar/buscar: sin tildes, sin mayúsculas, sin espacios sobrantes
// ("Angélica" == "angelica"; "Muñoz" == "munoz")
export function normTxt(str) {
  return String(str ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

// ¿El texto `q` aparece en alguno de los campos? (insensible a tildes/mayúsculas)
export function coincide(q, ...campos) {
  const n = normTxt(q);
  if (!n) return true;
  return campos.some(c => normTxt(c).includes(n));
}

// Último registro (por fecha) de cada serial. Devuelve Map(serial → registro).
// En empate de fecha gana el que está más adelante en la lista.
export function ultimosPorSerial(lista) {
  const out = new Map();
  const t = r => { const d = parseFecha(r?.fecha); return d ? d.getTime() : -Infinity; };
  for (const r of lista || []) {
    if (!r || !r.serial) continue;
    const prev = out.get(r.serial);
    if (!prev || t(r) >= t(prev)) out.set(r.serial, r);
  }
  return out;
}

// Datos de acceso de un equipo: los guardados en el propio equipo; si no tiene,
// los del mantenimiento más reciente que los tenga (histórico).
export function credencialesDeEquipo(eq, mantenimientos, hastaFecha = null, excluirId = null) {
  if (eq && (eq.userWin || eq.passWin || eq.userAdmin || eq.passAdmin)) {
    return {
      userWin: eq.userWin || '', passWin: eq.passWin || '',
      userAdmin: eq.userAdmin || '', passAdmin: eq.passAdmin || '',
    };
  }
  return credencialesPrevias(mantenimientos, eq?.serial, hastaFecha, excluirId);
}

// Credenciales (usuario/clave Windows y Admin) del mantenimiento más reciente
// del equipo que las tenga registradas. Se prefieren las de fecha anterior o
// igual a `hastaFecha`; si no hay, se usa cualquiera. `excluirId` omite un registro.
export function credencialesPrevias(mantenimientos, serial, hastaFecha = null, excluirId = null) {
  const vacio = { userWin: '', passWin: '', userAdmin: '', passAdmin: '' };
  const t = r => { const d = parseFecha(r.fecha); return d ? d.getTime() : -Infinity; };
  const tope = hastaFecha ? (parseFecha(hastaFecha)?.getTime() ?? Infinity) : Infinity;
  const con = (mantenimientos || [])
    .filter(m => m.serial === serial && m.id !== excluirId &&
      (m.userWin || m.userAdmin || m.passWin || m.passAdmin))
    .sort((a, b) => t(b) - t(a));
  const m = con.find(x => t(x) <= tope) || con[0];
  if (!m) return vacio;
  return {
    userWin: m.userWin || '', passWin: m.passWin || '',
    userAdmin: m.userAdmin || '', passAdmin: m.passAdmin || '',
  };
}
