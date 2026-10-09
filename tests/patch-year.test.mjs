import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartValidationError, createChart, inspectData, normalizeData, planChart } from '../src/index.mjs';

const node = id => ({ id, kind: 'process', label: id.toUpperCase() });
const flow = renderer => createChart({ type: 'flow', renderer, nodes: [node('a'), node('b')], edges: [], editing: { enabled: true, allowStructuralChanges: true } });

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer}: array patches append, insert, replace and remove without dropping neighbors`, () => {
    const chart = flow(renderer);
    try {
      chart.applyPatch([{ op: 'add', path: '/nodes/-', value: node('c') }]);
      assert.deepEqual(chart.getSpec().nodes.map(item => item.id), ['a', 'b', 'c']);
      chart.applyPatch([{ op: 'add', path: '/nodes/1', value: node('d') }]);
      assert.deepEqual(chart.getSpec().nodes.map(item => item.id), ['a', 'd', 'b', 'c']);
      chart.applyPatch([{ op: 'replace', path: '/nodes/2', value: node('e') }]);
      chart.applyPatch([{ op: 'remove', path: '/nodes/0' }]);
      assert.deepEqual(chart.getSpec().nodes.map(item => item.id), ['d', 'e', 'c']);
      assert.equal(chart.getState().revision, 4);
      const reloaded = createChart(JSON.parse(chart.export({ type: 'json' })).spec);
      try { assert.deepEqual(reloaded.getSpec().nodes, chart.getSpec().nodes); } finally { reloaded.destroy(); }
      assert.ok(chart.export({ type: 'svg' }).includes('<svg'));
    } finally { chart.destroy(); }
  });
}

test('array patches work on data.values, edges and nested coordinates using sequential indices', () => {
  const chart = createChart({ type: 'line', data: { values: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] } });
  try {
    const patches = [{ op: 'add', path: '/data/values/1', value: { name: 'C', value: 3 } }, { op: 'remove', path: '/data/values/0' }, { op: 'add', path: '/data/values/2', value: { name: 'D', value: 4 } }];
    const before = structuredClone(patches);
    chart.applyPatch(patches);
    assert.deepEqual(chart.toDataTable().map(row => row.name), ['C', 'B', 'D']);
    assert.deepEqual(patches, before);
    assert.equal(chart.getState().revision, 1);
  } finally { chart.destroy(); }
  const diagram = flow('svg');
  try {
    diagram.applyPatch([{ op: 'add', path: '/edges/-', value: { id: 'ab', from: 'a', to: 'b' } }, { op: 'add', path: '/nodes/0/position', value: { x: 0, y: 0 } }, { op: 'replace', path: '/nodes/0/position/x', value: 80 }]);
    assert.equal(diagram.getSpec().nodes[0].position.x, 80);
    diagram.applyPatch([{ op: 'remove', path: '/nodes/0' }, { op: 'remove', path: '/edges/0' }]);
    assert.deepEqual(diagram.getSpec().nodes.map(item => item.id), ['b']);
    assert.deepEqual(diagram.getSpec().edges, []);
  } finally { diagram.destroy(); }
});

test('invalid patches reject atomically with structured errors and preserve pending edit previews', () => {
  const chart = flow('svg');
  try {
    const command = { type: 'layout-edit', operations: [{ op: 'addNode', node: node('planned') }] };
    const preview = chart.previewEdit(command);
    const before = chart.getSpec(), state = chart.getState(), svg = chart.export({ type: 'svg' });
    for (const patch of [
      { op: 'add', path: '/nodes/abc', value: node('x') },
      { op: 'add', path: '/nodes/01', value: node('x') },
      { op: 'add', path: '/nodes/-1', value: node('x') },
      { op: 'add', path: '/nodes/3', value: node('x') },
      { op: 'replace', path: '/nodes/2', value: node('x') },
      { op: 'remove', path: '/nodes/2' },
      { op: 'replace', path: '/nodes/-', value: node('x') },
      { op: 'remove', path: '/nodes/-' },
      { op: 'add', path: '/nodes/length', value: 0 },
      { op: 'replace', path: '/title/missing', value: 'No' },
      { op: 'remove', path: '/title/missing' },
      { op: 'add', path: '/nodes/length/x', value: 1 },
      { op: 'add', path: '/__proto__/patchPollution', value: true },
      { op: 'replace', path: '/constructor/prototype/patchPollution', value: true },
      { op: 'add', path: '/title/bad~2key', value: 'No' },
      { op: 'add', path: '/nodes/-' },
      { op: 'replace', path: '/nodes/0', value: undefined },
      { op: 'copy', path: '/nodes/0', value: node('x') }
    ]) {
      assert.throws(() => chart.applyPatch([{ op: 'add', path: '/title/subtitle', value: 'Must roll back' }, patch]), error => error instanceof ChartValidationError && ['INVALID_PATCH', 'INVALID_PATCH_PATH'].includes(error.details[0].code), JSON.stringify(patch));
      assert.deepEqual(chart.getSpec(), before);
      assert.equal(chart.getState().revision, state.revision);
      assert.deepEqual(chart.getState().history, state.history);
      assert.equal(chart.export({ type: 'svg' }), svg);
    }
    assert.equal(Object.prototype.patchPollution, undefined);
    assert.equal(chart.applyEdit(command, { preview, confirmed: true }).valid, true);
  } finally { chart.destroy(); }
});

test('patch input and values are JSON-safe, empty batches are no-ops and final Spec failures roll back', () => {
  const chart = flow('svg');
  try {
    const before = chart.getSpec(), revision = chart.getState().revision;
    assert.equal(chart.applyPatch([]), chart);
    assert.equal(chart.applyPatch(), chart);
    assert.equal(chart.getState().revision, revision);
    for (const input of [null, {}, 'patch', new Array(1), [node('a'), , node('b')], [{ op: 'add', path: '/title/text', value: Infinity }]]) assert.throws(() => chart.applyPatch(input), ChartValidationError);
    assert.throws(() => chart.applyPatch([{ op: 'add', path: '/nodes/-', value: node('a') }]), ChartValidationError);
    assert.deepEqual(chart.getSpec(), before);
    assert.equal(chart.getState().revision, revision);
  } finally { chart.destroy(); }
});

test('escaped pointers address own object keys without changing other keys', () => {
  const chart = createChart({ type: 'line', data: [{ name: 'A', value: 1, 'a/b': 2, '~tag': 3 }] });
  try {
    chart.applyPatch([{ op: 'replace', path: '/data/values/0/a~1b', value: 4 }, { op: 'replace', path: '/data/values/0/~0tag', value: 5 }]);
    assert.equal(chart.getSpec().data.values[0]['a/b'], 4);
    assert.equal(chart.getSpec().data.values[0]['~tag'], 5);
  } finally { chart.destroy(); }
});

test('annual dimensions retain quantitative types without becoming measures or fabricated dates', () => {
  for (const field of ['year', 'Year', 'fiscalYear', 'birth_year', 'academic-year']) {
    for (const values of [[2016, 2017], ['2016', '2017']]) {
      const rows = values.map((value, index) => ({ id: `${index}`, [field]: value, revenue: `${index + 10}` }));
      const before = structuredClone(rows), inspection = inspectData(rows), info = inspection.fields.find(item => item.name === field);
      assert.equal(info.type, 'quantitative');
      assert.equal(info.role, 'dimension');
      assert.deepEqual(inspection.dimensions, [field]);
      assert.deepEqual(inspection.measures, ['revenue']);
      assert.deepEqual(inspection.temporalFields, []);
      const plan = planChart(rows, { intent: 'trend' });
      assert.deepEqual(plan.requiredFields, []);
      assert.deepEqual(plan.suggestedEncodings, { dimension: field, measure: 'revenue', secondaryMeasure: null });
      assert.deepEqual(rows, before);
    }
  }
});

test('year inference is bounded and does not change ordinary numeric strings or identifier roles', () => {
  for (const values of [[1, 2], [2016, 2], [2016.5, 2017], [999, 2016], [2016, 10000]]) {
    assert.equal(inspectData(values.map(year => ({ year }))).fields[0].role, 'measure');
  }
  const rows = [{ year: '2016', price: '12.5', count: '10', yearOverYear: '25', years: '5', year_id: '001' }, { year: null, price: '15.5', count: '20', yearOverYear: '30', years: '6', year_id: '002' }];
  assert.deepEqual(inspectData(rows).measures, ['price', 'count', 'yearOverYear', 'years']);
  assert.equal(normalizeData(rows).rows[0].year_id, '001');
  assert.equal(inspectData([{ year: null }]).fields[0].role, 'dimension');
  assert.equal(planChart(rows, { intent: 'relationship' }).suggestedEncodings.measure, 'price');
});
