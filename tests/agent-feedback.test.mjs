import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, data, inspectData, normalizeData, planChart, validateEdit } from '../src/index.mjs';
import { createChart as createStandardChart } from '../src/standard.mjs';

const flowSpec = { type: 'flow', nodes: [{ id: 'start', kind: 'start', label: 'Start' }], edges: [], diagram: { layout: 'layered', routing: 'auto' } };
const addNode = { type: 'layout-edit', operations: [{ op: 'addNode', node: { id: 'review', kind: 'process', label: 'Review' } }] };

test('identifier roles exclude numeric IDs from primary and secondary measures', () => {
  for (const field of ['id', '_id', 'record_id', 'record-key', 'userId', 'userID', 'recordKey', 'uuid', 'recordUuid']) {
    for (const values of [[1, 2], ['1', '2'], ['001', '1'], ['9007199254740992', '9007199254740993']]) {
      const rows = values.map((value, index) => ({ [field]: value, month: ['Jan', 'Feb'][index], value: String(100 + index) }));
      const before = structuredClone(rows);
      const normalized = normalizeData(rows);
      assert.deepEqual(normalized.rows.map(row => row[field]), values);
      assert.equal(normalized.fields.find(item => item.name === field).role, 'identifier');
      assert.deepEqual(inspectData(rows).measures, ['value']);
      assert.deepEqual(planChart(rows).suggestedEncodings, { dimension: 'month', measure: 'value', secondaryMeasure: null });
      assert.deepEqual(rows, before);
      const reordered = rows.map(row => ({ month: row.month, value: row.value, [field]: row[field] }));
      assert.equal(planChart(reordered).suggestedEncodings.secondaryMeasure, null);
    }
  }
});

test('identifier normalization preserves distinct and duplicate identities through input adapters', () => {
  const rows = ['001', '1', '9007199254740992', '9007199254740993'].map((id, index) => ({ id, name: `Row ${index}`, value: `${index + 1}` }));
  for (const input of [rows, { values: rows }]) {
    assert.deepEqual(normalizeData(input).rows.map(row => row.id), rows.map(row => row.id));
    assert.deepEqual(data(input).toArray().map(row => row.id), rows.map(row => row.id));
    assert.equal(inspectData(input).quality.status, 'ready');
  }
  const duplicate = inspectData([...rows, rows[0]]).warnings.find(item => item.code === 'DUPLICATE_RECORD_ID');
  assert.equal(duplicate.firstRow, 0);
  assert.equal(duplicate.row, 4);
});

test('planning never uses identifiers to satisfy dimension or Scatter/Radar requirements', () => {
  const rows = [{ id: '1', value: 100 }, { id: '2', value: 120 }];
  assert.deepEqual(planChart(rows).requiredFields, ['dimension']);
  assert.deepEqual(planChart(rows, { intent: 'relationship' }).requiredFields, ['two quantitative measures']);
  assert.deepEqual(planChart(rows.map(row => ({ ...row, cost: 30 })), { intent: 'multidimensional' }).requiredFields, ['three quantitative measures']);
  const temporalIds = [{ id: '2026-01-01', value: 100 }, { id: '2026-01-02', value: 120 }];
  assert.deepEqual(inspectData(temporalIds).temporalFields, []);
  assert.equal(planChart(temporalIds, { intent: 'unregistered' }).primary, 'bar');
});

test('unique measures and ambiguous field names are not guessed to be identifiers', () => {
  const rows = [{ name: 'A', revenue: '100', code: '11', no: '1', liquid: '5', valid: '10' }, { name: 'B', revenue: '120', code: '12', no: '2', liquid: '6', valid: '20' }];
  assert.deepEqual(inspectData(rows).measures, ['revenue', 'code', 'no', 'liquid', 'valid']);
  assert.equal(planChart(rows).suggestedEncodings.measure, 'revenue');
  assert.equal(normalizeData(rows).rows[0].revenue, 100);
});

test('record-ID diagnostics do not assume foreign identifier columns are unique', () => {
  const rows = [{ userId: '007', key: 'same', id: '001', value: 100 }, { userId: '007', key: 'same', id: '002', value: 120 }];
  assert.equal(inspectData(rows).warnings.some(item => item.code === 'DUPLICATE_RECORD_ID'), false);
  assert.equal(inspectData(rows.map(({ id, ...row }) => row)).warnings.find(item => item.code === 'DUPLICATE_RECORD_ID').path, 'data.values.1.key');
  assert.equal(inspectData(rows.map(row => ({ userId: row.userId, value: row.value }))).warnings.some(item => item.code === 'DUPLICATE_RECORD_ID'), false);
});

for (const [entry, create] of [['root', createChart], ['standard', createStandardChart]]) {
  for (const renderer of ['svg', 'canvas']) {
    test(`${entry}/${renderer}: normalized data, lineage and JSON keep the original ID strings`, () => {
      const rows = [{ id: '001', name: 'A', value: '100' }, { id: '9007199254740993', name: 'B', value: '120' }];
      const chart = create({ type: 'line', renderer, data: { values: rows }, encoding: { x: { field: 'name' }, y: { field: 'value' } } });
      try {
        const normalized = entry === 'root' ? chart.toDataTable() : chart.getData().rows;
        assert.deepEqual(normalized.map(row => row.id), rows.map(row => row.id));
        assert.deepEqual(chart.explain().lineage.recordIds, rows.map(row => row.id));
        assert.deepEqual(JSON.parse(chart.export({ type: 'json' })).spec.data.values.map(row => row.id), rows.map(row => row.id));
        assert.ok(chart.export({ type: 'svg' }).includes('<svg'));
      } finally { chart.destroy(); }
    });
  }
}

test('standalone structural validation diagnoses host context permissions, not generated commands', () => {
  const rejected = validateEdit(addNode, { ...flowSpec, editing: { enabled: true, allowStructuralChanges: true } });
  const diagnostic = rejected.errors.find(item => item.code === 'STRUCTURAL_EDIT_DISABLED');
  assert.match(diagnostic.suggestion, /options\.allowStructuralChanges/);
  assert.match(diagnostic.suggestion, /host/i);
  assert.equal(validateEdit({ ...addNode, allowStructuralChanges: true }, flowSpec).valid, false);
  assert.equal(validateEdit(addNode, { ...flowSpec, allowStructuralChanges: true }).valid, true);
});

test('instance validation uses the same diagram context and permissions as preview without issuing a preview', () => {
  const chart = createChart({ ...flowSpec, editing: { enabled: true, allowStructuralChanges: true } });
  try {
    const before = chart.getSpec(), revision = chart.getState().revision, history = chart.getState().history;
    const validation = chart.validateEdit(addNode);
    assert.equal(validation.valid, true);
    assert.equal(chart._editor.pending.size, 0);
    assert.deepEqual(chart.getSpec(), before);
    assert.deepEqual(chart.getState().history, history);
    assert.equal(chart.getState().revision, revision);
    const preview = chart.previewEdit(addNode);
    assert.deepEqual(validation.errors, preview.errors);
    assert.deepEqual(validation.warnings, preview.warnings);
    assert.equal(chart.applyEdit(addNode, { preview, confirmed: true }).valid, true);
    chart.undo();
    chart.update({ editing: { enabled: true, allowStructuralChanges: false } });
    const blocked = chart.validateEdit(addNode).errors.find(item => item.code === 'STRUCTURAL_EDIT_DISABLED');
    assert.match(blocked.suggestion, /editing\.enabled/);
    assert.match(blocked.suggestion, /editing\.allowStructuralChanges/);
    assert.doesNotMatch(blocked.suggestion, /options\.allowStructuralChanges/);
    assert.equal(chart.previewEdit(addNode).valid, false);
    assert.equal(chart.validateEdit({ type: 'layout-edit', operations: [] }).valid, false);
  } finally { chart.destroy(); }
});
