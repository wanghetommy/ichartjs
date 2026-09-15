/**
 * Diagram data model, validation, deterministic layout, and edge routing.
 * Supports nodes, edges, lanes, flat groups, ports, and 2D routing modes.
 */
import { copyJSON } from './schema.mjs';

export const diagramLayoutModes = ['manual', 'layered', 'tree', 'radial'];
export const edgeRoutingModes = ['straight', 'orthogonal', 'curved'];

const finite = value => typeof value === 'number' && Number.isFinite(value);

export function normalizeDiagramSpec(spec = {}) {
  const data = spec.data || {};
  const nodes = copyJSON(spec.nodes ?? data.nodes ?? data.values ?? []);
  const edges = copyJSON(spec.edges ?? data.edges ?? []);
  const lanes = copyJSON(spec.lanes ?? data.lanes ?? []);
  return { ...copyJSON(spec), nodes, edges, lanes, groups: copyJSON(spec.groups ?? data.groups ?? []), diagram: { layout: spec.diagram?.layout || 'layered', routing: spec.diagram?.routing || 'orthogonal', snap: spec.diagram?.snap ?? true, grid: spec.diagram?.grid ?? 8 } };
}

export function validateDiagram(spec = {}) {
  const errors = [], normalized = normalizeDiagramSpec(spec), nodes = normalized.nodes, edges = normalized.edges, lanes = normalized.lanes;
  const nodeIds = new Set(), laneIds = new Set(lanes.map(lane => lane.id));
  const groupIds = new Set();
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
  });
  if (!diagramLayoutModes.includes(normalized.diagram.layout)) errors.push({ code: 'LAYOUT_MODE', path: 'diagram.layout', message: `Unsupported layout: ${normalized.diagram.layout}.` });
  if (!finite(normalized.diagram.grid) || normalized.diagram.grid <= 0) errors.push({ code: 'DIAGRAM_GRID', path: 'diagram.grid', message: 'Grid must be a positive finite number.' });
  if (!edgeRoutingModes.includes(normalized.diagram.routing)) errors.push({ code: 'ROUTING_MODE', path: 'diagram.routing', message: `Unsupported routing: ${normalized.diagram.routing}.` });
  return { valid: errors.length === 0, errors, spec: normalized };
}

export function diagramGraph(spec) {
  const normalized = normalizeDiagramSpec(spec), nodes = normalized.nodes, edges = normalized.edges;
  const incoming = new Map(nodes.map(node => [node.id, []])), outgoing = new Map(nodes.map(node => [node.id, []]));
  edges.forEach(edge => { if (incoming.has(edge.to) && outgoing.has(edge.from)) { incoming.get(edge.to).push(edge); outgoing.get(edge.from).push(edge); } });
  return { spec: normalized, nodes, edges, incoming, outgoing };
}

export function layoutDiagram(spec, bounds = { x: 0, y: 0, width: 640, height: 360 }) {
  const graph = diagramGraph(spec), mode = graph.spec.diagram.layout, positions = new Map(), gapX = Math.max(150, bounds.width / Math.max(1, graph.nodes.length)), gapY = 72;
  if (mode === 'manual') graph.nodes.forEach(node => positions.set(node.id, { x: node.position?.x ?? bounds.x, y: node.position?.y ?? bounds.y }));
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

export function routeEdge(edge, from, to, mode = 'orthogonal') {
  const pointFor = (box, port, fallbackSide) => {
    if (!port) return fallbackSide === 'left' ? { x: box.x, y: box.y + box.height / 2 } : { x: box.x + box.width, y: box.y + box.height / 2 };
    const side = port.side || fallbackSide, offset = Math.max(0, Math.min(1, Number(port.offset ?? 0.5)));
    if (side === 'left') return { x: box.x, y: box.y + box.height * offset };
    if (side === 'top') return { x: box.x + box.width * offset, y: box.y };
    if (side === 'bottom') return { x: box.x + box.width * offset, y: box.y + box.height };
    return { x: box.x + box.width, y: box.y + box.height * offset };
  };
  const start = pointFor(from, edge.fromPortDefinition, 'right'), end = pointFor(to, edge.toPortDefinition, 'left');
  if (mode === 'straight') return [start, end];
  if (mode === 'curved') { const bend = Math.max(30, Math.abs(end.x - start.x) * 0.4); return [start, { x: start.x + bend, y: start.y }, { x: end.x - bend, y: end.y }, end]; }
  const obstacles = (edge.obstacles || []).filter(box => box && Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.width) && Number.isFinite(box.height));
  const padding = Math.max(12, Number(edge.grid) || 8);
  const segmentIntersects = (first, second, box) => {
    const expanded = { x: box.x - padding, y: box.y - padding, width: box.width + padding * 2, height: box.height + padding * 2 };
    if (first.x === second.x) return first.x >= expanded.x && first.x <= expanded.x + expanded.width && Math.max(first.y, second.y) >= expanded.y && Math.min(first.y, second.y) <= expanded.y + expanded.height;
    if (first.y === second.y) return first.y >= expanded.y && first.y <= expanded.y + expanded.height && Math.max(first.x, second.x) >= expanded.x && Math.min(first.x, second.x) <= expanded.x + expanded.width;
    return false;
  };
  const validPath = points => points.every((point, index) => index === 0 || obstacles.every(box => !segmentIntersects(points[index - 1], point, box)));
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
    candidates.push([start, { x, y: start.y }, { x, y }, { x: end.x, y }, end]);
    candidates.push([start, { x: start.x, y }, { x, y }, { x, y: end.y }, end]);
  }));
  const compact = points => points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  const length = points => points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
  const valid = candidates.map(compact).filter(validPath).sort((left, right) => length(left) - length(right) || left.length - right.length || JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return valid[0] || compact(candidates[0]);
}

export function normalizeDiagramData(spec) {
  const normalized = normalizeDiagramSpec(spec);
  return { ...normalized, nodes: normalized.nodes.map(node => ({ ...node })) };
}
