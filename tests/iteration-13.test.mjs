import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartValidationError, createChart, getCapabilities, validateSpec } from '../src/index.mjs';

test('mutation validation rejects atomically with a structured error', () => {
  const chart = createChart({ type: 'line', data: [{ id: 'a', name: 'A', value: 1 }] });
  const before = chart.getSpec();
  const state = chart.getState();
  let renders = 0;
  chart.on('render', () => { renders += 1; });
  assert.throws(() => chart.update({ width: 0 }), error => {
    assert.ok(error instanceof ChartValidationError);
    assert.equal(error.code, 'CHART_VALIDATION_FAILED');
    assert.equal(error.path, 'width');
    assert.ok(error.suggestion);
    return true;
  });
  assert.deepEqual(chart.getSpec(), before);
  assert.equal(chart.getState().revision, state.revision);
  assert.equal(renders, 0);
  chart.destroy();
});

test('project row contracts agree at construction and data replacement', () => {
  const invalid = validateSpec({ type: 'gantt', data: [{ id: 'a', start: '2026-09-01', end: '2026-09-02' }, { id: 'b', start: 'bad', end: '2026-09-03' }] });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some(error => error.path === 'data.values[1].start'));
  assert.ok(invalid.errors.some(error => error.code === 'MISSING_RECORD_ID') === false);
  const chart = createChart({ type: 'gantt', data: [{ id: 'a', name: 'A', start: '2026-09-01', end: '2026-09-02' }] });
  const before = chart.getSpec();
  assert.throws(() => chart.setData([{ id: 'a', start: 'bad', end: '2026-09-02' }]), ChartValidationError);
  assert.deepEqual(chart.getSpec(), before);
  chart.destroy();
});

test('contract registry exposes diagram edge and export policy', () => {
  const capabilities = getCapabilities();
  assert.equal(capabilities.contractVersion, '1.1');
  assert.deepEqual(capabilities.exports, ['png', 'jpeg', 'svg', 'json']);
  assert.deepEqual(capabilities.diagramEdgeModels, ['flow-edge', 'architecture-edge', 'mindmap-edge']);
  assert.equal(capabilities.commands.length, 25);
});

test('burndown date policy is deterministic and visible', () => {
  const result = validateSpec({ type: 'burndown', data: [{ date: '2026-09-02', remaining: 8 }, { date: '2026-09-02', remaining: 7 }, { date: '2026-09-01', remaining: 6 }] });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some(warning => warning.code === 'DUPLICATE_DATE'));
  assert.ok(result.warnings.some(warning => warning.code === 'OUT_OF_ORDER_DATE'));
});

test('destroy is idempotent', () => {
  const chart = createChart({ type: 'line', data: [{ name: 'A', value: 1 }] });
  assert.doesNotThrow(() => { chart.destroy(); chart.destroy(); });
});

test('axis-free charts use dedicated body geometry without changing Cartesian layout', () => {
  const pie = createChart({
    type: 'pie', renderer: 'svg', width: 560, height: 300,
    title: { text: 'Revenue mix' },
    data: [{ name: 'Product', value: 42 }, { name: 'Service', value: 28 }, { name: 'Other', value: 18 }]
  });
  assert.equal(pie.model.state.layoutFamily, 'pie');
  assert.ok(pie.model.state.plot.height >= 180);
  assert.ok(pie.model.scene.find('series-0-item-0').geometry.r >= 80);
  assert.ok(pie.model.state.plot.y > pie.model.state.chrome.legend.bottom);

  const rightLegend = createChart({
    type: 'pie', renderer: 'svg', width: 560, height: 300,
    legend: { position: 'right' },
    data: [{ name: 'Product', value: 42 }, { name: 'Service', value: 28 }]
  });
  assert.equal(rightLegend.model.state.chrome.legend.position, 'right');
  assert.ok(rightLegend.model.state.plot.x + rightLegend.model.state.plot.width <= rightLegend.model.state.chrome.legend.left - 12);
  assert.ok(rightLegend.model.state.plot.width > 300);

  const bottomLegend = createChart({
    type: 'radar', renderer: 'svg', width: 560, height: 300,
    legend: { position: 'bottom' },
    indicators: [{ name: 'Quality', field: 'quality', min: 0, max: 100 }, { name: 'Speed', field: 'speed', min: 0, max: 100 }, { name: 'UX', field: 'ux', min: 0, max: 100 }],
    data: [{ id: 'alpha', name: 'Alpha', quality: 84, speed: 72, ux: 90 }, { id: 'beta', name: 'Beta', quality: 70, speed: 88, ux: 75 }]
  });
  assert.equal(bottomLegend.model.state.chrome.legend.position, 'bottom');
  assert.ok(bottomLegend.model.state.plot.y + bottomLegend.model.state.plot.height <= bottomLegend.model.state.chrome.legend.top - 12);

  const gauge = createChart({ type: 'gauge', renderer: 'svg', width: 560, height: 300, domain: [0, 100], data: [{ name: 'SLA', value: 82 }] });
  assert.equal(gauge.model.state.layoutFamily, 'gauge');
  assert.ok(gauge.model.scene.find('gauge-background').geometry.r > 100);

  const explicit = createChart({ type: 'pie', renderer: 'svg', width: 560, height: 300, padding: { top: 20, right: 20, bottom: 80, left: 20 }, data: [{ name: 'A', value: 1 }] });
  assert.equal(explicit.model.state.plot.y + explicit.model.state.plot.height, 300 - 80 - 18);

  const line = createChart({ type: 'line', renderer: 'svg', width: 560, height: 300, data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] });
  assert.equal(line.model.state.layoutFamily, 'cartesian');
  assert.equal(line.model.state.plot.x, 56);

  [pie, rightLegend, bottomLegend, gauge, explicit, line].forEach(chart => chart.destroy());
});
