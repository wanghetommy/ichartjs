import test from 'node:test';
import assert from 'node:assert/strict';
import { routeEdgePath } from '../src/diagram.mjs';
import { createChart } from '../src/index.mjs';

const from = { x: 40, y: 80, width: 100, height: 40 };
const horizontal = { x: 360, y: 80, width: 100, height: 40 };
const vertical = { x: 40, y: 280, width: 100, height: 40 };
const diagonal = { x: 360, y: 200, width: 100, height: 40 };
const ports = { fromPortDefinition: { side: 'right' }, toPortDefinition: { side: 'left' } };
const orthogonal = points => points.length >= 2 && points.every((point, index) => !index || point.x === points[index - 1].x || point.y === points[index - 1].y);

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
