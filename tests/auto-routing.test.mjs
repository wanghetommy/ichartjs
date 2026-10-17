import test from 'node:test';
import assert from 'node:assert/strict';
import { routeEdgePath } from '../src/diagram.mjs';
import { createChart } from '../src/index.mjs';
import { createChart as createDiagramChart } from '../src/diagram-profile.mjs';

const from = { x: 40, y: 80, width: 100, height: 40 };
const horizontal = { x: 360, y: 80, width: 100, height: 40 };
const vertical = { x: 40, y: 280, width: 100, height: 40 };
const diagonal = { x: 360, y: 200, width: 100, height: 40 };
const ports = { fromPortDefinition: { side: 'right' }, toPortDefinition: { side: 'left' } };
const orthogonal = points => points.length >= 2 && points.every((point, index) => !index || point.x === points[index - 1].x || point.y === points[index - 1].y);

const reciprocalSpec = (renderer = 'svg', routing = 'auto') => ({ type: 'flow', renderer, width: 960, height: 480, branding: false, diagram: { layout: 'manual', routing },
  nodes: [{ id: 'submit', label: 'Submit', position: { x: 200, y: 180 }, size: { width: 160, height: 64 } }, { id: 'review', kind: 'decision', label: 'Approved?', position: { x: 460, y: 180 }, size: { width: 144, height: 64 } }],
  edges: [{ id: 'submit-review', from: 'submit', to: 'review' }, { id: 'retry', from: 'review', to: 'submit', label: 'No' }] });

test('automatic reciprocal edges use separate channels independent of edge order and renderer', () => {
  const routes = [];
  for (const create of [createChart, createDiagramChart]) for (const renderer of ['svg', 'canvas']) for (const routing of ['auto', 'orthogonal']) for (const reverse of [false, true]) {
    const spec = reciprocalSpec(renderer, routing);
    if (reverse) spec.edges.reverse();
    const chart = create(spec);
    const paths = Object.fromEntries(spec.edges.map((edge, index) => [edge.id, chart.model.scene.find(`edge-${index}`).geometry.points]));
    assert.ok(orthogonal(paths.retry));
    assert.ok(paths.retry.some(point => point.y > 244 || point.y < 180));
    assert.notDeepEqual(paths['submit-review'], [...paths.retry].reverse());
    assert.equal(chart.getState().warnings.some(warning => warning.code === 'EDGE_ROUTE_BLOCKED'), false);
    routes.push(paths);
    chart.destroy();
  }
  for (const paths of routes) assert.deepEqual(paths, routes[0]);
});

test('reciprocal routes update after node movement without changing manual routes or explicit ports', () => {
  const chart = createChart(reciprocalSpec());
  chart.update({ nodes: chart.getDiagramNodes().map(node => node.id === 'review' ? { ...node, position: { x: 208, y: 340 } } : node) });
  const path = chart.model.scene.find('edge-1').geometry.points;
  assert.ok(orthogonal(path));
  assert.ok(path.some(point => point.x > 368 || point.x < 200));
  chart.update({ nodes: chart.getDiagramNodes().map(node => node.id === 'review' ? { ...node, position: { x: 0, y: 180 } } : node) });
  assert.ok(chart.model.scene.find('edge-0').geometry.points.some(point => point.y < 180 || point.y > 244));
  assert.equal(chart.model.scene.find('edge-1').geometry.points.length, 2);
  chart.destroy();

  const spec = reciprocalSpec();
  spec.nodes[0].ports = [{ id: 'in', side: 'top' }];
  spec.nodes[1].ports = [{ id: 'out', side: 'top' }];
  spec.edges[1] = { ...spec.edges[1], fromPort: 'out', toPort: 'in', routingMode: 'manual', waypoints: [{ x: 532, y: 120 }, { x: 280, y: 120 }] };
  const manual = createChart(spec);
  const expected = [{ x: 532, y: 180 }, { x: 532, y: 120 }, { x: 280, y: 120 }, { x: 280, y: 180 }];
  assert.deepEqual(manual.model.scene.find('edge-1').geometry.points, expected);
  assert.equal(manual.getState().edgeRoutes.find(edge => edge.edgeId === 'retry').effectiveRoutingMode, 'manual');
  manual.update({ edges: [{ ...spec.edges[1], routingMode: 'auto', waypoints: [] }, spec.edges[0]] });
  const automatic = manual.model.scene.find('edge-0').geometry.points;
  assert.deepEqual(automatic[0], expected[0]);
  assert.deepEqual(automatic.at(-1), expected.at(-1));
  manual.destroy();
});

test('reciprocal channels avoid shaped obstacles even when the forward edge must detour', () => {
  for (const kind of ['process', 'decision', 'start', 'io', 'connector']) {
    const spec = reciprocalSpec();
    spec.nodes.push({ id: 'obstacle', label: '', kind, position: { x: 400, y: 196 }, size: { width: 24, height: 32 } });
    const chart = createChart(spec);
    const forward = chart.model.scene.find('edge-0').geometry.points;
    const backward = chart.model.scene.find('edge-1').geometry.points;
    assert.ok(forward.length > 2);
    assert.ok(orthogonal(backward));
    assert.notDeepEqual(forward, [...backward].reverse());
    chart.destroy();
  }
  const chart = createChart({ ...reciprocalSpec(), nodes: [...reciprocalSpec().nodes, { id: 'obstacle', label: 'Blocked', position: { x: 350, y: 150 }, size: { width: 280, height: 120 } }] });
  assert.equal(chart.model.scene.find('edge-1'), undefined);
  assert.ok(chart.getState().warnings.some(warning => warning.code === 'EDGE_ROUTE_BLOCKED' && warning.edgeId === 'retry'));
  chart.destroy();
});

test('return channels prefer the available plot rather than clipping at a nearby boundary', () => {
  for (const position of [{ x: 200, y: 48 }, { x: 200, y: 368 }]) {
    const spec = reciprocalSpec();
    spec.nodes = spec.nodes.map(node => ({ ...node, position: { ...node.position, y: position.y } }));
    const chart = createChart(spec), plot = chart.model.state.plot;
    const points = chart.model.scene.find('edge-1').geometry.points;
    assert.ok(points.every(point => point.x >= plot.x && point.y >= plot.y && point.x <= plot.x + plot.width && point.y <= plot.y + plot.height));
    chart.destroy();
  }
});

test('a return route can be edited, moved, undone and reloaded without changing its channel', () => {
  const chart = createChart({ ...reciprocalSpec(), editing: { enabled: true, allowStructuralChanges: true } });
  const points = chart.model.scene.find('edge-1').geometry.points;
  const shift = points[2].y < 180 ? -24 : 24;
  const waypoints = points.slice(1, -1).map((point, index, values) => index > 0 && index < values.length - 1 ? { ...point, y: point.y + shift } : point);
  const preview = chart.previewEdit({ type: 'layout-edit', operations: [{ op: 'updateEdge', edgeId: 'retry', changes: { routingMode: 'manual', waypoints } }] });
  assert.equal(preview.valid, true, JSON.stringify(preview.errors));
  assert.equal(chart.applyEdit(preview.command, { preview, confirmed: true }).valid, true);
  const edited = chart.getSpec();
  chart.selectNodes(['review']);
  assert.equal(chart.moveSelectedBy({ x: 16, y: 0 }, { confirmed: true }).valid, true);
  assert.equal(chart.getDiagramEdges()[1].waypoints[1].y, waypoints[1].y);
  chart.undo();
  assert.deepEqual(chart.getSpec().edges, edited.edges);
  chart.redo();
  const restored = createChart(chart.getSpec());
  assert.deepEqual(restored.model.scene.find('edge-1').geometry.points, chart.model.scene.find('edge-1').geometry.points);
  assert.equal(restored.getState().edgeRoutes[1].effectiveRoutingMode, 'manual');
  restored.update({ edges: [restored.getDiagramEdges()[1]] });
  assert.equal(restored.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
  restored.destroy();
  chart.destroy();
});

test('auto directly connects only aligned and outward-facing endpoints', () => {
  for (const target of [horizontal, vertical]) {
    const path = routeEdgePath({}, from, target, 'auto');
    assert.equal(path.points.length, 2);
    assert.ok(orthogonal(path.points));
  }
  const offset = routeEdgePath(ports, from, diagonal, 'auto');
  assert.ok(orthogonal(offset.points));
  assert.ok(offset.points.length > 2);
  assert.equal(offset.curve, null);
  assert.deepEqual(offset, routeEdgePath(ports, from, diagonal, 'auto'));
  const explicitStraight = routeEdgePath(ports, from, diagonal, 'straight');
  assert.equal(explicitStraight.points.length, 2);
  assert.equal(orthogonal(explicitStraight.points), false);
  assert.equal(routeEdgePath(ports, from, diagonal, 'curved').curve, 'cubic');
});

test('auto avoids obstacles and does not re-enter source or destination nodes', () => {
  const backwards = { x: -200, y: 80, width: 100, height: 40 };
  const path = routeEdgePath(ports, from, backwards, 'auto');
  assert.ok(orthogonal(path.points));
  assert.ok(path.points.length > 2);
  assert.ok(path.points[1].x > path.points[0].x);
  assert.ok(path.points.at(-2).x < path.points.at(-1).x);
  const boxes = [from, backwards];
  for (let index = 1; index < path.points.length; index += 1) {
    const previous = path.points[index - 1], point = path.points[index];
    for (const box of boxes) {
      const crosses = previous.x === point.x
        ? point.x > box.x && point.x < box.x + box.width && Math.max(previous.y, point.y) > box.y && Math.min(previous.y, point.y) < box.y + box.height
        : point.y > box.y && point.y < box.y + box.height && Math.max(previous.x, point.x) > box.x && Math.min(previous.x, point.x) < box.x + box.width;
      assert.equal(crosses, false);
    }
  }
  const blocked = routeEdgePath({ ...ports, obstacles: [{ x: 220, y: 70, width: 70, height: 70 }] }, from, horizontal, 'auto');
  assert.ok(orthogonal(blocked.points));
  assert.ok(blocked.points.length > 2);
  assert.ok(blocked.points.some(point => point.y < 70 || point.y > 140));
});

test('auto never falls back to a diagonal when the route is unavailable', () => {
  const blocked = routeEdgePath({ ...ports, obstacles: [{ x: 130, y: 70, width: 350, height: 200 }] }, from, diagonal, 'auto');
  assert.deepEqual(blocked.points, []);
  assert.equal(blocked.warning.code, 'EDGE_ROUTE_BLOCKED');
});

test('auto follows node updates and uses the same paths for SVG and Canvas', () => {
  const paths = [];
  for (const renderer of ['svg', 'canvas']) {
    const chart = createChart({ type: 'flow', renderer, branding: false, diagram: { layout: 'manual', routing: 'auto' },
      nodes: [{ id: 'qa', label: 'QA', position: { x: from.x, y: from.y }, size: { width: from.width, height: from.height }, ports: [{ id: 'out', side: 'right' }] },
        { id: 'done', label: 'Done', position: { x: diagonal.x, y: diagonal.y }, size: { width: diagonal.width, height: diagonal.height }, ports: [{ id: 'in', side: 'left' }] }],
      edges: [{ id: 'qa-done', from: 'qa', to: 'done', fromPort: 'out', toPort: 'in' }] });
    assert.ok(orthogonal(chart.model.scene.find('edge-0').geometry.points));
    chart.update({ nodes: chart.getDiagramNodes().map(node => node.id === 'done' ? { ...node, position: { x: 360, y: 80 } } : node) });
    assert.equal(chart.model.scene.find('edge-0').geometry.points.length, 2);
    chart.update({ nodes: chart.getDiagramNodes().map(node => node.id === 'done' ? { ...node, position: { x: 0, y: 220 } } : node) });
    const points = chart.model.scene.find('edge-0').geometry.points;
    assert.ok(orthogonal(points));
    assert.ok(points.length > 2);
    paths.push(points);
    chart.update({ nodes: [...chart.getDiagramNodes(), { id: 'blocker', label: 'Blocker', position: { x: 130, y: 70 }, size: { width: 350, height: 200 } }] });
    assert.equal(chart.model.scene.find('edge-0'), undefined);
    assert.ok(chart.getState().warnings.some(warning => warning.code === 'EDGE_ROUTE_BLOCKED'));
    chart.destroy();
  }
  assert.deepEqual(paths[0], paths[1]);
});
