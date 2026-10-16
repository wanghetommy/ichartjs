import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, resolveTheme } from '../src/index.mjs';
import { createChart as standard } from '../src/standard.mjs';
import { createChart as diagram } from '../src/diagram-profile.mjs';
import { createChart as project } from '../src/project-profile.mjs';
import { markWidth } from '../src/chart-chrome.mjs';
import { layoutArchitectureNodes, layoutDiagram } from '../src/diagram.mjs';
import { rerouteDiagramScene } from '../src/project.mjs';
import { CanvasRenderer } from '../src/renderer.mjs';

const rows = [{ id: 'a', name: 'A', value: 12 }, { id: 'b', name: 'B', value: 24 }];
const flow = {
  type: 'flow', renderer: 'svg', width: 720, height: 440,
  nodes: [{ id: 'start', kind: 'start', label: 'Start', position: { x: 70, y: 100 }, size: { width: 120, height: 64 } }, { id: 'end', kind: 'end', label: 'End', position: { x: 440, y: 100 }, size: { width: 120, height: 64 } }],
  edges: [{ id: 'next', from: 'start', to: 'end', lineStyle: 'dashed' }],
  diagram: { layout: 'manual', routing: 'auto', appearance: 'soft' }
};
const lineWidth = chart => chart.model.scene.find('series-0-line').style.strokeWidth;
const arrowDepth = chart => {
  const points = chart.model.scene.find('edge-0-arrow').geometry.points;
  return Math.hypot(points[0].x - (points[1].x + points[2].x) / 2, points[0].y - (points[1].y + points[2].y) / 2);
};

test('automatic strokes are bounded by plot and node size, not DPR or empty canvas', () => {
  const theme = resolveTheme({ preset: 'diagram' });
  const spec = { theme, nodes: [{ size: { height: 36 } }, { kind: 'connector', size: { height: 16 } }] };
  const small = markWidth(spec, { width: 140, height: 70 });
  const large = markWidth(spec, { width: 5600, height: 2800 });
  assert.equal(small, theme.marks.lineWidth * 0.8);
  assert.equal(large, theme.marks.lineWidth);
  assert.equal(markWidth({ ...spec, nodes: [{ size: { height: 144 } }] }, { width: 5600, height: 2800 }), theme.marks.lineWidth * 1.35);
  assert.equal(markWidth({ ...spec, devicePixelRatio: 3 }, { width: 5600, height: 2800 }), large);
});

test('Line and Area resize identically in root and standard Profile without changing source tokens', () => {
  for (const type of ['line', 'area']) for (const factory of [createChart, standard]) {
    const chart = factory({ type, renderer: 'svg', data: rows, width: 320, height: 220 });
    try {
      const small = lineWidth(chart), token = chart.getSpec().theme.marks.lineWidth;
      chart.resize(1400, 800);
      assert.ok(lineWidth(chart) > small);
      assert.ok(lineWidth(chart) <= token * 1.35);
      assert.equal(chart.getSpec().theme.marks.lineWidth, token);
      const restored = factory(chart.export({ type: 'json', as: 'object' }).spec);
      try { assert.equal(lineWidth(restored), lineWidth(chart)); } finally { restored.destroy(); }
    } finally { chart.destroy(); }
  }
});

test('explicit theme widths, including preset-equivalent values, survive resize and JSON', () => {
  for (const width of [2, 4]) for (const factory of [createChart, standard]) {
    const chart = factory({ type: 'line', renderer: 'svg', data: rows, theme: { tokens: { marks: { lineWidth: width } } } });
    try {
      chart.resize(280, 200);
      assert.equal(lineWidth(chart), width);
      chart.resize(1400, 800);
      assert.equal(lineWidth(chart), width);
      const restored = factory(chart.getSpec());
      try { restored.resize(320, 220); assert.equal(lineWidth(restored), width); } finally { restored.destroy(); }
    } finally { chart.destroy(); }
  }
});

test('diagram families share role widths, proportional arrows/dashes and independent hit tolerance', () => {
  for (const type of ['flow', 'architecture', 'mindmap', 'swimlane']) for (const factory of [createChart, diagram]) {
    const nodes = flow.nodes.map(node => ({ ...node, ...(type === 'mindmap' && node.id === 'end' ? { parentId: 'start' } : {}), ...(type === 'swimlane' ? { laneId: 'team' } : {}), ...(type === 'architecture' ? { layerId: 'service' } : {}) }));
    const charts = [1.5, 3].map(width => factory({ ...flow, type, nodes, ...(type === 'swimlane' ? { lanes: [{ id: 'team', label: 'Team' }] } : {}), ...(type === 'architecture' ? { layers: [{ id: 'service', label: 'Service' }] } : {}), theme: { marks: { lineWidth: width } } }));
    try {
      const [thin, thick] = charts.map(chart => chart.model.scene.find('edge-0'));
      assert.equal(thick.style.strokeWidth, thin.style.strokeWidth * 2);
      assert.deepEqual(thick.style.lineDash, thin.style.lineDash.map(length => length * 2));
      assert.ok(Math.abs(arrowDepth(charts[1]) - arrowDepth(charts[0]) * 2) < 1e-6);
      assert.equal(thick.hitTolerance, thin.hitTolerance);
      assert.ok(charts[1].model.scene.find('node-start').style.strokeWidth < thick.style.strokeWidth);
      const depth = arrowDepth(charts[1]);
      rerouteDiagramScene(charts[1].model.scene);
      assert.ok(Math.abs(arrowDepth(charts[1]) - depth) < 1e-6);
    } finally { charts.forEach(chart => chart.destroy()); }
  }
});

test('Gantt dependencies and Burndown curves use shared stroke sizing in root/project', () => {
  for (const factory of [createChart, project]) {
    const gantt = factory({ type: 'gantt', renderer: 'svg', theme: { marks: { lineWidth: 3 } }, data: [{ id: 'a', name: 'A', start: '2026-01-01', end: '2026-01-03' }, { id: 'b', name: 'B', start: '2026-01-05', end: '2026-01-07', dependencies: ['a'] }] });
    try { assert.ok(gantt.model.scene.find('dependency-1-0').style.strokeWidth >= 3); } finally { gantt.destroy(); }
    const burndown = factory({ type: 'burndown', renderer: 'svg', data: [{ id: 'a', date: '2026-01-01', remaining: 20 }, { id: 'b', date: '2026-01-03', remaining: 10 }], width: 320, height: 220 });
    try {
      const small = burndown.model.scene.find('burndown-actual').style.strokeWidth;
      burndown.resize(1400, 800);
      assert.ok(burndown.model.scene.find('burndown-actual').style.strokeWidth > small);
    } finally { burndown.destroy(); }
  }
});

test('automatic layouts remain compact and centered without overwriting manual coordinates', () => {
  const bounds = { x: 10, y: 20, width: 1400, height: 900 };
  const nodes = [{ id: 'root', label: 'Root' }, { id: 'a', label: 'A', parentId: 'root' }, { id: 'b', label: 'B', parentId: 'root' }];
  const edges = [{ from: 'root', to: 'a' }, { from: 'root', to: 'b' }];
  const automatic = layoutDiagram({ type: 'flow', nodes, edges }, bounds);
  assert.equal(automatic.a.x - automatic.root.x - 112, 48);
  const mindmap = layoutDiagram({ type: 'mindmap', nodes, edges, diagram: { grid: 0 } }, bounds);
  assert.equal(mindmap.b.y - mindmap.a.y - 36, 24);
  assert.ok(mindmap.root.x > bounds.x);
  const architecture = layoutArchitectureNodes({ type: 'architecture', diagram: { grid: 0 }, layers: [{ id: 'layer', label: 'Layer' }], nodes: nodes.map(node => ({ ...node, layerId: 'layer' })) }, bounds);
  assert.equal(architecture.a.x - architecture.root.x - 112, 48);
  assert.ok(architecture.root.x > bounds.x);
  const chart = createChart(flow);
  try { assert.equal(chart.getState().layout.diagram.nodes.start.x, 70); assert.equal(chart.getState().layout.diagram.nodes.start.y, 100); } finally { chart.destroy(); }
});

test('SVG, Canvas replay, zoom and renderer replacement preserve the resolved line style', () => {
  const chart = createChart(flow);
  try {
    const width = chart.model.scene.find('edge-0').style.strokeWidth;
    assert.match(chart.export({ type: 'svg' }), new RegExp(`stroke-width="${width}"`));
    const widths = [], context = new Proxy({ stroke() { widths.push(this.lineWidth); } }, { get: (target, key) => key in target ? target[key] : () => {} });
    const renderer = new CanvasRenderer();
    renderer.ctx = context;
    renderer.render(chart.model.scene);
    assert.ok(widths.includes(width));
    chart.update({ view: { scale: 2 }, renderer: 'canvas' });
    assert.equal(chart.model.scene.find('edge-0').style.strokeWidth, width);
    const depth = arrowDepth(chart);
    rerouteDiagramScene(chart.model.scene);
    assert.ok(Math.abs(arrowDepth(chart) - depth) < 1e-6);
    chart.update({ renderer: 'svg' });
    assert.equal(chart.model.scene.find('edge-0').style.strokeWidth, width);
  } finally { chart.destroy(); }
});
