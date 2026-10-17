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

function boundaryFixture(renderer, patch = {}) {
  return fixture(renderer, {
    nodes: [
      { id: 'review', label: 'Review', groupId: 'delivery', position: { x: 320, y: 160 }, size: { width: 140, height: 64 }, ports: [{ id: 'out', side: 'right' }, { id: 'in', side: 'left' }] },
      { id: 'qa', label: 'QA', groupId: 'delivery', position: { x: 400, y: 376 }, size: { width: 140, height: 64 }, ports: [{ id: 'out', side: 'right' }, { id: 'in', side: 'left' }] },
      { id: 'done', label: 'Done', position: { x: 672, y: 152 }, size: { width: 140, height: 64 }, ports: [{ id: 'in', side: 'left' }] }
    ],
    edges: [{ id: 'release', from: 'qa', to: 'done', fromPort: 'out', toPort: 'in', label: 'release' }, { id: 'verify', from: 'review', to: 'qa', fromPort: 'out', toPort: 'in' }, { id: 'retry', from: 'qa', to: 'review' }], ...patch
  });
}

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer}: automatic group exit keeps twelve units before turning along the final frame`, () => {
    for (const create of [createChart, createDiagramChart]) {
      const chart = create(boundaryFixture(renderer));
      try {
        const frame = chart.model.scene.find('group-delivery').geometry;
        const points = chart.model.scene.find('edge-0').geometry.points;
        assert.ok(points[1].x >= frame.x + frame.width + 12);
        assert.equal(points[0].x, 540);
        assert.equal(points.at(-1).x, 672);
        assert.equal(chart.getState().warnings.some(warning => warning.code === 'EDGE_GROUP_CLEARANCE_REDUCED'), false);
        assert.deepEqual(chart.model.state.edgeRoutes.map(route => route.edgeId), ['release', 'verify', 'retry']);
        const plate = chart.model.scene.find('edge-label-0-background');
        assert.ok(!plate || plate.geometry.x >= frame.x + frame.width + 12 || plate.geometry.x + plate.geometry.width <= frame.x + frame.width - 12);
      } finally { chart.destroy(); }
    }
  });

  test(`${renderer}: group entry and exit clearance is symmetric across all four sides`, () => {
    for (const enter of [false, true]) for (const transpose of [false, true]) for (const mirror of [false, true]) {
      const spec = boundaryFixture(renderer);
      if (enter) spec.edges[0] = { ...spec.edges[0], from: 'done', to: 'qa', fromPort: 'in', toPort: 'out' };
      if (mirror) spec.nodes = spec.nodes.map(node => ({ ...node, position: { x: spec.width - node.position.x - node.size.width, y: node.position.y }, ports: node.ports.map(port => ({ ...port, side: port.side === 'right' ? 'left' : 'right' })) }));
      if (transpose) {
        [spec.width, spec.height] = [spec.height, spec.width];
        spec.nodes = spec.nodes.map(node => ({ ...node, position: { x: node.position.y, y: node.position.x }, size: { width: node.size.height, height: node.size.width }, ports: node.ports.map(port => ({ ...port, side: port.side === 'right' ? 'bottom' : 'top' })) }));
      }
      const chart = createChart(spec);
      try {
        const frame = chart.model.scene.find('group-delivery').geometry;
        const points = chart.model.scene.find('edge-0').geometry.points;
        const turn = enter ? points.at(-2) : points[1], axis = transpose ? 'y' : 'x', span = transpose ? 'height' : 'width';
        const distance = mirror ? frame[axis] - turn[axis] : turn[axis] - frame[axis] - frame[span];
        assert.ok(distance >= 12, `${enter}/${transpose}/${mirror}: ${distance}`);
      } finally { chart.destroy(); }
    }
  });

  test(`${renderer}: zoomed group spacing uses the actual label width without changing its text`, () => {
    for (const scale of [0.64, 1.5]) {
      const chart = createChart(boundaryFixture(renderer, { view: { scale } }));
      try {
        const frame = chart.model.scene.find('group-delivery').geometry;
        const label = chart.model.scene.find('edge-label-0');
        const width = 47.6;
        assert.equal(label.geometry.text, 'release');
        assert.ok(label.geometry.x - width / 2 >= frame.x + frame.width + 12 * scale);
      } finally { chart.destroy(); }
    }
  });

  test(`${renderer}: group clearance relaxes only when a node blocks the preferred exit corridor`, () => {
    const spec = boundaryFixture(renderer);
    spec.nodes.push({ id: 'blocker', label: 'Blocker', position: { x: 568, y: 300 }, size: { width: 32, height: 180 } });
    const chart = createChart(spec);
    try {
      assert.ok(chart.model.scene.find('edge-0'));
      assert.ok(chart.getState().warnings.some(warning => warning.code === 'EDGE_GROUP_CLEARANCE_REDUCED' && warning.edgeId === 'release'));
      const frame = chart.model.scene.find('group-delivery').geometry;
      assert.ok(chart.model.scene.find('edge-0').geometry.points[1].x < frame.x + frame.width + 12);
    } finally { chart.destroy(); }
  });

  test(`${renderer}: manual group crossings keep their saved channel and automatic clearance recovers`, () => {
    const spec = boundaryFixture(renderer);
    spec.edges[0] = { ...spec.edges[0], routingMode: 'manual', waypoints: [{ x: 560, y: 408 }, { x: 560, y: 184 }] };
    const chart = createChart(spec);
    try {
      const before = chart.model.scene.find('edge-0').geometry.points;
      assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
      assert.equal(before[1].x, 560);
      chart.selectNodes(['done']);
      assert.equal(chart.moveSelectedBy({ x: 32, y: 0 }, { confirmed: true }).valid, true);
      assert.equal(chart.model.scene.find('edge-0').geometry.points[1].x, 560);
      chart.undo();
      assert.deepEqual(chart.model.scene.find('edge-0').geometry.points, before);
      const restored = createChart(chart.getSpec());
      try { assert.deepEqual(restored.model.scene.find('edge-0').geometry.points, before); } finally { restored.destroy(); }
      chart.update({ edges: chart.getDiagramEdges().map(edge => edge.id === 'release' ? { ...edge, routingMode: 'auto', waypoints: [] } : edge) });
      assert.ok(chart.model.scene.find('edge-0').geometry.points[1].x >= chart.model.state.groupBoxes.delivery.x + chart.model.state.groupBoxes.delivery.width + 12);
    } finally { chart.destroy(); }
  });
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
