import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart } from '../src/index.mjs';
import { createChart as createStandardChart, chartTypes } from '../src/standard.mjs';
import { normalizeSpec } from '../src/spec.mjs';
import { buildStandardScene } from '../src/profile-standard.mjs';
import { formatChartTooltip } from '../src/tooltip.mjs';

const standardSpec = {
  type: 'line', renderer: 'svg', width: 560, height: 320,
  title: { text: 'Sales', subtitle: 'Monthly result' },
  data: [{ id: 'a', month: 'Jan', sales: 120 }, { id: 'b', month: 'Feb', sales: 180, internal: 'hidden' }],
  encoding: { x: { field: 'month', type: 'category' }, y: { field: 'sales', type: 'quantitative' } }
};

function sceneIds(chart) {
  const ids = [];
  chart.model.scene.walk(node => { if (node.id && node.id !== 'root') ids.push(node.id); });
  return ids;
}

test('root and standard use the same standard scene layout', () => {
  const root = createChart(standardSpec);
  const standard = createStandardChart(standardSpec);
  assert.deepEqual(root.getState().layout.plot, standard.getState().layout.plot);
  assert.deepEqual(root.getState().layout.chrome, standard.getState().layout.chrome);
  assert.deepEqual(sceneIds(root), sceneIds(standard));
  root.destroy();
  standard.destroy();
});

test('all standard chart types remain renderable from the focused entry', () => {
  const fixtures = {
    line: standardSpec,
    area: { ...standardSpec, type: 'area' },
    bar: { ...standardSpec, type: 'bar' },
    column: { ...standardSpec, type: 'column' },
    pie: { type: 'pie', data: [{ name: 'A', value: 2 }, { name: 'B', value: 1 }] },
    scatter: { type: 'scatter', data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] },
    funnel: { type: 'funnel', data: [{ name: 'Visit', value: 100 }, { name: 'Paid', value: 20 }] },
    gauge: { type: 'gauge', domain: [0, 100], data: [{ name: 'Score', value: 72 }] },
    heatmap: { type: 'heatmap', data: [{ x: 'Mon', y: 'AM', value: 12 }] },
    radar: { type: 'radar', indicators: [{ name: 'Quality', field: 'quality', min: 0, max: 100 }, { name: 'Speed', field: 'speed', min: 0, max: 100 }, { name: 'Cost', field: 'cost', min: 0, max: 100 }], data: [{ quality: 80, speed: 70, cost: 60 }] }
  };
  assert.deepEqual([...chartTypes], Object.keys(fixtures));
  Object.entries(fixtures).forEach(([type, spec]) => {
    const chart = createStandardChart({ ...spec, type, renderer: 'svg' });
    assert.equal(chart.getState().health.renderable, true, type);
    assert.ok(chart.model.scene.root.children.length > 0, type);
    chart.destroy();
  });
});

test('resolved mark tokens control shared standard line and point geometry', () => {
  const chart = createChart({ ...standardSpec, theme: { preset: 'analysis', tokens: { marks: { lineWidth: 7, radius: 10, opacity: 0.4 } } } });
  const line = chart.model.scene.find('series-0-line');
  const point = chart.model.scene.find('series-0-item-0');
  assert.equal(line.style.strokeWidth, 7);
  assert.equal(line.style.opacity, 0.4);
  assert.equal(point.geometry.r, 10);
  assert.equal(point.style.opacity, 0.4);
  chart.destroy();
});

test('standard profile preserves theme-derived chrome on updates and rejects other profiles', () => {
  const chart = createStandardChart({ ...standardSpec, theme: 'light' });
  chart.setTheme({ mode: 'dark' });
  assert.equal(chart.getSpec().background, chart.getSpec().theme.background);
  assert.deepEqual(chart.getSpec().colors, chart.getSpec().theme.colors);
  const before = chart.getSpec();
  assert.throws(() => chart.update({ type: 'gantt', encoding: {}, data: { values: [{ id: 'a', name: 'Plan', start: '2026-01-01', end: '2026-01-03' }] } }), error => error.errors?.some(item => item.code === 'PROFILE_TYPE_UNSUPPORTED'));
  assert.equal(chart.getSpec().type, before.type);
  chart.destroy();
});

test('standard profile keeps lifecycle output consistent after data and size updates', () => {
  const chart = createStandardChart({ ...standardSpec, renderer: 'svg' });
  chart.update({ data: [{ month: 'Mar', sales: 240 }] }).resize(640, 360);
  const json = chart.export({ type: 'json', as: 'object' });
  assert.equal(json.spec.width, 640);
  assert.equal(json.spec.data.values[0].sales, 240);
  assert.match(chart.export({ type: 'svg' }), /<svg/);
  chart.destroy();
});

test('root interaction switches gate hover and click events', () => {
  const chart = createChart({ ...standardSpec, interaction: { tooltip: false, hover: false, click: false } });
  const listeners = new Map();
  const target = { style: {}, addEventListener(type, listener) { listeners.set(type, listener); }, removeEventListener() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 560, height: 320 }; } };
  chart.container = {};
  chart.renderer.container = {};
  chart.renderer.svg = target;
  chart.model.scene.hit = () => ({ id: 'point', dataRef: { dataIndex: 0 } });
  let hover = 0, click = 0;
  chart.on('hover', () => { hover += 1; }).on('click', () => { click += 1; });
  chart._bindEvents();
  listeners.get('mousemove')({ type: 'mousemove', clientX: 20, clientY: 20 });
  listeners.get('click')({ type: 'click', clientX: 20, clientY: 20 });
  assert.equal(hover, 0);
  assert.equal(click, 0);
  chart.destroy();
});

test('standard empty states use the chart locale', () => {
  const { scene } = buildStandardScene(normalizeSpec({ type: 'pie', renderer: 'svg', locale: 'zh-CN', data: [{ name: 'A', value: 0 }] }));
  assert.equal(scene.find('pie-zero-total').geometry.text, '暂无正值');
});

test('standard tooltips use encoded fields, formats and locale', () => {
  const text = formatChartTooltip({ locale: 'en-US', encoding: { x: { field: 'month' }, y: { field: 'sales' } }, yAxis: { format: { maximumFractionDigits: 2 } } }, { id: 'a', month: 'Jan', sales: 1234.567, internal: 'secret' });
  assert.equal(text, 'month: Jan · sales: 1,234.57');
  assert.equal(text.includes('secret'), false);
});
