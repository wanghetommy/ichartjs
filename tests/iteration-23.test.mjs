import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createChart, inspectData, validateSpec } from '../src/index.mjs';
import { createChart as createStandardChart } from '../src/standard.mjs';
import { createChart as createProjectChart } from '../src/project-profile.mjs';
import { createChart as createDiagramChart } from '../src/diagram-profile.mjs';

const fixtures = {
  standard: { type: 'line', data: { values: [{ id: 'a', name: 'A', value: 1 }, { id: 'b', name: 'B', value: 2 }] }, encoding: { x: { field: 'name' }, y: { field: 'value' } } },
  project: { type: 'gantt', data: { values: [{ id: 'task', name: 'Task', start: '2026-01-01', end: '2026-01-02' }] } },
  diagram: { type: 'flow', nodes: [{ id: 'start', label: 'Start', kind: 'start' }, { id: 'end', label: 'End', kind: 'end' }], edges: [{ from: 'start', to: 'end' }] }
};

function assertLineage(chart, ids) {
  try {
    const state = chart.getState();
    const explanation = chart.explain();
    assert.equal(state.health.renderable, true);
    assert.deepEqual(explanation.lineage.recordIds, ids);
    if (state.lineage) assert.deepEqual(state.lineage.recordIds, ids);
    assert.equal(chart.export({ type: 'svg' }).includes('<svg'), true);
  } finally {
    chart.destroy();
  }
}

test('keeps root and focused Profile entries independently usable with lineage', () => {
  assertLineage(createChart({ ...fixtures.standard, renderer: 'svg' }), ['a', 'b']);
  assertLineage(createStandardChart({ ...fixtures.standard, renderer: 'svg' }), ['a', 'b']);
  assertLineage(createProjectChart({ ...fixtures.project, renderer: 'svg' }), ['task']);
  assertLineage(createDiagramChart({ ...fixtures.diagram, renderer: 'svg' }), ['start', 'end']);
});

test('keeps first-run data boundary diagnostics actionable', () => {
  const invalid = validateSpec({ type: 'line', data: { values: { month: 'Jan' } }, encoding: { x: { field: 'month' }, y: { field: 'value' } } });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors[0].code, 'INVALID_DATA');
  assert.equal(invalid.errors[0].path, 'data.values');
  assert.ok(invalid.errors[0].suggestion);

  const inspection = inspectData([{ id: 'same', month: 'Jan', value: 1 }, { id: 'same', month: 'Feb', value: 2 }]);
  assert.equal(inspection.quality.status, 'degraded');
  assert.ok(inspection.warnings.some(item => item.code === 'DUPLICATE_RECORD_ID'));
});

test('publishes the browser consumer fixture next to the Node fixture', async () => {
  const [browser, node] = await Promise.all([
    readFile(new URL('../examples/consumer-browser.html', import.meta.url), 'utf8'),
    readFile(new URL('../examples/consumer-quickstart.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(browser, /@taylorwong\/ichartjs/);
  assert.match(browser, /type="importmap"/);
  assert.match(node, /@taylorwong\/ichartjs\/project/);
  assert.match(node, /createBoard/);
});
