import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createChart, getBusinessSchema, getCapabilities, getChartContract, getEditCapabilities, validateDiagram } from '../src/index.mjs';
import { validateCommand } from '../src/command.mjs';

const recipe = JSON.parse(fs.readFileSync(new URL('../agent-recipes/diagrams/incremental-flow.json', import.meta.url)));
const fixture = (renderer = 'svg', overrides = {}) => createChart({ ...recipe.spec, renderer, data: { schema: getBusinessSchema('flow-node'), edgeSchema: getBusinessSchema('flow-edge') }, ...overrides });
const commit = (chart, command) => {
  const preview = chart.previewEdit(command);
  assert.equal(preview.valid, true, JSON.stringify(preview.errors));
  const result = chart.applyEdit(preview.command, { preview, confirmed: true });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(chart.getState().layout.diagram, preview.layout);
  return result;
};

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer}: construction diagnostics reflect commits, history and failed publication`, () => {
    const chart = fixture(renderer);
    const assertCurrentDiagnostics = () => {
      const expected = validateDiagram(chart.getSpec()).warnings.map(warning => warning.code).sort();
      const current = chart.getState().warnings.filter(warning => warning.code.startsWith('FLOW_')).map(warning => warning.code).sort();
      assert.deepEqual(current, expected);
      assert.deepEqual(chart.explain().warnings, chart.getState().warnings);
      assert.deepEqual(chart.getState().health.issues, [...new Set(chart.getState().warnings.map(warning => warning.code))]);
    };
    try {
      assertCurrentDiagnostics();
      for (const command of recipe.commands) { commit(chart, command); assertCurrentDiagnostics(); }
      assert.ok(chart.getState().warnings.some(warning => warning.code === 'FLOW_DECISION_BRANCHES'));
      assert.equal(chart.getState().warnings.some(warning => warning.code === 'FLOW_MISSING_END'), false);
      chart.undo(); assertCurrentDiagnostics();
      assert.equal(chart.getState().warnings.some(warning => warning.code === 'FLOW_DECISION_BRANCHES'), false);
      chart.redo(); assertCurrentDiagnostics();
      const before = chart.getState(), originalRender = chart.render;
      const preview = chart.previewEdit({ type: 'layout-edit', operations: [{ op: 'updateRecord', nodeId: 'valid', changes: { kind: 'process' } }] });
      assert.equal(preview.valid, true);
      chart.render = () => { throw new Error('simulated rendering failure'); };
      try { assert.equal(chart.applyEdit(preview.command, { preview, confirmed: true }).valid, false); }
      finally { chart.render = originalRender; }
      assert.deepEqual(chart.getState(), before);
      assertCurrentDiagnostics();
    } finally { chart.destroy(); }
  });

  test(`${renderer}: ordered Agent building transactions reflow, undo, and roundtrip`, () => {
    const chart = fixture(renderer, { view: { scale: 1.3, offsetX: 18, offsetY: -7 } });
    try {
      const initial = chart.getSpec(), view = chart.getState().view;
      for (const [index, command] of recipe.commands.entries()) {
        const before = chart.getSpec(), preview = chart.previewEdit(command);
        assert.equal(preview.valid, true);
        assert.equal(preview.layout.coordinate, 'diagram');
        assert.deepEqual(chart.getSpec(), before);
        commit(chart, command);
        assert.equal(chart.getState().history.undo, index + 1);
        assert.deepEqual(chart.getState().view, view);
        assert.ok(chart.getState().edgeRoutes.every(route => route.visible));
        assert.equal(chart.getState().warnings.some(warning => ['FLOW_NODE_OVERLAP', 'FLOW_LAYOUT_OVERFLOW', 'EDGE_ROUTE_BLOCKED'].includes(warning.code)), false);
        const after = chart.getSpec();
        assert.equal(chart.undo().valid, true);
        assert.deepEqual(chart.getSpec(), before);
        assert.equal(chart.redo().valid, true);
        assert.deepEqual(chart.getSpec(), after);
      }
      assert.equal(chart.getDiagramNodes().find(node => node.id === 'review').label, 'Security review');
      assert.equal(chart.getDiagramNodes().some(node => node.id === 'retry'), false);
      const restored = createChart(chart.getSpec());
      assert.deepEqual(restored.getState().layout.diagram, chart.getState().layout.diagram);
      assert.equal(restored.getState().history.undo, 0);
      restored.destroy();
      for (let index = 0; index < recipe.commands.length; index += 1) chart.undo();
      assert.deepEqual(chart.getSpec(), initial);
    } finally { chart.destroy(); }
  });
}

test('node insertion replaces an old connection atomically and preserves prior history', () => {
  const chart = fixture();
  try {
    commit(chart, recipe.commands[0]);
    const before = chart.getSpec();
    const command = { type: 'layout-edit', operations: [
      { op: 'removeEdge', edgeId: 'start-review' },
      { op: 'addNode', node: { id: 'security', label: 'Security check' } },
      { op: 'addEdge', id: 'start-security', from: 'start', to: 'security' },
      { op: 'addEdge', id: 'security-review', from: 'security', to: 'review' }
    ] };
    commit(chart, command);
    assert.deepEqual(chart.getDiagramEdges().map(edge => edge.id), ['start-security', 'security-review']);
    assert.equal(chart.getState().history.undo, 2);
    assert.equal(chart.getState().layout.diagram.nodes.start.x < chart.getState().layout.diagram.nodes.security.x, true);
    chart.undo();
    assert.deepEqual(chart.getSpec(), before);
  } finally { chart.destroy(); }
});

for (const operations of [
  [{ op: 'addNode', node: { id: 'start', label: 'Duplicate' } }],
  [{ op: 'addNode', node: { id: 'new', label: 'New', kind: 'note' } }],
  [{ op: 'addNode', node: { id: 'new', label: 'New' } }, { op: 'addEdge', from: 'new', to: 'missing' }],
  [{ op: 'addNode', node: { id: 'new', label: 'New', ports: [{ id: 'in', side: 'invalid' }] } }],
  [{ op: 'addNode', node: { id: 'new', label: 'New', size: { width: -1, height: 20 } } }],
  [{ op: 'addNode', node: { id: 'new', label: 'New' } }, { op: 'updateRecord', nodeId: 'start', changes: { ports: [] } }],
  [{ op: 'updateRecord', nodeId: 'start', changes: { madeUp: 3 } }],
  [{ op: 'updateField', nodeId: 'start', field: 'label' }]
]) test(`invalid transaction is atomic: ${JSON.stringify(operations)}`, () => {
  const chart = fixture();
  try {
    const before = chart.getSpec(), state = chart.getState(), command = { type: 'layout-edit', operations };
    const preview = chart.previewEdit(command);
    assert.equal(preview.valid, false);
    assert.equal(chart.applyEdit(command, { confirmed: true }).valid, false);
    assert.deepEqual(chart.getSpec(), before);
    assert.deepEqual(chart.getState().history, state.history);
    assert.equal(chart.getState().revision, state.revision);
  } finally { chart.destroy(); }
});

test('structural edits require activation, issued preview, confirmation, and fresh revision', () => {
  const chart = fixture();
  try {
    const command = recipe.commands[0], preview = chart.previewEdit(command);
    assert.equal(chart.applyEdit(command, { confirmed: true }).valid, false);
    assert.equal(chart.applyEdit(command, { preview }).valid, false);
    commit(chart, { type: 'layout-edit', operations: [{ op: 'updateField', nodeId: 'start', field: 'label', value: 'Begin' }] });
    assert.equal(chart.applyEdit(command, { preview, confirmed: true }).errors[0].code, 'STALE_PREVIEW');
    chart.update({ editing: { enabled: true, allowStructuralChanges: false } });
    assert.equal(chart.previewEdit(command).errors[0].code, 'STRUCTURAL_EDIT_DISABLED');
    chart.update({ editing: { enabled: false, allowStructuralChanges: true } });
    assert.equal(chart.applyEdit(command, { confirmed: true }).errors[0].code, 'EDITING_DISABLED');
  } finally { chart.destroy(); }
});

test('connected node deletion rejects by default, cascade deletes only its incident edges', () => {
  const chart = fixture();
  try {
    for (const command of recipe.commands.slice(0, 3)) commit(chart, command);
    const before = chart.getSpec();
    const rejected = chart.previewEdit({ type: 'layout-edit', operations: [{ op: 'removeNode', nodeId: 'retry' }] });
    assert.equal(rejected.errors[0].code, 'NODE_CONNECTED');
    assert.deepEqual(chart.getSpec(), before);
    const removed = commit(chart, recipe.commands[4]);
    assert.ok(removed.affectedRecords.includes('retry-review'));
    assert.ok(removed.affectedRecords.includes('valid-retry'));
    assert.ok(chart.getDiagramEdges().some(edge => edge.id === 'qa-end'));
    assert.ok(removed.warnings.some(warning => warning.code === 'FLOW_DECISION_BRANCHES'));
    chart.undo();
    assert.deepEqual(chart.getSpec(), before);
  } finally { chart.destroy(); }
});

test('isolated nodes and the last node can be removed and undone', () => {
  const chart = fixture();
  try {
    const before = chart.getSpec();
    commit(chart, { type: 'layout-edit', operations: [{ op: 'removeNode', nodeId: 'start' }] });
    assert.equal(chart.getDiagramNodes().length, 0);
    chart.undo();
    assert.deepEqual(chart.getSpec(), before);
  } finally { chart.destroy(); }
});

test('explicit positions and saved manual routes are not discarded during structural edits', () => {
  const chart = fixture();
  try {
    chart.update({ diagram: { layout: 'layered', routing: 'auto' }, nodes: [
      { id: 'start', kind: 'start', label: 'Start', position: { x: 70, y: 150 } },
      { id: 'review', label: 'Review', position: { x: 330, y: 230 } }
    ], edges: [{ id: 'manual', from: 'start', to: 'review', routingMode: 'manual', waypoints: [{ x: 240, y: 168 }, { x: 240, y: 248 }] }] });
    const before = chart.getDiagramEdges()[0].waypoints;
    commit(chart, { type: 'layout-edit', operations: [{ op: 'addNode', node: { id: 'extra', label: 'Extra', position: { x: 650, y: 320 } } }] });
    assert.deepEqual(chart.getState().layout.diagram.nodes.start, { x: 70, y: 150, width: 112, height: 36 });
    assert.deepEqual(chart.getDiagramEdges()[0].waypoints, before);
    assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
  } finally { chart.destroy(); }
});

test('size shortage diagnoses overflow without shrinking nodes or changing the view', () => {
  const nodes = Array.from({ length: 8 }, (_, index) => ({ id: `step-${index}`, label: 'Long readable label', size: { width: 160, height: 60 } }));
  const chart = fixture('svg', { width: 360, height: 240, nodes, edges: nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id })) });
  try {
    assert.ok(chart.getState().warnings.some(warning => warning.code === 'FLOW_LAYOUT_OVERFLOW'));
    assert.equal(chart.getState().layout.diagram.nodes['step-0'].width, 160);
    assert.equal(chart.getState().view, null);
  } finally { chart.destroy(); }
});

test('explicit collisions are reported rather than overwriting positioned nodes', () => {
  const chart = fixture('svg', { nodes: [{ id: 'a', label: 'A', position: { x: 100, y: 100 } }, { id: 'b', label: 'B', position: { x: 110, y: 110 } }] });
  try { assert.ok(chart.getState().warnings.some(warning => warning.code === 'FLOW_NODE_OVERLAP')); }
  finally { chart.destroy(); }
});

test('unsupported chart targets and malformed node commands return diagnostics', () => {
  const chart = createChart({ type: 'line', data: [{ name: 'A', value: 1 }], editing: { enabled: true } });
  try { assert.equal(chart.previewEdit(recipe.commands[0]).errors[0].code, 'COMMAND_MODEL'); }
  finally { chart.destroy(); }
  for (const node of [null, {}, { id: '', label: 'A' }, { id: 'a', label: '' }]) assert.equal(validateCommand({ type: 'layout-edit', operations: [{ op: 'addNode', node }] }).valid, false);
  assert.equal(validateCommand({ type: 'layout-edit', operations: [{ op: 'removeNode', nodeId: 'a', policy: 'delete-all' }] }).valid, false);
});

test('Agent discovers the real incremental contract and preview coordinates', () => {
  const capabilities = getCapabilities(), contract = getChartContract('flow');
  assert.deepEqual(capabilities.diagram.incrementalBuilding, contract.incrementalBuilding);
  assert.equal(getEditCapabilities(getBusinessSchema('flow-node')).addNode, true);
  assert.ok(capabilities.commands.includes('removeNode'));
  assert.equal(contract.incrementalBuilding.automaticLayout.viewportChanges, false);
});

test('branch merge and loop ranks preserve forward order without overlap', () => {
  const nodes = ['start', 'split', 'yes', 'no', 'merge', 'end'].map(id => ({ id, label: id, kind: id === 'split' ? 'decision' : ['start', 'end'].includes(id) ? id : 'process', size: { width: id === 'yes' ? 180 : 112, height: id === 'yes' ? 70 : 36 } }));
  const edges = [['start', 'split'], ['split', 'yes'], ['split', 'no'], ['yes', 'merge'], ['no', 'merge'], ['merge', 'end'], ['no', 'split']].map(([from, to], index) => ({ id: `link-${index}`, from, to }));
  const chart = fixture('svg', { width: 1100, height: 560, nodes, edges });
  try {
    const boxes = chart.getState().layout.diagram.nodes;
    assert.ok(boxes.start.x < boxes.split.x);
    assert.ok(boxes.split.x < boxes.yes.x && boxes.split.x < boxes.no.x);
    assert.ok(boxes.yes.x < boxes.merge.x && boxes.no.x < boxes.merge.x);
    assert.ok(boxes.merge.x < boxes.end.x);
    assert.ok(boxes.yes.y + boxes.yes.height < boxes.no.y);
    assert.equal(chart.getState().warnings.some(warning => ['FLOW_NODE_OVERLAP', 'FLOW_LAYOUT_OVERFLOW', 'EDGE_ROUTE_BLOCKED'].includes(warning.code)), false);
    const before = chart.getState().layout.diagram;
    chart.render();
    assert.deepEqual(chart.getState().layout.diagram, before);
  } finally { chart.destroy(); }
});

for (const type of ['flow', 'swimlane', 'architecture', 'mindmap']) test(`${type}: shared node transactions validate references and preserve schema`, () => {
  const chart = createChart({ type, nodes: [{ id: 'root', label: 'Root' }], edges: [], ...(type === 'swimlane' ? { lanes: [{ id: 'lane', label: 'Lane' }] } : {}), editing: { enabled: true, allowStructuralChanges: true } });
  try {
    commit(chart, { type: 'layout-edit', operations: [{ op: 'addNode', node: { id: 'new', label: 'New' } }, { op: 'addEdge', id: 'root-new', from: 'root', to: 'new' }] });
    assert.equal(chart.getDiagramNodes().length, 2);
    commit(chart, { type: 'layout-edit', operations: [{ op: 'removeNode', nodeId: 'new', policy: 'cascade' }] });
    assert.equal(chart.getDiagramNodes().length, 1);
  } finally { chart.destroy(); }
});

test('new ports can be referenced in the same transaction; unknown ports reject atomically', () => {
  const chart = fixture();
  try {
    const command = { type: 'layout-edit', operations: [{ op: 'addNode', node: { id: 'new', label: 'New', ports: [{ id: 'in', side: 'left' }] } }, { op: 'addEdge', id: 'link', from: 'start', to: 'new', toPort: 'in' }] };
    const invalid = structuredClone(command);
    invalid.operations[1].toPort = 'missing';
    assert.equal(chart.previewEdit(invalid).valid, false);
    assert.equal(chart.getDiagramNodes().length, 1);
    commit(chart, command);
    assert.equal(chart.getDiagramEdges()[0].toPort, 'in');
  } finally { chart.destroy(); }
});

test('host cancellation cannot partially publish a structural transaction', () => {
  const chart = fixture();
  try {
    const before = chart.getSpec(), preview = chart.previewEdit(recipe.commands[0]);
    chart.on('beforeedit', event => event.preventDefault());
    assert.equal(chart.applyEdit(preview.command, { preview, confirmed: true }).errors[0].code, 'EDIT_CANCELLED');
    assert.deepEqual(chart.getSpec(), before);
    assert.equal(chart.getState().history.undo, 0);
  } finally { chart.destroy(); }
});

test('Mindmap cascade does not silently delete or orphan parent-linked children', () => {
  const chart = createChart({ type: 'mindmap', nodes: [{ id: 'root', label: 'Root' }, { id: 'child', label: 'Child', parentId: 'root' }], editing: { enabled: true, allowStructuralChanges: true } });
  try {
    const before = chart.getSpec(), preview = chart.previewEdit({ type: 'layout-edit', operations: [{ op: 'removeNode', nodeId: 'root', policy: 'cascade' }] });
    assert.equal(preview.valid, false);
    assert.ok(preview.errors.some(error => error.code === 'MISSING_PARENT'));
    assert.deepEqual(chart.getSpec(), before);
  } finally { chart.destroy(); }
});

test('a real structural blocker preserves manual waypoints and exposes fallback diagnostics', () => {
  const chart = fixture('svg', { nodes: [{ id: 'start', label: 'Start', position: { x: 70, y: 150 } }, { id: 'review', label: 'Review', position: { x: 330, y: 230 } }], edges: [{ id: 'manual', from: 'start', to: 'review', routingMode: 'manual', waypoints: [{ x: 240, y: 168 }, { x: 240, y: 248 }] }] });
  try {
    const before = chart.getDiagramEdges()[0].waypoints;
    const result = commit(chart, { type: 'layout-edit', operations: [{ op: 'addNode', node: { id: 'blocker', label: 'Blocker', position: { x: 220, y: 190 }, size: { width: 40, height: 40 } } }] });
    assert.deepEqual(chart.getDiagramEdges()[0].waypoints, before);
    assert.ok(result.warnings.some(warning => warning.code === 'EDGE_MANUAL_ROUTE_INVALID'));
    assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'auto');
  } finally { chart.destroy(); }
});
