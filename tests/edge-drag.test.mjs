import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, getBusinessSchema } from '../src/index.mjs';
import { diagramPointer } from '../src/diagram-interaction.mjs';

function editableChart(type, renderer, view, edge = {}) {
  const nodes = [
    { id: 'source', label: 'Source', position: { x: 40, y: 80 }, size: { width: 100, height: 40 }, ports: [{ id: 'out', side: 'right' }] },
    { id: 'target', label: 'Target', position: { x: 360, y: 200 }, size: { width: 100, height: 40 }, ports: [{ id: 'in', side: 'left' }] }
  ];
  if (type === 'mindmap') nodes.forEach(node => { delete node.size; delete node.ports; });
  return createChart({
    type, renderer, view, width: 1000, height: 700,
    nodes,
    edges: [{ id: 'link', from: 'source', to: 'target', ...(type !== 'mindmap' ? { fromPort: 'out', toPort: 'in' } : {}), ...edge }],
    ...(type === 'swimlane' ? { lanes: [{ id: 'first', label: 'First' }, { id: 'second', label: 'Second' }] } : {}),
    data: { schema: getBusinessSchema(type === 'swimlane' ? 'flow-node' : `${type}-node`), edgeSchema: getBusinessSchema(type === 'swimlane' ? 'flow-edge' : `${type}-edge`) },
    diagram: { layout: 'manual', routing: 'auto', grid: 8 },
    interaction: { edgeDrag: true },
    editing: { enabled: true, requireConfirmation: false }
  });
}

function dragSegment(chart, pointerId) {
  let handle;
  chart.model.scene.walk(node => { if (!handle && node.dataRef?.edgeHandle === 'segment') handle = node; });
  assert.ok(handle, 'segment handles remain available');
  const start = { x: handle.geometry.x + handle.geometry.width / 2, y: handle.geometry.y + handle.geometry.height / 2 };
  const first = handle.dataRef.routePoints[handle.dataRef.segmentIndex];
  const second = handle.dataRef.routePoints[handle.dataRef.segmentIndex + 1];
  const axis = first.x === second.x ? 'x' : 'y';
  const view = chart.model.state.view;
  const end = { ...start, [axis]: start[axis] + 24 * view.scale };
  const expected = Math.round(((end[axis] - (axis === 'x' ? view.offsetX : view.offsetY)) / view.scale) / 8) * 8;
  const target = { focus() {}, setPointerCapture() {}, hasPointerCapture() { return false; } };
  chart._eventPoint = event => ({ x: event.clientX, y: event.clientY });
  const pointer = point => ({ pointerId, clientX: point.x, clientY: point.y });
  diagramPointer(chart, 'start', { type: 'pointerdown', button: 0, ...pointer(start) }, target);
  diagramPointer(chart, 'move', { type: 'pointermove', ...pointer(end) }, target);
  const preview = structuredClone(chart.model.scene.find('edge-0').geometry.points);
  diagramPointer(chart, 'end', { type: 'pointerup', ...pointer(end) }, target);
  assert.equal(chart.getDiagramEdges()[0].routingMode, 'manual');
  assert.equal(chart.getDiagramEdges()[0].waypoints[handle.dataRef.segmentIndex - 1][axis], expected, 'waypoints use diagram coordinates');
  assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, preview, 'pointer release preserves preview');
  chart.render();
  assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, preview, 'rerender preserves the committed path');
  return preview;
}

for (const type of ['flow', 'architecture', 'mindmap', 'swimlane']) {
  for (const renderer of ['svg', 'canvas']) {
    for (const view of [{ scale: 1, offsetX: 0, offsetY: 0 }, { scale: 1.5, offsetX: 32, offsetY: -16 }]) {
      test(`${type}/${renderer} persists repeated edge drags at scale ${view.scale}`, () => {
        const chart = editableChart(type, renderer, view, { routingMode: 'auto' });
        try {
          chart.selectEdges(['link']);
          const original = structuredClone(chart.model.scene.find('edge-0').geometry.points);
          const first = dragSegment(chart, 1);
          const second = dragSegment(chart, 2);
          const restored = createChart(chart.getSpec());
          assert.deepEqual(restored.model.scene.find('edge-0').geometry.points, second, 'serialized spec restores the edited route');
          restored.destroy();
          assert.notDeepEqual(first, original);
          assert.notDeepEqual(second, first);
          assert.equal(chart.undo().valid, true);
          assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, first);
          assert.equal(chart.undo().valid, true);
          assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, original);
          assert.equal(chart.redo().valid, true);
          assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, first);
          assert.equal(chart.redo().valid, true);
          assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, second);
        } finally {
          chart.destroy();
        }
      });
    }
  }
}

test('editing a Flow edge label does not discard an existing waypoint route without routingMode', () => {
  const chart = editableChart('flow', 'svg', {}, { waypoints: [{ x: 240, y: 100 }, { x: 240, y: 220 }] });
  try {
    const original = structuredClone(chart.model.scene.find('edge-0').geometry.points);
    const command = { type: 'layout-edit', operations: [{ op: 'updateEdge', edgeId: 'link', changes: { label: 'Updated' } }] };
    assert.equal(chart.applyEdit(command, { confirmed: true }).valid, true);
    assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, original);
  } finally {
    chart.destroy();
  }
});

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer} persists repeated waypoint drags without snapping after zoom and pan`, () => {
    const chart = editableChart('flow', renderer, { scale: 1.5, offsetX: 32, offsetY: -16 });
    try {
      chart.selectEdges(['link']);
      chart._eventPoint = event => ({ x: event.clientX, y: event.clientY });
      const target = { focus() {}, setPointerCapture() {}, hasPointerCapture() { return false; } };
      for (const pointerId of [1, 2]) {
        let handle;
        chart.model.scene.walk(node => { if (!handle && node.dataRef?.edgeHandle === 'waypoint') handle = node; });
        assert.ok(handle);
        const start = { x: handle.geometry.cx, y: handle.geometry.cy };
        const end = { x: start.x + 16.25 * chart.model.state.view.scale, y: start.y };
        const pointer = point => ({ pointerId, altKey: true, clientX: point.x, clientY: point.y });
        diagramPointer(chart, 'start', { type: 'pointerdown', ...pointer(start) }, target);
        diagramPointer(chart, 'move', { type: 'pointermove', ...pointer(end) }, target);
        const preview = structuredClone(chart.model.scene.find('edge-0').geometry.points);
        diagramPointer(chart, 'end', { type: 'pointerup', ...pointer(end) }, target);
        assert.equal(chart.getDiagramEdges()[0].routingMode, 'manual');
        assert.equal(chart.getDiagramEdges()[0].waypoints[0].x, (end.x - 32) / 1.5);
        assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, preview);
      }
      const command = { type: 'layout-edit', operations: [{ op: 'updateEdge', edgeId: 'link', changes: { routingMode: 'auto' } }] };
      assert.equal(chart.applyEdit(command, { confirmed: true }).valid, true);
      assert.equal(chart.getDiagramEdges()[0].routingMode, 'auto');
      assert.notEqual(chart.model.scene.find('edge-0').geometry.points[1].x, chart.getDiagramEdges()[0].waypoints[0].x * 1.5 + 32);
    } finally {
      chart.destroy();
    }
  });
}
