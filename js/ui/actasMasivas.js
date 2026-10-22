// js/ui/actasMasivas.js
// Generación masiva de actas INDIVIDUALES (mantenimientos y backups):
// se eligen dependencias (o todas) y un rango de fechas, y se arma un solo
// documento con una acta por página, listo para imprimir / guardar como PDF.

import { getData, getDBStatic } from '../state.js';
import { parseFecha, escHtml } from '../utils.js';
import {
  abrirDocViewer,
  capturarActaHTML,
  verActaMantenimiento,
  verActaBackup,
} from './documento.js';

// Reutiliza las actas individuales tal como existen hoy (sin tocar su código):
// se "captura" el HTML que ellas mandarían al visor en vez de abrirlo.
function armarActaMantenimiento(m) {
  return capturarActaHTML(() => verActaMantenimiento(m.id));
}
function armarActaBackup(b) {
  return capturarActaHTML(() => verActaBackup(b.id));
}

const ORDEN_TIPO = { mant: 0, bk: 1 };
let _blobUrls = [];

const _iso = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ── Selección de registros ───────────────────────────────────
function _seleccionar({ tipos, depIds, ini, fin }) {
  const DB = getDBStatic();
  const eqBySerial = new Map((getData('equipos') || []).map(e => [e.serial, e]));
  const ofById     = new Map((DB.oficinas || []).map(o => [o.id, o]));
  const depById    = new Map((DB.dependencias || []).map(d => [d.id, d]));

  const depDeSerial = serial => {
    const eq = eqBySerial.get(serial);
    const of = eq ? ofById.get(eq.oficina) : null;
    return of ? depById.get(of.depId) || null : null;
  };

  const dIni = new Date(ini + 'T00:00:00');
  const dFin = new Date(fin + 'T23:59:59');
  const out  = [];

  const agregar = (tipo, lista) => {
    for (const r of lista) {
      const f = parseFecha(r.fecha);
      if (!f || f < dIni || f > dFin) continue;
      const dep = depDeSerial(r.serial);
      if (depIds && !(dep && depIds.has(String(dep.id)))) continue;
      out.push({ tipo, r, dep });
    }
  };

  if (tipos.mant) agregar('mant', getData('mantenimientos') || []);
  if (tipos.bk)   agregar('bk',   getData('backups') || []);

  // Orden: dependencia → tipo (mantenimientos primero) → serial
  out.sort((a, b) =>
    String(a.dep?.nombre || 'zzz').localeCompare(String(b.dep?.nombre || 'zzz'), 'es') ||
    ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo] ||
    String(a.r.serial).localeCompare(String(b.r.serial))
  );
  return out;
}

// ── Imágenes repetidas (encabezado, pie, firma TI) ───────────
// Si vienen como base64, repetirlas en cada página haría el documento enorme.
// Se convierten una sola vez a blob: URL y se reutilizan.
async function _dedupImagenes(html) {
  const CONFIG = window.APP_CONFIG || {};
  _blobUrls.forEach(u => URL.revokeObjectURL(u));
  _blobUrls = [];
  for (const key of ['IMG_HEADER', 'IMG_FOOTER', 'IMG_FIRMA_TI']) {
    const src = CONFIG[key];
    if (!src || !String(src).startsWith('data:')) continue;
    try {
      const blob = await (await fetch(src)).blob();
      const url  = URL.createObjectURL(blob);
      _blobUrls.push(url);
      html = html.split(src).join(url);
    } catch (e) {
      console.warn('No se pudo optimizar', key, e);
    }
  }
  return html;
}

// ── Construcción del documento combinado ─────────────────────
async function _construir(sel, { fotos }, onProgreso) {
  let css = '';
  const paginas = [];

  for (let i = 0; i < sel.length; i++) {
    const { tipo, r } = sel[i];
    let html = tipo === 'mant' ? armarActaMantenimiento(r) : armarActaBackup(r);
    if (html && !fotos) {
      // Quita el bloque de evidencia fotográfica (título + grilla de imágenes)
      html = html.replace(
        /<div class="sec">\s*Evidencia fotográfica[\s\S]*?<\/div>\s*<div class="fotos-grid">[\s\S]*?<\/div>/,
        ''
      );
    }
    if (html) {
      if (!css) css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
      paginas.push(html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')));
    }
    if (i % 10 === 9) {
      onProgreso(i + 1);
      await new Promise(res => setTimeout(res));
    }
  }

  const doc = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Actas masivas</title>
  <style>
    ${css}
    @media print {
      /* El pie original es position:fixed (una sola página). Con muchas actas
         se apilaría en cada hoja, así que aquí va dentro de cada acta. */
      .pagina{min-height:12.97in;break-after:page;page-break-after:always;}
      .pagina:last-of-type{break-after:auto;page-break-after:auto;}
      .footer{position:static !important;}
    }
  </style></head><body>${paginas.join('\n')}</body></html>`;

  return _dedupImagenes(doc);
}

// ── Formulario ───────────────────────────────────────────────
function _leer() {
  const q = s => document.querySelector(s);
  const todas = q('#am-todas').checked;
  return {
    tipos:  { mant: q('#am-t-mant').checked, bk: q('#am-t-bk').checked },
    depIds: todas
      ? null
      : new Set([...document.querySelectorAll('.am-dep:checked')].map(c => c.value)),
    ini:   q('#am-ini').value,
    fin:   q('#am-fin').value,
    fotos: q('#am-fotos').checked,
  };
}

function _actualizar() {
  const f   = _leer();
  const res = document.getElementById('am-resumen');
  const btn = document.getElementById('am-generar');
  if (!res || !btn) return;

  const bloquear = msg => {
    res.textContent = msg;
    btn.disabled = true;
    btn.style.opacity = '.5';
  };

  if (!f.tipos.mant && !f.tipos.bk)   return bloquear('Elige mantenimientos, backups o ambos.');
  if (f.depIds && !f.depIds.size)     return bloquear('Elige al menos una dependencia o marca "Todas".');
  if (!f.ini || !f.fin || f.ini > f.fin) return bloquear('Revisa el rango de fechas.');

  const sel = _seleccionar(f);
  if (!sel.length) return bloquear('No hay registros en ese período para lo seleccionado.');

  const nM = sel.filter(x => x.tipo === 'mant').length;
  const nB = sel.length - nM;
  res.textContent =
    `Se generarán ${sel.length} actas (${nM} mantenimientos · ${nB} backups)` +
    (f.fotos && sel.length > 40 ? ' — con fotos puede tardar y pesar bastante.' : '');
  btn.disabled = false;
  btn.style.opacity = '1';
}

async function _generar() {
  const f   = _leer();
  const sel = _seleccionar(f);
  if (!sel.length) return;

  const btn = document.getElementById('am-generar');
  btn.disabled = true;
  btn.textContent = `Generando 0/${sel.length}…`;

  try {
    const html = await _construir(sel, f, n => {
      btn.textContent = `Generando ${n}/${sel.length}…`;
    });
    _cerrar();
    abrirDocViewer(html, `Actas masivas — ${sel.length} actas`);
    import('./toast.js').then(({ showToast }) =>
      showToast('Listo. Usa imprimir → Guardar como PDF')
    );
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = 'Generar actas';
    import('./toast.js').then(({ showToast }) => showToast('Error generando las actas'));
  }
}

function _cerrar() {
  document.getElementById('actas-masivas-overlay')?.remove();
}

export function abrirActasMasivas() {
  _cerrar();
  const DB   = getDBStatic();
  const deps = [...(DB.dependencias || [])]
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const hoy = new Date();
  const ini = _iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const fin = _iso(hoy);

  const inputStyle =
    'width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;' +
    'padding:8px 10px;color:var(--text1);font-size:13px;';
  const labelStyle =
    'font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;' +
    'letter-spacing:.5px;margin:14px 0 6px;display:block;';
  const rowStyle =
    'display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;color:var(--text1);cursor:pointer;';

  const ov = document.createElement('div');
  ov.id = 'actas-masivas-overlay';
  ov.style.cssText =
    'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);' +
    'display:flex;align-items:flex-end;justify-content:center;';

  ov.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);width:100%;max-width:520px;
      max-height:92vh;overflow:auto;border-radius:16px 16px 0 0;padding:20px;">

      <div style="font-size:17px;font-weight:800;color:var(--text1);">Generar actas en lote</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px;">
        Una acta individual por registro, en un solo documento para imprimir o guardar como PDF.
      </div>

      <span style="${labelStyle}">Tipo de acta</span>
      <label style="${rowStyle}"><input type="checkbox" id="am-t-mant" checked> Mantenimientos</label>
      <label style="${rowStyle}"><input type="checkbox" id="am-t-bk" checked> Backups</label>

      <span style="${labelStyle}">Dependencias</span>
      <label style="${rowStyle}font-weight:700;">
        <input type="checkbox" id="am-todas" checked> Todas las dependencias
      </label>
      <div style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:2px 10px;">
        ${deps.map(d => `
          <label style="${rowStyle}">
            <input type="checkbox" class="am-dep" value="${escHtml(String(d.id))}" disabled>
            ${escHtml(d.nombre)}
          </label>`).join('')}
      </div>

      <span style="${labelStyle}">Período</span>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Desde</div>
          <input type="date" id="am-ini" value="${ini}" style="${inputStyle}"></div>
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Hasta</div>
          <input type="date" id="am-fin" value="${fin}" style="${inputStyle}"></div>
      </div>

      <label style="${rowStyle}margin-top:10px;">
        <input type="checkbox" id="am-fotos"> Incluir evidencia fotográfica (pesa mucho)
      </label>

      <div id="am-resumen" style="font-size:12px;color:var(--text2);margin:14px 0;min-height:16px;"></div>

      <div style="display:flex;gap:10px;">
        <button id="am-cancelar" style="flex:1;padding:11px;border-radius:10px;border:1px solid var(--border);
          background:transparent;color:var(--text2);font-weight:600;cursor:pointer;">Cancelar</button>
        <button id="am-generar" style="flex:2;padding:11px;border-radius:10px;border:none;
          background:#c0392b;color:#fff;font-weight:700;cursor:pointer;">Generar actas</button>
      </div>
    </div>`;

  document.body.appendChild(ov);

  ov.addEventListener('click', e => { if (e.target === ov) _cerrar(); });
  ov.querySelector('#am-cancelar').onclick = _cerrar;
  ov.querySelector('#am-generar').onclick  = _generar;

  ov.querySelector('#am-todas').addEventListener('change', e => {
    ov.querySelectorAll('.am-dep').forEach(c => {
      c.checked  = false;
      c.disabled = e.target.checked;
    });
    _actualizar();
  });
  ov.querySelectorAll('.am-dep').forEach(c => c.addEventListener('change', _actualizar));
  ov.querySelectorAll('#am-t-mant, #am-t-bk, #am-fotos, #am-ini, #am-fin')
    .forEach(el => el.addEventListener('change', _actualizar));

  _actualizar();
}

window.abrirActasMasivas = abrirActasMasivas;
