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
  const diff = Math.floor((d - new Date()) / 86400000);
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