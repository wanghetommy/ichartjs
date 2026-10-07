/**
 * Diagram pointer, selection, keyboard, and editing interaction helpers.
 * Converts user gestures into validated layout and structure edits.
 */
import { buildScene } from './charts.mjs';
import { diagramConnectionPoints } from './diagram.mjs';

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

function snapConnectedPorts(gesture, rawDelta, gridDelta) {
  const candidates = { x: null, y: null };
  for (const connection of gesture.connections) {
    const movingFrom = Boolean(gesture.positions[connection.from]);
    const movingTo = Boolean(gesture.positions[connection.to]);
    if (movingFrom === movingTo) continue;
    const fromBox = gesture.boxes[connection.from], toBox = gesture.boxes[connection.to];
    if (!fromBox || !toBox) continue;
    const moved = box => ({ ...box, x: box.x + rawDelta.x, y: box.y + rawDelta.y });
    const from = movingFrom ? moved(fromBox) : fromBox, to = movingTo ? moved(toBox) : toBox;
    const { start, end } = diagramConnectionPoints(from, to, connection.fromPortDefinition, connection.toPortDefinition);
    const deltaX = to.x + to.width / 2 - from.x - from.width / 2;
    const deltaY = to.y + to.height / 2 - from.y - from.height / 2;
    const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
    const fromSide = connection.fromPortDefinition?.side || (horizontal ? (deltaX >= 0 ? 'right' : 'left') : (deltaY >= 0 ? 'bottom' : 'top'));
    const toSide = connection.toPortDefinition?.side || (horizontal ? (deltaX >= 0 ? 'left' : 'right') : (deltaY >= 0 ? 'top' : 'bottom'));
    const facingHorizontally = fromSide === 'right' && toSide === 'left' && start.x < end.x || fromSide === 'left' && toSide === 'right' && start.x > end.x;
    const facingVertically = fromSide === 'bottom' && toSide === 'top' && start.y < end.y || fromSide === 'top' && toSide === 'bottom' && start.y > end.y;
    const axis = facingHorizontally ? 'y' : facingVertically ? 'x' : null;
    if (!axis) continue;
    const correction = movingFrom ? end[axis] - start[axis] : start[axis] - end[axis];
    const distance = Math.abs(correction);
    if (distance > gesture.snapTolerance[axis] || candidates[axis] && distance >= candidates[axis].distance) continue;
    candidates[axis] = { distance, delta: rawDelta[axis] + correction, edgeId: connection.edgeId };
  }
  return {
    delta: { x: candidates.x?.delta ?? gridDelta.x, y: candidates.y?.delta ?? gridDelta.y },
    guides: Object.entries(candidates).filter(([, candidate]) => candidate).map(([axis, candidate]) => ({ axis, edgeId: candidate.edgeId }))
  };
}

function paintAlignmentGuides(chart, guides) {
  for (const guide of guides) {
    const edge = edgeNode(chart, guide.edgeId), points = edge?.geometry?.points;
    if (!points?.length) continue;
    const start = points[0], end = points[points.length - 1];
    if (Math.abs(start[guide.axis] - end[guide.axis]) > 1e-7) continue;
    chart.model.scene.add({ id: `diagram-align-guide-${guide.axis}`, type: 'path', geometry: { points: [start, end] }, style: { fill: 'none', stroke: chart.spec.theme?.selection || '#2563eb', strokeWidth: 1, lineDash: [4, 4], opacity: 0.6 }, zIndex: 100 });
  }
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
    points.slice(1, -1).forEach((point, offset) => chart.model.scene.add({ id: `edge-handle-waypoint-${edge.id}-${offset + 1}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 5 }, bounds: { x: point.x - 8, y: point.y - 8, width: 16, height: 16 }, style: { fill: chart.spec.theme?.background || '#fff', stroke: chart.spec.theme?.selection || '#2563eb', strokeWidth: 2 }, dataRef: { edgeId, edgeHandle: 'waypoint', pointIndex: offset + 1, diagramPoints: edge.dataRef.diagramPoints, routePoints: points.map(value => ({ x: value.x, y: value.y })) }, interactive: true, zIndex: 102 }));
    points.forEach((point, index) => {
      if (index === 0 || index >= points.length - 2) return;
      const next = points[index + 1], orthogonal = point.x === next.x || point.y === next.y;
      if (!orthogonal) return;
      const middle = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
      chart.model.scene.add({ id: `edge-handle-segment-${edge.id}-${index}`, type: 'rect', geometry: { x: middle.x - 5, y: middle.y - 5, width: 10, height: 10 }, bounds: { x: middle.x - 8, y: middle.y - 8, width: 16, height: 16 }, style: { fill: chart.spec.theme?.selection || '#2563eb', stroke: chart.spec.theme?.background || '#fff', strokeWidth: 1 }, dataRef: { edgeId, edgeHandle: 'segment', segmentIndex: index, diagramPoints: edge.dataRef.diagramPoints, routePoints: points.map(value => ({ x: value.x, y: value.y })) }, interactive: true, zIndex: 103 });
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
    const view = chart.model.state.view, positions = {}, boxes = {}, connections = [];
    const declaredNodes = new Map(chart.getDiagramNodes().map(node => [node.id, node])), selectedIds = new Set(chart.getSelectedNodeIds());
    chart.model.scene.walk(node => {
      if (node.id.startsWith('node-') && node.visible && node.bounds) {
        const id = node.dataRef?.nodeId, declared = declaredNodes.get(id), bounds = node.bounds;
        if (!declared) return;
        boxes[id] = { x: declared.position?.x ?? (bounds.x - view.offsetX) / view.scale, y: declared.position?.y ?? (bounds.y - view.offsetY) / view.scale, width: bounds.width / view.scale, height: bounds.height / view.scale };
      }
    });
    for (const id of selectedIds) if (boxes[id]) positions[id] = { x: boxes[id].x, y: boxes[id].y };
    chart.model.scene.walk(node => {
      const reference = node.dataRef;
      if (reference?.edgeId && !reference.edgeHandle && reference.requestedRoutingMode === 'auto' && reference.routingMode === 'auto' && ['auto', 'orthogonal'].includes(reference.routing) && boxes[reference.from] && boxes[reference.to]) connections.push(reference);
    });
    const rect = target.getBoundingClientRect?.();
    const snapTolerance = { x: 6 / (view.scale * ((rect?.width || chart.spec.width) / chart.spec.width)), y: 6 / (view.scale * ((rect?.height || chart.spec.height) / chart.spec.height)) };
    chart._diagramGesture = { mode, point, previous: point, positions, boxes, connections, snapTolerance, model: chart.model, view: { ...view }, pointerId: event.pointerId, revision: chart._revision, additive, selected: chart.getSelectedNodeIds(), moved: false, hitId: hit?.id, groupId, nodeId, portId, edgeId, edgeHandle, pointIndex: hit?.dataRef?.pointIndex, segmentIndex: hit?.dataRef?.segmentIndex, diagramPoints: hit?.dataRef?.diagramPoints?.map(value => ({ ...value })), routePoints: hit?.dataRef?.routePoints?.map(value => ({ ...value })) };
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
      const toDiagram = value => ({ x: (value.x - gesture.view.offsetX) / gesture.view.scale, y: (value.y - gesture.view.offsetY) / gesture.view.scale });
      const grid = chart.spec.diagram?.grid ?? 8, position = toDiagram(point), snapped = chart.spec.diagram?.snap === false || event.altKey ? position : { x: Math.round(position.x / grid) * grid, y: Math.round(position.y / grid) * grid }, routePoints = gesture.diagramPoints ? gesture.diagramPoints.map(value => ({ ...value })) : gesture.routePoints.map(toDiagram);
      if (gesture.edgeHandle === 'waypoint') {
        const index = gesture.pointIndex, current = routePoints[index], previous = routePoints[index - 1], next = routePoints[index + 1];
        const orthogonal = routePoints.every((value, pointIndex) => !pointIndex || value.x === routePoints[pointIndex - 1].x || value.y === routePoints[pointIndex - 1].y);
        if (orthogonal) {
          if (index === 1) { if (previous.x === current.x) snapped.x = previous.x; else snapped.y = previous.y; }
          if (index === routePoints.length - 2) { if (next.x === current.x) snapped.x = next.x; else snapped.y = next.y; }
          if (index > 1) { if (previous.x === current.x) previous.x = snapped.x; else previous.y = snapped.y; }
          if (index < routePoints.length - 2) { if (next.x === current.x) next.x = snapped.x; else next.y = snapped.y; }
        }
        routePoints[index] = snapped;
      }
      else {
        const first = routePoints[gesture.segmentIndex], second = routePoints[gesture.segmentIndex + 1];
        if (first.x === second.x) first.x = second.x = snapped.x;
        else first.y = second.y = snapped.y;
      }
      gesture.waypoints = routePoints.slice(1, -1);
      const edges = chart.getDiagramEdges().map((edge, index) => (edge.id || `edge-${index}`) === gesture.edgeId ? { ...edge, routingMode: 'manual', waypoints: gesture.waypoints } : edge);
      const model = buildScene({ ...chart.spec, edges });
      const warning = model.state.routingWarnings?.find(item => item.edgeId === gesture.edgeId && item.code === 'EDGE_MANUAL_ROUTE_INVALID');
      gesture.routeError = warning ? { ...warning, message: `Manual connector edit rejected (${warning.reason}); the previously committed route is unchanged.` } : null;
      if (gesture.routeError) chart.render();
      else {
        chart.model = model;
        paintSelection(chart);
        if (chart.renderer.container) chart.renderer.render(chart.model.scene);
      }
      chart.emit('drag', { chart, edgeId: gesture.edgeId, waypoints: gesture.waypoints, coordinate: point, valid: !gesture.routeError, errors: gesture.routeError ? [gesture.routeError] : [] });
    } else if (gesture.mode === 'nodes') {
      const rawDelta = { x: (point.x - gesture.point.x) / gesture.view.scale, y: (point.y - gesture.point.y) / gesture.view.scale };
      let delta = rawDelta, guides = [];
      const anchor = Object.values(gesture.positions)[0], grid = chart.spec.diagram?.grid ?? 8;
      if (anchor && chart.spec.diagram?.snap !== false && !event.altKey) {
        const snapped = snapConnectedPorts(gesture, rawDelta, { x: Math.round((anchor.x + delta.x) / grid) * grid - anchor.x, y: Math.round((anchor.y + delta.y) / grid) * grid - anchor.y });
        delta = snapped.delta;
        guides = snapped.guides;
      }
      gesture.operations = Object.entries(gesture.positions).map(([nodeId, position]) => ({ op: 'moveNode', nodeId, position: { x: position.x + delta.x, y: position.y + delta.y } }));
      const positions = new Map(gesture.operations.map(operation => [operation.nodeId, operation.position]));
      const nodes = (chart.spec.nodes ?? chart.spec.data.nodes).map(node => positions.has(node.id) ? { ...node, position: positions.get(node.id) } : node);
      const { preview } = chart._editor.prepare({ type: 'layout-edit', operations: gesture.operations }, gesture.model);
      let spec = { ...chart.spec, nodes };
      if (preview.valid) Object.entries(preview.targets).forEach(([field, rows]) => { spec = spec[field] !== undefined ? { ...spec, [field]: rows } : { ...spec, data: { ...spec.data, [field]: rows } }; });
      chart.model = buildScene(spec);
      paintSelection(chart);
      paintAlignmentGuides(chart, guides);
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
    if (gesture.routeError) chart.emit('editerror', { chart, result: { valid: false, errors: [gesture.routeError], warnings: [] }, source: 'pointer' });
    else {
      const preview = chart.previewEdit({ type: 'layout-edit', reason: 'Drag diagram edge handle', operations: [{ op: 'updateEdge', edgeId: gesture.edgeId, changes: { routingMode: 'manual', waypoints: gesture.waypoints } }] });
      if (preview.requiresConfirmation) chart.emit('editrequest', { chart, preview, source: 'pointer' });
      else chart.applyEdit(preview.command, { preview, source: 'pointer', confirmed: true });
    }
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
