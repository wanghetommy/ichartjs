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
