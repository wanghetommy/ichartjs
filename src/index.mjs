/**
 * Public iChart.js 2.0 runtime entry point.
 * Exposes chart lifecycle, rendering, interaction, Agent editing, and discovery.
 */
import { normalizeSpec, validateSpec } from './spec.mjs';
import { normalizeData, inspectData, data } from './data.mjs';
import { binData, applyTransforms } from './transforms.mjs';
import { buildScene } from './charts.mjs';
import { CanvasRenderer, SVGRenderer } from './renderer.mjs?runtime=2.0.0-rc.1-i7';
import { resolveTheme } from './theme.mjs';
import { PluginHost, annotationPlugin, dataZoomPlugin, dataLabelsPlugin, accessibilityPlugin } from './plugin.mjs';
import { projectTooltip, rerouteDiagramScene } from './project.mjs';
import { getBusinessSchema, inspectDataSchema } from './schema.mjs';
import { validateData } from './validation.mjs';
import { commitPreview, getEditCapabilities, previewEdit, validateEdit } from './edit.mjs';
import { EditHistory } from './history.mjs';
import { validateRecipe } from './recipes.mjs';
import { EditController } from './edit-controller.mjs';
import { diagramLayoutModes, edgeRoutingModes, normalizeDiagramSpec, validateDiagram, layoutDiagram, routeEdge } from './diagram.mjs';
import { normalizeProjectCalendar, applyWorkingCalendar, normalizeDependencies, analyzeSchedule, analyzeBurndownSeries, analyzeCapacity, buildCapacityView, buildCumulativeFlowSeries, buildVelocitySeries, buildReleaseForecast, buildRiskMatrixSeries, buildIssueAgingSeries } from './project-analytics.mjs';
import { normalizeLinkedFilters, normalizeLinkedSelection, filterProjectRows, createLinkedProjectState, linkedRecordId } from './project-linking.mjs';

import { isDiagram, paintSelection, diagramPointer, diagramKeyboard } from './diagram-interaction.mjs';

function resolveContainer(container) { return typeof container === 'string' ? document.querySelector(container) : container; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
export function resolveZoomWindow(count, current, factor) {
  const total = Math.max(0, Math.round(Number(count) || 0));
  if (total <= 1) return { start: 0, end: total };
  const start = Math.max(0, Math.min(total, Number(current?.start) || 0)), end = Math.max(start, Math.min(total, Number(current?.end) || total));
  const currentSpan = Math.max(2, end - start), nextSpan = Math.max(2, Math.min(total, Math.round(currentSpan * factor)));
  const center = (start + end) / 2;
  const nextStart = Math.max(0, Math.min(total - nextSpan, Math.round(center - nextSpan / 2)));
  return { start: nextStart, end: nextStart + nextSpan };
}

export class Chart {
  constructor(input = {}) { const result = validateSpec(input); if (!result.valid) { const error = new Error(result.errors.map(item => item.message).join(' ')); error.details = result.errors; throw error; } this.spec = result.spec; this.spec.theme = resolveTheme(this.spec.theme); this.container = typeof document === 'undefined' ? null : resolveContainer(this.spec.container); this.listeners = new Map(); this._selected = new Map(); this._clipboard = { nodes: [], edges: [] }; this._history = new EditHistory(); this._revision = 0; this._lastChangeSet = null; this._editor = new EditController(this); this.plugins = new PluginHost(this, this.spec.plugins); this._mountRenderer(); this._observeResize(); this.render(); }
  _mountRenderer() { const rendererType = this.spec.renderer === 'auto' ? 'canvas' : this.spec.renderer; this.renderer = rendererType === 'svg' ? new SVGRenderer(this.spec) : new CanvasRenderer(this.spec); if (this.container && typeof document !== 'undefined') this.renderer.mount(this.container); }
  render() { this.model = buildScene(this.spec); paintSelection(this); this._addInteractionNodes(); this.plugins.beforeRender(this.model); if (this.renderer.container) { this.renderer.resize(this.spec.width, this.spec.height); this.renderer.render(this.model.scene); this._bindEvents(); this._applyAccessibility(); } this.plugins.afterRender(this.model); this.emit('render', { chart: this }); return this; }
  _addInteractionNodes() { if (this.spec.interaction?.crosshair && this.model.state?.plot) { const plot = this.model.state.plot; this.model.scene.add({ id: 'crosshair-x', type: 'line', geometry: { x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height }, style: { stroke: '#64748b', strokeWidth: 1, opacity: 0 }, interactive: false, zIndex: 99 }); this.model.scene.add({ id: 'crosshair-y', type: 'line', geometry: { x1: plot.x, y1: plot.y, x2: plot.x + plot.width, y2: plot.y }, style: { stroke: '#64748b', strokeWidth: 1, opacity: 0 }, interactive: false, zIndex: 99 }); } }
  _observeResize() { if (!this.container || typeof ResizeObserver === 'undefined') return; this._resizeObserver = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect?.width) this.resize(Math.round(rect.width), this.spec.height); }); this._resizeObserver.observe(this.container); }
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
          } else if (dataRef.edgeId || dataRef.from && dataRef.to) {
            element.setAttribute('role', 'img');
            element.setAttribute('aria-label', `Edge from ${dataRef.from} to ${dataRef.to}`);
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
          if (['flow', 'swimlane'].includes(this.spec.type) && this.spec.editing?.enabled && this._selected.size) {
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
  _bindEvents() { if (this._eventsBound || !this.renderer.container) return; const target = this.renderer.svg || this.renderer.canvas; const handler = event => { if (event.type === 'click' && isDiagram(this) && this._suppressDiagramClick) { this._suppressDiagramClick = false; return; } const point = this._eventPoint(event, target), node = this.model.scene.hit(point.x, point.y), dataIndex = node?.dataRef?.dataIndex == null ? undefined : node.dataRef.dataIndex + (this.model.data.viewOffset || 0), datum = node?.dataRef?.datum || (dataIndex === undefined ? undefined : normalizeData(this.spec.data).rows[dataIndex]); const payload = { type: event.type === 'click' ? 'click' : 'hover', chart: this, nativeEvent: event, target: node, dataRef: node?.dataRef ? { ...node.dataRef, dataIndex } : undefined, datum, coordinate: point }; if (payload.type === 'hover') { this._pointer = point; this._updateCrosshair(point.x, point.y); this.emit('hover', payload); } else if (node) { this.emit('click', payload); if (!isDiagram(this)) this.select(node, { additive: Boolean(event.shiftKey || event.metaKey || event.ctrlKey) }); } if (payload.type === 'hover' && this.spec.interaction.tooltip && node) this._showTooltip(payload); };
    const start = event => { if (diagramPointer(this, 'start', event, target)) return; const point = this._eventPoint(event, target), node = this.model.scene.hit(point.x, point.y); target.setPointerCapture?.(event.pointerId); if (this.spec.type === 'flow' && this.spec.interaction?.drag && node?.id?.startsWith('node-')) { this._nodeDrag = { node, point }; return; } if (this.spec.interaction?.brush) this._brushStart = point; else if (this.spec.interaction?.pan) { this._dragStart = point; this.emit('dragstart', { chart: this, coordinate: point, target: node }); } };
    const move = event => { if (diagramPointer(this, 'move', event, target)) return; const point = this._eventPoint(event, target); if (this._brushStart) { this._brushEnd = point; this.emit('brush', { chart: this, start: this._brushStart, end: this._brushEnd }); } if (this._nodeDrag) { const { node, point: previous } = this._nodeDrag, dx = point.x - previous.x, dy = point.y - previous.y; node.geometry.x += dx; node.geometry.y += dy; node.bounds = { ...node.geometry }; const label = this.model.scene.find(`node-label-${node.dataRef.nodeId}`); if (label) { label.geometry.x += dx; label.geometry.y += dy; } const sourceNode = (this.spec.nodes || this.spec.data.nodes || []).find(item => item.id === node.dataRef.nodeId); if (sourceNode) sourceNode.position = { x: node.geometry.x, y: node.geometry.y }; rerouteDiagramScene(this.model.scene); this._nodeDrag.point = point; this.renderer.render(this.model.scene); this.emit('drag', { chart: this, target: node, coordinate: point }); } else if (this._dragStart) { this.panBy({ x: point.x - this._dragStart.x, y: point.y - this._dragStart.y }); this._dragStart = point; } };
    const end = event => { if (diagramPointer(this, 'end', event, target)) return; if (this._brushStart && this._brushEnd) this.selectBox(this._brushStart, this._brushEnd); if (this._nodeDrag) this.emit('dragend', { chart: this, target: this._nodeDrag.node }); if (this._dragStart) this.emit('dragend', { chart: this, coordinate: this._eventPoint(event, target) }); target.releasePointerCapture?.(event.pointerId); this._brushStart = null; this._brushEnd = null; this._dragStart = null; this._nodeDrag = null; this._pinchStart = null; };
    const touchStart = event => { if (isDiagram(this)) return; if (event.touches.length === 1) { const point = this._eventPoint(event.touches[0], target), node = this.model.scene.hit(point.x, point.y); this._touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY }; if (this.spec.type === 'flow' && this.spec.interaction?.drag && node?.id?.startsWith('node-')) this._nodeDrag = { node, point }; } if (event.touches.length === 2) { this._nodeDrag = null; this._pinchStart = this._touchDistance(event); } };
    const touchMove = event => { if (isDiagram(this)) return; event.preventDefault(); if (event.touches.length === 2 && this.spec.interaction?.zoom && this._pinchStart) { const distance = this._touchDistance(event); if (distance) { const factor = this._pinchStart / distance; if (Math.abs(1 - factor) > 0.04) { const count = normalizeData(this.spec.data).rows.length, current = this.spec.view || { start: 0, end: count }; if (count > 1) this.zoomTo(resolveZoomWindow(count, current, factor)); else this.zoomTo({ scale: Math.max(0.5, Math.min(4, (this.spec.view?.scale || 1) / factor)) }); this._pinchStart = distance; } } } else if (event.touches.length === 1 && this._touchStart) { const touch = event.touches[0]; if (this._nodeDrag) move({ clientX: touch.clientX, clientY: touch.clientY }); else if (this.spec.interaction?.pan) { this.panBy({ x: touch.clientX - this._touchStart.x, y: touch.clientY - this._touchStart.y }); this._touchStart = { x: touch.clientX, y: touch.clientY }; } } };
    const touchEnd = () => { this._touchStart = null; this._pinchStart = null; };
    const wheel = event => { if (!this.spec.interaction.zoom) return; event.preventDefault(); if (isDiagram(this)) { this.zoomTo({ scale: Math.max(0.25, Math.min(8, (this.spec.view?.scale || 1) * (event.deltaY > 0 ? 0.9 : 1.1))) }); return; } const count = normalizeData(this.spec.data).rows.length, current = this.spec.view || { start: 0, end: count }; this.zoomTo(resolveZoomWindow(count, current, event.deltaY > 0 ? 1.25 : 0.8)); };
    if (isDiagram(this)) target.style.touchAction = 'none'; target.addEventListener('mousemove', handler); target.addEventListener('click', handler); target.addEventListener('pointerdown', start); target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end); target.addEventListener('pointerleave', event => { if (!this._dragStart && !this._nodeDrag) end(event); }); target.addEventListener('touchstart', touchStart, { passive: false }); target.addEventListener('touchmove', touchMove, { passive: false }); target.addEventListener('touchend', touchEnd); target.addEventListener('wheel', wheel, { passive: false }); this._eventsBound = { target, handler, start, move, end, touchStart, touchMove, touchEnd, wheel }; }
  _touchDistance(event) { if (!event.touches || event.touches.length < 2) return null; const [first, second] = event.touches; return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY); }
  _eventPoint(event, target) { const rect = target.getBoundingClientRect(); return { x: (event.clientX - rect.left) * this.spec.width / (rect.width || this.spec.width), y: (event.clientY - rect.top) * this.spec.height / (rect.height || this.spec.height) }; }
  _updateCrosshair(x, y) { const vertical = this.model.scene.find('crosshair-x'), horizontal = this.model.scene.find('crosshair-y'); if (!vertical || !horizontal) return; vertical.geometry.x1 = vertical.geometry.x2 = x; vertical.style.opacity = 0.7; horizontal.geometry.y1 = horizontal.geometry.y2 = y; horizontal.style.opacity = 0.7; this.renderer.render(this.model.scene); }
  _showTooltip(payload) { if (typeof document === 'undefined' || !this.container || !payload.datum) return; let tip = this._tooltip; if (!tip) { tip = this._tooltip = document.createElement('div'); tip.className = 'ichart-v2-tooltip'; Object.assign(tip.style, { position: 'fixed', pointerEvents: 'none', zIndex: 9999, padding: '8px 10px', background: '#0f172a', color: '#fff', borderRadius: '6px', font: '12px system-ui', maxWidth: 'min(320px, calc(100vw - 24px))', whiteSpace: 'pre-line', boxShadow: '0 4px 12px #0f172a55' }); document.body.appendChild(tip); } const text = ['gantt', 'timeline', 'milestone', 'burndown'].includes(this.spec.type) || ['flow', 'swimlane'].includes(this.spec.type) ? projectTooltip(this.spec.type, payload.datum) : Object.entries(payload.datum).map(([key, value]) => `${key}: ${value}`).join(' · '); tip.textContent = text; const left = Math.min((payload.nativeEvent.clientX || 0) + 12, window.innerWidth - tip.offsetWidth - 12); const top = Math.min((payload.nativeEvent.clientY || 0) + 12, window.innerHeight - tip.offsetHeight - 12); tip.style.left = `${Math.max(12, left)}px`; tip.style.top = `${Math.max(12, top)}px`; }
  on(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); return this; }
  off(type, listener) { this.listeners.get(type)?.delete(listener); return this; }
  emit(type, event) { this.listeners.get(type)?.forEach(listener => listener(event)); }
  update(next = {}) { this._editor.invalidate(); this.spec = normalizeSpec({ ...this.spec, ...next, data: next.data === undefined ? this.spec.data : next.data }); return this.render(); }
  setData(data) { this._editor.invalidate(); this.spec = normalizeSpec({ ...this.spec, data: { values: data } }); return this.render(); }
  resize(width = this.spec.width, height = this.spec.height) { this.spec.width = width; this.spec.height = height; this.render(); this.emit('resize', { chart: this, width, height }); return this; }
  getSpec() { return JSON.parse(JSON.stringify(this.spec)); }
  getState() { return { renderer: this.renderer.constructor.name, width: this.spec.width, height: this.spec.height, dataCount: this.model.data.rows.length, selected: [...this._selected.values()], revision: this._revision, history: this._history.state(), collapsedGroups: this.getCollapsedGroupIds(), clipboard: { nodes: this._clipboard?.nodes?.length || 0, edges: this._clipboard?.edges?.length || 0 }, projectAnalytics: clone(this.model.state?.projectAnalytics || null), linked: clone(this.model.state?.linked || null) }; }
  getProjectAnalytics() { return clone(this.model.state?.projectAnalytics || null); }
  getLinkedState() { return clone(this.model.state?.linked || null); }
  setLinkedFilters(filters = {}) { this.spec.project = { ...(this.spec.project || {}), linked: { ...(this.spec.project?.linked || {}), filters: normalizeLinkedFilters(filters) } }; this.emit('linkedstatechange', { chart: this, linked: this.spec.project.linked }); return this.render(); }
  setLinkedSelection(selection = []) { this.spec.project = { ...(this.spec.project || {}), linked: { ...(this.spec.project?.linked || {}), selection: normalizeLinkedSelection(selection) } }; this.emit('linkedstatechange', { chart: this, linked: this.spec.project.linked }); return this.render(); }
  describe() { return { type: this.spec.type, renderer: this.renderer.constructor.name, dimensions: [this.spec.encoding.x?.field || this.spec.encoding.category?.field], measures: (Array.isArray(this.spec.encoding.y) ? this.spec.encoding.y : [this.spec.encoding.y || this.spec.encoding.value]).filter(Boolean).map(encoding => encoding.field), dataCount: this.model.data.rows.length, theme: this.spec.theme?.name || 'custom', interactions: Object.keys(this.spec.interaction || {}).filter(key => this.spec.interaction[key]) }; }
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
  selectGroup(groupId, options = {}) { return this.selectNodes(this.model.data.rows.filter(row => row.groupId === groupId).map(row => row.id), options); }
  getSelectedNodeIds() { return [...new Set([...this._selected.values()].map(ref => ref?.nodeId).filter(Boolean))]; }
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
  getSelectedData() { const diagram = ['flow', 'swimlane'].includes(this.spec.type), source = diagram ? (this.spec.nodes || this.spec.data?.nodes || []) : normalizeData(this.spec.data).rows, offset = diagram ? 0 : (this.model.data.viewOffset || 0); return [...this._selected.values()].map(ref => diagram ? source.find(row => row.id === ref?.nodeId) : (ref?.dataIndex == null ? ref?.datum : source[ref.dataIndex + offset])).filter(Boolean); }
  clearSelection() { this._selected.clear(); this.render(); this.emit('selectionchange', { chart: this, target: null, selectedData: [] }); return this; }
  getElementAt(x, y) { return this.model.scene.hit(x, y); }
  selectBox(start, end) { const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x), top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y); this._selected.clear(); this.model.scene.walk(node => { node.selected = false; if (!node.dataRef || !node.bounds || !node.interactive || (isDiagram(this) && !node.id.startsWith('node-'))) return; const intersects = node.bounds.x <= right && node.bounds.x + node.bounds.width >= left && node.bounds.y <= bottom && node.bounds.y + node.bounds.height >= top; if (intersects) { node.selected = true; this._selected.set(node.id, node.dataRef); } }); this.emit('selectionchange', { chart: this, selectedData: this.getSelectedData(), box: { start, end } }); this.render(); return this; }
  toDataTable() { return this.model.data.rows.map(row => ({ ...row })); }
  applyPatch(patches = []) { patches.forEach(patch => { const path = patch.path.replace(/^\//, '').split('/'); let target = this.spec; path.slice(0, -1).forEach(key => { target = target[key]; }); if (patch.op === 'remove') delete target[path.at(-1)]; else target[path.at(-1)] = patch.value; }); return this.render(); }
  resetZoom() { delete this.spec.view; return this.render(); }
  zoomTo(view) { this.spec.view = { ...view }; this.emit('zoomchange', { chart: this, view: this.spec.view }); return this.render(); }
  panBy(delta) { const current = this.spec.view || {}; this.spec.view = { ...current, offsetX: (current.offsetX || 0) + (delta.x || 0), offsetY: (current.offsetY || 0) + (delta.y || 0) }; this.emit('zoomchange', { chart: this, view: this.spec.view }); return this.render(); }
  export(options = {}) { const type = options.type || (this.renderer instanceof CanvasRenderer ? 'image/png' : 'image/svg+xml'); if (type === 'application/json' || type === 'json') return JSON.stringify({ version: '2.0', spec: this.getSpec(), state: this.getState() }, null, 2); if (!this.renderer.container) return { valid: false, code: 'HEADLESS_EXPORT_UNSUPPORTED', message: `${type} export requires a mounted renderer.` }; if (this.renderer instanceof CanvasRenderer) return this.renderer.exportImage(type); return this.renderer.exportString(); }
  destroy() { if (this._resizeObserver) this._resizeObserver.disconnect(); if (this._eventsBound) { const { target, handler, start, move, end, touchStart, touchMove, touchEnd, wheel } = this._eventsBound; target.removeEventListener('mousemove', handler); target.removeEventListener('click', handler); target.removeEventListener('pointerdown', start); target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end); target.removeEventListener('touchstart', touchStart); target.removeEventListener('touchmove', touchMove); target.removeEventListener('touchend', touchEnd); target.removeEventListener('wheel', wheel); } const target = this.renderer.svg || this.renderer.canvas; if (this._keyboardHandler) target?.removeEventListener('keydown', this._keyboardHandler); this._tooltip?.remove(); this.plugins.destroy(); this.renderer.destroy(); this.listeners.clear(); this._eventsBound = null; this._selected.clear(); this._clipboard = { nodes: [], edges: [] }; }
}

export function createChart(spec) { return new Chart(spec); }
export function getCapabilities() { return { version: '2.0', chartTypes: ['line', 'area', 'bar', 'column', 'pie', 'scatter', 'funnel', 'gauge', 'heatmap', 'radar', 'gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane'], chartModes: { stack: ['stacked', 'percent'], pie: ['standard', 'donut'], composition: ['multi-series', 'mixed-line-column', 'dual-axis'], transforms: ['bin'] }, projectManagement: ['gantt', 'timeline', 'milestone', 'burndown'], projectIntelligence: { intents: ['schedule', 'milestone', 'progress', 'variance', 'capacity', 'release', 'risk', 'aging', 'workflow', 'responsibility'], views: ['gantt', 'burndown', 'column', 'area', 'scatter', 'bar'], analytics: ['calendar', 'dependency-normalization', 'critical-path', 'slack', 'baseline-actual-variance', 'capacity', 'cumulative-flow', 'velocity', 'release-forecast', 'risk-matrix', 'issue-aging'], linkedState: ['owner', 'status', 'priority', 'sprint', 'label'] }, diagrams: ['flow', 'swimlane'], diagram: { layoutModes: diagramLayoutModes, routingModes: edgeRoutingModes, entities: ['node', 'edge', 'lane', 'group', 'port'], operations: ['moveNode', 'moveNodes', 'resizeNode', 'alignNodes', 'snapNodes', 'moveNodeToLane', 'moveGroup', 'resizeGroup', 'assignNodesToGroup', 'duplicateGroup', 'deleteGroup', 'updateEdge', 'addEdge', 'toggleGroupCollapse', 'duplicateSelection', 'pasteSelection'], validation: ['duplicate-ids', 'missing-endpoints', 'missing-ports', 'missing-lanes'] }, excluded: ['map', '3d'], renderers: ['canvas', 'svg'], interactions: ['hover', 'click', 'tooltip', 'selection', 'crosshair', 'zoom', 'pan', 'drag', 'touch', 'keyboard-edit', 'keyboard-port-connect', 'port-connect', 'copy-paste', 'linked-filter', 'linked-selection'], exports: ['png', 'svg', 'json'], headless: { preview: true, json: true, svg: false, png: false }, data: ['normalize', 'inspect', 'filter', 'sort', 'groupBy', 'sum', 'average', 'topN', 'percentage', 'bin'], editing: { modes: ['preview', 'commit', 'undo', 'redo'], operations: ['updateField', 'updateRecord', 'updateTask', 'shiftTask', 'updateProgress', 'addDependency', 'removeDependency', 'updateMilestone', 'moveNode', 'moveNodes', 'moveNodeToLane', 'resizeNode', 'alignNodes', 'snapNodes', 'moveGroup', 'resizeGroup', 'assignNodesToGroup', 'duplicateGroup', 'deleteGroup', 'updateEdge', 'addEdge', 'toggleGroupCollapse', 'duplicateSelection', 'pasteSelection'], confirmationRequiredByDefault: true, commit: 'local-runtime-host-persistence-required' }, themes: ['light', 'dark', 'contrast'], plugins: true }; }
export function recommend(input, options = {}) { const report = inspectData(input); const intent = options.intent || 'comparison'; const type = intent === 'schedule' || intent === 'variance' ? 'gantt' : intent === 'milestone' ? 'milestone' : intent === 'progress' || intent === 'release' ? 'burndown' : intent === 'capacity' ? 'column' : intent === 'risk' ? 'scatter' : intent === 'aging' ? 'bar' : intent === 'matrix' || intent === 'correlation-grid' ? 'heatmap' : intent === 'multidimensional' || intent === 'profile' ? 'radar' : intent === 'workflow' ? 'flow' : intent === 'responsibility' ? 'swimlane' : intent === 'trend' || report.fields.some(field => field.type === 'temporal') ? 'line' : intent === 'part-to-whole' ? 'pie' : 'bar'; const alternatives = { heatmap: ['scatter', 'column'], radar: ['bar', 'line'], gantt: ['timeline', 'milestone'], milestone: ['timeline', 'gantt'], burndown: ['line', 'gantt'], column: ['bar', 'line'], scatter: ['bar', 'line'], bar: ['column', 'line'], flow: ['swimlane', 'gantt'], swimlane: ['flow', 'gantt'] }; return { primary: type, alternatives: alternatives[type] || (type === 'line' ? ['area', 'bar'] : type === 'pie' ? ['bar', 'column'] : ['column', 'line']), reason: `Selected ${type} for the ${intent} intent and detected fields.`, warnings: report.warnings }; }
export { normalizeSpec, validateSpec, normalizeData, inspectData, binData, applyTransforms, data, getBusinessSchema, inspectDataSchema, validateData, getEditCapabilities, validateEdit, previewEdit, commitPreview, validateRecipe };
export { diagramLayoutModes, edgeRoutingModes, normalizeDiagramSpec, validateDiagram, layoutDiagram, routeEdge };
export { normalizeProjectCalendar, applyWorkingCalendar, normalizeDependencies, analyzeSchedule, analyzeBurndownSeries, analyzeCapacity, buildCapacityView, buildCumulativeFlowSeries, buildVelocitySeries, buildReleaseForecast, buildRiskMatrixSeries, buildIssueAgingSeries };
export { normalizeLinkedFilters, normalizeLinkedSelection, filterProjectRows, createLinkedProjectState, linkedRecordId };

export { resolveTheme, annotationPlugin, dataZoomPlugin, dataLabelsPlugin, accessibilityPlugin };
export const iChart = { version: '2.0.0-rc.1', createChart, inspectData, normalizeData, binData, applyTransforms, normalizeSpec, validateSpec, data, getCapabilities, recommend, resolveTheme, annotationPlugin, dataZoomPlugin, dataLabelsPlugin, accessibilityPlugin, getBusinessSchema, inspectDataSchema, validateData, getEditCapabilities, validateEdit, previewEdit, commitPreview, validateRecipe, normalizeProjectCalendar, applyWorkingCalendar, normalizeDependencies, analyzeSchedule, analyzeBurndownSeries, analyzeCapacity, buildCapacityView, buildCumulativeFlowSeries, buildVelocitySeries, buildReleaseForecast, buildRiskMatrixSeries, buildIssueAgingSeries, normalizeLinkedFilters, normalizeLinkedSelection, filterProjectRows, createLinkedProjectState, linkedRecordId };
