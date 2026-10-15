import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec, validateSpec } from '../src/spec.mjs';
import { createChart } from '../src/index.mjs';
import { createChart as createStandard } from '../src/standard.mjs';
import { BaseRenderer, resolveContainer } from '../src/renderer.mjs';
import { Scene } from '../src/scene.mjs';
import { sceneToSvgString } from '../src/scene-svg.mjs';

test('host Element references are excluded from portable Specs before JSON cloning', () => {
  const container = {}; container.frameworkReference = container;
  const input = { type: 'line', container, data: [{ id: 'a', name: 'A', value: 2 }] };
  const normalized = normalizeSpec(input), checked = validateSpec(input);
  assert.equal(Object.hasOwn(normalized, 'container'), false);
  assert.equal(checked.valid, true);
  assert.doesNotThrow(() => JSON.stringify(checked.spec));
  assert.equal(input.container, container);
  assert.equal(normalizeSpec({ ...input, container: '#chart' }).container, '#chart');
});

test('container resolution rejects missing selectors without rejecting unmounted exports', () => {
  const original = globalThis.document, element = {};
  globalThis.document = { querySelector: selector => selector === '#chart' ? element : null };
  try {
    assert.equal(resolveContainer('#chart'), element);
    assert.equal(resolveContainer(element), element);
    assert.equal(resolveContainer(undefined), undefined);
    assert.throws(() => resolveContainer('#missing'), /container.*not.*found/i);
  } finally { if (original === undefined) delete globalThis.document; else globalThis.document = original; }
});

test('renderer destruction removes owned surfaces, keeps caller surfaces and releases references', () => {
  for (const key of ['svg', 'canvas']) for (const borrowed of [false, true]) {
    const renderer = new BaseRenderer(), surface = { removed: false, remove() { this.removed = true; } };
    renderer[key] = surface; renderer.container = borrowed ? surface : {}; renderer.ctx = {};
    renderer.destroy(); renderer.destroy();
    assert.equal(surface.removed, !borrowed);
    assert.equal(renderer.container, null);
    assert.equal(renderer[key], null);
    assert.equal(renderer.ctx, null);
  }
});

test('moving a mount removes old owned content without removing caller targets', () => {
  const renderer = new BaseRenderer(), oldHost = {}, newHost = {};
  const surface = { removed: false, remove() { this.removed = true; } };
  renderer.container = oldHost; renderer.canvas = surface;
  renderer.mount(newHost);
  assert.equal(surface.removed, true);
  assert.equal(renderer.container, newHost);
  surface.removed = false; renderer.container = oldHost;
  renderer.mount(surface);
  assert.equal(surface.removed, false);
  assert.equal(renderer.container, surface);
});

test('constructor plugins are live host callbacks and not JSON-normalized callback copies', () => {
  const calls = [];
  const chart = createChart({ type: 'line', data: [], renderer: 'svg', plugins: [{ install() { calls.push('install'); }, beforeRender() { calls.push('before'); }, afterRender() { calls.push('after'); }, destroy() { calls.push('destroy'); } }] });
  assert.deepEqual(calls, ['install', 'before', 'after']);
  assert.doesNotThrow(() => chart.export({ type: 'json' }));
  chart.destroy();
  assert.deepEqual(calls, ['install', 'before', 'after', 'destroy']);
});

test('initial rendering failure destroys installed host plugins', () => {
  let destroyed = false;
  assert.throws(() => createChart({ type: 'line', data: [], renderer: 'svg', plugins: [{ beforeRender() { throw new Error('host rendering failed'); }, destroy() { destroyed = true; } }] }), /host rendering failed/);
  assert.equal(destroyed, true);
});

test('SVG serialization emits decorative semantic attributes only once', () => {
  const scene = new Scene(520, 320);
  scene.add({ id: 'decorative', type: 'text', decorative: true, geometry: { x: 10, y: 10, text: 'Caption' }, style: { ariaHidden: 'true', role: 'presentation', pointerEvents: 'none' } });
  const tag = sceneToSvgString(scene).match(/<text[^>]+id="decorative"[^>]*>/)[0];
  assert.equal((tag.match(/aria-hidden=/g) || []).length, 1);
  assert.equal((tag.match(/role=/g) || []).length, 1);
  assert.equal((tag.match(/pointer-events:none/g) || []).length, 1);
});

test('dense category ticks retain endpoints without crowding the final tick', () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ id: `p${index}`, name: `P${index}`, value: index + 1 }));
  for (const factory of [createChart, createStandard]) for (const type of ['line', 'area', 'column']) for (const width of [280, 420, 640]) {
    const chart = factory({ type, width, height: 320, renderer: 'svg', data: rows });
    try {
      const ticks = []; chart.model.scene.walk(node => { const match = node.id.match(/^label-x-P(\d+)$/); if (match) ticks.push(Number(match[1])); });
      assert.equal(ticks[0], 0); assert.equal(ticks.at(-1), 99);
      for (let index = 1; index < ticks.length; index += 1) assert.ok(ticks[index] - ticks[index - 1] >= Math.min(chart.model.state.xLabels.step, 99));
      assert.deepEqual(chart.explain().lineage.recordIds, rows.map(row => row.id));
    } finally { chart.destroy(); }
  }
});
