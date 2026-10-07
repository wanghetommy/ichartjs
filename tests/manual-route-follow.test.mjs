import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, getBusinessSchema } from '../src/index.mjs';
import { diagramPointer } from '../src/diagram-interaction.mjs';
import { reconnectOrthogonalWaypoints } from '../src/diagram.mjs';

function fixture(type = 'flow', renderer = 'svg', view = {}) {
  const nodes = [
    { id: 'review', label: 'Review', position: { x: 300, y: 110 }, size: { width: 150, height: 52 }, ports: [{ id: 'out', side: 'right' }] },
    { id: 'qa', label: 'QA', position: { x: 300, y: 220 }, size: { width: 120, height: 44 }, ports: [{ id: 'in', side: 'left' }] }
  ];
  if (type === 'mindmap') nodes.forEach(node => { delete node.ports; });
  return createChart({
    type, renderer, view, width: 1000, height: 650,
    nodes, edges: [{ id: 'verify', from: 'review', to: 'qa', ...(type === 'mindmap' ? {} : { fromPort: 'out', toPort: 'in' }), label: 'verify' }],
    ...(type === 'swimlane' ? { lanes: [{ id: 'lane', label: 'Lane' }] } : {}),
    data: { schema: getBusinessSchema(type === 'swimlane' ? 'flow-node' : `${type}-node`), edgeSchema: getBusinessSchema(type === 'swimlane' ? 'flow-edge' : `${type}-edge`) },
    diagram: { layout: 'manual', routing: 'auto', grid: 8 }, interaction: { drag: true, edgeDrag: true },
    editing: { enabled: true, requireConfirmation: false }
  });
}

function pointerDrag(chart, start, end) {
  const target = {}, pointer = point => ({ pointerId: 1, clientX: point.x, clientY: point.y, altKey: true });
  chart._eventPoint = event => ({ x: event.clientX, y: event.clientY });
  diagramPointer(chart, 'start', { type: 'pointerdown', ...pointer(start) }, target);
  diagramPointer(chart, 'move', { type: 'pointermove', ...pointer(end) }, target);
  return { end(type = 'pointerup') { diagramPointer(chart, 'end', { type, ...pointer(end) }, target); } };
}

function moveChannel(chart) {
  chart.selectEdges(['verify']);
  let handle;
  chart.model.scene.walk(node => {
    if (handle || node.dataRef?.edgeHandle !== 'segment') return;
    const points = node.dataRef.routePoints, index = node.dataRef.segmentIndex;
    if (points[index].y === points[index + 1].y) handle = node;
  });
  assert.ok(handle);
  const start = { x: handle.geometry.x + 5, y: handle.geometry.y + 5 }, view = chart.model.state.view;
  pointerDrag(chart, start, { x: start.x, y: start.y + 8 * view.scale }).end();
  assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
  const index = handle.dataRef.segmentIndex - 1;
  return { index, y: chart.getDiagramEdges()[0].waypoints[index].y };
}

function nodeDrag(chart, nodeId, delta) {
  const bounds = chart.model.scene.find(`node-${nodeId}`).bounds, view = chart.model.state.view;
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return pointerDrag(chart, start, { x: start.x + delta.x * view.scale, y: start.y + delta.y * view.scale });
}

function assertChannel(chart, channel) {
  const waypoints = chart.getDiagramEdges()[0].waypoints;
  assert.equal(waypoints[channel.index].y, channel.y);
  assert.equal(waypoints[channel.index + 1].y, channel.y);
  assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
  assert.equal(chart.getState().edgeRoutes[0].reason, null);
  const points = chart.model.scene.find('edge-0').geometry.points;
  assert.ok(points.every((point, index) => !index || point.x === points[index - 1].x || point.y === points[index - 1].y));
}

for (const type of ['flow', 'architecture', 'mindmap', 'swimlane']) {
  for (const renderer of ['svg', 'canvas']) {
    for (const view of [{ scale: 1, offsetX: 0, offsetY: 0 }, { scale: 1.3, offsetX: 32.7, offsetY: -16.3 }]) {
      test(`${type}/${renderer}/${view.scale}: dragged channel follows endpoint edits without resetting`, () => {
        const chart = fixture(type, renderer, view);
        try {
          const channel = moveChannel(chart), before = chart.getSpec();
          const drag = nodeDrag(chart, 'qa', { x: 24, y: 16 });
          const previewPoints = structuredClone(chart.model.scene.find('edge-0').geometry.points);
          assert.equal(chart.model.state.edgeRoutes[0].effectiveRoutingMode, 'manual');
          const previewChannel = chart.model.scene.find('edge-0').dataRef.diagramPoints;
          assert.equal(previewChannel[channel.index + 1].y, channel.y);
          assert.deepEqual(chart.getSpec(), before, 'preview does not mutate the committed Spec');
          drag.end();
          assertChannel(chart, channel);
          assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, previewPoints);
          assert.equal(chart.getState().history.undo, 2);
          const after = chart.getSpec(), restored = createChart(after);
          assertChannel(restored, channel);
          assert.deepEqual(restored.model.scene.find('edge-0').geometry.points, previewPoints);
          restored.destroy();
          assert.equal(chart.undo().valid, true);
          assert.deepEqual(chart.getSpec(), before);
          assertChannel(chart, channel);
          assert.equal(chart.redo().valid, true);
          assert.deepEqual(chart.getSpec(), after);
          const next = nodeDrag(chart, 'review', { x: 16, y: -8 });
          next.end();
          assertChannel(chart, channel);
        } finally { chart.destroy(); }
      });
    }
  }
}

test('Agent move/resize previews include endpoint waypoint changes atomically', () => {
  const chart = fixture();
  try {
    const channel = moveChannel(chart);
    chart.update({ editing: { enabled: true, requireConfirmation: true } });
    const before = chart.getSpec();
    const command = { type: 'layout-edit', operations: [{ op: 'moveNode', nodeId: 'qa', position: { x: 332, y: 244 } }, { op: 'resizeNode', nodeId: 'review', size: { width: 174, height: 60 } }] };
    const preview = chart.previewEdit(command);
    assert.equal(preview.valid, true);
    assert.ok(preview.command.operations.some(operation => operation.op === 'updateEdge' && operation.edgeId === 'verify'));
    assert.ok(preview.targets.edges);
    assert.deepEqual(chart.getSpec(), before);
    assert.equal(chart.applyEdit(command, { preview, confirmed: true }).valid, true);
    assertChannel(chart, channel);
    assert.equal(chart.getState().history.undo, 1);
    chart.undo();
    assert.deepEqual(chart.getSpec(), before);
  } finally { chart.destroy(); }
});

for (const delta of [{ x: 24, y: 16 }, { x: 12.7, y: 20.3 }]) test(`group translation ${delta.x}/${delta.y} moves the entire manual route with its nodes`, () => {
  const chart = fixture();
  try {
    chart.update({ groups: [{ id: 'delivery', label: 'Delivery' }], nodes: chart.getDiagramNodes().map(node => ({ ...node, groupId: 'delivery' })) });
    moveChannel(chart);
    const before = structuredClone(chart.getDiagramEdges()[0].waypoints);
    assert.equal(chart.applyEdit({ type: 'layout-edit', operations: [{ op: 'moveGroup', groupId: 'delivery', delta }] }, { confirmed: true }).valid, true);
    assert.deepEqual(chart.getDiagramEdges()[0].waypoints, before.map(point => ({ x: point.x + delta.x, y: point.y + delta.y })));
    assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
    chart.undo();
    assert.deepEqual(chart.getDiagramEdges()[0].waypoints, before);
  } finally { chart.destroy(); }
});

test('moving an unrelated node leaves a manual route untouched', () => {
  const chart = fixture();
  try {
    chart.update({ nodes: [...chart.getDiagramNodes(), { id: 'done', label: 'Done', position: { x: 700, y: 400 }, size: { width: 100, height: 40 } }] });
    const channel = moveChannel(chart), before = chart.getDiagramEdges()[0];
    assert.equal(chart.applyEdit({ type: 'layout-edit', operations: [{ op: 'moveNode', nodeId: 'done', position: { x: 720, y: 420 } }] }, { confirmed: true }).valid, true);
    assert.deepEqual(chart.getDiagramEdges()[0], before);
    assertChannel(chart, channel);
  } finally { chart.destroy(); }
});

test('fractional group movement preserves the translated channel and exact port joins', () => {
  const chart = fixture();
  try {
    chart.update({ groups: [{ id: 'delivery', label: 'Delivery' }], nodes: chart.getDiagramNodes().map(node => ({ ...node, groupId: 'delivery', ...(node.id === 'qa' ? { size: { width: 120, height: 44.2 } } : {}) })) });
    const channel = moveChannel(chart);
    const result = chart.applyEdit({ type: 'layout-edit', operations: [{ op: 'moveGroup', groupId: 'delivery', delta: { x: 12.7, y: 20.3 } }] }, { confirmed: true });
    assert.equal(result.valid, true);
    const waypoints = chart.getDiagramEdges()[0].waypoints;
    assert.ok(Math.abs(waypoints[channel.index].y - channel.y - 20.3) < 1e-9);
    assert.equal(waypoints[channel.index].y, waypoints[channel.index + 1].y);
    assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
    const points = chart.model.scene.find('edge-0').dataRef.diagramPoints;
    assert.ok(points.every((point, index) => !index || point.x === points[index - 1].x || point.y === points[index - 1].y));
  } finally { chart.destroy(); }
});

test('endpoint movement does not persist a repair that crosses a real obstacle', () => {
  const chart = fixture();
  try {
    chart.update({ nodes: [...chart.getDiagramNodes(), { id: 'blocker', label: 'Blocker', position: { x: 600, y: 180 }, size: { width: 100, height: 40 } }] });
    moveChannel(chart);
    const before = chart.getDiagramEdges()[0].waypoints;
    const result = chart.applyEdit({ type: 'layout-edit', operations: [{ op: 'moveNode', nodeId: 'qa', position: { x: 730, y: 236 } }] }, { confirmed: true });
    assert.equal(result.valid, true);
    assert.deepEqual(chart.getDiagramEdges()[0].waypoints, before);
    assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'auto');
    assert.ok(chart.getState().warnings.some(warning => warning.code === 'EDGE_MANUAL_ROUTE_INVALID'));
  } finally { chart.destroy(); }
});

test('a two-bend vertical channel retains its X coordinate when the target moves', () => {
  const chart = fixture();
  try {
    chart.update({ nodes: chart.getDiagramNodes().map(node => node.id === 'qa' ? { ...node, position: { x: 650, y: 220 } } : node), edges: [{ ...chart.getDiagramEdges()[0], routingMode: 'manual', waypoints: [{ x: 540, y: 136 }, { x: 540, y: 242 }] }] });
    assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
    assert.equal(chart.applyEdit({ type: 'layout-edit', operations: [{ op: 'moveNode', nodeId: 'qa', position: { x: 670, y: 236 } }] }, { confirmed: true }).valid, true);
    assert.deepEqual(chart.getDiagramEdges()[0].waypoints, [{ x: 540, y: 136 }, { x: 540, y: 258 }]);
    assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
  } finally { chart.destroy(); }
});

test('cancelling a node drag preserves the manual route and history', () => {
  const chart = fixture();
  try {
    const channel = moveChannel(chart), before = chart.getSpec(), history = chart.getState().history;
    const drag = nodeDrag(chart, 'qa', { x: 24, y: 16 });
    drag.end('pointercancel');
    assert.deepEqual(chart.getSpec(), before);
    assert.deepEqual(chart.getState().history, history);
    assertChannel(chart, channel);
  } finally { chart.destroy(); }
});

test('explicitly invalid manual edits are not silently repaired by endpoint movement', () => {
  const chart = fixture();
  try {
    moveChannel(chart);
    const before = chart.getSpec();
    const command = { type: 'layout-edit', operations: [{ op: 'moveNode', nodeId: 'qa', position: { x: 320, y: 236 } }, { op: 'updateEdge', edgeId: 'verify', changes: { waypoints: [{ x: 480, y: 180 }, { x: 270, y: 200 }] } }] };
    assert.equal(chart.previewEdit(command).valid, false);
    assert.equal(chart.applyEdit(command, { confirmed: true }).valid, false);
    assert.deepEqual(chart.getSpec(), before);
  } finally { chart.destroy(); }
});

test('single-bend and collinear imported routes reconnect without losing their free coordinate', () => {
  const stored = [{ x: 200, y: 100 }];
  const points = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }];
  assert.deepEqual(reconnectOrthogonalWaypoints(points, { x: 100, y: 100 }, { x: 300, y: 120 }, stored), [{ x: 200, y: 100 }, { x: 200, y: 120 }]);
  const corner = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }];
  assert.deepEqual(reconnectOrthogonalWaypoints(corner, { x: 100, y: 120 }, { x: 220, y: 200 }, stored), [{ x: 220, y: 120 }]);
});
