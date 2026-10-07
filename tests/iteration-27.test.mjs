import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBoard, validateBoardCommand, boardCapabilities, getCapabilities, iChart } from '../src/index.mjs';
import { createBoard as createProfileBoard, validateBoardCommand as validateProfileCommand } from '../src/board-profile.mjs';

const recipe = JSON.parse(readFileSync(new URL('../agent-recipes/boards/incremental-board.json', import.meta.url)));
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const shape = (id, extra = {}) => ({ id, kind: 'shape', shape: 'rectangle', position: { x: 120, y: 80 }, size: { width: 120, height: 80 }, style: { fill: '#2563eb' }, ...extra });
const command = operations => ({ type: 'board-edit', operations });
const fixture = extra => createBoard({ width: 800, height: 600, editing: { enabled: true, allowStructuralChanges: true }, items: [shape('anchor'), shape('locked', { locked: true, position: { x: 600, y: 400 } })], ...extra });
function commit(board, input) {
  const preview = board.previewEdit(input);
  assert.equal(preview.valid, true, JSON.stringify(preview.errors));
  const result = board.applyEdit(preview.command, { preview, confirmed: true });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(result.layout, board.getState().layout);
  return result;
}

for (const renderer of ['svg', 'canvas']) for (const [entry, create] of [['root', createBoard], ['profile', createProfileBoard]]) {
  test(`Iteration 27 ${entry}/${renderer}: sequential turns, preview isolation, history and reconstruction`, () => {
    const board = create({ ...recipe.spec, renderer });
    try {
      const positions = new Map();
      const before = board.getSpec();
      const preview = board.previewEdit(recipe.commands[0]);
      assert.equal(preview.valid, true);
      assert.deepEqual(board.getSpec(), before);
      assert.equal(board.getState().revision, 0);
      assert.equal(board.getState().history.undo, 0);
      for (const [index, turn] of recipe.commands.entries()) {
        const explicitlyMoved = new Set(turn.operations.filter(operation => operation.changes?.position).map(operation => operation.itemId));
        commit(board, turn);
        for (const item of board.getSpec().items) {
          if (positions.has(item.id) && !explicitlyMoved.has(item.id)) assert.deepEqual(item.position, positions.get(item.id));
          positions.set(item.id, item.position);
        }
        assert.equal(board.getState().revision, index + 1);
        assert.equal(board.getState().history.undo, index + 1);
        assert.equal(board.getState().renderer, renderer);
      }
      const final = board.getSpec();
      board.undo();
      assert.notDeepEqual(board.getSpec(), final);
      board.redo();
      assert.deepEqual(board.getSpec(), final);
      const reloaded = create(board.export({ type: 'json' }));
      assert.deepEqual(reloaded.getSpec(), final);
      assert.equal(reloaded.getState().history.undo, 0);
      assert.match(reloaded.export({ type: 'svg' }), /Regional delivery/);
      reloaded.destroy();
    } finally { board.destroy(); }
  });
}

test('Board command discovery and public exports are synchronized', () => {
  assert.deepEqual(boardCapabilities.incrementalBuilding, getCapabilities().canvasComposition.incrementalBuilding);
  assert.equal(iChart.validateBoardCommand, validateBoardCommand);
  assert.equal(validateProfileCommand, validateBoardCommand);
  for (const turn of recipe.commands) assert.equal(validateBoardCommand(turn).valid, true);
  assert.equal(boardCapabilities.incrementalBuilding.automaticReflow, false);
});

test('syntax rejects unknown operations, malformed batches and immutable fields', () => {
  for (const input of [null, {}, command([]), command(Array(201).fill({ op: 'removeItem', itemId: 'anchor' })), command([{ op: 'moveNode', nodeId: 'anchor' }]), command([{ op: 'addItem', value: shape('new') }]), command([{ op: 'updateItem', itemId: 'anchor', changes: { id: 'new' } }]), command([{ op: 'updateItem', itemId: 'anchor', changes: { locked: false } }]), command([{ op: 'removeItem', itemId: 'anchor', policy: 'everything' }])]) assert.equal(validateBoardCommand(input).valid, false);
});

test('default static Board rejects Agent edits without enabling interactions', () => {
  const board = createBoard();
  assert.equal(board.previewEdit(command([{ op: 'addItem', item: shape('new') }])).errors[0].code, 'EDITING_DISABLED');
  assert.deepEqual(board.getSpec().interaction, { zoom: false, pan: false, drag: false });
  board.destroy();
});

test('structural permission is independent of ordinary item updates', () => {
  const board = fixture({ editing: { enabled: true } });
  assert.equal(board.previewEdit(command([{ op: 'addItem', item: shape('new') }])).errors[0].code, 'STRUCTURAL_EDIT_DISABLED');
  commit(board, command([{ op: 'updateItem', itemId: 'anchor', changes: { style: { fill: '#ef4444' } } }]));
  assert.equal(board.getState().history.undo, 1);
  board.destroy();
});

for (const [name, operations] of [
  ['duplicate ID', [{ op: 'addItem', item: shape('anchor') }]],
  ['missing item', [{ op: 'updateItem', itemId: 'missing', changes: { opacity: .5 } }]],
  ['invalid size', [{ op: 'updateItem', itemId: 'anchor', changes: { size: { width: 3, height: 80 } } }]],
  ['missing connector endpoint', [{ op: 'addItem', item: { id: 'edge', kind: 'connector', from: 'anchor', to: 'missing' } }]],
  ['invalid embedded chart', [{ op: 'addItem', item: { ...shape('chart'), kind: 'chart', spec: { type: 'not-a-chart' } } }]],
  ['unsafe image source', [{ op: 'addAsset', asset: { id: 'asset', type: 'image', src: 'javascript:alert(1)' } }]]
]) test(`invalid final batch is atomic: ${name}`, () => {
  const board = fixture(), before = board.getSpec();
  const preview = board.previewEdit(command([{ op: 'addItem', item: shape('valid') }, ...operations]));
  assert.equal(preview.valid, false);
  assert.deepEqual(board.getSpec(), before);
  assert.equal(board.getState().revision, 0);
  assert.equal(board.getState().history.undo, 0);
  board.destroy();
});

test('final-state reference validation permits connectors before targets in the same turn', () => {
  const board = fixture();
  commit(board, command([{ op: 'addItem', item: { id: 'edge', kind: 'connector', from: 'anchor', to: 'new' } }, { op: 'addItem', item: shape('new', { position: { x: 400, y: 200 } }) }]));
  assert.equal(board.getState().history.undo, 1);
  board.destroy();
});

test('host confirmation, preview identity, command matching and stale revisions are required', () => {
  const board = fixture(), other = fixture(), turn = command([{ op: 'addItem', item: shape('new') }]);
  const preview = board.previewEdit(turn);
  assert.equal(board.applyEdit(turn, { confirmed: true }).errors[0].code, 'STALE_PREVIEW');
  assert.equal(other.applyEdit(turn, { preview, confirmed: true }).errors[0].code, 'STALE_PREVIEW');
  assert.equal(board.applyEdit(turn, { preview }).errors[0].code, 'CONFIRMATION_REQUIRED');
  assert.equal(board.applyEdit(command([{ op: 'addItem', item: shape('different') }]), { preview, confirmed: true }).errors[0].code, 'PREVIEW_COMMAND_MISMATCH');
  assert.equal(board.applyEdit(turn, { preview, confirmed: true, expectedRevision: 99 }).errors[0].code, 'STALE_PREVIEW');
  board.moveItems(['anchor'], { x: 16 });
  assert.equal(board.applyEdit(turn, { preview, confirmed: true }).errors[0].code, 'STALE_PREVIEW');
  board.destroy(); other.destroy();
});

test('caller-mutated preview content is never authoritative', () => {
  const board = fixture(), turn = command([{ op: 'addItem', item: shape('new') }]), preview = board.previewEdit(turn);
  preview.spec.items = []; preview.layout.items = [];
  const result = board.applyEdit(turn, { preview, confirmed: true });
  assert.equal(result.valid, true);
  assert.equal(board.getState().itemCount, 3);
  assert.equal(result.layout.items.length, 3);
  assert.equal(board.applyEdit(turn, { preview, confirmed: true }).valid, false);
  board.destroy();
});

test('history and out-of-band mutations invalidate issued previews', () => {
  const board = fixture(), turn = command([{ op: 'updateItem', itemId: 'anchor', changes: { opacity: .5 } }]);
  commit(board, turn);
  const preview = board.previewEdit(turn);
  board.undo();
  assert.equal(board.applyEdit(turn, { preview, confirmed: true }).valid, false);
  const current = board.previewEdit(turn);
  board.spec.items[0].position.x += 2;
  assert.equal(board.applyEdit(turn, { preview: current, confirmed: true }).errors[0].code, 'STALE_PREVIEW');
  board.destroy();
});

test('Agent updates and cascades cannot touch locked items or their assets', () => {
  const board = fixture({ assets: [{ id: 'asset', type: 'image', src: pixel, alt: 'Pixel' }], items: [shape('anchor'), shape('locked', { locked: true }), { id: 'image', kind: 'image', assetId: 'asset', locked: true, position: { x: 0, y: 0 }, size: { width: 80, height: 80 } }, { id: 'edge', kind: 'connector', from: 'anchor', to: 'locked', locked: true }] });
  for (const operation of [{ op: 'updateItem', itemId: 'locked', changes: { opacity: .5 } }, { op: 'removeItem', itemId: 'locked', policy: 'cascade' }, { op: 'removeItem', itemId: 'anchor', policy: 'cascade' }, { op: 'updateAsset', assetId: 'asset', changes: { alt: 'Changed' } }, { op: 'removeAsset', assetId: 'asset', policy: 'cascade' }]) assert.equal(board.previewEdit(command([operation])).errors[0].code, 'BOARD_ITEM_LOCKED');
  assert.equal(board.getState().revision, 0);
  board.destroy();
});

test('item removal rejects references by default and explicit cascade preserves unrelated content', () => {
  const board = fixture();
  commit(board, command([{ op: 'addItem', item: shape('target') }, { op: 'addItem', item: { id: 'edge', kind: 'connector', from: 'anchor', to: 'target' } }]));
  assert.equal(board.previewEdit(command([{ op: 'removeItem', itemId: 'target' }])).errors[0].code, 'BOARD_TARGET_REFERENCED');
  const result = commit(board, command([{ op: 'removeItem', itemId: 'target', policy: 'cascade' }]));
  assert.deepEqual(new Set(result.affectedItems), new Set(['target', 'edge']));
  assert.deepEqual(board.getSpec().items.map(item => item.id), ['anchor', 'locked']);
  board.undo(); assert.equal(board.getState().itemCount, 4);
  board.destroy();
});

test('asset creation/removal and history synchronize references and status', async () => {
  const board = fixture();
  commit(board, command([{ op: 'addAsset', asset: { id: 'asset', type: 'image', src: pixel, alt: 'Pixel' } }, { op: 'addItem', item: { id: 'image', kind: 'image', assetId: 'asset', position: { x: 360, y: 200 }, size: { width: 80, height: 80 } } }, { op: 'addItem', item: { id: 'edge', kind: 'connector', from: 'anchor', to: 'image' } }]));
  assert.equal((await board.ready()).assets[0].status, 'linked');
  assert.equal(board.previewEdit(command([{ op: 'removeAsset', assetId: 'asset' }])).errors[0].code, 'BOARD_TARGET_REFERENCED');
  commit(board, command([{ op: 'removeAsset', assetId: 'asset', policy: 'cascade' }]));
  assert.equal(board.getState().assetCount, 0);
  assert.equal(board.getState().assets.length, 0);
  assert.equal(board.getState().itemCount, 2);
  board.undo(); assert.equal(board.getState().assetCount, 1); assert.equal(board.getState().assets.length, 1);
  board.redo(); assert.equal(board.getState().assets.length, 0);
  board.destroy();
});

test('embedded ChartSpec and explicit layout changes leave other boxes and interaction settings unchanged', () => {
  const board = createBoard(recipe.spec);
  commit(board, recipe.commands[0]);
  const before = board.getSpec(), chart = before.items.find(item => item.id === 'trend');
  commit(board, command([{ op: 'updateItem', itemId: 'trend', changes: { position: { x: 80, y: 140 }, size: { width: 560, height: 300 }, spec: { ...chart.spec, theme: { mode: 'dark' }, data: { values: [{ id: 'new', name: 'New', value: 99 }] } } } }]));
  assert.deepEqual(board.getSpec().items[0], before.items[0]);
  assert.deepEqual(board.getSpec().interaction, before.interaction);
  assert.match(board.export({ type: 'svg' }), /New/);
  board.destroy();
});

test('subscribers observe only complete turns; unsubscribe and reentrant/throwing listeners are safe', () => {
  const board = fixture(), events = [], turn = command([{ op: 'addItem', item: shape('new') }]);
  const unsubscribe = board.subscribe(event => { events.push(event); event.state.layout.items = []; });
  board.subscribe(() => { throw new Error('Subscriber failed'); });
  let reentrant;
  board.subscribe(() => { reentrant = board.applyEdit(turn, { confirmed: true }); });
  board.previewEdit(turn);
  assert.equal(events.length, 0);
  commit(board, turn);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'edit');
  assert.equal(reentrant.errors[0].code, 'EDIT_IN_PROGRESS');
  assert.equal(board.getState().layout.items.length, 3);
  board.undo(); assert.equal(events[1].type, 'history');
  unsubscribe(); board.redo(); assert.equal(events.length, 2);
  board.destroy();
});

test('render failure never publishes a batch or history entry', () => {
  const board = fixture(), before = board.getSpec(), turn = command([{ op: 'addItem', item: shape('new') }]), preview = board.previewEdit(turn);
  const render = board._render;
  let renders = 0;
  board._render = () => { if (++renders === 1) throw new Error('Render failed'); };
  const result = board.applyEdit(turn, { preview, confirmed: true });
  assert.equal(result.valid, false);
  assert.deepEqual(board.getSpec(), before);
  assert.equal(board.getState().revision, 0);
  assert.equal(board.getState().history.undo, 0);
  board._render = render;
  board.destroy();
});

test('hidden items/connectors disappear from SVG and can be restored by history', () => {
  const board = fixture();
  commit(board, command([{ op: 'updateItem', itemId: 'anchor', changes: { visible: false } }, { op: 'addItem', item: { id: 'edge', kind: 'connector', from: 'anchor', to: 'locked' } }]));
  assert.equal(board.scene.find('anchor'), undefined);
  assert.equal(board.scene.find('edge'), undefined);
  board.undo(); assert.ok(board.scene.find('anchor'));
  board.destroy();
});

test('auto renderer policy is reevaluated after host changes', () => {
  const board = createBoard({ renderer: 'auto' });
  assert.equal(board.getState().renderer, 'svg');
  board.update({ items: Array.from({ length: 401 }, (_, index) => shape(`shape-${index}`)) });
  assert.equal(board.getState().renderer, 'canvas');
  board.undo(); assert.equal(board.getState().renderer, 'svg');
  board.redo(); assert.equal(board.getState().renderer, 'canvas');
  board.destroy();
});

test('async image loads cannot overwrite changed sources; failed loads, retries and deletion stay inspectable', async () => {
  const previous = globalThis.Image, requests = [];
  globalThis.Image = class { set src(value) { this.source = value; requests.push(this); } };
  const board = fixture();
  try {
    commit(board, command([{ op: 'addAsset', asset: { id: 'asset', type: 'image', src: 'old.png', alt: 'Original' } }]));
    const events = [];
    board.subscribe(event => events.push(event.type));
    const first = board.ready(), duplicate = board.ready();
    assert.equal(requests.length, 1);
    assert.equal(board.getState().assetsReady, false);
    commit(board, command([{ op: 'updateAsset', assetId: 'asset', changes: { src: 'new.png' } }]));
    const second = board.ready();
    assert.equal(requests.length, 2);
    requests[0].onload(); await first; await duplicate;
    assert.equal(board.getState().assets[0].status, 'pending');
    assert.equal(board._images.size, 0);
    requests[1].onerror(); await second;
    assert.equal(board.getState().health.status, 'degraded');
    assert.equal(board.getState().assetsReady, true);
    assert.equal(board.getState().revision, 2);
    const retry = board.ready();
    requests[2].onload(); await retry;
    assert.equal(board.getState().assets[0].status, 'loaded');
    assert.equal(board.getState().health.status, 'ready');
    assert.equal(board._images.get('asset').source, 'new.png');
    assert.ok(events.includes('assets'));
    commit(board, command([{ op: 'removeAsset', assetId: 'asset' }]));
    assert.equal(board._images.size, 0);
    board.undo();
    assert.equal(board.getState().assets[0].status, 'pending');
    const afterUndo = board.ready();
    board.destroy(); requests[3].onload(); await afterUndo;
    assert.equal(board._images.size, 0);
  } finally { board.destroy(); if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('destroyed Boards reject issued previews without reviving state', () => {
  const board = fixture(), turn = command([{ op: 'addItem', item: shape('new') }]), preview = board.previewEdit(turn);
  board.destroy();
  assert.equal(board.applyEdit(turn, { preview, confirmed: true }).errors[0].code, 'BOARD_DESTROYED');
  assert.equal(board.previewEdit(turn).errors[0].code, 'BOARD_DESTROYED');
});

test('invalid audit options are rejected before publishing', () => {
  const board = fixture(), turn = command([{ op: 'addItem', item: shape('new') }]), preview = board.previewEdit(turn);
  const actor = {}; actor.self = actor;
  const result = board.applyEdit(turn, { preview, confirmed: true, actor });
  assert.equal(result.errors[0].code, 'INVALID_EDIT_OPTIONS');
  assert.equal(board.getState().revision, 0);
  assert.equal(board.getState().itemCount, 2);
  board.destroy();
});

test('standalone Board profile rejects cross-family embedded charts before commit', () => {
  const board = createProfileBoard({ editing: { enabled: true, allowStructuralChanges: true } });
  const preview = board.previewEdit(command([{ op: 'addItem', item: { ...shape('diagram'), kind: 'chart', spec: { type: 'flow', nodes: [{ id: 'node', label: 'Node' }] } } }]));
  assert.equal(preview.valid, false);
  assert.equal(preview.errors[0].code, 'BOARD_RENDER_FAILED');
  assert.match(preview.errors[0].message, /root entry/);
  assert.equal(board.getState().revision, 0);
  board.destroy();
});

test('Freeform primitives can be built together with text without rearrangement', () => {
  const board = fixture(), before = board.getSpec().items;
  commit(board, command([
    { op: 'addItem', item: shape('arc', { shape: 'arc', startAngle: 0, endAngle: 180 }) },
    { op: 'addItem', item: shape('sector', { shape: 'sector', startAngle: 0, endAngle: 90 }) },
    { op: 'addItem', item: shape('polygon', { shape: 'polygon', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: .5, y: 1 }] }) },
    { op: 'addItem', item: { ...shape('curve'), kind: 'path', curve: 'cubic', points: [{ x: 0, y: .5 }, { x: .25, y: 0 }, { x: .75, y: 1 }, { x: 1, y: .5 }] } },
    { op: 'addItem', item: { ...shape('text'), kind: 'text', text: 'Composed one complete turn at a time', maxLines: 3 } }
  ]));
  assert.deepEqual(board.getSpec().items.slice(0, 2), before);
  assert.equal(board.getState().history.undo, 1);
  assert.ok(board.getState().layout.text.some(item => item.id === 'text'));
  assert.match(board.export({ type: 'svg' }), /id="curve"/);
  board.destroy();
});

test('removing the last item produces a reconstructable empty board and undo restores it', () => {
  const board = fixture({ items: [shape('only')] });
  commit(board, command([{ op: 'removeItem', itemId: 'only' }]));
  assert.equal(board.getState().itemCount, 0);
  assert.deepEqual(board.getState().layout.items, []);
  assert.match(board.export({ type: 'svg' }), /<svg/);
  board.undo(); assert.equal(board.getState().itemCount, 1);
  board.destroy();
});

test('Board construction labels wrap Latin words and connectors stay below content by default', () => {
  const board = createBoard(recipe.spec);
  for (const turn of recipe.commands) commit(board, turn);
  const lines = board.scene.find('insight').children.filter(node => node.type === 'text').map(node => node.geometry.text);
  assert.ok(lines.some(line => line.includes('explicitly')));
  assert.equal(board.getSpec().items.find(item => item.id === 'insight-target').zIndex, -1);
  board.destroy();
});

test('deleting an in-flight asset releases existing readiness waits without accepting stale pixels', { timeout: 2000 }, async () => {
  const previous = globalThis.Image;
  globalThis.Image = class { set src(value) { this.source = value; } };
  const board = fixture();
  try {
    commit(board, command([{ op: 'addAsset', asset: { id: 'asset', type: 'image', src: 'waiting.png', alt: 'Pending' } }]));
    const ready = board.ready();
    commit(board, command([{ op: 'removeAsset', assetId: 'asset' }]));
    assert.equal((await ready).assets.length, 0);
  } finally { board.destroy(); if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('type-specific update fields are discoverable and never silently ignored', () => {
  const board = fixture();
  assert.ok(boardCapabilities.incrementalBuilding.editableFields.itemTypes.text.includes('fontSize'));
  const preview = board.previewEdit(command([{ op: 'updateItem', itemId: 'anchor', changes: { text: 'Ignored?' } }]));
  assert.equal(preview.valid, false);
  assert.equal(preview.errors[0].code, 'UNSUPPORTED_BOARD_FIELD');
  assert.equal(board.getState().revision, 0);
  board.destroy();
});
