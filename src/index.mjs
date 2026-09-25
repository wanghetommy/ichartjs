/**
 * Public iChart.js 2.0 runtime entry point.
 * Exposes chart lifecycle, rendering, interaction, Agent editing, and discovery.
 */
import { normalizeSpec, validateSpec } from './spec.mjs';
import { normalizeData, inspectData, data } from './data.mjs';
import { binData, applyTransforms } from './transforms.mjs';
import { buildScene } from './charts.mjs';
import { CanvasRenderer, SVGRenderer } from './renderer.mjs';
import { contrastRatio, planStyle, resolveTheme, styleCapabilities, themeModes, themePalettes, themePresets, validateThemeContrast } from './theme.mjs';
import { PluginHost, annotationPlugin, dataZoomPlugin, dataLabelsPlugin, accessibilityPlugin } from './plugin.mjs';
import { projectTooltip, rerouteDiagramScene } from './project.mjs';
import { getBusinessSchema, inspectDataSchema } from './schema.mjs';
import { validateData } from './validation.mjs';
import { commitPreview, getEditCapabilities, previewEdit, validateEdit } from './edit.mjs';
import { EditHistory } from './history.mjs';
import { validateRecipe } from './recipes.mjs';
import { EditController } from './edit-controller.mjs';
import { diagramLayoutModes, diagramModes, edgeRoutingModes, normalizeDiagramSpec, validateDiagram, layoutDiagram, routeEdge } from './diagram.mjs';
import { normalizeProjectCalendar, applyWorkingCalendar, normalizeDependencies, analyzeSchedule, analyzeBurndownSeries, analyzeCapacity, buildCapacityView, buildCumulativeFlowSeries, buildVelocitySeries, buildReleaseForecast, buildRiskMatrixSeries, buildIssueAgingSeries } from './project-analytics.mjs';
import { normalizeLinkedFilters, normalizeLinkedSelection, filterProjectRows, createLinkedProjectState, linkedRecordId } from './project-linking.mjs';
import { explainChart, getCapabilities as discoverCapabilities, getChartCapability, getPreferenceCapabilities, planChart } from './capabilities.mjs';
import { applyPreferencesToSpec, createPreferencesStore, defaultPreferences, mergePreferences, mergeThemePreference, normalizePreferences, validatePreferences } from './preferences.mjs';
import { mountChartSettings } from './preferences-ui.mjs';
import { ChartValidationError } from './errors.mjs';
import { diagramOperations } from './contract-registry.mjs';
import { destroyChart } from './chart-lifecycle.mjs';

import { isDiagram, paintSelection, diagramPointer, diagramKeyboard } from './diagram-interaction.mjs';

function resolveContainer(container) { return typeof container === 'string' ? document.querySelector(container) : container; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function isPreferencesStore(value) { return Boolean(value && typeof value.getEffective === 'function' && typeof value.setChart === 'function' && typeof value.subscribe === 'function'); }
export function resolveZoomWindow(count, current, factor) {
  const total = Math.max(0, Math.round(Number(count) || 0));
  if (total <= 1) return { start: 0, end: total };
  const start = Math.max(0, Math.min(total, Number(current?.start) || 0)), end = Math.max(start, Math.min(total, Number(current?.end) || total));
  const currentSpan = Math.max(2, end - start), nextSpan = Math.max(2, Math.min(total, Math.round(currentSpan * factor)));
  const center = (start + end) / 2;
  const nextStart = Math.max(0, Math.min(total - nextSpan, Math.round(center - nextSpan / 2)));
  return { start: nextStart, end: nextStart + nextSpan };
}

function _svgEscape(value, mode = 'text') {
  const raw = value == null ? '' : String(value);
  let out = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (mode === 'attr') out = out.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  return out;
}
function _svgStyleFontParts(raw = '') {
  const str = String(raw).trim();
  let size = '', weight = '', family = '';
  const sizeMatch = str.match(/\b(\d+(?:\.\d+)?)\s*(px|em|rem|pt|%)/i);
  if (sizeMatch) size = `${sizeMatch[1]}${sizeMatch[2].toLowerCase()}`;
  const weightMatch = str.match(/^\s*(\d{3}|normal|bold|lighter|bolder)\b/i);
  if (weightMatch) weight = weightMatch[1];
  family = str
    .replace(/^\s*(?:(?:normal|italic|oblique)(?:\s+[^0-9\s]+)?\s+)?(?:\d{3}|normal|bold|lighter|bolder)\s+/i, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:px|em|rem|pt|%)(?:\s*\/\s*\S+)?\s*/i, '')
    .trim();
  return { size, weight, family };
}
const NO_PAINT_TOKENS = new Set(['none', 'transparent', '']);
function hasPaint(style, key) {
  const value = style?.[key];
  if (value == null) return false;
  return typeof value !== 'string' || !NO_PAINT_TOKENS.has(value.trim().toLowerCase());
}
function sceneToSvgString(scene, spec = {}) {
  const w = Number(scene?.width ?? spec?.width ?? 640);
  const h = Number(scene?.height ?? spec?.height ?? 360);
  const bg = spec.background ?? '#ffffff';
  const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`];
  if (bg) lines.push(`  <rect x="0" y="0" width="${w}" height="${h}" fill="${_svgEscape(bg, 'attr')}"/>`);
  const renderNode = (node, indent = '  ') => {
    if (!node || !node.visible) return;
    if (node.type === 'root') {
      const kids = [...node.children].sort((a, b) => a.zIndex - b.zIndex);
      kids.forEach(k => renderNode(k, indent));
      return;
    }
    const g = node.geometry || {}; const s = node.style || {};
    const attrs = [];
    if (node.id) attrs.push(`id="${_svgEscape(node.id, 'attr')}" data-node-id="${_svgEscape(node.id, 'attr')}"`);
    if (node.dataRef) attrs.push(`data-data-ref="${_svgEscape(JSON.stringify(node.dataRef), 'attr')}"`);
    const css = [];
    let tag = node.type;
    if (node.type === 'rect') {
      attrs.push(`x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"`);
    } else if (node.type === 'line') {
      attrs.push(`x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}"`);
    } else if (node.type === 'circle') {
      attrs.push(`cx="${g.cx}" cy="${g.cy}" r="${g.r}"`);
    } else if (node.type === 'arc') {
      tag = 'path';
      const large = g.end - g.start > Math.PI ? 1 : 0;
      const outerStart = `${g.cx + g.r * Math.cos(g.start)} ${g.cy + g.r * Math.sin(g.start)}`;
      const outerEnd = `${g.cx + g.r * Math.cos(g.end)} ${g.cy + g.r * Math.sin(g.end)}`;
      let d;
      if (g.innerR > 0) {
        d = [`M ${outerStart}`, `A ${g.r} ${g.r} 0 ${large} 1 ${outerEnd}`, `L ${g.cx + g.innerR * Math.cos(g.end)} ${g.cy + g.innerR * Math.sin(g.end)}`, `A ${g.innerR} ${g.innerR} 0 ${large} 0 ${g.cx + g.innerR * Math.cos(g.start)} ${g.cy + g.innerR * Math.sin(g.start)}`, 'Z'].join(' ');
      } else {
        d = [`M ${g.cx} ${g.cy}`, `L ${outerStart}`, `A ${g.r} ${g.r} 0 ${large} 1 ${outerEnd}`, 'Z'].join(' ');
      }
      attrs.push(`d="${_svgEscape(d, 'attr')}"`);
    } else if (node.type === 'path') {
      const d = g.curve === 'cubic' && g.points?.length === 4
        ? `M ${g.points[0].x} ${g.points[0].y} C ${g.points[1].x} ${g.points[1].y} ${g.points[2].x} ${g.points[2].y} ${g.points[3].x} ${g.points[3].y}`
        : `${(g.points || []).map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}${g.closed ? ' Z' : ''}`;
      attrs.push(`d="${_svgEscape(d, 'attr')}"`);
    } else if (node.type === 'text') {
      attrs.push(`x="${g.x}" y="${g.y}"`);
      if (Number.isFinite(Number(s.rotation)) && Number(s.rotation) !== 0) attrs.push(`transform="rotate(${Number(s.rotation)} ${g.x} ${g.y})"`);
      const anchor = s.textAnchor || (s.textAlign === 'end' ? 'end' : s.textAlign === 'center' ? 'middle' : s.textAlign === 'right' ? 'end' : s.textAlign === 'left' ? 'start' : 'start');
      if (anchor) attrs.push(`text-anchor="${anchor}"`);
      const baseline = s.textBaseline || s.baseline || 'alphabetic';
      if (baseline === 'top') { attrs.push(`dominant-baseline="text-before-edge"`); attrs.push(`alignment-baseline="before-edge"`); }
      else if (baseline === 'middle' || baseline === 'central') { attrs.push(`dominant-baseline="middle"`); attrs.push(`alignment-baseline="middle"`); }
      else if (baseline === 'bottom' || baseline === 'hanging') { attrs.push(`dominant-baseline="text-after-edge"`); attrs.push(`alignment-baseline="after-edge"`); }
      else { attrs.push(`dominant-baseline="alphabetic"`); attrs.push(`alignment-baseline="alphabetic"`); }
      if (s.font) {
        const rawFont = String(s.font).trim();
        attrs.push(`font="${_svgEscape(rawFont, 'attr')}"`);
        const { size, weight, family } = _svgStyleFontParts(rawFont);
        if (size) css.push(`font-size:${size}`);
        if (weight) css.push(`font-weight:${weight}`);
        if (family) css.push(`font-family:${family}`);
      }
    } else {
      tag = 'g';
    }
    if (['path', 'circle', 'rect', 'arc'].includes(node.type)) attrs.push(`fill="${hasPaint(s, 'fill') ? _svgEscape(s.fill, 'attr') : 'none'}"`);
    else if (node.type === 'text') attrs.push(`fill="${hasPaint(s, 'fill') ? _svgEscape(s.fill, 'attr') : '#0f172a'}"`);
    if (hasPaint(s, 'stroke')) attrs.push(`stroke="${_svgEscape(s.stroke, 'attr')}"`);
    else if (s.stroke != null) attrs.push('stroke="none"');
    if (s.strokeWidth) attrs.push(`stroke-width="${s.strokeWidth}"`);
    if (s.opacity != null) {
      const opacity = (node.highlighted || node.selected) ? 1 : s.opacity;
      attrs.push(`opacity="${opacity}"`);
    }
    if (node.highlighted || node.selected) attrs.push(`filter="brightness(1.2)"`);
    if (node.interactive) css.push('cursor:pointer');
    if (s.pointerEvents === 'none') css.push('pointer-events:none');
    if (s.ariaHidden === 'true') attrs.push(`aria-hidden="true"`);
    if (s.role === 'presentation') attrs.push(`role="presentation"`);
    if (node.decorative) {
      attrs.push(`aria-hidden="true"`);
      attrs.push(`role="presentation"`);
      css.push('pointer-events:none', 'user-select:none');
    }
    if (css.length) attrs.push(`style="${_svgEscape(css.join(';'), 'attr')}"`);
    if (node.type === 'text') {
      lines.push(`${indent}<${tag} ${attrs.join(' ')}>${_svgEscape(g.text ?? '')}</${tag}>`);
    } else {
      lines.push(`${indent}<${tag} ${attrs.join(' ')}/>`);
    }
    const kids = [...(node.children || [])].sort((a, b) => a.zIndex - b.zIndex);
    kids.forEach(k => renderNode(k, indent + '  '));
  };
  renderNode(scene.root);
  lines.push(`</svg>`);
  return lines.join('\n');
}
function exportError(code, message, suggestion, extra = {}) { return { valid: false, code, message, suggestion, ...extra }; }
function dataUrlToBlob(dataUrl, mime) {
  if (typeof Blob === 'undefined') return exportError('BLOB_HEADLESS', 'Blob is not available in this runtime.', 'Use as=dataurl or as=string.');
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return exportError('EXPORT_UNSUPPORTED', 'The renderer returned an invalid data URL.', 'Use chart.export({ type: "svg" }) and inspect the returned string.');
  const header = dataUrl.slice(0, comma), payload = dataUrl.slice(comma + 1);
  const bytes = /;base64$/i.test(header)
    ? Uint8Array.from(atob(payload), value => value.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
  return new Blob([bytes], { type: mime });
}
function canvasFactoryFromModule(module) { return module?.createCanvas || module?.default?.createCanvas || null; }
function renderRasterWithCanvas(createCanvas, spec, scene, rasterType, as) {
  const canvas = createCanvas(spec.width, spec.height), renderer = new CanvasRenderer({ ...spec });
  renderer.canvas = canvas;
  renderer.ctx = canvas.getContext('2d');
  if (!renderer.ctx) return exportError('HEADLESS_EXPORT_UNSUPPORTED', 'The optional canvas package did not provide a 2D context.', 'Install a supported canvas implementation or use SVG export.');
  renderer.resize(spec.width, spec.height);
  renderer.render(scene);
  const dataUrl = renderer.exportImage(rasterType);
  if (as === 'blob') return dataUrlToBlob(dataUrl, rasterType);
  return dataUrl;
}

export class Chart {
  constructor(input = {}) {
    const specInput = { ...input };
    delete specInput.preferences;
    delete specInput.preferencesStore;
    delete specInput.chartId;
    const result = validateSpec(specInput);
    if (!result.valid) throw new ChartValidationError('create', result.errors);
    this._specDiagnostics = { warnings: result.warnings, normalizations: result.normalizations };
    this.chartId = input.chartId ?? input.id ?? null;
    this._preferencesStore = isPreferencesStore(input.preferencesStore) ? input.preferencesStore : isPreferencesStore(input.preferences) ? input.preferences : null;
    this._localPreferences = this._preferencesStore ? null : normalizePreferences(input.preferences || {});
    delete result.spec.preferences;
    delete result.spec.preferencesStore;
    delete result.spec.chartId;
    this._themeInput = input.theme ?? 'auto';
    this._styleOverrides = { colors: input.colors !== undefined, background: input.background !== undefined, padding: input.padding !== undefined, legend: false, labels: false, grid: false, branding: false };
    this.spec = result.spec;
    this._preferenceBase = Object.fromEntries(['legend', 'labels', 'grid', 'branding', 'padding'].map(key => [key, clone(this.spec[key])]));
    this._resolveStyle();
    this.container = typeof document === 'undefined' ? null : resolveContainer(this.spec.container);
    this.listeners = new Map();
    this._selected = new Map();
    this._clipboard = { nodes: [], edges: [] };
    this._history = new EditHistory();
    this._revision = 0;
    this._lastChangeSet = null;
    this._destroyed = false;
    this._editor = new EditController(this);
    this.plugins = new PluginHost(this, this.spec.plugins);
    this._mountRenderer();
    this._observeResize();
    this._observeColorScheme();
    this.render();
    this._preferencesSnapshot = JSON.stringify(this.getPreferences());
    if (this._preferencesStore) this._preferencesUnsubscribe = this._preferencesStore.subscribe(event => {
      const next = this._preferencesStore.getEffective(this.chartId);
      const serialized = JSON.stringify(next);
      if (serialized === this._preferencesSnapshot) return;
      this._preferencesSnapshot = serialized;
      this._resolveStyle();
      this.render();
      this.emit('preferenceschange', { chart: this, preferences: clone(next), source: event.source, scope: event.scope, persisted: event.persisted });
    });
  }
  _resolveStyle() {
    ['legend', 'labels', 'grid', 'branding'].forEach(key => { this.spec[key] = clone(this._preferenceBase[key]); });
    if (this._styleOverrides.padding) this.spec.padding = clone(this._preferenceBase.padding);
    const preferences = this.getPreferences();
    this.spec.theme = resolveTheme(mergeThemePreference(this._themeInput, preferences.theme), this.spec);
    if (!this._styleOverrides.colors) this.spec.colors = [...this.spec.theme.colors];
    if (!this._styleOverrides.background) this.spec.background = this.spec.theme.background;
    if (!this._styleOverrides.padding) this.spec.padding = clone(this.spec.theme.layout.padding);
    this.spec = applyPreferencesToSpec(this.spec, preferences);
    ['legend', 'labels', 'grid', 'branding'].forEach(key => { if (this._styleOverrides[key]) this.spec[key] = clone(this._preferenceBase[key]); });
  }
  _observeColorScheme() {
    if (typeof matchMedia !== 'function') return;
    this._colorSchemeQuery = matchMedia('(prefers-color-scheme: dark)');
    this._colorSchemeHandler = () => {
      const requestedMode = typeof this._themeInput === 'string' ? this._themeInput : this._themeInput?.mode;
      if ((requestedMode || 'auto') !== 'auto') return;
      this._resolveStyle();
      this.render();
      this.emit('themechange', { chart: this, theme: this.getTheme(), source: 'system' });
    };
    this._colorSchemeQuery.addEventListener?.('change', this._colorSchemeHandler);
  }
  _mountRenderer() { const rendererType = this.spec.renderer === 'auto' ? 'canvas' : this.spec.renderer; this.renderer = rendererType === 'svg' ? new SVGRenderer(this.spec) : new CanvasRenderer(this.spec); if (this.container && typeof document !== 'undefined') this.renderer.mount(this.container); }
  render() { this.model = buildScene(this.spec); paintSelection(this); this._addInteractionNodes(); this.plugins.beforeRender(this.model); if (this.renderer.container) { this.renderer.options = this.spec; const target = this.renderer.svg || this.renderer.canvas; if (target) target.style.background = this.spec.background; this.renderer.resize(this.spec.width, this.spec.height); this.renderer.render(this.model.scene); this._bindEvents(); this._applyAccessibility(); } this.plugins.afterRender(this.model); this.emit('render', { chart: this }); return this; }
  _addInteractionNodes() { if (this.spec.interaction?.crosshair && this.model.state?.plot) { const plot = this.model.state.plot, stroke = this.spec.theme?.focus || '#64748b'; this.model.scene.add({ id: 'crosshair-x', type: 'line', geometry: { x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height }, style: { stroke, strokeWidth: 1, opacity: 0 }, interactive: false, zIndex: 99 }); this.model.scene.add({ id: 'crosshair-y', type: 'line', geometry: { x1: plot.x, y1: plot.y, x2: plot.x + plot.width, y2: plot.y }, style: { stroke, strokeWidth: 1, opacity: 0 }, interactive: false, zIndex: 99 }); } }
  _observeResize() { if (!this.container || typeof ResizeObserver === 'undefined') return; this._resizeObserver = new ResizeObserver(entries => { const width = Math.round(entries[0]?.contentRect?.width || 0); if (width && width !== this.spec.width) this.resize(width, this.spec.height); }); this._resizeObserver.observe(this.container); }
  _applyAccessibility() {
    if (!this.container) return;
    const target = this.renderer.svg || this.renderer.canvas;
    if (this.spec.accessibility?.enabled || isDiagram(this)) {
      target.setAttribute?.('role', isDiagram(this) ? 'group' : 'img');
      target.setAttribute?.('aria-label', this.getAccessibleDescription());
      if (isDiagram(this) && this._keyboardConnection) target.setAttribute?.('aria-description', `Connecting from port ${this._keyboardConnection.portId} on node ${this._keyboardConnection.nodeId}. Tab to another port, Enter to connect, Escape to cancel.`);
      else target.removeAttribute?.('aria-description');
      target.setAttribute?.('tabindex', '0');
      if (this.renderer.svg && isDiagram(this)) {
        [...this.renderer.svg.querySelectorAll('[data-node-id]')].forEach(element => {
          const dataRef = element.dataset.dataRef ? JSON.parse(element.dataset.dataRef) : {};
          if (dataRef.groupId && element.id.startsWith('group-')) {
            element.setAttribute('role', 'group');
            element.setAttribute('aria-label', `Group ${dataRef.groupId}${dataRef.collapsed ? ', collapsed' : ', expanded'}`);
            element.setAttribute('aria-expanded', String(!dataRef.collapsed));
          } else if (dataRef.edgeHandle) {
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', `${dataRef.edgeHandle === 'segment' ? 'Segment' : 'Waypoint'} handle for edge ${dataRef.edgeId}`);
          } else if (dataRef.edgeId || dataRef.from && dataRef.to) {
            element.setAttribute('role', 'img');
            element.setAttribute('aria-label', `Edge from ${dataRef.from} to ${dataRef.to}`);
            element.setAttribute('aria-selected', String(this.getSelectedEdgeIds().includes(dataRef.edgeId)));
            if (dataRef.from) element.setAttribute('aria-describedby', `node-${dataRef.from}`);
          } else if (dataRef.nodeId && !dataRef.portId) {
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', `Node ${dataRef.nodeId}`);
            if (dataRef.groupId) element.setAttribute('aria-describedby', `group-${dataRef.groupId}`);
            element.setAttribute('aria-selected', String(this.getSelectedNodeIds().includes(dataRef.nodeId)));
          } else if (dataRef.portId) {
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', `Port ${dataRef.portId} on node ${dataRef.nodeId}`);
            element.setAttribute('aria-describedby', `node-${dataRef.nodeId}`);
          }
        });
      }
      if (!this._keyboardBound && this.spec.interaction?.keyboard !== false) {
        this._keyboardHandler = event => {
          if (diagramKeyboard(this, event)) return;
          if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
          const ids = [];
          this.model.scene.walk(node => { if (node.interactive && node.dataRef) ids.push(node.id); });
          if (!ids.length) return;
          if (isDiagram(this) && this.spec.editing?.enabled && this._selected.size) {
            const delta = { x: ['ArrowRight', 'ArrowLeft'].includes(event.key) ? (event.key === 'ArrowRight' ? 8 : -8) : 0, y: ['ArrowDown', 'ArrowUp'].includes(event.key) ? (event.key === 'ArrowDown' ? 8 : -8) : 0 };
            const result = this.moveSelectedBy(delta, { confirmed: true, source: 'keyboard' });
            if (result.valid) event.preventDefault();
            return;
          }
          const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
          this._focusIndex = Math.max(0, Math.min(ids.length - 1, (this._focusIndex ?? 0) + direction));
          const node = this.model.scene.find(ids[this._focusIndex]);
          if (node) {
            this.model.scene.walk(item => { item.highlighted = false; });
            node.highlighted = true;
            this.renderer.render(this.model.scene);
            this.emit('focuschange', { chart: this, target: node, datum: node.dataRef.dataIndex == null ? undefined : this.model.data.rows[node.dataRef.dataIndex] });
          }
        };
        target.addEventListener('keydown', this._keyboardHandler);
        this._keyboardBound = true;
      }
    }
  }
  _bindEvents() { if (this._eventsBound || !this.renderer.container) return; const target = this.renderer.svg || this.renderer.canvas; const handler = event => { if (event.type === 'click' && isDiagram(this) && this._suppressDiagramClick) { this._suppressDiagramClick = false; return; } const point = this._eventPoint(event, target), node = this.model.scene.hit(point.x, point.y), dataIndex = node?.dataRef?.dataIndex == null ? undefined : node.dataRef.dataIndex + (this.model.data.viewOffset || 0), datum = node?.dataRef?.datum || (dataIndex === undefined ? undefined : normalizeData(this.spec.data).rows[dataIndex]); const payload = { type: event.type === 'click' ? 'click' : 'hover', chart: this, nativeEvent: event, target: node, dataRef: node?.dataRef ? { ...node.dataRef, dataIndex } : undefined, datum, coordinate: point }; if (payload.type === 'hover') { this._pointer = point; this._updateCrosshair(point.x, point.y); this.emit('hover', payload); } else if (node) { this.emit('click', payload); if (!isDiagram(this)) this.select(node, { additive: Boolean(event.shiftKey || event.metaKey || event.ctrlKey) }); } if (payload.type === 'hover' && this.spec.interaction.tooltip) { if (node) this._showTooltip(payload); else this._hideTooltip(); } };
    const start = event => { if (diagramPointer(this, 'start', event, target)) return; const point = this._eventPoint(event, target), node = this.model.scene.hit(point.x, point.y); target.setPointerCapture?.(event.pointerId); if (this.spec.type === 'flow' && this.spec.interaction?.drag && node?.id?.startsWith('node-')) { this._nodeDrag = { node, point }; return; } if (this.spec.interaction?.brush) this._brushStart = point; else if (this.spec.interaction?.pan) { this._dragStart = point; this.emit('dragstart', { chart: this, coordinate: point, target: node }); } };
    const move = event => { if (diagramPointer(this, 'move', event, target)) return; const point = this._eventPoint(event, target); if (this._brushStart) { this._brushEnd = point; this.emit('brush', { chart: this, start: this._brushStart, end: this._brushEnd }); } if (this._nodeDrag) { const { node, point: previous } = this._nodeDrag, dx = point.x - previous.x, dy = point.y - previous.y; node.geometry.x += dx; node.geometry.y += dy; node.bounds = { ...node.geometry }; const label = this.model.scene.find(`node-label-${node.dataRef.nodeId}`); if (label) { label.geometry.x += dx; label.geometry.y += dy; } const sourceNode = (this.spec.nodes || this.spec.data.nodes || []).find(item => item.id === node.dataRef.nodeId); if (sourceNode) sourceNode.position = { x: node.geometry.x, y: node.geometry.y }; rerouteDiagramScene(this.model.scene); this._nodeDrag.point = point; this.renderer.render(this.model.scene); this.emit('drag', { chart: this, target: node, coordinate: point }); } else if (this._dragStart) { this.panBy({ x: point.x - this._dragStart.x, y: point.y - this._dragStart.y }); this._dragStart = point; } };
    const end = event => { if (diagramPointer(this, 'end', event, target)) return; if (this._brushStart && this._brushEnd) this.selectBox(this._brushStart, this._brushEnd); if (this._nodeDrag) this.emit('dragend', { chart: this, target: this._nodeDrag.node }); if (this._dragStart) this.emit('dragend', { chart: this, coordinate: this._eventPoint(event, target) }); target.releasePointerCapture?.(event.pointerId); this._brushStart = null; this._brushEnd = null; this._dragStart = null; this._nodeDrag = null; this._pinchStart = null; };
    const touchStart = event => { if (isDiagram(this)) return; if (event.touches.length === 1) { const point = this._eventPoint(event.touches[0], target), node = this.model.scene.hit(point.x, point.y); this._touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY }; if (this.spec.type === 'flow' && this.spec.interaction?.drag && node?.id?.startsWith('node-')) this._nodeDrag = { node, point }; } if (event.touches.length === 2) { this._nodeDrag = null; this._pinchStart = this._touchDistance(event); } };
    const touchMove = event => { if (isDiagram(this)) return; event.preventDefault(); if (event.touches.length === 2 && this.spec.interaction?.zoom && this._pinchStart) { const distance = this._touchDistance(event); if (distance) { const factor = this._pinchStart / distance; if (Math.abs(1 - factor) > 0.04) { const count = normalizeData(this.spec.data).rows.length, current = this.spec.view || { start: 0, end: count }; if (count > 1) this.zoomTo(resolveZoomWindow(count, current, factor)); else this.zoomTo({ scale: Math.max(0.5, Math.min(4, (this.spec.view?.scale || 1) / factor)) }); this._pinchStart = distance; } } } else if (event.touches.length === 1 && this._touchStart) { const touch = event.touches[0]; if (this._nodeDrag) move({ clientX: touch.clientX, clientY: touch.clientY }); else if (this.spec.interaction?.pan) { this.panBy({ x: touch.clientX - this._touchStart.x, y: touch.clientY - this._touchStart.y }); this._touchStart = { x: touch.clientX, y: touch.clientY }; } } };
    const touchEnd = () => { this._touchStart = null; this._pinchStart = null; };
    const wheel = event => { if (!this.spec.interaction.zoom) return; event.preventDefault(); if (isDiagram(this)) { this.zoomTo({ scale: Math.max(0.25, Math.min(8, (this.spec.view?.scale || 1) * (event.deltaY > 0 ? 0.9 : 1.1))) }); return; } const count = normalizeData(this.spec.data).rows.length, current = this.spec.view || { start: 0, end: count }; this.zoomTo(resolveZoomWindow(count, current, event.deltaY > 0 ? 1.25 : 0.8)); };
    const leave = event => { this._hideTooltip(); if (!this._dragStart && !this._nodeDrag) end(event); };
    if (isDiagram(this)) target.style.touchAction = ['zoom', 'pan', 'brush', 'drag', 'edgeDrag', 'portConnect'].some(name => this.spec.interaction?.[name]) ? 'none' : 'auto'; target.addEventListener('mousemove', handler); target.addEventListener('click', handler); target.addEventListener('pointerdown', start); target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end); target.addEventListener('pointerleave', leave); target.addEventListener('touchstart', touchStart, { passive: false }); target.addEventListener('touchmove', touchMove, { passive: false }); target.addEventListener('touchend', touchEnd); target.addEventListener('wheel', wheel, { passive: false }); this._eventsBound = { target, handler, start, move, end, leave, touchStart, touchMove, touchEnd, wheel }; }
  _touchDistance(event) { if (!event.touches || event.touches.length < 2) return null; const [first, second] = event.touches; return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY); }
  _eventPoint(event, target) { const rect = target.getBoundingClientRect(); return { x: (event.clientX - rect.left) * this.spec.width / (rect.width || this.spec.width), y: (event.clientY - rect.top) * this.spec.height / (rect.height || this.spec.height) }; }
  _updateCrosshair(x, y) { const vertical = this.model.scene.find('crosshair-x'), horizontal = this.model.scene.find('crosshair-y'); if (!vertical || !horizontal) return; vertical.geometry.x1 = vertical.geometry.x2 = x; vertical.style.opacity = 0.7; horizontal.geometry.y1 = horizontal.geometry.y2 = y; horizontal.style.opacity = 0.7; this.renderer.render(this.model.scene); }
  _showTooltip(payload) { if (typeof document === 'undefined' || !this.container || !payload.datum) return; let tip = this._tooltip; if (!tip) { tip = this._tooltip = document.createElement('div'); tip.className = 'ichart-v2-tooltip'; Object.assign(tip.style, { position: 'fixed', pointerEvents: 'none', zIndex: 9999, padding: '8px 10px', borderRadius: '6px', maxWidth: 'min(320px, calc(100vw - 24px))', whiteSpace: 'pre-line' }); document.body.appendChild(tip); } Object.assign(tip.style, { background: this.spec.theme.surface, color: this.spec.theme.text, border: `1px solid ${this.spec.theme.border}`, font: this.spec.theme.typography.tooltip.font, boxShadow: `0 4px 12px ${this.spec.theme.border}88` }); const text = ['gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane', 'architecture', 'mindmap'].includes(this.spec.type) ? projectTooltip(this.spec.type, payload.datum, this.spec.locale) : Object.entries(payload.datum).map(([key, value]) => `${key}: ${value}`).join(' · '); tip.textContent = text; const left = Math.min((payload.nativeEvent.clientX || 0) + 12, window.innerWidth - tip.offsetWidth - 12); const top = Math.min((payload.nativeEvent.clientY || 0) + 12, window.innerHeight - tip.offsetHeight - 12); tip.style.left = `${Math.max(12, left)}px`; tip.style.top = `${Math.max(12, top)}px`; }
  _hideTooltip() { if (this._tooltip) this._tooltip.style.left = '-10000px'; }
  _validateMutation(operation, input) {
    const result = validateSpec(input);
    if (!result.valid) throw new ChartValidationError(operation, result.errors);
    return result;
  }
  _snapshotMutation() {
    return {
      spec: this.spec,
      model: this.model,
      themeInput: clone(this._themeInput),
      styleOverrides: clone(this._styleOverrides),
      preferenceBase: clone(this._preferenceBase),
      localPreferences: clone(this._localPreferences),
      preferencesSnapshot: this._preferencesSnapshot,
      specDiagnostics: clone(this._specDiagnostics)
    };
  }
  _restoreMutation(snapshot) {
    this.spec = snapshot.spec;
    this.model = snapshot.model;
    this._themeInput = snapshot.themeInput;
    this._styleOverrides = snapshot.styleOverrides;
    this._preferenceBase = snapshot.preferenceBase;
    this._localPreferences = snapshot.localPreferences;
    this._preferencesSnapshot = snapshot.preferencesSnapshot;
    this._specDiagnostics = snapshot.specDiagnostics;
    if (this.renderer) this.renderer.options = this.spec;
    try { if (this.renderer?.container && this.model?.scene) this.renderer.render(this.model.scene); } catch {}
  }
  _commitMutation() {
    const previousRevision = this._revision;
    this._revision += 1;
    try {
      this.render();
      this._history.clear();
      this._lastChangeSet = null;
      this._editor.pending.clear();
      return this;
    } catch (error) {
      this._revision = previousRevision;
      throw error;
    }
  }
  on(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); return this; }
  off(type, listener) { this.listeners.get(type)?.delete(listener); return this; }
  emit(type, event) { this.listeners.get(type)?.forEach(listener => listener(event)); }
  update(next = {}) {
    const { preferences, preferencesStore, chartId, preferenceScope, ...specUpdate } = next || {};
    if (preferences !== undefined) {
      const checked = validatePreferences(preferences, { partial: true });
      if (!checked.valid) throw new ChartValidationError('update', checked.errors);
    }
    const themeInput = specUpdate.theme === undefined ? this._themeInput : specUpdate.theme;
    const result = this._validateMutation('update', { ...this.spec, ...specUpdate, theme: themeInput, data: specUpdate.data === undefined ? this.spec.data : specUpdate.data });
    const snapshot = this._snapshotMutation();
    try {
      this._themeInput = themeInput;
      ['colors', 'background', 'padding', 'legend', 'labels', 'grid', 'branding'].forEach(key => { if (specUpdate[key] !== undefined) this._styleOverrides[key] = true; });
      this.spec = result.spec;
      ['legend', 'labels', 'grid', 'branding', 'padding'].forEach(key => { if (specUpdate[key] !== undefined) this._preferenceBase[key] = clone(this.spec[key]); });
      this._specDiagnostics = { warnings: result.warnings, normalizations: result.normalizations };
      if (preferences !== undefined) {
        if (this._preferencesStore) {
          const scope = preferenceScope === 'global' ? 'global' : 'chart';
          if (scope === 'global') this._preferencesStore.setGlobal(preferences, { source: 'update' });
          else this._preferencesStore.setChart(this.chartId || 'default', preferences, { source: 'update' });
        } else this._localPreferences = mergePreferences(this._localPreferences, preferences);
      }
      this._resolveStyle();
      return this._commitMutation();
    } catch (error) {
      this._restoreMutation(snapshot);
      throw error;
    }
  }
  setData(data) {
    const result = this._validateMutation('setData', { ...this.spec, theme: this._themeInput, data: { values: data } });
    const snapshot = this._snapshotMutation();
    try {
      this.spec = result.spec;
      this._specDiagnostics = { warnings: result.warnings, normalizations: result.normalizations };
      this._resolveStyle();
      return this._commitMutation();
    } catch (error) {
      this._restoreMutation(snapshot);
      throw error;
    }
  }
  setTheme(theme = 'auto') {
    const result = this._validateMutation('setTheme', { ...this.spec, theme });
    const snapshot = this._snapshotMutation();
    try {
      this._themeInput = theme;
      this.spec = result.spec;
      this._specDiagnostics = { warnings: result.warnings, normalizations: result.normalizations };
      this._resolveStyle();
      this._commitMutation();
      this.emit('themechange', { chart: this, theme: this.getTheme(), source: 'user' });
      return this;
    } catch (error) {
      this._restoreMutation(snapshot);
      throw error;
    }
  }
  getTheme() { return clone(this.spec.theme); }
  getPreferences() { return this._preferencesStore ? this._preferencesStore.getEffective(this.chartId) : clone(this._localPreferences || defaultPreferences); }
  setPreferences(patch = {}, options = {}) { const checked = validatePreferences(patch, { partial: true }); if (!checked.valid) throw new ChartValidationError('setPreferences', checked.errors); if (this._preferencesStore) { const scope = options.scope === 'global' ? 'global' : 'chart'; if (scope === 'global') this._preferencesStore.setGlobal(checked.value, { ...options, source: options.source || 'user' }); else this._preferencesStore.setChart(this.chartId || 'default', checked.value, { ...options, source: options.source || 'user' }); return this; } const snapshot = this._snapshotMutation(); try { this._localPreferences = mergePreferences(this._localPreferences, checked.value); this._preferencesSnapshot = JSON.stringify(this._localPreferences); this._resolveStyle(); this._commitMutation(); this.emit('preferenceschange', { chart: this, preferences: this.getPreferences(), source: options.source || 'user', scope: 'chart', persisted: false }); return this; } catch (error) { this._restoreMutation(snapshot); throw error; } }
  resetPreferences(options = {}) { if (this._preferencesStore) { this._preferencesStore.reset({ ...options, scope: options.scope || 'chart', chartId: this.chartId || 'default' }); return this; } const snapshot = this._snapshotMutation(); try { this._localPreferences = normalizePreferences({}); this._preferencesSnapshot = JSON.stringify(this._localPreferences); this._resolveStyle(); this._commitMutation(); this.emit('preferenceschange', { chart: this, preferences: this.getPreferences(), source: options.source || 'user', scope: 'chart', persisted: false }); return this; } catch (error) { this._restoreMutation(snapshot); throw error; } }
  resize(width = this.spec.width, height = this.spec.height) { this.spec.width = width; this.spec.height = height; this.render(); this.emit('resize', { chart: this, width, height }); return this; }
  getSpec() { return JSON.parse(JSON.stringify(this.spec)); }
  _getDiagnostics() { return [...new Map([...(this._specDiagnostics?.warnings || []), ...(this.model.data?.warnings || []), ...(this.spec.theme?.warnings || [])].map(item => [`${item.code}:${item.path || ''}`, item])).values()]; }
  _getHealth(warnings) {
    const isEmpty = this.model.data.rows.length === 0 && !['flow', 'swimlane', 'architecture', 'mindmap'].includes(this.spec.type) || warnings.some(item => item.code === 'ZERO_TOTAL');
    const marks = [];
    this.model.scene?.walk?.(node => { if (node.id !== 'root' && !['text', 'line'].includes(node.type)) marks.push(node); });
    const suppressedLabels = warnings.filter(item => item.code === 'LABELS_SUPPRESSED').reduce((sum, item) => sum + Number(item.count || 0), 0);
    const clampedValues = warnings.filter(item => item.code === 'VALUE_CLAMPED').reduce((sum, item) => sum + Number(item.count || 1), 0);
    return { version: '1.0', status: isEmpty ? 'empty' : warnings.length ? 'degraded' : 'ready', renderable: !isEmpty, issues: [...new Set(warnings.map(item => item.code))], metrics: { warnings: warnings.length, suppressedLabels, clampedValues, renderedMarks: marks.length } };
  }
  getState() { const brandingSignature = discoverCapabilities().branding.signature, warnings = this._getDiagnostics(), layoutState = this.model.state?.plot ? { family: this.model.state.layoutFamily || null, plot: clone(this.model.state.plot), chrome: clone(this.model.state.chrome || null), labels: clone(this.model.state.labelLayout || null) } : null; return { renderer: this.renderer.constructor.name, width: this.spec.width, height: this.spec.height, dataCount: this.model.data.rows.length, selected: [...this._selected.values()], revision: this._revision, history: this._history.state(), view: clone(this.spec.view || null), style: clone({ name: this.spec.theme.name, mode: this.spec.theme.mode, resolvedMode: this.spec.theme.resolvedMode, preset: this.spec.theme.preset, palette: this.spec.theme.palette, reasons: this.spec.theme.reasons }), layout: layoutState, timeAxis: clone(this.model.state?.timeAxis || null), axes: clone(this.model.state?.axes || null), health: this._getHealth(warnings), preferences: this.getPreferences(), branding: { enabled: Boolean(this.spec.branding?.enabled), signature: brandingSignature, text: this.spec.branding?.enabled === true ? brandingSignature : null }, warnings: clone(warnings), assumptions: clone(this.model.data?.assumptions || []), normalizations: clone(this._specDiagnostics?.normalizations || []), collapsedGroups: this.getCollapsedGroupIds(), clipboard: { nodes: this._clipboard?.nodes?.length || 0, edges: this._clipboard?.edges?.length || 0 }, projectAnalytics: clone(this.model.state?.projectAnalytics || null), linked: clone(this.model.state?.linked || null) }; }
  getProjectAnalytics() { return clone(this.model.state?.projectAnalytics || null); }
  getLinkedState() { return clone(this.model.state?.linked || null); }
  setLinkedFilters(filters = {}) { this.spec.project = { ...(this.spec.project || {}), linked: { ...(this.spec.project?.linked || {}), filters: normalizeLinkedFilters(filters) } }; this.emit('linkedstatechange', { chart: this, linked: this.spec.project.linked }); return this.render(); }
  setLinkedSelection(selection = []) { this.spec.project = { ...(this.spec.project || {}), linked: { ...(this.spec.project?.linked || {}), selection: normalizeLinkedSelection(selection) } }; this.emit('linkedstatechange', { chart: this, linked: this.spec.project.linked }); return this.render(); }
  describe() { return { type: this.spec.type, renderer: this.renderer.constructor.name, dimensions: [this.spec.encoding.x?.field || this.spec.encoding.category?.field], measures: (Array.isArray(this.spec.encoding.y) ? this.spec.encoding.y : [this.spec.encoding.y || this.spec.encoding.value]).filter(Boolean).map(encoding => encoding.field), dataCount: this.model.data.rows.length, theme: this.spec.theme?.name || 'custom', interactions: Object.keys(this.spec.interaction || {}).filter(key => this.spec.interaction[key]) }; }
  explain() { const explanation = explainChart(this.spec, this.model), state = this.getState(); return { ...explanation, layout: state.layout, timeAxis: state.timeAxis, warnings: state.warnings, health: state.health }; }
  getAccessibleDescription() { const description = this.spec.accessibility?.description || this.spec.title?.text || `${this.spec.type} chart`; return `${description}; ${this.model.data.rows.length} data items.`; }
  inspectDataSchema() { return inspectDataSchema(this.spec.data.schema || this.spec.schema); }
  validateData() { return validateData(this.toDataTable(), this.spec.data.schema || this.spec.schema, this.spec.validationOptions); }
  validateEdit(command) { return validateEdit(command, { values: this.toDataTable(), schema: this.spec.data.schema || this.spec.schema, validationOptions: this.spec.validationOptions, requireConfirmation: this.spec.editing?.requireConfirmation }); }
  previewEdit(command) { return this._editor.preview(command); }
  applyEdit(command, options = {}) { return this._editor.apply(command, options); }
  getChangeSet() { return this._lastChangeSet ? JSON.parse(JSON.stringify(this._lastChangeSet)) : null; }
  undo(options = {}) { return this._editor.restore('undo', options); }
  redo(options = {}) { return this._editor.restore('redo', options); }
  use(plugin) { this.plugins.use(plugin); return this.render(); }
  highlight(target) { if (target?.id) target.highlighted = true; this.render(); return this; }
  select(target, options = {}) { if (!options.additive) { this._selected.clear(); this.model?.scene.walk(node => { node.selected = false; }); } if (target?.id) { target.selected = true; this._selected.set(target.id, target.dataRef); } this.emit('selectionchange', { chart: this, target, selectedData: this.getSelectedData() }); return this; }
  selectNodes(nodeIds = [], options = {}) { if (!options.additive) { this._selected.clear(); this.model.scene.walk(node => { node.selected = false; }); } nodeIds.forEach(id => { const node = this.model.scene.find(`node-${id}`); if (node) { node.selected = true; this._selected.set(node.id, node.dataRef); } }); this.emit('selectionchange', { chart: this, target: null, selectedData: this.getSelectedData() }); this.render(); return this; }
  selectEdges(edgeIds = [], options = {}) { if (!options.additive) { this._selected.clear(); this.model.scene.walk(node => { node.selected = false; }); } const selected = new Set(edgeIds); this.model.scene.walk(node => { if (node.dataRef?.edgeId && !node.dataRef?.edgeHandle && selected.has(node.dataRef.edgeId)) { node.selected = true; this._selected.set(node.id, node.dataRef); } }); this.emit('selectionchange', { chart: this, target: null, selectedData: this.getSelectedData() }); this.render(); return this; }
  selectGroup(groupId, options = {}) { return this.selectNodes(this.model.data.rows.filter(row => row.groupId === groupId).map(row => row.id), options); }
  getSelectedNodeIds() { return [...new Set([...this._selected.values()].map(ref => ref?.nodeId).filter(Boolean))]; }
  getSelectedEdgeIds() { return [...new Set([...this._selected.values()].map(ref => ref?.edgeId).filter(Boolean))]; }
  getDiagramNodes() { return (this.spec.nodes || this.spec.data?.nodes || []).map(node => ({ ...node })); }
  getDiagramEdges() { return (this.spec.edges || this.spec.data?.edges || []).map(edge => ({ ...edge })); }
  getDiagramGroups() { return (this.spec.groups || this.spec.data?.groups || []).map(group => ({ ...group })); }
  getCollapsedGroupIds() { return this.getDiagramGroups().filter(group => group.collapsed).map(group => group.id); }
  copySelection() {
    const nodeIds = this.getSelectedNodeIds();
    if (!nodeIds.length) return { valid: false, errors: [{ code: 'NO_SELECTION', message: 'Select one or more diagram nodes first.' }] };
    const selected = new Set(nodeIds), nodes = this.getDiagramNodes().filter(node => selected.has(node.id)), edges = this.getDiagramEdges().filter(edge => selected.has(edge.from) && selected.has(edge.to));
    this._clipboard = { nodes, edges };
    this.emit('clipboardchange', { chart: this, clipboard: this.getClipboard() });
    return { valid: true, clipboard: this.getClipboard() };
  }
  getClipboard() { return { nodes: (this._clipboard?.nodes || []).map(node => ({ ...node })), edges: (this._clipboard?.edges || []).map(edge => ({ ...edge })) }; }
  pasteSelection(options = {}) {
    if (!this._clipboard?.nodes?.length) return { valid: false, errors: [{ code: 'EMPTY_CLIPBOARD', message: 'Copy diagram nodes before pasting.' }] };
    const before = new Set(this.getDiagramNodes().map(node => node.id));
    const preview = this.previewEdit({ type: 'layout-edit', reason: 'Paste selection', operations: [{ op: 'pasteSelection', nodes: this._clipboard.nodes, edges: this._clipboard.edges, ...(options.offset ? { offset: options.offset } : {}) }] });
    const result = this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed });
    if (result.valid) {
      const inserted = this.getDiagramNodes().filter(node => !before.has(node.id)).map(node => node.id);
      if (inserted.length) this.selectNodes(inserted);
      this.emit('clipboardchange', { chart: this, clipboard: this.getClipboard(), pastedNodeIds: inserted });
    }
    return result;
  }
  duplicateSelection(options = {}) {
    const nodeIds = this.getSelectedNodeIds();
    if (!nodeIds.length) return { valid: false, errors: [{ code: 'NO_SELECTION', message: 'Select one or more diagram nodes first.' }] };
    const before = new Set(this.getDiagramNodes().map(node => node.id));
    const preview = this.previewEdit({ type: 'layout-edit', reason: 'Duplicate selection', operations: [{ op: 'duplicateSelection', nodeIds, ...(options.offset ? { offset: options.offset } : {}) }] });
    const result = this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed });
    if (result.valid) {
      const inserted = this.getDiagramNodes().filter(node => !before.has(node.id)).map(node => node.id);
      if (inserted.length) this.selectNodes(inserted);
    }
    return result;
  }
  connectNodes(connection, options = {}) {
    const operation = { op: 'addEdge', from: connection.from, to: connection.to, ...(connection.id ? { id: connection.id } : {}), ...(connection.fromPort ? { fromPort: connection.fromPort } : {}), ...(connection.toPort ? { toPort: connection.toPort } : {}), ...(connection.label ? { label: connection.label } : {}), ...(connection.status ? { status: connection.status } : {}), ...(connection.routing ? { routing: connection.routing } : {}) };
    const preview = this.previewEdit({ type: 'layout-edit', reason: 'Connect diagram nodes', operations: [operation] });
    return this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed });
  }
  deleteSelectedEdges(options = {}) {
    const edgeIds = this.getSelectedEdgeIds();
    if (!edgeIds.length) return { valid: false, errors: [{ code: 'NO_SELECTION', message: 'Select one or more diagram edges first.' }] };
    if (this.spec.editing?.allowDelete !== true) return { valid: false, errors: [{ code: 'DELETE_DISABLED', message: 'Edge deletion requires editing.allowDelete.' }] };
    const preview = this.previewEdit({ type: 'layout-edit', reason: 'Delete selected diagram edges', operations: edgeIds.map(edgeId => ({ op: 'removeEdge', edgeId })) });
    const result = this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed });
    if (result.valid) this.clearSelection();
    return result;
  }
  toggleGroupCollapse(groupId, options = {}) {
    const preview = this.previewEdit({ type: 'layout-edit', reason: 'Toggle group collapse', operations: [{ op: 'toggleGroupCollapse', groupId, ...(options.collapsed !== undefined ? { collapsed: options.collapsed } : {}) }] });
    const result = this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed });
    if (result.valid) this.emit('groupcollapsechange', { chart: this, groupId, collapsedGroups: this.getCollapsedGroupIds() });
    return result;
  }
  moveGroupBy(groupId, delta, options = {}) { const preview = this.previewEdit({ type: 'layout-edit', reason: options.reason || 'Move diagram group', operations: [{ op: 'moveGroup', groupId, delta }] }); return this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed }); }
  resizeGroup(groupId, size, options = {}) { const preview = this.previewEdit({ type: 'layout-edit', reason: 'Resize diagram group members', operations: [{ op: 'resizeGroup', groupId, size }] }); return this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed }); }
  assignSelectedToGroup(groupId, options = {}) { const nodeIds = this.getSelectedNodeIds(); if (!nodeIds.length) return { valid: false, errors: [{ code: 'NO_SELECTION', message: 'Select one or more diagram nodes first.' }] }; const preview = this.previewEdit({ type: 'layout-edit', reason: groupId === null ? 'Remove nodes from diagram group' : 'Assign nodes to diagram group', operations: [{ op: 'assignNodesToGroup', nodeIds, groupId }] }); return this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed }); }
  duplicateGroup(groupId, options = {}) { const before = new Set(this.getDiagramGroups().map(group => group.id)); const preview = this.previewEdit({ type: 'layout-edit', reason: 'Duplicate diagram group', operations: [{ op: 'duplicateGroup', groupId, ...(options.offset ? { offset: options.offset } : {}) }] }); const result = this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed }); if (result.valid) { const insertedGroup = this.getDiagramGroups().find(group => !before.has(group.id)); if (insertedGroup) this.selectGroup(insertedGroup.id); } return result; }
  deleteGroup(groupId, options = {}) { const preview = this.previewEdit({ type: 'layout-edit', reason: 'Delete diagram group', operations: [{ op: 'deleteGroup', groupId, policy: options.policy || 'ungroup' }] }); const result = this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed }); if (result.valid) this.clearSelection(); return result; }
  moveSelectedBy(delta, options = {}) { const nodeIds = this.getSelectedNodeIds(); if (!nodeIds.length) return { valid: false, errors: [{ code: 'NO_SELECTION', message: 'Select one or more diagram nodes first.' }] }; const preview = this.previewEdit({ type: 'layout-edit', reason: options.reason || 'Move selected nodes', operations: [{ op: 'moveNodes', nodeIds, delta }] }); return this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed }); }
  alignSelected(alignment, options = {}) { const nodeIds = this.getSelectedNodeIds(); const preview = this.previewEdit({ type: 'layout-edit', reason: `Align selected nodes ${alignment}`, operations: [{ op: 'alignNodes', nodeIds, alignment }] }); return this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed }); }
  snapSelected(options = {}) { const nodeIds = this.getSelectedNodeIds(); const preview = this.previewEdit({ type: 'layout-edit', reason: 'Snap selected nodes', operations: [{ op: 'snapNodes', nodeIds }] }); return this.applyEdit(preview.command, { ...options, preview, confirmed: options.confirmed }); }
  getSelectedData() { const diagram = isDiagram(this), source = diagram ? (this.spec.nodes || this.spec.data?.nodes || []) : normalizeData(this.spec.data).rows, edges = diagram ? (this.spec.edges || this.spec.data?.edges || []) : [], offset = diagram ? 0 : (this.model.data.viewOffset || 0); return [...this._selected.values()].map(ref => diagram ? ref?.edgeId ? edges.find((row, index) => (row.id || `edge-${index}`) === ref.edgeId) : source.find(row => row.id === ref?.nodeId) : (ref?.dataIndex == null ? ref?.datum : source[ref.dataIndex + offset])).filter(Boolean); }
  clearSelection() { this._selected.clear(); this.render(); this.emit('selectionchange', { chart: this, target: null, selectedData: [] }); return this; }
  getElementAt(x, y) { return this.model.scene.hit(x, y); }
  selectBox(start, end) { const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x), top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y); this._selected.clear(); this.model.scene.walk(node => { node.selected = false; if (!node.dataRef || !node.bounds || !node.interactive || (isDiagram(this) && !node.id.startsWith('node-'))) return; const intersects = node.bounds.x <= right && node.bounds.x + node.bounds.width >= left && node.bounds.y <= bottom && node.bounds.y + node.bounds.height >= top; if (intersects) { node.selected = true; this._selected.set(node.id, node.dataRef); } }); this.emit('selectionchange', { chart: this, selectedData: this.getSelectedData(), box: { start, end } }); this.render(); return this; }
  toDataTable() { return this.model.data.rows.map(row => ({ ...row })); }
  applyPatch(patches = []) {
    const candidate = clone(this.spec);
    try {
      patches.forEach((patch, index) => {
        if (!patch || !['add', 'replace', 'remove'].includes(patch.op) || typeof patch.path !== 'string' || !patch.path.startsWith('/')) throw new ChartValidationError('applyPatch', [{ code: 'INVALID_PATCH', path: `patches[${index}]`, message: 'Patch requires add, replace, or remove and an absolute JSON pointer path.', suggestion: 'Use for example { op: "replace", path: "/title/text", value: "Revenue" }.' }]);
        const path = patch.path.replace(/^\//, '').split('/').map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
        let target = candidate;
        path.slice(0, -1).forEach(key => { if (target == null || typeof target !== 'object' || !(key in target)) throw new ChartValidationError('applyPatch', [{ code: 'INVALID_PATCH_PATH', path: `patches[${index}].path`, message: `Patch path does not exist: ${patch.path}`, suggestion: 'Patch an existing Spec path or add a direct child of an existing object.' }]); target = target[key]; });
        const key = path.at(-1);
        if (patch.op === 'remove') delete target[key];
        else target[key] = clone(patch.value);
      });
    } catch (error) {
      if (error instanceof ChartValidationError) throw error;
      throw new ChartValidationError('applyPatch', [{ code: 'INVALID_PATCH', path: 'patches', message: error.message, suggestion: 'Use JSON-safe patch values and valid Spec paths.' }]);
    }
    const themePatched = patches.some(patch => typeof patch?.path === 'string' && (patch.path === '/theme' || patch.path.startsWith('/theme/')));
    const result = this._validateMutation('applyPatch', { ...candidate, theme: themePatched ? candidate.theme : this._themeInput });
    const snapshot = this._snapshotMutation();
    try {
      this.spec = result.spec;
      if (themePatched) this._themeInput = candidate.theme;
      this._specDiagnostics = { warnings: result.warnings, normalizations: result.normalizations };
      this._resolveStyle();
      return this._commitMutation();
    } catch (error) {
      this._restoreMutation(snapshot);
      throw error;
    }
  }
  resetZoom() { delete this.spec.view; return this.render(); }
  zoomTo(view) { this.spec.view = { ...view }; this.emit('zoomchange', { chart: this, view: this.spec.view }); return this.render(); }
  panBy(delta) { const current = this.spec.view || {}; this.spec.view = { ...current, offsetX: (current.offsetX || 0) + (delta.x || 0), offsetY: (current.offsetY || 0) + (delta.y || 0) }; this.emit('zoomchange', { chart: this, view: this.spec.view }); return this.render(); }
  toDataURL(type = 'image/png') {
    const rawType = String(type || 'image/png').toLowerCase();
    const wantsSvg = rawType.includes('svg') || rawType.includes('xml');
    if (this.renderer instanceof SVGRenderer) {
      if (wantsSvg) {
        const headlessEnv = typeof document === 'undefined' || typeof XMLSerializer === 'undefined';
        const string = headlessEnv
          ? sceneToSvgString(this.model.scene, this.spec)
          : this.renderer.container
            ? this.renderer.exportString()
            : (() => { const renderer = new SVGRenderer(this.spec); renderer.resize(this.spec.width, this.spec.height); renderer.render(this.model.scene); return renderer.exportString(); })();
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(string)}`;
      }
      if (typeof document !== 'undefined') {
        const cv = document.createElement('canvas');
        const r = new CanvasRenderer({ ...this.spec, container: undefined });
        r.canvas = cv; r.ctx = cv.getContext('2d');
        r.resize(this.spec.width, this.spec.height);
        if (this.spec.background) { r.ctx.fillStyle = this.spec.background; r.ctx.fillRect(0, 0, this.spec.width, this.spec.height); }
        r.render(this.model.scene);
        return r.exportImage(type);
      }
      return { valid: false, code: 'HEADLESS_EXPORT_UNSUPPORTED', rasterCode: 'RASTER_EXPORT_UNSUPPORTED', message: `SVG renderer raster ('${type}') in headless requires npm i canvas, or fall back to chart.export({type:"svg"}).`, suggestion: 'Use chart.export({type:"svg"}) for headless, or render with { renderer: "canvas" }.' };
    }
    if (this.renderer instanceof CanvasRenderer && typeof this.renderer.exportImage === 'function' && this.renderer.canvas) return this.renderer.exportImage(type);
    return exportError(typeof document === 'undefined' ? 'HEADLESS_EXPORT_UNSUPPORTED' : 'EXPORT_UNSUPPORTED', `toDataURL('${type}') is not available because the renderer has no canvas surface.`, 'Mount the chart in a browser or use chart.export({ type: "svg" }).');
  }
  toBlob(type = 'image/png') {
    if (typeof document === 'undefined') return { valid: false, code: 'BLOB_HEADLESS', message: 'toBlob() requires a browser document. Use toDataURL() or export({type:"svg"}) in headless.', suggestion: 'Use chart.export({type:"svg"}) or chart.toDataURL() which both return strings usable in headless.' };
    let url;
    try { url = this.toDataURL(type); } catch (error) { return exportError('EXPORT_UNSUPPORTED', String(error?.message || error), 'Use chart.export({ type: "svg" }) or mount a supported renderer.'); }
    if (!url || typeof url !== 'string') return { valid: false, code: 'EXPORT_UNSUPPORTED', message: "Couldn't produce a data URL for export.", suggestion: (url && url.message) || url };
    const normalizedType = String(type).toLowerCase();
    const mime = normalizedType.includes('svg') ? 'image/svg+xml' : /^image\//i.test(normalizedType) ? normalizedType : 'image/png';
    return dataUrlToBlob(url, mime);
  }
  export(options = {}) {
    const rawType = String(options.type || (this.renderer instanceof CanvasRenderer ? 'image/png' : 'image/svg+xml')).toLowerCase();
    const normalizeType = t => {
      if (t === 'json' || t === 'application/json' || t.endsWith('/json')) return 'json';
      if (t.includes('svg')) return 'svg';
      if (t.includes('png')) return 'png';
      if (t.includes('jpeg') || t.includes('jpg')) return 'jpeg';
      return 'auto';
    };
    const kind = normalizeType(rawType);
    if (kind === 'auto') return exportError('EXPORT_TYPE_UNSUPPORTED', `Unknown export type: ${rawType}`, 'Use png, svg, jpeg, or json.');
    if (kind === 'json') {
      const payload = { version: '2.0', spec: this.getSpec(), state: this.getState() };
      const json = JSON.stringify(payload, null, 2);
      if (!options.as || options.as === 'string') return json;
      if (options.as === 'object') return payload;
      if (options.as === 'dataurl') return `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
      if (options.as === 'blob') return dataUrlToBlob(`data:application/json;charset=utf-8,${encodeURIComponent(json)}`, 'application/json');
      return exportError('EXPORT_TYPE_UNSUPPORTED', `Unsupported JSON export format: ${options.as}`, 'Use string, dataurl, blob, or object.');
    }
    if (kind === 'svg') {
      const svgRendererReady = this.renderer instanceof SVGRenderer && this.renderer.container;
      const headlessEnv = typeof document === 'undefined' || typeof XMLSerializer === 'undefined';
      if (headlessEnv) {
        const string = sceneToSvgString(this.model.scene, this.spec);
        if (options.as === 'dataurl') return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(string)}`;
        if (options.as === 'blob') return { valid: false, code: 'BLOB_HEADLESS', message: 'as=blob requires a browser runtime (Blob). Use as=string or as=dataurl in headless.', suggestion: 'chart.export({type:"svg"}) returns the SVG string directly.' };
        return string;
      }
      const svgRenderer = svgRendererReady
        ? this.renderer
        : (() => { const r = new SVGRenderer(this.spec); r.resize(this.spec.width, this.spec.height); r.render(this.model.scene); return r; })();
      const string = svgRenderer.exportString();
      if (options.as === 'dataurl') return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(string)}`;
      if (options.as === 'blob') {
        if (typeof Blob === 'undefined') return { valid: false, code: 'BLOB_HEADLESS', message: 'as=blob requires a browser runtime. Use as=string or as=dataurl in headless.', suggestion: 'chart.export({type:"svg"}) returns the SVG string directly.' };
        return new Blob([string], { type: 'image/svg+xml' });
      }
      return string;
    }
    const rasterType = kind === 'jpeg' ? 'image/jpeg' : 'image/png';
    if (this.renderer instanceof CanvasRenderer && typeof this.renderer.exportImage === 'function' && this.renderer.canvas) {
      const dataUrl = this.renderer.exportImage(rasterType);
      if (options.as === 'blob') {
        if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof atob !== 'function') return { valid: false, code: 'BLOB_HEADLESS', message: 'PNG as=blob requires a browser runtime (atob + Blob). Use as=dataurl or as=string in headless.', suggestion: 'In Node headless, install the canvas package and render via a mounted CanvasRenderer, or fall back to chart.export({type:"svg"}).' };
        const comma = dataUrl.indexOf(',');
        const bytes = Uint8Array.from(atob(dataUrl.slice(comma + 1)), c => c.charCodeAt(0));
        return new Blob([bytes], { type: rasterType });
      }
      return dataUrl;
    }
    if (this.renderer instanceof SVGRenderer && typeof document !== 'undefined') {
      const cv = document.createElement('canvas');
      const r = new CanvasRenderer({ ...this.spec, container: undefined });
      r.canvas = cv; r.ctx = cv.getContext('2d');
      r.resize(this.spec.width, this.spec.height);
      if (this.spec.background) { r.ctx.fillStyle = this.spec.background; r.ctx.fillRect(0, 0, this.spec.width, this.spec.height); }
      r.render(this.model.scene);
      const dataUrl = r.exportImage(rasterType);
      if (options.as === 'blob') {
        if (typeof Blob === 'undefined' || typeof atob !== 'function') return { valid: false, code: 'BLOB_UNSUPPORTED', message: 'as=blob requires Blob + atob.' };
        const comma = dataUrl.indexOf(',');
        const bytes = Uint8Array.from(atob(dataUrl.slice(comma + 1)), c => c.charCodeAt(0));
        return new Blob([bytes], { type: rasterType });
      }
      return dataUrl;
    }
    return exportError('HEADLESS_EXPORT_UNSUPPORTED', `Raster export (${rasterType}) requires a mounted CanvasRenderer or the async optional canvas adapter.`, 'Use chart.exportAsync({ type: "png" }) with the optional canvas package, or fall back to chart.export({ type: "svg" }).', { rasterCode: 'RASTER_EXPORT_UNSUPPORTED' });
  }
  async exportAsync(options = {}) {
    const rawType = String(options.type || (this.renderer instanceof CanvasRenderer ? 'image/png' : 'image/svg+xml')).toLowerCase();
    const normalizeType = t => {
      if (t === 'json' || t === 'application/json' || t.endsWith('/json')) return 'json';
      if (t.includes('svg')) return 'svg';
      if (t.includes('png')) return 'png';
      if (t.includes('jpeg') || t.includes('jpg')) return 'jpeg';
      return 'auto';
    };
    const kind = normalizeType(rawType);
    if (kind === 'auto') return exportError('EXPORT_TYPE_UNSUPPORTED', `Unknown export type: ${rawType}`, 'Use png, svg, jpeg, or json.');
    if (kind === 'png' || kind === 'jpeg') {
      const direct = this.export(options);
      if (!(direct && typeof direct === 'object' && direct.code === 'HEADLESS_EXPORT_UNSUPPORTED')) return direct;
      try {
        const moduleName = 'canvas';
        const module = await import(moduleName);
        const createCanvas = canvasFactoryFromModule(module);
        if (!createCanvas) return direct;
        return renderRasterWithCanvas(createCanvas, this.spec, this.model.scene, kind === 'jpeg' ? 'image/jpeg' : 'image/png', options.as);
      } catch {
        return direct;
      }
    }
    return this.export(options);
  }
  _safeFilename(prefix = 'ichart') {
    const sanitize = s => String(s == null ? '' : s).replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || prefix;
    const title = sanitize(this.spec.title?.text || this.spec.type || 'chart');
    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `${prefix}-${title}-${ts}`;
  }
  download(options = {}) {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      const kind = (options.type || options.format || 'auto').toString().toLowerCase();
      if (kind.includes('svg')) return this.export({ type: 'svg' });
      if (kind.includes('json')) return this.export({ type: 'json' });
      return { valid: false, code: 'DOWNLOAD_HEADLESS', message: 'chart.download*() triggers a browser save-as dialog; in headless, use chart.export() directly.', suggestion: 'Use chart.export({type:"svg|json"}) (strings) or chart.toDataURL() (data URL) in headless.' };
    }
    const kind = (options.type || options.format || 'png').toString().toLowerCase();
    if (kind.includes('svg')) {
      const svg = this.export({ type: 'svg' });
      if (!svg || typeof svg !== 'string') return svg;
      return this._downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${this._safeFilename('ichartjs')}.svg`);
    }
    if (kind.includes('json')) {
      const json = this.export({ type: 'json' });
      return this._downloadBlob(new Blob([json], { type: 'application/json' }), `${this._safeFilename('ichartjs')}.json`);
    }
    const rasterType = kind.includes('jpeg') || kind.includes('jpg') ? 'image/jpeg' : 'image/png';
    const ext = kind.includes('jpeg') || kind.includes('jpg') ? 'jpg' : 'png';
    const blob = this.toBlob(rasterType);
    if (!blob || blob instanceof Blob === false) return blob;
    return this._downloadBlob(blob, `${this._safeFilename('ichartjs')}.${ext}`);
  }
  downloadPNG() { return this.download({ type: 'png' }); }
  downloadSVG() { return this.download({ type: 'svg' }); }
  downloadJSON() { return this.download({ type: 'json' }); }
  _downloadBlob(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
      return { valid: true, filename, size: blob.size, type: blob.type };
    } catch (err) {
      return { valid: false, code: 'DOWNLOAD_FAILED', message: String(err && err.message || err), suggestion: 'Try chart.export() and write the result manually.' };
    }
  }
  destroy() { destroyChart(this); }
}

export function createChart(spec) { return new Chart(spec); }
export { ChartValidationError } from './errors.mjs';
export function getCapabilities() { const capabilities = discoverCapabilities(); return { ...capabilities, interactionDefaults: { ...capabilities.interactionDefaults }, diagram: { layoutModes: diagramLayoutModes, routingModes: edgeRoutingModes, entities: ['node', 'edge', 'lane', 'group', 'port', 'waypoint'], operations: [...diagramOperations], curvedEdges: { renderers: ['canvas', 'svg'], type: 'cubic-bezier', tension: { minimum: 0.2, maximum: 0.8, default: 0.4 }, mindmapDefault: true, obstacleFallback: 'orthogonal', controlPointEditing: false }, edgeEditing: { renderers: ['canvas', 'svg'], selection: true, waypointDrag: true, segmentDrag: true, persistentWaypoints: true, enabledByDefault: false, activation: ['editing.enabled', 'interaction.edgeDrag'] }, validation: ['duplicate-ids', 'missing-endpoints', 'missing-ports', 'missing-lanes', 'invalid-waypoints', 'invalid-curve-tension'] }, editing: { modes: ['preview', 'commit', 'undo', 'redo'], operations: [...capabilities.commands], confirmationRequiredByDefault: true, commit: 'local-runtime-host-persistence-required' } }; }
export function recommend(input, options = {}) { const plan = planChart(input, options); return { primary: plan.primary, alternatives: plan.alternatives, reason: plan.reasons.join(' '), reasons: plan.reasons, confidence: plan.confidence, requiredFields: plan.requiredFields, assumptions: plan.assumptions, warnings: plan.warnings, nextActions: plan.nextActions }; }
export { normalizeSpec, validateSpec, normalizeData, inspectData, binData, applyTransforms, data, getBusinessSchema, inspectDataSchema, validateData, getEditCapabilities, validateEdit, previewEdit, commitPreview, validateRecipe, getChartCapability, getPreferenceCapabilities, planChart, explainChart };
export { diagramLayoutModes, diagramModes, edgeRoutingModes, normalizeDiagramSpec, validateDiagram, layoutDiagram, routeEdge };
export { normalizeProjectCalendar, applyWorkingCalendar, normalizeDependencies, analyzeSchedule, analyzeBurndownSeries, analyzeCapacity, buildCapacityView, buildCumulativeFlowSeries, buildVelocitySeries, buildReleaseForecast, buildRiskMatrixSeries, buildIssueAgingSeries };
export { normalizeLinkedFilters, normalizeLinkedSelection, filterProjectRows, createLinkedProjectState, linkedRecordId };

export { contrastRatio, planStyle, resolveTheme, styleCapabilities, themeModes, themePalettes, themePresets, validateThemeContrast, annotationPlugin, dataZoomPlugin, dataLabelsPlugin, accessibilityPlugin };
export { applyPreferencesToSpec, createPreferencesStore, defaultPreferences, mergePreferences, mergeThemePreference, mountChartSettings, normalizePreferences, validatePreferences };
export const iChart = { version: '2.0.17', createChart, ChartValidationError, inspectData, normalizeData, binData, applyTransforms, data, getCapabilities, getChartCapability, getPreferenceCapabilities, planChart, recommend, explainChart, contrastRatio, planStyle, resolveTheme, styleCapabilities, themeModes, themePalettes, themePresets, validateThemeContrast, createPreferencesStore, defaultPreferences, normalizePreferences, mergePreferences, validatePreferences, applyPreferencesToSpec, mountChartSettings, annotationPlugin, dataZoomPlugin, dataLabelsPlugin, accessibilityPlugin, getBusinessSchema, inspectDataSchema, validateData, getEditCapabilities, validateEdit, previewEdit, commitPreview, validateRecipe, normalizeProjectCalendar, applyWorkingCalendar, normalizeDependencies, analyzeSchedule, analyzeBurndownSeries, analyzeCapacity, buildCapacityView, buildCumulativeFlowSeries, buildVelocitySeries, buildReleaseForecast, buildRiskMatrixSeries, buildIssueAgingSeries, normalizeLinkedFilters, normalizeLinkedSelection, filterProjectRows, createLinkedProjectState, linkedRecordId };
