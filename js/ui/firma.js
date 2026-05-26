// ============================================================
// MÓDULO DE FIRMA DIGITAL
// ============================================================

let _canvas, _ctx, _drawing = false, _firmaActual = null;
let _onFirmada = null; // callback cuando se confirma la firma

// ── Abrir modal de firma ──────────────────────────────────────
export function abrirFirma(tipo, id, onFirmada) {
  _onFirmada = onFirmada;
  _firmaActual = null;

  // Crear modal si no existe
  if (!document.getElementById('modal-firma')) {
    _inyectarModal();
  }

  // Limpiar canvas
  setTimeout(() => {
    _initCanvas();
    _limpiar();
  }, 50);

  // Mostrar info del registro
  const infoEl = document.getElementById('firma-info');
  if (infoEl) {
    infoEl.textContent = `${tipo === 'mant' ? '🔧 Mantenimiento' : '💾 Backup'} · ${id}`;
  }

  document.getElementById('modal-firma').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ── Cerrar modal ──────────────────────────────────────────────
export function cerrarFirma() {
  document.getElementById('modal-firma')?.classList.remove('open');
  document.body.style.overflow = '';
  _drawing = false;
  _onFirmada = null;
}

// ── Obtener firma como base64 ─────────────────────────────────
export function getFirmaBase64() {
  return _firmaActual;
}

// ── Inyectar HTML del modal ───────────────────────────────────
function _inyectarModal() {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="modal-overlay" id="modal-firma">
      <div class="modal" style="padding-bottom:24px;">
        <div class="modal-handle"></div>
        <div class="modal-title">✍️ Firma del funcionario</div>

        <div id="firma-info" style="
          font-size:12px;color:var(--text3);
          margin-bottom:12px;text-align:center;
        "></div>

        <p style="font-size:12px;color:var(--text3);margin-bottom:8px;text-align:center;">
          Firme en el recuadro con su dedo o mouse
        </p>

        <!-- Canvas de firma -->
        <div style="
          border:2px solid var(--border);
          border-radius:var(--radius-sm);
          background:#fff;
          position:relative;
          margin-bottom:10px;
          touch-action:none;
        ">
          <canvas id="firma-canvas"
            style="display:block;width:100%;height:180px;border-radius:6px;cursor:crosshair;">
          </canvas>
          <div id="firma-placeholder" style="
            position:absolute;inset:0;
            display:flex;align-items:center;justify-content:center;
            color:#ccc;font-size:13px;pointer-events:none;
          ">
            Firme aquí
          </div>
        </div>

        <!-- Preview de la firma -->
        <div id="firma-preview-wrap" style="display:none;margin-bottom:10px;text-align:center;">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Vista previa:</div>
          <img id="firma-preview-img"
            style="max-height:80px;border:1px solid var(--border);border-radius:6px;background:#fff;"
            alt="Firma">
        </div>

        <!-- Botones -->
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <button class="btn btn-secondary" style="flex:1;margin-top:0;" id="firma-limpiar-btn">
            🗑️ Limpiar
          </button>
          <button class="btn btn-primary" style="flex:2;margin-top:0;" id="firma-confirmar-btn">
            ✅ Confirmar firma
          </button>
        </div>
        <button class="btn btn-secondary" style="margin-top:0;" id="firma-cancelar-btn">
          Cancelar
        </button>
      </div>
    </div>
  `;
  document.getElementById('modals-container').appendChild(div.firstElementChild);

  // Bind botones
  document.getElementById('firma-limpiar-btn').addEventListener('click', _limpiar);
  document.getElementById('firma-confirmar-btn').addEventListener('click', _confirmar);
  document.getElementById('firma-cancelar-btn').addEventListener('click', cerrarFirma);
}

// ── Inicializar canvas ────────────────────────────────────────
function _initCanvas() {
  _canvas = document.getElementById('firma-canvas');
  if (!_canvas) return;

  // Ajustar resolución real del canvas al tamaño visual
  const rect = _canvas.getBoundingClientRect();
  _canvas.width  = rect.width  || 340;
  _canvas.height = 180;

  _ctx = _canvas.getContext('2d');
  _ctx.strokeStyle = '#1a1a18';
  _ctx.lineWidth   = 2.5;
  _ctx.lineCap     = 'round';
  _ctx.lineJoin    = 'round';

  // Mouse events
  _canvas.addEventListener('mousedown',  _startDraw);
  _canvas.addEventListener('mousemove',  _draw);
  _canvas.addEventListener('mouseup',    _stopDraw);
  _canvas.addEventListener('mouseleave', _stopDraw);

  // Touch events
  _canvas.addEventListener('touchstart',  _touchStart,  { passive: false });
  _canvas.addEventListener('touchmove',   _touchMove,   { passive: false });
  _canvas.addEventListener('touchend',    _stopDraw);
  _canvas.addEventListener('touchcancel', _stopDraw);
}

// ── Dibujo con mouse ──────────────────────────────────────────
function _getPos(e) {
  const rect = _canvas.getBoundingClientRect();
  const scaleX = _canvas.width  / rect.width;
  const scaleY = _canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
  };
}

function _startDraw(e) {
  _drawing = true;
  const pos = _getPos(e);
  _ctx.beginPath();
  _ctx.moveTo(pos.x, pos.y);
  _hidePlaceholder();
}

function _draw(e) {
  if (!_drawing) return;
  const pos = _getPos(e);
  _ctx.lineTo(pos.x, pos.y);
  _ctx.stroke();
}

function _stopDraw() {
  _drawing = false;
  _ctx?.beginPath();
}

// ── Dibujo con touch ──────────────────────────────────────────
function _touchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  _canvas.dispatchEvent(mouseEvent);
}

function _touchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  _canvas.dispatchEvent(mouseEvent);
}

// ── Helpers ───────────────────────────────────────────────────
function _hidePlaceholder() {
  const ph = document.getElementById('firma-placeholder');
  if (ph) ph.style.display = 'none';
}

function _estaVacio() {
  if (!_canvas || !_ctx) return true;
  const data = _ctx.getImageData(0, 0, _canvas.width, _canvas.height).data;
  // Si todos los píxeles son transparentes → vacío
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return false;
  }
  return true;
}

function _limpiar() {
  if (!_canvas || !_ctx) return;
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  _firmaActual = null;
  const ph = document.getElementById('firma-placeholder');
  if (ph) ph.style.display = 'flex';
  const pw = document.getElementById('firma-preview-wrap');
  if (pw) pw.style.display = 'none';
}

function _confirmar() {
  if (_estaVacio()) {
    import('./toast.js').then(({ showToast }) => {
      showToast('⚠️ Por favor firme antes de confirmar', '#d97706');
    });
    return;
  }

  // Generar base64 con fondo blanco
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width  = _canvas.width;
  tempCanvas.height = _canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.fillStyle = '#ffffff';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  tempCtx.drawImage(_canvas, 0, 0);

  _firmaActual = tempCanvas.toDataURL('image/png');

  // Mostrar preview
  const img = document.getElementById('firma-preview-img');
  const pw  = document.getElementById('firma-preview-wrap');
  if (img && pw) {
    img.src = _firmaActual;
    pw.style.display = 'block';
  }

  // Ejecutar callback con la firma
  if (_onFirmada) {
    _onFirmada(_firmaActual);
  }

  cerrarFirma();
}