/**
 * Canvas and SVG renderer implementations for the shared Scene Graph.
 * Rendering is intentionally separate from chart layout and data semantics.
 */
const NO_FILL_TOKENS = new Set(['none', 'transparent', '']);
function color(style, key, fallback) { return style && style[key] != null ? style[key] : fallback; }
function hasFill(style) {
  if (!style) return false;
  const v = style.fill;
  if (v == null) return false;
  if (typeof v !== 'string') return true;
  return !NO_FILL_TOKENS.has(v.trim().toLowerCase());
}
function hasStroke(style) {
  if (!style) return false;
  const v = style.stroke;
  if (v == null) return false;
  if (typeof v !== 'string') return true;
  return !NO_FILL_TOKENS.has(v.trim().toLowerCase());
}
export class BaseRenderer {
  constructor(options = {}) { this.options = options; this.container = null; }
  mount(container) { this.container = typeof container === 'string' ? document.querySelector(container) : container; if (!this.container) throw new Error('Chart container was not found.'); return this; }
  resize() {}
  clear() {}
  render() { throw new Error('Renderer.render() must be implemented.'); }
  destroy() { this.clear(); this.container = null; }
}

export class CanvasRenderer extends BaseRenderer {
  mount(container) { super.mount(container); this.canvas = this.container.tagName === 'CANVAS' ? this.container : document.createElement('canvas'); if (this.canvas !== this.container) { this.container.innerHTML = ''; this.container.appendChild(this.canvas); } this.canvas.style.background = this.options.background || '#ffffff'; this.ctx = this.canvas.getContext('2d'); return this; }
  resize(width, height, pixelRatio = globalThis.devicePixelRatio || 1) { this.width = width; this.height = height; this.pixelRatio = pixelRatio; this.canvas.width = Math.round(width * pixelRatio); this.canvas.height = Math.round(height * pixelRatio); if (this.canvas.style) { this.canvas.style.width = `${width}px`; this.canvas.style.height = `${height}px`; } this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); }
  clear() { if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height); }
    render(scene) { this.clear(); const ctx = this.ctx; if (hasFill({ fill: this.options?.background })) { ctx.save(); ctx.fillStyle = this.options.background; ctx.fillRect(0, 0, this.width, this.height); ctx.restore(); } const draw = node => { if (!node.visible) return; const g = node.geometry || {}; const s = node.style || {}; ctx.save(); ctx.globalAlpha = s.opacity == null ? 1 : s.opacity; ctx.fillStyle = hasFill(s) ? color(s, 'fill', node.highlighted || node.selected ? '#1d4ed8' : '#2563eb') : 'rgba(0,0,0,0)'; ctx.strokeStyle = hasStroke(s) ? color(s, 'stroke', '#0f172a') : 'rgba(0,0,0,0)'; ctx.lineWidth = s.strokeWidth || 1; if (node.type === 'rect') { if (hasFill(s)) ctx.fillRect(g.x, g.y, g.width, g.height); if (hasStroke(s)) ctx.strokeRect(g.x, g.y, g.width, g.height); } else if (node.type === 'line') { ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); if (hasStroke(s)) ctx.stroke(); } else if (node.type === 'path') { ctx.beginPath(); if (g.curve === 'cubic' && g.points?.length === 4) { ctx.moveTo(g.points[0].x, g.points[0].y); ctx.bezierCurveTo(g.points[1].x, g.points[1].y, g.points[2].x, g.points[2].y, g.points[3].x, g.points[3].y); } else g.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); if (g.closed) ctx.closePath(); if (hasFill(s)) ctx.fill(); if (hasStroke(s)) ctx.stroke(); } else if (node.type === 'circle') { ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2); if (hasFill(s)) ctx.fill(); if (hasStroke(s)) ctx.stroke(); } else if (node.type === 'arc') { ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, g.start, g.end); if (g.innerR > 0) { ctx.arc(g.cx, g.cy, g.innerR, g.end, g.start, true); } else ctx.lineTo(g.cx, g.cy); ctx.closePath(); if (hasFill(s)) ctx.fill(); if (hasStroke(s)) ctx.stroke(); } else if (node.type === 'text') { ctx.fillStyle = hasFill(s) ? s.fill : '#0f172a'; ctx.font = s.font || '12px system-ui'; const align = s.textAlign || (s.textAnchor === 'end' ? 'end' : s.textAnchor === 'middle' || s.textAnchor === 'center' ? 'center' : s.textAnchor === 'start' ? 'start' : 'left'); ctx.textAlign = align; ctx.textBaseline = s.textBaseline || s.baseline || 'alphabetic'; if (Number.isFinite(Number(s.rotation)) && Number(s.rotation) !== 0) { ctx.translate(g.x, g.y); ctx.rotate(Number(s.rotation) * Math.PI / 180); ctx.fillText(g.text, 0, 0); } else ctx.fillText(g.text, g.x, g.y); } node.children.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(draw); ctx.restore(); }; draw(scene.root); }
  exportImage(type = 'image/png') { return this.canvas.toDataURL(type); }
}

export class SVGRenderer extends BaseRenderer {
  constructor(options = {}) {
    super(options);
    if (typeof document !== 'undefined') {
      const w = Number(options.width ?? 640), h = Number(options.height ?? 360);
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      this.svg.setAttribute('width', w);
      this.svg.setAttribute('height', h);
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.width = w; this.height = h;
    } else {
      this.svg = null;
      this.width = Number(options.width ?? 640);
      this.height = Number(options.height ?? 360);
    }
  }
  mount(container) {
    super.mount(container);
    if (!this.svg && typeof document !== 'undefined') {
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    const containerIsSvg = this.container.tagName && this.container.tagName.toLowerCase() === 'svg';
    if (containerIsSvg) {
      this.svg = this.container;
    } else {
      this.container.innerHTML = '';
      this.container.appendChild(this.svg);
    }
    this.svg.style.background = this.options.background || '#ffffff';
    return this;
  }
  resize(width, height) {
    this.width = width; this.height = height;
    if (!this.svg) return;
    this.svg.setAttribute('width', width); this.svg.setAttribute('height', height); this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  clear() { if (!this.svg) return; while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild); }
  render(scene) {
    if (!this.svg) {
      if (typeof document === 'undefined') return;
      const w = Number(this.options?.width ?? this.width ?? 640);
      const h = Number(this.options?.height ?? this.height ?? 360);
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      this.svg.setAttribute('width', w);
      this.svg.setAttribute('height', h);
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.width = w; this.height = h;
    }
    this.clear(); const renderNode = node => { if (!node.visible || node.type === 'root') { node.children.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(renderNode); return; } const g = node.geometry || {}, s = node.style || {}; const element = document.createElementNS('http://www.w3.org/2000/svg', node.type === 'path' || node.type === 'arc' ? 'path' : node.type === 'text' ? 'text' : node.type); element.setAttribute('id', node.id); element.setAttribute('data-node-id', node.id); if (node.dataRef) element.dataset.dataRef = JSON.stringify(node.dataRef); if (node.type === 'rect') { element.setAttribute('x', g.x); element.setAttribute('y', g.y); element.setAttribute('width', g.width); element.setAttribute('height', g.height); } else if (node.type === 'line') { ['x1', 'y1', 'x2', 'y2'].forEach(key => element.setAttribute(key, g[key])); } else if (node.type === 'circle') { element.setAttribute('cx', g.cx); element.setAttribute('cy', g.cy); element.setAttribute('r', g.r); } else if (node.type === 'arc') { const large = g.end - g.start > Math.PI ? 1 : 0, outerStart = `${g.cx + g.r * Math.cos(g.start)} ${g.cy + g.r * Math.sin(g.start)}`, outerEnd = `${g.cx + g.r * Math.cos(g.end)} ${g.cy + g.r * Math.sin(g.end)}`; const p = g.innerR > 0 ? [`M ${outerStart}`, `A ${g.r} ${g.r} 0 ${large} 1 ${outerEnd}`, `L ${g.cx + g.innerR * Math.cos(g.end)} ${g.cy + g.innerR * Math.sin(g.end)}`, `A ${g.innerR} ${g.innerR} 0 ${large} 0 ${g.cx + g.innerR * Math.cos(g.start)} ${g.cy + g.innerR * Math.sin(g.start)}`, 'Z'] : [`M ${g.cx} ${g.cy}`, `L ${outerStart}`, `A ${g.r} ${g.r} 0 ${large} 1 ${outerEnd}`, 'Z']; element.setAttribute('d', p.join(' ')); } else if (node.type === 'path') { const d = g.curve === 'cubic' && g.points?.length === 4 ? `M ${g.points[0].x} ${g.points[0].y} C ${g.points[1].x} ${g.points[1].y} ${g.points[2].x} ${g.points[2].y} ${g.points[3].x} ${g.points[3].y}` : `${g.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}${g.closed ? ' Z' : ''}`; element.setAttribute('d', d); } else if (node.type === 'text') { element.setAttribute('x', g.x); element.setAttribute('y', g.y); if (Number.isFinite(Number(s.rotation)) && Number(s.rotation) !== 0) element.setAttribute('transform', `rotate(${Number(s.rotation)} ${g.x} ${g.y})`); element.textContent = g.text; const anchor = s.textAnchor || (s.textAlign === 'end' ? 'end' : s.textAlign === 'center' ? 'middle' : s.textAlign === 'right' ? 'end' : s.textAlign === 'left' ? 'start' : 'start'); if (anchor) element.setAttribute('text-anchor', anchor); const baseline = s.textBaseline || s.baseline || 'alphabetic'; if (baseline === 'top') { element.setAttribute('dominant-baseline', 'text-before-edge'); element.setAttribute('alignment-baseline', 'before-edge'); } else if (baseline === 'middle' || baseline === 'central') { element.setAttribute('dominant-baseline', 'middle'); element.setAttribute('alignment-baseline', 'middle'); } else if (baseline === 'bottom' || baseline === 'hanging') { element.setAttribute('dominant-baseline', 'text-after-edge'); element.setAttribute('alignment-baseline', 'after-edge'); } else { element.setAttribute('dominant-baseline', 'alphabetic'); element.setAttribute('alignment-baseline', 'alphabetic'); } if (s.font) { const raw = String(s.font).trim(); element.setAttribute('font', raw); const sizeMatch = raw.match(/\b(\d+(?:\.\d+)?)\s*(px|em|rem|pt|%)/i); const size = sizeMatch ? `${sizeMatch[1]}${sizeMatch[2].toLowerCase()}` : ''; if (size) element.style.fontSize = size; const weightMatch = raw.match(/^\s*(\d{3}|normal|bold|lighter|bolder)\b/i); if (weightMatch) element.style.fontWeight = weightMatch[1]; const family = raw.replace(/^\s*(?:(?:normal|italic|oblique)(?:\s+[^0-9\s]+)?\s+)?(?:\d{3}|normal|bold|lighter|bolder)\s+/i, '').replace(/\b\d+(?:\.\d+)?\s*(?:px|em|rem|pt|%)(?:\s*\/\s*\S+)?\s*/i, '').trim(); if (family) element.style.fontFamily = family; } } if (node.type === 'path' || node.type === 'circle' || node.type === 'rect' || node.type === 'arc') { element.setAttribute('fill', hasFill(s) ? s.fill : 'none'); } else if (node.type === 'text') { element.setAttribute('fill', hasFill(s) ? s.fill : '#0f172a'); } if (hasStroke(s)) element.setAttribute('stroke', s.stroke); else if (s.stroke != null && typeof s.stroke === 'string' && NO_FILL_TOKENS.has(s.stroke.trim().toLowerCase())) element.setAttribute('stroke', 'none'); if (s.strokeWidth != null) element.setAttribute('stroke-width', s.strokeWidth); if (s.opacity != null) element.setAttribute('opacity', node.highlighted || node.selected ? 1 : s.opacity); if (node.highlighted || node.selected) element.setAttribute('filter', 'brightness(1.2)'); if (node.interactive) element.style.cursor = 'pointer'; if (s.pointerEvents === 'none') element.style.pointerEvents = 'none'; if (s.ariaHidden === 'true') element.setAttribute('aria-hidden', 'true'); if (s.role === 'presentation') element.setAttribute('role', 'presentation'); if (node.decorative) { element.setAttribute('aria-hidden', 'true'); element.setAttribute('role', 'presentation'); element.style.pointerEvents = 'none'; element.style.userSelect = 'none'; } this.svg.appendChild(element); node.children.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(renderNode); }; scene.root.children.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(renderNode); }
  exportString() { if (!this.svg) return ''; return new XMLSerializer().serializeToString(this.svg); }
}
