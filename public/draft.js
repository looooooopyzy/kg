(() => {
  const STORAGE_KEY = 'jieti-youxing-draft-v1';
  const panel = document.getElementById('draft-panel');
  const toggle = document.getElementById('draft-toggle');
  const canvas = document.getElementById('draft-canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('draft-status');
  const finger = document.getElementById('draft-finger');
  const widthInput = document.getElementById('draft-width');
  const COLORS = ['#20342e', '#d1694e', '#315d75'];
  let tool = 'pen';
  let color = COLORS[0];
  let pointer = null;
  let active = null;
  let strokes = [];
  let cssWidth = 1;
  let cssHeight = 1;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) strokes = saved.slice(-250).filter(s => s && ['pen', 'eraser'].includes(s.tool) && Array.isArray(s.points) && s.points.length <= 4000);
  } catch { /* The drawing stays usable if browser storage is unavailable. */ }

  function announce(message) { status.textContent = message; }
  function updateButtons() {
    document.getElementById('draft-undo').disabled = strokes.length === 0;
    document.getElementById('draft-clear').disabled = strokes.length === 0;
    document.querySelectorAll('[data-draft-tool]').forEach(b => { const selected = b.dataset.draftTool === tool; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
    document.querySelectorAll('[data-draft-color]').forEach(b => { const selected = b.dataset.draftColor === color; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(strokes)); announce('草稿已保存在当前浏览器，不会随提问发给模型。'); }
    catch { announce('浏览器存储空间不足，请先保存图片。草稿仍保留在本页。'); }
    updateButtons();
  }
  function setupCanvas() {
    if (panel.hidden) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    cssWidth = rect.width;
    cssHeight = rect.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const nextWidth = Math.round(cssWidth * ratio);
    const nextHeight = Math.round(cssHeight * ratio);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      repaint();
    }
  }
  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      p: event.pointerType === 'pen' && event.pressure > 0 ? Math.max(.15, Math.min(1, event.pressure)) : .5,
    };
  }
  function drawDot(stroke, point) {
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.fillStyle = stroke.tool === 'eraser' ? '#000' : stroke.color;
    ctx.beginPath();
    ctx.arc(point.x * cssWidth, point.y * cssHeight, stroke.width * (stroke.tool === 'eraser' ? 1.8 : .55 + point.p) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function drawSegment(stroke, a, b) {
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#000' : stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.width * (stroke.tool === 'eraser' ? 1.8 : .55 + (a.p + b.p) / 2);
    ctx.beginPath();
    ctx.moveTo(a.x * cssWidth, a.y * cssHeight);
    ctx.lineTo(b.x * cssWidth, b.y * cssHeight);
    ctx.stroke();
    ctx.restore();
  }
  function repaint() {
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    for (const stroke of strokes) {
      const points = stroke.points;
      if (!points.length) continue;
      drawDot(stroke, points[0]);
      for (let i = 1; i < points.length; i++) drawSegment(stroke, points[i - 1], points[i]);
    }
  }
  function finish(event) {
    if (event.pointerId !== pointer) return;
    if (active?.points.length) {
      strokes.push(active);
      if (strokes.length > 250) strokes.shift();
      save();
    }
    active = null;
    pointer = null;
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* Capture may already be gone. */ }
  }

  canvas.addEventListener('pointerdown', event => {
    if (pointer !== null || (event.pointerType === 'touch' && !finger.checked) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    pointer = event.pointerId;
    active = { tool, color, width: Number(widthInput.value), points: [pointFrom(event)] };
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Continue while pointer remains over canvas. */ }
    drawDot(active, active.points[0]);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer || !active) return;
    event.preventDefault();
    const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
    for (const sample of samples) {
      if (active.points.length >= 4000) break;
      const next = pointFrom(sample);
      const last = active.points[active.points.length - 1];
      if (Math.abs(next.x - last.x) * cssWidth + Math.abs(next.y - last.y) * cssHeight < .5) continue;
      active.points.push(next);
      drawSegment(active, last, next);
    }
  });
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('lostpointercapture', event => { if (event.pointerId === pointer) finish(event); });

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.hidden = open;
    if (open) { requestAnimationFrame(setupCanvas); document.getElementById('draft-close').focus(); }
    else toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(true));
  document.getElementById('draft-close').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) setOpen(false); });
  document.querySelectorAll('[data-draft-tool]').forEach(b => b.addEventListener('click', () => { tool = b.dataset.draftTool; updateButtons(); }));
  document.querySelectorAll('[data-draft-color]').forEach(b => b.addEventListener('click', () => { color = b.dataset.draftColor; tool = 'pen'; updateButtons(); }));
  document.getElementById('draft-undo').addEventListener('click', () => { if (strokes.length) { strokes.pop(); repaint(); save(); } });
  document.getElementById('draft-clear').addEventListener('click', () => { if (strokes.length && window.confirm('清空整张草稿纸？')) { strokes = []; repaint(); save(); } });
  document.getElementById('draft-export').addEventListener('click', () => {
    setupCanvas();
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const out = output.getContext('2d');
    out.fillStyle = '#fffefa';
    out.fillRect(0, 0, output.width, output.height);
    out.drawImage(canvas, 0, 0);
    output.toBlob(blob => {
      if (!blob) { announce('图片生成失败，请重试。'); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '解题有形-草稿.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      announce('草稿图片已准备保存。');
    }, 'image/png');
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(setupCanvas).observe(canvas.parentElement);
  window.addEventListener('resize', setupCanvas);
  updateButtons();
})();
