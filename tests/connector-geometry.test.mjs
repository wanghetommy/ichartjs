import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, createChart } from '../src/index.mjs';
import { createChart as createDiagramChart } from '../src/diagram-profile.mjs';
import { routeEdgePath } from '../src/diagram.mjs';
import { rerouteDiagramScene } from '../src/project.mjs';
import { CanvasRenderer } from '../src/renderer.mjs';
import { Scene, cubicBezierPoint } from '../src/scene.mjs';

const source = { x: 300, y: 110, width: 150, height: 52 };
const ports = { fromPortDefinition: { side: 'right' }, toPortDefinition: { side: 'left' } };
const near = (first, second) => assert.ok(Math.hypot(first.x - second.x, first.y - second.y) < 1e-6, `${JSON.stringify(first)} != ${JSON.stringify(second)}`);
function spec(renderer, routing = 'auto', patch = {}) {
  return { type: 'flow', renderer, width: 900, height: 440, branding: false,
    nodes: [
      { id: 'review', label: 'Review', groupId: 'delivery', position: { x: 300, y: 110 }, size: { width: 150, height: 52 }, ports: [{ id: 'out', side: 'right' }] },
      { id: 'qa', label: 'QA', groupId: 'delivery', position: { x: 450, y: 220 }, size: { width: 120, height: 44 }, ports: [{ id: 'in', side: 'left' }] }
    ], groups: [{ id: 'delivery', label: 'Delivery' }],
    edges: [{ id: 'review-qa', from: 'review', to: 'qa', fromPort: 'out', toPort: 'in', routing, lineStyle: 'dashed' }],
    diagram: { layout: 'manual', routing }, ...patch };
}
function assertJoin(scene, edgeId = 'edge-0', arrowId = `${edgeId}-arrow`) {
  const edge = scene.find(edgeId), head = scene.find(arrowId), base = edge.geometry.renderPoints.at(-1);
  near(head.geometry.points[0], edge.geometry.points.at(-1));
  near(base, { x: (head.geometry.points[1].x + head.geometry.points[2].x) / 2, y: (head.geometry.points[1].y + head.geometry.points[2].y) / 2 });
  assert.ok(Math.hypot(base.x - head.geometry.points[0].x, base.y - head.geometry.points[0].y) > 0);
  return edge;
}
function assertSimple(points) {
  assert.ok(points.length >= 2);
  const keys = points.map(point => `${point.x}:${point.y}`);
  assert.equal(new Set(keys).size, keys.length, 'no repeated vertices');
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1], point = points[index], next = points[index + 1];
    const collinear = previous.x === point.x && point.x === next.x || previous.y === point.y && point.y === next.y;
    assert.equal(collinear && (point.x - previous.x) * (next.x - point.x) + (point.y - previous.y) * (next.y - point.y) < 0, false, 'no retraced segment');
  }
}

test('aligned and nearly aligned facing edges route without retracing, including vertical equivalents', () => {
  const transpose = box => ({ x: box.y, y: box.x, width: box.height, height: box.width });
  for (const offset of [-1, -0.001, 0, 0.001, 1]) {
    const target = { x: 450 + offset, y: 220, width: 120, height: 44 };
    for (const vertical of [false, true]) {
      const path = routeEdgePath(vertical ? { fromPortDefinition: { side: 'bottom' }, toPortDefinition: { side: 'top' } } : ports, vertical ? transpose(source) : source, vertical ? transpose(target) : target, 'auto');
      assertSimple(path.points);
      assert.ok(path.points.every((point, index) => !index || point.x === path.points[index - 1].x || point.y === path.points[index - 1].y));
      assert.ok(Math.hypot(path.points[1].x - path.points[0].x, path.points[1].y - path.points[0].y) >= 12);
      assert.ok(Math.hypot(path.points.at(-1).x - path.points.at(-2).x, path.points.at(-1).y - path.points.at(-2).y) >= 12);
      assert.deepEqual(path, routeEdgePath(vertical ? { fromPortDefinition: { side: 'bottom' }, toPortDefinition: { side: 'top' } } : ports, vertical ? transpose(source) : source, vertical ? transpose(target) : target, 'auto'));
    }
  }
});

test('manual retraced and crossing routes are rejected without committing', () => {
  const chart = createChart(spec('svg', 'auto', { editing: { enabled: true, requireConfirmation: false } }));
  try {
    const before = chart.getSpec();
    for (const waypoints of [
      [{ x: 470, y: 136 }, { x: 450, y: 136 }, { x: 450, y: 242 }, { x: 430, y: 242 }],
      [{ x: 600, y: 136 }, { x: 600, y: 300 }, { x: 590, y: 300 }, { x: 590, y: 100 }, { x: 250, y: 100 }, { x: 250, y: 242 }]
    ]) {
      const result = chart.applyEdit({ type: 'layout-edit', operations: [{ op: 'updateEdge', edgeId: 'review-qa', changes: { routingMode: 'manual', waypoints } }] }, { confirmed: true });
      assert.equal(result.valid, false);
      assert.equal(result.errors[0].reason, 'SELF_INTERSECTION');
      assert.deepEqual(chart.getSpec(), before);
      assert.equal(chart.getState().history.undo, 0);
    }
  } finally { chart.destroy(); }
});

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer}: connector bodies join arrow bases without changing logical ports or curve shape`, () => {
    for (const routing of ['auto', 'orthogonal', 'straight', 'curved']) {
      const chart = createChart(spec(renderer, routing, { view: { scale: 1.3, offsetX: 32.7, offsetY: -16.3 } }));
      try {
        const before = chart.getSpec(), edge = assertJoin(chart.model.scene);
        assert.ok(chart.export({ type: 'svg' }).includes(String(edge.geometry.renderPoints.at(-1).x)));
        if (edge.geometry.curve === 'cubic') {
          const original = edge.geometry.points, trimmed = edge.geometry.renderPoints;
          const ratio = (trimmed[1].x - original[0].x) / (original[1].x - original[0].x);
          for (const sample of [0.2, 0.5, 0.9]) near(cubicBezierPoint(trimmed, sample), cubicBezierPoint(original, sample * ratio));
        }
        assert.deepEqual(chart.getSpec(), before);
      } finally { chart.destroy(); }
    }
  });

  test(`${renderer}: shared diagram profile and Gantt use the same arrow joins`, () => {
    for (const type of ['flow', 'architecture', 'mindmap', 'swimlane']) {
      const input = spec(renderer, 'auto', { type });
      if (type === 'swimlane') { input.lanes = [{ id: 'team', label: 'Team' }]; input.nodes.forEach(node => { node.laneId = 'team'; }); }
      const chart = createDiagramChart(input);
      try { assertJoin(chart.model.scene); assertSimple(chart.model.scene.find('edge-0').geometry.points); }
      finally { chart.destroy(); }
    }
    const gantt = createChart({ type: 'gantt', renderer, data: { values: [{ id: 'first', name: 'First', start: '2026-01-01', end: '2026-01-03' }, { id: 'second', name: 'Second', start: '2026-01-05', end: '2026-01-07', dependencies: ['first'] }] } });
    try { assertJoin(gantt.model.scene, 'dependency-1-0', 'dependency-arrow-1-0'); }
    finally { gantt.destroy(); }
  });
}

test('Canvas draws the shortened body, not the logical endpoint, for lines and curves', () => {
  for (const routing of ['auto', 'curved']) {
    const chart = createChart(spec('canvas', routing));
    try {
      const edge = assertJoin(chart.model.scene), scene = new Scene(900, 440), calls = [];
      scene.add(edge);
      const renderer = new CanvasRenderer();
      renderer.ctx = { clearRect() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo(...args) { calls.push(args); }, bezierCurveTo(...args) { calls.push(args.slice(-2)); }, stroke() {}, setLineDash() {} };
      renderer.render(scene);
      const base = edge.geometry.renderPoints.at(-1);
      assert.deepEqual(calls.at(-1), [base.x, base.y]);
    } finally { chart.destroy(); }
  }
});

test('rerouting and embedded-board scaling preserve the body-to-arrow connection', () => {
  const chart = createChart(spec('svg'));
  try {
    const qa = chart.model.scene.find('node-qa');
    qa.geometry.x += 40;
    rerouteDiagramScene(chart.model.scene);
    assertJoin(chart.model.scene);
    const board = createBoard({ width: 1000, height: 600, items: [{ id: 'flow', kind: 'chart', position: { x: 80, y: 60 }, size: { width: 450, height: 330 }, spec: spec('svg') }] });
    const edge = assertJoin(board.scene, 'flow-edge-0', 'flow-edge-0-arrow');
    assert.ok(board.export({ type: 'svg' }).includes(String(edge.geometry.renderPoints.at(-1).x)));
  } finally { chart.destroy(); }
});

test('short explicit straight edges scale arrowheads to fit the final segment', () => {
  const input = spec('svg', 'straight');
  input.nodes[1].position = { x: 451, y: 114 };
  const chart = createChart(input);
  try {
    const edge = assertJoin(chart.model.scene);
    assert.ok(edge.geometry.renderPoints.at(-1).x > edge.geometry.points[0].x);
    assert.ok(edge.geometry.renderPoints.at(-1).x < edge.geometry.points.at(-1).x);
  } finally { chart.destroy(); }
});
