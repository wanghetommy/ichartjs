import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart } from '../src/index.mjs';
import { createChart as createDiagramChart } from '../src/diagram-profile.mjs';

function fixture(renderer, patch = {}) {
  return {
    type: 'flow', renderer, width: 1000, height: 500, branding: false,
    nodes: [
      { id: 'review', label: 'Review', groupId: 'delivery', position: { x: 300, y: 110 }, size: { width: 150, height: 52 }, ports: [{ id: 'out', side: 'right' }] },
      { id: 'qa', label: 'QA', groupId: 'delivery', position: { x: 300, y: 220 }, size: { width: 120, height: 44 }, ports: [{ id: 'in', side: 'left' }] },
      { id: 'done', label: 'Done', position: { x: 750, y: 200 }, size: { width: 100, height: 40 } }
    ],
    edges: [{ id: 'internal', from: 'review', to: 'qa', fromPort: 'out', toPort: 'in', label: 'Verify delivery', routing: 'auto' }],
    groups: [{ id: 'delivery', label: 'Delivery' }],
    diagram: { layout: 'manual', routing: 'auto', snap: false },
    editing: { enabled: true, requireConfirmation: false, allowStructuralChanges: true }, ...patch
  };
}

function assertContainsRoute(chart) {
  const frame = chart.model.scene.find('group-delivery').geometry;
  const contains = point => point.x >= frame.x && point.x <= frame.x + frame.width && point.y >= frame.y && point.y <= frame.y + frame.height;
  for (const id of ['edge-0', 'edge-0-arrow']) {
    const route = chart.model.scene.find(id);
    assert.ok(route);
    assert.ok(route.geometry.points.every(contains), `${id} must fit inside the group frame`);
  }
  const plate = chart.model.scene.find('edge-label-0-background');
  if (plate) {
    const box = plate.geometry;
    assert.ok(contains(box));
    assert.ok(contains({ x: box.x + box.width, y: box.y + box.height }));
  }
  const label = chart.model.scene.find('group-label-delivery');
  const view = chart.getSpec().view || {};
  assert.ok(Math.abs(label.geometry.x - frame.x - 8 * (view.scale || 1)) < 1e-8);
  assert.ok(Math.abs(label.geometry.y - frame.y - 15 * (view.scale || 1)) < 1e-8);
}

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer}: group bounds enclose automatic internal routes, arrows, and labels`, () => {
    const chart = createChart(fixture(renderer));
    try {
      const route = chart.model.scene.find('edge-0').geometry.points;
      assert.ok(route.some(point => point.x < 284 || point.x > 466), 'reproduces a route outside node-only group bounds');
      assertContainsRoute(chart);
      assert.deepEqual(chart.model.state.groupBoxes.delivery, chart.model.scene.find('group-delivery').geometry);
    } finally { chart.destroy(); }
  });

  test(`${renderer}: cross-group routes do not expand group bounds and collapsed groups retain node-based anchors`, () => {
    const spec = fixture(renderer), chart = createChart(spec);
    try {
      const frame = structuredClone(chart.model.scene.find('group-delivery').geometry);
      chart.update({ edges: [...spec.edges, { id: 'external', from: 'review', to: 'done' }] });
      assert.deepEqual(chart.model.scene.find('group-delivery').geometry, frame);
      assert.equal(chart.toggleGroupCollapse('delivery', { confirmed: true }).valid, true);
      const collapsed = chart.model.scene.find('group-delivery').geometry;
      assert.deepEqual(collapsed, { x: 284, y: 86, width: 182, height: 194 });
      assert.equal(chart.model.scene.find('edge-0'), undefined);
      const anchor = chart.model.scene.find('edge-1').geometry.points[0];
      assert.ok(anchor.x === collapsed.x || anchor.x === collapsed.x + collapsed.width || anchor.y === collapsed.y || anchor.y === collapsed.y + collapsed.height);
      assert.equal(chart.toggleGroupCollapse('delivery', { confirmed: true }).valid, true);
      assert.deepEqual(chart.model.scene.find('group-delivery').geometry, frame);
      assertContainsRoute(chart);
    } finally { chart.destroy(); }
  });

  test(`${renderer}: manual edits expand and shrink the frame with undo, reload, and zoom`, () => {
    const chart = createChart(fixture(renderer, { view: { scale: 1.3, offsetX: 32.7, offsetY: -16.3 }, groups: [{ id: 'delivery', label: 'Delivery', padding: { left: 9, right: 12, top: 30, bottom: 6 } }] }));
    try {
      const before = structuredClone(chart.model.scene.find('group-delivery').geometry);
      const waypoints = [{ x: 600, y: 136 }, { x: 600, y: 340 }, { x: 250, y: 340 }, { x: 250, y: 242 }];
      assert.equal(chart.applyEdit({ type: 'layout-edit', operations: [{ op: 'updateEdge', edgeId: 'internal', changes: { routingMode: 'manual', waypoints } }] }, { confirmed: true }).valid, true);
      const after = structuredClone(chart.model.scene.find('group-delivery').geometry);
      assert.ok(after.width > before.width);
      assert.ok(after.height > before.height);
      assertContainsRoute(chart);
      assert.equal(chart.undo().valid, true);
      assert.deepEqual(chart.model.scene.find('group-delivery').geometry, before);
      assert.equal(chart.redo().valid, true);
      assert.deepEqual(chart.model.scene.find('group-delivery').geometry, after);
      const restored = createChart(JSON.parse(chart.export({ type: 'json' })).spec);
      try { assert.deepEqual(restored.model.scene.find('group-delivery').geometry, after); assertContainsRoute(restored); }
      finally { restored.destroy(); }
      assert.ok(chart.export({ type: 'svg' }).includes('group-delivery'));
    } finally { chart.destroy(); }
  });

  test(`${renderer}: shared Diagram profile contains curved edges and zero-padding arrowheads`, () => {
    for (const type of ['flow', 'architecture', 'mindmap', 'swimlane']) {
      const spec = fixture(renderer, { type, groups: [{ id: 'delivery', label: 'Delivery', padding: 0 }], edges: [{ id: 'internal', from: 'review', to: 'qa', routing: 'curved', label: 'Verify' }] });
      if (type === 'swimlane') { spec.lanes = [{ id: 'team', label: 'Team' }]; spec.nodes.forEach(node => { node.laneId = 'team'; }); }
      const chart = createDiagramChart(spec);
      try { assertContainsRoute(chart); }
      finally { chart.destroy(); }
    }
  });
}
