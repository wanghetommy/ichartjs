/**
 * Diagram data model, validation, deterministic layout, and edge routing.
 * Supports nodes, edges, lanes, flat groups, ports, and 2D routing modes.
 */
import { copyJSON } from './schema.mjs';
import { sampleCubicBezier } from './scene.mjs';
import { flowNodeKinds } from './contract-registry.mjs';

export const diagramLayoutModes = ['manual', 'layered', 'tree', 'radial'];
export const edgeRoutingModes = ['auto', 'straight', 'orthogonal', 'curved'];
export const diagramModes = ['process', 'architecture', 'mindmap'];
export { flowNodeKinds };

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
  const errors = [], warnings = [], normalized = normalizeDiagramSpec(spec), nodes = normalized.nodes, edges = normalized.edges, lanes = normalized.lanes, layers = normalized.layers;
  const nodeIds = new Set(), laneIds = new Set(lanes.map(lane => lane.id));
  const groupIds = new Set();
  const layerIds = new Set(layers.map(layer => layer.id));
  if (!diagramModes.includes(normalized.diagram.mode)) errors.push({ code: 'DIAGRAM_MODE', path: 'diagram.mode', message: `Unsupported diagram mode: ${normalized.diagram.mode}.`, suggestion: `Use ${diagramModes.join(', ')}.` });
  layers.forEach((layer, index) => {
    if (typeof layer?.id !== 'string' || !layer.id) errors.push({ code: 'LAYER_ID', path: `layers.${index}.id`, message: 'Architecture layers require stable IDs.' });
    if (layer?.name !== undefined && layer?.label === undefined) warnings.push({ code: 'UNSUPPORTED_DIAGRAM_LABEL_FIELD', path: `layers.${index}.name`, message: 'Architecture layer display text uses label, not name.', suggestion: 'Rename layers[].name to layers[].label.' });
  });
  lanes.forEach((lane, index) => {
    if (lane?.name !== undefined && lane?.label === undefined) warnings.push({ code: 'UNSUPPORTED_DIAGRAM_LABEL_FIELD', path: `lanes.${index}.name`, message: 'Swimlane lane display text uses label, not name.', suggestion: 'Rename lanes[].name to lanes[].label.' });
  });
  normalized.groups.forEach((group, index) => { if (group?.name !== undefined && group?.label === undefined) warnings.push({ code: 'UNSUPPORTED_DIAGRAM_LABEL_FIELD', path: `groups.${index}.name`, message: 'Group display text uses label, not name.', suggestion: 'Rename groups[].name to groups[].label.' }); });
  normalized.boundaries.forEach((boundary, index) => { if (boundary?.name !== undefined && boundary?.label === undefined) warnings.push({ code: 'UNSUPPORTED_DIAGRAM_LABEL_FIELD', path: `boundaries.${index}.name`, message: 'Boundary display text uses label, not name.', suggestion: 'Rename boundaries[].name to boundaries[].label.' }); });
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
    if (node?.name !== undefined && node?.label === undefined) warnings.push({ code: 'UNSUPPORTED_DIAGRAM_LABEL_FIELD', path: `nodes.${index}.name`, message: 'Node display text uses label, not name.', suggestion: 'Rename nodes[].name to nodes[].label.' });
    if (normalized.type === 'flow' && node.kind !== undefined && !flowNodeKinds.includes(node.kind)) errors.push({ code: 'FLOW_NODE_KIND', path: `nodes.${index}.kind`, message: `Unsupported Flow node kind: ${node.kind}.`, expected: flowNodeKinds, suggestion: `Use one of: ${flowNodeKinds.join(', ')}.` });
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
    const usesUnsupportedEndpointNames = (edge.from === undefined || edge.to === undefined) && (edge.source !== undefined || edge.target !== undefined);
    if (usesUnsupportedEndpointNames) errors.push({ code: 'UNSUPPORTED_EDGE_ENDPOINT_FIELDS', path: `edges.${index}`, message: 'Diagram edges use from and to, not source and target.', suggestion: 'Rename edge.source to edge.from and edge.target to edge.to.' });
    else {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push({ code: 'EDGE_ENDPOINT', path: `edges.${index}`, message: 'Edges must reference existing node IDs.' });
      if (edge.from === edge.to) errors.push({ code: 'SELF_EDGE', path: `edges.${index}`, message: 'Self-referencing edges are not allowed by default.' });
    }
    ['fromPort', 'toPort'].forEach(key => {
      const node = nodes.find(item => item.id === edge[key === 'fromPort' ? 'from' : 'to']);
      if (edge[key] && (!Array.isArray(node?.ports) || !node.ports.some(port => port?.id === edge[key]))) errors.push({ code: 'MISSING_PORT', path: `edges.${index}.${key}`, message: `Unknown port ${edge[key]}.` });
    });
    if (edge.routing !== undefined && !edgeRoutingModes.includes(edge.routing)) errors.push({ code: 'EDGE_ROUTING_MODE', path: `edges.${index}.routing`, message: `Unsupported edge routing: ${edge.routing}.`, suggestion: `Use ${edgeRoutingModes.join(', ')}.` });
    if (edge.routingMode !== undefined && !['auto', 'manual'].includes(edge.routingMode)) errors.push({ code: 'EDGE_ROUTING_MODE', path: `edges.${index}.routingMode`, message: `Unsupported edge routing mode: ${edge.routingMode}.`, suggestion: 'Use auto or manual.' });
    if (edge.lineStyle !== undefined && !['solid', 'dashed', 'dotted'].includes(edge.lineStyle)) errors.push({ code: 'EDGE_LINE_STYLE', path: `edges.${index}.lineStyle`, message: `Unsupported edge line style: ${edge.lineStyle}.`, suggestion: 'Use solid, dashed, or dotted.' });
    if (edge.curveTension !== undefined && (!finite(edge.curveTension) || edge.curveTension < 0.2 || edge.curveTension > 0.8)) errors.push({ code: 'EDGE_CURVE_TENSION', path: `edges.${index}.curveTension`, message: 'Edge curve tension must be a finite number between 0.2 and 0.8.' });
    if (edge.waypoints !== undefined && (!Array.isArray(edge.waypoints) || edge.waypoints.some(point => !point || !finite(point.x) || !finite(point.y)))) errors.push({ code: 'EDGE_WAYPOINTS', path: `edges.${index}.waypoints`, message: 'Edge waypoints must be an array of finite x/y points.' });
  });
  if (normalized.type === 'flow') {
    const semanticNodes = nodes.filter(node => node.kind !== undefined), outgoing = new Map(nodes.map(node => [node.id, []]));
    edges.forEach(edge => { if (outgoing.has(edge.from)) outgoing.get(edge.from).push(edge); });
    semanticNodes.forEach(node => {
      const nodeIndex = nodes.indexOf(node), path = `nodes.${nodeIndex}.kind`;
      if (node.kind === 'decision' && (outgoing.get(node.id) || []).length < 2) warnings.push({ code: 'FLOW_DECISION_BRANCHES', path, message: 'A decision node should have at least two outgoing branches.', suggestion: 'Add labeled edges such as label: "yes" and label: "no".' });
      if (node.kind === 'connector' && !node.label) warnings.push({ code: 'FLOW_CONNECTOR_LABEL', path, message: 'An unlabeled connector is valid but harder to follow in a detached flow.', suggestion: 'Add a short label when the connector is used to join separated flow sections.' });
    });
    if (semanticNodes.length) {
      if (!semanticNodes.some(node => node.kind === 'start')) warnings.push({ code: 'FLOW_MISSING_START', path: 'nodes', message: 'Semantic Flow has no start node.', suggestion: 'Add one node with kind: "start", or use explicit kind: "process" for a process-only Flow.' });
      if (!semanticNodes.some(node => node.kind === 'end')) warnings.push({ code: 'FLOW_MISSING_END', path: 'nodes', message: 'Semantic Flow has no end node.', suggestion: 'Add one node with kind: "end", or use explicit kind: "process" for a process-only Flow.' });
    }
  }
  if (!diagramLayoutModes.includes(normalized.diagram.layout)) errors.push({ code: 'LAYOUT_MODE', path: 'diagram.layout', message: `Unsupported layout: ${normalized.diagram.layout}.` });
  if (!finite(normalized.diagram.grid) || normalized.diagram.grid <= 0) errors.push({ code: 'DIAGRAM_GRID', path: 'diagram.grid', message: 'Grid must be a positive finite number.' });
  if (!finite(normalized.diagram.curveTension) || normalized.diagram.curveTension < 0.2 || normalized.diagram.curveTension > 0.8) errors.push({ code: 'CURVE_TENSION', path: 'diagram.curveTension', message: 'Curve tension must be a finite number between 0.2 and 0.8.' });
  if (!edgeRoutingModes.includes(normalized.diagram.routing)) errors.push({ code: 'ROUTING_MODE', path: 'diagram.routing', message: `Unsupported routing: ${normalized.diagram.routing}.` });
  if (normalized.diagram.mode === 'mindmap') {
    const parents = new Map(nodes.map(node => [node.id, node.parentId]).filter(([, parentId]) => parentId));
    nodes.forEach(node => { const seen = new Set([node.id]); let current = node.parentId; while (current) { if (seen.has(current)) { errors.push({ code: 'MINDMAP_CYCLE', path: `nodes.${node.id}.parentId`, message: 'Mindmap parent relationships must be acyclic.' }); break; } seen.add(current); current = parents.get(current); } });
  }
  return { valid: errors.length === 0, errors, warnings, spec: normalized };
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

function layoutFlowNodes(graph, bounds) {
  const visited = new Map(), backEdges = new Set();
  const roots = graph.nodes.filter(node => !graph.incoming.get(node.id).length);
  for (const node of [...roots, ...graph.nodes]) {
    if (visited.has(node.id)) continue;
    const stack = [{ id: node.id, index: 0 }];
    visited.set(node.id, 'active');
    while (stack.length) {
      const frame = stack.at(-1), edges = graph.outgoing.get(frame.id);
      if (frame.index === edges.length) { visited.set(frame.id, 'done'); stack.pop(); continue; }
      const edge = edges[frame.index++];
      if (visited.get(edge.to) === 'active') backEdges.add(edge);
      else if (!visited.has(edge.to)) { visited.set(edge.to, 'active'); stack.push({ id: edge.to, index: 0 }); }
    }
  }
  const rank = new Map(graph.nodes.map(node => [node.id, 0]));
  const pending = new Map(graph.nodes.map(node => [node.id, graph.incoming.get(node.id).filter(edge => !backEdges.has(edge)).length]));
  const queue = graph.nodes.filter(node => !pending.get(node.id)).map(node => node.id);
  for (let index = 0; index < queue.length; index += 1) {
    graph.outgoing.get(queue[index]).filter(edge => !backEdges.has(edge)).forEach(edge => {
      rank.set(edge.to, Math.max(rank.get(edge.to), rank.get(edge.from) + 1));
      pending.set(edge.to, pending.get(edge.to) - 1);
      if (!pending.get(edge.to)) queue.push(edge.to);
    });
  }
  const columns = new Map();
  graph.nodes.forEach(node => {
    const depth = rank.get(node.id);
    if (!columns.has(depth)) columns.set(depth, []);
    const small = node.kind === 'connector';
    columns.get(depth).push({ node, width: node.size?.width ?? (small ? 28 : 112), height: node.size?.height ?? (small ? 28 : 36) });
  });
  const ordered = [...columns.entries()].sort(([left], [right]) => left - right).map(([, nodes]) => nodes);
  const widths = ordered.map(nodes => Math.max(...nodes.map(node => node.width)));
  const gap = ordered.length > 1 ? Math.max(16, Math.min(48, (bounds.width - widths.reduce((sum, width) => sum + width, 0)) / (ordered.length - 1))) : 0;
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, ordered.length - 1);
  const positions = {};
  let columnX = bounds.x + Math.max(0, (bounds.width - totalWidth) / 2);
  ordered.forEach((nodes, index) => {
    const height = nodes.reduce((sum, node) => sum + node.height, 0), rowGap = nodes.length > 1 ? Math.max(12, Math.min(24, (bounds.height - height) / (nodes.length - 1))) : 0;
    const totalHeight = height + rowGap * Math.max(0, nodes.length - 1);
    let rowY = bounds.y + Math.max(0, (bounds.height - totalHeight) / 2);
    nodes.forEach(item => { positions[item.node.id] = { x: columnX + (widths[index] - item.width) / 2, y: rowY, width: item.width, height: item.height }; rowY += item.height + rowGap; });
    columnX += widths[index] + gap;
  });
  return positions;
}

export function layoutDiagram(spec, bounds = { x: 0, y: 0, width: 640, height: 360 }) {
  const graph = diagramGraph(spec), mode = graph.spec.diagram.layout, positions = new Map(), gapX = Math.max(150, bounds.width / Math.max(1, graph.nodes.length)), gapY = 72;
  if (graph.spec.type === 'flow' && mode === 'layered' && !graph.spec.lanes.length) return layoutFlowNodes(graph, bounds);
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
      const levels = new Map();
      ordered.forEach(item => { if (!levels.has(item.depth)) levels.set(item.depth, []); levels.get(item.depth).push(item); });
      const columns = [...levels.entries()].sort(([left], [right]) => left - right);
      const nodeSize = node => ({ width: Number(node?.size?.width) || 112, height: Number(node?.size?.height) || 36 });
      const columnWidths = columns.map(([, items]) => Math.max(...items.map(item => nodeSize(graph.nodes.find(node => node.id === item.id)).width)));
      const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
      const availableGap = columns.length > 1 ? (bounds.width - totalWidth) / (columns.length - 1) : 0;
      const columnGap = columns.length > 1 ? Math.max(8, Math.min(32, availableGap)) : 0;
      let x = bounds.x;
      columns.forEach(([depth, items], columnIndex) => {
        const columnWidth = columnWidths[columnIndex];
        items.forEach((item, index) => {
          const node = graph.nodes.find(candidate => candidate.id === item.id), size = nodeSize(node);
          const centerY = bounds.y + (index + 1) * bounds.height / (items.length + 1);
          positions.set(item.id, { x, y: Math.max(bounds.y, Math.min(bounds.y + bounds.height - size.height, centerY - size.height / 2)), width: size.width, height: size.height });
        });
        x += columnWidth + columnGap;
      });
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
  positions.forEach(position => {
    position.x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - (position.width || 0), snap(position.x)));
    position.y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - (position.height || 0), snap(position.y)));
  });
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

export function reconnectOrthogonalWaypoints(points, start, end, storedWaypoints) {
  const source = points[0], target = points.at(-1);
  const sourceDelta = { x: start.x - source.x, y: start.y - source.y }, targetDelta = { x: end.x - target.x, y: end.y - target.y };
  if (!sourceDelta.x && !sourceDelta.y && !targetDelta.x && !targetDelta.y) return storedWaypoints;
  if (Math.abs(sourceDelta.x - targetDelta.x) < 1e-9 && Math.abs(sourceDelta.y - targetDelta.y) < 1e-9) return storedWaypoints.map(point => ({
    x: point.x === source.x ? start.x : point.x === target.x ? end.x : point.x + sourceDelta.x,
    y: point.y === source.y ? start.y : point.y === target.y ? end.y : point.y + sourceDelta.y
  }));
  const unique = points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  const compact = unique.filter((point, index) => {
    const previous = unique[index - 1], next = unique[index + 1];
    if (!previous || !next) return true;
    return !((previous.x === point.x && point.x === next.x || previous.y === point.y && point.y === next.y) && (point.x - previous.x) * (next.x - point.x) + (point.y - previous.y) * (next.y - point.y) > 0);
  });
  const waypoints = compact.slice(1, -1).map(point => ({ ...point }));
  const sourceHorizontal = compact[0].y === compact[1].y, targetHorizontal = compact.at(-1).y === compact.at(-2).y;
  if (waypoints.length < 2) {
    const anchor = waypoints[0] || storedWaypoints[Math.floor(storedWaypoints.length / 2)];
    if (sourceHorizontal && targetHorizontal) return [{ x: anchor.x, y: start.y }, { x: anchor.x, y: end.y }];
    if (!sourceHorizontal && !targetHorizontal) return [{ x: start.x, y: anchor.y }, { x: end.x, y: anchor.y }];
    return [sourceHorizontal ? { x: end.x, y: start.y } : { x: start.x, y: end.y }];
  }
  if (waypoints.length === 2) {
    waypoints[0][sourceHorizontal ? 'y' : 'x'] = start[sourceHorizontal ? 'y' : 'x'];
    waypoints[1][targetHorizontal ? 'y' : 'x'] = end[targetHorizontal ? 'y' : 'x'];
    return waypoints;
  }
  const first = waypoints[0], second = waypoints[1], last = waypoints.at(-1), previous = waypoints.at(-2);
  const sourceJoin = first.x === second.x ? 'x' : 'y', targetJoin = last.x === previous.x ? 'x' : 'y';
  first.x += sourceDelta.x;
  first.y += sourceDelta.y;
  second[sourceJoin] = first[sourceJoin];
  last.x += targetDelta.x;
  last.y += targetDelta.y;
  previous[targetJoin] = last[targetJoin];
  return waypoints;
}

function obstacleBounds(obstacle) {
  if (obstacle?.bounds && Number.isFinite(obstacle.bounds.x) && Number.isFinite(obstacle.bounds.y) && Number.isFinite(obstacle.bounds.width) && Number.isFinite(obstacle.bounds.height)) return obstacle.bounds;
  return obstacle;
}

function obstaclePolygon(obstacle, padding = 0) {
  const bounds = obstacleBounds(obstacle), shape = obstacle?.shape || 'rect', geometry = obstacle?.geometry || bounds;
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return [];
  if (shape === 'ellipse' || shape === 'circle') {
    const cx = Number(geometry.cx ?? bounds.x + bounds.width / 2), cy = Number(geometry.cy ?? bounds.y + bounds.height / 2);
    const rx = Number(geometry.rx ?? geometry.r ?? bounds.width / 2) + padding, ry = Number(geometry.ry ?? geometry.r ?? bounds.height / 2) + padding;
    return Array.from({ length: 24 }, (_, index) => { const angle = index / 24 * Math.PI * 2; return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) }; });
  }
  if (Array.isArray(geometry.points) && geometry.points.length >= 3 && geometry.closed !== false) {
    const center = geometry.points.reduce((result, point) => ({ x: result.x + point.x / geometry.points.length, y: result.y + point.y / geometry.points.length }), { x: 0, y: 0 });
    return geometry.points.map(point => {
      const dx = point.x - center.x, dy = point.y - center.y, length = Math.hypot(dx, dy) || 1;
      return { x: point.x + dx / length * padding, y: point.y + dy / length * padding };
    });
  }
  const expanded = { x: bounds.x - padding, y: bounds.y - padding, width: bounds.width + padding * 2, height: bounds.height + padding * 2 };
  return [{ x: expanded.x, y: expanded.y }, { x: expanded.x + expanded.width, y: expanded.y }, { x: expanded.x + expanded.width, y: expanded.y + expanded.height }, { x: expanded.x, y: expanded.y + expanded.height }];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index], prior = polygon[previous];
    if ((current.y > point.y) !== (prior.y > point.y) && point.x < (prior.x - current.x) * (point.y - current.y) / ((prior.y - current.y) || Number.EPSILON) + current.x) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(first, second, third, fourth) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const onSegment = (a, b, c) => Math.min(a.x, b.x) <= c.x + 1e-9 && c.x <= Math.max(a.x, b.x) + 1e-9 && Math.min(a.y, b.y) <= c.y + 1e-9 && c.y <= Math.max(a.y, b.y) + 1e-9;
  const firstTurn = Math.sign(cross(first, second, third)), secondTurn = Math.sign(cross(first, second, fourth)), thirdTurn = Math.sign(cross(third, fourth, first)), fourthTurn = Math.sign(cross(third, fourth, second));
  return firstTurn * secondTurn < 0 && thirdTurn * fourthTurn < 0 || firstTurn === 0 && onSegment(first, second, third) || secondTurn === 0 && onSegment(first, second, fourth) || thirdTurn === 0 && onSegment(third, fourth, first) || fourthTurn === 0 && onSegment(third, fourth, second);
}

function segmentIntersectsObstacle(first, second, obstacle, padding = 0) {
  const polygon = obstaclePolygon(obstacle, Math.max(padding, Number(obstacle?.padding) || 0));
  if (polygon.length < 3) return false;
  if (pointInPolygon(first, polygon) || pointInPolygon(second, polygon)) return true;
  return polygon.some((point, index) => segmentsIntersect(first, second, point, polygon[(index + 1) % polygon.length]));
}

function pathHitsObstacles(points, obstacles, padding = 0) {
  return points.some((point, index) => index > 0 && obstacles.some(obstacle => segmentIntersectsObstacle(points[index - 1], point, obstacle, padding)));
}

function pathIntersectsItself(points) {
  return points.some((point, index) => {
    if (!index) return false;
    const previous = points[index - 1], next = points[index + 1];
    if (next && (point.x - previous.x) * (next.y - point.y) === (point.y - previous.y) * (next.x - point.x) && (point.x - previous.x) * (next.x - point.x) + (point.y - previous.y) * (next.y - point.y) < 0) return true;
    return points.slice(0, index - 1).some((earlier, segment) => segment > 0 && segmentsIntersect(earlier, points[segment - 1], previous, point));
  });
}

export function routeEdgePath(edge, from, to, mode = 'orthogonal') {
  const initial = diagramConnectionPoints(from, to, edge.fromPortDefinition, edge.toPortDefinition), startSide = edge.fromPortDefinition?.side || preferredSide(from, to, true), endSide = edge.toPortDefinition?.side || preferredSide(from, to, false);
  const obstacles = (edge.obstacles || []).filter(obstacle => {
    const bounds = obstacleBounds(obstacle);
    return obstacle?.obstacle !== false && bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && Number.isFinite(bounds.width) && Number.isFinite(bounds.height);
  });
  const compact = points => {
    const unique = points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
    if (mode !== 'auto') return unique;
    return unique.filter((point, index) => {
      const previous = unique[index - 1], next = unique[index + 1];
      if (!previous || !next) return true;
      return !((previous.x === point.x && point.x === next.x || previous.y === point.y && point.y === next.y) && (point.x - previous.x) * (next.x - point.x) + (point.y - previous.y) * (next.y - point.y) > 0);
    });
  };
  const leavesSide = (start, next, side) => side === 'left' ? next.x < start.x : side === 'right' ? next.x > start.x : side === 'top' ? next.y < start.y : next.y > start.y;
  const entersSide = (previous, end, side) => side === 'left' ? previous.x < end.x : side === 'right' ? previous.x > end.x : side === 'top' ? previous.y < end.y : previous.y > end.y;
  const waypoints = Array.isArray(edge.waypoints) ? edge.waypoints.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y)).map(point => ({ x: point.x, y: point.y })) : [];
  const manualRouting = edge.routingMode === 'manual' || (edge.routingMode !== 'auto' && waypoints.length > 0);
  if (manualRouting) {
    const manual = compact([initial.start, ...waypoints, initial.end]), padding = Math.max(4, Number(edge.grid) || 8) / 2;
    const orthogonal = mode === 'auto' || mode === 'orthogonal';
    const endpointInteriors = [from, to].map(box => ({ x: box.x + 0.001, y: box.y + 0.001, width: Math.max(0, box.width - 0.002), height: Math.max(0, box.height - 0.002) }));
    const reason = !waypoints.length ? 'EMPTY_WAYPOINTS'
      : orthogonal && manual.some((point, index) => index && point.x !== manual[index - 1].x && point.y !== manual[index - 1].y) ? 'ORTHOGONAL_REQUIRED'
        : pathIntersectsItself(manual) ? 'SELF_INTERSECTION'
          : manual.length < 2 || !leavesSide(manual[0], manual[1], startSide) || !entersSide(manual.at(-2), manual.at(-1), endSide) ? 'PORT_DIRECTION'
          : pathHitsObstacles(manual, obstacles, padding) || pathHitsObstacles(manual, endpointInteriors) ? 'NODE_INTERSECTION' : null;
    if (!reason) return { points: manual, curve: null, routingMode: 'manual' };
    const fallback = routeEdgePath({ ...edge, routingMode: 'auto', waypoints: [] }, from, to, 'auto');
    const warning = { code: 'EDGE_MANUAL_ROUTE_INVALID', reason, message: `Manual connector route is invalid (${reason}); a safe automatic route is displayed instead.`, suggestion: 'Keep orthogonal segments, respect connection sides, avoid node interiors and self-intersections, or set routingMode to auto.' };
    return { ...fallback, routingMode: 'auto', warning, warnings: [warning, ...(fallback.warning ? [fallback.warning] : [])] };
  }
  const direct = [initial.start, initial.end], directPadding = Math.max(4, Number(edge.grid) || 8) / 2;
  const axisAligned = initial.start.x === initial.end.x || initial.start.y === initial.end.y;
  const directAccess = leavesSide(initial.start, initial.end, startSide) && entersSide(initial.start, initial.end, endSide);
  if (mode === 'straight' && !pathHitsObstacles(direct, obstacles, directPadding)) return { points: direct, curve: null };
  if (mode === 'auto' && axisAligned && directAccess && !pathHitsObstacles(direct, obstacles, directPadding)) return { points: direct, curve: null };
  if (mode === 'curved') {
    const tension = Math.max(0.2, Math.min(0.8, Number(edge.curveTension) || 0.4)), distance = Math.hypot(initial.end.x - initial.start.x, initial.end.y - initial.start.y), bend = Math.max(24, distance * tension);
    const direction = side => side === 'left' ? { x: -1, y: 0 } : side === 'right' ? { x: 1, y: 0 } : side === 'top' ? { x: 0, y: -1 } : { x: 0, y: 1 };
    const startDirection = direction(startSide), endDirection = direction(endSide);
    const points = [initial.start, { x: initial.start.x + startDirection.x * bend, y: initial.start.y + startDirection.y * bend }, { x: initial.end.x + endDirection.x * bend, y: initial.end.y + endDirection.y * bend }, initial.end];
    const samples = sampleCubicBezier(points, 24), padding = Math.max(4, Number(edge.grid) || 8) / 2;
    if (!pathHitsObstacles(samples, obstacles, padding)) return { points, curve: 'cubic' };
    return routeEdgePath({ ...edge, waypoints: [] }, from, to, 'orthogonal');
  }
  const sidePairs = edge.preserveSides || edge.fromPortDefinition || edge.toPortDefinition ? [[startSide, endSide]] : [[startSide, endSide], ...['right', 'left', 'top', 'bottom'].flatMap(fromSide => ['right', 'left', 'top', 'bottom'].map(toSide => [fromSide, toSide]))].filter((pair, index, pairs) => pairs.findIndex(item => item[0] === pair[0] && item[1] === pair[1]) === index);
  const endpointInteriors = [from, to].map(box => ({ x: box.x + 0.001, y: box.y + 0.001, width: Math.max(0, box.width - 0.002), height: Math.max(0, box.height - 0.002) }));
  const routeForSides = (fromSide, toSide) => {
    const fromPort = edge.fromPortDefinition || { side: fromSide }, toPort = edge.toPortDefinition || { side: toSide }, { start, end } = diagramConnectionPoints(from, to, fromPort, toPort), padding = Math.max(12, Number(edge.grid) || 8);
    const localRouting = mode === 'auto' || mode === 'orthogonal';
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
    const terminalLength = points => Math.min(Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), Math.hypot(points.at(-1).x - points.at(-2).x, points.at(-1).y - points.at(-2).y));
    const validPath = points => connectionAccess(points) && !pathIntersectsItself(points) && (mode !== 'auto' || terminalLength(points) >= padding) && !pathHitsObstacles(points, obstacles, padding) && (mode !== 'auto' || !pathHitsObstacles(points, endpointInteriors));
    const snap = value => { const grid = Number(edge.grid) || 8; return Math.round(value / grid) * grid; };
    const middle = snap((start.x + end.x) / 2), middleY = snap((start.y + end.y) / 2);
    const xChannels = new Set([start.x, end.x, middle]), yChannels = new Set([start.y, end.y, middleY]);
    const channelGap = padding + (Number(edge.grid) || 8);
    if (localRouting) [from, to].forEach(box => {
      [box.x - channelGap, box.x + box.width + channelGap].forEach(x => xChannels.add(snap(x)));
      [box.y - channelGap, box.y + box.height + channelGap].forEach(y => yChannels.add(snap(y)));
    });
    const length = points => points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
    const score = points => length(points) + (mode === 'auto' ? Math.max(0, points.length - 2) * padding * 2 : 0);
    const bestRoute = () => {
      const candidates = [
        [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end],
        [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end]
      ];
      xChannels.forEach(x => candidates.push([start, { x, y: start.y }, { x, y: end.y }, end]));
      yChannels.forEach(y => candidates.push([start, { x: start.x, y }, { x: end.x, y }, end]));
      xChannels.forEach(x => yChannels.forEach(y => {
        candidates.push([start, { x, y: start.y }, { x, y }, { x, y: end.y }, end]);
        candidates.push([start, { x: start.x, y }, { x, y }, { x: end.x, y }, end]);
      }));
      if (localRouting) {
        const stub = (point, side) => ({ x: point.x + (side === 'left' ? -channelGap : side === 'right' ? channelGap : 0), y: point.y + (side === 'top' ? -channelGap : side === 'bottom' ? channelGap : 0) });
        const sourceStub = stub(start, fromSide), targetStub = stub(end, toSide);
        yChannels.forEach(y => candidates.push([start, sourceStub, { x: sourceStub.x, y }, { x: targetStub.x, y }, targetStub, end]));
        xChannels.forEach(x => candidates.push([start, sourceStub, { x, y: sourceStub.y }, { x, y: targetStub.y }, targetStub, end]));
      }
      return candidates.map(compact).filter(validPath).sort((left, right) => score(left) - score(right) || left.length - right.length || JSON.stringify(left).localeCompare(JSON.stringify(right)))[0] || null;
    };
    if (localRouting) {
      const localRoute = bestRoute();
      if (localRoute) return localRoute;
    }
    obstacles.forEach(obstacle => {
      const box = obstacleBounds(obstacle);
      [box.x - channelGap, box.x + box.width + channelGap].forEach(x => xChannels.add(snap(x)));
      [box.y - channelGap, box.y + box.height + channelGap].forEach(y => yChannels.add(snap(y)));
    });
    return bestRoute();
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
  if (mode === 'auto') return { points: [], curve: null, warning: { code: 'EDGE_ROUTE_BLOCKED', message: 'No obstacle-free orthogonal route was found. The connector is hidden rather than drawing a misleading diagonal or crossing a node.', suggestion: 'Separate overlapping nodes or adjust the ports and node positions.' } };
  if (!pathHitsObstacles(direct, obstacles, directPadding)) return { points: direct, curve: null };
  return { points: direct, curve: null, warning: { code: 'EDGE_ROUTE_BLOCKED', message: 'No obstacle-free route was found; the direct connector is retained as a last-resort fallback.' } };
}

export function routeEdge(edge, from, to, mode = 'orthogonal') {
  return routeEdgePath(edge, from, to, mode).points;
}

export function normalizeDiagramData(spec) {
  const normalized = normalizeDiagramSpec(spec);
  return { ...normalized, nodes: normalized.nodes.map(node => ({ ...node })) };
}
