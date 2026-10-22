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
const _fechaLarga = d =>
  d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

async function _construir(sel, { fotos }, onProgreso) {
  const hoyLargo = _fechaLarga(new Date());
  let css = '';
  const paginas = [];

  for (let i = 0; i < sel.length; i++) {
    const { tipo, r } = sel[i];
    let html = tipo === 'mant' ? armarActaMantenimiento(r) : armarActaBackup(r);
    if (html) {
      // La constancia final trae la fecha de hoy; en el lote debe ser la
      // fecha en que se realizó el registro.
      const fReg = parseFecha(r.fecha);
      if (fReg) {
        html = html.replace(`el día <b>${hoyLargo}</b>`, `el día <b>${_fechaLarga(fReg)}</b>`);
      }
    }
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

  // view: versión liviana para el visor (imágenes repetidas como blob:)
  // full: versión autocontenida (imágenes embebidas) para descargar tal cual
  return { view: await _dedupImagenes(doc), full: doc };
}

// ── Resumen en Excel ─────────────────────────────────────────
// Mismos filtros que las actas (tipo, dependencias, período). Hojas:
//   Resumen por dependencia · Mantenimientos · Backups · Equipos pendientes
const _esNoRealizado = m => String(m.obs || '').startsWith('Motivo de no realización');
const _si = v => (v ? 'Sí' : 'No');
const _fechaCorta = iso => String(iso).split('-').reverse().join('/');

function _ultimaFecha(lista, serial) {
  let max = null;
  for (const r of lista) {
    if (r.serial !== serial) continue;
    const d = parseFecha(r.fecha);
    if (d && (!max || d > max)) max = d;
  }
  return max;
}

function _anchos(aoa, header) {
  const n = Math.max(...aoa.map(r => r.length));
  const out = [];
  for (let c = 0; c < n; c++) {
    let w = 10;
    for (let r = header; r < aoa.length; r++) {
      const v = aoa[r][c];
      const len = v instanceof Date ? 10 : String(v ?? '').length;
      if (len + 2 > w) w = len + 2;
    }
    out.push(Math.min(w, 45));
  }
  return out;
}

export function armarHojasResumen(f) {
  const DB        = getDBStatic();
  const equipos   = getData('equipos') || [];
  const todasMant = getData('mantenimientos') || [];
  const todosBk   = getData('backups') || [];
  const ofById    = new Map((DB.oficinas || []).map(o => [o.id, o]));
  const depById   = new Map((DB.dependencias || []).map(d => [d.id, d]));
  const perById   = new Map((DB.personas || []).map(p => [String(p.id), p]));
  const eqBySerial = new Map(equipos.map(e => [e.serial, e]));

  const sel  = _seleccionar(f);
  const selM = sel.filter(x => x.tipo === 'mant');
  const selB = sel.filter(x => x.tipo === 'bk');

  const ctx = serial => {
    const eq  = eqBySerial.get(serial);
    const of  = eq ? ofById.get(eq.oficina) : null;
    const dep = of ? depById.get(of.depId) : null;
    const per = eq ? perById.get(String(eq.usuarioId)) : null;
    return { eq, of, dep, per };
  };

  // Dependencias consideradas
  let deps = [...(DB.dependencias || [])]
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  if (f.depIds) deps = deps.filter(d => f.depIds.has(String(d.id)));
  if (!f.depIds && sel.some(x => !x.dep)) deps.push({ id: '', nombre: '(Sin dependencia)' });

  const esDe = dep => x =>
    dep.id === '' ? !x.dep : !!x.dep && String(x.dep.id) === String(dep.id);
  const equiposDe = dep => dep.id === '' ? [] : equipos.filter(e => {
    const of = ofById.get(e.oficina);
    return !!of && String(of.depId) === String(dep.id);
  });

  // Cifras por dependencia
  const filas = deps.map(dep => {
    const eqs = equiposDe(dep);
    const m   = selM.filter(esDe(dep)).map(x => x.r);
    const b   = selB.filter(esDe(dep)).map(x => x.r);
    const serM = new Set(m.map(r => r.serial));
    const serB = new Set(b.map(r => r.serial));
    const pendList = eqs.filter(e =>
      (f.tipos.mant && !serM.has(e.serial)) || (f.tipos.bk && !serB.has(e.serial)));
    return {
      dep, serM, serB, pendList,
      equipos: eqs.length,
      mEq:   eqs.filter(e => serM.has(e.serial)).length,
      mReg:  m.length,
      mNo:   m.filter(_esNoRealizado).length,
      mFirm: m.filter(r => r.firmado).length,
      bEq:   eqs.filter(e => serB.has(e.serial)).length,
      bReg:  b.length,
      bOk:   b.filter(r => r.estadoBk === 'Completado').length,
      bFail: b.filter(r => r.estadoBk === 'Fallido').length,
      bFirm: b.filter(r => r.firmado).length,
      pend:  pendList.length,
    };
  });

  const suma = k => filas.reduce((a, o) => a + o[k], 0);
  const total = {};
  ['equipos','mEq','mReg','mNo','mFirm','bEq','bReg','bOk','bFail','bFirm','pend']
    .forEach(k => { total[k] = suma(k); });

  // ── Hoja 1: Resumen ──
  const enc = ['Dependencia', 'Total equipos'];
  if (f.tipos.mant) enc.push('Equipos con mantenimiento', 'Cobertura mantenimiento',
    'Mantenimientos registrados', 'Mantenimientos realizados',
    'No realizados / parciales', 'Mantenimientos firmados');
  if (f.tipos.bk) enc.push('Equipos con backup', 'Cobertura backup',
    'Backups registrados', 'Backups completados', 'Backups fallidos',
    'Backups otros estados', 'Backups firmados');
  enc.push('Equipos pendientes');
  const pct = [enc.indexOf('Cobertura mantenimiento'), enc.indexOf('Cobertura backup')]
    .filter(i => i >= 0);

  const razon = (n, d) => (d ? n / d : 0);
  const armarFila = (nombre, o) => {
    const fila = [nombre, o.equipos];
    if (f.tipos.mant) fila.push(o.mEq, razon(o.mEq, o.equipos), o.mReg,
      o.mReg - o.mNo, o.mNo, o.mFirm);
    if (f.tipos.bk) fila.push(o.bEq, razon(o.bEq, o.equipos), o.bReg,
      o.bOk, o.bFail, o.bReg - o.bOk - o.bFail, o.bFirm);
    fila.push(o.pend);
    return fila;
  };

  const aoaResumen = [
    ['Resumen de actas por dependencia'],
    [`Período: ${_fechaCorta(f.ini)} al ${_fechaCorta(f.fin)}`],
    [`Generado: ${new Date().toLocaleString('es-CO')}`],
    [],
    enc,
    ...filas.map(o => armarFila(o.dep.nombre, o)),
    armarFila('TOTAL', total),
  ];
  const hojas = [{
    nombre: 'Resumen', aoa: aoaResumen, header: 4, pct, filtro: false,
    anchos: _anchos(aoaResumen, 4),
  }];

  // ── Hoja 2: Mantenimientos ──
  if (f.tipos.mant) {
    const aoa = [[
      'Dependencia', 'Oficina', 'Funcionario', 'Serial', 'Marca', 'Modelo', 'Tipo',
      'Fecha ejecución', 'Próximo mantenimiento', 'Frecuencia', 'Estado del equipo',
      '¿Realizado?', 'Firmado', 'Fecha de firma', 'Responsable TI',
    ]];
    for (const { r, dep } of selM) {
      const c = ctx(r.serial);
      aoa.push([
        dep?.nombre || '(Sin dependencia)', c.of?.nombre || '', c.per?.nombre || '',
        r.serial, c.eq?.marca || '', c.eq?.modelo || '', r.tipo || '',
        parseFecha(r.fecha) || '', parseFecha(r.fechaProxima) || '',
        r.frecuencia || '', r.estadoEquipo || '',
        _esNoRealizado(r) ? 'No / parcial' : 'Sí',
        _si(r.firmado), parseFecha(r.firmaFecha) || '', r.responsable || '',
      ]);
    }
    hojas.push({ nombre: 'Mantenimientos', aoa, header: 0, anchos: _anchos(aoa, 0) });
  }

  // ── Hoja 3: Backups ──
  if (f.tipos.bk) {
    const aoa = [[
      'Dependencia', 'Oficina', 'Funcionario', 'Serial', 'Marca', 'Modelo',
      'Tipo de backup', 'Fecha', 'Próximo backup', 'Frecuencia', 'Destino',
      'Estado', 'Firmado', 'Fecha de firma', 'Responsable TI',
    ]];
    for (const { r, dep } of selB) {
      const c = ctx(r.serial);
      const resp = r.responsableEquipo || perById.get(String(r.personaId))?.nombre
        || c.per?.nombre || '';
      aoa.push([
        dep?.nombre || '(Sin dependencia)', c.of?.nombre || '', resp,
        r.serial, c.eq?.marca || '', c.eq?.modelo || '',
        r.tipo || '', parseFecha(r.fecha) || '', parseFecha(r.fechaProxima) || '',
        r.frecuencia || '', r.destino || '', r.estadoBk || '',
        _si(r.firmado), parseFecha(r.firmaFecha) || '', r.respTI || '',
      ]);
    }
    hojas.push({ nombre: 'Backups', aoa, header: 0, anchos: _anchos(aoa, 0) });
  }

  // ── Hoja 4: Equipos pendientes (sin acta en el período) ──
  const encP = ['Dependencia', 'Oficina', 'Funcionario', 'Serial', 'Marca', 'Modelo', 'Estado del equipo'];
  if (f.tipos.mant) encP.push('Sin mantenimiento en el período');
  if (f.tipos.bk)   encP.push('Sin backup en el período');
  encP.push('Último mantenimiento registrado', 'Último backup registrado');
  const aoaP = [encP];
  for (const o of filas) {
    for (const e of o.pendList) {
      const c = ctx(e.serial);
      const fila = [
        o.dep.nombre, c.of?.nombre || '', c.per?.nombre || '',
        e.serial, e.marca || '', e.modelo || '', e.estado || '',
      ];
      if (f.tipos.mant) fila.push(_si(!o.serM.has(e.serial)));
      if (f.tipos.bk)   fila.push(_si(!o.serB.has(e.serial)));
      fila.push(_ultimaFecha(todasMant, e.serial) || '', _ultimaFecha(todosBk, e.serial) || '');
      aoaP.push(fila);
    }
  }
  hojas.push({ nombre: 'Equipos pendientes', aoa: aoaP, header: 0, anchos: _anchos(aoaP, 0) });

  return hojas;
}

export function libroDeHojas(XLSX, hojas) {
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(h.aoa, { cellDates: true });
    ws['!cols'] = h.anchos.map(w => ({ wch: w }));
    const rango = XLSX.utils.decode_range(ws['!ref']);
    for (let R = h.header + 1; R <= rango.e.r; R++) {
      for (let C = rango.s.c; C <= rango.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (!cell) continue;
        if (cell.t === 'd') cell.z = 'dd/mm/yyyy';
        if (h.pct?.includes(C) && cell.t === 'n') cell.z = '0%';
      }
    }
    if (h.filtro !== false && rango.e.r > h.header) {
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: h.header, c: rango.s.c }, e: { r: rango.e.r, c: rango.e.c },
        }),
      };
    }
    XLSX.utils.book_append_sheet(wb, ws, h.nombre);
  }
  return wb;
}

// SheetJS se carga solo cuando se pide el Excel (no pesa en el arranque)
function _cargarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload  = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('XLSX no disponible')));
    s.onerror = () => reject(new Error('No se pudo cargar la librería de Excel'));
    document.head.appendChild(s);
  });
}

async function _exportarExcel() {
  const f   = _leer();
  const btn = document.getElementById('am-excel');
  const txt = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Preparando…'; }

  try {
    const XLSX  = await _cargarXLSX();
    const wb    = libroDeHojas(XLSX, armarHojasResumen(f));
    XLSX.writeFile(wb, `Resumen_actas_${f.ini}_a_${f.fin}.xlsx`);
    import('./toast.js').then(({ showToast }) => showToast('Excel generado'));
  } catch (e) {
    console.error(e);
    import('./toast.js').then(({ showToast }) =>
      showToast('No se pudo generar el Excel. Revisa tu conexión e intenta de nuevo.'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txt; }
  }
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

  const xl = document.getElementById('am-excel');
  const setXl = on => { if (xl) { xl.disabled = !on; xl.style.opacity = on ? '1' : '.5'; } };

  const bloquear = msg => {
    res.textContent = msg;
    btn.disabled = true;
    btn.style.opacity = '.5';
    setXl(false);
  };

  if (!f.tipos.mant && !f.tipos.bk)   return bloquear('Elige mantenimientos, backups o ambos.');
  if (f.depIds && !f.depIds.size)     return bloquear('Elige al menos una dependencia o marca "Todas".');
  if (!f.ini || !f.fin || f.ini > f.fin) return bloquear('Revisa el rango de fechas.');

  const sel = _seleccionar(f);
  if (!sel.length) {
    bloquear('No hay registros en ese período para lo seleccionado. El Excel sí se puede generar (lista los equipos pendientes).');
    setXl(true);
    return;
  }
  setXl(true);

  const nM = sel.filter(x => x.tipo === 'mant').length;
  const nB = sel.length - nM;
  const conFirma = sel.filter(x => String(x.r.firma || '').startsWith('data:image')).length;
  const marcadas = sel.filter(x => x.r.firmado).length;
  const conFotos = sel.filter(x => Array.isArray(x.r.fotos) && x.r.fotos.length).length;
  res.textContent =
    `Se generarán ${sel.length} actas (${nM} mantenimientos · ${nB} backups). ` +
    `Marcadas como firmadas: ${marcadas} · con imagen de firma disponible: ${conFirma} · con fotos: ${conFotos}.` +
    (f.fotos && sel.length > 40 ? ' Con fotos puede tardar y pesar bastante.' : '');
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
    const { view, full } = await _construir(sel, f, n => {
      btn.textContent = `Generando ${n}/${sel.length}…`;
    });
    _cerrar();
    abrirDocViewer(view, `Actas masivas — ${sel.length} actas`);
    _inyectarBotonDescargar(full, sel.length);
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

// Botón "Descargar" en la barra del visor, solo mientras se ve el lote.
// Baja el documento completo (con las imágenes embebidas) para abrirlo
// después en cualquier navegador exactamente como se ve aquí.
function _inyectarBotonDescargar(htmlCompleto, nActas) {
  const overlay = document.getElementById('doc-viewer-overlay');
  if (!overlay) return;
  overlay.querySelector('#doc-viewer-descargar-btn')?.remove();

  const imprimir = [...overlay.querySelectorAll('button')]
    .find(b => /imprimir/i.test(b.textContent));
  if (!imprimir) return;

  const btn = imprimir.cloneNode(true);
  btn.id = 'doc-viewer-descargar-btn';
  btn.removeAttribute('onclick');
  btn.textContent = 'Descargar';
  btn.addEventListener('click', () => {
    const blob = new Blob([htmlCompleto], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Actas_${_iso(new Date())}_${nActas}-actas.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
  imprimir.parentNode.insertBefore(btn, imprimir);

  // Quitar el botón cuando se cierre el visor
  const obs = new MutationObserver(() => {
    if (!overlay.classList.contains('open')) {
      btn.remove();
      obs.disconnect();
    }
  });
  obs.observe(overlay, { attributes: true, attributeFilter: ['class'] });
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
        <input type="checkbox" id="am-fotos" checked> Incluir evidencia fotográfica (pesa más)
      </label>

      <div id="am-resumen" style="font-size:12px;color:var(--text2);margin:14px 0;min-height:16px;"></div>

      <div style="display:flex;gap:10px;">
        <button id="am-cancelar" style="flex:1;padding:11px;border-radius:10px;border:1px solid var(--border);
          background:transparent;color:var(--text2);font-weight:600;cursor:pointer;">Cancelar</button>
        <button id="am-excel" title="Resumen en Excel con los mismos filtros" style="flex:1;padding:11px;border-radius:10px;
          border:1px solid #1e7e34;background:transparent;color:#1e7e34;font-weight:700;cursor:pointer;">Excel</button>
        <button id="am-generar" style="flex:2;padding:11px;border-radius:10px;border:none;
          background:#c0392b;color:#fff;font-weight:700;cursor:pointer;">Generar actas</button>
      </div>
    </div>`;

  document.body.appendChild(ov);

  ov.addEventListener('click', e => { if (e.target === ov) _cerrar(); });
  ov.querySelector('#am-cancelar').onclick = _cerrar;
  ov.querySelector('#am-generar').onclick  = _generar;
  ov.querySelector('#am-excel').onclick    = _exportarExcel;

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
