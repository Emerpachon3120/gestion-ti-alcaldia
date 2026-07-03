import { navigate }      from '../router.js';
import { formatDate, calcSemaforo } from '../utils.js';
import { renderAlertas } from '../ui/alerts.js';
import { getData, getDBStatic } from '../state.js';

export function render() {
  const m   = getData('mantenimientos') || [];
  const b   = getData('backups')        || [];
  const inc = getData('incidencias')    || [];
  const eq  = getData('equipos')        || [];

  const pendientes = m.filter(x => !x.firmado).length + b.filter(x => !x.firmado).length;
  const abiertas   = inc.filter(i =>
    ['Iniciada','En proceso','abierta'].includes(i.estadoTexto || i.estado)
  ).length;
  const vencidos   = m.filter(x => {
    const s = calcSemaforo(x.fechaProxima);
    return s?.clase === 'semaforo-rojo';
  }).length;
  const bkFallidos = b.filter(x => x.estadoBk === 'Fallido').length;

  const hora   = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
  const fecha  = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' });

  return `
    <div id="page-dashboard" class="pb-8 -mt-4">

      <!-- ── HERO HEADER ── -->
      <div class="relative overflow-hidden rounded-b-3xl -mx-4 mb-6 px-5 pt-6 pb-8"
        style="background: linear-gradient(135deg, #7b0d0d 0%, #c0392b 55%, #d97706 100%)">

        <!-- Círculos decorativos -->
        <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full"
          style="background:rgba(255,255,255,.07)"></div>
        <div class="absolute -bottom-6 -left-6 w-20 h-20 rounded-full"
          style="background:rgba(255,255,255,.05)"></div>

        <div class="relative z-10">
          <p class="text-xs font-semibold capitalize mb-1"
            style="color:rgba(255,255,255,.7)">${fecha}</p>
          <h1 class="text-2xl font-extrabold text-white mb-1">${saludo} 👋</h1>
          <p class="text-xs" style="color:rgba(255,255,255,.65)">
            Alcaldía Municipal de Nemocón · Gestión TI
          </p>

          <!-- Mini KPIs -->
          <div class="grid grid-cols-4 gap-2 mt-5">
            ${[
              { num: eq.length,  label: 'Equipos',     icon: '💻', nav: 'inventario' },
              { num: m.length,   label: 'Mantentos',   icon: '🔧', nav: 'mantenimientos' },
              { num: b.length,   label: 'Backups',     icon: '💾', nav: 'backups' },
              { num: inc.length, label: 'Incidencias', icon: '🚨', nav: 'incidencias' },
            ].map(k => `
              <div data-nav="${k.nav}" class="rounded-xl p-2 text-center cursor-pointer"
                style="background:rgba(255,255,255,.15);backdrop-filter:blur(4px)">
                <div class="text-base mb-0.5">${k.icon}</div>
                <div class="text-lg font-extrabold text-white leading-none">${k.num}</div>
                <div class="text-[9px] font-semibold mt-1"
                  style="color:rgba(255,255,255,.7)">${k.label}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- ── ALERTAS ── -->
      <div class="px-4 mb-6">
        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
          ⚡ Estado del sistema
        </p>

        ${vencidos > 0 ? `
        <div data-nav="mantenimientos" class="flex items-center gap-3 rounded-xl p-4 mb-2 cursor-pointer"
          style="background:var(--card);border-left:4px solid #dc2626;box-shadow:0 2px 12px rgba(220,38,38,.1)">
          <span class="text-2xl">⚠️</span>
          <div class="flex-1">
            <p class="font-bold text-sm" style="color:var(--text1)">
              ${vencidos} mantenimiento${vencidos>1?'s':''} vencido${vencidos>1?'s':''}
            </p>
            <p class="text-xs mt-0.5" style="color:var(--text3)">Requieren atención inmediata</p>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full"
            style="background:rgba(220,38,38,.1);color:#dc2626">Ver</span>
        </div>` : ''}

        ${bkFallidos > 0 ? `
        <div data-nav="backups" class="flex items-center gap-3 rounded-xl p-4 mb-2 cursor-pointer"
          style="background:var(--card);border-left:4px solid #d97706;box-shadow:0 2px 12px rgba(217,119,6,.1)">
          <span class="text-2xl">❌</span>
          <div class="flex-1">
            <p class="font-bold text-sm" style="color:var(--text1)">
              ${bkFallidos} backup${bkFallidos>1?'s':''} fallido${bkFallidos>1?'s':''}
            </p>
            <p class="text-xs mt-0.5" style="color:var(--text3)">Revisar copias de seguridad</p>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full"
            style="background:rgba(217,119,6,.1);color:#d97706">Ver</span>
        </div>` : ''}

        ${pendientes > 0 ? `
        <div data-nav="mantenimientos" class="flex items-center gap-3 rounded-xl p-4 mb-2 cursor-pointer"
          style="background:var(--card);border-left:4px solid #2563eb;box-shadow:0 2px 12px rgba(37,99,235,.1)">
          <span class="text-2xl">✍️</span>
          <div class="flex-1">
            <p class="font-bold text-sm" style="color:var(--text1)">
              ${pendientes} pendiente${pendientes>1?'s':''} de firma
            </p>
            <p class="text-xs mt-0.5" style="color:var(--text3)">Actas sin firmar</p>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full"
            style="background:rgba(37,99,235,.1);color:#2563eb">Ver</span>
        </div>` : ''}

        ${abiertas > 0 ? `
        <div data-nav="incidencias" class="flex items-center gap-3 rounded-xl p-4 mb-2 cursor-pointer"
          style="background:var(--card);border-left:4px solid #7c3aed;box-shadow:0 2px 12px rgba(124,58,237,.1)">
          <span class="text-2xl">🚨</span>
          <div class="flex-1">
            <p class="font-bold text-sm" style="color:var(--text1)">
              ${abiertas} incidencia${abiertas>1?'s':''} abierta${abiertas>1?'s':''}
            </p>
            <p class="text-xs mt-0.5" style="color:var(--text3)">Sin resolver</p>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full"
            style="background:rgba(124,58,237,.1);color:#7c3aed">Ver</span>
        </div>` : ''}

        ${vencidos === 0 && bkFallidos === 0 && pendientes === 0 && abiertas === 0 ? `
        <div class="flex items-center gap-3 rounded-xl p-4"
          style="background:var(--card);border-left:4px solid #16a34a;box-shadow:0 2px 12px rgba(22,163,74,.1)">
          <span class="text-2xl">✅</span>
          <div>
            <p class="font-bold text-sm" style="color:var(--text1)">Todo al día</p>
            <p class="text-xs mt-0.5" style="color:var(--text3)">Sin alertas pendientes</p>
          </div>
        </div>` : ''}
      </div>

      <!-- ── MÓDULOS ── -->
      <div class="px-4 mb-6">
        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
          Módulos
        </p>
        <div class="grid grid-cols-2 gap-3">
          ${[
            { nav:'mantenimientos', icon:'🔧', label:'Mantenimientos', sub:'Preventivo y correctivo', color:'#c0392b' },
            { nav:'backups',        icon:'💾', label:'Backups',         sub:'Copias de seguridad',    color:'#7c3aed' },
            { nav:'inventario',     icon:'💻', label:'Inventario',      sub:'Equipos registrados',    color:'#2563eb' },
            { nav:'incidencias',    icon:'🚨', label:'Incidencias',     sub:'Fallas y solicitudes',   color:'#dc2626' },
            { nav:'calendario',     icon:'📅', label:'Calendario',      sub:'Cronograma anual',       color:'#16a34a' },
            { nav:'estadisticas',   icon:'📊', label:'Estadísticas',    sub:'Reportes y análisis',    color:'#d97706' },
            { nav:'reportes',       icon:'📋', label:'Reportes',        sub:'Actas y documentos',     color:'#0891b2' },
            { nav:'administracion', icon:'⚙️', label:'Administración',  sub:'Usuarios y config',      color:'#64748b' },
          ].map(a => `
            <div data-nav="${a.nav}" class="relative overflow-hidden rounded-2xl p-4 cursor-pointer transition-transform active:scale-95"
              style="background:var(--card);border:1px solid var(--border)">
              <div class="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                style="background:${a.color}"></div>
              <div class="text-2xl mt-1 mb-2">${a.icon}</div>
              <p class="font-bold text-sm mb-0.5" style="color:var(--text1)">${a.label}</p>
              <p class="text-[11px]" style="color:var(--text3)">${a.sub}</p>
            </div>`).join('')}
        </div>
      </div>

      <!-- ── ALERTAS SISTEMA ── -->
      <div class="px-4 mb-6">
        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
          Alertas del sistema
        </p>
        <div id="alertas-container"></div>
      </div>

      <!-- ── PRÓXIMOS MANTENIMIENTOS ── -->
      <div class="px-4">
        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
          Próximos mantenimientos
        </p>
        <div id="proximos-container"></div>
      </div>

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
      <div class="rounded-xl p-5 text-center text-sm"
        style="background:var(--card);border:1px solid var(--border);color:var(--text3)">
        ✅ Sin mantenimientos pendientes
      </div>`;
    return;
  }

  container.innerHTML = prox.map(m => {
    const eq  = (getData('equipos') || []).find(e => e.serial === m.serial);
    const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
    const of  = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
    const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
    const sem = calcSemaforo(m.fechaProxima);
    const borderColor = sem?.clase === 'semaforo-rojo' ? '#dc2626'
                      : sem?.clase === 'semaforo-amarillo' ? '#d97706' : '#16a34a';

    return `
      <div data-nav="mantenimientos" class="flex items-center gap-3 rounded-xl p-4 mb-2 cursor-pointer"
        style="background:var(--card);border:1px solid var(--border);border-left:4px solid ${borderColor}">
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm truncate" style="color:var(--text1)">
            ${p?.nombre || 'Sin asignar'}
          </p>
          <div class="flex flex-wrap gap-1 mt-1.5">
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style="background:var(--bg2);color:var(--text3)">${m.serial}</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style="background:var(--bg2);color:var(--text3)">
              ${dep?.nombre?.replace(/Secretar[ií]a de /i,'Sec. ') || of?.nombre || '—'}
            </span>
            ${m.fechaProxima ? `
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style="background:var(--bg2);color:var(--text3)">
              📅 ${formatDate(m.fechaProxima)}
            </span>` : ''}
          </div>
        </div>
        <div class="flex-shrink-0">
          ${sem
            ? `<div class="semaforo ${sem.clase}">${sem.icon} ${sem.label}</div>`
            : '<span class="badge badge-yellow">Pendiente</span>'}
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-nav]').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.nav));
  });
}
