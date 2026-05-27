import { getData, getDBStatic } from '../state.js';

// Construir un SearchSelect genérico
export function buildSearchSelect(containerId, items, placeholder, onSelect, selectedValue='', onCrear=null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let selected = items.find(i => i.value === selectedValue) || null;
  let allItems = items;

  const render = () => {
    container.innerHTML = selected
      ? `<div class="ss-selected">
           <span style="flex:1;font-size:13px;">${selected.label}</span>
           <button class="ss-clear" id="${containerId}-clear">✕</button>
         </div>`
      : `<div class="ss-wrap">
           <input class="form-input ss-input" id="${containerId}-input"
             placeholder="${placeholder}" autocomplete="off">
           <div class="ss-dropdown" id="${containerId}-drop" style="display:none;"></div>
         </div>`;

    if (selected) {
      document.getElementById(`${containerId}-clear`)?.addEventListener('click', () => {
        selected = null; render(); onSelect('');
      });
    } else {
      const inp  = document.getElementById(`${containerId}-input`);
      const drop = document.getElementById(`${containerId}-drop`);
      if (!inp || !drop) return;

      inp.addEventListener('focus', () => {
        _fillDrop(allItems, drop, onSelectItem, onCrear);
        drop.style.display = 'block';
      });

      inp.addEventListener('input', () => {
        const q = inp.value.toLowerCase();
        const filtered = allItems.filter(i => i.label.toLowerCase().includes(q));
        _fillDrop(filtered, drop, onSelectItem, onCrear);
        drop.style.display = 'block';
      });

      document.addEventListener('click', function handler(e) {
        if (!container.contains(e.target)) {
          drop.style.display = 'none';
          document.removeEventListener('click', handler);
        }
      });
    }
  };

  const onSelectItem = (item) => { selected = item; render(); onSelect(item.value); };
  render();

  container._getSSValue = () => selected?.value || '';
  container._setSSValue = (val, label) => {
    selected = val ? { value: val, label: label || val } : null;
    render();
  };
}

function _showDrop(inp, drop, items, onSelect) {
  _fillDrop(items, drop, onSelect);
  drop.style.display = 'block';
}

function _filterDrop(q, drop, items, onSelect) {
  const filtered = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));
  _fillDrop(filtered, drop, onSelect);
  drop.style.display = 'block';
}

function _fillDrop(items, drop, onSelect, onCrear, placeholder) {
  if (!items.length) {
    drop.innerHTML = `
      <div class="ss-option" style="color:var(--text3);font-style:italic;">
        Sin resultados
      </div>
      ${onCrear ? `
        <div style="padding:8px 12px;border-top:1px solid var(--border);">
          <button style="
            width:100%;padding:8px;background:var(--accent);color:#fff;
            border:none;border-radius:var(--radius-sm);font-family:var(--font-main);
            font-size:12px;font-weight:600;cursor:pointer;
          " id="ss-crear-btn">
            ➕ Registrar nuevo
          </button>
        </div>` : ''}`;
    drop.querySelector('#ss-crear-btn')?.addEventListener('click', onCrear);
    return;
  }
  drop.innerHTML = items.slice(0, 50).map(i =>
    `<div class="ss-option" data-val="${i.value}">${i.label}</div>`
  ).join('');
  drop.querySelectorAll('.ss-option[data-val]').forEach(el => {
    el.addEventListener('click', () => onSelect({ value: el.dataset.val, label: el.textContent }));
  });
}

// Helpers para obtener/establecer valores
export function getSSValue(containerId) {
  return document.getElementById(containerId)?._getSSValue?.() || '';
}

export function setSSValue(containerId, val, label) {
  document.getElementById(containerId)?._setSSValue?.(val, label);
}

// Llenar con equipos
export function llenarSSEquipos(containerId, onSelect=()=>{}, onCrear=null) {
  const DB    = getDBStatic();
  const items = getData('equipos').map(e => {
    const p = DB.personas.find(x => x.id === e.usuarioId);
    return { value: e.serial, label: `${e.serial}${p ? ' — '+p.nombre : ''}` };
  });
  buildSearchSelect(containerId, items, 'Buscar equipo...', onSelect, '', onCrear);
}

// Llenar con personas
export function llenarSSPersonas(containerId, onSelect=()=>{}, onCrear=null) {
  const items = getDBStatic().personas.map(p => ({ value: p.id, label: p.nombre }));
  buildSearchSelect(containerId, items, 'Buscar funcionario...', onSelect, '', onCrear);
}

// Llenar con oficinas
export function llenarSSOficinas(containerId, onSelect = () => {}) {
  const DB    = getDBStatic();
  const items = DB.oficinas.map(o => {
    const dep = DB.dependencias.find(d => d.id === o.depId);
    return { value: o.id, label: `${o.nombre} — ${dep?.nombre?.replace(/Secretar[ií]a de /i,'Sec. ')||''}` };
  });
  buildSearchSelect(containerId, items, 'Buscar oficina...', onSelect);
}