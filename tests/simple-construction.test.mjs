import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createChart, createBoard } from '../src/index.mjs';
import { createBoardComposition } from '../playground/board-composition.mjs';
import { getConstructionExample } from '../playground/simple-construction.mjs';

const composition = createBoardComposition(JSON.parse(readFileSync(new URL('../agent-recipes/logo-spec.json', import.meta.url), 'utf8')));

for (const renderer of ['svg', 'canvas']) for (const kind of ['flow', 'board']) {
  test(`Simple ${kind} ${renderer}: four confirmed turns, history and stable composition`, () => {
    const example = getConstructionExample(kind, composition);
    const runtime = (kind === 'flow' ? createChart : createBoard)({ ...example.spec, renderer });
    const initial = runtime.getSpec();
    try {
      assert.equal(example.steps.length, 4);
      const retained = new Map();
      for (const [index, step] of example.steps.entries()) {
        const before = runtime.getSpec(), preview = runtime.previewEdit(step.command);
        assert.equal(preview.valid, true, JSON.stringify(preview.errors));
        assert.deepEqual(runtime.getSpec(), before);
        const result = runtime.applyEdit(preview.command, { preview, confirmed: true });
        assert.equal(result.valid, true, JSON.stringify(result.errors));
        assert.equal(runtime.getState().history.undo, index + 1);
        const after = runtime.getSpec();
        if (kind === 'board') for (const item of after.items) {
          if (retained.has(item.id)) assert.deepEqual(item, retained.get(item.id));
          retained.set(item.id, item);
        }
        assert.notEqual(runtime.undo().valid, false);
        assert.deepEqual(runtime.getSpec(), before);
        assert.notEqual(runtime.redo().valid, false);
        assert.deepEqual(runtime.getSpec(), after);
      }
      assert.deepEqual(runtime.explain().warnings, []);
      if (kind === 'flow') {
        assert.equal(runtime.getSpec().nodes.length, 5);
        assert.equal(runtime.getSpec().edges.length, 4);
      } else {
        assert.equal(runtime.getSpec().items.length, composition.items.length);
        const original = createBoard({ ...composition, renderer, editing: example.spec.editing, interaction: example.spec.interaction });
        try {
          const byId = items => items.slice().sort((left, right) => left.id.localeCompare(right.id));
          assert.deepEqual(byId(runtime.getSpec().items), byId(original.getSpec().items));
          const layout = runtime.getState().layout, originalLayout = original.getState().layout;
          assert.deepEqual({ ...layout, items: byId(layout.items) }, { ...originalLayout, items: byId(originalLayout.items) });
          assert.equal(runtime.export({ type: 'svg' }), original.export({ type: 'svg' }));
        } finally { original.destroy(); }
      }
      for (let index = 0; index < 4; index += 1) assert.notEqual(runtime.undo().valid, false);
      assert.deepEqual(runtime.getSpec(), initial);
      assert.equal(runtime.getState().history.undo, 0);
    } finally { runtime.destroy(); }
  });
}

test('Simple construction fixtures are isolated and reject unknown kinds', () => {
  const example = getConstructionExample('flow');
  example.steps[0].command.operations[0].node.label = 'Changed';
  assert.equal(getConstructionExample('flow').steps[0].command.operations[0].node.label, 'Start');
  assert.throws(() => getConstructionExample('unknown'), /Unknown/);
  assert.throws(() => getConstructionExample('board'), /requires the original composition/);
  const board = getConstructionExample('board', composition);
  assert.deepEqual(board.steps.map(step => step.command.operations.length), [7, 3, 10, 9]);
  assert.deepEqual(board.steps.flatMap(step => step.command.operations.map(operation => operation.item.id)).sort(), composition.items.map(item => item.id).sort());
  board.steps[1].command.operations[0].item.points[0].x = 0;
  assert.equal(composition.items.find(item => item.id === 'logo-red').points[0].x, .5);
});
