import { CONFIG }    from '../config.js';
import { getData, getDBStatic } from '../state.js';
import { formatDate, parseFecha } from '../utils.js';

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
    html,body{
      background:#e8e8e8;
      font-family:Arial,sans-serif;
      font-size:10.5pt;
      color:#111;
    }
    .pagina{
      width:21.59cm;
      min-height:33.02cm;
      margin:0.8cm auto;
      background:#fff;
      display:flex;
      flex-direction:column;
      box-shadow:0 4px 24px rgba(0,0,0,0.18);
      position:relative;
    }

    /* ── Encabezado con menos opacidad ── */
    .header{
      width:100%;
      opacity:0.75;
    }
    .header img{
      width:100%;
      display:block;
    }

    /* ── Cuerpo del documento ── */
    .body-wrap{
      flex:1;
      padding:0.5cm 1.8cm 0.4cm;
      display:flex;
      flex-direction:column;
    }

    /* ── Pie de página con menos opacidad ── */
    .footer{
      margin-top:auto;
      width:100%;
      opacity:0.35;
    }
    .footer img{
      width:100%;
      display:block;
    }

    /* ── Título del documento ── */
    .titulo{
      text-align:center;
      font-size:13pt;
      font-weight:bold;
      text-transform:uppercase;
      margin:0.4cm 0 0.5cm;
      letter-spacing:0.5px;
      color:#1a1a1a;
      border-bottom:2pt solid #c0392b;
      padding-bottom:0.2cm;
    }

    /* ── Metadatos ── */
    .meta{
      margin-bottom:0.4cm;
      font-size:10pt;
      background:#f9f9f9;
      border:1px solid #e0e0e0;
      border-radius:4px;
      padding:0.3cm 0.4cm;
    }
    .meta p{
      margin-bottom:4px;
      display:flex;
      gap:8px;
    }
    .meta p b{
      min-width:5cm;
      color:#555;
    }

    /* ── Secciones ── */
    .sec{
      font-weight:bold;
      font-size:10.5pt;
      margin:0.35cm 0 0.15cm;
      color:#c0392b;
      border-left:3pt solid #c0392b;
      padding-left:0.2cm;
    }
    .sec-title{
      font-weight:bold;
      font-size:10.5pt;
      margin:0.35cm 0 0.15cm;
      text-transform:uppercase;
      border-left:3pt solid #8B0000;
      padding-left:7px;
      color:#8B0000;
    }

    /* ── Tabla ── */
    table{
      width:100%;
      border-collapse:collapse;
      margin-bottom:0.3cm;
      font-size:9.5pt;
    }
    td,th{
      padding:5px 10px;
      vertical-align:top;
      border:1px solid #ddd;
      text-align:left;
    }
    th{
      background:#c0392b;
      color:#fff;
      font-weight:bold;
      font-size:9pt;
    }
    tr:nth-child(even) td{background:#f7f7f7;}

    /* ── Texto ── */
    .intro{
      margin-bottom:0.4cm;
      font-size:10pt;
      text-align:justify;
      line-height:1.6;
      color:#333;
    }
    .obs{
      font-size:10pt;
      text-align:justify;
      line-height:1.6;
      margin-bottom:0.2cm;
      color:#333;
    }
    .constancia{
      font-size:10pt;
      margin:0.3cm 0;
      text-align:justify;
      font-style:italic;
      color:#555;
    }

    /* ── Indicadores ── */
    .indicadores{margin:0.2cm 0 0.2cm 1cm;}
    .indicadores li{
      margin-bottom:4px;
      font-size:10pt;
      list-style:disc inside;
    }

    /* ── KPIs ── */
    .kpi-grid{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:10px;
      margin:0.3cm 0;
    }
    .kpi{
      background:#f9f9f9;
      border:1px solid #e0e0e0;
      border-radius:6px;
      padding:10px;
      text-align:center;
    }
    .kpi-num{
      font-size:20pt;
      font-weight:bold;
      color:#8B0000;
    }
    .kpi-num.green{color:#16a34a;}
    .kpi-num.orange{color:#d97706;}
    .kpi-num.purple{color:#7c3aed;}
    .kpi-label{font-size:8.5pt;color:#666;margin-top:3px;}

    /* ── Firmas ── */
    .firmas{
      display:flex;
      gap:2cm;
      align-items:flex-end;
      margin-top:0.5cm;
      margin-bottom:0.3cm;
    }
    .fbox{flex:1;text-align:center;}
    .fbox img{
      height:2cm;
      object-fit:contain;
      display:block;
      margin:0 auto 3px;
      max-width:6cm;
    }
    .flinea{
      border-top:1pt solid #111;
      padding-top:4px;
      line-height:1.5;
    }
    .fnombre{font-weight:bold;font-size:10.5pt;}
    .fcargo{font-size:9.5pt;color:#333;}

    /* ── Spacer ── */
    .spacer{flex:1;min-height:0.5cm;}

    /* ── Badges ── */
    .badge-g{color:#16a34a;background:#dcfce7;padding:1px 7px;border-radius:10px;font-size:8.5pt;font-weight:bold;}
    .badge-y{color:#d97706;background:#fef3c7;padding:1px 7px;border-radius:10px;font-size:8.5pt;font-weight:bold;}
    .badge-r{color:#dc2626;background:#fee2e2;padding:1px 7px;border-radius:10px;font-size:8.5pt;font-weight:bold;}

    /* ── Fotos evidencia ── */
    .fotos-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:8px;
      margin-bottom:0.3cm;
    }
    .fotos-grid img{
      width:100%;
      height:5cm;
      object-fit:cover;
      border-radius:4px;
      border:1px solid #e0e0e0;
    }

    /* ── Print ── */
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
  const m = getData('mantenimientos').find(x => x.id === id);
  console.log('firma en memoria:', m?.firma?.slice(0,50));

  const DB  = getDBStatic();
  if (!m) return;

  const eq  = getData('equipos').find(e => e.serial === m.serial);
  const p   = eq ? DB.personas.find(x => x.id === eq.usuarioId) : null;
  const of  = eq ? DB.oficinas.find(x => x.id === eq.oficina)   : null;
  const dep = of ? DB.dependencias.find(x => x.id === of.depId) : null;
  const fechaDoc = new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Acta Mantenimiento ${m.serial}</title>
  <style>${_cssDoc()}</style>
  </head><body>
  <div class="pagina">
    <div class="header"><img src="${CONFIG.IMG_HEADER}" alt="Encabezado"/></div>
    <div class="body-wrap">

      <div class="titulo">Acta de ${m.tipo || 'Mantenimiento Preventivo'}</div>

      <!-- METADATOS EN DOS COLUMNAS -->
      <table style="margin-bottom:0.4cm;font-size:10pt;">
        <tr style="background:#f9f9f9;">
          <td style="border:1px solid #e0e0e0;padding:5px 10px;width:50%;">
            <b style="color:#c0392b;"> Fecha de ejecución</b><br>${formatDate(m.fecha)}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;width:50%;">
            <b style="color:#c0392b;"> Próximo mantenimiento</b><br>${formatDate(m.fechaProxima) || '—'}
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;"> Serial del equipo</b><br>
            <span style="font-family:monospace;font-size:11pt;font-weight:bold;">${m.serial}</span>
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;"> Frecuencia</b><br>${m.frecuencia || '—'}
          </td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;"> Funcionario</b><br>${p?.nombre || '—'}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;"> Dependencia</b><br>${dep?.nombre || '—'}
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;"> Oficina</b><br>${of?.nombre || '—'}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;"> Responsable TI</b><br>${m.responsable || CONFIG.RESPONSABLE_TI}
          </td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;"> Estado del equipo</b><br>
            <span style="background:${m.estadoEquipo==='Operativo'?'#dcfce7':m.estadoEquipo==='Dado de baja'?'#fee2e2':'#fef3c7'};
              color:${m.estadoEquipo==='Operativo'?'#166534':m.estadoEquipo==='Dado de baja'?'#991b1b':'#92400e'};
              padding:2px 8px;border-radius:10px;font-size:9pt;font-weight:bold;">
              ${m.estadoEquipo || 'Operativo'}
            </span>
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#c0392b;"> Período</b><br>${m.periodo || '—'}
          </td>
        </tr>
      </table>

      <!-- ESPECIFICACIONES TÉCNICAS -->
      <div class="sec">⚙️ Especificaciones técnicas del equipo</div>
      <table style="margin-bottom:0.4cm;">
        <tr><th>Componente</th><th>Detalle</th><th>Componente</th><th>Detalle</th></tr>
        <tr>
          <td><b>Marca / Modelo</b></td>
          <td>${eq?.marca || '—'} ${eq?.modelo || ''}</td>
          <td><b>Sistema Operativo</b></td>
          <td>${eq?.so || '—'}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td><b>Procesador</b></td>
          <td>${eq?.procesador || '—'}</td>
          <td><b>Memoria RAM</b></td>
          <td>${eq?.ram || '—'}</td>
        </tr>
        <tr>
          <td><b>Tipo de disco</b></td>
          <td>${eq?.disco || '—'}</td>
          <td><b>Capacidad</b></td>
          <td>${eq?.cap || '—'}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td><b>Office / Suite</b></td>
          <td>${eq?.office || '—'}</td>
          <td><b>Ubicación física</b></td>
          <td>${eq?.ubicacion || '—'}</td>
        </tr>
      </table>

      <!-- ACTIVIDADES -->
      <div class="sec">🔧 Actividades realizadas</div>
      <div class="obs" style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:4px;padding:0.2cm 0.3cm;margin-bottom:0.3cm;">
        ${m.obs || 'Se realizaron actividades de mantenimiento preventivo según la programación establecida por el área de sistemas de la Alcaldía Municipal de Nemocón.'}
      </div>

      <!-- CREDENCIALES -->
      ${(m.userWin || m.userAdmin) ? `
      <div class="sec"> Datos de acceso verificados</div>
      <table style="margin-bottom:0.3cm;">
        <tr><th>Tipo</th><th>Usuario</th><th>¿Cambió?</th></tr>
        ${m.userWin ? `<tr><td>Windows</td><td style="font-family:monospace;">${m.userWin}</td><td>${m.cambioCred==='Sí'?'✅ Sí':'No'}</td></tr>` : ''}
        ${m.userAdmin ? `<tr style="background:#f9f9f9;"><td>Administrador</td><td style="font-family:monospace;">${m.userAdmin}</td><td>${m.cambioCred==='Sí'?'✅ Sí':'No'}</td></tr>` : ''}
      </table>` : ''}

      <!-- TRASLADO -->
      ${m.traslado === 'Sí' ? `
      <div class="sec"> Traslado de dependencia</div>
      <table style="margin-bottom:0.3cm;">
        <tr><th>Dependencia anterior</th><th>Nueva dependencia</th><th>Fecha</th></tr>
        <tr><td>${m.depAnterior || '—'}</td><td>${m.depNueva || '—'}</td><td>${formatDate(m.fechaTraslado)}</td></tr>
      </table>` : ''}

      <!-- EVIDENCIA FOTOGRÁFICA -->
      ${m.fotos?.length ? `
        <div class="sec"> Evidencia fotográfica (${m.fotos.length} foto${m.fotos.length>1?'s':''})</div>
        <div class="fotos-grid">
          ${m.fotos.slice(0,4).map(f =>
            `<img src="${f}" style="width:100%;height:5cm;object-fit:cover;border-radius:4px;border:1px solid #e0e0e0;">`
          ).join('')}
        </div>` : ''}

      <!-- CONSTANCIA -->
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;
        padding:0.2cm 0.3cm;margin:0.3cm 0;font-size:10pt;color:#0c4a6e;">
        En constancia de lo anterior, las partes firman la presente acta de mantenimiento
        en la ciudad de Nemocón, Cundinamarca, el día <b>${fechaDoc}</b>.
      </div>

      <div class="spacer"></div>

      <!-- FIRMAS -->
      <div class="firmas">
        <div class="fbox">
          ${m.firma
            ? `<img src="${m.firma}" alt="Firma funcionario" style="mix-blend-mode:multiply;">`
            : `<div style="height:2cm;border-bottom:1px solid #999;margin-bottom:4px;"></div>`}
          <div class="flinea">
            <div class="fnombre">${p?.nombre || '___________________________'}</div>
            <div class="fcargo">${p?.cargo || 'Funcionario'}</div>
            <div class="fcargo">${of?.nombre || '—'}</div>
            <div class="fcargo">${dep?.nombre || ''}</div>
          </div>
        </div>
        <div class="fbox">
          <img src="${CONFIG.IMG_FIRMA_TI}" alt="Firma TI" style="mix-blend-mode:multiply;">
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
  const fechaDoc = new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});

  const estadoColor = {
    Completado: { bg:'#dcfce7', color:'#166534' },
    Fallido:    { bg:'#fee2e2', color:'#991b1b' },
    Pendiente:  { bg:'#fef3c7', color:'#92400e' },
  }[b.estadoBk] || { bg:'#f3f4f6', color:'#374151' };

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Acta Copia de Seguridad ${b.serial}</title>
  <style>${_cssDoc()}</style>
  </head><body>
  <div class="pagina">
    <div class="header"><img src="${CONFIG.IMG_HEADER}" alt="Encabezado"/></div>
    <div class="body-wrap">

      <div class="titulo">Acta de Copia de Seguridad</div>

      <!-- METADATOS -->
      <table style="margin-bottom:0.4cm;font-size:10pt;">
        <tr style="background:#f9f9f9;">
          <td style="border:1px solid #e0e0e0;padding:5px 10px;width:50%;">
            <b style="color:#2563eb;">Fecha de ejecución</b><br>${formatDate(b.fecha)}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;width:50%;">
            <b style="color:#2563eb;">Próximo backup</b><br>${formatDate(b.fechaProxima) || '—'}
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Serial del equipo</b><br>
            <span style="font-family:monospace;font-size:11pt;font-weight:bold;">${b.serial}</span>
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Frecuencia</b><br>${b.frecuencia || '—'}
          </td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Responsable del equipo</b><br>${resp}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Dependencia</b><br>${dep?.nombre || '—'}
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Oficina</b><br>${of?.nombre || '—'}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Responsable TI</b><br>${b.respTI || CONFIG.RESPONSABLE_TI}
          </td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Tipo de backup</b><br>${b.tipo || '—'}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Destino / Medio</b><br>${b.destino || '—'}
          </td>
        </tr>
        <tr>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Lugar de ejecución</b><br>${b.ubicacion || '—'}
          </td>
          <td style="border:1px solid #e0e0e0;padding:5px 10px;">
            <b style="color:#2563eb;">Estado</b><br>
            <span style="background:${estadoColor.bg};color:${estadoColor.color};
              padding:2px 8px;border-radius:10px;font-size:9pt;font-weight:bold;">
              ${b.estadoBk || '—'}
            </span>
          </td>
        </tr>
      </table>

      <!-- ESPECIFICACIONES DEL EQUIPO -->
      <div class="sec">Especificaciones del equipo respaldado</div>
      <table style="margin-bottom:0.4cm;">
        <tr><th>Componente</th><th>Detalle</th><th>Componente</th><th>Detalle</th></tr>
        <tr>
          <td><b>Marca / Modelo</b></td>
          <td>${eq?.marca || '—'} ${eq?.modelo || ''}</td>
          <td><b>Sistema Operativo</b></td>
          <td>${eq?.so || '—'}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td><b>Procesador</b></td>
          <td>${eq?.procesador || '—'}</td>
          <td><b>Memoria RAM</b></td>
          <td>${eq?.ram || '—'}</td>
        </tr>
        <tr>
          <td><b>Tipo de disco</b></td>
          <td>${eq?.disco || '—'}</td>
          <td><b>Capacidad</b></td>
          <td>${eq?.cap || '—'}</td>
        </tr>
        <tr style="background:#f9f9f9;">
          <td><b>Office / Suite</b></td>
          <td>${eq?.office || '—'}</td>
          <td><b>Ubicación física</b></td>
          <td>${eq?.ubicacion || '—'}</td>
        </tr>
      </table>

      <!-- ACTIVIDADES -->
      <div class="sec">Actividades realizadas</div>
      <div class="obs" style="background:#f9f9f9;border:1px solid #e0e0e0;
        border-radius:4px;padding:0.2cm 0.3cm;margin-bottom:0.3cm;">
        ${m.obs
          ? m.obs.replace('Actividades realizadas:\n','')
              .split('\n')
              .filter(l => l.trim())
              .map(l => l.replace('• ','').trim())
              .filter(l => l && !l.startsWith('Observaciones'))
              .join(' · ')
          : 'Se realizaron actividades de mantenimiento preventivo según la programación establecida.'}
        ${m.obs?.includes('Observaciones adicionales:')
          ? `<br><br><b>Observaciones:</b> ${m.obs.split('Observaciones adicionales:\n')[1] || ''}`
          : ''}
      </div>

      <!-- EVIDENCIA -->
      ${b.fotos?.length ? `
        <div class="sec">Evidencia fotográfica (${b.fotos.length} foto${b.fotos.length>1?'s':''})</div>
        <div class="fotos-grid">
          ${b.fotos.slice(0,4).map(f =>
            `<img src="${f}" style="width:100%;height:5cm;object-fit:cover;border-radius:4px;border:1px solid #e0e0e0;">`
          ).join('')}
        </div>` : ''}

      <!-- CONSTANCIA -->
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;
        padding:0.2cm 0.3cm;margin:0.3cm 0;font-size:10pt;color:#1e40af;">
        En constancia de lo anterior, las partes firman la presente acta de copia de seguridad
        en la ciudad de Nemocón, Cundinamarca, el día <b>${fechaDoc}</b>.
      </div>

      <div class="spacer"></div>

      <!-- FIRMAS -->
      <div class="firmas">
        <div class="fbox">
          ${b.firma
            ? `<img src="${b.firma}" alt="Firma funcionario" style="mix-blend-mode:multiply;">`
            : `<div style="height:2cm;border-bottom:1px solid #999;margin-bottom:4px;"></div>`}
          <div class="flinea">
            <div class="fnombre">${resp}</div>
            <div class="fcargo">${p?.cargo || 'Funcionario'}</div>
            <div class="fcargo">${of?.nombre || '—'}</div>
            <div class="fcargo">${dep?.nombre || ''}</div>
          </div>
        </div>
        <div class="fbox">
          <img src="${CONFIG.IMG_FIRMA_TI}" alt="Firma TI" style="mix-blend-mode:multiply;">
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