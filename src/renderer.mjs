/** Canvas/SVG Scene Graph drawing; own mounted children, not caller surfaces. */
import { pathCommands, rectanglePath } from './path.mjs';
import { svgNode } from './scene-svg.mjs';
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

export function resolveContainer(container) { const target = typeof container === 'string' ? document.querySelector(container) : container; if (typeof container === 'string' && !target) throw new Error('Requested container was not found.'); return target; }
function color(style, key, fallback) { return style && style[key] != null ? style[key] : fallback; }
function hasPaint(style, key) { const value = style?.[key]; return value != null && (typeof value !== 'string' || !NO_FILL_TOKENS.has(value.trim().toLowerCase())); }
function hasFill(style) { return hasPaint(style, 'fill'); }
function hasStroke(style) { return hasPaint(style, 'stroke'); }

function drawPath(context, geometry, style) {
  context.beginPath();
  for (const [kind, ...values] of pathCommands(geometry)) {
    if (kind === 'M') context.moveTo(...values);
    else if (kind === 'L') context.lineTo(...values);
    else if (kind === 'C') context.bezierCurveTo(...values);
    else context.closePath();
  }
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
  mount(container) { const target = resolveContainer(container); if (!target) throw new Error('Chart container was not found.'); const surface = this.svg || this.canvas; if (this.container !== target && surface !== this.container && surface !== target) surface?.remove?.(); this.container = target; return this; }
  resize() {}
  clear() {}
  render() { throw new Error('Renderer.render() must be implemented.'); }
  destroy() { this.clear(); const surface = this.svg || this.canvas; if (surface !== this.container) surface?.remove?.(); this.container = this.svg = this.canvas = this.ctx = null; }
}

export class CanvasRenderer extends BaseRenderer {
  mount(container) { super.mount(container); this.canvas = this.container.tagName === 'CANVAS' ? this.container : document.createElement('canvas'); if (this.canvas !== this.container) { this.container.innerHTML = ''; this.container.appendChild(this.canvas); } this.canvas.style.background = this.options.background || '#ffffff'; this.ctx = this.canvas.getContext('2d'); return this; }
  resize(width, height, pixelRatio = globalThis.devicePixelRatio || 1) { this.width = width; this.height = height; this.pixelRatio = pixelRatio; this.canvas.width = Math.round(width * pixelRatio); this.canvas.height = Math.round(height * pixelRatio); if (this.canvas.style) { this.canvas.style.width = `${width}px`; this.canvas.style.height = `${height}px`; } this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); }
  clear() { if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height); }
  render(scene) {
    this.clear(); const ctx = this.ctx;
    if (hasFill({ fill: this.options?.background })) { ctx.save(); ctx.fillStyle = this.options.background; ctx.fillRect(0, 0, this.width, this.height); ctx.restore(); }
    const draw = node => {
      if (!node.visible) return;
      const geometry = node.geometry || {}, style = node.style || {};
      ctx.save(); ctx.globalAlpha = style.opacity == null ? 1 : style.opacity; ctx.fillStyle = hasFill(style) ? color(style, 'fill', node.highlighted || node.selected ? '#1d4ed8' : '#2563eb') : 'rgba(0,0,0,0)'; ctx.strokeStyle = hasStroke(style) ? color(style, 'stroke', '#0f172a') : 'rgba(0,0,0,0)'; ctx.lineWidth = style.strokeWidth || 1; if (typeof ctx.setLineDash === 'function') ctx.setLineDash(Array.isArray(style.lineDash) ? style.lineDash : []);
      if (style.lineCap) ctx.lineCap = style.lineCap; if (style.lineJoin) ctx.lineJoin = style.lineJoin;
      if (node.type === 'image') drawSceneImage(ctx, geometry);
      else if (node.type === 'rect') { if (geometry.radius > 0) drawPath(ctx, rectanglePath(geometry), style); else { if (hasFill(style)) ctx.fillRect(geometry.x, geometry.y, geometry.width, geometry.height); if (hasStroke(style)) ctx.strokeRect(geometry.x, geometry.y, geometry.width, geometry.height); } }
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
      const { tag, attributes, text } = svgNode(node), element = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
      if (text !== null) element.textContent = text;
      this.svg.appendChild(element); node.children.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(renderNode);
    };
    renderNode(scene.root);
  }
  exportString() { return this.svg ? new XMLSerializer().serializeToString(this.svg) : ''; }
}
