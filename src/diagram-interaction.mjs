/**
 * Diagram pointer, selection, keyboard, and editing interaction helpers.
 * Converts user gestures into validated layout edits and preserves selection.
 */
import { buildScene } from './charts.mjs';

export const isDiagram = chart => ['flow', 'swimlane'].includes(chart.spec.type);

export function paintSelection(chart) {
  for (const [id] of chart._selected) {
    const node = chart.model.scene.find(id);
    if (node) { node.selected = true; chart._selected.set(id, node.dataRef); }
    else chart._selected.delete(id);
  }
  chart.model.scene.walk(node => {
    if (node.selected && node.id.startsWith('node-')) { node.style.stroke = '#f59e0b'; node.style.strokeWidth = 3; }
  });
}

export function diagramPointer(chart, phase, event, target) {
  if (!isDiagram(chart)) return false;
  if (event.type === 'pointerleave') return true;
  const point = chart._eventPoint(event, target);
  if (phase === 'start') {
    if (event.button != null && event.button !== 0) return true;
    if (chart._diagramGesture) return true;
    chart._suppressDiagramClick = false;
    target.focus?.({ preventScroll: true });
    target.setPointerCapture?.(event.pointerId);
    const hit = chart.model.scene.hit(point.x, point.y), additive = Boolean(event.shiftKey || event.ctrlKey || event.metaKey);
    const nodeId = hit?.dataRef?.nodeId, groupId = hit?.dataRef?.groupId;
    if (groupId) chart.selectGroup(groupId, { additive });
    else if (nodeId) {
      if (additive && chart.getSelectedNodeIds().includes(nodeId)) chart.selectNodes(chart.getSelectedNodeIds().filter(id => id !== nodeId));
      else if (additive || !chart.getSelectedNodeIds().includes(nodeId)) chart.selectNodes([nodeId], { additive });
    } else if (!additive) chart.clearSelection();
    const mode = (nodeId || groupId) && chart.spec.interaction?.drag && chart.spec.editing?.enabled ? 'nodes' : !hit && (additive || chart.spec.interaction?.brush) ? 'box' : !hit && chart.spec.interaction?.pan ? 'pan' : 'select';
    const view = chart.model.state.view, positions = {};
    chart.getSelectedNodeIds().forEach(id => {
      const geometry = chart.model.scene.find(`node-${id}`).geometry;
      positions[id] = { x: (geometry.x - view.offsetX) / view.scale, y: (geometry.y - view.offsetY) / view.scale };
    });
    chart._diagramGesture = { mode, point, previous: point, positions, view: { ...view }, pointerId: event.pointerId, revision: chart._revision, additive, selected: chart.getSelectedNodeIds(), moved: false };
    return true;
  }
  const gesture = chart._diagramGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return true;
  if (phase === 'move') {
    if (chart._revision !== gesture.revision) { chart._diagramGesture = null; chart.render(); return true; }
    if (Math.hypot(point.x - gesture.point.x, point.y - gesture.point.y) < 3 && !gesture.moved) return true;
    gesture.moved = true;
    if (gesture.mode === 'nodes') {
      let delta = { x: (point.x - gesture.point.x) / gesture.view.scale, y: (point.y - gesture.point.y) / gesture.view.scale };
      const anchor = Object.values(gesture.positions)[0], grid = chart.spec.diagram?.grid ?? 8;
      if (anchor && chart.spec.diagram?.snap !== false && !event.altKey) delta = { x: Math.round((anchor.x + delta.x) / grid) * grid - anchor.x, y: Math.round((anchor.y + delta.y) / grid) * grid - anchor.y };
      gesture.operations = Object.entries(gesture.positions).map(([nodeId, position]) => ({ op: 'moveNode', nodeId, position: { x: position.x + delta.x, y: position.y + delta.y } }));
      const positions = new Map(gesture.operations.map(operation => [operation.nodeId, operation.position]));
      const nodes = (chart.spec.nodes ?? chart.spec.data.nodes).map(node => positions.has(node.id) ? { ...node, position: positions.get(node.id) } : node);
      chart.model = buildScene({ ...chart.spec, nodes });
      paintSelection(chart);
      if (chart.renderer.container) chart.renderer.render(chart.model.scene);
      chart.emit('drag', { chart, nodeIds: gesture.selected, coordinate: point });
    } else if (gesture.mode === 'box') {
      chart.model.scene.root.children = chart.model.scene.root.children.filter(node => node.id !== 'diagram-selection-box');
      chart.model.scene.add({ id: 'diagram-selection-box', type: 'rect', geometry: { x: Math.min(point.x, gesture.point.x), y: Math.min(point.y, gesture.point.y), width: Math.abs(point.x - gesture.point.x), height: Math.abs(point.y - gesture.point.y) }, style: { fill: '#93c5fd', stroke: '#2563eb', opacity: 0.25 }, zIndex: 100 });
      if (chart.renderer.container) chart.renderer.render(chart.model.scene);
    } else if (gesture.mode === 'pan') chart.panBy({ x: point.x - gesture.previous.x, y: point.y - gesture.previous.y });
    gesture.previous = point;
    return true;
  }
  chart._diagramGesture = null;
  chart._suppressDiagramClick = gesture.moved;
  if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
  const cancelled = event.type === 'pointercancel' || chart._revision !== gesture.revision;
  chart.render();
  if (!cancelled && gesture.moved && gesture.mode === 'nodes' && gesture.operations?.length) {
    const preview = chart.previewEdit({ type: 'layout-edit', reason: 'Drag diagram selection', operations: gesture.operations });
    if (preview.requiresConfirmation) chart.emit('editrequest', { chart, preview, source: 'pointer' });
    else chart.applyEdit(preview.command, { preview, source: 'pointer' });
  } else if (!cancelled && gesture.moved && gesture.mode === 'box') {
    chart.selectBox(gesture.point, point);
    if (gesture.additive) chart.selectNodes(gesture.selected, { additive: true });
  }
  chart.emit('dragend', { chart, cancelled, nodeIds: gesture.selected });
  return true;
}

export function diagramKeyboard(chart, event) {
  if (!isDiagram(chart)) return false;
  const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
  if (key === 'escape') { chart._diagramGesture = null; chart.clearSelection(); event.preventDefault(); return true; }
  if (modifier && key === 'a') { chart.selectNodes(chart.model.data.rows.map(row => row.id)); event.preventDefault(); return true; }
  if (modifier && ['z', 'y'].includes(key) && chart.spec.editing?.enabled) { chart[key === 'y' || event.shiftKey ? 'redo' : 'undo'](); event.preventDefault(); return true; }
  if (['tab', 'enter', ' '].includes(key)) {
    const nodes = chart.model.data.rows, step = event.shiftKey ? -1 : 1;
    if (!nodes.length) return true;
    if (key === 'tab') chart._diagramFocus = ((chart._diagramFocus ?? (step > 0 ? -1 : 0)) + step + nodes.length) % nodes.length;
    chart.selectNodes([nodes[chart._diagramFocus ?? 0].id], { additive: key === ' ' && event.shiftKey });
    if (key !== 'tab') event.preventDefault();
    return true;
  }
  if (!['arrowright', 'arrowleft', 'arrowup', 'arrowdown'].includes(key)) return false;
  if (chart.spec.editing?.enabled && chart.getSelectedNodeIds().length) {
    const step = event.shiftKey ? 10 : 1, delta = { x: key === 'arrowright' ? step : key === 'arrowleft' ? -step : 0, y: key === 'arrowdown' ? step : key === 'arrowup' ? -step : 0 };
    const preview = chart.previewEdit({ type: 'layout-edit', reason: 'Keyboard move', operations: [{ op: 'moveNodes', nodeIds: chart.getSelectedNodeIds(), delta }] });
    if (preview.requiresConfirmation) chart.emit('editrequest', { chart, preview, source: 'keyboard' });
    else chart.applyEdit(preview.command, { preview, source: 'keyboard' });
  } else {
    const nodes = chart.model.data.rows;
    if (nodes.length) { const step = ['arrowright', 'arrowdown'].includes(key) ? 1 : -1; chart._diagramFocus = ((chart._diagramFocus ?? -1) + step + nodes.length) % nodes.length; chart.selectNodes([nodes[chart._diagramFocus].id]); }
  }
  event.preventDefault();
  return true;
}
