import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, normalizeSpec } from '../src/index.mjs';
import { fitTextBlock, polarLabelLayout } from '../src/layout.mjs';
import { buildProjectScene } from '../src/project.mjs';

test('fits diagram labels by wrapping and bounded font reduction before truncation', () => {
  const wrapped = fitTextBlock('Long process label', { maxWidth: 72, maxHeight: 32, size: 12, minSize: 10, maxLines: 2 });
  assert.ok(wrapped.lines.length <= 2);
  assert.ok(wrapped.size >= 10);
  assert.ok(wrapped.width <= 72);
  const compact = fitTextBlock('Long process label', { maxWidth: 28, maxHeight: 14, size: 12, minSize: 10, maxLines: 1 });
  assert.equal(compact.lines.length, 1);
  assert.equal(compact.truncated, true);
});

test('keeps diagram node labels centered and edge labels inline with readable plates', () => {
  const chart = createChart({
    type: 'flow', renderer: 'svg', width: 560, height: 300,
    nodes: [
      { id: 'start', kind: 'start', label: 'Start' },
      { id: 'check', kind: 'decision', label: 'Validate request', position: { x: 240, y: 100 } },
      { id: 'end', kind: 'end', label: 'End' }
    ],
    edges: [{ id: 'yes', from: 'start', to: 'check', label: 'yes' }, { id: 'done', from: 'check', to: 'end', label: 'approved' }]
  });
  const state = chart.getState(), node = chart.model.scene.find('node-check'), labels = [];
  chart.model.scene.walk(item => { if (item.id?.startsWith('node-label-check')) labels.push(item); });
  assert.equal((labels[0].geometry.y + labels.at(-1).geometry.y) / 2, node.bounds.y + node.bounds.height / 2);
  assert.equal(state.layout.labels.diagram.edgeOnLine, 2);
  assert.ok(chart.model.scene.find('edge-label-0-background'));
  assert.equal(state.layout.labels.diagram.backgrounded, 2);
  chart.destroy();
});

test('keeps generic chart labels plate-free while preserving readable placement', () => {
  const line = createChart({ type: 'line', renderer: 'svg', width: 320, height: 240, labels: { enabled: true }, encoding: { x: { field: 'name' }, y: { field: 'value' } }, data: [{ name: 'A', value: 10 }, { name: 'B', value: 20 }] });
  assert.ok(line.getState().layout.labels.marks.visible > 0);
  assert.equal(line.model.scene.find('series-0-item-0-label-background'), undefined);
  line.destroy();

  const pie = createChart({ type: 'pie', renderer: 'svg', width: 320, height: 240, labels: { enabled: true }, encoding: { category: { field: 'name' }, value: { field: 'value' } }, data: [{ name: 'A', value: 60 }, { name: 'B', value: 40 }] });
  assert.ok(pie.model.scene.find('series-0-item-0-label'));
  assert.equal(pie.model.scene.find('series-0-item-0-label-background'), undefined);
  assert.equal(pie.getState().layout.labels.marks.backgrounded, 0);
  pie.destroy();

  const radar = createChart({ type: 'radar', renderer: 'svg', width: 320, height: 260, indicators: [{ name: 'Quality', field: 'quality', min: 0, max: 100 }, { name: 'Speed', field: 'speed', min: 0, max: 100 }, { name: 'Coverage', field: 'coverage', min: 0, max: 100 }], data: [{ id: 'current', quality: 80, speed: 70, coverage: 90 }] });
  assert.equal(radar.getState().layout.labels.radar.visible + radar.getState().layout.labels.radar.hidden, 3);
  assert.equal(radar.model.scene.find('radar-plate-0'), undefined);
  radar.destroy();
});

test('keeps Pie labels on sector centerlines and adapts Gauge labels to radius', () => {
  const placement = polarLabelLayout('25%', { cx: 100, cy: 100, outerRadius: 80, startAngle: 0, endAngle: Math.PI / 2, size: 12, minSize: 10 });
  assert.ok(placement.x > 100 && placement.y > 100);
  assert.equal(placement.angle, Math.PI / 4);

  const pie = createChart({ type: 'pie', renderer: 'svg', width: 420, height: 300, labels: { enabled: true }, data: [{ name: 'A', value: 80 }, { name: 'B', value: 15 }, { name: 'C', value: 5 }] });
  const polar = pie.getState().layout.labels.polar;
  assert.equal(polar.visible, 3);
  assert.ok(polar.overflowed >= 0);
  assert.equal(pie.model.scene.find('series-0-item-0-label-background'), undefined);
  pie.destroy();

  const gauge = createChart({ type: 'gauge', renderer: 'svg', width: 240, height: 180, domain: [0, 100], data: [{ value: 82 }] });
  const gaugeLabel = gauge.model.scene.find('gauge-label'), gaugeState = gauge.getState().layout.labels.polar;
  assert.ok(gaugeLabel.geometry.y < gauge.model.scene.find('gauge-background').geometry.cy);
  assert.equal(gaugeState.visible, 1);
  gauge.destroy();
});

test('preserves readable label state across all diagram modes', () => {
  for (const type of ['architecture', 'mindmap', 'swimlane']) {
    const scene = buildProjectScene(normalizeSpec({ type, renderer: 'svg', width: 560, height: 300, layers: type === 'architecture' ? [{ id: 'service', label: 'Service' }] : undefined, lanes: type === 'swimlane' ? [{ id: 'lane', label: 'Lane' }] : undefined, nodes: [{ id: 'root', label: 'A long readable node label', ...(type === 'architecture' ? { layerId: 'service' } : {}), ...(type === 'swimlane' ? { laneId: 'lane' } : {}) }], edges: [] }));
    assert.ok(scene.state.labelLayout.diagram);
    assert.ok(scene.scene.find('node-root'));
  }
});
