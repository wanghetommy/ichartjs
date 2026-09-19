/**
 * Diagram pointer, selection, keyboard, and editing interaction helpers.
 * Converts user gestures into validated layout and structure edits.
 */
import { buildScene } from './charts.mjs';

export const isDiagram = chart => ['flow', 'swimlane', 'architecture', 'mindmap'].includes(chart.spec.type);

function focusableNodes(chart) {
  const items = [];
  chart.model.scene.walk(node => {
    if (!node.interactive) return;
    if (!/^node-|^group-|^port-|^edge-/.test(node.id) || node.dataRef?.edgeHandle) return;
    items.push(node);
  });
  return items;
}

function edgeNode(chart, edgeId) {
  let found = null;
  chart.model.scene.walk(node => { if (!found && node.dataRef?.edgeId === edgeId && !node.dataRef?.edgeHandle) found = node; });
  return found;
}

function center(node) {
  if (node.geometry?.cx != null && node.geometry?.cy != null) return { x: node.geometry.cx, y: node.geometry.cy };
  return { x: node.bounds?.x + node.bounds?.width / 2 || node.geometry?.x || 0, y: node.bounds?.y + node.bounds?.height / 2 || node.geometry?.y || 0 };
}

function clearConnectPreview(chart) {
  chart.model.scene.root.children = chart.model.scene.root.children.filter(node => node.id !== 'diagram-connect-preview');
}

function paintConnectPreview(chart, start, end) {
  clearConnectPreview(chart);
  chart.model.scene.add({ id: 'diagram-connect-preview', type: 'path', geometry: { points: [start, end] }, style: { fill: 'none', stroke: '#2563eb', strokeWidth: 2, opacity: 0.65 }, zIndex: 101 });
  if (chart.renderer.container) chart.renderer.render(chart.model.scene);
}

export function paintSelection(chart) {
  const selected = new Map();
  for (const [id, reference] of chart._selected) {
    const node = reference?.edgeId ? edgeNode(chart, reference.edgeId) : chart.model.scene.find(id);
    if (node) { node.selected = true; selected.set(node.id, node.dataRef); }
  }
  chart._selected = selected;
  const selectedEdges = [];
  chart.model.scene.walk(node => {
    if (node.id === chart._diagramFocusTarget) node.highlighted = true;
    if (node.selected && node.id.startsWith('node-')) { node.style.stroke = '#f59e0b'; node.style.strokeWidth = 3; }
    if (node.selected && node.id.startsWith('group-')) { node.style.stroke = '#2563eb'; node.style.strokeWidth = 2; }
    if (node.selected && node.dataRef?.edgeId) { node.style.stroke = chart.spec.theme?.selection || '#2563eb'; node.style.strokeWidth = Math.max(3, Number(node.style.strokeWidth) || 1); selectedEdges.push(node); }
  });
  if (chart.spec.editing?.enabled !== true || chart.spec.interaction?.edgeDrag !== true) return;
  selectedEdges.forEach(edge => {
    if (edge.geometry?.curve === 'cubic') return;
    const points = edge.geometry?.points || [], edgeId = edge.dataRef.edgeId;
    points.slice(1, -1).forEach((point, offset) => chart.model.scene.add({ id: `edge-handle-waypoint-${edge.id}-${offset + 1}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 5 }, bounds: { x: point.x - 8, y: point.y - 8, width: 16, height: 16 }, style: { fill: chart.spec.theme?.background || '#fff', stroke: chart.spec.theme?.selection || '#2563eb', strokeWidth: 2 }, dataRef: { edgeId, edgeHandle: 'waypoint', pointIndex: offset + 1, routePoints: points.map(value => ({ x: value.x, y: value.y })) }, interactive: true, zIndex: 102 }));
    points.forEach((point, index) => {
      if (index === 0 || index >= points.length - 2) return;
      const next = points[index + 1], orthogonal = point.x === next.x || point.y === next.y;
      if (!orthogonal) return;
      const middle = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
      chart.model.scene.add({ id: `edge-handle-segment-${edge.id}-${index}`, type: 'rect', geometry: { x: middle.x - 5, y: middle.y - 5, width: 10, height: 10 }, bounds: { x: middle.x - 8, y: middle.y - 8, width: 16, height: 16 }, style: { fill: chart.spec.theme?.selection || '#2563eb', stroke: chart.spec.theme?.background || '#fff', strokeWidth: 1 }, dataRef: { edgeId, edgeHandle: 'segment', segmentIndex: index, routePoints: points.map(value => ({ x: value.x, y: value.y })) }, interactive: true, zIndex: 103 });
    });
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
    const nodeId = hit?.dataRef?.nodeId, groupId = hit?.dataRef?.groupId, portId = hit?.dataRef?.portId, edgeId = hit?.dataRef?.edgeId, edgeHandle = hit?.dataRef?.edgeHandle;
    if (edgeId) chart.selectEdges([edgeId], { additive: edgeHandle ? true : additive });
    else if (groupId && !nodeId) chart.selectGroup(groupId, { additive });
    else if (nodeId) {
      if (additive && chart.getSelectedNodeIds().includes(nodeId)) chart.selectNodes(chart.getSelectedNodeIds().filter(id => id !== nodeId));
      else if (additive || !chart.getSelectedNodeIds().includes(nodeId)) chart.selectNodes([nodeId], { additive });
    } else if (!additive) chart.clearSelection();
    const mode = edgeHandle && chart.spec.editing?.enabled && chart.spec.interaction?.edgeDrag ? 'edge-handle' : portId && chart.spec.editing?.enabled && chart.spec.interaction?.portConnect ? 'connect' : nodeId && chart.spec.interaction?.drag && chart.spec.editing?.enabled ? 'nodes' : !hit && (additive || chart.spec.interaction?.brush) ? 'box' : !hit && chart.spec.interaction?.pan ? 'pan' : groupId ? 'group' : 'select';
    const view = chart.model.state.view, positions = {};
    chart.getSelectedNodeIds().forEach(id => {
      const geometry = chart.model.scene.find(`node-${id}`)?.geometry;
      if (!geometry) return;
      positions[id] = { x: (geometry.x - view.offsetX) / view.scale, y: (geometry.y - view.offsetY) / view.scale };
    });
    chart._diagramGesture = { mode, point, previous: point, positions, view: { ...view }, pointerId: event.pointerId, revision: chart._revision, additive, selected: chart.getSelectedNodeIds(), moved: false, hitId: hit?.id, groupId, nodeId, portId, edgeId, edgeHandle, pointIndex: hit?.dataRef?.pointIndex, segmentIndex: hit?.dataRef?.segmentIndex, routePoints: hit?.dataRef?.routePoints?.map(value => ({ ...value })) };
    if (mode === 'connect' && hit) paintConnectPreview(chart, center(hit), point);
    return true;
  }
  const gesture = chart._diagramGesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return true;
  if (phase === 'move') {
    if (chart._revision !== gesture.revision) { chart._diagramGesture = null; chart.render(); return true; }
    if (Math.hypot(point.x - gesture.point.x, point.y - gesture.point.y) < 3 && !gesture.moved) return true;
    gesture.moved = true;
    if (gesture.mode === 'connect') {
      const source = chart.model.scene.find(gesture.hitId);
      if (source) {
        paintConnectPreview(chart, center(source), point);
        chart.emit('connectionpreview', { chart, source: source.dataRef, coordinate: point });
      }
    } else if (gesture.mode === 'edge-handle') {
      const grid = chart.spec.diagram?.grid ?? 8, snapped = chart.spec.diagram?.snap === false || event.altKey ? point : { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid }, routePoints = gesture.routePoints.map(value => ({ ...value }));
      if (gesture.edgeHandle === 'waypoint') routePoints[gesture.pointIndex] = snapped;
      else {
        const first = routePoints[gesture.segmentIndex], second = routePoints[gesture.segmentIndex + 1];
        if (first.x === second.x) first.x = second.x = snapped.x;
        else first.y = second.y = snapped.y;
      }
      gesture.waypoints = routePoints.slice(1, -1);
      const edges = chart.getDiagramEdges().map((edge, index) => (edge.id || `edge-${index}`) === gesture.edgeId ? { ...edge, waypoints: gesture.waypoints } : edge);
      chart.model = buildScene({ ...chart.spec, edges });
      paintSelection(chart);
      if (chart.renderer.container) chart.renderer.render(chart.model.scene);
      chart.emit('drag', { chart, edgeId: gesture.edgeId, waypoints: gesture.waypoints, coordinate: point });
    } else if (gesture.mode === 'nodes') {
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
  if (gesture.mode === 'connect') clearConnectPreview(chart);
  chart.render();
  if (!cancelled && gesture.moved && gesture.mode === 'nodes' && gesture.operations?.length) {
    const preview = chart.previewEdit({ type: 'layout-edit', reason: 'Drag diagram selection', operations: gesture.operations });
    if (preview.requiresConfirmation) chart.emit('editrequest', { chart, preview, source: 'pointer' });
    else chart.applyEdit(preview.command, { preview, source: 'pointer', confirmed: true });
  } else if (!cancelled && gesture.moved && gesture.mode === 'edge-handle' && gesture.waypoints) {
    const preview = chart.previewEdit({ type: 'layout-edit', reason: 'Drag diagram edge handle', operations: [{ op: 'updateEdge', edgeId: gesture.edgeId, changes: { waypoints: gesture.waypoints } }] });
    if (preview.requiresConfirmation) chart.emit('editrequest', { chart, preview, source: 'pointer' });
    else chart.applyEdit(preview.command, { preview, source: 'pointer', confirmed: true });
  } else if (!cancelled && gesture.moved && gesture.mode === 'box') {
    chart.selectBox(gesture.point, point);
    if (gesture.additive) chart.selectNodes(gesture.selected, { additive: true });
  } else if (!cancelled && gesture.mode === 'connect') {
    const hit = chart.model.scene.hit(point.x, point.y), targetNodeId = hit?.dataRef?.nodeId, targetPortId = hit?.dataRef?.portId;
    if (targetNodeId && targetNodeId !== gesture.nodeId) chart.connectNodes({ from: gesture.nodeId, to: targetNodeId, ...(gesture.portId ? { fromPort: gesture.portId } : {}), ...(targetPortId ? { toPort: targetPortId } : {}) }, { confirmed: true, source: 'pointer' });
    else chart.emit('connectioncancel', { chart, sourceNodeId: gesture.nodeId, sourcePortId: gesture.portId });
  } else if (!cancelled && !gesture.moved && gesture.mode === 'group' && gesture.groupId) chart.toggleGroupCollapse(gesture.groupId, { confirmed: true, source: 'pointer' });
  chart.emit('dragend', { chart, cancelled, nodeIds: gesture.selected });
  return true;
}

export function diagramKeyboard(chart, event) {
  if (!isDiagram(chart)) return false;
  const modifier = event.ctrlKey || event.metaKey, key = event.key.toLowerCase(), nodes = focusableNodes(chart);
  if (key === 'escape') {
    chart._diagramGesture = null;
    if (chart._keyboardConnection) {
      const source = chart._keyboardConnection;
      chart._keyboardConnection = null;
      clearConnectPreview(chart);
      chart.render();
      chart.emit('connectioncancel', { chart, sourceNodeId: source.nodeId, sourcePortId: source.portId, source: 'keyboard' });
    } else chart.clearSelection();
    event.preventDefault();
    return true;
  }
  if (modifier && key === 'a') { chart.selectNodes(chart.model.data.rows.map(row => row.id)); event.preventDefault(); return true; }
  if (modifier && key === 'c') { chart.copySelection(); event.preventDefault(); return true; }
  if (modifier && key === 'v') { chart.pasteSelection({ confirmed: true, source: 'keyboard' }); event.preventDefault(); return true; }
  if (modifier && key === 'd') { chart.duplicateSelection({ confirmed: true, source: 'keyboard' }); event.preventDefault(); return true; }
  if (modifier && ['z', 'y'].includes(key) && chart.spec.editing?.enabled) { chart[key === 'y' || event.shiftKey ? 'redo' : 'undo'](); event.preventDefault(); return true; }
  if (['delete', 'backspace'].includes(key) && chart.spec.editing?.enabled && chart.spec.editing?.allowDelete && chart.getSelectedEdgeIds().length) { chart.deleteSelectedEdges({ confirmed: true, source: 'keyboard' }); event.preventDefault(); return true; }
  if (['tab', 'enter', ' '].includes(key)) {
    const step = event.shiftKey ? -1 : 1;
    if (!nodes.length) return true;
    if (key === 'tab') chart._diagramFocus = ((chart._diagramFocus ?? (step > 0 ? -1 : 0)) + step + nodes.length) % nodes.length;
    const target = nodes[chart._diagramFocus ?? 0];
    chart._diagramFocusTarget = target?.id;
    if (target?.id?.startsWith('node-')) chart.selectNodes([target.dataRef.nodeId], { additive: key === ' ' && event.shiftKey });
    else if (target?.id?.startsWith('group-')) chart.selectGroup(target.dataRef.groupId, { additive: key === ' ' && event.shiftKey });
    else if (target?.id?.startsWith('port-') && target.dataRef?.nodeId) chart.selectNodes([target.dataRef.nodeId], { additive: key === ' ' && event.shiftKey });
    else if (target?.dataRef?.edgeId) chart.selectEdges([target.dataRef.edgeId], { additive: key === ' ' && event.shiftKey });
    if (chart._keyboardConnection && target) {
      const source = chart.model.scene.find(chart._keyboardConnection.targetId);
      if (source) paintConnectPreview(chart, center(source), center(target));
      chart.emit('connectionpreview', { chart, source: chart._keyboardConnection, target: target.dataRef, sourceType: 'keyboard' });
    }
    if (key !== 'tab') {
      if (target?.id?.startsWith('port-') && chart.spec.editing?.enabled && chart.spec.interaction?.portConnect) {
        if (!chart._keyboardConnection) {
          chart._keyboardConnection = { nodeId: target.dataRef.nodeId, portId: target.dataRef.portId, targetId: target.id };
          paintConnectPreview(chart, center(target), center(target));
          chart.emit('connectionpreview', { chart, source: chart._keyboardConnection, target: null, sourceType: 'keyboard' });
        } else if (target.dataRef.nodeId !== chart._keyboardConnection.nodeId) {
          const source = chart._keyboardConnection;
          chart._keyboardConnection = null;
          clearConnectPreview(chart);
          chart.connectNodes({ from: source.nodeId, to: target.dataRef.nodeId, fromPort: source.portId, toPort: target.dataRef.portId }, { confirmed: true, source: 'keyboard' });
        }
      } else if (target?.id?.startsWith('group-') && chart.spec.editing?.enabled && !chart._keyboardConnection) chart.toggleGroupCollapse(target.dataRef.groupId, { confirmed: true, source: 'keyboard' });
      event.preventDefault();
    }
    return true;
  }
  if (!['arrowright', 'arrowleft', 'arrowup', 'arrowdown'].includes(key)) return false;
  if (chart.spec.editing?.enabled && chart.getSelectedNodeIds().length) {
    const step = event.shiftKey ? 10 : 1, delta = { x: key === 'arrowright' ? step : key === 'arrowleft' ? -step : 0, y: key === 'arrowdown' ? step : key === 'arrowup' ? -step : 0 };
    const preview = chart.previewEdit({ type: 'layout-edit', reason: 'Keyboard move', operations: [{ op: 'moveNodes', nodeIds: chart.getSelectedNodeIds(), delta }] });
    if (preview.requiresConfirmation) chart.emit('editrequest', { chart, preview, source: 'keyboard' });
    else chart.applyEdit(preview.command, { preview, source: 'keyboard', confirmed: true });
  } else if (nodes.length) {
    const step = ['arrowright', 'arrowdown'].includes(key) ? 1 : -1;
    chart._diagramFocus = ((chart._diagramFocus ?? -1) + step + nodes.length) % nodes.length;
    const target = nodes[chart._diagramFocus];
    chart._diagramFocusTarget = target.id;
    if (target.id.startsWith('node-')) chart.selectNodes([target.dataRef.nodeId]);
    else if (target.id.startsWith('group-')) chart.selectGroup(target.dataRef.groupId);
    else if (target.dataRef?.edgeId) chart.selectEdges([target.dataRef.edgeId]);
  }
  event.preventDefault();
  return true;
}
