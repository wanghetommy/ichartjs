import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart } from '../src/index.mjs';
import { createChart as createDiagram } from '../src/diagram-profile.mjs';
import { boxesOverlap, estimateTextWidth, fontPixels } from '../src/layout.mjs';
import { pathIntersectsBox } from '../src/path.mjs';
import { edgeLabelLayoutSpec, manualEdgeLabelSpec } from './fixtures/edge-label-layout.mjs';

function labelBox(label) {
  const size = fontPixels(label.style.font), width = estimateTextWidth(label.geometry.text, size, label.style.font);
  return { x: label.geometry.x - width / 2, y: label.geometry.y - size * 0.6, width, height: size * 1.2 };
}

test('reported Flow keeps labels complete and compact without attaching an offset label to its return route', () => {
  for (const factory of [createChart, createDiagram]) for (const renderer of ['svg', 'canvas']) {
    const spec = edgeLabelLayoutSpec(renderer), chart = factory(spec);
    try {
      const label = chart.model.scene.find('edge-label-1');
      assert.equal(label.geometry.text, '进入风控');
      assert.equal(label.dataRef.onLine, false);
      assert.ok(label.dataRef.offsetY > 0 && label.dataRef.offsetY < 37);
      assert.equal(pathIntersectsBox(chart.model.scene.find('edge-5').geometry, labelBox(label)), false);
      assert.equal(chart.model.state.labelLayout.diagram.wrapped, 0);
      assert.deepEqual(chart.getState().warnings, []);
      for (let index = 0; index < spec.edges.length; index += 1) {
        const text = chart.model.scene.find(`edge-label-${index}`);
        assert.equal(text.geometry.text, spec.edges[index].label);
        assert.equal(text.dataRef.offsetY > 0, index === 1);
        if (index < 5) {
          const points = chart.model.scene.find(`edge-${index}`).dataRef.diagramPoints;
          assert.equal(points.length, 2);
          assert.equal(points[1].x - points[0].x, 48);
        }
        for (const node of spec.nodes) assert.equal(boxesOverlap(labelBox(text), chart.model.scene.find(`node-${node.id}`).bounds, 4), false);
      }
      assert.deepEqual(chart.getSpec().nodes, spec.nodes);
      assert.deepEqual(chart.getSpec().edges, spec.edges);
      const restored = factory(chart.getSpec());
      assert.equal(restored.export({ type: 'svg' }), chart.export({ type: 'svg' }));
      restored.destroy();
    } finally { chart.destroy(); }
  }
});

test('shared Diagram placement prefers the same screen side regardless of horizontal edge direction', () => {
  for (const type of ['flow', 'architecture', 'mindmap', 'swimlane']) for (const reverse of [false, true]) for (const renderer of ['svg', 'canvas']) {
    const chart = createChart({ ...manualEdgeLabelSpec(type, reverse), renderer });
    try {
      const label = chart.model.scene.find('edge-label-0');
      assert.equal(label.geometry.text, '进入风控');
      assert.ok(label.dataRef.offsetY < 0 && Math.abs(label.dataRef.offsetY) < 37, `${type}/${reverse}/${renderer}`);
      assert.equal(label.dataRef.onLine, false);
      assert.equal(chart.getState().warnings.some(warning => warning.code.startsWith('LABEL_')), false);
    } finally { chart.destroy(); }
  }
});

test('a blocked preferred side yields to the closer clear side without moving any nodes or routes', () => {
  const spec = manualEdgeLabelSpec();
  spec.nodes.push({ id: 'blocker', label: 'Blocker', position: { x: 194, y: 100 }, size: { width: 44, height: 78 } });
  for (const factory of [createChart, createDiagram]) {
    const chart = factory(spec);
    try {
      const label = chart.model.scene.find('edge-label-0');
      assert.ok(label.dataRef.offsetY > 0 && label.dataRef.offsetY < 37);
      assert.equal(label.geometry.text, '进入风控');
      for (const node of spec.nodes) assert.equal(boxesOverlap(labelBox(label), chart.model.scene.find(`node-${node.id}`).bounds, 4), false);
      assert.deepEqual(chart.model.scene.find('edge-0').dataRef.diagramPoints, [{ x: 192, y: 204 }, { x: 240, y: 204 }]);
      assert.deepEqual(chart.getSpec().nodes, spec.nodes);
    } finally { chart.destroy(); }
  }
});

test('readable inline labels remain inline and resize/reload never rewrites the viewport', () => {
  for (const scale of [0.64, 1, 1.5]) {
    const spec = manualEdgeLabelSpec();
    spec.edges[0].label = '行';
    spec.view = { scale, offsetX: 12, offsetY: 8 };
    const chart = createChart(spec);
    try {
      const before = structuredClone(chart.model.scene.find('edge-0').dataRef.diagramPoints);
      assert.equal(chart.model.scene.find('edge-label-0').dataRef.onLine, true);
      chart.resize(800, 460);
      assert.equal(chart.model.scene.find('edge-label-0').dataRef.onLine, true);
      assert.deepEqual(chart.model.scene.find('edge-0').dataRef.diagramPoints, before);
      assert.deepEqual(chart.getSpec().view, spec.view);
      assert.deepEqual(chart.getSpec().nodes, spec.nodes);
    } finally { chart.destroy(); }
  }
});

test('offset labels remain separated and vertical edges stay readable across font and zoom changes', () => {
  for (const renderer of ['svg', 'canvas']) for (const scale of [0.64, 1, 1.5]) for (const size of [12, 16]) {
    const spec = manualEdgeLabelSpec();
    spec.renderer = renderer;
    spec.view = { scale, offsetX: 12, offsetY: 8 };
    spec.theme = { typography: { axis: { size, font: `400 ${size}px system-ui` } } };
    spec.edges.push({ ...spec.edges[0], id: 'other' });
    const chart = createChart(spec);
    try {
      const labels = [0, 1].map(index => chart.model.scene.find(`edge-label-${index}`));
      assert.equal(boxesOverlap(labelBox(labels[0]), labelBox(labels[1]), 2), false);
      for (const label of labels) {
        assert.equal(label.geometry.text, '进入风控');
        for (const node of spec.nodes) assert.equal(boxesOverlap(labelBox(label), chart.model.scene.find(`node-${node.id}`).bounds, 2), false);
      }
    } finally { chart.destroy(); }
    spec.edges.pop();
    spec.nodes[1].position = { x: 80, y: 300 };
    const vertical = createChart(spec);
    try {
      assert.equal(vertical.model.scene.find('edge-label-0').geometry.text, '进入风控');
      assert.equal(vertical.getState().warnings.some(warning => warning.code.startsWith('LABEL_')), false);
    } finally { vertical.destroy(); }
  }
});
