import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, getCapabilities, validateBoardSpec } from '../src/index.mjs';
import cat from '../agent-recipes/drawings/cat.json' with { type: 'json' };

test('exposes the Whiteboard Foundation geometry contract', () => {
  const contract = getCapabilities().canvasComposition;
  assert.deepEqual(contract.items, ['image', 'text', 'shape', 'path', 'connector', 'chart']);
  assert.deepEqual(contract.geometry.paths, ['linear', 'cubic']);
  assert.deepEqual(contract.geometry.primitives.slice(-2), ['arc', 'sector']);
  assert.equal(contract.geometry.angles, 'degrees');
  assert.equal(contract.text.wrapping, true);
});

test('validates and renders the simple cat drawing recipe', () => {
  const result = validateBoardSpec(cat);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  const board = createBoard(cat);
  const svg = board.export({ type: 'svg' });
  assert.match(svg, /id="tail"/);
  assert.match(svg, /id="body"/);
  assert.match(svg, /id="left-eye"/);
  assert.match(svg, /fill="#292524"/);
  assert.match(svg, / C /);
  assert.match(svg, /id="nose"/);
  assert.match(svg, /id="caption-line-0"/);
  board.destroy();
});

test('fits whiteboard text before truncating and reports layout state', () => {
  const board = createBoard({ width: 320, height: 200, items: [
    { id: 'wrapped', kind: 'text', text: 'A readable whiteboard heading', position: { x: 16, y: 16 }, size: { width: 180, height: 72 }, fontSize: 22, maxLines: 3, padding: 8, textAlign: 'center', verticalAlign: 'middle' },
    { id: 'truncated', kind: 'text', text: 'A very long label that cannot fit', position: { x: 16, y: 112 }, size: { width: 80, height: 24 }, fontSize: 18, wrap: false }
  ] });
  const state = board.getState();
  assert.equal(state.layout.text[0].wrapped, true);
  assert.equal(state.layout.text[0].truncated, false);
  assert.equal(state.layout.text[1].truncated, true);
  assert.ok(board.explain().warnings.some(warning => warning.code === 'TEXT_TRUNCATED'));
  board.destroy();
});

test('keeps open arcs, filled sectors, and cubic paths distinct', () => {
  const board = createBoard({ width: 640, height: 240, items: [
    { id: 'arc', kind: 'shape', shape: 'arc', position: { x: 16, y: 16 }, size: { width: 120, height: 120 }, startAngle: 15, endAngle: 165, style: { fill: '#ffffff', stroke: '#111827', strokeWidth: 3 } },
    { id: 'sector', kind: 'shape', shape: 'sector', position: { x: 168, y: 16 }, size: { width: 120, height: 120 }, startAngle: 15, endAngle: 165, style: { fill: '#f59e0b' } },
    { id: 'curve', kind: 'path', curve: 'cubic', points: [{ x: 0, y: .5 }, { x: .25, y: 0 }, { x: .75, y: 1 }, { x: 1, y: .5 }], position: { x: 320, y: 16 }, size: { width: 160, height: 120 }, style: { fill: 'none', stroke: '#2563eb', strokeWidth: 3 } }
  ] });
  const arc = board.scene.find('arc'), sector = board.scene.find('sector'), curve = board.scene.find('curve');
  assert.equal(arc.geometry.sector, false);
  assert.equal(sector.geometry.sector, true);
  assert.equal(curve.geometry.curve, 'cubic');
  assert.match(board.export({ type: 'svg' }), / C /);
  board.destroy();
});

test('rejects arbitrary or malformed path geometry', () => {
  const result = validateBoardSpec({ width: 320, height: 200, items: [{ id: 'bad', kind: 'path', curve: 'cubic', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, d: 'M 0 0 evil' }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.path === 'items[0].points'));
});
