import test from 'node:test';
import assert from 'node:assert/strict';
import { data, getCapabilities, inspectData, normalizeSpec, recommend, validateSpec } from '../src/index.mjs';
import { resolveTheme } from '../src/theme.mjs';
import { annotationPlugin, dataLabelsPlugin, dataZoomPlugin } from '../src/plugin.mjs';
import { buildScene } from '../src/charts.mjs';
import { Scene, SceneNode } from '../src/scene.mjs';
import { Scale } from '../src/scale.mjs';
import { analyzeBurndown, criticalSchedule, projectTooltip, rerouteDiagramScene } from '../src/project.mjs';
import { getBusinessSchema, inspectDataSchema } from '../src/schema.mjs';
import { previewEdit, validateEdit } from '../src/edit.mjs';

test('normalizes and validates a v2 spec', () => {
  const spec = normalizeSpec({ type: 'line', data: [{ name: 'Jan', value: '12' }] });
  assert.equal(spec.version, '2.0');
  assert.equal(spec.encoding.x.field, 'name');
  assert.equal(validateSpec(spec).valid, true);
});

test('reports invalid specs with structured errors', () => {
  const result = validateSpec({ type: 'unknown', renderer: 'webgl', width: 0, height: 0 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === 'INVALID_TYPE'));
  assert.ok(result.errors.some(error => error.code === 'INVALID_RENDERER'));
});

test('inspects common data and preserves missing values', () => {
  const report = inspectData([{ month: 'Jan', sales: '12' }, { month: 'Feb', sales: null }]);
  assert.equal(report.rows, 2);
  assert.deepEqual(report.measures, ['sales']);
  assert.equal(report.fields.find(field => field.name === 'sales').nullCount, 1);
});

test('builds interactive scene nodes for a column chart', () => {
  const model = buildScene(normalizeSpec({ type: 'column', data: [{ name: 'A', value: 10 }, { name: 'B', value: 20 }] }));
  const nodes = [];
  model.scene.walk(node => nodes.push(node));
  assert.equal(nodes.filter(node => node.type === 'rect').length, 2);
  assert.equal(model.scene.hit(190, 250)?.dataRef.dataIndex, 0);
});

test('scene graph finds and hits nodes', () => {
  const scene = new Scene(100, 100);
  scene.add(new SceneNode({ id: 'point', type: 'circle', bounds: { x: 10, y: 10, width: 20, height: 20 }, interactive: true }));
  assert.equal(scene.find('point').id, 'point');
  assert.equal(scene.hit(15, 15).id, 'point');
  assert.equal(scene.hit(50, 50), null);
});

test('data pipeline transforms rows without mutating input', () => {
  const input = [{ group: 'A', value: 2 }, { group: 'A', value: 4 }, { group: 'B', value: 8 }];
  const output = data(input).groupBy('group').sum('value').sortBy('value', 'desc').toArray();
  assert.deepEqual(output, [{ group: 'B', value: 8 }, { group: 'A', value: 6 }]);
  assert.deepEqual(input, [{ group: 'A', value: 2 }, { group: 'A', value: 4 }, { group: 'B', value: 8 }]);
});

test('exposes agent capabilities and recommendations', () => {
  const capabilities = getCapabilities();
  assert.ok(capabilities.chartTypes.includes('line'));
  assert.equal(recommend([{ date: '2026-01-01', value: 1 }], { intent: 'trend' }).primary, 'line');
});

test('supports category, time, and log scales', () => {
  assert.equal(new Scale({ type: 'category', categories: ['A', 'B'], range: [0, 100] }).map('B'), 75);
  assert.ok(new Scale({ type: 'time', domain: ['2026-01-01', '2026-01-03'], range: [0, 100] }).map('2026-01-02') > 40);
  assert.deepEqual(new Scale({ type: 'log', domain: [1, 100], range: [0, 100] }).ticks(3), [1, 10, 100]);
});

test('exposes iteration 2 capabilities and themes', () => {
  const capabilities = getCapabilities();
  assert.ok(capabilities.chartTypes.includes('scatter'));
  assert.ok(capabilities.interactions.includes('zoom'));
  assert.equal(resolveTheme('dark').background, '#0f172a');
});

test('builds multiple series with independent y-axis mappings', () => {
  const model = buildScene(normalizeSpec({ type: 'line', data: { values: [{ month: 'Jan', revenue: 100, margin: 0.2 }, { month: 'Feb', revenue: 200, margin: 0.4 }] }, encoding: { x: { field: 'month', type: 'category' }, y: [{ field: 'revenue' }, { field: 'margin', axis: 'right' }] } }));
  assert.equal(model.scene.find('series-0-item-0').dataRef.field, 'revenue');
  assert.equal(model.scene.find('series-1-item-1').dataRef.field, 'margin');
  assert.equal(model.scene.walk(node => node.type === 'text' && String(node.geometry.text) === '0.4'), undefined);
  assert.ok(model.scene.root.children.some(node => node.id.startsWith('label-y-right-')));
});

test('formal plugins expose lifecycle behavior', () => {
  assert.equal(annotationPlugin([{ type: 'line', geometry: { x1: 1, y1: 2, x2: 3, y2: 4 } }]).name, 'annotation');
  assert.equal(dataZoomPlugin().name, 'dataZoom');
  assert.equal(dataLabelsPlugin().name, 'dataLabels');
});

test('supports iteration 3 project management capabilities', () => {
  const capabilities = getCapabilities();
  assert.deepEqual(capabilities.projectManagement, ['gantt', 'timeline', 'milestone', 'burndown']);
  assert.deepEqual(capabilities.diagrams, ['flow', 'swimlane']);
  assert.deepEqual(recommend([{ start: '2026-09-01', end: '2026-09-03' }], { intent: 'schedule' }).primary, 'gantt');
  assert.equal(validateSpec({ type: 'gantt', data: [{ id: 'a', name: 'Design', start: '2026-09-01', end: '2026-09-03' }] }).valid, true);
});

test('builds project and process scene nodes', () => {
  const gantt = buildScene(normalizeSpec({ type: 'gantt', data: [{ id: 'a', name: 'Design', start: '2026-09-01', end: '2026-09-03', progress: 50 }, { id: 'b', name: 'Build', start: '2026-09-04', end: '2026-09-06', dependencies: ['a'] }] }));
  assert.ok(gantt.scene.find('project-item-0'));
  assert.ok(gantt.scene.find('dependency-1-0'));
  const flow = buildScene(normalizeSpec({ type: 'flow', nodes: [{ id: 'start', label: 'Start' }, { id: 'done', label: 'Done' }], edges: [{ from: 'start', to: 'done' }] }));
  assert.ok(flow.scene.find('node-start'));
  assert.ok(flow.scene.find('edge-0'));
});

test('reports invalid and cyclic gantt dependencies', () => {
  const missing = validateSpec({ type: 'gantt', data: [{ id: 'build', start: '2026-09-02', end: '2026-09-03', dependencies: ['design'] }] });
  assert.ok(missing.errors.some(error => error.code === 'MISSING_DEPENDENCY'));
  const cyclic = validateSpec({ type: 'gantt', data: [{ id: 'a', start: '2026-09-01', end: '2026-09-02', dependencies: ['b'] }, { id: 'b', start: '2026-09-02', end: '2026-09-03', dependencies: ['a'] }] });
  assert.ok(cyclic.errors.some(error => error.code === 'CYCLIC_DEPENDENCY'));
});

test('builds critical dependency arrows and burndown scope markers', () => {
  const model = buildScene(normalizeSpec({ type: 'gantt', criticalPath: ['a', 'b'], data: [{ id: 'a', start: '2026-09-01', end: '2026-09-02' }, { id: 'b', start: '2026-09-03', end: '2026-09-04', dependencies: ['a'] }] }));
  assert.equal(model.scene.find('dependency-1-0').dataRef.critical, true);
  assert.ok(model.scene.find('dependency-arrow-1-0'));
  const burndown = buildScene(normalizeSpec({ type: 'burndown', data: [{ date: '2026-09-01', remaining: 10 }, { date: '2026-09-02', remaining: 8, scopeChange: 3 }] }));
  assert.ok(burndown.scene.find('burndown-scope-1'));
});

test('keeps project scene structure renderer independent', () => {
  const input = { type: 'gantt', criticalPath: ['a', 'b'], data: [{ id: 'a', name: 'A', start: '2026-09-01', end: '2026-09-02' }, { id: 'b', name: 'B', start: '2026-09-03', end: '2026-09-04', dependencies: ['a'] }] };
  const collect = renderer => { const model = buildScene(normalizeSpec({ ...input, renderer })), ids = []; model.scene.walk(node => { if (node.id !== 'root') ids.push(node.id); }); return ids; };
  assert.deepEqual(collect('svg'), collect('canvas'));
});

test('analyzes burndown scope changes and forecasts completion', () => {
  const result = analyzeBurndown([{ date: '2026-09-01', remaining: 10 }, { date: '2026-09-03', remaining: 6, scopeChange: 2 }, { date: '2026-09-05', remaining: 2 }]);
  assert.equal(result.samples[1].scope, 12);
  assert.equal(result.forecast.reason, 'estimated');
  assert.match(projectTooltip('burndown', { date: '2026-09-03', remaining: 6, scopeChange: 2, forecast: result.forecast.date }), /Scope change: 2/);
});

test('computes gantt critical path and project tooltip content', () => {
  const schedule = criticalSchedule([{ id: 'a', start: '2026-09-01', end: '2026-09-03', dependencies: [] }, { id: 'b', start: '2026-09-03', end: '2026-09-08', dependencies: ['a'] }]);
  assert.deepEqual(schedule.criticalIds, ['a', 'b']);
  assert.match(projectTooltip('gantt', { id: 'b', name: 'Build', start: '2026-09-03', end: '2026-09-08', critical: true, float: 0 }), /Critical: yes/);
});

test('validates a business schema and previews a safe task edit', () => {
  const schema = getBusinessSchema('project-task');
  const values = [{ id: 'build', name: 'Build', start: '2026-09-06', end: '2026-09-15', progress: 60, status: 'active', dependencies: [] }];
  assert.equal(inspectDataSchema(schema).valid, true);
  const preview = previewEdit({ type: 'edit', operations: [{ op: 'updateProgress', taskId: 'build', progress: 80 }] }, { schema, values });
  assert.equal(preview.valid, true);
  assert.equal(preview.requiresConfirmation, true);
  assert.equal(preview.before[0].progress, 60);
  assert.equal(preview.after[0].progress, 80);
  assert.equal(values[0].progress, 60);
  assert.equal(validateEdit({ type: 'update', operations: [] }, { schema, values }).valid, false);
});

test('reroutes flow arrows after a node moves', () => {
  const model = buildScene(normalizeSpec({ type: 'flow', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] }));
  const edge = model.scene.find('edge-0'), arrow = model.scene.find('edge-0-arrow'), destination = model.scene.find('node-b');
  destination.geometry.y += 40;
  rerouteDiagramScene(model.scene);
  assert.equal(edge.geometry.points.at(-1).y, destination.geometry.y + destination.geometry.height / 2);
  assert.equal(arrow.geometry.points[0].y, edge.geometry.points.at(-1).y);
});

test('commits guarded business edits and tracks audit state', async () => {
  const { createChart, validateRecipe } = await import('../src/index.mjs');
  const schema = getBusinessSchema('project-task');
  const chart = createChart({ type: 'gantt', renderer: 'canvas', data: { values: [{ id: 'build', name: 'Build', start: '2026-09-06', end: '2026-09-15', progress: 60, status: 'active', dependencies: [] }], schema }, editing: { enabled: true, requireConfirmation: true } });
  const preview = chart.previewEdit({ type: 'edit', reason: 'Raise progress', operations: [{ op: 'updateProgress', taskId: 'build', progress: 80 }] });
  const blocked = chart.applyEdit({ type: 'edit', operations: [{ op: 'updateProgress', taskId: 'build', progress: 80 }] });
  assert.equal(blocked.valid, false);
  assert.equal(blocked.errors[0].code, 'CONFIRMATION_REQUIRED');
  const committed = chart.applyEdit(preview.command, { preview, confirmed: true, actor: 'agent:test', source: 'test' });
  assert.equal(committed.valid, true);
  assert.equal(committed.audit.actor, 'agent:test');
  assert.equal(chart.toDataTable()[0].progress, 80);
  assert.equal(chart.getState().revision, 1);
  assert.equal(chart.undo().valid, true);
  assert.equal(chart.toDataTable()[0].progress, 60);
  assert.equal(chart.redo().valid, true);
  assert.equal(chart.toDataTable()[0].progress, 80);
  assert.equal(validateRecipe({ spec: { type: 'gantt' }, schema, command: preview.command }, getCapabilities()).valid, true);
  chart.destroy();
});

test('rejects stale previews and unsupported edge edits safely', async () => {
  const { createChart } = await import('../src/index.mjs');
  const schema = getBusinessSchema('project-task');
  const chart = createChart({ type: 'gantt', data: { values: [{ id: 'build', name: 'Build', start: '2026-09-06', end: '2026-09-15', progress: 60, status: 'active', dependencies: [] }], schema }, editing: { enabled: true, requireConfirmation: false } });
  const preview = chart.previewEdit({ type: 'edit', operations: [{ op: 'updateProgress', taskId: 'build', progress: 70 }] });
  const first = chart.applyEdit(preview.command, { preview, confirmed: true });
  assert.equal(first.valid, true);
  const stale = chart.applyEdit(preview.command, { preview, confirmed: true });
  assert.equal(stale.valid, false);
  assert.equal(stale.errors[0].code, 'STALE_PREVIEW');
  chart.destroy();
});

test('supports headless JSON export and reports unavailable raster export', async () => {
  const { createChart } = await import('../src/index.mjs');
  const chart = createChart({ type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }] });
  const exported = JSON.parse(chart.export({ type: 'json' }));
  assert.equal(exported.version, '2.0');
  assert.equal(exported.spec.type, 'line');
  assert.equal(exported.state.dataCount, 1);
  assert.equal(chart.export({ type: 'image/png' }).code, 'HEADLESS_EXPORT_UNSUPPORTED');
  chart.destroy();
});

test('exposes RC capabilities and editing lifecycle methods', async () => {
  const { createChart, getCapabilities } = await import('../src/index.mjs');
  const capabilities = getCapabilities();
  assert.ok(capabilities.exports.includes('json'));
  assert.deepEqual(capabilities.editing.modes, ['preview', 'commit', 'undo', 'redo']);
  const chart = createChart({ type: 'line', data: [{ name: 'A', value: 1 }] });
  assert.equal(typeof chart.applyEdit, 'function');
  assert.equal(typeof chart.getChangeSet, 'function');
  assert.equal(typeof chart.undo, 'function');
  assert.equal(typeof chart.redo, 'function');
  chart.destroy();
});
