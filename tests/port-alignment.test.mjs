import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, getBusinessSchema } from '../src/index.mjs';
import { diagramPointer, diagramKeyboard } from '../src/diagram-interaction.mjs';

function fixture(options = {}) {
  return createChart({
    type: 'flow', renderer: 'svg', width: 1000, height: 700,
    nodes: [
      { id: 'qa', label: 'QA', position: { x: 40, y: 224 }, size: { width: 120, height: 44 }, ports: [{ id: 'out', side: 'right' }] },
      { id: 'done', label: 'Done', position: { x: 360, y: 320 }, size: { width: 112, height: 36 }, ports: [{ id: 'in', side: 'left' }] }
    ],
    edges: [{ id: 'release', from: 'qa', to: 'done', fromPort: 'out', toPort: 'in' }],
    data: { schema: getBusinessSchema('flow-node'), edgeSchema: getBusinessSchema('flow-edge') },
    diagram: { layout: 'manual', routing: 'auto', grid: 8 },
    interaction: { drag: true }, editing: { enabled: true, requireConfirmation: false },
    ...options
  });
}

function beginDrag(chart, nodeId, delta, { cssScale = 1, altKey = false } = {}) {
  const bounds = chart.model.scene.find(`node-${nodeId}`).bounds;
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const view = chart.model.state.view;
  const end = { x: start.x + delta.x * view.scale, y: start.y + delta.y * view.scale };
  const target = { focus() {}, setPointerCapture() {}, hasPointerCapture() { return false; }, getBoundingClientRect() { return { width: chart.spec.width * cssScale, height: chart.spec.height * cssScale }; } };
  chart._eventPoint = event => ({ x: event.clientX, y: event.clientY });
  const pointer = point => ({ pointerId: 1, clientX: point.x, clientY: point.y, altKey });
  diagramPointer(chart, 'start', { type: 'pointerdown', button: 0, ...pointer(start) }, target);
  diagramPointer(chart, 'move', { type: 'pointermove', ...pointer(end) }, target);
  return { end(type = 'pointerup') { diagramPointer(chart, 'end', { type, ...pointer(end) }, target); } };
}

const position = (chart, nodeId) => chart.getDiagramNodes().find(node => node.id === nodeId).position;
const hasGuide = (chart, axis = 'y') => Boolean(chart.model.scene.find(`diagram-align-guide-${axis}`));

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer}: unequal heights align ports off-grid, persist and undo`, () => {
    const chart = fixture({ renderer });
    try {
      const gesture = beginDrag(chart, 'done', { x: 3, y: -96 });
      assert.equal(hasGuide(chart), true);
      assert.equal(chart.model.scene.find('edge-0').geometry.points.length, 2);
      gesture.end();
      assert.deepEqual(position(chart, 'done'), { x: 360, y: 228 });
      assert.equal(hasGuide(chart), false);
      assert.equal(chart.getState().history.undo, 1);
      chart.render();
      assert.equal(chart.model.scene.find('edge-0').geometry.points.length, 2);
      const restored = createChart(chart.getSpec());
      assert.deepEqual(position(restored, 'done'), position(chart, 'done'));
      assert.equal(restored.model.scene.find('edge-0').geometry.points.length, 2);
      restored.destroy();
      assert.equal(chart.undo().valid, true);
      assert.deepEqual(position(chart, 'done'), { x: 360, y: 320 });
      assert.equal(chart.redo().valid, true);
      assert.deepEqual(position(chart, 'done'), { x: 360, y: 228 });
      const repeated = beginDrag(chart, 'done', { x: 32, y: 3 });
      assert.equal(hasGuide(chart), true);
      repeated.end();
      assert.deepEqual(position(chart, 'done'), { x: 392, y: 228 });
    } finally { chart.destroy(); }
  });
}

test('source dragging also aligns ports, including custom offsets', () => {
  const chart = fixture();
  try {
    chart.update({ nodes: chart.getDiagramNodes().map(node => ({ ...node, ports: node.ports.map(port => ({ ...port, offset: node.id === 'qa' ? 0.25 : 0.75 })) })) });
    beginDrag(chart, 'qa', { x: 2, y: 110 }).end();
    assert.deepEqual(position(chart, 'qa'), { x: 40, y: 336 });
    assert.equal(chart.model.scene.find('edge-0').geometry.points.length, 2);
  } finally { chart.destroy(); }
});

test('vertical connections snap X with unequal widths', () => {
  const chart = fixture({
    nodes: [
      { id: 'qa', label: 'QA', position: { x: 100, y: 40 }, size: { width: 100, height: 44 }, ports: [{ id: 'out', side: 'bottom' }] },
      { id: 'done', label: 'Done', position: { x: 240, y: 280 }, size: { width: 112, height: 36 }, ports: [{ id: 'in', side: 'top' }] }
    ]
  });
  try {
    const gesture = beginDrag(chart, 'done', { x: -142, y: 3 });
    assert.equal(hasGuide(chart, 'x'), true);
    gesture.end();
    assert.deepEqual(position(chart, 'done'), { x: 94, y: 280 });
    assert.equal(chart.model.scene.find('edge-0').geometry.points.length, 2);
  } finally { chart.destroy(); }
});

for (const view of [{ scale: 0.5, offsetX: 0, offsetY: 0 }, { scale: 3, offsetX: 20, offsetY: 10 }]) {
  for (const cssScale of [0.5, 1.5]) {
    test(`6 CSS pixel tolerance with zoom ${view.scale} and CSS scale ${cssScale}`, () => {
      const chart = fixture({ view });
      try {
        const inside = 5.5 / (view.scale * cssScale);
        const gesture = beginDrag(chart, 'done', { x: 24, y: -92 + inside }, { cssScale });
        assert.equal(hasGuide(chart), true);
        gesture.end();
        assert.equal(position(chart, 'done').y, 228);
        const outside = 6.5 / (view.scale * cssScale);
        const next = beginDrag(chart, 'done', { x: 24, y: outside }, { cssScale });
        assert.equal(hasGuide(chart), false);
        next.end();
        assert.equal(position(chart, 'done').y, Math.round((228 + outside) / 8) * 8);
      } finally { chart.destroy(); }
    });
  }
}

for (const options of [{ altKey: true }, { snap: false }]) {
  test(`free movement bypasses both snap modes: ${JSON.stringify(options)}`, () => {
    const chart = fixture(options.snap === false ? { diagram: { layout: 'manual', routing: 'auto', snap: false } } : {});
    try {
      const gesture = beginDrag(chart, 'done', { x: 3, y: -94 }, options);
      assert.equal(hasGuide(chart), false);
      gesture.end();
      assert.deepEqual(position(chart, 'done'), { x: 363, y: 226 });
    } finally { chart.destroy(); }
  });
}

test('multi-selection keeps relative positions and ignores internal connections', () => {
  const chart = fixture();
  try {
    const buddy = { id: 'buddy', label: 'Buddy', position: { x: 520, y: 400 }, size: { width: 80, height: 40 } };
    chart.update({ nodes: [...chart.getDiagramNodes(), buddy] });
    chart.selectNodes(['done', 'buddy']);
    beginDrag(chart, 'done', { x: 3, y: -96 }).end();
    assert.deepEqual(position(chart, 'done'), { x: 360, y: 228 });
    assert.deepEqual(position(chart, 'buddy'), { x: 520, y: 308 });
    chart.selectNodes(['qa', 'done']);
    const gesture = beginDrag(chart, 'done', { x: 24, y: 24 });
    assert.equal(hasGuide(chart), false);
    gesture.end();
    assert.equal(position(chart, 'done').y - position(chart, 'qa').y, 4);
  } finally { chart.destroy(); }
});

for (const routing of ['manual', 'curved']) {
  test(`${routing} routes do not attract node movement`, () => {
    const chart = fixture({ edges: [{ id: 'release', from: 'qa', to: 'done', fromPort: 'out', toPort: 'in', ...(routing === 'manual' ? { routingMode: 'manual', waypoints: [{ x: 240, y: 246 }, { x: 240, y: 338 }] } : { routing: 'curved' }) }] });
    try {
      const waypoints = structuredClone(chart.getDiagramEdges()[0].waypoints);
      const gesture = beginDrag(chart, 'done', { x: 3, y: -96 });
      assert.equal(hasGuide(chart), false);
      gesture.end();
      assert.equal(position(chart, 'done').y, 224);
      if (routing === 'manual') {
        assert.equal(chart.getState().edgeRoutes[0].effectiveRoutingMode, 'manual');
        assert.deepEqual(chart.getDiagramEdges()[0].waypoints, [{ ...waypoints[0] }, { ...waypoints[1], y: 242 }]);
      } else assert.deepEqual(chart.getDiagramEdges()[0].waypoints, waypoints);
    } finally { chart.destroy(); }
  });
}

for (const kind of ['start', 'decision', 'io', 'connector']) {
  test(`${kind} nodes use bounding boxes rather than rectangle-only geometry`, () => {
    const chart = fixture();
    try {
      chart.update({ nodes: chart.getDiagramNodes().map(node => node.id === 'done' ? { ...node, kind } : node) });
      const gesture = beginDrag(chart, 'done', { x: 24, y: -94 });
      assert.equal(hasGuide(chart), true);
      gesture.end();
      assert.equal(Number.isFinite(position(chart, 'done').x), true);
      assert.equal(Number.isFinite(position(chart, 'done').y), true);
      const points = chart.model.scene.find('edge-0').geometry.points;
      assert.equal(points[0].y, points.at(-1).y);
    } finally { chart.destroy(); }
  });
}

for (const cancel of ['pointercancel', 'escape']) {
  test(`${cancel} removes guides and preserves Spec/history`, () => {
    const chart = fixture();
    try {
      const spec = chart.getSpec(), history = chart.getState().history;
      const gesture = beginDrag(chart, 'done', { x: 3, y: -96 });
      assert.equal(hasGuide(chart), true);
      if (cancel === 'escape') diagramKeyboard(chart, { key: 'Escape', preventDefault() {} });
      else gesture.end('pointercancel');
      assert.equal(hasGuide(chart), false);
      assert.deepEqual(chart.getSpec(), spec);
      assert.deepEqual(chart.getState().history, history);
    } finally { chart.destroy(); }
  });
}

test('alignment does not bypass intervening node obstacles', () => {
  const chart = fixture();
  try {
    chart.update({ nodes: [...chart.getDiagramNodes(), { id: 'obstacle', label: 'Block', position: { x: 220, y: 208 }, size: { width: 64, height: 80 } }] });
    beginDrag(chart, 'done', { x: 3, y: -96 }).end();
    assert.equal(position(chart, 'done').y, 228);
    assert.ok(chart.model.scene.find('edge-0').geometry.points.length > 2);
  } finally { chart.destroy(); }
});

test('static charts do not enable dragging or snapping implicitly', () => {
  const chart = fixture({ interaction: { drag: false } });
  try {
    const spec = chart.getSpec();
    const gesture = beginDrag(chart, 'done', { x: 3, y: -96 });
    assert.equal(hasGuide(chart), false);
    gesture.end();
    assert.deepEqual(chart.getSpec(), spec);
  } finally { chart.destroy(); }
});

for (const type of ['swimlane', 'architecture', 'mindmap']) {
  test(`${type} shares connected port snapping without changing its layout contract`, () => {
    const chart = fixture({ type, ...(type === 'swimlane' ? { lanes: [{ id: 'first', label: 'First' }] } : {}) });
    try {
      const gesture = beginDrag(chart, 'done', { x: 3, y: -96 });
      assert.equal(hasGuide(chart), true);
      gesture.end();
      assert.deepEqual(position(chart, 'done'), { x: 360, y: 228 });
      assert.equal(chart.model.scene.find('edge-0').geometry.points.length, 2);
    } finally { chart.destroy(); }
  });
}

test('implicit center ports align without adding ports to the Spec', () => {
  const chart = fixture();
  try {
    chart.update({ nodes: chart.getDiagramNodes().map(node => ({ ...node, ports: [] })), edges: [{ id: 'release', from: 'qa', to: 'done' }] });
    beginDrag(chart, 'done', { x: 3, y: -96 }).end();
    assert.equal(position(chart, 'done').y, 228);
    assert.equal(chart.model.scene.find('edge-0').geometry.points.length, 2);
    assert.deepEqual(chart.getDiagramNodes().map(node => node.ports), [[], []]);
  } finally { chart.destroy(); }
});

test('fractional sizes and offset ports stay aligned after zoom and serialization', () => {
  const chart = fixture({
    view: { scale: 1.3, offsetX: 20.2, offsetY: -10.3 },
    nodes: [
      { id: 'qa', label: 'QA', position: { x: 40.1, y: 224.3 }, size: { width: 120.4, height: 44.7 }, ports: [{ id: 'out', side: 'right', offset: 0.37 }] },
      { id: 'done', label: 'Done', position: { x: 360.3, y: 320.4 }, size: { width: 112.1, height: 36.2 }, ports: [{ id: 'in', side: 'left', offset: 0.61 }] }
    ]
  });
  try {
    const gesture = beginDrag(chart, 'done', { x: 0, y: -102.7 });
    assert.equal(hasGuide(chart), true);
    gesture.end();
    assert.equal(chart.model.scene.find('edge-0').geometry.points.length, 2);
    const restored = createChart(chart.getSpec());
    assert.deepEqual(restored.model.scene.find('edge-0').geometry.points, chart.model.scene.find('edge-0').geometry.points);
    restored.destroy();
  } finally { chart.destroy(); }
});

test('nearest connected port wins over a farther candidate', () => {
  const chart = fixture();
  try {
    chart.update({
      nodes: [...chart.getDiagramNodes(), { id: 'nearer', label: 'Nearer', position: { x: 200, y: 232 }, size: { width: 100, height: 40 }, ports: [{ id: 'out', side: 'right' }] }],
      edges: [...chart.getDiagramEdges(), { id: 'near-link', from: 'nearer', to: 'done', fromPort: 'out', toPort: 'in' }]
    });
    beginDrag(chart, 'done', { x: 24, y: -88 }).end();
    assert.equal(position(chart, 'done').y, 234);
  } finally { chart.destroy(); }
});

test('explicit ports facing away from one another do not attract', () => {
  const chart = fixture();
  try {
    chart.update({ nodes: chart.getDiagramNodes().map(node => ({ ...node, ports: node.ports.map(port => ({ ...port, side: 'right' })) })) });
    const gesture = beginDrag(chart, 'done', { x: 3, y: -96 });
    assert.equal(hasGuide(chart), false);
    gesture.end();
    assert.equal(position(chart, 'done').y, 224);
    assert.equal(chart.getDiagramNodes()[1].ports[0].side, 'right');
  } finally { chart.destroy(); }
});

test('a revision change cancels the preview rather than overwriting a newer edit', () => {
  const chart = fixture();
  try {
    const gesture = beginDrag(chart, 'done', { x: 3, y: -96 });
    assert.equal(hasGuide(chart), true);
    chart.update({ title: { text: 'Updated while dragging' } });
    gesture.end();
    assert.equal(hasGuide(chart), false);
    assert.deepEqual(position(chart, 'done'), { x: 360, y: 320 });
    assert.equal(chart.getSpec().title.text, 'Updated while dragging');
    assert.equal(chart.getState().history.undo, 0);
  } finally { chart.destroy(); }
});
