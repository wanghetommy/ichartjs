/**
 * Canvas and SVG renderer implementations for the shared Scene Graph.
 * Rendering is intentionally separate from chart layout and data semantics.
 */
const NO_FILL_TOKENS = new Set(['none', 'transparent', '']);

function drawSceneImage(context, geometry) {
  const image = geometry.image;
  if (!image) return;
  const sourceWidth = image.naturalWidth || image.width, sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return;
  const { x, y, width, height, fit = 'contain' } = geometry;
  if (fit === 'stretch') { context.drawImage(image, x, y, width, height); return; }
  const scale = fit === 'cover' ? Math.max(width / sourceWidth, height / sourceHeight) : Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale, drawHeight = sourceHeight * scale;
  context.save(); context.beginPath(); context.rect(x, y, width, height); context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight); context.restore();
}

function color(style, key, fallback) { return style && style[key] != null ? style[key] : fallback; }
function hasPaint(style, key) { const value = style?.[key]; return value != null && (typeof value !== 'string' || !NO_FILL_TOKENS.has(value.trim().toLowerCase())); }
function hasFill(style) { return hasPaint(style, 'fill'); }
function hasStroke(style) { return hasPaint(style, 'stroke'); }

function drawPath(context, geometry, style) {
  if (!Array.isArray(geometry.points) || geometry.points.length < 2) return;
  context.beginPath();
  if (geometry.curve === 'cubic' && geometry.points.length === 4) {
    context.moveTo(geometry.points[0].x, geometry.points[0].y);
    context.bezierCurveTo(geometry.points[1].x, geometry.points[1].y, geometry.points[2].x, geometry.points[2].y, geometry.points[3].x, geometry.points[3].y);
  } else geometry.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  if (geometry.closed) context.closePath();
  if (hasFill(style)) context.fill(); if (hasStroke(style)) context.stroke();
}

function drawArc(context, geometry, style) {
  context.beginPath(); context.arc(geometry.cx, geometry.cy, geometry.r, geometry.start, geometry.end);
  if (geometry.sector !== false) {
    if (geometry.innerR > 0) context.arc(geometry.cx, geometry.cy, geometry.innerR, geometry.end, geometry.start, true);
    else context.lineTo(geometry.cx, geometry.cy);
    context.closePath(); if (hasFill(style)) context.fill();
  }
  if (hasStroke(style)) context.stroke();
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
  render(scene) {
    this.clear(); const ctx = this.ctx;
    if (hasPaint({ fill: this.options?.background })) { ctx.save(); ctx.fillStyle = this.options.background; ctx.fillRect(0, 0, this.width, this.height); ctx.restore(); }
    const draw = node => {
      if (!node.visible) return;
      const geometry = node.geometry || {}, style = node.style || {};
      ctx.save(); ctx.globalAlpha = style.opacity == null ? 1 : style.opacity; ctx.fillStyle = hasFill(style) ? color(style, 'fill', node.highlighted || node.selected ? '#1d4ed8' : '#2563eb') : 'rgba(0,0,0,0)'; ctx.strokeStyle = hasStroke(style) ? color(style, 'stroke', '#0f172a') : 'rgba(0,0,0,0)'; ctx.lineWidth = style.strokeWidth || 1; if (typeof ctx.setLineDash === 'function') ctx.setLineDash(Array.isArray(style.lineDash) ? style.lineDash : []);
      if (node.type === 'image') drawSceneImage(ctx, geometry);
      else if (node.type === 'rect') { if (hasFill(style)) ctx.fillRect(geometry.x, geometry.y, geometry.width, geometry.height); if (hasStroke(style)) ctx.strokeRect(geometry.x, geometry.y, geometry.width, geometry.height); }
      else if (node.type === 'line') { ctx.beginPath(); ctx.moveTo(geometry.x1, geometry.y1); ctx.lineTo(geometry.x2, geometry.y2); if (hasStroke(style)) ctx.stroke(); }
      else if (node.type === 'path') drawPath(ctx, geometry, style);
      else if (node.type === 'circle') { ctx.beginPath(); ctx.arc(geometry.cx, geometry.cy, geometry.r, 0, Math.PI * 2); if (hasFill(style)) ctx.fill(); if (hasStroke(style)) ctx.stroke(); }
      else if (node.type === 'ellipse') { ctx.beginPath(); if (typeof ctx.ellipse === 'function') ctx.ellipse(geometry.cx, geometry.cy, geometry.rx, geometry.ry, 0, 0, Math.PI * 2); else { ctx.translate(geometry.cx, geometry.cy); ctx.scale(geometry.rx, geometry.ry); ctx.arc(0, 0, 1, 0, Math.PI * 2); } if (hasFill(style)) ctx.fill(); if (hasStroke(style)) ctx.stroke(); }
      else if (node.type === 'arc') drawArc(ctx, geometry, style);
      else if (node.type === 'text') { ctx.fillStyle = hasFill(style) ? style.fill : '#0f172a'; ctx.font = style.font || '12px system-ui'; ctx.textAlign = style.textAlign || (style.textAnchor === 'end' ? 'end' : style.textAnchor === 'middle' ? 'center' : 'left'); ctx.textBaseline = style.textBaseline || style.baseline || 'alphabetic'; if (Number(style.rotation)) { ctx.translate(geometry.x, geometry.y); ctx.rotate(Number(style.rotation) * Math.PI / 180); ctx.fillText(geometry.text, 0, 0); } else ctx.fillText(geometry.text, geometry.x, geometry.y); }
      node.children.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(draw); ctx.restore();
    };
    draw(scene.root);
  }
  exportImage(type = 'image/png') { return this.canvas.toDataURL(type); }
}

function svgPathForArc(geometry) {
  const large = geometry.end - geometry.start > Math.PI ? 1 : 0;
  const start = `${geometry.cx + geometry.r * Math.cos(geometry.start)} ${geometry.cy + geometry.r * Math.sin(geometry.start)}`;
  const end = `${geometry.cx + geometry.r * Math.cos(geometry.end)} ${geometry.cy + geometry.r * Math.sin(geometry.end)}`;
  if (geometry.sector === false) return `M ${start} A ${geometry.r} ${geometry.r} 0 ${large} 1 ${end}`;
  if (geometry.innerR > 0) return [`M ${start}`, `A ${geometry.r} ${geometry.r} 0 ${large} 1 ${end}`, `L ${geometry.cx + geometry.innerR * Math.cos(geometry.end)} ${geometry.cy + geometry.innerR * Math.sin(geometry.end)}`, `A ${geometry.innerR} ${geometry.innerR} 0 ${large} 0 ${geometry.cx + geometry.innerR * Math.cos(geometry.start)} ${geometry.cy + geometry.innerR * Math.sin(geometry.start)}`, 'Z'].join(' ');
  return [`M ${geometry.cx} ${geometry.cy}`, `L ${start}`, `A ${geometry.r} ${geometry.r} 0 ${large} 1 ${end}`, 'Z'].join(' ');
}

function svgFont(style, element) {
  if (!style.font) return;
  const raw = String(style.font).trim(); element.setAttribute('font', raw);
  const sizeMatch = raw.match(/\b(\d+(?:\.\d+)?)\s*(px|em|rem|pt|%)/i); if (sizeMatch) element.style.fontSize = `${sizeMatch[1]}${sizeMatch[2].toLowerCase()}`;
  const weightMatch = raw.match(/^\s*(\d{3}|normal|bold|lighter|bolder)\b/i); if (weightMatch) element.style.fontWeight = weightMatch[1];
  const family = raw.replace(/^\s*(?:(?:normal|italic|oblique)(?:\s+[^0-9\s]+)?\s+)?(?:\d{3}|normal|bold|lighter|bolder)\s+/i, '').replace(/\b\d+(?:\.\d+)?\s*(?:px|em|rem|pt|%)(?:\s*\/\s*\S+)?\s*/i, '').trim(); if (family) element.style.fontFamily = family;
}

export class SVGRenderer extends BaseRenderer {
  constructor(options = {}) { super(options); this.width = Number(options.width ?? 640); this.height = Number(options.height ?? 360); this.svg = null; if (typeof document !== 'undefined') this._createSvg(this.width, this.height); }
  _createSvg(width, height) { this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); this.resize(width, height); }
  mount(container) { super.mount(container); if (!this.svg && typeof document !== 'undefined') this._createSvg(this.width, this.height); if (this.container.tagName && this.container.tagName.toLowerCase() === 'svg') this.svg = this.container; else { this.container.innerHTML = ''; this.container.appendChild(this.svg); } this.svg.style.background = this.options.background || '#ffffff'; return this; }
  resize(width, height) { this.width = width; this.height = height; if (this.svg) { this.svg.setAttribute('width', width); this.svg.setAttribute('height', height); this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`); } }
  clear() { if (this.svg) while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild); }
  render(scene) {
    if (!this.svg) { if (typeof document === 'undefined') return; this._createSvg(this.width, this.height); }
    this.clear();
    const renderNode = node => {
      if (!node.visible) return;
      if (node.type === 'root') { node.children.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(renderNode); return; }
      const geometry = node.geometry || {}, style = node.style || {}, element = document.createElementNS('http://www.w3.org/2000/svg', node.type === 'path' || node.type === 'arc' ? 'path' : node.type === 'text' ? 'text' : node.type);
      element.setAttribute('id', node.id); element.setAttribute('data-node-id', node.id); if (node.dataRef) element.setAttribute('data-data-ref', JSON.stringify(node.dataRef));
      if (node.type === 'image') { ['x', 'y', 'width', 'height'].forEach(key => element.setAttribute(key, geometry[key])); element.setAttribute('href', geometry.src); element.setAttribute('preserveAspectRatio', geometry.fit === 'stretch' ? 'none' : geometry.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'); element.setAttribute('aria-label', geometry.alt || ''); }
      else if (node.type === 'rect') { ['x', 'y', 'width', 'height'].forEach(key => element.setAttribute(key, geometry[key])); }
      else if (node.type === 'line') { ['x1', 'y1', 'x2', 'y2'].forEach(key => element.setAttribute(key, geometry[key])); }
      else if (node.type === 'circle') { ['cx', 'cy', 'r'].forEach(key => element.setAttribute(key, geometry[key])); }
      else if (node.type === 'ellipse') { ['cx', 'cy', 'rx', 'ry'].forEach(key => element.setAttribute(key, geometry[key])); }
      else if (node.type === 'arc') element.setAttribute('d', svgPathForArc(geometry));
      else if (node.type === 'path') { const d = geometry.curve === 'cubic' && geometry.points?.length === 4 ? `M ${geometry.points[0].x} ${geometry.points[0].y} C ${geometry.points[1].x} ${geometry.points[1].y} ${geometry.points[2].x} ${geometry.points[2].y} ${geometry.points[3].x} ${geometry.points[3].y}` : `${(geometry.points || []).map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')}${geometry.closed ? ' Z' : ''}`; element.setAttribute('d', d); }
      else if (node.type === 'text') { element.setAttribute('x', geometry.x); element.setAttribute('y', geometry.y); if (Number(style.rotation)) element.setAttribute('transform', `rotate(${Number(style.rotation)} ${geometry.x} ${geometry.y})`); element.textContent = geometry.text; element.setAttribute('text-anchor', style.textAnchor || (style.textAlign === 'end' ? 'end' : style.textAlign === 'center' ? 'middle' : style.textAlign === 'right' ? 'end' : 'start')); const baseline = style.textBaseline || style.baseline || 'alphabetic'; element.setAttribute('dominant-baseline', baseline === 'middle' || baseline === 'central' ? 'middle' : baseline === 'top' ? 'text-before-edge' : baseline === 'bottom' ? 'text-after-edge' : 'alphabetic'); svgFont(style, element); }
      if (['path', 'circle', 'ellipse', 'rect'].includes(node.type)) element.setAttribute('fill', hasFill(style) ? style.fill : 'none'); else if (node.type === 'arc') element.setAttribute('fill', geometry.sector === false ? 'none' : hasFill(style) ? style.fill : 'none'); else if (node.type === 'text') element.setAttribute('fill', hasFill(style) ? style.fill : '#0f172a');
      if (hasStroke(style)) element.setAttribute('stroke', style.stroke); else if (style.stroke != null) element.setAttribute('stroke', 'none'); if (style.strokeWidth != null) element.setAttribute('stroke-width', style.strokeWidth); if (Array.isArray(style.lineDash) && style.lineDash.length) element.setAttribute('stroke-dasharray', style.lineDash.join(' ')); if (style.opacity != null) element.setAttribute('opacity', node.highlighted || node.selected ? 1 : style.opacity); if (node.highlighted || node.selected) element.setAttribute('filter', 'brightness(1.2)');
      if (node.interactive) element.style.cursor = 'pointer'; if (style.pointerEvents === 'none') element.style.pointerEvents = 'none'; if (style.ariaHidden === 'true') element.setAttribute('aria-hidden', 'true'); if (style.role === 'presentation') element.setAttribute('role', 'presentation'); if (node.decorative) { element.setAttribute('aria-hidden', 'true'); element.setAttribute('role', 'presentation'); element.style.pointerEvents = 'none'; }
      this.svg.appendChild(element); node.children.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(renderNode);
    };
    renderNode(scene.root);
  }
  exportString() { return this.svg ? new XMLSerializer().serializeToString(this.svg) : ''; }
}
