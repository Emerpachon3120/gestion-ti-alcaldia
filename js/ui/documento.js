import { CONFIG }    from '../config.js';
import { getData, getDBStatic } from '../state.js';
import { formatDate, parseFecha } from '../utils.js';
import { verActaBackup } from '../ui/documento.js';

// ── Visor de documentos ───────────────────────────────────────
export function abrirDocViewer(htmlContent, titulo) {
  const overlay = document.getElementById('doc-viewer-overlay');
  const iframe  = document.getElementById('doc-viewer-iframe');
  const titleEl = document.getElementById('doc-viewer-title');

  titleEl.textContent = titulo || 'Documento';

  if (window._docBlob) {
    URL.revokeObjectURL(window._docBlob);
    window._docBlob = null;
  }

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  window._docBlob = URL.createObjectURL(blob);
  iframe.src = window._docBlob;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function cerrarDocViewer() {
  document.getElementById('doc-viewer-overlay')?.classList.remove('open');
  const iframe = document.getElementById('doc-viewer-iframe');
  if (iframe) iframe.src = 'about:blank';
  if (window._docBlob) {
    URL.revokeObjectURL(window._docBlob);
    window._docBlob = null;
  }
  document.body.style.overflow = '';
}

export function docViewerPrint() {
  document.getElementById('doc-viewer-iframe')?.contentWindow?.print();
}

// ── CSS compartido para todos los documentos ─────────────────
function _cssDoc() {
  return `
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{background:#e8e8e8;font-family:Arial,sans-serif;font-size:10.5pt;color:#111;}
    .pagina{
      position:relative;
      width:21.59cm;
      min-height:33.02cm;
      margin:0.8cm auto;
      background:#fff;
      display:flex;
      flex-direction:column;
      box-shadow:0 4px 24px rgba(0,0,0,0.18);
    }
    .header img{width:100%;display:block;}
    .body-wrap{
      flex:1;
      padding:0.4cm 1.8cm 0.3cm;
      display:flex;
      flex-direction:column;
      padding-bottom:4.5cm;
    }
    .footer{
      position:absolute;
      bottom:0;
      left:0;
      right:0;
      width:100%;
    }
    .footer img{width:100%;display:block;}
    .titulo{text-align:center;font-size:12pt;font-weight:bold;
      text-transform:uppercase;margin:0.35cm 0 0.4cm;letter-spacing:0.4px;}
    .meta{margin-bottom:0.35cm;font-size:10.5pt;}
    .meta p{margin-bottom:3px;}
    .intro{margin-bottom:0.4cm;font-size:10.5pt;text-align:justify;line-height:1.5;}
    .sec{font-weight:bold;font-size:10.5pt;margin:0.35cm 0 0.15cm;}
    table{width:100%;border-collapse:collapse;margin-bottom:0.3cm;font-size:10pt;}
    td,th{padding:5px 10px;vertical-align:top;border:1px solid #e0e0e0;text-align:left;}
    th{background:#f0f0f0;font-weight:bold;}
    tr:nth-child(even) td{background:#f7f7f7;}
    .obs{font-size:10.5pt;text-align:justify;line-height:1.5;margin-bottom:0.2cm;}
    .indicadores li{margin-bottom:4px;font-size:10.5pt;list-style:disc inside;}
    .constancia{font-size:10.5pt;margin:0.3cm 0;text-align:justify;}
    .firmas{display:flex;gap:2cm;align-items:flex-end;margin-top:0.5cm;}
    .fbox{flex:1;text-align:center;}
    .fbox img{height:1.6cm;object-fit:contain;display:block;margin:0 auto 3px;max-width:5cm;}
    .flinea{border-top:1pt solid #111;padding-top:4px;line-height:1.45;}
    .fnombre{font-weight:bold;font-size:10.5pt;}
    .fcargo{font-size:9.5pt;color:#333;}
    .spacer{flex:1;min-height:0.3cm;}
    .badge-g{color:#16a34a;background:#dcfce7;padding:1px 7px;border-radius:10px;font-size:8.5pt;font-weight:bold;}
    .badge-y{color:#d97706;background:#fef3c7;padding:1px 7px;border-radius:10px;font-size:8.5pt;font-weight:bold;}
    .badge-r{color:#dc2626;background:#fee2e2;padding:1px 7px;border-radius:10px;font-size:8.5pt;font-weight:bold;}
    @media print{
      @page{size:8.5in 13in;margin:0;}
      html,body{background:#fff;width:8.5in;}
      .pagina{width:8.5in;min-height:13in;margin:0;box-shadow:none;}
      .footer{position:fixed;bottom:0;left:0;right:0;}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    }
  `;
}

// ── Acta de mantenimiento individual ─────────────────────────
export function verActaMantenimiento(id) {
  const DB    = getDBStatic();
  const m     = getData('mantenimientos').find(x => x.id === id);
  if (!m) return;

  const eq    = getData('equipos').find(e => e.serial === m.serial);
  const p     = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
  const of    = eq ? DB.oficinas.find(x => x.id === eq.oficina)   : null;
  const dep   = of ? DB.dependencias.find(x => x.id === of.depId) : null;
  const fecha = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Acta Mantenimiento ${m.serial}</title>
  <style>${_cssDoc()}</style>
  </head><body>
  <div class="pagina">
    <div class="header"><img src="${CONFIG.IMG_HEADER}" alt="Encabezado"/></div>
    <div class="body-wrap">

      <div class="titulo">Acta de Mantenimiento ${m.tipo || 'Preventivo'}</div>

      <div class="meta">
        <p><b>Fecha:</b> ${formatDate(m.fecha)}</p>
        <p><b>Serial equipo:</b> ${m.serial}</p>
        <p><b>Funcionario:</b> ${p?.nombre || '—'}</p>
        <p><b>Oficina:</b> ${of?.nombre || '—'}</p>
        <p><b>Dependencia:</b> ${dep?.nombre || '—'}</p>
        <p><b>Responsable TI:</b> ${m.responsable || CONFIG.RESPONSABLE_TI}</p>
        <p><b>Tipo:</b> ${m.tipo || '—'}</p>
        <p><b>Frecuencia:</b> ${m.frecuencia || '—'}</p>
        <p><b>Próximo mantenimiento:</b> ${formatDate(m.fechaProxima)}</p>
      </div>

      <div class="sec">Actividades realizadas</div>
      <div class="obs">${m.obs || 'Se realizaron actividades de mantenimiento según la programación establecida.'}</div>

      <div class="sec">Estado del equipo</div>
      <table>
        <tr><th>Componente</th><th>Detalle</th></tr>
        <tr><td>Sistema Operativo</td><td>${eq?.so || '—'}</td></tr>
        <tr><td>RAM</td><td>${eq?.ram || '—'}</td></tr>
        <tr><td>Disco</td><td>${eq?.disco || '—'} ${eq?.cap || ''}</td></tr>
        <tr><td>Office</td><td>${eq?.office || '—'}</td></tr>
        <tr><td>Estado post-mantenimiento</td><td>${m.estadoEquipo || 'Operativo'}</td></tr>
      </table>

      ${m.fotos?.length ? `
        <div class="sec">Evidencia fotográfica (${m.fotos.length} foto${m.fotos.length > 1 ? 's' : ''})</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:0.3cm;">
          ${m.fotos.slice(0, 4).map(f =>
            `<img src="${f}" style="width:100%;height:5cm;object-fit:cover;border-radius:4px;border:1px solid #e0e0e0;">`
          ).join('')}
        </div>
      ` : ''}

      <div class="constancia">
        En constancia de lo anterior, se firma la presente acta en la fecha indicada.
      </div>

      <div class="spacer"></div>

      <div class="firmas">
        <div class="fbox">
          ${m.firma
            ? `<img src="${m.firma}" alt="Firma funcionario">`
            : `<div style="height:1.6cm;"></div>`}
          <div class="flinea">
            <div class="fnombre">${p?.nombre || '___________________________'}</div>
            <div class="fcargo">${of?.nombre || 'Funcionario'}</div>
            <div class="fcargo">${dep?.nombre || ''}</div>
          </div>
        </div>
        <div class="fbox">
          <img src="${CONFIG.IMG_FIRMA_TI}" alt="Firma TI">
          <div class="flinea">
            <div class="fnombre">${CONFIG.RESPONSABLE_TI}</div>
            <div class="fcargo">Ingeniero de Sistemas</div>
            <div class="fcargo">${CONFIG.ENTIDAD}</div>
          </div>
        </div>
      </div>

    </div>
    <div class="footer"><img src="${CONFIG.IMG_FOOTER}" alt="Pie de página"/></div>
  </div>
  </body></html>`;

  abrirDocViewer(html, `Acta Mantenimiento — ${m.serial}`);
}

// ── Informe mensual ───────────────────────────────────────────
export function generarInformeMensual(mes) {
  if (!mes) return;
  const [year, month] = mes.split('-').map(Number);
  const DB     = getDBStatic();
  const nombreMes = new Date(year, month - 1, 1)
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  const mants = getData('mantenimientos').filter(m => {
    const d = parseFecha(m.fecha);
    return d && d.getFullYear() === year && d.getMonth() === month - 1;
  });
  const bks = getData('backups').filter(b => {
    const d = parseFecha(b.fecha);
    return d && d.getFullYear() === year && d.getMonth() === month - 1;
  });
  const incs = getData('incidencias').filter(i => {
    const d = parseFecha(i.fecha);
    return d && d.getFullYear() === year && d.getMonth() === month - 1;
  });

  const fechaDoc = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Informe Mensual ${nombreMes}</title>
  <style>
    ${_cssDoc()}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0.3cm 0;}
    .kpi{background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:10px;text-align:center;}
    .kpi-num{font-size:20pt;font-weight:bold;color:#8B0000;}
    .kpi-num.green{color:#16a34a;}
    .kpi-num.orange{color:#d97706;}
    .kpi-num.purple{color:#7c3aed;}
    .kpi-label{font-size:8.5pt;color:#666;margin-top:3px;}
    .sec-title{font-weight:bold;font-size:10.5pt;margin:0.35cm 0 0.15cm;
      text-transform:uppercase;border-left:3px solid #8B0000;
      padding-left:7px;color:#8B0000;}
    .empty-msg{color:#888;font-size:9.5pt;margin-bottom:0.3cm;}
  </style>
  </head><body>
  <div class="pagina">
    <div class="header"><img src="${CONFIG.IMG_HEADER}" alt="Encabezado"/></div>
    <div class="body-wrap">

      <div class="titulo">Informe Mensual de Gestión TI</div>
      <div style="text-align:center;font-size:9.5pt;color:#555;margin-bottom:0.35cm;">
        Período: ${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} ·
        ${CONFIG.ENTIDAD} · Generado: ${fechaDoc}
      </div>

      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-num">${mants.length}</div>
          <div class="kpi-label">Mantenimientos</div>
        </div>
        <div class="kpi">
          <div class="kpi-num green">${mants.filter(m => m.firmado).length}</div>
          <div class="kpi-label">Firmados</div>
        </div>
        <div class="kpi">
          <div class="kpi-num orange">${bks.length}</div>
          <div class="kpi-label">Backups</div>
        </div>
        <div class="kpi">
          <div class="kpi-num purple">${incs.length}</div>
          <div class="kpi-label">Incidencias</div>
        </div>
      </div>

      <div class="sec-title">Mantenimientos realizados (${mants.length})</div>
      ${mants.length ? `
        <table>
          <tr><th>Serial</th><th>Funcionario</th><th>Dependencia</th><th>Tipo</th><th>Fecha</th><th>Estado</th></tr>
          ${mants.map(m => {
            const eq  = getData('equipos').find(e => e.serial === m.serial);
            const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
            const of  = eq ? DB.oficinas.find(x => x.id === eq.oficina)   : null;
            const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
            return `<tr>
              <td>${m.serial}</td>
              <td>${p?.nombre || '—'}</td>
              <td>${dep?.nombre?.replace(/Secretar[ií]a de /i,'Sec. ') || of?.nombre || '—'}</td>
              <td>${m.tipo || '—'}</td>
              <td>${formatDate(m.fecha)}</td>
              <td><span class="badge-${m.firmado ? 'g' : 'y'}">${m.firmado ? 'Firmado' : 'Pendiente'}</span></td>
            </tr>`;
          }).join('')}
        </table>
      ` : '<p class="empty-msg">Ninguno este mes.</p>'}

      <div class="sec-title">Copias de seguridad (${bks.length})</div>
      ${bks.length ? `
        <table>
          <tr><th>Serial</th><th>Responsable</th><th>Tipo</th><th>Fecha</th><th>Destino</th><th>Estado</th></tr>
          ${bks.map(b => {
            const resp = b.responsableEquipo ||
              DB.personas.find(x => x.id === b.personaId)?.nombre || '—';
            return `<tr>
              <td>${b.serial}</td>
              <td>${resp}</td>
              <td>${b.tipo || '—'}</td>
              <td>${formatDate(b.fecha)}</td>
              <td>${b.destino || '—'}</td>
              <td><span class="badge-${b.estadoBk === 'Completado' ? 'g' : b.estadoBk === 'Fallido' ? 'r' : 'y'}">${b.estadoBk || '—'}</span></td>
            </tr>`;
          }).join('')}
        </table>
      ` : '<p class="empty-msg">Ninguna este mes.</p>'}

      <div class="sec-title">Incidencias (${incs.length})</div>
      ${incs.length ? `
        <table>
          <tr><th>Ticket</th><th>Tipo</th><th>Funcionario</th><th>Prioridad</th><th>Estado</th></tr>
          ${incs.map(i => `<tr>
            <td>${i.ticket || i.id}</td>
            <td>${i.tipo}</td>
            <td>${i.nombre || '—'}</td>
            <td><span class="badge-${i.prioridad === 'alta' || i.prioridad === 'crítica' ? 'r' : i.prioridad === 'media' ? 'y' : 'g'}">${i.prioridad}</span></td>
            <td>${i.estadoTexto || i.estado || '—'}</td>
          </tr>`).join('')}
        </table>
      ` : '<p class="empty-msg">Ninguna este mes.</p>'}

      <div class="spacer"></div>

      <div class="firmas">
        <div class="fbox">
          <img src="${CONFIG.IMG_FIRMA_TI}" alt="Firma TI">
          <div class="flinea">
            <div class="fnombre">${CONFIG.RESPONSABLE_TI}</div>
            <div class="fcargo">Ingeniero de Sistemas — TI</div>
            <div class="fcargo">${CONFIG.ENTIDAD}</div>
            <div class="fcargo">${fechaDoc}</div>
          </div>
        </div>
        <div class="fbox">
          <div style="height:1.6cm;"></div>
          <div class="flinea">
            <div class="fnombre">___________________________</div>
            <div class="fcargo">Revisado por</div>
            <div class="fcargo">${CONFIG.ENTIDAD}</div>
          </div>
        </div>
      </div>

    </div>
    <div class="footer"><img src="${CONFIG.IMG_FOOTER}" alt="Pie de página"/></div>
  </div>
  </body></html>`;

  abrirDocViewer(html, `Informe Mensual — ${nombreMes}`);
}

// ── Acta por dependencia ──────────────────────────────────────
export function generarActaDependencia(tipo, depId, fechaIni, fechaFin, obsExtra) {
  const DB  = getDBStatic();
  const dep = DB.dependencias.find(x => x.id === depId);
  if (!dep) return;

  const ofIds     = DB.oficinas.filter(o => o.depId === depId).map(o => o.id);
  const eqsDep    = getData('equipos').filter(e => ofIds.includes(e.oficina));
  const serials   = eqsDep.map(e => e.serial);
  const dIni      = new Date(fechaIni + 'T00:00:00');
  const dFin      = new Date(fechaFin + 'T23:59:59');
  const enRango   = d => d && d >= dIni && d <= dFin;
  const fmtC      = d => d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
  const fechaDoc  = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
  const periodo   = fechaIni === fechaFin ? fmtC(dIni) : `${fmtC(dIni)} al ${fmtC(dFin)}`;

  let items = [], actaTitulo = '', secTitulo = '', filas = [];
  const totalEquipos = eqsDep.length;

  if (tipo === 'mantenimiento') {
    actaTitulo = 'Acta de ejecución de mantenimientos preventivos';
    secTitulo  = 'Mantenimientos realizados';
    items = getData('mantenimientos').filter(m => serials.includes(m.serial) && enRango(parseFecha(m.fecha)));
    filas = items.map(m => {
      const p = getData('equipos').find(e => e.serial === m.serial);
      const persona = p ? DB.personas.find(x => x.id === p.usuarioId) : null;
      return `<tr><td>${persona?.nombre || '—'}</td><td>${m.serial}</td><td>${m.tipo || 'Preventivo'}</td><td>${fmtC(parseFecha(m.fecha))}</td></tr>`;
    });
  } else {
    actaTitulo = 'Acta de ejecución de copias de seguridad';
    secTitulo  = 'Copias de seguridad realizadas';
    items = getData('backups').filter(b => serials.includes(b.serial) && enRango(parseFecha(b.fecha)));
    filas = items.map(b => {
      const resp = b.responsableEquipo || DB.personas.find(x => x.id === b.personaId)?.nombre || '—';
      return `<tr><td>${resp}</td><td>${b.destino || '—'}</td><td>${fmtC(parseFecha(b.fecha))}</td></tr>`;
    });
  }

  if (!items.length) {
    import('./toast.js').then(({ showToast }) =>
      showToast(`⚠️ No hay registros en ese período para ${dep.nombre}`)
    );
    return;
  }

  const intervenidos   = new Set(items.map(x => x.serial)).size;
  const noIntervenidos = Math.max(0, totalEquipos - intervenidos);
  const pct            = totalEquipos > 0 ? ((intervenidos / totalEquipos) * 100).toFixed(1) : '0.0';

  const primerPersona = DB.personas.find(p => {
    const eq = getData('equipos').find(e => e.usuarioId === p.id && ofIds.includes(e.oficina));
    return !!eq;
  });
  const jefeDep = primerPersona?.nombre || `Representante ${dep.nombre}`;

  const headers = tipo === 'mantenimiento'
    ? `<tr><th>Funcionario</th><th>ID Equipo</th><th>Tipo</th><th>Fecha</th></tr>`
    : `<tr><th>Funcionario</th><th>Ruta / Destino</th><th>Fecha</th></tr>`;

  const tipoTexto = tipo === 'mantenimiento' ? 'mantenimiento' : 'copias de seguridad (backup)';

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>${actaTitulo}</title>
  <style>${_cssDoc()}</style>
  </head><body>
  <div class="pagina">
    <div class="header"><img src="${CONFIG.IMG_HEADER}" alt="Encabezado"/></div>
    <div class="body-wrap">

      <div class="titulo">${actaTitulo}</div>

      <div class="meta">
        <p><b>Fecha de elaboración:</b> ${fechaDoc}</p>
        <p><b>Responsable:</b> ${CONFIG.RESPONSABLE_TI}</p>
        <p><b>Dependencia:</b> ${dep.nombre}</p>
        <p><b>Período:</b> ${periodo}</p>
      </div>

      <div class="intro">
        En la fecha indicada, se deja constancia de la ejecución de actividades de
        ${tipoTexto} a los equipos de cómputo asignados a funcionarios de la
        ${dep.nombre}, conforme a la programación establecida por el área de sistemas
        y a los registros individuales que reposan como soporte documental.
      </div>

      <div class="sec">1. ${secTitulo}</div>
      <table>
        ${headers}
        ${filas.join('')}
      </table>

      <p class="obs">
        Se deja constancia de que los detalles técnicos de cada procedimiento realizado
        reposan en los formatos individuales debidamente diligenciados y archivados por
        el área de sistemas.
      </p>

      <div class="sec">2. Observaciones</div>
      <p class="obs">
        ${obsExtra || ''}
        Se acordó que, en caso de requerir soporte técnico o presentar alguna novedad
        en los equipos, deberán registrar la incidencia a través del formulario
        institucional dispuesto por el área de sistemas.
      </p>

      <div class="sec">3. Indicadores de cumplimiento</div>
      <p class="obs">
        Durante la jornada de ${tipoTexto} en la ${dep.nombre}
        se evaluaron un total de ${totalEquipos} equipos de cómputo.
      </p>
      <ul class="indicadores" style="margin:0.2cm 0 0.2cm 1cm;">
        <li>Equipos intervenidos: ${intervenidos}</li>
        <li>Equipos no intervenidos: ${noIntervenidos}</li>
        <li>Porcentaje de cumplimiento: ${pct}%</li>
      </ul>
      <p class="obs">
        El resultado evidencia el cumplimiento de la programación establecida por
        el área de sistemas y el adecuado control sobre la periodicidad de los
        ${tipoTexto}s.
      </p>

      <p class="constancia">En constancia, se firma la presente acta.</p>

      <div class="spacer"></div>

      <div class="firmas">
        <div class="fbox">
          <img src="${CONFIG.IMG_FIRMA_TI}" alt="Firma TI">
          <div class="flinea">
            <div class="fnombre">${CONFIG.RESPONSABLE_TI}</div>
            <div class="fcargo">Ingeniero de Sistemas</div>
          </div>
        </div>
        <div class="fbox">
          <div style="height:1.6cm;"></div>
          <div class="flinea">
            <div class="fnombre">${jefeDep}</div>
            <div class="fcargo">${dep.nombre}</div>
          </div>
        </div>
      </div>

    </div>
    <div class="footer"><img src="${CONFIG.IMG_FOOTER}" alt="Pie de página"/></div>
  </div>
  </body></html>`;

  abrirDocViewer(html, `${actaTitulo} — ${dep.nombre}`);
}

export function verActaBackup(id) {
  const DB  = getDBStatic();
  const b   = getData('backups').find(x => x.id === id);
  if (!b) return;

  const eq   = getData('equipos').find(e => e.serial === b.serial);
  const p    = b.personaId ? DB.personas.find(x => x.id === b.personaId) : null;
  const of   = eq ? DB.oficinas.find(x => x.id === eq.oficina) : null;
  const dep  = of ? DB.dependencias.find(x => x.id === of.depId) : null;
  const resp = b.responsableEquipo || p?.nombre || '—';
  const fecha = new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Acta Backup ${b.serial}</title>
  <style>${_cssDoc()}</style>
  </head><body>
  <div class="pagina">
    <div class="header"><img src="${CONFIG.IMG_HEADER}" alt="Encabezado"/></div>
    <div class="body-wrap">

      <div class="titulo">Acta de Copia de Seguridad</div>

      <div class="meta">
        <p><b>Fecha:</b> ${formatDate(b.fecha)}</p>
        <p><b>Serial equipo:</b> ${b.serial}</p>
        <p><b>Funcionario:</b> ${resp}</p>
        <p><b>Oficina:</b> ${of?.nombre || '—'}</p>
        <p><b>Dependencia:</b> ${dep?.nombre || '—'}</p>
        <p><b>Responsable TI:</b> ${b.respTI || CONFIG.RESPONSABLE_TI}</p>
        <p><b>Tipo de backup:</b> ${b.tipo || '—'}</p>
        <p><b>Destino:</b> ${b.destino || '—'}</p>
        <p><b>Frecuencia:</b> ${b.frecuencia || '—'}</p>
        <p><b>Próximo backup:</b> ${formatDate(b.fechaProxima)}</p>
        <p><b>Estado:</b> ${b.estadoBk || '—'}</p>
        ${b.ubicacion ? `<p><b>Ubicación:</b> ${b.ubicacion}</p>` : ''}
      </div>

      ${b.obs ? `
        <div class="sec">Observaciones</div>
        <div class="obs">${b.obs}</div>
      ` : ''}

      ${b.fotos?.length ? `
        <div class="sec">Evidencia fotográfica</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:0.3cm;">
          ${b.fotos.slice(0,4).map(f =>
            `<img src="${f}" style="width:100%;height:5cm;object-fit:cover;border-radius:4px;border:1px solid #e0e0e0;">`
          ).join('')}
        </div>
      ` : ''}

      <div class="constancia">
        En constancia de lo anterior, se firma la presente acta en la fecha indicada.
      </div>

      <div class="spacer"></div>

      <div class="firmas">
        <div class="fbox">
          ${b.firma
            ? `<img src="${b.firma}" alt="Firma funcionario">`
            : `<div style="height:1.6cm;"></div>`}
          <div class="flinea">
            <div class="fnombre">${resp}</div>
            <div class="fcargo">${of?.nombre || 'Funcionario'}</div>
            <div class="fcargo">${dep?.nombre || ''}</div>
          </div>
        </div>
        <div class="fbox">
          <img src="${CONFIG.IMG_FIRMA_TI}" alt="Firma TI">
          <div class="flinea">
            <div class="fnombre">${CONFIG.RESPONSABLE_TI}</div>
            <div class="fcargo">Ingeniero de Sistemas</div>
            <div class="fcargo">${CONFIG.ENTIDAD}</div>
          </div>
        </div>
      </div>

    </div>
    <div class="footer"><img src="${CONFIG.IMG_FOOTER}" alt="Pie de página"/></div>
  </div>
  </body></html>`;

  abrirDocViewer(html, `Acta Backup — ${b.serial}`);
}