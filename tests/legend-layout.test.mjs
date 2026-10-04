import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec, validateSpec } from '../src/index.mjs';
import { buildScene } from '../src/charts.mjs';
import { createChart as createStandardChart } from '../src/standard.mjs';

const seriesData = { values: [
  { name: 'Jan', product: 10, service: 20 },
  { name: 'Feb', product: 15, service: 25 }
] };

function legendBounds(model) {
  const items = model.state.chrome.legend.items;
  return {
    left: model.state.chrome.legend.left,
    right: model.state.chrome.legend.right,
    itemLeft: Math.min(...items.map(item => item.x)),
    itemRight: Math.max(...items.map(item => item.x + item.width))
  };
}

function profileSwatchX(chart) {
  let x = null;
  chart.model.scene.walk(node => { if (node.id === 'legend-swatch-0') x = node.geometry.x; });
  return x;
}

test('aligns root Cartesian legends left, center, and right', () => {
  const positions = {};
  for (const align of ['left', 'center', 'right']) {
    const model = buildScene(normalizeSpec({
      type: 'bar',
      width: 640,
      height: 360,
      legend: { align },
      data: seriesData,
      encoding: { x: { field: 'name' }, y: [{ field: 'product' }, { field: 'service' }] }
    }));
    positions[align] = { ...legendBounds(model), align: model.state.chrome.legend.align };
  }
  assert.equal(positions.left.align, 'left');
  assert.equal(positions.center.align, 'center');
  assert.equal(positions.right.align, 'right');
  assert.equal(positions.left.left, 56);
  assert.equal(positions.right.right, 614);
  assert.ok(Math.abs((positions.center.itemLeft + positions.center.itemRight) / 2 - 335) < 1);
  assert.ok(positions.left.itemLeft < positions.center.itemLeft);
  assert.ok(positions.center.itemLeft < positions.right.itemLeft);
});

test('uses the same alignment contract for Pie legends and centers by default', () => {
  const model = buildScene(normalizeSpec({
    type: 'pie',
    width: 640,
    height: 360,
    data: { values: [{ name: 'A', value: 10 }, { name: 'B', value: 20 }, { name: 'C', value: 30 }] }
  }));
  const bounds = legendBounds(model);
  assert.equal(model.state.chrome.legend.align, 'center');
  assert.ok(Math.abs((bounds.itemLeft + bounds.itemRight) / 2 - 335) < 1);
});

test('keeps profile entry legends aligned with the root contract', () => {
  const common = { type: 'line', renderer: 'svg', data: seriesData, encoding: { x: { field: 'name' }, y: [{ field: 'product' }, { field: 'service' }] } };
  const left = createStandardChart({ ...common, legend: { align: 'left' } });
  const center = createStandardChart({ ...common, legend: { align: 'center' } });
  const right = createStandardChart({ ...common, legend: { align: 'right' } });
  assert.ok(profileSwatchX(left) < profileSwatchX(center));
  assert.ok(profileSwatchX(center) < profileSwatchX(right));
  left.destroy();
  center.destroy();
  right.destroy();
});

test('rejects unsupported legend alignment values', () => {
  const result = validateSpec({ type: 'line', legend: { align: 'middle' }, data: [{ name: 'A', value: 1 }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === 'INVALID_LEGEND_ALIGN'));
});
