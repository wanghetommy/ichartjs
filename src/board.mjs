import { Scene, SceneNode } from './scene.mjs';
import { CanvasRenderer, SVGRenderer } from './renderer.mjs';
import { sceneToSvgString } from './scene-svg.mjs';
import { buildScene } from './charts.mjs';
import { validateSpec } from './spec.mjs';
import { ChartValidationError } from './errors.mjs';
import { EditHistory } from './history.mjs';
import { cloneBoard, validateBoardSpec } from './board-contract.mjs';
import { fitTextBlock, truncateText } from './layout.mjs';

function deepClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function itemBounds(item) { return { x: item.position.x, y: item.position.y, width: item.size.width, height: item.size.height }; }
function center(bounds) { return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }; }
function snapValue(value, size, enabled) { return enabled ? Math.round(value / size) * size : value; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function textFont(item, size) { return `${item.fontWeight || 'normal'} ${size}px ${item.fontFamily || 'system-ui'}`; }
function textLayout(item, bounds) {
  const padding = Math.max(0, Number(item.padding) || 0), baseSize = Math.max(8, Number(item.fontSize) || 16), maxWidth = Math.max(1, bounds.width - padding * 2), maxHeight = Math.max(1, bounds.height - padding * 2), maxLines = Math.max(1, Math.min(12, Number(item.maxLines) || 3)), lineHeight = Math.max(1, Number(item.lineHeight) || 1.2);
  if (item.wrap === false) {
    const line = truncateText(item.text, maxWidth, baseSize);
    return { lines: [line], size: baseSize, lineHeight: baseSize * lineHeight, width: Math.min(maxWidth, baseSize * 100), height: baseSize * lineHeight, wrapped: false, scaled: false, truncated: line !== item.text, padding };
  }
  return { ...fitTextBlock(item.text, { maxWidth, maxHeight, size: baseSize, minSize: item.minFontSize || 8, maxLines, lineHeight }), padding };
}

function connectorPoints(from, to, routing) {
  const a = center(from), b = center(to);
  if (routing === 'straight') return { type: 'line', geometry: { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, bounds: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) } };
  const midX = (a.x + b.x) / 2;
  const points = [{ x: a.x, y: a.y }, { x: midX, y: a.y }, { x: midX, y: b.y }, { x: b.x, y: b.y }];
  return { type: 'path', geometry: { points }, bounds: { x: Math.min(...points.map(point => point.x)), y: Math.min(...points.map(point => point.y)), width: Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)), height: Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)) } };
}

function transformGeometry(geometry, bounds, target) {
  const sx = target.width / Math.max(1, bounds.width), sy = target.height / Math.max(1, bounds.height);
  const tx = target.x - bounds.x * sx, ty = target.y - bounds.y * sy;
  const point = value => ({ x: value.x * sx + tx, y: value.y * sy + ty });
  const result = { ...geometry };
  if (Number.isFinite(geometry.x)) result.x = geometry.x * sx + tx;
  if (Number.isFinite(geometry.y)) result.y = geometry.y * sy + ty;
  for (const key of ['x1', 'x2']) if (Number.isFinite(geometry[key])) result[key] = geometry[key] * sx + tx;
  for (const key of ['y1', 'y2']) if (Number.isFinite(geometry[key])) result[key] = geometry[key] * sy + ty;
  for (const key of ['cx']) if (Number.isFinite(geometry[key])) result[key] = geometry[key] * sx + tx;
  if (Number.isFinite(geometry.cy)) result.cy = geometry.cy * sy + ty;
  if (Number.isFinite(geometry.width)) result.width *= sx;
  if (Number.isFinite(geometry.height)) result.height *= sy;
  if (Number.isFinite(geometry.r)) result.r *= Math.min(sx, sy);
  if (Number.isFinite(geometry.rx)) result.rx *= sx;
  if (Number.isFinite(geometry.ry)) result.ry *= sy;
  if (Number.isFinite(geometry.innerR)) result.innerR *= Math.min(sx, sy);
  if (Array.isArray(geometry.points)) result.points = geometry.points.map(point);
  return result;
}

function flattenChartScene(source, target, prefix, output) {
  source.walk(node => {
    if (node.type === 'group' || node.id === 'root') return;
    const geometry = transformGeometry(node.geometry || {}, { x: 0, y: 0, width: source.width, height: source.height }, target);
    const bounds = node.bounds ? transformGeometry(node.bounds, { x: 0, y: 0, width: source.width, height: source.height }, target) : undefined;
    output.push(new SceneNode({ ...node, id: `${prefix}-${node.id}`, geometry, bounds, children: [] }));
  });
}

function gridNodes(spec) {
  if (!spec.grid.visible) return [];
  const nodes = [], size = spec.grid.size, color = spec.grid.color, variant = spec.grid.variant;
  if (variant === 'lines') {
    for (let x = size; x < spec.width; x += size) nodes.push(new SceneNode({ id: `grid-x-${x}`, type: 'line', geometry: { x1: x, y1: 0, x2: x, y2: spec.height }, style: { stroke: color, strokeWidth: 1, opacity: 0.45 }, zIndex: -100, decorative: true }));
    for (let y = size; y < spec.height; y += size) nodes.push(new SceneNode({ id: `grid-y-${y}`, type: 'line', geometry: { x1: 0, y1: y, x2: spec.width, y2: y }, style: { stroke: color, strokeWidth: 1, opacity: 0.45 }, zIndex: -100, decorative: true }));
  } else {
    for (let x = size; x < spec.width; x += size) for (let y = size; y < spec.height; y += size) {
      const geometry = variant === 'cross' ? { points: [{ x: x - 3, y }, { x: x + 3, y }, { x, y: y - 3 }, { x, y: y + 3 }], closed: false } : { cx: x, cy: y, r: 1.5 };
      nodes.push(new SceneNode({ id: `grid-${x}-${y}`, type: variant === 'cross' ? 'path' : 'circle', geometry, style: { stroke: color, fill: color, strokeWidth: 1, opacity: 0.5 }, zIndex: -100, decorative: true }));
    }
  }
  return nodes;
}

function buildBoardScene(spec, loadedImages = new Map()) {
  const scene = new Scene(spec.width, spec.height);
  scene._textLayout = [];
  gridNodes(spec).forEach(node => scene.add(node));
  const byId = new Map(spec.items.map(item => [item.id, item]));
  const sorted = spec.items.slice().sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  for (const item of sorted.filter(candidate => candidate.kind === 'connector')) {
    const from = byId.get(item.from), to = byId.get(item.to);
    if (!from || !to) continue;
    const geometry = connectorPoints(itemBounds(from), itemBounds(to), item.routing || 'orthogonal');
    scene.add(new SceneNode({ id: item.id, type: geometry.type, geometry: geometry.geometry, bounds: geometry.bounds, style: { stroke: '#64748b', strokeWidth: 2, fill: 'none', ...(item.style || {}) }, zIndex: item.zIndex ?? -1, interactive: Boolean(spec.editing.enabled && !item.locked) }));
  }
  for (const item of sorted) {
    if (item.kind === 'connector') continue;
    const bounds = itemBounds(item), style = { ...(item.style || {}), opacity: item.opacity ?? 1 };
    if (item.kind === 'image') {
      const asset = spec.assets.find(candidate => candidate.id === item.assetId);
      scene.add(new SceneNode({ id: item.id, type: 'image', geometry: { ...bounds, fit: item.fit || 'contain', src: asset?.src || '', alt: asset?.alt || '', image: loadedImages.get(item.assetId) }, bounds, style, zIndex: item.zIndex, interactive: Boolean(spec.editing.enabled && !item.locked) }));
    } else if (item.kind === 'text') {
      const layout = textLayout(item, bounds), horizontal = item.textAlign || 'start', vertical = item.verticalAlign || 'middle', textX = horizontal === 'center' ? bounds.x + bounds.width / 2 : horizontal === 'end' || horizontal === 'right' ? bounds.x + bounds.width - layout.padding : bounds.x + layout.padding, totalHeight = layout.lines.length * layout.lineHeight, firstY = vertical === 'top' ? bounds.y + layout.padding + layout.lineHeight / 2 : vertical === 'bottom' ? bounds.y + bounds.height - layout.padding - totalHeight + layout.lineHeight / 2 : bounds.y + (bounds.height - totalHeight) / 2 + layout.lineHeight / 2;
      const group = new SceneNode({ id: item.id, type: 'group', bounds, zIndex: item.zIndex, interactive: Boolean(spec.editing.enabled && !item.locked) });
      if (item.background || style.background) group.add(new SceneNode({ id: `${item.id}-background`, type: 'rect', geometry: bounds, bounds, style: { fill: item.background || style.background, stroke: style.stroke, strokeWidth: style.strokeWidth, opacity: style.opacity }, zIndex: -1 }));
      const textStyle = { ...style, fill: style.fill || '#0f172a', font: style.font || textFont(item, layout.size), textAnchor: horizontal === 'center' ? 'middle' : horizontal === 'end' || horizontal === 'right' ? 'end' : 'start', textBaseline: 'middle', baseline: 'middle' };
      layout.lines.forEach((line, index) => group.add(new SceneNode({ id: `${item.id}-line-${index}`, type: 'text', geometry: { text: line, x: textX, y: firstY + index * layout.lineHeight }, bounds, style: textStyle, zIndex: 0, interactive: false })));
      scene.add(group);
      scene._textLayout.push({ id: item.id, lines: layout.lines.length, wrapped: layout.wrapped, scaled: layout.scaled, truncated: layout.truncated });
    } else if (item.kind === 'shape') {
      const shape = item.shape || 'rectangle';
      if (shape === 'diamond' || shape === 'hexagon' || shape === 'polygon') {
        const points = shape === 'polygon' ? item.points.map(point => ({ x: bounds.x + point.x * bounds.width, y: bounds.y + point.y * bounds.height })) : shape === 'diamond'
          ? [{ x: bounds.x + bounds.width / 2, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }, { x: bounds.x, y: bounds.y + bounds.height / 2 }]
          : Array.from({ length: 6 }, (_, index) => { const angle = Math.PI / 3 * index; return { x: bounds.x + bounds.width / 2 + Math.cos(angle) * bounds.width / 2, y: bounds.y + bounds.height / 2 + Math.sin(angle) * bounds.height / 2 }; });
        scene.add(new SceneNode({ id: item.id, type: 'path', geometry: { points, closed: true }, bounds, style, zIndex: item.zIndex, interactive: Boolean(spec.editing.enabled && !item.locked) }));
      } else if (shape === 'arc' || shape === 'sector') {
        const radius = Math.min(bounds.width, bounds.height) / 2, start = Number(item.startAngle) * Math.PI / 180, rawEnd = Number(item.endAngle) * Math.PI / 180, end = rawEnd <= start ? rawEnd + Math.PI * 2 : rawEnd, geometry = { cx: bounds.x + bounds.width / 2, cy: bounds.y + bounds.height / 2, r: radius, innerR: radius * (Number(item.innerRadius) || 0), start, end, sector: shape === 'sector' };
        scene.add(new SceneNode({ id: item.id, type: 'arc', geometry, bounds, style: shape === 'arc' ? { ...style, fill: 'none' } : style, zIndex: item.zIndex, interactive: Boolean(spec.editing.enabled && !item.locked) }));
      } else scene.add(new SceneNode({ id: item.id, type: shape === 'ellipse' ? 'ellipse' : 'rect', geometry: shape === 'ellipse' ? { cx: bounds.x + bounds.width / 2, cy: bounds.y + bounds.height / 2, rx: bounds.width / 2, ry: bounds.height / 2 } : bounds, bounds, style, zIndex: item.zIndex, interactive: Boolean(spec.editing.enabled && !item.locked) }));
    } else if (item.kind === 'path') {
      const points = item.points.map(point => ({ x: bounds.x + point.x * bounds.width, y: bounds.y + point.y * bounds.height }));
      scene.add(new SceneNode({ id: item.id, type: 'path', geometry: { points, curve: item.curve || 'linear', closed: Boolean(item.closed) }, bounds, style, zIndex: item.zIndex, interactive: Boolean(spec.editing.enabled && !item.locked) }));
    } else if (item.kind === 'chart') {
      const result = validateSpec(item.spec || {});
      if (result.valid) {
        const chart = buildScene(result.spec).scene;
        const group = new SceneNode({ id: item.id, type: 'group', bounds, zIndex: item.zIndex, style });
        flattenChartScene(chart, bounds, item.id, group.children);
        scene.add(group);
      }
    }
  }
  return scene;
}

function boardRenderer(spec) {
  if (spec.renderer !== 'auto') return { effective: spec.renderer, reasons: ['explicit-renderer'] };
  if (spec.items.length > 400) return { effective: 'canvas', reasons: ['large-scene'] };
  return { effective: 'svg', reasons: ['small-or-structured-scene'] };
}

export class FreeformBoard {
  constructor(input = {}) {
    const result = validateBoardSpec(input);
    if (!result.valid) throw new ChartValidationError('createBoard', result.errors);
    this.spec = result.spec;
    this._diagnostics = { errors: result.errors, warnings: result.warnings };
    this._history = new EditHistory();
    this._selection = [];
    this._container = null;
    this._images = new Map();
    this._assetStatus = new Map(this.spec.assets.map(asset => [asset.id, { id: asset.id, status: 'pending' }]));
    this._rendererSelection = boardRenderer(this.spec);
    this.renderer = this._rendererSelection.effective === 'canvas' ? new CanvasRenderer(this.spec) : new SVGRenderer(this.spec);
    this.scene = buildBoardScene(this.spec, this._images);
  }
  async ready() {
    if (typeof Image === 'undefined') return this.getState();
    await Promise.all(this.spec.assets.map(asset => new Promise(resolve => {
      if (!asset.src || !/^https?:\/\//i.test(asset.src) && !/^data:/i.test(asset.src)) { this._assetStatus.set(asset.id, { id: asset.id, status: 'linked' }); resolve(); return; }
      const image = new Image();
      if (/^https?:\/\//i.test(asset.src)) image.crossOrigin = 'anonymous';
      image.onload = () => { this._images.set(asset.id, image); this._assetStatus.set(asset.id, { id: asset.id, status: 'loaded' }); resolve(); };
      image.onerror = () => { this._assetStatus.set(asset.id, { id: asset.id, status: 'failed', code: 'IMAGE_LOAD_FAILED' }); resolve(); };
      image.src = asset.src;
    })));
    this._rebuild();
    return this.getState();
  }
  mount(container) { this._container = typeof container === 'string' ? document.querySelector(container) : container; if (!this._container) throw new Error('Board container was not found.'); this.renderer.mount(this._container); this.renderer.resize(this.spec.width, this.spec.height); this._render(); return this; }
  _render() { if (this._container) { this.renderer.resize(this.spec.width, this.spec.height); this.renderer.render(this.scene); } }
  _rebuild() { this.scene = buildBoardScene(this.spec, this._images); this._render(); }
  _commit(next) { const before = cloneBoard(this.spec); const result = validateBoardSpec(next); if (!result.valid) throw new ChartValidationError('updateBoard', result.errors); this._history.push({ before, after: result.spec }); this.spec = result.spec; this._diagnostics = result; this._rebuild(); return this.getState(); }
  update(patch = {}) { return this._commit({ ...this.spec, ...patch }); }
  getSpec() { return cloneBoard(this.spec); }
  getState() { const failed = [...this._assetStatus.values()].filter(asset => asset.status === 'failed'); return { version: '1.0', renderer: this._rendererSelection.effective, rendererSelection: { requested: this.spec.renderer, effective: this._rendererSelection.effective, reasons: this._rendererSelection.reasons, recordCount: this.spec.items.length, policy: 'large scenes use Canvas; structured scenes use SVG' }, width: this.spec.width, height: this.spec.height, itemCount: this.spec.items.length, assetCount: this.spec.assets.length, assets: [...this._assetStatus.values()], selection: this._selection.slice(), history: this._history.state(), grid: this.spec.grid, layout: { text: this.scene?._textLayout || [] }, health: { status: failed.length ? 'degraded' : 'ready', renderable: true, issues: failed.map(asset => asset.code), metrics: { items: this.spec.items.length, assets: this.spec.assets.length } } }; }
  explain() { return { version: '1.0', type: 'board', renderer: this._rendererSelection.effective, requestedRenderer: this.spec.renderer, itemCount: this.spec.items.length, items: this.spec.items.map(item => ({ id: item.id, kind: item.kind })), assets: this.spec.assets.map(asset => ({ id: asset.id, type: asset.type, alt: asset.alt || null })), warnings: this._diagnostics.warnings || [], assumptions: ['Default board is static; host explicitly enables navigation and editing.', 'Images remain host-owned assets and are not persisted by the board.'], health: this.getState().health, rendererSelection: this.getState().rendererSelection }; }
  select(ids = [], options = {}) { const next = Array.isArray(ids) ? ids.filter(id => this.spec.items.some(item => item.id === id)) : []; this._selection = options.additive ? [...new Set([...this._selection, ...next])] : next; return this._selection.slice(); }
  moveItems(ids = this._selection, delta = {}) { const selected = new Set(ids); const size = this.spec.grid.size; const items = this.spec.items.map(item => { if (!selected.has(item.id) || item.locked || item.kind === 'connector') return item; const x = snapValue(item.position.x + (Number(delta.x) || 0), size, this.spec.snap.enabled && this.spec.snap.grid); const y = snapValue(item.position.y + (Number(delta.y) || 0), size, this.spec.snap.enabled && this.spec.snap.grid); return { ...item, position: { x: clamp(x, 0, this.spec.width - item.size.width), y: clamp(y, 0, this.spec.height - item.size.height) } }; }); return this._commit({ ...this.spec, items }); }
  resizeItem(id, size = {}) { const items = this.spec.items.map(item => item.id === id && !item.locked && item.kind !== 'connector' ? { ...item, size: { width: clamp(Number(size.width) || item.size.width, 16, this.spec.width - item.position.x), height: clamp(Number(size.height) || item.size.height, 16, this.spec.height - item.position.y) } } : item); return this._commit({ ...this.spec, items }); }
  addItem(item) { return this._commit({ ...this.spec, items: [...this.spec.items, item] }); }
  removeItems(ids = []) { const removed = new Set(ids); return this._commit({ ...this.spec, items: this.spec.items.filter(item => !removed.has(item.id) && !removed.has(item.from) && !removed.has(item.to)) }); }
  undo() { const entry = this._history.undo(); if (!entry) return this.getState(); this.spec = entry.before; this._rebuild(); return this.getState(); }
  redo() { const entry = this._history.redo(); if (!entry) return this.getState(); this.spec = entry.after; this._rebuild(); return this.getState(); }
  export(options = {}) { const type = options.type || 'svg'; if (type === 'json') return options.as === 'string' ? JSON.stringify(this.spec, null, 2) : this.getSpec(); if (type === 'svg') return sceneToSvgString(this.scene, this.spec); if ((type === 'png' || type === 'jpeg') && this.renderer instanceof CanvasRenderer && this.renderer.canvas) return this.renderer.exportImage(type === 'jpeg' ? 'image/jpeg' : 'image/png'); return { valid: false, code: 'BOARD_RASTER_EXPORT_UNSUPPORTED', message: 'Raster board export requires a mounted Canvas renderer.', suggestion: 'Use renderer: "canvas", mount the board, then export PNG or JPEG.' }; }
  destroy() { this.renderer.destroy(); this._container = null; this.scene = null; }
}

export function createBoard(spec = {}) { return new FreeformBoard(spec); }
export { validateBoardSpec, planCanvas } from './board-contract.mjs';
