import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createBoard, getCapabilities, planCanvas, validateBoardSpec } from '../src/index.mjs';
import logoSpec from '../agent-recipes/logo-spec.json' with { type: 'json' };

const image = { id: 'hero', type: 'image', src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Example image', mime: 'image/png' };

test('validates and renders the complete Freeform Board Playground example', () => {
  const html = readFileSync(new URL('../playground/canvas-board.html', import.meta.url), 'utf8');
  const declarations = html.slice(html.indexOf('const logoItems='), html.indexOf('let board;'));
  const spec = runInNewContext(`${declarations}\nJSON.stringify(spec);`, { logoSpec });
  const validation = validateBoardSpec(JSON.parse(spec));
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  const board = createBoard(validation.spec);
  const svg = board.export({ type: 'svg' });
  assert.match(svg, /logo-yellow/);
  assert.doesNotMatch(svg, /logo-hole/);
  const logos = ['logo-red', 'logo-blue', 'logo-yellow'].map(id => validation.spec.items.find(item => item.id === id));
  const lengths = item => item.points.map((point, index) => {
    const next = item.points[(index + 1) % item.points.length];
    return Math.hypot((next.x - point.x) * item.size.width, (next.y - point.y) * item.size.height);
  });
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  for (const logo of logos) {
    assert.equal(logo.points.length, 4);
    const vectors = logo.points.map((point, index) => { const next = logo.points[(index + 1) % 4]; return { x: next.x - point.x, y: next.y - point.y }; });
    assert.ok(Math.abs(cross(vectors[0], vectors[2])) < 1e-8);
    assert.ok(Math.abs(cross(vectors[1], vectors[3])) < 1e-8);
    lengths(logo).forEach((length, index) => assert.ok(Math.abs(length - lengths(logos[0])[index]) < 1e-8));
    assert.deepEqual(logo.points, logoSpec.items.find(item => item.id === logo.id).points);
  }
  assert.equal(validation.spec.items.some(item => item.id === 'edge-chart'), false);
  const cardIndex = svg.indexOf('id="charts-card"');
  for (const chartId of ['line', 'bar', 'area']) {
    assert.ok(svg.indexOf(`id="${chartId}"`) > cardIndex);
    const group = board.scene.find(chartId);
    assert.ok(group.children.some(node => node.id.includes('series-')));
    assert.equal(board.scene.root.children.some(node => node.id.startsWith(`${chartId}-series-`)), false);
  }
  assert.match(svg, /animal-face/);
  board.destroy();
});

test('publishes the reusable iChart.js logo recipe as three congruent parallelograms', () => {
  const result = validateBoardSpec(logoSpec);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(logoSpec.items.length, 3);
  assert.ok(logoSpec.items.every(item => item.points.length === 4));
  assert.deepEqual(logoSpec.items.map(item => item.size), [{ width: 120, height: 120 }, { width: 120, height: 120 }, { width: 120, height: 120 }]);
});

test('logo tiles a regular hexagon with six equal edges and three parallel opposite pairs', () => {
  const vertices = [...new Map(logoSpec.items.flatMap(item => item.points).map(point => [JSON.stringify(point), point])).values()];
  const center = vertices.find(point => point.x === 0.5 && point.y === 0.5);
  const outline = vertices.filter(point => point !== center).sort((a, b) => Math.atan2(a.y - 0.5, a.x - 0.5) - Math.atan2(b.y - 0.5, b.x - 0.5));
  assert.equal(outline.length, 6);
  const edges = outline.map((point, index) => {
    const next = outline[(index + 1) % 6];
    return { x: next.x - point.x, y: next.y - point.y };
  });
  edges.forEach((edge, index) => {
    const opposite = edges[(index + 3) % 6];
    assert.ok(Math.abs(edge.x + opposite.x) < 1e-10);
    assert.ok(Math.abs(edge.y + opposite.y) < 1e-10);
    assert.ok(Math.abs(Math.hypot(edge.x, edge.y) - 0.42) < 1e-10);
  });
  const area = points => Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - point.y * next.x;
  }, 0)) / 2;
  assert.ok(Math.abs(area(outline) - logoSpec.items.reduce((sum, item) => sum + area(item.points), 0)) < 1e-10);
  const samePoint = (first, second) => first.x === second.x && first.y === second.y;
  for (const vertex of outline) {
    const next = outline[(outline.indexOf(vertex) + 1) % 6];
    assert.ok(logoSpec.items.some(item => item.points.some((point, index) => {
      const endpoint = item.points[(index + 1) % 4];
      return samePoint(point, vertex) && samePoint(endpoint, next) || samePoint(point, next) && samePoint(endpoint, vertex);
    })));
  }
  const promo = readFileSync(new URL('../playground/github-promo.mjs', import.meta.url), 'utf8');
  assert.match(promo, /import logoSpec from '\.\.\/agent-recipes\/logo-spec\.json'/);
});

test('validates a board contract and reports image accessibility warnings', () => {
  const result = validateBoardSpec({ assets: [{ ...image, alt: '' }], items: [{ id: 'image', kind: 'image', assetId: 'hero', position: { x: 0, y: 0 }, size: { width: 160, height: 100 } }] });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some(warning => warning.code === 'IMAGE_ALT_MISSING'));
  assert.deepEqual(getCapabilities().canvasComposition.renderers, ['svg', 'canvas', 'auto']);
});

test('creates a headless SVG board with image, shape, text, and connector items', () => {
  const board = createBoard({ width: 640, height: 360, assets: [image], items: [
    { id: 'image', kind: 'image', assetId: 'hero', position: { x: 24, y: 24 }, size: { width: 120, height: 80 } },
    { id: 'shape', kind: 'shape', shape: 'diamond', position: { x: 220, y: 24 }, size: { width: 120, height: 80 }, style: { fill: '#dbeafe', stroke: '#2563eb' } },
    { id: 'text', kind: 'text', text: 'Inspect', position: { x: 40, y: 140 }, size: { width: 120, height: 32 } },
    { id: 'edge', kind: 'connector', from: 'image', to: 'shape', routing: 'orthogonal' }
  ]});
  const svg = board.export({ type: 'svg' });
  assert.match(svg, /<image/);
  assert.match(svg, /Inspect/);
  assert.match(svg, /data-node-id="edge"/);
  assert.equal(board.getState().renderer, 'svg');
  board.destroy();
});

test('supports embedded charts, explicit static editing, and history', () => {
  const board = createBoard({ width: 800, height: 480, editing: { enabled: true }, items: [{ id: 'chart', kind: 'chart', position: { x: 20, y: 20 }, size: { width: 400, height: 240 }, spec: { type: 'line', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] } }] });
  board.select(['chart']);
  board.moveItems(['chart'], { x: 30, y: 20 });
  assert.equal(board.getState().history.undo, 1);
  board.undo();
  assert.equal(board.getSpec().items[0].position.x, 20);
  board.redo();
  assert.equal(board.getSpec().items[0].position.x, 50);
  board.destroy();
});

test('plans a simple canvas composition without changing the supplied item semantics', () => {
  const result = planCanvas([{ kind: 'text', text: 'A', size: { width: 100, height: 32 } }, { kind: 'shape', shape: 'ellipse' }], { width: 640, height: 360 });
  assert.equal(result.valid, true);
  assert.equal(result.spec.items.length, 2);
  assert.ok(result.nextActions.length > 0);
});

test('renders the declared grid variant instead of silently treating every grid as lines', () => {
  const board = createBoard({ width: 320, height: 200, grid: { visible: true, variant: 'dots', size: 32 }, items: [] });
  assert.match(board.export({ type: 'svg' }), /grid-32-32/);
  board.destroy();
});
