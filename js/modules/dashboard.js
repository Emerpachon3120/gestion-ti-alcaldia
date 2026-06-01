import { navigate }      from '../router.js';
import { formatDate, calcSemaforo } from '../utils.js';
import { renderAlertas } from '../ui/alerts.js';
import { getData, getDBStatic } from '../state.js';

export function render() {
  const m   = getData('mantenimientos') || [];
  const b   = getData('backups')        || [];
  const inc = getData('incidencias')    || [];
  const eq  = getData('equipos')        || [];

  const pendientes  = m.filter(x => !x.firmado).length + b.filter(x => !x.firmado).length;
  const abiertas    = inc.filter(i =>
    ['Iniciada','En proceso','abierta'].includes(i.estadoTexto || i.estado)
  ).length;
  const vencidos    = m.filter(x => {
    const s = calcSemaforo(x.fechaProxima);
    return s?.clase === 'semaforo-rojo';
  }).length;
  const bkFallidos  = b.filter(x => x.estadoBk === 'Fallido').length;

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

  return `
    <div class="page" id="page-dashboard" style="padding-bottom:24px;">

      <!-- SALUDO -->
      <div style="margin-bottom:20px;">
        <div style="font-size:22px;font-weight:800;color:var(--text1);">
          ${saludo}
        </div>
        <div style="font-size:13px;color:var(--text3);margin-top:2px;">
          Alcaldía Municipal de Nemocón · Sistema de Gestión TI
        </div>
      </div>

      <!-- KPIs PRINCIPALES -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
        <div style="background:linear-gradient(135deg,#c0392b,#e74c3c);
          border-radius:16px;padding:16px;color:#fff;cursor:pointer;"
          data-nav="inventario">
          <div style="font-size:28px;font-weight:800;">${eq.length}</div>
          <div style="font-size:11px;opacity:.85;margin-top:2px;">Equipos registrados</div>
        </div>
        <div style="background:linear-gradient(135deg,#d97706,#f59e0b);
          border-radius:16px;padding:16px;color:#fff;cursor:pointer;"
          data-nav="mantenimientos">
          <div style="font-size:28px;font-weight:800;">${pendientes}</div>
          <div style="font-size:11px;opacity:.85;margin-top:2px;">Pendientes de firma</div>
        </div>
        <div style="background:linear-gradient(135deg,#dc2626,#ef4444);
          border-radius:16px;padding:16px;color:#fff;cursor:pointer;"
          data-nav="incidencias">
          <div style="font-size:28px;font-weight:800;">${abiertas}</div>
          <div style="font-size:11px;opacity:.85;margin-top:2px;">Incidencias abiertas</div>
        </div>
        <div style="background:linear-gradient(135deg,#2563eb,#3b82f6);
          border-radius:16px;padding:16px;color:#fff;cursor:pointer;"
          data-nav="mantenimientos">
          <div style="font-size:28px;font-weight:800;">${m.length}</div>
          <div style="font-size:11px;opacity:.85;margin-top:2px;">Mantenimientos</div>
        </div>
      </div>

      <!-- ALERTAS RÁPIDAS -->
      ${vencidos > 0 || bkFallidos > 0 ? `
      <div style="margin-bottom:16px;">
        ${vencidos > 0 ? `
          <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:12px;
            padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:10px;
            cursor:pointer;" data-nav="mantenimientos">
            <div style="font-size:20px;">⚠️</div>
            <div>
              <div style="font-weight:700;font-size:13px;color:#991b1b;">
                ${vencidos} mantenimiento${vencidos>1?'s':''} vencido${vencidos>1?'s':''}
              </div>
              <div style="font-size:11px;color:#b91c1c;">Requieren atención inmediata</div>
            </div>
            <div style="margin-left:auto;color:#991b1b;">›</div>
          </div>` : ''}
        ${bkFallidos > 0 ? `
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;
            padding:12px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;"
            data-nav="backups">
            <div style="font-size:20px;">❌</div>
            <div>
              <div style="font-weight:700;font-size:13px;color:#c2410c;">
                ${bkFallidos} backup${bkFallidos>1?'s':''} fallido${bkFallidos>1?'s':''}
              </div>
              <div style="font-size:11px;color:#ea580c;">Revisar copias de seguridad</div>
            </div>
            <div style="margin-left:auto;color:#c2410c;">›</div>
          </div>` : ''}
      </div>` : ''}

      <!-- ACCIONES RÁPIDAS -->
      <div style="font-size:12px;font-weight:700;color:var(--text3);
        text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
        Acciones rápidas
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px;">
        ${[
          { nav:'mantenimientos', icon:'🔧', label:'Mantenimiento' },
          { nav:'backups',        icon:'💾', label:'Backup' },
          { nav:'incidencias',    icon:'🚨', label:'Incidencia' },
          { nav:'inventario',     icon:'💻', label:'Equipos' },
          { nav:'reportes',       icon:'📋', label:'Reportes' },
          { nav:'estadisticas',   icon:'📊', label:'Stats' },
          { nav:'calendario',     icon:'📅', label:'Calendario' },
          { nav:'administracion', icon:'⚙️', label:'Admin' },
        ].map(a => `
          <div data-nav="${a.nav}" style="
            background:var(--card);border:1px solid var(--border);
            border-radius:12px;padding:12px 6px;text-align:center;
            cursor:pointer;transition:transform .15s;">
            <div style="font-size:22px;margin-bottom:4px;">${a.icon}</div>
            <div style="font-size:10px;color:var(--text3);font-weight:600;">${a.label}</div>
          </div>`).join('')}
      </div>

      <!-- ALERTAS DEL SISTEMA -->
      <div style="font-size:12px;font-weight:700;color:var(--text3);
        text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
        Alertas del sistema
      </div>
      <div id="alertas-container" style="margin-bottom:20px;"></div>

      <!-- PRÓXIMOS MANTENIMIENTOS -->
      <div style="font-size:12px;font-weight:700;color:var(--text3);
        text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
        Próximos mantenimientos
      </div>
      <div id="proximos-container"></div>

    </div>
  `;
}

export function onEnter() {
  setTimeout(() => {
    document.querySelectorAll('[data-nav]').forEach(card => {
      card.addEventListener('click', () => navigate(card.dataset.nav));
    });
    renderAlertas('alertas-container');
    _renderProximos();
  }, 200);
}

function _renderProximos() {
  const DB   = getDBStatic();
  const prox = (getData('mantenimientos') || [])
    .filter(m => !m.firmado)
    .slice(0, 5);

  const container = document.getElementById('proximos-container');
  if (!container) return;

  if (!prox.length) {
    container.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border);
        border-radius:12px;padding:20px;text-align:center;color:var(--text3);font-size:13px;">
        Todo al dia — sin mantenimientos pendientes
      </div>`;
    return;
  }

  container.innerHTML = prox.map(m => {
    const eq  = (getData('equipos') || []).find(e => e.serial === m.serial);
    const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
    const of  = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
    const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
    const sem = calcSemaforo(m.fechaProxima);
    return `
      <div data-nav="mantenimientos" style="
        background:var(--card);border:1px solid var(--border);
        border-radius:12px;padding:14px;margin-bottom:8px;cursor:pointer;
        display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${p?.nombre || 'Sin asignar'}
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">
            ${m.serial} · ${dep?.nombre?.replace(/Secretar[ií]a de /i,'Sec. ') || of?.nombre || ''}
          </div>
          ${m.fechaProxima
            ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">
                Próximo: ${formatDate(m.fechaProxima)}
               </div>`
            : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          ${sem
            ? `<div class="semaforo ${sem.clase}">${sem.icon} ${sem.label}</div>`
            : '<span class="badge badge-yellow">Sin firmar</span>'}
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-nav]').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.nav));
  });
}