/**
 * Diagram data model, validation, deterministic layout, and edge routing.
 * Supports nodes, edges, lanes, flat groups, ports, and 2D routing modes.
 */
import { copyJSON } from './schema.mjs';
import { sampleCubicBezier } from './scene.mjs';

export const diagramLayoutModes = ['manual', 'layered', 'tree', 'radial'];
export const edgeRoutingModes = ['straight', 'orthogonal', 'curved'];
export const diagramModes = ['process', 'architecture', 'mindmap'];

const finite = value => typeof value === 'number' && Number.isFinite(value);

export function normalizeDiagramSpec(spec = {}) {
  const data = spec.data || {};
  const nodes = copyJSON(spec.nodes ?? data.nodes ?? data.values ?? []);
  const explicitEdges = copyJSON(spec.edges ?? data.edges ?? []);
  const generatedEdges = spec.type === 'mindmap'
    ? nodes.filter(node => node?.parentId).map((node, index) => ({ id: `parent-${node.parentId}-${node.id || index}`, from: node.parentId, to: node.id, relation: 'parent-child' }))
    : [];
  const edgeKeys = new Set(explicitEdges.map(edge => `${edge.from}->${edge.to}`));
  const edges = [...explicitEdges, ...generatedEdges.filter(edge => !edgeKeys.has(`${edge.from}->${edge.to}`))];
  const lanes = copyJSON(spec.lanes ?? data.lanes ?? []);
  const mode = spec.diagram?.mode || (spec.type === 'architecture' ? 'architecture' : spec.type === 'mindmap' ? 'mindmap' : 'process');
  const defaultLayout = mode === 'mindmap' ? 'tree' : 'layered';
  const defaultRouting = mode === 'mindmap' ? 'curved' : 'orthogonal';
  return { ...copyJSON(spec), nodes, edges, lanes, layers: copyJSON(spec.layers ?? data.layers ?? []), boundaries: copyJSON(spec.boundaries ?? data.boundaries ?? []), groups: copyJSON(spec.groups ?? data.groups ?? []), diagram: { layout: spec.diagram?.layout || defaultLayout, routing: spec.diagram?.routing || defaultRouting, curveTension: spec.diagram?.curveTension ?? 0.4, mode, snap: spec.diagram?.snap ?? true, grid: spec.diagram?.grid ?? 8 } };
}

export function validateDiagram(spec = {}) {
  const errors = [], normalized = normalizeDiagramSpec(spec), nodes = normalized.nodes, edges = normalized.edges, lanes = normalized.lanes, layers = normalized.layers;
  const nodeIds = new Set(), laneIds = new Set(lanes.map(lane => lane.id));
  const groupIds = new Set();
  const layerIds = new Set(layers.map(layer => layer.id));
  if (!diagramModes.includes(normalized.diagram.mode)) errors.push({ code: 'DIAGRAM_MODE', path: 'diagram.mode', message: `Unsupported diagram mode: ${normalized.diagram.mode}.`, suggestion: `Use ${diagramModes.join(', ')}.` });
  layers.forEach((layer, index) => {
    if (typeof layer?.id !== 'string' || !layer.id) errors.push({ code: 'LAYER_ID', path: `layers.${index}.id`, message: 'Architecture layers require stable IDs.' });
  });
  normalized.groups.forEach((group, index) => {
    if (typeof group?.id !== 'string' || !group.id) errors.push({ code: 'GROUP_ID', path: `groups.${index}.id`, message: 'Groups require stable IDs.' });
    else if (groupIds.has(group.id)) errors.push({ code: 'DUPLICATE_GROUP_ID', path: `groups.${index}.id`, message: 'Group IDs must be unique.' });
    else groupIds.add(group.id);
    if (group?.parentId) errors.push({ code: 'NESTED_GROUP_UNSUPPORTED', path: `groups.${index}.parentId`, message: '5B supports flat groups, not nested groups.' });
  });
  nodes.forEach((node, index) => {
    if (typeof node.id !== 'string' || !node.id) errors.push({ code: 'NODE_ID', path: `nodes.${index}.id`, message: 'Diagram nodes require stable string IDs.' });
    else if (nodeIds.has(node.id)) errors.push({ code: 'DUPLICATE_NODE_ID', path: `nodes.${index}.id`, message: `Duplicate node ID: ${node.id}.` });
    else nodeIds.add(node.id);
    if (node.position && (!finite(node.position.x) || !finite(node.position.y))) errors.push({ code: 'NODE_POSITION', path: `nodes.${index}.position`, message: 'Node positions must contain finite x and y.' });
    if (node.laneId && lanes.length && !laneIds.has(node.laneId)) errors.push({ code: 'MISSING_LANE', path: `nodes.${index}.laneId`, message: `Unknown lane ID: ${node.laneId}.` });
    if (node.size && (!finite(node.size.width) || !finite(node.size.height) || node.size.width <= 0 || node.size.height <= 0)) errors.push({ code: 'NODE_SIZE', path: `nodes.${index}.size`, message: 'Node sizes must be finite and positive.' });
    if (node.groupId && !groupIds.has(node.groupId)) errors.push({ code: 'MISSING_GROUP', path: `nodes.${index}.groupId`, message: `Unknown group ${node.groupId}.` });
    if (node.layerId && layers.length && !layerIds.has(node.layerId)) errors.push({ code: 'MISSING_LAYER', path: `nodes.${index}.layerId`, message: `Unknown layer ${node.layerId}.` });
    if (node.parentId && !nodes.some(parent => parent.id === node.parentId)) errors.push({ code: 'MISSING_PARENT', path: `nodes.${index}.parentId`, message: `Unknown parent node ${node.parentId}.` });
    if (node.parentId === node.id) errors.push({ code: 'SELF_PARENT', path: `nodes.${index}.parentId`, message: 'Mindmap nodes cannot parent themselves.' });
    if (node.ports && (!Array.isArray(node.ports) || node.ports.some(port => !port || typeof port.id !== 'string' || !port.id))) errors.push({ code: 'NODE_PORTS', path: `nodes.${index}.ports`, message: 'Ports must be an array with stable string IDs.' });
    const portIds = new Set();
    if (Array.isArray(node.ports)) node.ports.forEach((port, portIndex) => {
      if (!port) return;
      const path = `nodes.${index}.ports.${portIndex}`;
      if (portIds.has(port.id)) errors.push({ code: 'DUPLICATE_PORT_ID', path, message: 'Port IDs must be unique within a node.' });
      portIds.add(port.id);
      if (port.side !== undefined && !['left', 'right', 'top', 'bottom'].includes(port.side)) errors.push({ code: 'PORT_SIDE', path, message: 'Use left, right, top, or bottom.' });
      if (port.offset !== undefined && (!finite(port.offset) || port.offset < 0 || port.offset > 1)) errors.push({ code: 'PORT_OFFSET', path, message: 'Port offset must be within [0, 1].' });
    });
  });
  const edgeIds = new Set();
  edges.forEach((edge, index) => {
    if (typeof edge.id === 'string' && edgeIds.has(edge.id)) errors.push({ code: 'DUPLICATE_EDGE_ID', path: `edges.${index}.id`, message: `Duplicate edge ID: ${edge.id}.` });
    if (edge.id) edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push({ code: 'EDGE_ENDPOINT', path: `edges.${index}`, message: 'Edges must reference existing node IDs.' });
    if (edge.from === edge.to) errors.push({ code: 'SELF_EDGE', path: `edges.${index}`, message: 'Self-referencing edges are not allowed by default.' });
    ['fromPort', 'toPort'].forEach(key => {
      const node = nodes.find(item => item.id === edge[key === 'fromPort' ? 'from' : 'to']);
      if (edge[key] && (!Array.isArray(node?.ports) || !node.ports.some(port => port?.id === edge[key]))) errors.push({ code: 'MISSING_PORT', path: `edges.${index}.${key}`, message: `Unknown port ${edge[key]}.` });
    });
    if (edge.curveTension !== undefined && (!finite(edge.curveTension) || edge.curveTension < 0.2 || edge.curveTension > 0.8)) errors.push({ code: 'EDGE_CURVE_TENSION', path: `edges.${index}.curveTension`, message: 'Edge curve tension must be a finite number between 0.2 and 0.8.' });
    if (edge.waypoints !== undefined && (!Array.isArray(edge.waypoints) || edge.waypoints.some(point => !point || !finite(point.x) || !finite(point.y)))) errors.push({ code: 'EDGE_WAYPOINTS', path: `edges.${index}.waypoints`, message: 'Edge waypoints must be an array of finite x/y points.' });
  });
  if (!diagramLayoutModes.includes(normalized.diagram.layout)) errors.push({ code: 'LAYOUT_MODE', path: 'diagram.layout', message: `Unsupported layout: ${normalized.diagram.layout}.` });
  if (!finite(normalized.diagram.grid) || normalized.diagram.grid <= 0) errors.push({ code: 'DIAGRAM_GRID', path: 'diagram.grid', message: 'Grid must be a positive finite number.' });
  if (!finite(normalized.diagram.curveTension) || normalized.diagram.curveTension < 0.2 || normalized.diagram.curveTension > 0.8) errors.push({ code: 'CURVE_TENSION', path: 'diagram.curveTension', message: 'Curve tension must be a finite number between 0.2 and 0.8.' });
  if (!edgeRoutingModes.includes(normalized.diagram.routing)) errors.push({ code: 'ROUTING_MODE', path: 'diagram.routing', message: `Unsupported routing: ${normalized.diagram.routing}.` });
  if (normalized.diagram.mode === 'mindmap') {
    const parents = new Map(nodes.map(node => [node.id, node.parentId]).filter(([, parentId]) => parentId));
    nodes.forEach(node => { const seen = new Set([node.id]); let current = node.parentId; while (current) { if (seen.has(current)) { errors.push({ code: 'MINDMAP_CYCLE', path: `nodes.${node.id}.parentId`, message: 'Mindmap parent relationships must be acyclic.' }); break; } seen.add(current); current = parents.get(current); } });
  }
  return { valid: errors.length === 0, errors, spec: normalized };
}

export function diagramGraph(spec) {
  const normalized = normalizeDiagramSpec(spec), nodes = normalized.nodes, edges = normalized.edges;
  const incoming = new Map(nodes.map(node => [node.id, []])), outgoing = new Map(nodes.map(node => [node.id, []]));
  edges.forEach(edge => { if (incoming.has(edge.to) && outgoing.has(edge.from)) { incoming.get(edge.to).push(edge); outgoing.get(edge.from).push(edge); } });
  return { spec: normalized, nodes, edges, incoming, outgoing };
}

export function layoutArchitectureNodes(spec, bounds = { x: 0, y: 0, width: 640, height: 360 }) {
  const normalized = normalizeDiagramSpec(spec), layers = normalized.layers, nodes = normalized.nodes;
  if (!layers.length) return {};
  const boxes = {}, grid = Number(normalized.diagram.grid) || 0, snap = value => grid > 0 ? Math.round(value / grid) * grid : value;
  const layerHeight = bounds.height / layers.length;
  layers.forEach((layer, layerIndex) => {
    const members = nodes.filter(node => node.layerId === layer.id);
    if (!members.length) return;
    const widest = Math.max(72, ...members.map(node => Number(node.size?.width) || 112));
    const columns = Math.max(1, Math.min(members.length, Math.floor((bounds.width + 12) / (widest + 12))));
    const rows = Math.ceil(members.length / columns);
    const slotWidth = bounds.width / columns, slotHeight = layerHeight / rows;
    members.forEach((node, index) => {
      const row = Math.floor(index / columns), column = index % columns;
      const count = row === rows - 1 ? members.length - row * columns : columns;
      const rowOffset = (bounds.width - count * slotWidth) / 2;
      const width = Number(node.size?.width) || Math.min(112, Math.max(72, slotWidth - 12));
      const height = Number(node.size?.height) || Math.min(36, Math.max(14, slotHeight - 6));
      boxes[node.id] = {
        x: snap(node.position?.x ?? bounds.x + rowOffset + column * slotWidth + (slotWidth - width) / 2),
        y: snap(node.position?.y ?? bounds.y + layerIndex * layerHeight + row * slotHeight + (slotHeight - height) / 2),
        width,
        height
      };
    });
  });
  return boxes;
}

export function layoutDiagram(spec, bounds = { x: 0, y: 0, width: 640, height: 360 }) {
  const graph = diagramGraph(spec), mode = graph.spec.diagram.layout, positions = new Map(), gapX = Math.max(150, bounds.width / Math.max(1, graph.nodes.length)), gapY = 72;
  if (mode === 'manual') graph.nodes.forEach(node => positions.set(node.id, { x: node.position?.x ?? bounds.x, y: node.position?.y ?? bounds.y }));
  else if (graph.spec.diagram.mode === 'architecture' && graph.spec.layers.length) Object.entries(layoutArchitectureNodes(graph.spec, bounds)).forEach(([id, box]) => positions.set(id, { x: box.x, y: box.y }));
  else if (graph.spec.diagram.mode === 'mindmap') {
    const roots = graph.nodes.filter(node => !graph.incoming.get(node.id).length), children = new Map(graph.nodes.map(node => [node.id, []]));
    graph.edges.forEach(edge => { if (children.has(edge.from)) children.get(edge.from).push(edge.to); });
    const ordered = [], visit = (id, depth = 0) => { ordered.push({ id, depth }); (children.get(id) || []).forEach(child => visit(child, depth + 1)); };
    roots.forEach(root => visit(root.id));
    graph.nodes.filter(node => !ordered.some(item => item.id === node.id)).forEach(node => visit(node.id));
    if (mode === 'radial') {
      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, levels = new Map();
      ordered.forEach(item => { if (!levels.has(item.depth)) levels.set(item.depth, []); levels.get(item.depth).push(item); });
      levels.forEach((items, depth) => items.forEach((item, index) => { const angle = (index / Math.max(1, items.length)) * Math.PI * 2 - Math.PI / 2, radiusX = depth ? bounds.width * 0.38 * Math.min(1, depth / Math.max(1, levels.size - 1)) : 0, radiusY = depth ? bounds.height * 0.36 * Math.min(1, depth / Math.max(1, levels.size - 1)) : 0; positions.set(item.id, { x: center.x + Math.cos(angle) * radiusX, y: center.y + Math.sin(angle) * radiusY }); }));
    } else {
      const levels = new Map(); ordered.forEach(item => { if (!levels.has(item.depth)) levels.set(item.depth, []); levels.get(item.depth).push(item); });
      levels.forEach((items, depth) => items.forEach((item, index) => positions.set(item.id, { x: bounds.x + depth * Math.max(160, bounds.width / Math.max(1, levels.size)), y: bounds.y + (index + 0.5) * bounds.height / Math.max(1, items.length) })));
    }
  }
  else {
    const rank = new Map(graph.nodes.map(node => [node.id, 0])), queue = graph.nodes.filter(node => graph.incoming.get(node.id).length === 0).map(node => node.id);
    for (let index = 0; index < queue.length; index += 1) graph.outgoing.get(queue[index]).forEach(edge => { rank.set(edge.to, Math.max(rank.get(edge.to) || 0, (rank.get(edge.from) || 0) + 1)); if (!queue.includes(edge.to) && graph.incoming.get(edge.to).every(item => queue.includes(item.from))) queue.push(edge.to); });
    graph.nodes.filter(node => !queue.includes(node.id)).forEach(node => queue.push(node.id));
    const buckets = new Map(); queue.forEach(id => { const key = mode === 'radial' ? 0 : rank.get(id) || 0; if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(id); });
    [...buckets.entries()].forEach(([key, ids]) => ids.forEach((id, index) => { if (mode === 'radial') { const angle = index / Math.max(1, ids.length) * Math.PI * 2; positions.set(id, { x: bounds.x + bounds.width / 2 + Math.cos(angle) * bounds.width * 0.32, y: bounds.y + bounds.height / 2 + Math.sin(angle) * bounds.height * 0.32 }); } else positions.set(id, { x: bounds.x + Number(key) * gapX, y: bounds.y + index * gapY }); }));
  }
  const grid = Number(graph.spec.diagram.grid) || 0, snap = value => grid > 0 ? Math.round(value / grid) * grid : value;
  positions.forEach(position => { position.x = snap(position.x); position.y = snap(position.y); });
  return Object.fromEntries(positions);
}

function preferredSide(source, target, sourcePoint) {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const deltaX = targetCenter.x - sourceCenter.x, deltaY = targetCenter.y - sourceCenter.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return sourcePoint ? (deltaX >= 0 ? 'right' : 'left') : (deltaX >= 0 ? 'left' : 'right');
  return sourcePoint ? (deltaY >= 0 ? 'bottom' : 'top') : (deltaY >= 0 ? 'top' : 'bottom');
}

function pointFor(box, port, fallbackSide) {
  if (!port) {
    if (fallbackSide === 'left') return { x: box.x, y: box.y + box.height / 2 };
    if (fallbackSide === 'top') return { x: box.x + box.width / 2, y: box.y };
    if (fallbackSide === 'bottom') return { x: box.x + box.width / 2, y: box.y + box.height };
    return { x: box.x + box.width, y: box.y + box.height / 2 };
  }
    const side = port.side || fallbackSide, offset = Math.max(0, Math.min(1, Number(port.offset ?? 0.5)));
    if (side === 'left') return { x: box.x, y: box.y + box.height * offset };
    if (side === 'top') return { x: box.x + box.width * offset, y: box.y };
    if (side === 'bottom') return { x: box.x + box.width * offset, y: box.y + box.height };
    return { x: box.x + box.width, y: box.y + box.height * offset };
}

export function diagramConnectionPoints(from, to, fromPort, toPort) {
  return {
    start: pointFor(from, fromPort, preferredSide(from, to, true)),
    end: pointFor(to, toPort, preferredSide(from, to, false))
  };
}

export function routeEdgePath(edge, from, to, mode = 'orthogonal') {
  const initial = diagramConnectionPoints(from, to, edge.fromPortDefinition, edge.toPortDefinition), startSide = edge.fromPortDefinition?.side || preferredSide(from, to, true), endSide = edge.toPortDefinition?.side || preferredSide(from, to, false);
  const obstacles = (edge.obstacles || []).filter(box => box && Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.width) && Number.isFinite(box.height));
  const compact = points => points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  const pointInside = (point, box) => point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height;
  const orientation = (first, second, third) => Math.sign((second.y - first.y) * (third.x - second.x) - (second.x - first.x) * (third.y - second.y));
  const intersects = (first, second, third, fourth) => orientation(first, second, third) !== orientation(first, second, fourth) && orientation(third, fourth, first) !== orientation(third, fourth, second);
  const segmentIntersectsBox = (first, second, box, padding = 0) => {
    const expanded = { x: box.x - padding, y: box.y - padding, width: box.width + padding * 2, height: box.height + padding * 2 };
    if (pointInside(first, expanded) || pointInside(second, expanded)) return true;
    const topLeft = { x: expanded.x, y: expanded.y }, topRight = { x: expanded.x + expanded.width, y: expanded.y }, bottomRight = { x: expanded.x + expanded.width, y: expanded.y + expanded.height }, bottomLeft = { x: expanded.x, y: expanded.y + expanded.height };
    return [[topLeft, topRight], [topRight, bottomRight], [bottomRight, bottomLeft], [bottomLeft, topLeft]].some(([start, end]) => intersects(first, second, start, end));
  };
  const leavesSide = (start, next, side) => side === 'left' ? next.x < start.x : side === 'right' ? next.x > start.x : side === 'top' ? next.y < start.y : next.y > start.y;
  const entersSide = (previous, end, side) => side === 'left' ? previous.x < end.x : side === 'right' ? previous.x > end.x : side === 'top' ? previous.y < end.y : previous.y > end.y;
  const waypoints = Array.isArray(edge.waypoints) ? edge.waypoints.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y)).map(point => ({ x: point.x, y: point.y })) : [];
  if (waypoints.length) {
    const manual = compact([initial.start, ...waypoints, initial.end]), padding = Math.max(4, Number(edge.grid) || 8) / 2;
    if (leavesSide(manual[0], manual[1], startSide) && entersSide(manual.at(-2), manual.at(-1), endSide) && manual.every((point, index) => index === 0 || obstacles.every(box => !segmentIntersectsBox(manual[index - 1], point, box, padding)))) return { points: manual, curve: null };
  }
  if (mode === 'straight') return { points: [initial.start, initial.end], curve: null };
  if (mode === 'curved') {
    const tension = Math.max(0.2, Math.min(0.8, Number(edge.curveTension) || 0.4)), distance = Math.hypot(initial.end.x - initial.start.x, initial.end.y - initial.start.y), bend = Math.max(24, distance * tension);
    const direction = side => side === 'left' ? { x: -1, y: 0 } : side === 'right' ? { x: 1, y: 0 } : side === 'top' ? { x: 0, y: -1 } : { x: 0, y: 1 };
    const startDirection = direction(startSide), endDirection = direction(endSide);
    const points = [initial.start, { x: initial.start.x + startDirection.x * bend, y: initial.start.y + startDirection.y * bend }, { x: initial.end.x + endDirection.x * bend, y: initial.end.y + endDirection.y * bend }, initial.end];
    const samples = sampleCubicBezier(points, 24), padding = Math.max(4, Number(edge.grid) || 8) / 2;
    if (samples.every((point, index) => index === 0 || obstacles.every(box => !segmentIntersectsBox(samples[index - 1], point, box, padding)))) return { points, curve: 'cubic' };
    return routeEdgePath({ ...edge, waypoints: [] }, from, to, 'orthogonal');
  }
  const sidePairs = edge.preserveSides || edge.fromPortDefinition || edge.toPortDefinition ? [[startSide, endSide]] : [[startSide, endSide], ...['right', 'left', 'top', 'bottom'].flatMap(fromSide => ['right', 'left', 'top', 'bottom'].map(toSide => [fromSide, toSide]))].filter((pair, index, pairs) => pairs.findIndex(item => item[0] === pair[0] && item[1] === pair[1]) === index);
  const routeForSides = (fromSide, toSide) => {
    const fromPort = edge.fromPortDefinition || { side: fromSide }, toPort = edge.toPortDefinition || { side: toSide }, { start, end } = diagramConnectionPoints(from, to, fromPort, toPort), padding = Math.max(12, Number(edge.grid) || 8);
    const segmentIntersects = (first, second, box) => {
      const expanded = { x: box.x - padding, y: box.y - padding, width: box.width + padding * 2, height: box.height + padding * 2 };
      if (first.x === second.x) return first.x > expanded.x && first.x < expanded.x + expanded.width && Math.max(first.y, second.y) > expanded.y && Math.min(first.y, second.y) < expanded.y + expanded.height;
      if (first.y === second.y) return first.y > expanded.y && first.y < expanded.y + expanded.height && Math.max(first.x, second.x) > expanded.x && Math.min(first.x, second.x) < expanded.x + expanded.width;
      return false;
    };
    const leavesFromSide = points => {
      if (points.length < 2) return false;
      const next = points[1];
      if (fromSide === 'left') return next.x < start.x && next.y === start.y;
      if (fromSide === 'top') return next.y < start.y && next.x === start.x;
      if (fromSide === 'bottom') return next.y > start.y && next.x === start.x;
      return next.x > start.x && next.y === start.y;
    };
    const entersToSide = points => {
      if (points.length < 2) return false;
      const previous = points.at(-2);
      if (toSide === 'left') return previous.x < end.x && previous.y === end.y;
      if (toSide === 'top') return previous.y < end.y && previous.x === end.x;
      if (toSide === 'bottom') return previous.y > end.y && previous.x === end.x;
      return previous.x > end.x && previous.y === end.y;
    };
    const connectionAccess = points => leavesFromSide(points) && entersToSide(points);
    const validPath = points => connectionAccess(points) && points.every((point, index) => index === 0 || obstacles.every(box => !segmentIntersects(points[index - 1], point, box)));
    const snap = value => { const grid = Number(edge.grid) || 8; return Math.round(value / grid) * grid; };
    const middle = snap((start.x + end.x) / 2), middleY = snap((start.y + end.y) / 2);
    const candidates = [
      [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end],
      [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end]
    ];
    const xChannels = new Set([start.x, end.x, middle]), yChannels = new Set([start.y, end.y, middleY]);
    obstacles.forEach(box => {
      [box.x - padding, box.x + box.width + padding].forEach(x => xChannels.add(snap(x)));
      [box.y - padding, box.y + box.height + padding].forEach(y => yChannels.add(snap(y)));
    });
    xChannels.forEach(x => candidates.push([start, { x, y: start.y }, { x, y: end.y }, end]));
    yChannels.forEach(y => candidates.push([start, { x: start.x, y }, { x: end.x, y }, end]));
    xChannels.forEach(x => yChannels.forEach(y => {
      candidates.push([start, { x, y: start.y }, { x, y }, { x, y: end.y }, end]);
      candidates.push([start, { x: start.x, y }, { x, y }, { x: end.x, y }, end]);
    }));
    const length = points => points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
    return candidates.map(compact).filter(validPath).sort((left, right) => length(left) - length(right) || left.length - right.length || JSON.stringify(left).localeCompare(JSON.stringify(right)))[0] || null;
  };
  for (const [fromSide, toSide] of sidePairs) {
    const route = routeForSides(fromSide, toSide);
    if (!route) continue;
    if (!edge.preserveSides || mode !== 'orthogonal') return { points: route, curve: null };
    const bendGap = Math.max(12, Number(edge.grid) || 8);
    const firstSpan = Math.abs(route[1]?.x - route[0]?.x) + Math.abs(route[1]?.y - route[0]?.y);
    const lastSpan = Math.abs(route.at(-1)?.x - route.at(-2)?.x) + Math.abs(route.at(-1)?.y - route.at(-2)?.y);
    if (firstSpan >= bendGap && lastSpan >= bendGap) return { points: route, curve: null };
  }
  if (edge.preserveSides && mode === 'orthogonal') {
    const horizontal = ['left', 'right'].includes(startSide) && ['left', 'right'].includes(endSide);
    const vertical = ['top', 'bottom'].includes(startSide) && ['top', 'bottom'].includes(endSide);
    const bendGap = Math.max(12, Number(edge.grid) || 8), snapFallback = value => Math.round(value / (Number(edge.grid) || 8)) * (Number(edge.grid) || 8);
    if (horizontal) {
      const channelY = initial.start.y < to.y + to.height / 2 ? to.y - bendGap : to.y + to.height + bendGap;
      const sourceChannelX = startSide === 'right' ? initial.start.x + bendGap : initial.start.x - bendGap;
      const targetChannelX = endSide === 'left' ? to.x - bendGap : to.x + to.width + bendGap;
      return { points: compact([initial.start, { x: snapFallback(sourceChannelX), y: initial.start.y }, { x: snapFallback(sourceChannelX), y: snapFallback(channelY) }, { x: snapFallback(targetChannelX), y: snapFallback(channelY) }, { x: snapFallback(targetChannelX), y: initial.end.y }, initial.end]), curve: null };
    }
    if (vertical) {
      const channelX = initial.start.x < to.x + to.width / 2 ? to.x - bendGap : to.x + to.width + bendGap;
      const sourceChannelY = startSide === 'bottom' ? initial.start.y + bendGap : initial.start.y - bendGap;
      const targetChannelY = endSide === 'top' ? to.y - bendGap : to.y + to.height + bendGap;
      return { points: compact([initial.start, { x: initial.start.x, y: snapFallback(sourceChannelY) }, { x: snapFallback(channelX), y: snapFallback(sourceChannelY) }, { x: snapFallback(channelX), y: snapFallback(targetChannelY) }, { x: initial.end.x, y: snapFallback(targetChannelY) }, initial.end]), curve: null };
    }
  }
  return { points: [initial.start, initial.end], curve: null };
}

export function routeEdge(edge, from, to, mode = 'orthogonal') {
  return routeEdgePath(edge, from, to, mode).points;
}

export function normalizeDiagramData(spec) {
  const normalized = normalizeDiagramSpec(spec);
  return { ...normalized, nodes: normalized.nodes.map(node => ({ ...node })) };
}
