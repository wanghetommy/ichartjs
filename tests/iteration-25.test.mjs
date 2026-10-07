import test from 'node:test';
import assert from 'node:assert/strict';
import { annotationPlugin, createChart, getBusinessSchema, getCapabilities } from '../src/index.mjs';
import { diagramPointer } from '../src/diagram-interaction.mjs';

const orthogonal = points => points.every((point, index) => !index || point.x === points[index - 1].x || point.y === points[index - 1].y);
const manualPoints = [{ x: 160, y: 100 }, { x: 160, y: 220 }];
function fixture(renderer, patch = {}) {
  return createChart({
    type: 'flow', renderer, width: 700, height: 400, branding: false,
    nodes: [
      { id: 'source', label: 'Source', position: { x: 40, y: 80 }, size: { width: 100, height: 40 }, ports: [{ id: 'out', side: 'right' }] },
      { id: 'target', label: 'Target', position: { x: 360, y: 200 }, size: { width: 100, height: 40 }, ports: [{ id: 'in', side: 'left' }] },
      { id: 'blocker', label: 'Blocker', kind: 'decision', position: { x: 200, y: 144 }, size: { width: 40, height: 40 } }
    ],
    edges: [{ id: 'link', from: 'source', to: 'target', fromPort: 'out', toPort: 'in', routingMode: 'manual', waypoints: manualPoints }],
    data: { schema: getBusinessSchema('flow-node'), edgeSchema: getBusinessSchema('flow-edge') },
    diagram: { layout: 'manual', routing: 'auto', grid: 8 }, interaction: { edgeDrag: true, portConnect: true },
    editing: { enabled: true, requireConfirmation: false }, ...patch
  });
}
function drag(chart, kind, move, cancel = false) {
  chart.selectEdges(['link']);
  let handle;
  chart.model.scene.walk(node => { if (!handle && node.dataRef?.edgeHandle === kind) handle = node; });
  assert.ok(handle);
  const start = kind === 'waypoint' ? { x: handle.geometry.cx, y: handle.geometry.cy } : { x: handle.geometry.x + 5, y: handle.geometry.y + 5 };
  const end = move(start, chart.model.state.view);
  const target = { focus() {}, setPointerCapture() {}, hasPointerCapture() { return false; } };
  chart._eventPoint = event => ({ x: event.clientX, y: event.clientY });
  const event = point => ({ pointerId: 1, clientX: point.x, clientY: point.y, altKey: true });
  diagramPointer(chart, 'start', { type: 'pointerdown', ...event(start) }, target);
  diagramPointer(chart, 'move', { type: 'pointermove', ...event(end) }, target);
  diagramPointer(chart, 'end', { type: cancel ? 'pointercancel' : 'pointerup', ...event(end) }, target);
}

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer}: fractional zoom and offsets do not introduce false diagonal rejection`, () => {
    const chart = fixture(renderer, { view: { scale: 1.3, offsetX: 32.7, offsetY: -16.3 } });
    try {
      const failures = [];
      chart.on('editerror', event => failures.push(event.result));
      drag(chart, 'segment', (point, view) => ({ x: point.x + 8 * view.scale, y: point.y }));
      drag(chart, 'waypoint', (point, view) => ({ x: point.x + 8 * view.scale, y: point.y + 16 * view.scale }));
      assert.deepEqual(failures, []);
      assert.equal(chart.getState().history.undo, 2);
      assert.ok(orthogonal(chart.model.scene.find('edge-0').geometry.points));
    } finally { chart.destroy(); }
  });

  test(`${renderer}: corner dragging couples adjacent bends and preserves orthogonality after zoom`, () => {
    const chart = fixture(renderer, { view: { scale: 1.5, offsetX: 24, offsetY: -16 } });
    try {
      for (let iteration = 0; iteration < 2; iteration += 1) {
        drag(chart, 'waypoint', (point, view) => ({ x: point.x + 8 * view.scale, y: point.y + 16 * view.scale }));
        const points = chart.model.scene.find('edge-0').geometry.points;
        assert.ok(orthogonal(points));
        assert.equal(chart.getDiagramEdges()[0].waypoints[0].y, 100);
        assert.equal(chart.getDiagramEdges()[0].waypoints[0].x, 168 + iteration * 8);
        assert.equal(chart.getDiagramEdges()[0].waypoints[1].x, 168 + iteration * 8);
      }
    } finally { chart.destroy(); }
  });

  test(`${renderer}: invalid drags and pointer cancellation preserve committed data and history`, () => {
    const chart = fixture(renderer);
    try {
      const original = chart.getSpec(), points = structuredClone(chart.model.scene.find('edge-0').geometry.points);
      const failures = [];
      chart.on('editerror', event => failures.push(event.result));
      drag(chart, 'segment', point => ({ x: 224, y: point.y }));
      assert.equal(failures[0].errors[0].code, 'EDGE_MANUAL_ROUTE_INVALID');
      assert.equal(failures[0].errors[0].reason, 'NODE_INTERSECTION');
      assert.deepEqual(chart.getSpec(), original);
      assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, points);
      assert.equal(chart.getState().history.undo, 0);
      drag(chart, 'segment', point => ({ x: point.x + 8, y: point.y }), true);
      assert.deepEqual(chart.getSpec(), original);
      assert.equal(chart.getState().history.undo, 0);
      drag(chart, 'segment', point => ({ x: point.x + 8, y: point.y }));
      assert.equal(chart.getState().history.undo, 1);
    } finally { chart.destroy(); }
  });

  test(`${renderer}: Agent preview and commit reject illegal manual geometry atomically`, () => {
    const chart = fixture(renderer, { editing: { enabled: true, requireConfirmation: true } });
    try {
      const original = chart.getSpec();
      for (const [waypoints, reason] of [
        [[{ x: 224, y: 100 }, { x: 224, y: 220 }], 'NODE_INTERSECTION'],
        [[{ x: 160, y: 104 }, { x: 168, y: 220 }], 'ORTHOGONAL_REQUIRED'],
        [[{ x: 120, y: 100 }, { x: 120, y: 220 }], 'PORT_DIRECTION'],
        [[{ x: 160, y: 100 }, { x: 160, y: 60 }, { x: 80, y: 60 }, { x: 80, y: 220 }], 'NODE_INTERSECTION'],
        [[], 'EMPTY_WAYPOINTS']
      ]) {
        const command = { type: 'layout-edit', operations: [{ op: 'updateEdge', edgeId: 'link', changes: { routingMode: 'manual', waypoints } }] };
        const preview = chart.previewEdit(command);
        assert.equal(preview.valid, false);
        assert.equal(preview.errors[0].reason, reason);
        assert.deepEqual(preview.targets, {});
        assert.equal(chart.applyEdit(command, { confirmed: true }).valid, false);
        assert.deepEqual(chart.getSpec(), original);
      }
      assert.equal(chart.getState().history.undo, 0);
      const command = { type: 'layout-edit', operations: [{ op: 'updateEdge', edgeId: 'link', changes: { waypoints: [{ x: 168, y: 100 }, { x: 168, y: 220 }] } }] };
      const preview = chart.previewEdit(command);
      assert.equal(preview.valid, true);
      assert.equal(preview.requiresConfirmation, true);
      assert.equal(chart.applyEdit(command, { preview }).valid, false);
      assert.equal(chart.applyEdit(command, { preview, confirmed: true }).valid, true);
      assert.equal(chart.getState().history.undo, 1);
    } finally { chart.destroy(); }
  });

  test(`${renderer}: imported invalid routes explain requested and effective modes`, () => {
    const chart = fixture(renderer, { edges: [{ id: 'link', from: 'source', to: 'target', fromPort: 'out', toPort: 'in', routingMode: 'manual', waypoints: [{ x: 224, y: 100 }, { x: 224, y: 220 }] }] });
    try {
      assert.ok(chart.getState().warnings.some(warning => warning.code === 'EDGE_MANUAL_ROUTE_INVALID'));
      assert.deepEqual(chart.getState().edgeRoutes, [{ edgeId: 'link', requestedRoutingMode: 'manual', effectiveRoutingMode: 'auto', visible: true, reason: 'NODE_INTERSECTION' }]);
      assert.deepEqual(chart.explain().edgeRoutes, chart.getState().edgeRoutes);
      assert.equal(chart.model.scene.find('edge-0').dataRef.routingMode, 'auto');
      assert.ok(orthogonal(chart.model.scene.find('edge-0').geometry.points));
    } finally { chart.destroy(); }
  });

  test(`${renderer}: manual route roundtrip, clean SVG export, and automatic-route undo are consistent`, () => {
    const chart = fixture(renderer, { view: { scale: 1.5, offsetX: 24, offsetY: -16 } });
    try {
      drag(chart, 'segment', (point, view) => ({ x: point.x + 8 * view.scale, y: point.y }));
      const manual = structuredClone(chart.model.scene.find('edge-0').geometry.points);
      const exported = chart.export({ type: 'json', as: 'object' });
      const restored = createChart(JSON.parse(JSON.stringify(exported)).spec);
      try {
        assert.deepEqual(restored.model.scene.find('edge-0').geometry.points, manual);
        assert.equal(restored.getState().history.undo, 0);
        chart.use(annotationPlugin([{ type: 'line', geometry: { x1: 20, y1: 20, x2: 80, y2: 20 } }]));
        const before = chart.getSpec(), history = chart.getState().history;
        const svg = chart.export({ type: 'svg' });
        assert.ok(svg.includes('edge-0'));
        assert.equal(svg.includes('edge-handle-'), false);
        assert.equal(svg.includes('port-source-'), false);
        assert.ok(svg.includes('annotation-line-0'));
        assert.deepEqual(chart.getSpec(), before);
        assert.deepEqual(chart.getState().history, history);
        const command = { type: 'layout-edit', operations: [{ op: 'updateEdge', edgeId: 'link', changes: { routingMode: 'auto' } }] };
        assert.equal(chart.applyEdit(command, { confirmed: true }).valid, true);
        assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'auto');
        assert.equal(chart.undo().valid, true);
        assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, manual);
        assert.equal(chart.redo().valid, true);
        assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'auto');
      } finally { restored.destroy(); }
    } finally { chart.destroy(); }
  });
}

test('publishes manual edit validation and route-state discovery without changing interaction defaults', () => {
  const capabilities = getCapabilities();
  assert.equal(capabilities.diagram.edgeEditing.manualRouteValidation, 'preview-and-commit');
  assert.equal(capabilities.diagram.edgeEditing.rejectionDiagnostic, 'EDGE_MANUAL_ROUTE_INVALID');
  assert.equal(capabilities.diagram.edgeEditing.routeState, 'getState().edgeRoutes');
  assert.equal(capabilities.interactionDefaults.edgeDrag, false);
});
