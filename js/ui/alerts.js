import { getData } from '../state.js';
import { parseFecha, formatDate, calcSemaforo } from '../utils.js';
import { navigate } from '../router.js';

export function renderAlertas(containerId = 'alertas-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const alertas = [];
  const mantenimientos = getData('mantenimientos');
  const backups        = getData('backups');
  const incidencias    = getData('incidencias');
  const hoy            = new Date();

  mantenimientos.forEach(m => {
    const s = calcSemaforo(m.fechaProxima);
    if (s && s.clase !== 'semaforo-verde') {
      alertas.push({
        tipo: s.clase === 'semaforo-rojo' ? 'red' : 'yellow',
        icon: '🔧',
        title: `Mantenimiento ${s.label}: ${m.serial}`,
        sub: `Próxima: ${formatDate(m.fechaProxima)}`,
        action: () => navigate('mantenimientos'),
      });
    }
  });

  backups.forEach(b => {
    const s = calcSemaforo(b.fechaProxima);
    if (s && s.clase !== 'semaforo-verde') {
      alertas.push({
        tipo: s.clase === 'semaforo-rojo' ? 'red' : 'yellow',
        icon: '💾',
        title: `Backup ${s.label}: ${b.serial}`,
        sub: `Próxima: ${formatDate(b.fechaProxima)}`,
        action: () => navigate('backups'),
      });
    }
  });

  incidencias
    .filter(i => ['Iniciada','En proceso','Pendiente','abierta'].includes(i.estadoTexto || i.estado))
    .forEach(i => {
      const d    = parseFecha(i.fecha);
      const dias = d ? Math.floor((hoy - d) / 86400000) : 0;
      if (dias >= 3) {
        alertas.push({
          tipo: 'red', icon: '🚨',
          title: `Incidencia abierta ${dias} días: ${i.tipo}`,
          sub: i.nombre || '—',
          action: () => navigate('incidencias'),
        });
      }
    });

  if (!alertas.length) {
    container.innerHTML = `<div class="alert-card alert-green">
      <span class="alert-icon">✅</span>
      <div class="alert-body">
        <div class="alert-title">Todo al día</div>
        <div class="alert-sub">Sin alertas pendientes</div>
      </div>
    </div>`;
    return;
  }

  container.innerHTML = alertas.slice(0, 8).map((a, i) => `
    <div class="alert-card alert-${a.tipo}" data-alert="${i}">
      <span class="alert-icon">${a.icon}</span>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-sub">${a.sub}</div>
      </div>
      <span>›</span>
    </div>
  `).join('');

  // Bind acciones
  alertas.forEach((a, i) => {
    container.querySelector(`[data-alert="${i}"]`)?.addEventListener('click', a.action);
  });
}