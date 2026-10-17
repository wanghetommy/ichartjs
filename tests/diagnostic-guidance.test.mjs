import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, getCapabilities, planStyle, validateSpec } from '../src/index.mjs';
import { createChart as createStandard } from '../src/standard.mjs';
import { createChart as createDiagram } from '../src/diagram-profile.mjs';

const rows = Array.from({ length: 12 }, (_, index) => ({ id: `r${index}`, name: `M${index + 1}`, value: index + 1, second: index + 2 }));
const colorWarnings = chart => chart.getState().warnings.filter(warning => warning.code === 'HIGH_CARDINALITY_COLOR');
const chain = count => ({ nodes: Array.from({ length: count }, (_, index) => ({ id: `n${index}`, label: `Step ${index + 1}` })), edges: Array.from({ length: count - 1 }, (_, index) => ({ from: `n${index}`, to: `n${index + 1}` })) });

test('color cardinality counts colored series rather than x-axis points', () => {
  for (const factory of [createChart, createStandard]) for (const type of ['line', 'area', 'bar', 'column']) for (const palette of ['categorical', 'soft']) for (const multiple of [false, true]) {
    const chart = factory({ type, data: rows, theme: { palette }, encoding: { x: { field: 'name' }, y: multiple ? [{ field: 'value' }, { field: 'second' }] : { field: 'value' } } });
    assert.deepEqual(colorWarnings(chart), [], `${type}/${palette}/${multiple}`); chart.destroy();
  }
  for (const type of ['scatter', 'heatmap']) {
    const chart = createChart({ type, data: rows, theme: { palette: 'soft' }, encoding: type === 'scatter' ? { x: { field: 'value', type: 'quantitative' }, y: { field: 'second', type: 'quantitative' } } : { x: { field: 'name' }, y: { field: 'name' }, color: { field: 'value' } } });
    assert.deepEqual(colorWarnings(chart), []); chart.destroy();
  }
});

test('real categorical group warnings remain discoverable including Radar series identified only by id', () => {
  for (const factory of [createChart, createStandard]) for (const type of ['pie', 'funnel', 'radar']) for (const count of [6, 7]) {
    const chart = factory({ type, data: rows.slice(0, count).map(({ name, ...row }) => type === 'radar' ? row : { ...row, name }), ...(type === 'radar' ? { indicators: [{ name: 'Value', field: 'value', min: 0, max: 20 }, { name: 'Second', field: 'second', min: 0, max: 20 }, { name: 'Again', field: 'value', min: 0, max: 20 }] } : {}), theme: { palette: 'soft' } });
    assert.equal(colorWarnings(chart).length, count > 6 ? 1 : 0, `${type}/${count}`);
    if (count > 6) { assert.equal(colorWarnings(chart)[0].count, 7); assert.equal(colorWarnings(chart)[0].recommendedMaximum, 6); }
    chart.destroy();
  }
  const plan = planStyle({ type: 'line', data: rows, encoding: { y: Array.from({ length: 7 }, (_, index) => ({ field: `series${index}` })) } });
  assert.equal(plan.warnings.find(warning => warning.code === 'HIGH_CARDINALITY_COLOR')?.count, 7);
});

test('invalid node geometry rejects falsy scalars and locates every faulty node and field', () => {
  for (const type of ['flow', 'architecture', 'mindmap', 'swimlane']) for (const key of ['size', 'position', 'ports']) for (const value of [0, false, '', null, 150, '150', true]) {
    const result = validateSpec({ type, nodes: [{ id: 'broken', label: 'Broken', [key]: value }], ...(type === 'swimlane' ? { lanes: [{ id: 'team', label: 'Team' }] } : {}) });
    assert.equal(result.valid, false, `${type}/${key}/${JSON.stringify(value)}`);
    const error = result.errors.find(item => item.path === `nodes.0.${key}`);
    assert.ok(error); assert.equal(error.nodeId, 'broken'); assert.ok(error.expected); assert.ok(error.suggestion);
  }
  const multiple = validateSpec({ type: 'flow', nodes: chain(6).nodes.map(node => ({ ...node, size: 150 })) });
  assert.equal(multiple.errors.filter(error => error.code === 'NODE_SIZE').length, 6);
  assert.equal(new Set(multiple.errors.map(error => error.path)).size, 6);
  const fields = validateSpec({ type: 'flow', nodes: [{ id: 'broken', label: 'Broken', size: { width: -1, height: 0 }, position: { x: '20' } }] });
  assert.deepEqual(fields.errors.filter(error => ['NODE_SIZE', 'NODE_POSITION'].includes(error.code)).map(error => error.path).sort(), ['nodes.0.position.x', 'nodes.0.position.y', 'nodes.0.size.height', 'nodes.0.size.width']);
  for (const node of [{ id: 'auto', label: 'Auto' }, { id: 'fixed', label: 'Fixed', size: { width: 150, height: 48 }, position: { x: 0, y: 0 }, ports: [] }]) assert.equal(validateSpec({ type: 'flow', nodes: [node] }).valid, true);
  for (const factory of [createChart, createDiagram]) assert.throws(() => factory({ type: 'flow', nodes: [{ id: 'broken', label: 'Broken', size: 0 }] }), error => error.errors.some(item => item.code === 'NODE_SIZE' && item.nodeId === 'broken'));
});

test('Swimlane color groups do not count default-lane aliases or unused lanes twice', () => {
  const lanes = Array.from({ length: 8 }, (_, index) => ({ id: `lane${index}`, label: `Lane ${index}` }));
  const nodes = lanes.slice(0, 6).map((lane, index) => ({ id: `n${index}`, label: `Step ${index}`, laneId: lane.id }));
  const spec = { type: 'swimlane', lanes, nodes: [...nodes, { id: 'default', label: 'Default lane' }], theme: { palette: 'soft' } };
  assert.equal(planStyle(spec).warnings.length, 0);
  assert.equal(planStyle({ ...spec, nodes: [...nodes, { id: 'seventh', label: 'Seventh', laneId: 'lane6' }] }).warnings.find(warning => warning.code === 'HIGH_CARDINALITY_COLOR')?.count, 7);
  assert.equal(planStyle({ ...spec, diagram: { appearance: 'soft' } }).warnings.length, 0);
});

test('theme diagnostics refresh after data updates and resolved-Spec reload in root and Profiles', () => {
  for (const factory of [createChart, createStandard]) {
    const chart = factory({ type: 'pie', theme: { palette: 'soft' }, data: rows.slice(0, 7) });
    assert.equal(colorWarnings(chart).length, 1);
    const saved = chart.getSpec();
    chart.update({ data: rows.slice(0, 6) }); assert.equal(colorWarnings(chart).length, 0);
    assert.equal(chart.explain().warnings.some(warning => warning.code === 'HIGH_CARDINALITY_COLOR'), false);
    chart.update({ data: rows.slice(0, 8) }); assert.equal(colorWarnings(chart)[0].count, 8);
    const restored = factory({ ...saved, data: rows.slice(0, 6) }); assert.equal(colorWarnings(restored).length, 0);
    restored.destroy(); chart.destroy();
  }
});

test('unsupported layout reports the canonical choices, received value and manual layout guidance', () => {
  for (const layout of ['vertical', 0, false, '', null]) {
    const result = validateSpec({ type: 'flow', ...chain(2), diagram: { layout } });
    const error = result.errors.find(item => item.code === 'LAYOUT_MODE');
    assert.equal(result.valid, false); assert.ok(error);
    assert.equal(error.path, 'diagram.layout'); assert.equal(error.received, layout);
    assert.deepEqual(error.expected, getCapabilities().diagram.layoutModes);
    assert.match(error.suggestion, /manual/); assert.match(error.suggestion, /diagram-scenario/);
  }
});

test('Flow overflow gives measured width and height estimates without changing nodes, routes or the viewport', () => {
  for (const factory of [createChart, createDiagram]) for (const renderer of ['svg', 'canvas']) {
    const spec = { type: 'flow', ...chain(6), width: 760, height: 300, renderer, diagram: { layout: 'layered' } }, chart = factory(spec);
    const warning = chart.getState().warnings.find(item => item.code === 'FLOW_LAYOUT_OVERFLOW');
    assert.ok(warning); assert.deepEqual(warning.currentSize, { width: 760, height: 300 });
    assert.deepEqual(warning.recommendedSize, { width: 752 + spec.width - chart.model.state.plot.width, height: 300 }); assert.equal(warning.estimated, true);
    assert.equal(chart.model.state.labelLayout.diagram.visible, 6);
    assert.deepEqual(chart.getSpec().nodes, spec.nodes); assert.equal(chart.model.state.view.scale, 1);
    chart.resize(warning.recommendedSize.width, warning.recommendedSize.height);
    assert.equal(chart.getState().warnings.some(item => item.code === 'FLOW_LAYOUT_OVERFLOW'), false);
    chart.destroy();
    const branch = factory({ type: 'flow', width: 500, height: 120, renderer, nodes: [{ id: 'root', label: 'Root' }, ...chain(5).nodes], edges: chain(5).nodes.map(node => ({ from: 'root', to: node.id })), diagram: { layout: 'layered' } });
    const vertical = branch.getState().warnings.find(item => item.code === 'FLOW_LAYOUT_OVERFLOW');
    assert.ok(vertical); assert.equal(vertical.recommendedSize.width, 500); assert.ok(vertical.recommendedSize.height > 120);
    branch.resize(vertical.recommendedSize.width, vertical.recommendedSize.height);
    assert.equal(branch.getState().warnings.some(item => item.code === 'FLOW_LAYOUT_OVERFLOW'), false); branch.destroy();
  }
});

test('suppressed explicit node labels point to node sizing rather than pretending a wider chart fixes them', () => {
  const chart = createChart({ type: 'flow', width: 880, nodes: [{ id: 'tiny', label: 'Small task', size: { width: 48, height: 20 } }] });
  const warning = chart.getState().warnings.find(item => item.code === 'LABELS_SUPPRESSED');
  assert.equal(warning.nodeId, 'tiny'); assert.deepEqual(warning.nodeSize, { width: 48, height: 20 });
  assert.match(warning.suggestion, /size.width/); assert.match(warning.suggestion, /size.height/);
  chart.resize(1200, 600); assert.ok(chart.getState().warnings.some(item => item.code === 'LABELS_SUPPRESSED')); chart.destroy();
});

test('Heatmap uses continuous endpoints independently of Soft categorical colors', () => {
  const spec = { type: 'heatmap', data: [{ x: 'A', y: 'One', value: 0 }, { x: 'B', y: 'One', value: 100 }], colorScale: { domain: [0, 100] } };
  const standard = createChart(spec), soft = createChart({ ...spec, theme: { palette: 'soft' } }), custom = createChart({ ...spec, theme: { palette: 'soft' }, colorScale: { domain: [0, 100], range: ['#f0fdfa', '#0f766e'] } });
  for (const index of [0, 1]) assert.equal(soft.model.scene.find(`heatmap-cell-${index}`).style.fill, standard.model.scene.find(`heatmap-cell-${index}`).style.fill);
  assert.equal(custom.model.scene.find('heatmap-cell-0').style.fill, 'rgb(240,253,250)'); assert.equal(custom.model.scene.find('heatmap-cell-1').style.fill, 'rgb(15,118,110)');
  standard.destroy(); soft.destroy(); custom.destroy();
});
