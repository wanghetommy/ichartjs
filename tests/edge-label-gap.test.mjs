import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart } from '../src/index.mjs';
import { createChart as createDiagram } from '../src/diagram-profile.mjs';
import { estimateTextWidth, fontPixels } from '../src/layout.mjs';
import { pathIntersectsBox } from '../src/path.mjs';
import { edgeGapSpec } from './fixtures/edge-label-layout.mjs';
import { createSoftFlow } from '../playground/diagram-visuals.mjs';
import { visualScale } from '../src/chart-chrome.mjs';

function expectedGap(chart, edge, label) {
  return Math.max(2, Math.min(10, (fontPixels(label.style.font) / 4 + edge.style.strokeWidth / 2) * visualScale(chart.getSpec(), chart.model.state.plot)));
}
function textBox(label) {
  const size = fontPixels(label.style.font), width = estimateTextWidth(label.geometry.text, size, label.style.font);
  return { x: label.geometry.x - width / 2, y: label.geometry.y - size * 0.6, width, height: size * 1.2 };
}

test('near-route labels use bounded adaptive gaps outside the stroke without backgrounds or line cuts', () => {
  for (const factory of [createChart, createDiagram]) for (const type of ['flow', 'architecture', 'mindmap', 'swimlane']) for (const renderer of ['svg', 'canvas']) for (const vertical of [false, true]) for (const reverse of [false, true]) {
    const chart = factory(edgeGapSpec({ type, renderer, vertical, reverse }));
    try {
      const label = chart.model.scene.find('edge-label-0'), edge = chart.model.scene.find('edge-0'), box = textBox(label);
      const point = edge.geometry.points[0], gap = vertical ? box.x - point.x - edge.style.strokeWidth / 2 : point.y - box.y - box.height - edge.style.strokeWidth / 2;
      assert.ok(Math.abs(gap - expectedGap(chart, edge, label)) < 1e-6, `${type}/${renderer}/${vertical}/${reverse}: ${gap}`);
      assert.ok(gap >= 2 && gap <= 10);
      assert.equal(label.geometry.text, 'Release');
      assert.equal(edge.geometry.exclusions, undefined);
      assert.equal(chart.model.scene.find('edge-label-0-background'), undefined);
      assert.equal(chart.model.state.labelLayout.diagram.backgrounded, 0);
    } finally { chart.destroy(); }
  }
});

test('gap follows font and stroke size but stays in CSS pixels across zoom, resize and reload', () => {
  for (const scale of [0.64, 1, 1.5]) for (const size of [10, 16, 24]) for (const lineWidth of [1, 3, 6]) for (const vertical of [false, true]) {
    const spec = edgeGapSpec({ scale, size, lineWidth, vertical }), chart = createChart(spec);
    try {
      const saved = chart.getSpec();
      for (const current of [chart, createChart(saved)]) {
        const label = current.model.scene.find('edge-label-0'), edge = current.model.scene.find('edge-0'), box = textBox(label), point = edge.geometry.points[0];
        const gap = vertical ? box.x - point.x - edge.style.strokeWidth / 2 : point.y - box.y - box.height - edge.style.strokeWidth / 2;
        assert.ok(Math.abs(gap - expectedGap(current, edge, label)) < 1e-6, `${scale}/${size}/${lineWidth}/${vertical}: ${gap}`);
        assert.equal(edge.geometry.exclusions, undefined);
        assert.deepEqual(current.getSpec().nodes, spec.nodes);
        assert.deepEqual(current.getSpec().view, spec.view);
        if (current !== chart) current.destroy();
      }
      chart.resize(1000, 700);
      assert.deepEqual(chart.getSpec().view, spec.view);
    } finally { chart.destroy(); }
  }
});

test('multiline labels and true curved routes retain clearance instead of assuming a flat midpoint', () => {
  for (const renderer of ['svg', 'canvas']) for (const vertical of [false, true]) {
    const spec = edgeGapSpec({ renderer, vertical, label: 'Review\nrequest' });
    const chart = createChart(spec);
    try {
      const labels = [chart.model.scene.find('edge-label-0'), chart.model.scene.find('edge-label-0-1')], edge = chart.model.scene.find('edge-0');
      assert.equal(labels[0].geometry.text, 'Review'); assert.equal(labels[1].geometry.text, 'request');
      for (const label of labels) assert.equal(pathIntersectsBox(edge.geometry, textBox(label)), false);
      assert.equal(edge.geometry.exclusions, undefined);
      const lastBox = textBox(labels.at(-1)), firstBox = textBox(labels[0]);
      const gap = vertical ? Math.min(...labels.map(label => textBox(label).x)) - edge.geometry.points[0].x - edge.style.strokeWidth / 2 : edge.geometry.points[0].y - Math.max(firstBox.y + firstBox.height, lastBox.y + lastBox.height) - edge.style.strokeWidth / 2;
      assert.ok(Math.abs(gap - expectedGap(chart, edge, labels[0])) < 1e-6, `${vertical}: ${gap}`);
    } finally { chart.destroy(); }
    spec.diagram.routing = 'curved'; spec.nodes[1].position = { x: 360, y: 260 };
    const curve = createChart(spec);
    try {
      const edge = curve.model.scene.find('edge-0'), labels = [];
      curve.model.scene.walk(node => { if (node.type === 'text' && node.dataRef?.edgeId === 'link') labels.push(node); });
      assert.equal(edge.geometry.curve, 'cubic');
      for (const label of labels) assert.equal(pathIntersectsBox(edge.geometry, textBox(label)), false);
      assert.equal(edge.geometry.exclusions, undefined);
    } finally { curve.destroy(); }
  }
});

test('a real crossing protects text locally without masking its clear adjacent connector', () => {
  for (const background of ['#ffffff', 'transparent']) {
    const spec = edgeGapSpec({ label: 'Release' });
    spec.background = background;
    spec.nodes.push({ id: 'c', label: 'C', position: { x: 220, y: 0 }, size: { width: 80, height: 40 } }, { id: 'd', label: 'D', position: { x: 220, y: 180 }, size: { width: 80, height: 40 } });
    spec.edges.push({ id: 'crossing', from: 'c', to: 'd' });
    const chart = createChart(spec);
    try {
      const own = chart.model.scene.find('edge-0'), crossing = chart.model.scene.find('edge-1');
      assert.equal(own.geometry.exclusions, undefined);
      assert.ok(crossing.geometry.exclusions?.length > 0);
      assert.equal(Boolean(chart.model.scene.find('edge-label-0-background')), background !== 'transparent');
    } finally { chart.destroy(); }
  }
});

test('a bend uses a clear straight segment before moving its label far from the route', () => {
  for (const factory of [createChart, createDiagram]) for (const renderer of ['svg', 'canvas']) {
    const spec = { ...createSoftFlow(768), renderer }, chart = factory(spec);
    try {
      const label = chart.model.scene.find('edge-label-3'), line = chart.model.scene.find('edge-3'), box = textBox(label);
      const segmentX = line.geometry.points.at(-1).x;
      assert.equal(label.geometry.text, 'High risk');
      assert.equal(label.dataRef.onLine, true);
      assert.ok(Math.abs(box.x - segmentX - line.style.strokeWidth / 2 - expectedGap(chart, line, label)) < 1e-6);
      assert.ok(label.geometry.y > line.geometry.points.at(-2).y && label.geometry.y < line.geometry.points.at(-1).y);
      assert.equal(line.geometry.exclusions, undefined);
      assert.equal(chart.model.scene.find('edge-label-3-background'), undefined);
      assert.deepEqual(chart.getSpec().nodes, spec.nodes);
      assert.deepEqual(chart.getSpec().edges, spec.edges);
    } finally { chart.destroy(); }
  }
});

test('target gap adapts to content and chart size, reaches its limits and stops growing with blank canvas', () => {
  const measure = patch => {
    const chart = createChart({ ...edgeGapSpec({ label: 'X' }), ...patch });
    try {
      const label = chart.model.scene.find('edge-label-0'), line = chart.model.scene.find('edge-0'), box = textBox(label);
      return line.geometry.points[0].y - box.y - box.height - line.style.strokeWidth / 2;
    } finally { chart.destroy(); }
  };
  const small = measure({ width: 480, height: 250 }), regular = measure({}), blank = measure({ width: 9000, height: 6500 });
  assert.ok(small >= 2 && small < regular);
  assert.ok(Math.abs(blank - regular) < 1e-6);
  const bigNodes = edgeGapSpec().nodes.map(node => ({ ...node, size: { ...node.size, height: 80 } }));
  assert.ok(measure({ nodes: bigNodes }) > regular);
  assert.ok(Math.abs(measure({ width: 480, height: 240, theme: { marks: { lineWidth: .5 }, typography: { axis: { size: 8, font: '400 8px system-ui' } } } }) - 2) < 1e-6);
  assert.ok(Math.abs(measure({ theme: { marks: { lineWidth: 6 }, typography: { axis: { size: 48, font: '400 48px system-ui' } } } }) - 10) < 1e-6);
});

test('tight space can relax the normal minimum without masking a merely touching connector', () => {
  for (const height of [42, 40]) for (const factory of [createChart, createDiagram]) for (const renderer of ['svg', 'canvas']) {
    const spec = edgeGapSpec({ renderer }), lineY = height / 2;
    spec.height = height; spec.view = { scale: 1, offsetX: 0, offsetY: 0 };
    spec.nodes = spec.nodes.map(node => ({ ...node, position: { ...node.position, y: lineY - 20 } }));
    const chart = factory(spec);
    try {
      const label = chart.model.scene.find('edge-label-0'), edge = chart.model.scene.find('edge-0'), box = textBox(label);
      const gap = lineY - box.y - box.height - edge.style.strokeWidth / 2;
      assert.ok(Math.abs(gap - (height === 42 ? 1 : 0)) < 1e-6, `${height}/${renderer}: ${gap}`);
      assert.equal(label.geometry.text, 'Release');
      assert.equal(edge.geometry.exclusions, undefined);
      assert.equal(chart.model.scene.find('edge-label-0-background'), undefined);
      assert.deepEqual(chart.getSpec().nodes, spec.nodes);
    } finally { chart.destroy(); }
  }
});
