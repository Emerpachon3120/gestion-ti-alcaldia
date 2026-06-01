import { getData, getDBStatic } from '../state.js';
import { parseFecha } from '../utils.js';
import { navigate } from '../router.js';

let _mesActual = new Date().getMonth();
let _anioActual = new Date().getFullYear();

export function render() {
  return `
    <div class="page" id="page-calendario">
      <div class="page-header">
        <div class="section-title">Calendario</div>
        <div class="section-sub">Cronograma de mantenimientos y backups</div>
      </div>

      <!-- Navegación mes -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        margin-bottom:16px;">
        <button id="cal-prev" style="background:var(--card);border:1px solid var(--border);
          border-radius:8px;padding:8px 14px;color:var(--text1);cursor:pointer;
          font-size:16px;font-family:var(--font-main);">‹</button>
        <div id="cal-mes-label" style="font-size:16px;font-weight:700;"></div>
        <button id="cal-next" style="background:var(--card);border:1px solid var(--border);
          border-radius:8px;padding:8px 14px;color:var(--text1);cursor:pointer;
          font-size:16px;font-family:var(--font-main);">›</button>
      </div>

      <!-- Leyenda -->
      <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
          <div style="width:10px;height:10px;border-radius:50%;background:#2563eb;"></div>
          Mantenimiento
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
          <div style="width:10px;height:10px;border-radius:50%;background:#7c3aed;"></div>
          Backup
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:11px;">
          <div style="width:10px;height:10px;border-radius:50%;background:#dc2626;"></div>
          Incidencia
        </div>
      </div>

      <!-- Días de semana -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);
        gap:2px;margin-bottom:4px;">
        ${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d =>
          `<div style="text-align:center;font-size:10px;font-weight:700;
            color:var(--text3);padding:4px 0;">${d}</div>`
        ).join('')}
      </div>

      <!-- Grid del calendario -->
      <div id="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;"></div>

      <!-- Eventos del día seleccionado -->
      <div id="cal-eventos" style="margin-top:16px;"></div>
    </div>
  `;
}

export function onEnter() {
  setTimeout(() => {
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      _mesActual--;
      if (_mesActual < 0) { _mesActual = 11; _anioActual--; }
      _renderCalendario();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      _mesActual++;
      if (_mesActual > 11) { _mesActual = 0; _anioActual++; }
      _renderCalendario();
    });
    _renderCalendario();
  }, 100);
}

function _getEventosDia(dia, mes, anio) {
  const eventos = [];
  const fechaStr = `${String(dia).padStart(2,'0')}/${String(mes+1).padStart(2,'0')}/${anio}`;
  const fechaISO = `${anio}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;

  getData('mantenimientos').forEach(m => {
    const d = parseFecha(m.fechaProxima);
    if (d && d.getDate()===dia && d.getMonth()===mes && d.getFullYear()===anio) {
      eventos.push({ tipo:'mant', serial:m.serial, color:'#2563eb', label:'Mantenimiento', data:m });
    }
  });

  getData('backups').forEach(b => {
    const d = parseFecha(b.fechaProxima);
    if (d && d.getDate()===dia && d.getMonth()===mes && d.getFullYear()===anio) {
      eventos.push({ tipo:'backup', serial:b.serial, color:'#7c3aed', label:'Backup', data:b });
    }
  });

  getData('incidencias').forEach(i => {
    const d = parseFecha(i.fecha);
    if (d && d.getDate()===dia && d.getMonth()===mes && d.getFullYear()===anio) {
      eventos.push({ tipo:'inc', color:'#dc2626', label:'Incidencia', data:i });
    }
  });

  return eventos;
}

function _renderCalendario() {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  document.getElementById('cal-mes-label').textContent =
    `${meses[_mesActual]} ${_anioActual}`;

  const hoy = new Date();
  const primerDia = new Date(_anioActual, _mesActual, 1).getDay();
  const diasMes   = new Date(_anioActual, _mesActual+1, 0).getDate();

  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  let html = '';

  // Días vacíos al inicio
  for (let i = 0; i < primerDia; i++) {
    html += `<div style="min-height:48px;"></div>`;
  }

  // Días del mes
  for (let dia = 1; dia <= diasMes; dia++) {
    const eventos = _getEventosDia(dia, _mesActual, _anioActual);
    const esHoy   = dia === hoy.getDate() && _mesActual === hoy.getMonth() && _anioActual === hoy.getFullYear();

    const puntos = eventos.slice(0,3).map(e =>
      `<div style="width:5px;height:5px;border-radius:50%;background:${e.color};"></div>`
    ).join('');

    html += `
      <div data-dia="${dia}" style="
        min-height:48px;background:var(--card);border:1px solid ${esHoy?'var(--accent)':'var(--border)'};
        border-radius:8px;padding:4px;cursor:pointer;
        ${esHoy?'background:rgba(192,57,43,.1);':''}
        display:flex;flex-direction:column;align-items:center;">
        <div style="font-size:12px;font-weight:${esHoy?'700':'400'};
          color:${esHoy?'var(--accent)':'var(--text1)'};">
          ${dia}
        </div>
        <div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center;margin-top:2px;">
          ${puntos}
        </div>
        ${eventos.length > 3
          ? `<div style="font-size:9px;color:var(--text3);">+${eventos.length-3}</div>`
          : ''}
      </div>`;
  }

  grid.innerHTML = html;

  // Bind clicks
  grid.querySelectorAll('[data-dia]').forEach(el => {
    el.addEventListener('click', () => {
      const dia = parseInt(el.dataset.dia);
      _mostrarEventosDia(dia);
      // Highlight seleccionado
      grid.querySelectorAll('[data-dia]').forEach(e =>
        e.style.borderColor = e.dataset.dia == dia ? 'var(--accent)' : 'var(--border)');
    });
  });

  // Mostrar eventos de hoy por defecto
  if (_mesActual === hoy.getMonth() && _anioActual === hoy.getFullYear()) {
    _mostrarEventosDia(hoy.getDate());
  } else {
    document.getElementById('cal-eventos').innerHTML = '';
  }
}

function _mostrarEventosDia(dia) {
  const DB = getDBStatic();
  const eventos = _getEventosDia(dia, _mesActual, _anioActual);
  const container = document.getElementById('cal-eventos');
  if (!container) return;

  const meses = ['enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'];

  if (!eventos.length) {
    container.innerHTML = `
      <div style="text-align:center;color:var(--text3);font-size:13px;padding:20px;">
        Sin eventos el ${dia} de ${meses[_mesActual]}
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--text3);
      text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
      ${dia} de ${meses[_mesActual]} — ${eventos.length} evento${eventos.length>1?'s':''}
    </div>
    ${eventos.map(e => {
      const eq = e.serial ? getData('equipos').find(x => x.serial === e.serial) : null;
      const p  = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
      const of = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
      const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;

      return `
        <div style="background:var(--card);border:1px solid var(--border);
          border-left:3px solid ${e.color};border-radius:8px;
          padding:10px 12px;margin-bottom:6px;cursor:pointer;"
          onclick="navigate('${e.tipo==='mant'?'mantenimientos':e.tipo==='backup'?'backups':'incidencias'}')">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${e.color};"></div>
            <div style="font-size:12px;font-weight:700;">${e.label}</div>
          </div>
          <div style="font-size:12px;color:var(--text1);">${e.serial || e.data?.tipo || '—'}</div>
          <div style="font-size:11px;color:var(--text3);">
            ${p?.nombre || '—'} · ${dep?.nombre?.replace(/Secretar[ií]a de /i,'Sec. ') || of?.nombre || ''}
          </div>
        </div>`;
    }).join('')}
  `;
}