import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { binData, createChart, createPreferencesStore, data, getCapabilities, getPreferenceCapabilities, inspectData, normalizeSpec, planChart, planStyle, recommend, resolveZoomWindow, validatePreferences, validateSpec } from '../src/index.mjs';
import { contrastRatio, resolveTheme, validateThemeContrast } from '../src/theme.mjs';
import { annotationPlugin, dataLabelsPlugin, dataZoomPlugin } from '../src/plugin.mjs';
import { buildScene } from '../src/charts.mjs';
import { Scene, SceneNode, cubicBezierPoint } from '../src/scene.mjs';
import { routeEdgePath } from '../src/diagram.mjs';
import { CanvasRenderer } from '../src/renderer.mjs';
import { Scale } from '../src/scale.mjs';
import { analyzeBurndown, criticalSchedule, projectTooltip, rerouteDiagramScene } from '../src/project.mjs';
import { analyzeSchedule, applyWorkingCalendar, buildCapacityView, buildIssueAgingSeries, buildReleaseForecast, buildRiskMatrixSeries, buildVelocitySeries } from '../src/project-analytics.mjs';
import { createLinkedProjectState, filterProjectRows } from '../src/project-linking.mjs';
import { getBusinessSchema, inspectDataSchema } from '../src/schema.mjs';
import { previewEdit, validateEdit } from '../src/edit.mjs';
import { validateData } from '../src/validation.mjs';
import { diagramKeyboard } from '../src/diagram-interaction.mjs';
import { chartSettingsPlacementCoordinates, isChartSettingsAnchorVisible, resolveChartSettingsPlacement } from '../src/preferences-ui.mjs';

test('normalizes and validates a v2 spec', () => {
  const spec = normalizeSpec({ type: 'line', data: [{ name: 'Jan', value: '12' }] });
  assert.equal(spec.version, '2.0');
  assert.equal(spec.encoding.x.field, 'name');
  assert.equal(validateSpec(spec).valid, true);
});

test('uses readable numeric y-axis domains and explicit overrides', () => {
  const upper = value => buildScene(normalizeSpec({ type: 'line', data: [{ name: 'A', value }] })).state;
  assert.equal(upper(1754).max, 1800);
  assert.equal(upper(24.5).max, 25);
  assert.equal(upper(56.8).max, 60);
  assert.deepEqual(buildScene(normalizeSpec({ type: 'line', yAxis: { domain: [0, 2000], ticks: 5 }, data: [{ name: 'A', value: 1754 }] })).state.yTicks, [0, 500, 1000, 1500, 2000]);
  assert.equal(buildScene(normalizeSpec({ type: 'line', yAxis: { nice: false }, data: [{ name: 'A', value: 1754 }] })).state.max, 1754);
  const chart = createChart({ type: 'line', data: [{ name: 'A', value: 1754 }] });
  assert.deepEqual(chart.getState().axes.y.domain, [0, 1800]);
  assert.equal(chart.explain().axes.y.policy, 'nice');
});

test('supports Iteration 7 chart modes and public types', () => {
  const capabilities = getCapabilities();
  assert.ok(capabilities.chartTypes.includes('heatmap'));
  assert.ok(capabilities.chartTypes.includes('radar'));
  assert.ok(!capabilities.chartTypes.includes('donut'));
  assert.equal(validateSpec({ type: 'pie', innerRadius: 0.55, data: [{ name: 'A', value: 1 }] }).valid, true);
  assert.equal(validateSpec({ type: 'column', stack: 'percent', data: [{ name: 'A', one: 1, two: 2 }], encoding: { x: { field: 'name' }, y: [{ field: 'one' }, { field: 'two' }] } }).valid, true);
  assert.equal(validateSpec({ type: 'radar', indicators: [{ name: 'A', field: 'a' }, { name: 'B', field: 'b' }, { name: 'C', field: 'c' }], data: [{ a: 1, b: 2, c: 3 }] }).valid, true);
});

test('bins numeric data deterministically without mutating source', () => {
  const rows = [{ score: 0 }, { score: 4 }, { score: 10 }, { score: 'bad' }];
  const result = binData(rows, { field: 'score', step: 5, extent: [0, 10] });
  assert.deepEqual(result.rows.map(row => row.value), [2, 1]);
  assert.deepEqual(result.rows.map(row => row.sourceIndices), [[0, 1], [2]]);
  assert.equal(result.warnings[0].code, 'INVALID_BIN_VALUE');
  assert.equal(rows[0].score, 0);
});

test('builds stacked, donut, combo, heatmap, and radar scenes', () => {
  const stacked = buildScene(normalizeSpec({ type: 'column', stack: 'stacked', data: [{ name: 'A', one: 2, two: 3 }], encoding: { x: { field: 'name' }, y: [{ field: 'one' }, { field: 'two' }] } }));
  assert.equal(stacked.scene.find('series-1-item-0').dataRef.stackStart, 2);
  const donut = buildScene(normalizeSpec({ type: 'pie', innerRadius: 0.5, data: [{ name: 'A', value: 2 }] }));
  assert.ok(donut.scene.find('series-0-item-0').geometry.innerR > 0);
  const combo = buildScene(normalizeSpec({ type: 'column', data: [{ name: 'A', sales: 2, rate: 3 }, { name: 'B', sales: 4, rate: 5 }], encoding: { x: { field: 'name' }, y: [{ field: 'sales', mark: 'column' }, { field: 'rate', mark: 'line', axis: 'right' }] } }));
  assert.ok(combo.scene.find('series-1-line'));
  const heatmap = buildScene(normalizeSpec({ type: 'heatmap', data: [{ id: 'a', x: 'Mon', y: 'AM', value: 0 }, { id: 'b', x: 'Tue', y: 'AM', value: null }] }));
  assert.equal(heatmap.scene.find('heatmap-cell-0').dataRef.value, 0);
  assert.equal(heatmap.scene.find('heatmap-cell-1').dataRef.value, null);
  const radar = buildScene(normalizeSpec({ type: 'radar', indicators: [{ name: 'A', field: 'a', max: 10 }, { name: 'B', field: 'b', max: 10 }, { name: 'C', field: 'c', max: 10 }], data: [{ id: 'team', a: 5, b: 8, c: 3 }] }));
  assert.equal(radar.scene.find('radar-series-0').geometry.closed, true);
  assert.equal(radar.scene.find('radar-item-0-0').dataRef.recordId, 'team');
});

test('reports invalid specs with structured errors', () => {
  const result = validateSpec({ type: 'unknown', renderer: 'webgl', width: 0, height: 0 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === 'INVALID_TYPE'));
  assert.ok(result.errors.some(error => error.code === 'INVALID_RENDERER'));
});

test('enforces chart-specific encodings and required diagram fields', () => {
  const wrongPie = validateSpec({ type: 'pie', data: [{ name: 'A', value: 1 }], encoding: { x: { field: 'name' }, y: { field: 'value' } } });
  assert.equal(wrongPie.valid, false);
  assert.ok(wrongPie.errors.some(error => error.code === 'UNSUPPORTED_ENCODING_CHANNEL'));
  assert.ok(validateSpec({ type: 'line', data: [{ name: 'A', value: 1 }], encoding: { x: { field: 'missing' }, y: { field: 'value' } } }).errors.some(error => error.code === 'MISSING_ENCODING_FIELD'));
  assert.ok(validateSpec({ type: 'swimlane', nodes: [{ id: 'task', label: 'Task' }] }).errors.some(error => error.code === 'MISSING_REQUIRED'));
});

test('keeps diagram structure top-level and reports misplaced fields precisely', () => {
  const result = validateSpec({ type: 'flow', data: { nodes: [{ id: 'review', label: 'Review' }] } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === 'MISPLACED_DIAGRAM_FIELD' && error.path === 'data.nodes'));
  assert.ok(!result.errors.some(error => error.code === 'INVALID_DATA'));
});

test('makes Gauge domains explicit and reports clamped values', () => {
  assert.ok(validateSpec({ type: 'gauge', data: [{ name: 'Completion', value: 72 }] }).errors.some(error => error.code === 'MISSING_GAUGE_DOMAIN'));
  assert.ok(validateSpec({ type: 'gauge', domain: [100, 0], data: [{ name: 'Completion', value: 72 }] }).errors.some(error => error.code === 'INVALID_GAUGE_DOMAIN'));
  const chart = createChart({ type: 'gauge', renderer: 'svg', domain: [0, 100], labels: { enabled: true }, data: [{ name: 'Completion', value: 120 }] });
  assert.equal(chart.model.scene.find('gauge-value').dataRef.rawValue, 120);
  assert.equal(chart.model.scene.find('gauge-value').dataRef.value, 100);
  assert.ok(chart.getState().warnings.some(error => error.code === 'VALUE_CLAMPED'));
  assert.equal(chart.getState().health.status, 'degraded');
  chart.destroy();
});

test('accepts a single-value Gauge without an unused category field', () => {
  const spec = { type: 'gauge', renderer: 'svg', domain: [0, 1000], data: [{ value: 792 }] };
  assert.equal(validateSpec(spec).valid, true);
  assert.ok(validateSpec({ ...spec, encoding: { category: { field: 'name' } } }).errors.some(error => error.code === 'UNSUPPORTED_ENCODING_CHANNEL'));
  const chart = createChart(spec);
  assert.equal(chart.model.scene.find('gauge-value').dataRef.rawValue, 792);
  assert.equal(chart.getState().health.status, 'ready');
  chart.destroy();
});

test('formats pie and heatmap labels with safe defaults', () => {
  const pie = buildScene(normalizeSpec({ type: 'pie', labels: { enabled: true }, data: [{ name: 'A', value: 25 }, { name: 'B', value: 75 }] }));
  assert.deepEqual(pie.scene.find('series-0-item-0-label').geometry.text, '25%');
  const explicit = buildScene(normalizeSpec({ type: 'pie', labels: { enabled: true, format: { maximumFractionDigits: 1 } }, data: [{ name: 'A', value: 25 }, { name: 'B', value: 75 }] }));
  assert.equal(explicit.scene.find('series-0-item-0-label').geometry.text, '0.3');
  const heatmap = buildScene(normalizeSpec({ type: 'heatmap', width: 640, height: 360, labels: { enabled: true }, data: [{ x: 'Mon', y: 'AM', value: 12 }] }));
  assert.equal(heatmap.scene.find('heatmap-cell-label-0').geometry.text, '12');
  const compact = buildScene(normalizeSpec({ type: 'heatmap', width: 80, height: 80, labels: { enabled: true }, data: [{ x: 'Mon', y: 'AM', value: 12 }] }));
  assert.ok(compact.data.warnings.some(error => error.code === 'LABELS_SUPPRESSED'));
});

test('reports dropped pie negatives and empty totals without duplicate diagnostics', () => {
  const negativeSpec = { type: 'pie', renderer: 'svg', data: [{ name: 'A', value: 10 }, { name: 'B', value: -5 }, { name: 'C', value: 8 }] };
  const validation = validateSpec(negativeSpec);
  assert.equal(validation.valid, true);
  assert.equal(validation.warnings.find(warning => warning.code === 'NEGATIVE_VALUE_DROPPED')?.count, 1);
  const chart = createChart(negativeSpec);
  assert.equal(chart.model.scene.find('series-0-item-1').dataRef.rawValue, -5);
  assert.equal(chart.model.scene.find('series-0-item-1').dataRef.value, 0);
  assert.equal(chart.getState().warnings.filter(warning => warning.code === 'NEGATIVE_VALUE_DROPPED').length, 1);
  assert.equal(chart.getState().health.status, 'degraded');
  chart.destroy();

  const empty = validateSpec({ type: 'pie', data: [{ name: 'A', value: 0 }, { name: 'B', value: 0 }] });
  assert.equal(empty.valid, true);
  assert.ok(empty.warnings.some(warning => warning.code === 'ZERO_TOTAL'));
});

test('normalizes non-Cartesian specs without unsupported default warnings', () => {
  const specs = [
    { type: 'pie', renderer: 'svg', data: [{ name: 'A', value: 1 }] },
    { type: 'funnel', renderer: 'svg', data: [{ name: 'Visit', value: 1 }] },
    { type: 'gauge', renderer: 'svg', domain: [0, 100], data: [{ value: 72 }] },
    { type: 'heatmap', renderer: 'svg', data: [{ x: 'Mon', y: 'AM', value: 1 }] }
  ];
  specs.forEach(input => {
    const normalized = normalizeSpec(input), validation = validateSpec(normalized);
    assert.ok(!validation.warnings.some(warning => /^UNSUPPORTED_(GRID|AXIS|LEGEND)$/.test(warning.code)), input.type);
    const chart = createChart(normalized);
    assert.equal(chart.getState().health.status, 'ready', input.type);
    chart.destroy();
  });
  assert.ok(validateSpec({ ...specs[0], grid: { visible: false } }).warnings.some(warning => warning.code === 'UNSUPPORTED_GRID'));
});

test('keeps Radar normalization valid and renderable', () => {
  const radar = { type: 'radar', renderer: 'svg', indicators: [{ name: 'Quality', field: 'quality', min: 0, max: 100 }, { name: 'Speed', field: 'speed', min: 0, max: 100 }, { name: 'Coverage', field: 'coverage', min: 0, max: 100 }], data: [{ quality: 80, speed: 70, coverage: 90 }] };
  const normalized = normalizeSpec(radar);
  assert.equal(normalized.encoding.x, undefined);
  assert.equal(normalized.encoding.y, undefined);
  assert.equal(validateSpec(normalized).valid, true);
  const chart = createChart(normalized);
  assert.equal(chart.getState().health.status, 'ready');
  chart.destroy();
});

test('honors locale and exposes health diagnostics to Agents', () => {
  const capabilities = getCapabilities();
  assert.equal(capabilities.locale.default, 'en-US');
  assert.ok(capabilities.locale.recommended.includes('zh-CN'));
  const chart = createChart({ type: 'line', renderer: 'svg', locale: 'zh-CN', data: [{ date: '2025-01-01', value: 10 }, { date: '2026-04-02', value: 20 }], encoding: { x: { field: 'date' }, y: { field: 'value' } } });
  assert.equal(chart.getState().health.status, 'ready');
  assert.equal(chart.explain().health.renderable, true);
  assert.ok(chart.model.scene.root.children.some(node => node.id?.startsWith('label-x-') && String(node.geometry.text).includes('2025')));
  chart.destroy();
  assert.equal(createChart({ type: 'line', data: [] }).getState().health.status, 'empty');
});

test('provides deterministic intent fallback metadata and valid minimal Specs', () => {
  const plan = planChart([{ month: 'Jan', value: 1 }], { intent: 'trend over time' });
  assert.equal(plan.intentKnown, false);
  assert.equal(plan.fallbackUsed, true);
  assert.deepEqual(plan.intentSuggestions, ['trend', 'time-series']);
  assert.ok(plan.warnings.some(error => error.code === 'UNKNOWN_INTENT'));
  const catalog = JSON.parse(readFileSync(new URL('../agent-recipes/minimal-specs.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(catalog.examples).length, 18);
  Object.entries(catalog.examples).forEach(([type, spec]) => assert.equal(validateSpec(spec).valid, true, `${type} minimal Spec should validate`));
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
  assert.equal(nodes.filter(node => node.type === 'rect' && node.interactive).length, 2);
  assert.equal(model.scene.hit(190, 250)?.dataRef.dataIndex, 0);
});

test('keeps line paths unfilled while area uses a dedicated fill path', () => {
  const line = buildScene(normalizeSpec({ type: 'line', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] }));
  assert.equal(line.scene.find('series-0-line').style.fill, 'none');
  assert.equal(line.scene.find('area-fill-0'), undefined);
  const area = buildScene(normalizeSpec({ type: 'area', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] }));
  assert.ok(area.scene.find('area-fill-0'));
  assert.equal(area.scene.find('series-0-line').style.fill, 'none');
});

test('zooms out to the full data window from either boundary', () => {
  assert.deepEqual(resolveZoomWindow(5, { start: 0, end: 4 }, 1.25), { start: 0, end: 5 });
  assert.deepEqual(resolveZoomWindow(5, { start: 1, end: 5 }, 1.25), { start: 0, end: 5 });
  assert.deepEqual(resolveZoomWindow(10, { start: 4, end: 8 }, 0.8), { start: 5, end: 8 });
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

test('plans adaptive styles deterministically and validates contrast', () => {
  const plan = planStyle({ type: 'heatmap', data: [{ x: 'Mon', y: 'AM', value: 4 }] }, { preferredColorScheme: 'dark' });
  assert.equal(plan.preset, 'analysis');
  assert.equal(plan.palette, 'sequential');
  assert.equal(plan.resolvedMode, 'dark');
  assert.equal(validateThemeContrast(resolveTheme('light')).length, 0);
  assert.equal(validateThemeContrast(resolveTheme('dark')).length, 0);
  assert.ok(contrastRatio('#172033', '#ffffff') > 4.5);
  assert.ok(getCapabilities().styleSystem.presets.includes('project'));
  assert.equal(recommend([{ name: 'Loss', value: -4 }, { name: 'Gain', value: 7 }], { intent: 'comparison' }).primary, 'bar');
  assert.equal(planStyle({ type: 'bar', data: [{ name: 'Loss', value: -4 }, { name: 'Gain', value: 7 }] }).palette, 'diverging');
});

test('switches themes without recreating charts and preserves explicit colors', () => {
  const chart = createChart({ type: 'line', data: [{ name: 'A', value: 1 }], theme: 'light' });
  assert.equal(chart.getTheme().resolvedMode, 'light');
  chart.setTheme({ mode: 'dark', preset: 'dashboard' });
  assert.equal(chart.getState().style.name, 'dashboard-dark');
  assert.equal(chart.getSpec().background, '#0f172a');
  const custom = createChart({ type: 'line', data: [{ name: 'A', value: 1 }], colors: ['#123456'], theme: 'light' });
  custom.setTheme('dark');
  assert.deepEqual(custom.getSpec().colors, ['#123456']);
  chart.destroy();
  custom.destroy();
});

test('validates structured style requests', () => {
  assert.equal(validateSpec({ type: 'line', data: [], theme: { mode: 'dark', preset: 'report', palette: 'categorical' } }).valid, true);
  assert.ok(validateSpec({ type: 'line', data: [], theme: { preset: 'unknown' } }).errors.some(error => error.code === 'INVALID_THEME_PRESET'));
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
  assert.ok(capabilities.projectIntelligence.analytics.includes('capacity'));
  assert.deepEqual(capabilities.diagrams, ['flow', 'swimlane', 'architecture', 'mindmap']);
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

test('builds architecture layers and mindmap parent-child diagrams', async () => {
  const { validateDiagram, layoutDiagram } = await import('../src/index.mjs');
  const architecture = { type: 'architecture', layers: [{ id: 'business', label: 'Business' }, { id: 'technology', label: 'Technology' }], boundaries: [{ id: 'platform', nodeIds: ['api'], label: 'Platform' }], nodes: [{ id: 'orders', label: 'Orders', layerId: 'business' }, { id: 'api', label: 'API', layerId: 'technology' }], edges: [{ id: 'orders-api', from: 'orders', to: 'api' }] };
  assert.equal(validateDiagram(architecture).valid, true);
  const architectureScene = buildScene(normalizeSpec(architecture));
  assert.ok(architectureScene.scene.find('layer-business'));
  assert.ok(architectureScene.scene.find('boundary-platform'));
  assert.ok(architectureScene.scene.find('edge-0'));
  const mindmap = { type: 'mindmap', nodes: [{ id: 'root', label: 'Root' }, { id: 'child', label: 'Child', parentId: 'root' }, { id: 'leaf', label: 'Leaf', parentId: 'child' }], diagram: { mode: 'mindmap', layout: 'tree' } };
  const normalized = normalizeSpec(mindmap);
  const validation = validateDiagram(normalized);
  assert.equal(validation.valid, true);
  assert.equal(validation.spec.edges.length, 2);
  assert.deepEqual(layoutDiagram(normalized, { x: 0, y: 0, width: 640, height: 360 }), layoutDiagram(normalized, { x: 0, y: 0, width: 640, height: 360 }));
  const mindmapScene = buildScene(normalized);
  assert.ok(mindmapScene.scene.find('node-root'));
  assert.ok(mindmapScene.scene.find('edge-0'));
  assert.ok(validateDiagram({ ...mindmap, nodes: [{ id: 'root', label: 'Root', parentId: 'leaf' }, { id: 'leaf', label: 'Leaf', parentId: 'root' }] }).errors.some(error => error.code === 'MINDMAP_CYCLE'));
});

test('renders mindmap curved routing as cubic Bezier paths in Canvas and SVG', async () => {
  const mindmap = { type: 'mindmap', nodes: [{ id: 'root', label: 'Root' }, { id: 'child', label: 'Child', parentId: 'root' }], edges: [{ id: 'root-child', from: 'root', to: 'child', label: 'branch' }], diagram: { mode: 'mindmap', layout: 'tree', curveTension: 0.5 } };
  const validation = validateSpec(mindmap);
  assert.equal(validation.valid, true);
  const model = buildScene(normalizeSpec(mindmap)), edge = model.scene.find('edge-0'), label = model.scene.find('edge-label-0');
  assert.equal(edge.geometry.curve, 'cubic');
  assert.equal(edge.geometry.points.length, 4);
  assert.deepEqual({ x: label.geometry.x, y: label.geometry.y + 8 }, cubicBezierPoint(edge.geometry.points, 0.5));
  const middle = cubicBezierPoint(edge.geometry.points, 0.5);
  assert.equal(model.scene.hit(middle.x, middle.y)?.dataRef.edgeId, 'root-child');
  const chart = createChart(mindmap);
  assert.match(chart.export({ type: 'svg' }), /d="M [^"]+ C [^"]+"/);
  chart.destroy();
  const calls = [];
  const renderer = new CanvasRenderer();
  renderer.width = 640; renderer.height = 360;
  renderer.ctx = { clearRect() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, bezierCurveTo(...args) { calls.push(args); }, lineTo() {}, closePath() {}, fill() {}, stroke() {} };
  const canvasScene = new Scene(640, 360);
  canvasScene.add({ id: 'curve', type: 'path', geometry: { points: edge.geometry.points, curve: 'cubic' }, style: { fill: 'none', stroke: '#000' } });
  renderer.render(canvasScene);
  assert.ok(calls.length > 0);
});

test('validates curve tension and falls back around curved-edge obstacles', async () => {
  const { validateDiagram } = await import('../src/index.mjs');
  assert.ok(validateDiagram({ type: 'mindmap', nodes: [{ id: 'root', label: 'Root' }, { id: 'child', label: 'Child', parentId: 'root' }], diagram: { curveTension: 1 } }).errors.some(error => error.code === 'CURVE_TENSION'));
  assert.ok(validateDiagram({ type: 'mindmap', nodes: [{ id: 'root', label: 'Root' }, { id: 'child', label: 'Child', parentId: 'root' }], edges: [{ from: 'root', to: 'child', curveTension: 0.1 }] }).errors.some(error => error.code === 'EDGE_CURVE_TENSION'));
  const path = routeEdgePath({ curveTension: 0.4, obstacles: [{ x: 130, y: 20, width: 70, height: 90 }] }, { x: 0, y: 40, width: 60, height: 40 }, { x: 280, y: 40, width: 60, height: 40 }, 'curved');
  assert.equal(path.curve, null);
  const manual = routeEdgePath({ waypoints: [{ x: 150, y: 10 }, { x: 230, y: 10 }] }, { x: 0, y: 40, width: 60, height: 40 }, { x: 280, y: 40, width: 60, height: 40 }, 'curved');
  assert.equal(manual.curve, null);
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

test('analyzes schedule intelligence with calendar rules and variance deterministically', () => {
  const adjusted = applyWorkingCalendar('2026-09-12', { calendar: { timezone: 'UTC', workingWeekdays: [1, 2, 3, 4, 5], holidays: [], nonWorkingDayPolicy: 'next-working-day' } });
  assert.equal(adjusted.date, '2026-09-14');
  const analysis = analyzeSchedule([
    { id: 'design', start: '2026-09-08', end: '2026-09-09', baselineEnd: '2026-09-08', actualEnd: '2026-09-09', progress: 100, status: 'done', dependencies: [] },
    { id: 'build', start: '2026-09-10', end: '2026-09-12', baselineStart: '2026-09-10', baselineEnd: '2026-09-11', actualStart: '2026-09-10', actualEnd: '2026-09-12', progress: 40, status: 'active', dependencies: [{ id: 'design', type: 'finish-to-start', lag: 1 }] }
  ], { calendar: { timezone: 'UTC', workingWeekdays: [1, 2, 3, 4, 5], holidays: ['2026-09-11'], nonWorkingDayPolicy: 'next-working-day' } });
  assert.deepEqual(analysis.calendar.holidays, ['2026-09-11']);
  assert.deepEqual(analysis.criticalIds, ['design', 'build']);
  assert.equal(analysis.tasks.find(task => task.id === 'build').endVarianceDays, 1);
  assert.equal(analysis.tasks.find(task => task.id === 'build').dependencies[0].lag, 1);
  assert.match(analysis.assumptions.join(' '), /timezone UTC/);
});

test('supports dependency objects consistently and starts finish-to-start successors next workday', () => {
  const rows = [
    { id: 'a', name: 'A', start: '2026-09-14', end: '2026-09-15', progress: 100, status: 'done', dependencies: [] },
    { id: 'b', name: 'B', start: '2026-09-14', end: '2026-09-15', progress: 0, status: 'todo', dependencies: [{ id: 'a', type: 'finish-to-start', lag: 0 }] }
  ];
  assert.equal(validateSpec({ type: 'gantt', data: rows }).valid, true);
  assert.equal(validateData(rows, getBusinessSchema('project-task')).valid, true);
  const analysis = analyzeSchedule(rows, { calendar: { timezone: 'UTC' } });
  assert.equal(analysis.tasks.find(task => task.id === 'b').earliestStart, '2026-09-16');
});

test('warns and falls back when calendar timezone is not supported', () => {
  const analysis = analyzeSchedule([{ id: 'a', start: '2026-09-14', end: '2026-09-15' }], { calendar: { timezone: 'local' } });
  assert.equal(analysis.calendar.timezone, 'UTC');
  assert.ok(analysis.warnings.some(warning => warning.code === 'UNSUPPORTED_TIMEZONE'));
});

test('builds project intelligence adapters and linked filters with stable ids', () => {
  const tasks = [
    { id: 'a', owner: 'Alex', resource: 'Alex', start: '2026-09-01', end: '2026-09-03', load: 2, capacity: 4, sprint: 'S1', status: 'done', points: 3, priority: 'high', labels: ['core'] },
    { id: 'b', owner: 'Sam', resource: 'Sam', start: '2026-09-04', end: '2026-09-07', load: 3, capacity: 2, sprint: 'S1', status: 'active', points: 5, priority: 'critical', labels: ['api'] }
  ];
  const filtered = filterProjectRows(tasks, { filters: { owner: ['Alex'] } });
  assert.deepEqual(filtered.map(row => row.id), ['a']);
  const linked = createLinkedProjectState(tasks, { filters: { owner: ['Alex'] }, selection: ['a'] });
  assert.equal(linked.visibleCount, 1);
  assert.deepEqual(linked.selection, ['a']);
  const capacity = buildCapacityView(tasks, { defaultCapacity: 3 });
  assert.equal(capacity.values.find(row => row.name === 'Sam').status, 'overloaded');
  assert.equal(buildVelocitySeries(tasks).values.find(row => row.name === 'S1').value, 3);
  assert.equal(buildReleaseForecast([{ date: '2026-09-01', remaining: 10 }, { date: '2026-09-03', remaining: 6 }, { date: '2026-09-05', remaining: 2 }]).forecast.reason, 'estimated');
  assert.equal(buildRiskMatrixSeries([{ id: 'risk-1', probability: 4, impact: 5 }]).values[0].recordId, 'risk-1');
  assert.deepEqual(buildIssueAgingSeries([{ id: 'issue-1', createdAt: '2026-09-10' }], { today: '2026-09-15' }).details[0].recordId, 'issue-1');
});

test('preserves fallback record ids after linked filtering and warns on invalid adapter data', () => {
  const linked = createLinkedProjectState([{ owner: 'Alex' }, { owner: 'Sam' }], { filters: { owner: ['Sam'] } });
  assert.deepEqual(linked.visibleRecordIds, ['record-1']);
  assert.ok(buildVelocitySeries([{ sprint: 'S1', points: 'invalid', status: 'done' }]).warnings.some(warning => warning.code === 'INVALID_POINTS'));
  assert.ok(buildRiskMatrixSeries([{ id: 'risk', probability: 'invalid', impact: 5 }]).warnings.some(warning => warning.code === 'INVALID_RISK_VALUE'));
  const missingToday = buildIssueAgingSeries([{ id: 'issue', createdAt: '2026-09-10' }]);
  assert.equal(missingToday.details.length, 0);
  assert.ok(missingToday.warnings.some(warning => warning.code === 'MISSING_REFERENCE_DATE'));
  const invalidCreated = buildIssueAgingSeries([{ id: 'issue', createdAt: 'invalid' }], { today: '2026-09-15' });
  assert.equal(invalidCreated.details.length, 0);
  assert.ok(invalidCreated.warnings.some(warning => warning.code === 'INVALID_CREATED_DATE'));
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
  const model = buildScene(normalizeSpec({ type: 'flow', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b', label: 'Next' }] }));
  const edge = model.scene.find('edge-0'), arrow = model.scene.find('edge-0-arrow'), destination = model.scene.find('node-b');
  destination.geometry.y += 40;
  rerouteDiagramScene(model.scene);
  assert.equal(edge.geometry.points.at(-1).y, destination.geometry.y + destination.geometry.height / 2);
  assert.equal(arrow.geometry.points[0].y, edge.geometry.points.at(-1).y);
  const label = model.scene.find('edge-label-0'), middle = edge.geometry.points[Math.floor(edge.geometry.points.length / 2)];
  assert.equal(label.geometry.x, middle.x);
  assert.equal(label.geometry.y, middle.y - 8);
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
  assert.match(chart.export({ type: 'json', as: 'dataurl' }), /^data:application\/json/);
  const blob = chart.export({ type: 'json', as: 'blob' });
  assert.equal(blob instanceof Blob, true);
  assert.equal(blob.type, 'application/json');
  assert.equal(chart.export({ type: 'tiff' }).code, 'EXPORT_TYPE_UNSUPPORTED');
  assert.equal(chart.export({ type: 'image/png' }).code, 'HEADLESS_EXPORT_UNSUPPORTED');
  assert.equal((await chart.exportAsync({ type: 'png' })).code, 'HEADLESS_EXPORT_UNSUPPORTED');
  chart.destroy();
});

test('returns structured errors for an unmounted headless canvas renderer', async () => {
  const { createChart } = await import('../src/index.mjs');
  const chart = createChart({ type: 'line', renderer: 'canvas', data: [{ name: 'A', value: 1 }] });
  assert.equal(chart.toDataURL('image/png').code, 'HEADLESS_EXPORT_UNSUPPORTED');
  chart.destroy();
});

test('exposes project analytics and linked state on gantt charts', async () => {
  const { createChart } = await import('../src/index.mjs');
  const chart = createChart({
    type: 'gantt',
    data: [
      { id: 'design', name: 'Design', start: '2026-09-01', end: '2026-09-03', baselineStart: '2026-09-01', baselineEnd: '2026-09-02', actualStart: '2026-09-01', actualEnd: '2026-09-03', owner: 'Alex', progress: 100, status: 'done' },
      { id: 'build', name: 'Build', start: '2026-09-04', end: '2026-09-06', owner: 'Sam', progress: 40, status: 'active' }
    ],
    project: {
      linked: { selection: ['build'] },
      overlays: { criticalPath: true, slack: true, baseline: true, actual: true, variance: true },
      calendar: { timezone: 'UTC', workingWeekdays: [1, 2, 3, 4, 5], holidays: [] }
    }
  });
  assert.ok(chart.getProjectAnalytics().schedule.tasks.length >= 1);
  assert.deepEqual(chart.getLinkedState().selection, ['build']);
  chart.setLinkedFilters({ owner: ['Alex'] });
  assert.equal(chart.getLinkedState().visibleCount, 1);
  chart.setLinkedSelection(['design']);
  assert.deepEqual(chart.getLinkedState().selection, ['design']);
  assert.equal(chart.getState().projectAnalytics.schedule.calendar.timezone, 'UTC');
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

test('validates and lays out advanced diagram models deterministically', async () => {
  const { layoutDiagram, routeEdge, validateDiagram } = await import('../src/index.mjs');
  const spec = { type: 'flow', width: 640, height: 360, nodes: [{ id: 'start', label: 'Start' }, { id: 'review', label: 'Review' }, { id: 'done', label: 'Done', ports: [{ id: 'in' }] }], edges: [{ id: 'e1', from: 'start', to: 'review' }, { id: 'e2', from: 'review', to: 'done', toPort: 'in' }], diagram: { layout: 'layered', routing: 'orthogonal', grid: 8 } };
  assert.equal(validateDiagram(spec).valid, true);
  const first = layoutDiagram(spec, { x: 40, y: 20, width: 500, height: 280 });
  assert.deepEqual(first, layoutDiagram(spec, { x: 40, y: 20, width: 500, height: 280 }));
  assert.deepEqual(routeEdge(spec.edges[0], { x: 40, y: 20, width: 112, height: 36 }, { x: 240, y: 92, width: 112, height: 36 }, 'straight').length, 2);
  const manual = routeEdge({ waypoints: [{ x: 180, y: 40 }, { x: 180, y: 120 }] }, { x: 40, y: 20, width: 112, height: 36 }, { x: 240, y: 92, width: 112, height: 36 }, 'orthogonal');
  assert.deepEqual(manual.slice(1, -1), [{ x: 180, y: 40 }, { x: 180, y: 120 }]);
  assert.ok(validateDiagram({ ...spec, edges: [{ from: 'start', to: 'missing' }] }).errors.some(error => error.code === 'EDGE_ENDPOINT'));
  assert.ok(validateDiagram({ ...spec, edges: [{ id: 'bad', from: 'start', to: 'review', waypoints: [{ x: 'bad', y: 1 }] }] }).errors.some(error => error.code === 'EDGE_WAYPOINTS'));
});

test('supports diagram node resizing through the shared edit history', async () => {
  const { createChart, getBusinessSchema } = await import('../src/index.mjs');
  const schema = getBusinessSchema('flow-node');
  const chart = createChart({ type: 'flow', nodes: [{ id: 'a', label: 'A', position: { x: 40, y: 40 }, size: { width: 112, height: 36 } }], edges: [], data: { schema }, editing: { enabled: true, requireConfirmation: false } });
  const preview = chart.previewEdit({ type: 'layout-edit', operations: [{ op: 'resizeNode', nodeId: 'a', size: { width: 180, height: 48 } }] });
  assert.equal(preview.valid, true);
  const committed = chart.applyEdit(preview.command, { preview, confirmed: true });
  assert.equal(committed.valid, true);
  assert.equal(chart.getSpec().nodes[0].size.width, 180);
  assert.equal(chart.undo().valid, true);
  assert.equal(chart.getSpec().nodes[0].size.width, 112);
  chart.destroy();
});

test('supports diagram groups, ports, multi-select alignment, snapping, and undo', async () => {
  const { buildScene } = await import('../src/charts.mjs');
  const { createChart, getBusinessSchema, validateDiagram } = await import('../src/index.mjs');
  const spec = { type: 'flow', width: 640, height: 360, nodes: [
    { id: 'a', label: 'A', groupId: 'main', position: { x: 41, y: 43 }, size: { width: 100, height: 40 }, ports: [{ id: 'out', side: 'right', offset: 0.25 }] },
    { id: 'b', label: 'B', groupId: 'main', position: { x: 217, y: 91 }, size: { width: 140, height: 60 }, ports: [{ id: 'in', side: 'left', offset: 0.75 }] }
  ], groups: [{ id: 'main', label: 'Main flow' }], edges: [{ id: 'ab', from: 'a', to: 'b', fromPort: 'out', toPort: 'in' }], diagram: { layout: 'manual', routing: 'orthogonal', grid: 8 } };
  assert.equal(validateDiagram(spec).valid, true);
  const staticScene = buildScene(normalizeSpec(spec)).scene;
  assert.equal(staticScene.find('port-a-out'), undefined);
  const scene = buildScene(normalizeSpec({ ...spec, interaction: { portConnect: true }, editing: { enabled: true } })).scene;
  assert.ok(scene.find('group-main'));
  assert.ok(scene.find('port-a-out'));
  assert.ok(scene.find('port-b-in'));
  const chart = createChart({ ...spec, data: { schema: getBusinessSchema('flow-node') }, editing: { enabled: true, requireConfirmation: false } });
  chart.selectNodes(['a', 'b']);
  assert.deepEqual(chart.getSelectedNodeIds(), ['a', 'b']);
  assert.equal(chart.getSelectedData().length, 2);
  assert.equal(chart.alignSelected('right').valid, true);
  assert.equal(chart.getSpec().nodes[0].position.x + 100, chart.getSpec().nodes[1].position.x + 140);
  assert.equal(chart.snapSelected().valid, true);
  assert.equal(chart.getSpec().nodes[0].position.x % 8, 0);
  assert.equal(chart.moveSelectedBy({ x: 8, y: 0 }).valid, true);
  assert.equal(chart.undo().valid, true);
  chart.destroy();
});

test('supports diagram structure edits for copy paste, group collapse, and edge creation', async () => {
  const { createChart, getBusinessSchema } = await import('../src/index.mjs');
  const chart = createChart({
    type: 'flow',
    nodes: [
      { id: 'a', label: 'A', groupId: 'main', position: { x: 40, y: 60 }, ports: [{ id: 'out', side: 'right', offset: 0.5 }] },
      { id: 'b', label: 'B', groupId: 'main', position: { x: 220, y: 60 }, ports: [{ id: 'in', side: 'left', offset: 0.5 }] },
      { id: 'c', label: 'C', position: { x: 440, y: 60 }, ports: [{ id: 'in', side: 'left', offset: 0.5 }] }
    ],
    edges: [{ id: 'ab', from: 'a', to: 'b', fromPort: 'out', toPort: 'in' }],
    groups: [{ id: 'main', label: 'Main flow' }],
    data: { schema: getBusinessSchema('flow-node'), edgeSchema: getBusinessSchema('flow-edge') },
    diagram: { layout: 'manual', routing: 'orthogonal', grid: 8 },
    editing: { enabled: true, requireConfirmation: false, allowStructuralChanges: true }
  });
  chart.selectNodes(['a', 'b']);
  assert.equal(chart.copySelection().valid, true);
  const pasted = chart.pasteSelection({ confirmed: true });
  assert.equal(pasted.valid, true);
  assert.ok(chart.getDiagramNodes().some(node => node.id === 'a-copy'));
  assert.ok(chart.getDiagramEdges().some(edge => edge.from === 'a-copy' && edge.to === 'b-copy'));
  const collapsed = chart.toggleGroupCollapse('main', { confirmed: true });
  assert.equal(collapsed.valid, true);
  assert.deepEqual(chart.getCollapsedGroupIds(), ['main']);
  const connected = chart.connectNodes({ from: 'a', to: 'c', fromPort: 'out', toPort: 'in' }, { confirmed: true });
  assert.equal(connected.valid, true);
  assert.ok(chart.getDiagramEdges().some(edge => edge.from === 'a' && edge.to === 'c'));
  assert.equal(chart.undo().valid, true);
  chart.destroy();
});

test('renders collapsed groups and routes orthogonal edges around obstacles', async () => {
  const { buildScene } = await import('../src/charts.mjs');
  const { routeEdge } = await import('../src/index.mjs');
  const spec = normalizeSpec({
    type: 'flow',
    nodes: [
      { id: 'a', label: 'A', groupId: 'main', position: { x: 40, y: 60 }, size: { width: 100, height: 40 } },
      { id: 'b', label: 'B', groupId: 'main', position: { x: 210, y: 60 }, size: { width: 100, height: 40 } },
      { id: 'c', label: 'C', position: { x: 430, y: 60 }, size: { width: 100, height: 40 } }
    ],
    edges: [{ id: 'ac', from: 'a', to: 'c' }],
    groups: [{ id: 'main', label: 'Main flow', collapsed: true }],
    diagram: { layout: 'manual', routing: 'orthogonal', grid: 8 }
  });
  const scene = buildScene(spec).scene;
  assert.ok(scene.find('group-main'));
  assert.equal(scene.find('node-a'), undefined);
  const path = routeEdge({ grid: 8, obstacles: [{ x: 120, y: 0, width: 100, height: 160 }] }, { x: 0, y: 40, width: 60, height: 40 }, { x: 280, y: 40, width: 60, height: 40 }, 'orthogonal');
  const intersects = (first, second, box) => {
    if (first.x === second.x) return first.x >= box.x && first.x <= box.x + box.width && Math.max(first.y, second.y) >= box.y && Math.min(first.y, second.y) <= box.y + box.height;
    if (first.y === second.y) return first.y >= box.y && first.y <= box.y + box.height && Math.max(first.x, second.x) >= box.x && Math.min(first.x, second.x) <= box.x + box.width;
    return false;
  };
  assert.ok(path.every((point, index) => index === 0 || !intersects(path[index - 1], point, { x: 120, y: 0, width: 100, height: 160 })));
});

test('connects diagram edges to facing sides and avoids vertically aligned nodes', async () => {
  const { routeEdge } = await import('../src/index.mjs');
  const from = { x: 100, y: 80, width: 80, height: 40 }, obstacle = { x: 100, y: 180, width: 80, height: 40 }, to = { x: 100, y: 280, width: 80, height: 40 };
  const path = routeEdge({ grid: 8, obstacles: [obstacle] }, from, to, 'orthogonal');
  assert.deepEqual(path[0], { x: 180, y: 100 });
  assert.deepEqual(path.at(-1), { x: 180, y: 300 });
  const intersects = (first, second, box) => {
    if (first.x === second.x) return first.x >= box.x && first.x <= box.x + box.width && Math.max(first.y, second.y) >= box.y && Math.min(first.y, second.y) <= box.y + box.height;
    if (first.y === second.y) return first.y >= box.y && first.y <= box.y + box.height && Math.max(first.x, second.x) >= box.x && Math.min(first.x, second.x) <= box.x + box.width;
    return false;
  };
  assert.ok(path.every((point, index) => index === 0 || !intersects(path[index - 1], point, obstacle)));
});

test('branding: defaults to enabled and normalizes both shorthand and object forms', () => {
  const defaults = normalizeSpec({ type: 'line', data: [{ name: 'A', value: 1 }] });
  assert.equal(defaults.branding?.enabled, true);
  const offShort = normalizeSpec({ type: 'line', data: [{ name: 'A', value: 1 }], branding: false });
  assert.equal(offShort.branding?.enabled, false);
  const onShort = normalizeSpec({ type: 'line', data: [{ name: 'A', value: 1 }], branding: true });
  assert.equal(onShort.branding?.enabled, true);
  const offObject = normalizeSpec({ type: 'line', data: [{ name: 'A', value: 1 }], branding: { enabled: false } });
  assert.equal(offObject.branding?.enabled, false);
  const offTheme = normalizeSpec({ type: 'line', data: [{ name: 'A', value: 1 }], theme: { branding: false } });
  assert.equal(offTheme.branding?.enabled, false);
});

test('branding: validates the enabled-only surface and rejects unknown options', () => {
  const okShortOff = validateSpec({ type: 'line', data: [{ name: 'A', value: 1 }], branding: false });
  assert.equal(okShortOff.valid, true);
  const okObjectOff = validateSpec({ type: 'line', data: [{ name: 'A', value: 1 }], branding: { enabled: false } });
  assert.equal(okObjectOff.valid, true);
  const okDefault = validateSpec({ type: 'line', data: [{ name: 'A', value: 1 }] });
  assert.equal(okDefault.valid, true);
  const badKeys = validateSpec({ type: 'line', data: [{ name: 'A', value: 1 }], branding: { text: 'Custom Corp', enabled: true } });
  assert.equal(badKeys.valid, false);
  assert.ok(badKeys.errors.some(err => err.code === 'UNSUPPORTED_BRANDING_OPTIONS'));
  const badEnabled = validateSpec({ type: 'line', data: [{ name: 'A', value: 1 }], branding: { enabled: 'yes' } });
  assert.equal(badEnabled.valid, false);
  assert.ok(badEnabled.errors.some(err => err.code === 'INVALID_BRANDING_ENABLED'));
  const wrongType = validateSpec({ type: 'line', data: [{ name: 'A', value: 1 }], branding: 123 });
  assert.equal(wrongType.valid, false);
  assert.ok(wrongType.errors.some(err => err.code === 'INVALID_BRANDING'));
});

test('branding: capabilities declare defaultEnabled and expose signature', () => {
  const caps = getCapabilities();
  assert.equal(caps.branding?.defaultEnabled, true);
  assert.equal(caps.branding?.signature, 'Powered by iChart.js');
  assert.deepEqual(caps.branding?.options, [{ name: 'enabled', type: 'boolean', default: true }]);
  const lineFeatures = caps.charts?.line?.features || {};
  assert.equal(lineFeatures.branding, 'supported');
});

test('branding: scene graph includes branding-watermark only when enabled', () => {
  const defaultScene = buildScene(normalizeSpec({ type: 'line', data: [{ name: 'A', value: 1 }] }));
  const mark = defaultScene.scene.find('branding-watermark');
  assert.ok(mark);
  assert.equal(mark.type, 'text');
  assert.equal(String(mark.geometry.text).includes('Powered by iChart.js'), true);
  assert.equal(mark.style.pointerEvents, 'none');
  assert.equal(mark.interactive, false);
  assert.equal(mark.decorative, true);
  const offScene = buildScene(normalizeSpec({ type: 'line', data: [{ name: 'A', value: 1 }], branding: false }));
  assert.equal(offScene.scene.find('branding-watermark'), undefined);
  const ganttScene = buildScene(normalizeSpec({ type: 'gantt', data: [{ id: 'a', name: 'A', start: '2026-09-01', end: '2026-09-03' }], branding: { enabled: true } }));
  assert.ok(ganttScene.scene.find('branding-watermark'));
  const flowScene = buildScene(normalizeSpec({ type: 'flow', nodes: [{ id: 'x', label: 'X' }], edges: [] }));
  assert.ok(flowScene.scene.find('branding-watermark'));
  const emptyScene = buildScene(normalizeSpec({ type: 'bar', data: [], branding: { enabled: true } }));
  assert.ok(emptyScene.scene.find('branding-watermark'));
});

test('branding: Chart.getState() reports branding state, explain() omits it as business data', async () => {
  const { createChart } = await import('../src/index.mjs');
  const chartOn = createChart({ type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }], branding: { enabled: true } });
  const stateOn = chartOn.getState();
  assert.equal(stateOn.branding?.enabled, true);
  assert.equal(stateOn.branding?.signature, 'Powered by iChart.js');
  assert.equal(stateOn.branding?.text, 'Powered by iChart.js');
  const explainKeys = Object.keys(chartOn.explain());
  assert.equal(explainKeys.includes('branding'), false);
  const chartOff = createChart({ type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }], branding: false });
  const stateOff = chartOff.getState();
  assert.equal(stateOff.branding?.enabled, false);
  assert.equal(stateOff.branding?.text, null);
  chartOn.destroy();
  chartOff.destroy();
});

test('branding: headless JSON export syncs branding state', async () => {
  const { createChart } = await import('../src/index.mjs');
  const chartOn = createChart({ type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }] });
  const jsonOn = JSON.parse(chartOn.export({ type: 'json' }));
  assert.equal(jsonOn.state?.branding?.enabled, true);
  assert.equal(jsonOn.state?.branding?.signature, 'Powered by iChart.js');
  assert.equal(jsonOn.spec?.branding?.enabled, true);
  chartOn.destroy();
});

test('explicit branding updates override stored presentation preferences', () => {
  const store = createPreferencesStore({ global: { branding: { enabled: false } } });
  const chart = createChart({ chartId: 'branding-toggle', type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }], preferences: store });
  assert.equal(chart.getState().branding.enabled, false);
  chart.update({ branding: { enabled: true } });
  assert.equal(chart.getState().branding.enabled, true);
  assert.ok(chart.model.scene.find('branding-watermark'));
  chart.update({ branding: { enabled: false } });
  assert.equal(chart.getState().branding.enabled, false);
  assert.equal(chart.model.scene.find('branding-watermark'), undefined);
  chart.destroy();
});

test('supports scoped chart preferences with local persistence and Agent sources', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const store = createPreferencesStore({ storage, storageKey: 'test:preferences' });
  const chart = createChart({ chartId: 'sales', type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }], preferences: store });
  const events = [];
  chart.on('preferenceschange', event => events.push(event));
  store.setGlobal({ theme: { preset: 'dashboard' }, density: 'compact' }, { source: 'agent' });
  assert.equal(chart.getPreferences().theme.preset, 'dashboard');
  assert.equal(chart.getPreferences().density, 'compact');
  chart.setPreferences({ theme: { mode: 'dark' }, components: { grid: false } }, { source: 'agent' });
  assert.equal(chart.getTheme().resolvedMode, 'dark');
  assert.equal(chart.getSpec().grid.visible, false);
  assert.equal(events.at(-1).source, 'agent');
  assert.equal(store.getChart('sales').density, undefined);
  assert.equal(JSON.parse(values.get('test:preferences')).charts.sales.theme.mode, 'dark');
  store.setGlobal({ density: 'spacious' }, { source: 'agent' });
  assert.equal(chart.getPreferences().density, 'spacious');
  chart.resetPreferences({ source: 'agent' });
  assert.equal(chart.getPreferences().theme.mode, null);
  assert.equal(chart.getPreferences().theme.preset, 'dashboard');
  assert.equal(chart.getSpec().grid.visible, true);
  chart.destroy();
});

test('exposes localized Agent preference discovery and validation', () => {
  const line = getPreferenceCapabilities('line', { locale: 'zh-CN' });
  const architecture = getPreferenceCapabilities('architecture', { locale: 'unsupported' });
  assert.equal(line.locale, 'zh-CN');
  assert.equal(line.fields.find(field => field.path === 'theme.mode').label, '主题');
  assert.deepEqual(line.fields.find(field => field.path === 'typography.scale').options.map(option => option.value), [0.85, 1, 1.15, 1.3]);
  assert.equal(line.fields.find(field => field.path === 'components.legend').menu.visible, true);
  assert.equal(architecture.locale, 'en');
  assert.equal(architecture.fields.find(field => field.path === 'components.legend').supported, false);
  assert.equal(architecture.fields.find(field => field.path === 'components.legend').menu.visible, false);
  assert.equal(validatePreferences({ typography: { scale: 1.15 }, components: { grid: false } }, { partial: true }).valid, true);
  assert.equal(validatePreferences({ typography: { scale: 2 } }, { partial: true }).errors[0].path, 'typography.scale');
  assert.deepEqual(getCapabilities().preferences.fields, line.fields.map(field => field.path));
});

test('places chart settings right, top, then bottom with viewport fallback', () => {
  const panel = { width: 320, height: 130 }, viewport = { left: 0, top: 0, width: 1000, height: 700 };
  assert.equal(resolveChartSettingsPlacement({ left: 100, right: 132, top: 300, bottom: 332 }, panel, viewport).placement, 'right');
  assert.equal(resolveChartSettingsPlacement({ left: 948, right: 980, top: 400, bottom: 432 }, panel, viewport).placement, 'top');
  assert.equal(resolveChartSettingsPlacement({ left: 948, right: 980, top: 10, bottom: 42 }, panel, viewport).placement, 'bottom');
  const constrained = resolveChartSettingsPlacement({ left: 260, right: 292, top: 10, bottom: 42 }, panel, { left: 0, top: 0, width: 300, height: 180 });
  assert.equal(constrained.placement, 'bottom');
  assert.equal(constrained.constrained, true);
  assert.equal(constrained.left, 8);
  assert.equal(isChartSettingsAnchorVisible({ left: 100, right: 132, top: 300, bottom: 332 }, { left: 80, right: 500, top: 250, bottom: 550 }, viewport), true);
  assert.equal(isChartSettingsAnchorVisible({ left: 100, right: 132, top: -40, bottom: -8 }, { left: 80, right: 500, top: -300, bottom: -1 }, viewport), false);
  assert.equal(isChartSettingsAnchorVisible({ left: 100, right: 132, top: -40, bottom: -8 }, { left: 80, right: 500, top: -20, bottom: 300 }, viewport), false);
  assert.deepEqual(chartSettingsPlacementCoordinates({ right: 615, top: -6, bottom: 26 }, panel, 'right'), { left: 625, top: -6 });
});

test('reflows titles, legends, and plots after typography or legend changes', () => {
  const chart = createChart({
    type: 'line', renderer: 'svg', width: 360, height: 300,
    title: { text: 'Delivery', subtitle: 'Planned and actual' },
    data: [{ name: 'A', planned: 4, actual: 3 }, { name: 'B', planned: 6, actual: 5 }],
    encoding: { x: { field: 'name' }, y: [{ field: 'planned', name: 'Planned work' }, { field: 'actual', name: 'Actual work' }] }
  });
  const defaultPlotY = chart.model.state.plot.y;
  const defaultLegendY = chart.model.scene.find('legend-label-0').geometry.y;
  assert.ok(defaultLegendY > chart.model.scene.find('subtitle').geometry.y);
  assert.ok(defaultPlotY > defaultLegendY);

  chart.setPreferences({ typography: { scale: 1.3 } }, { source: 'ui' });
  const largePlotY = chart.model.state.plot.y;
  const largeLegendY = chart.model.scene.find('legend-label-0').geometry.y;
  assert.ok(largeLegendY > defaultLegendY);
  assert.ok(largePlotY > defaultPlotY);
  assert.ok(largePlotY > chart.model.state.chrome.legend.bottom);

  chart.setPreferences({ components: { legend: false } }, { source: 'ui' });
  assert.equal(chart.model.scene.find('legend-label-0'), undefined);
  assert.ok(chart.model.state.plot.y < largePlotY);
  assert.ok(chart.model.state.plot.y > chart.model.scene.find('subtitle').geometry.y);
  chart.destroy();

  const project = createChart({ type: 'gantt', renderer: 'svg', title: { text: 'Roadmap', subtitle: 'Current delivery plan' }, data: [{ id: 'a', name: 'A', start: '2026-09-01', end: '2026-09-03' }] });
  const projectPlotY = project.model.state.plot.y;
  project.setPreferences({ typography: { scale: 1.3 } }, { source: 'ui' });
  assert.ok(project.model.state.plot.y > projectPlotY);
  assert.equal(project.model.scene.find('title').style.textBaseline, 'middle');
  project.destroy();
});

test('renders and toggles single-series legends for cartesian charts', () => {
  ['line', 'bar', 'column'].forEach(type => {
    const chart = createChart({ type, renderer: 'svg', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] });
    assert.ok(chart.model.scene.find('legend-label-0'), `${type} should render its single-series legend`);
    chart.setPreferences({ components: { legend: false } }, { source: 'ui' });
    assert.equal(chart.model.scene.find('legend-label-0'), undefined);
    chart.setPreferences({ components: { legend: true } }, { source: 'ui' });
    assert.ok(chart.model.scene.find('legend-label-0'));
    chart.destroy();
  });
});

test('rotates dense axis labels and suppresses only impossible label collisions', () => {
  const column = createChart({ type: 'column', renderer: 'svg', width: 280, height: 260, data: ['Architecture Review', 'Milestone Approval', 'Production Readiness', 'Release Retrospective'].map((name, index) => ({ name, value: index + 1 })) });
  assert.ok([-30, -45].includes(column.model.state.xLabels.rotation));
  assert.equal(column.model.scene.find('label-x-Architecture Review').style.rotation, column.model.state.xLabels.rotation);
  assert.match(column.export({ type: 'svg' }), /transform="rotate\(-(?:30|45) /);
  column.destroy();

  const indicators = Array.from({ length: 10 }, (_, index) => ({ name: `Long capability ${index + 1}`, field: `metric${index + 1}`, min: 0, max: 100 }));
  const values = Object.fromEntries(indicators.map((indicator, index) => [indicator.field, 40 + index * 4]));
  const radar = createChart({ type: 'radar', renderer: 'svg', width: 320, height: 260, title: { text: 'Capability radar' }, indicators, data: [{ id: 'current', name: 'Current', ...values }] });
  const labels = [];
  radar.model.scene.walk(node => { if (node.id?.startsWith('radar-label-')) labels.push(node); });
  const size = radar.getTheme().typography.axis.size;
  const boxes = labels.map(node => { const width = Math.max(size, node.geometry.text.length * size * .58), height = size * 1.3, anchor = node.style.textAnchor; return { x: anchor === 'start' ? node.geometry.x : anchor === 'end' ? node.geometry.x - width : node.geometry.x - width / 2, y: node.geometry.y - height / 2, width, height }; });
  boxes.forEach((box, index) => boxes.slice(index + 1).forEach(other => assert.equal(box.x < other.x + other.width && box.x + box.width > other.x && box.y < other.y + other.height && box.y + box.height > other.y, false)));
  assert.equal(radar.model.state.labelLayout.radar.visible + radar.model.state.labelLayout.radar.hidden, indicators.length);
  if (radar.model.state.labelLayout.radar.hidden) assert.ok(radar.getState().warnings.some(item => item.code === 'LABELS_SUPPRESSED'));
  radar.destroy();
});

test('keeps compact chart data labels inside the plot instead of the subtitle area', () => {
  const chart = createChart({ type: 'line', renderer: 'svg', width: 280, height: 220, title: { text: 'Monthly trend', subtitle: 'Line preserves an unfilled path' }, labels: { enabled: true }, data: [{ name: 'Jan', value: 18 }, { name: 'Feb', value: 36 }, { name: 'Mar', value: 22 }] });
  assert.equal(chart.model.state.compact, true);
  const labels = [];
  chart.model.scene.walk(node => { if (node.id?.endsWith('-label') && node.id.startsWith('series-')) labels.push(node); });
  assert.ok(labels.length > 0);
  labels.forEach(label => assert.ok(label.geometry.y >= chart.model.state.plot.y));
  labels.forEach(label => { const point = chart.model.scene.find(label.id.replace('-label', ''))?.geometry; if (point) assert.ok(Math.abs(label.geometry.y - point.cy) >= 18, `${label.id} should keep a readable gap from its point`); });
  assert.ok(chart.model.state.plot.y > chart.model.scene.find('subtitle').geometry.y);
  chart.destroy();
});

test('keeps group backgrounds passive while group labels remain interactive', () => {
  const scene = buildScene(normalizeSpec({
    type: 'flow',
    nodes: [{ id: 'review', label: 'Review', groupId: 'delivery', position: { x: 200, y: 100 } }, { id: 'qa', label: 'QA', groupId: 'delivery', position: { x: 200, y: 180 } }],
    groups: [{ id: 'delivery', label: 'Delivery' }],
    edges: [],
    diagram: { layout: 'manual' }
  })).scene;
  assert.equal(scene.find('group-delivery').interactive, false);
  assert.equal(scene.find('group-label-delivery').interactive, true);
});

test('moves diagram groups and changes membership through shared history', async () => {
  const { createChart, getBusinessSchema } = await import('../src/index.mjs');
  const chart = createChart({
    type: 'flow',
    nodes: [
      { id: 'a', label: 'A', groupId: 'main', position: { x: 40, y: 60 } },
      { id: 'b', label: 'B', groupId: 'main', position: { x: 200, y: 60 } },
      { id: 'c', label: 'C', position: { x: 360, y: 60 } }
    ],
    edges: [],
    groups: [{ id: 'main', label: 'Main flow' }],
    data: { schema: getBusinessSchema('flow-node'), edgeSchema: getBusinessSchema('flow-edge') },
    diagram: { layout: 'manual', routing: 'orthogonal', grid: 8 },
    editing: { enabled: true, requireConfirmation: false, allowStructuralChanges: true }
  });
  assert.equal(chart.moveGroupBy('main', { x: 16, y: 8 }).valid, true);
  assert.deepEqual(chart.getDiagramNodes().slice(0, 2).map(node => node.position), [{ x: 56, y: 68 }, { x: 216, y: 68 }]);
  chart.selectNodes(['c']);
  assert.equal(chart.assignSelectedToGroup('main', { confirmed: true }).valid, true);
  assert.equal(chart.getDiagramNodes().find(node => node.id === 'c').groupId, 'main');
  assert.equal(chart.undo().valid, true);
  assert.equal(chart.getDiagramNodes().find(node => node.id === 'c').groupId, undefined);
  assert.equal(chart.redo().valid, true);
  chart.selectNodes(['a']);
  assert.equal(chart.assignSelectedToGroup(null, { confirmed: true }).valid, true);
  assert.equal(chart.getDiagramNodes().find(node => node.id === 'a').groupId, undefined);
  chart.destroy();
});

test('duplicates and deletes groups with explicit member policies', async () => {
  const { createChart, getBusinessSchema } = await import('../src/index.mjs');
  const chart = createChart({
    type: 'flow',
    nodes: [{ id: 'a', label: 'A', groupId: 'main', position: { x: 40, y: 60 } }, { id: 'b', label: 'B', groupId: 'main', position: { x: 200, y: 60 } }],
    edges: [{ id: 'ab', from: 'a', to: 'b' }],
    groups: [{ id: 'main', label: 'Main flow' }],
    data: { schema: getBusinessSchema('flow-node'), edgeSchema: getBusinessSchema('flow-edge') },
    diagram: { layout: 'manual', routing: 'orthogonal', grid: 8 },
    editing: { enabled: true, requireConfirmation: false, allowStructuralChanges: true }
  });
  assert.equal(chart.duplicateGroup('main', { confirmed: true, offset: { x: 24, y: 16 } }).valid, true);
  assert.ok(chart.getDiagramGroups().some(group => group.id === 'main-copy'));
  assert.equal(chart.getDiagramNodes().filter(node => node.groupId === 'main-copy').length, 2);
  assert.ok(chart.getDiagramEdges().some(edge => edge.from === 'a-copy' && edge.to === 'b-copy'));
  assert.equal(chart.deleteGroup('main-copy', { confirmed: true, policy: 'delete-members' }).valid, true);
  assert.equal(chart.getDiagramNodes().some(node => node.groupId === 'main-copy'), false);
  assert.equal(chart.undo().valid, true);
  assert.equal(chart.getDiagramNodes().filter(node => node.groupId === 'main-copy').length, 2);
  assert.equal(chart.deleteGroup('main', { confirmed: true }).valid, true);
  assert.equal(chart.getDiagramGroups().some(group => group.id === 'main'), false);
  assert.equal(chart.getDiagramNodes().filter(node => ['a', 'b'].includes(node.id)).every(node => node.groupId === undefined), true);
  chart.destroy();
});

test('connects and cancels diagram ports using keyboard only', async () => {
  const { createChart, getBusinessSchema } = await import('../src/index.mjs');
  const chart = createChart({
    type: 'flow',
    nodes: [
      { id: 'a', label: 'A', position: { x: 40, y: 60 }, ports: [{ id: 'out', side: 'right' }] },
      { id: 'b', label: 'B', position: { x: 220, y: 60 }, ports: [{ id: 'in', side: 'left' }] }
    ],
    edges: [],
    data: { schema: getBusinessSchema('flow-node'), edgeSchema: getBusinessSchema('flow-edge') },
    diagram: { layout: 'manual', routing: 'orthogonal', grid: 8 },
    interaction: { keyboard: true, portConnect: true },
    editing: { enabled: true, requireConfirmation: false, allowStructuralChanges: true }
  });
  const focusable = () => { const rows = []; chart.model.scene.walk(node => { if (node.interactive && /^(node|group|port)-/.test(node.id)) rows.push(node); }); return rows; };
  const event = key => ({ key, preventDefault() {}, ctrlKey: false, metaKey: false, shiftKey: false });
  chart._diagramFocus = focusable().findIndex(node => node.id === 'port-a-out');
  assert.equal(diagramKeyboard(chart, event('Enter')), true);
  assert.equal(chart._keyboardConnection.nodeId, 'a');
  chart._diagramFocus = focusable().findIndex(node => node.id === 'port-b-in');
  assert.equal(diagramKeyboard(chart, event('Enter')), true);
  assert.equal(chart._keyboardConnection, null);
  assert.ok(chart.getDiagramEdges().some(edge => edge.from === 'a' && edge.to === 'b' && edge.fromPort === 'out' && edge.toPort === 'in'));
  assert.equal(chart.undo().valid, true);
  chart._diagramFocus = focusable().findIndex(node => node.id === 'port-a-out');
  diagramKeyboard(chart, event('Enter'));
  diagramKeyboard(chart, event('Escape'));
  assert.equal(chart._keyboardConnection, null);
  chart.destroy();
});

test('keeps diagram navigation and editing static by default', () => {
  const spec = normalizeSpec({ type: 'architecture', nodes: [{ id: 'a', label: 'A' }], edges: [] });
  assert.equal(spec.interaction.zoom, false);
  assert.equal(spec.interaction.pan, false);
  assert.equal(spec.interaction.drag, false);
  assert.equal(spec.interaction.edgeDrag, false);
  assert.equal(spec.interaction.portConnect, false);
  assert.equal(spec.editing.enabled, false);
  const capabilities = getCapabilities();
  assert.equal(capabilities.interactionDefaults.edgeDrag, false);
  assert.deepEqual(capabilities.diagram.edgeEditing.renderers, ['canvas', 'svg']);
  assert.equal(capabilities.diagram.edgeEditing.segmentDrag, true);
  assert.ok(capabilities.editing.operations.includes('removeEdge'));
});

test('edits diagram edge segments with Canvas and SVG parity', async () => {
  const { diagramPointer } = await import('../src/diagram-interaction.mjs');
  for (const renderer of ['canvas', 'svg']) {
    const chart = createChart({
      type: 'architecture', renderer,
      nodes: [{ id: 'api', label: 'API', position: { x: 40, y: 70 } }, { id: 'db', label: 'DB', position: { x: 360, y: 190 } }],
      edges: [{ id: 'api-db', from: 'api', to: 'db', routing: 'orthogonal', waypoints: [{ x: 240, y: 88 }, { x: 240, y: 208 }] }],
      data: { schema: getBusinessSchema('architecture-node'), edgeSchema: getBusinessSchema('architecture-edge') },
      diagram: { layout: 'manual', routing: 'orthogonal', grid: 8 },
      interaction: { edgeDrag: true },
      editing: { enabled: true, requireConfirmation: false, allowDelete: true, allowStructuralChanges: true }
    });
    const edge = chart.model.scene.find('edge-0');
    assert.equal(edge.interactive, true);
    assert.equal(chart.model.scene.hit(240, 145)?.dataRef.edgeId, 'api-db');
    chart.selectEdges(['api-db']);
    assert.deepEqual(chart.getSelectedEdgeIds(), ['api-db']);
    assert.equal(chart.getSelectedData()[0].id, 'api-db');
    let handle;
    chart.model.scene.walk(node => { if (!handle && node.dataRef?.edgeHandle === 'segment') handle = node; });
    assert.ok(handle);
    const center = { x: handle.geometry.x + handle.geometry.width / 2, y: handle.geometry.y + handle.geometry.height / 2 };
    chart._eventPoint = event => ({ x: event.clientX, y: event.clientY });
    const target = { focus() {}, setPointerCapture() {}, hasPointerCapture() { return false; } };
    diagramPointer(chart, 'start', { type: 'pointerdown', button: 0, pointerId: 1, clientX: center.x, clientY: center.y }, target);
    diagramPointer(chart, 'move', { type: 'pointermove', pointerId: 1, clientX: center.x + 24, clientY: center.y }, target);
    diagramPointer(chart, 'end', { type: 'pointerup', pointerId: 1, clientX: center.x + 24, clientY: center.y }, target);
    assert.equal(chart.getDiagramEdges()[0].waypoints[0].x, 264);
    assert.equal(chart.undo().valid, true);
    assert.equal(chart.getDiagramEdges()[0].waypoints[0].x, 240);
    chart.selectEdges(['api-db']);
    assert.equal(chart.deleteSelectedEdges({ confirmed: true }).valid, true);
    assert.equal(chart.getDiagramEdges().length, 0);
    assert.equal(chart.undo().valid, true);
    assert.equal(chart.getDiagramEdges()[0].id, 'api-db');
    chart.destroy();
  }
});

test('resizes member-derived groups and routes through dense obstacles deterministically', async () => {
  const { createChart, getBusinessSchema, routeEdge } = await import('../src/index.mjs');
  const chart = createChart({ type: 'flow', nodes: [
    { id: 'a', label: 'A', groupId: 'main', position: { x: 40, y: 40 }, size: { width: 80, height: 40 } },
    { id: 'b', label: 'B', groupId: 'main', position: { x: 160, y: 100 }, size: { width: 80, height: 40 } }
  ], edges: [], groups: [{ id: 'main', label: 'Main', padding: 20 }], data: { schema: getBusinessSchema('flow-node'), edgeSchema: getBusinessSchema('flow-edge') }, diagram: { layout: 'manual', routing: 'orthogonal', grid: 8 }, editing: { enabled: true, requireConfirmation: false, allowStructuralChanges: true } });
  assert.equal(chart.resizeGroup('main', { width: 300, height: 180 }).valid, true);
  const nodes = chart.getDiagramNodes();
  const width = Math.max(...nodes.map(node => node.position.x + node.size.width)) - Math.min(...nodes.map(node => node.position.x));
  const height = Math.max(...nodes.map(node => node.position.y + node.size.height)) - Math.min(...nodes.map(node => node.position.y));
  assert.equal(Math.round(width), 300);
  assert.equal(Math.round(height), 180);
  assert.equal(chart.undo().valid, true);
  const obstacles = [{ x: 100, y: 0, width: 80, height: 120 }, { x: 220, y: 80, width: 80, height: 120 }, { x: 340, y: 0, width: 80, height: 120 }];
  const input = { grid: 8, obstacles };
  const first = routeEdge(input, { x: 0, y: 40, width: 60, height: 40 }, { x: 480, y: 40, width: 60, height: 40 }, 'orthogonal');
  assert.deepEqual(first, routeEdge(input, { x: 0, y: 40, width: 60, height: 40 }, { x: 480, y: 40, width: 60, height: 40 }, 'orthogonal'));
  assert.ok(first.length >= 4);
  chart.destroy();
});

test('exposes deterministic per-chart capabilities and Agent planning', async () => {
  const { getCapabilities, getChartCapability, planChart } = await import('../src/index.mjs');
  const capabilities = getCapabilities();
  assert.equal(capabilities.contractVersion, '1.0');
  assert.equal(Object.keys(capabilities.charts).length, capabilities.chartTypes.length);
  assert.equal(getChartCapability('heatmap').features['missing-values'], 'supported');
  const rows = [{ month: 'Jan', revenue: 12 }, { month: 'Feb', revenue: 18 }];
  const first = planChart(rows, { intent: 'trend' });
  assert.deepEqual(first, planChart(rows, { intent: 'trend' }));
  assert.equal(first.primary, 'line');
  assert.equal(first.suggestedEncodings.dimension, 'month');
  assert.equal(first.suggestedEncodings.measure, 'revenue');
  assert.ok(first.confidence > 0.5);
});

test('inspects Agent field metadata and reports repair diagnostics', async () => {
  const { inspectData, validateSpec } = await import('../src/index.mjs');
  const report = inspectData([{ date: '2026-09-01', revenue: 12, conversionRate: .4 }, { date: '2026-09-02', revenue: 18, conversionRate: null }]);
  assert.equal(report.fields.find(field => field.name === 'date').role, 'temporal-dimension');
  assert.equal(report.fields.find(field => field.name === 'revenue').unit, 'currency-unknown');
  assert.equal(report.fields.find(field => field.name === 'conversionRate').unit, 'percentage');
  assert.equal(report.missingValueCount, 1);
  assert.equal(inspectData([{ id: 'a', month: 'Jan', value: 1 }, { id: 'b', month: 'Feb', value: 2 }]).dimensions[0], 'month');
  const validation = validateSpec({ type: 'pie', data: Array.from({ length: 9 }, (_, index) => ({ name: String(index), value: index + 1 })), interaction: { zoom: true } });
  assert.ok(validation.warnings.some(item => item.code === 'HIGH_CARDINALITY_PIE' && item.suggestion));
  assert.ok(validation.warnings.some(item => item.code === 'UNSUPPORTED_INTERACTION' && item.path === 'interaction.zoom'));
  const misplaced = validateSpec({ type: 'line', data: [{ id: 'a', month: 'Jan', value: 1 }], encoding: { x: { field: 'month', title: 'Month', format: 'date' }, y: { field: 'value' }, labels: { enabled: true }, legend: { visible: false } }, yAxis: { min: 0, max: 10 } });
  assert.ok(misplaced.warnings.some(item => item.code === 'MISPLACED_AXIS_TITLE' && item.path === 'encoding.x.title'));
  assert.ok(misplaced.warnings.some(item => item.code === 'MISPLACED_AXIS_FORMAT' && item.path === 'encoding.x.format'));
  assert.ok(misplaced.warnings.some(item => item.code === 'MISPLACED_LABELS' && item.path === 'encoding.labels'));
  assert.ok(misplaced.warnings.some(item => item.code === 'MISPLACED_LEGEND' && item.path === 'encoding.legend'));
  assert.equal(misplaced.warnings.filter(item => item.code === 'UNSUPPORTED_AXIS_DOMAIN').length, 2);
  assert.equal(validateSpec({ type: 'line', data: [{ name: 'A', value: 1 }], yAxis: { domain: [0, 0] } }).errors[0].code, 'INVALID_AXIS_DOMAIN');
  const unknownIntent = planChart([{ month: 'Jan', value: 1 }], { intent: 'trend over time' });
  assert.equal(unknownIntent.primary, 'bar');
  assert.ok(unknownIntent.warnings.some(item => item.code === 'UNKNOWN_INTENT'));
});

test('explains chart lineage, warnings, and accessible intent', async () => {
  const { createChart } = await import('../src/index.mjs');
  const chart = createChart({ type: 'line', renderer: 'svg', title: { text: 'Revenue' }, accessibility: { enabled: true }, data: [{ id: 'jan', name: 'Jan', value: 12 }, { id: 'feb', name: 'Feb', value: null }] });
  const explanation = chart.explain();
  assert.equal(explanation.type, 'line');
  assert.deepEqual(explanation.lineage.recordIds, ['jan', 'feb']);
  assert.equal(explanation.accessibility.summary, 'Revenue');
  assert.ok(explanation.warnings.some(item => item.code === 'MISSING_VALUE'));
  chart.destroy();
});

test('renders common titles, grids, legends, labels, and corrected chart geometry', async () => {
  const { buildScene } = await import('../src/charts.mjs');
  const area = buildScene(normalizeSpec({ type: 'area', stack: 'stacked', title: { text: 'T', subtitle: 'S' }, labels: { enabled: true }, data: [{ name: 'A', first: 2, second: 3 }, { name: 'B', first: 4, second: 2 }], encoding: { x: { field: 'name' }, y: [{ field: 'first' }, { field: 'second' }] } }));
  assert.ok(area.scene.find('subtitle'));
  assert.ok(area.scene.find('grid-y-1'));
  assert.ok(area.scene.find('legend-label-1'));
  assert.ok(area.scene.find('area-fill-1'));
  const bar = buildScene(normalizeSpec({ type: 'bar', data: [{ name: 'Long category', value: -20 }, { name: 'Gain', value: 30 }] }));
  assert.ok(bar.scene.find('series-0-item-0').geometry.width > 0);
  assert.ok(bar.state.plot.x >= 120);
  const scatter = buildScene(normalizeSpec({ type: 'scatter', data: [{ x: 100, y: 1 }, { x: 200, y: 2 }] }));
  assert.ok(scatter.scene.find('series-0-item-1').geometry.cx > scatter.scene.find('series-0-item-0').geometry.cx);
  const pie = buildScene(normalizeSpec({ type: 'pie', data: [{ name: 'A', value: 0 }] }));
  assert.ok(pie.scene.find('pie-zero-total'));
  assert.ok(pie.data.warnings.some(item => item.code === 'ZERO_TOTAL'));
  const titled = buildScene(normalizeSpec({ type: 'line', title: { text: 'T', subtitle: 'S' }, data: [{ name: 'A', value: 1 }] }));
  assert.equal(titled.scene.find('title').style.textBaseline, 'middle');
  assert.equal(titled.scene.find('subtitle').style.textBaseline, 'middle');
  assert.equal(titled.scene.find('title').geometry.y, 32);
  assert.equal(titled.scene.find('subtitle').geometry.y, 52.5);
  assert.ok(titled.state.plot.y > titled.scene.find('subtitle').geometry.y);
});

test('keeps active Playground pages and a no-cache preview path', async () => {
  const { readFile } = await import('node:fs/promises');
  const pages = ['index.html', 'project-gallery.html', 'foundational-gallery.html', 'theme-gallery.html', 'preferences-lab.html', 'agent-workbench.html', 'project-intelligence.html', 'editing.html', 'diagram-editor.html', 'interaction-lab.html', 'accessibility-lab.html', 'performance-lab.html'];
  await Promise.all(pages.map(page => readFile(new URL(`../playground/${page}`, import.meta.url), 'utf8')));
  const preferencesUi = await readFile(new URL('../src/preferences-ui.mjs', import.meta.url), 'utf8');
  assert.match(preferencesUi, /aria-hidden="true">≡</);
  assert.match(preferencesUi, /panel\.querySelectorAll\('select,input\[data-key\]'\).*addEventListener\('change'/s);
  assert.ok(preferencesUi.includes("'zh-CN'") && preferencesUi.includes('Chart quick settings'));
  assert.equal(preferencesUi.includes('data-key="preset"'), false);
  assert.equal(preferencesUi.includes('data-key="density"'), false);
  assert.equal(preferencesUi.includes('data-key="branding"'), false);
  const fullGallery = await readFile(new URL('../playground/project-gallery.html', import.meta.url), 'utf8');
  assert.match(fullGallery, /--gallery-viewport-width/);
  assert.match(fullGallery, /gallery\.style\.setProperty\('--gallery-viewport-width'/);
  assert.match(fullGallery, /模拟每张图表的容器宽度/);
  assert.equal(preferencesUi.includes('data-action="page-settings"'), false);
  assert.equal(preferencesUi.includes('data-action="reset"'), false);
  assert.equal(preferencesUi.includes('已应用并保存'), false);
  assert.match(preferencesUi, /contrastRatio\('#172033', background\)/);
  assert.match(preferencesUi, /optionMarkup\(scaleField\)/);
  assert.match(preferencesUi, /getPreferenceCapabilities\(chart\.getSpec\(\)\.type/);
  assert.match(preferencesUi, /option\[data-current\]/);
  assert.match(preferencesUi, /if \(normalized === 'en' \|\| normalized\.startsWith\('en-'\)\) return 'en';/);
  assert.match(preferencesUi, /return 'en';\n\}/);
  assert.match(preferencesUi, /preferredPlacements = placements/);
  assert.match(preferencesUi, /panel\.dataset\.placement = result\.placement/);
  const entry = await readFile(new URL('../src/index.mjs', import.meta.url), 'utf8');
  assert.equal(/from ['"][^'"]+\?/.test(entry), false);
  const browserEntry = await readFile(new URL('../playground/runtime.mjs', import.meta.url), 'utf8');
  assert.equal(/from ['"][^'"]+\?/.test(browserEntry), false);
  const previewServer = await readFile(new URL('../scripts/serve-playground.mjs', import.meta.url), 'utf8');
  assert.match(previewServer, /Cache-Control.*no-store/);
});

test('exposes one package runtime entry and completes the Agent workflow', async () => {
  const { readFile } = await import('node:fs/promises');
  const runtime = await import('@taylorwong/ichartjs');
  assert.equal(runtime.getCapabilities().chartTypes.length, 18);
  const packageMetadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageMetadata.exports['./agent'], undefined);
  const { runAgentWorkflow, sampleRows } = await import('../examples/agent-workflow.mjs');
  const result = runAgentWorkflow(sampleRows);
  assert.equal(result.ok, true);
  assert.equal(result.plan.primary, 'line');
  assert.deepEqual(result.explanation.lineage.recordIds, sampleRows.map(row => row.id));
  assert.deepEqual(result.selfCheck, { chartDeclared: true, recordIdsPreserved: true, warningsVisible: true, styleExplained: true });
});
