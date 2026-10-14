import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart as createRoot, createBoard as createRootBoard } from '../src/index.mjs';
import { createChart as createStandard } from '../src/standard.mjs';
import { createChart as createProject } from '../src/project-profile.mjs';
import { createChart as createDiagram } from '../src/diagram-profile.mjs';
import { createBoard } from '../src/board-profile.mjs';

const rows = count => Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `P${index}`, value: index % 100 }));
const fixtures = [
  ['standard', createStandard, { type: 'line', data: rows(3) }],
  ['project', createProject, { type: 'gantt', data: [{ id: 'plan', name: 'Plan', start: '2026-01-01', end: '2026-01-03' }] }],
  ['diagram', createDiagram, { type: 'flow', nodes: [{ id: 'start', label: 'Start' }] }]
];

for (const [name, factory, spec] of fixtures) {
  test(`${name}: rejected updates do not poison theme overrides or diagnostics`, () => {
    const chart = factory({ ...spec, renderer: 'svg', theme: 'light' });
    const before = chart.export({ type: 'json', as: 'object' });
    const invalid = name === 'standard' ? { type: 'gantt', encoding: {}, data: [{ id: 'plan', name: 'Plan', start: '2026-01-01', end: '2026-01-03' }] } : { type: 'gauge', encoding: {}, domain: [0, 100], data: rows(1) };
    assert.throws(() => chart.update({ ...invalid, background: '#abcdef', colors: ['#abcdef'], padding: { top: 30 } }));
    assert.deepEqual(chart.export({ type: 'json', as: 'object' }), before);
    chart.setTheme({ mode: 'dark' });
    assert.equal(chart.getSpec().background, chart.getSpec().theme.background);
    assert.deepEqual(chart.getSpec().colors, chart.getSpec().theme.colors);
    assert.deepEqual(chart.getSpec().padding, chart.getSpec().theme.layout.padding);
    chart.destroy();
  });

  test(`${name}: scene failure restores state and future successful operations`, () => {
    const chart = factory({ ...spec, renderer: 'svg', theme: 'light' });
    const before = chart.export({ type: 'json', as: 'object' }), build = chart._buildScene;
    chart._buildScene = () => { throw new Error('scene failure'); };
    assert.throws(() => chart.update({ theme: 'dark', background: '#abcdef' }), /scene failure/);
    assert.deepEqual(chart.export({ type: 'json', as: 'object' }), before);
    assert.throws(() => chart.resize(700, 400), /scene failure/);
    assert.deepEqual(chart.export({ type: 'json', as: 'object' }), before);
    chart._buildScene = build;
    chart.setTheme('dark').resize(700, 400);
    assert.equal(chart.getSpec().background, chart.getSpec().theme.background);
    const saved = chart.export({ type: 'json', as: 'object' }), restored = factory(saved.spec);
    assert.equal(JSON.stringify(restored.getState().layout), JSON.stringify(saved.state.layout));
    restored.destroy(); chart.destroy();
    assert.throws(() => chart.render(), /destroyed/);
    assert.throws(() => chart.update({ background: '#abcdef' }), /destroyed/);
    assert.throws(() => chart.resize(900, 500), /destroyed/);
    assert.equal(chart.getSpec().width, 700);
  });

  test(`${name}: explicit renderer changes replace and dispose surfaces`, () => {
    const chart = factory({ ...spec, renderer: 'svg' });
    for (const renderer of ['canvas', 'svg', 'canvas']) {
      const previous = chart.renderer;
      let disposed = false;
      const destroy = previous.destroy.bind(previous);
      previous.destroy = () => { disposed = true; destroy(); };
      chart.update({ renderer });
      assert.equal(chart.getState().renderer, renderer);
      assert.equal(chart.getState().rendererSelection.effective, renderer);
      assert.equal(chart.getState().rendererSelection.requested, renderer);
      assert.equal(disposed, true);
      assert.match(chart.export({ type: 'svg' }), /<svg/);
    }
    chart.destroy();
  });
}

test('standard: auto follows data and accessibility updates without changing IDs', () => {
  const chart = createStandard({ type: 'line', renderer: 'auto', data: rows(3) });
  for (const [count, expected] of [[401, 'canvas'], [400, 'svg'], [401, 'canvas'], [2, 'svg']]) {
    chart.update({ data: rows(count) });
    assert.equal(chart.getState().renderer, expected);
    assert.equal(chart.getState().rendererSelection.recordCount, count);
    assert.deepEqual(chart.getState().lineage.recordIds, rows(count).map(row => row.id));
  }
  chart.update({ data: rows(401), accessibility: { enabled: true } });
  assert.equal(chart.getState().renderer, 'svg');
  chart.update({ accessibility: { enabled: false } });
  assert.equal(chart.getState().renderer, 'canvas');
  chart.destroy();
});

test('root: explicit renderer updates are atomic; ordinary auto data updates retain the renderer', () => {
  const chart = createRoot({ type: 'line', renderer: 'auto', theme: 'light', data: rows(3) });
  chart.setData(rows(401));
  assert.equal(chart.getState().rendererSelection.effective, 'svg');
  chart.update({ renderer: 'auto' });
  assert.equal(chart.getState().rendererSelection.effective, 'canvas');
  chart.update({ renderer: 'svg' });
  assert.equal(chart.getState().rendererSelection.effective, 'svg');
  const before = chart.export({ type: 'json', as: 'object' });
  const render = chart.render;
  chart.render = () => { throw new Error('publication failure'); };
  assert.throws(() => chart.update({ renderer: 'canvas', theme: 'dark', background: '#abcdef' }), /publication failure/);
  assert.deepEqual(chart.export({ type: 'json', as: 'object' }), before);
  chart.render = render;
  chart.setTheme('dark');
  assert.equal(chart.getSpec().background, chart.getSpec().theme.background);
  chart.destroy();
  assert.throws(() => chart.render(), /destroyed/);
  assert.throws(() => chart.update({ renderer: 'canvas' }), /destroyed/);
});

for (const [name, factory, spec] of fixtures) {
  test(`${name}: explicit style overrides survive successful updates and rejected requests`, () => {
    const chart = factory({ ...spec, renderer: 'svg', background: '#abcdef', colors: ['#123456'], padding: { top: 45, left: 55, right: 25, bottom: 35 } });
    const before = chart.getSpec();
    assert.throws(() => chart.update({ renderer: 'invalid', colors: ['#654321'] }));
    chart.setTheme('dark').update({ renderer: 'canvas' }).resize(720, 440);
    assert.equal(chart.getSpec().background, before.background);
    assert.deepEqual(chart.getSpec().colors, before.colors);
    assert.deepEqual(chart.getSpec().padding, before.padding);
    chart.destroy();
  });
}

for (const [name, factory] of [['root', createRoot], ['standard', createStandard]]) {
  test(`${name}: category indexing preserves repeated labels, order and missing values`, () => {
    const chart = factory({ type: 'line', renderer: 'svg', data: [{ id: 'a', name: 'B', value: 2 }, { id: 'b', name: 'A', value: 3 }, { id: 'c', name: 'B', value: 5 }, { id: 'd', name: '', value: 4 }] });
    const plot = chart.model.state.plot, points = chart.model.scene.find('series-0-line').geometry.points;
    assert.equal(points[0].x, points[2].x);
    assert.equal(points[0].x, plot.x + plot.width / 4);
    assert.equal(points[1].x, plot.x + plot.width * 3 / 4);
    assert.equal(points[3].x, plot.x - plot.width / 4);
    chart.destroy();
  });
}

for (const [name, factory] of [['root Board', createRootBoard], ['board Profile', createBoard]]) {
  test(`${name}: failed updates preserve revision, history and later renderer updates`, () => {
    const board = factory({ renderer: 'svg', items: [{ id: 'shape', kind: 'shape', position: { x: 20, y: 20 }, size: { width: 40, height: 40 } }] });
    const before = board.getState();
    assert.throws(() => board.update({ items: [{ id: 'bad', kind: 'shape', size: { width: 1, height: 1 } }] }));
    assert.deepEqual(board.getState(), before);
    board.update({ renderer: 'canvas' });
    assert.equal(board.getState().renderer, 'canvas');
    board.undo();
    assert.equal(board.getState().renderer, 'svg');
    board.redo();
    assert.equal(board.getState().renderer, 'canvas');
    board.destroy();
  });
}
