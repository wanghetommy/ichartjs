import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, getCapabilities, getChartContract, inspectData, planChart, validateRecipe, validateSpec } from '../src/index.mjs';
import fs from 'node:fs';

test('publishes a complete per-chart Agent contract for every public type', () => {
  const capabilities = getCapabilities();
  assert.deepEqual(Object.keys(capabilities.chartContracts).sort(), [...capabilities.chartTypes].sort());
  for (const type of capabilities.chartTypes) {
    const contract = getChartContract(type);
    assert.equal(contract.type, type);
    assert.equal(contract.version, '1.0');
    assert.ok(contract.required.length > 0);
    assert.ok(contract.renderers.includes('svg'));
    assert.ok(contract.renderers.includes('canvas'));
    assert.deepEqual(contract.defaults, { renderer: 'auto', navigation: false, editing: false, motion: 'auto' });
    assert.equal(contract.discovery.contract, 'getChartContract(type)');
  }
});

test('returns machine-readable data quality findings without mutating input', () => {
  const input = [{ id: 'a', name: 'A', revenue: 10, cost: 4 }, { id: 'a', name: 'B', revenue: 20, cost: null }];
  const report = inspectData(input);
  assert.equal(input[1].cost, null);
  assert.equal(report.quality.status, 'degraded');
  assert.ok(report.quality.issues.includes('MISSING_VALUE'));
  assert.ok(report.quality.issues.includes('DUPLICATE_RECORD_ID'));
  assert.ok(report.quality.issues.includes('MIXED_MEASURE_UNITS') === false);
  assert.ok(report.warnings.some(warning => warning.code === 'DUPLICATE_RECORD_ID'));
});

test('carries data quality into Agent planning and explanation inputs', () => {
  const plan = planChart([{ id: 'a', name: 'A', value: 10 }, { id: 'a', name: 'B', value: 20 }], { intent: 'trend' });
  assert.ok(plan.data.quality.issues.includes('DUPLICATE_RECORD_ID'));
  assert.ok(plan.warnings.some(warning => warning.code === 'DUPLICATE_RECORD_ID'));
});

test('validates built-in chart recipes without requiring a caller-supplied capability object', () => {
  const recipe = JSON.parse(fs.readFileSync(new URL('../agent-recipes/trend-line.json', import.meta.url), 'utf8'));
  assert.equal(validateRecipe(recipe).valid, true);
});

test('plans and validates Scatter around two quantitative fields', () => {
  const rows = [{ id: 'a', spend: 10, conversion: 3.2 }, { id: 'b', spend: 14, conversion: 4.1 }];
  const plan = planChart(rows, { intent: 'relationship' });
  assert.deepEqual(plan.requiredFields, []);
  const valid = validateSpec({ type: 'scatter', data: { values: rows }, encoding: { x: { field: 'spend' }, y: { field: 'conversion' } } });
  assert.equal(valid.valid, true);
  const chart = createChart(valid.spec);
  assert.equal(chart.getState().health.metrics.renderedMarks, 2);
  chart.destroy();
  const invalid = validateSpec({ type: 'scatter', data: { values: [{ segment: 'A', value: 1 }] }, encoding: { x: { field: 'segment' }, y: { field: 'value' } } });
  assert.ok(invalid.errors.some(error => error.code === 'SCATTER_REQUIRES_QUANTITATIVE_FIELDS'));
});

test('keeps normalized Specs idempotent and gives targeted placement diagnostics', () => {
  const input = { type: 'gantt', data: { values: [{ id: 'a', name: 'A', start: '2026-01-01', end: '2026-01-02' }] }, dependencies: [{ from: 'a', to: 'a' }] };
  const first = validateSpec(input);
  const second = validateSpec(first.spec);
  assert.deepEqual(second.warnings.map(warning => warning.code), first.warnings.map(warning => warning.code));
  assert.ok(first.warnings.some(warning => warning.code === 'UNSUPPORTED_GANTT_DEPENDENCY_PLACEMENT'));
  const size = validateSpec({ type: 'line', size: { width: 900, height: 500 }, data: { values: [{ name: 'A', value: 1 }] } });
  assert.ok(size.warnings.some(warning => warning.code === 'UNSUPPORTED_SIZE_OPTION'));
});
