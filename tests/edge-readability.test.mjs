import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart } from '../src/index.mjs';
import { diagramPointer } from '../src/diagram-interaction.mjs';
import { routeEdgePath } from '../src/diagram.mjs';
import { estimateTextWidth, fitTextBlock } from '../src/layout.mjs';

function deliverySpec(renderer = 'svg', type = 'flow') {
  return {
    type, renderer, width: 1000, height: 420,
    nodes: [
      { id: 'start', label: 'Start', position: { x: 72, y: 150 }, ports: [{ id: 'out', side: 'right' }] },
      { id: 'review', label: 'Review', groupId: 'delivery', position: { x: 300, y: 110 }, size: { width: 150, height: 52 }, ports: [{ id: 'in', side: 'left' }, { id: 'out', side: 'right' }] },
      { id: 'qa', label: 'QA', groupId: 'delivery', position: { x: 300, y: 220 }, size: { width: 120, height: 44 }, ports: [{ id: 'in', side: 'left' }, { id: 'out', side: 'right' }] },
      { id: 'done', label: 'Done', position: { x: 570, y: 165 }, ports: [{ id: 'in', side: 'left' }] }
    ],
    edges: [
      { id: 'start-review', from: 'start', to: 'review', toPort: 'in', label: 'submit', routing: 'auto' },
      { id: 'review-qa', from: 'review', to: 'qa', fromPort: 'out', toPort: 'in', label: 'verify', routing: 'auto', lineStyle: 'dashed' },
      { id: 'qa-done', from: 'qa', to: 'done', fromPort: 'out', toPort: 'in', label: 'release', routing: 'auto' }
    ],
    groups: [{ id: 'delivery', label: 'Delivery group' }],
    ...(type === 'swimlane' ? { lanes: [{ id: 'first', label: 'First' }] } : {}),
    diagram: { layout: 'manual', routing: 'auto', grid: 8 },
    interaction: { drag: true }, editing: { enabled: true, requireConfirmation: false }
  };
}

function edgeSnapshot(chart, index) {
  const edge = chart.model.scene.find(`edge-${index}`), labels = [];
  chart.model.scene.walk(node => { if (node.type === 'text' && (node.id === `edge-label-${index}` || node.id.startsWith(`edge-label-${index}-`))) labels.push({ geometry: node.geometry, font: node.style.font }); });
  return structuredClone({ points: edge.geometry.points, body: edge.geometry.renderPoints, labels });
}

const routingCases = ['auto', 'orthogonal'].flatMap(routing => ['flow', 'architecture', 'mindmap', 'swimlane'].map(type => ({ type, routing })));
for (const { type, routing } of routingCases) {
  for (const renderer of ['svg', 'canvas']) {
    test(`${type}/${renderer}/${routing}: distant Done movement does not rearrange verify`, () => {
      const spec = deliverySpec(renderer, type);
      spec.diagram.routing = routing;
      spec.edges.forEach(edge => { edge.routing = routing; });
      if (['architecture', 'mindmap'].includes(type)) spec.nodes.forEach(node => { delete node.groupId; });
      if (type === 'mindmap') {
        spec.nodes.forEach(node => { delete node.ports; });
        spec.edges.forEach(edge => { delete edge.fromPort; delete edge.toPort; });
      }
      const chart = createChart(spec);
      try {
        const original = edgeSnapshot(chart, 1), positions = chart.getDiagramNodes().filter(node => ['review', 'qa'].includes(node.id)).map(node => node.position);
        assert.ok(original.points.every((point, index) => !index || point.x === original.points[index - 1].x || point.y === original.points[index - 1].y));
        for (const position of [{ x: 570, y: 120 }, { x: 570, y: 180 }, { x: 700, y: 80 }, { x: 600, y: 300 }]) {
          assert.equal(chart.applyEdit({ type: 'layout-edit', operations: [{ op: 'moveNode', nodeId: 'done', position }] }, { confirmed: true }).valid, true);
          assert.deepEqual(edgeSnapshot(chart, 1), original);
          assert.deepEqual(chart.getDiagramNodes().filter(node => ['review', 'qa'].includes(node.id)).map(node => node.position), positions);
          const restored = createChart(chart.getSpec());
          assert.deepEqual(edgeSnapshot(restored, 1), original);
          restored.destroy();
        }
        chart.undo();
        assert.deepEqual(edgeSnapshot(chart, 1), original);
      } finally { chart.destroy(); }
    });
  }
}

test('pointer previews and pointer release preserve the nonincident edge', () => {
  const chart = createChart(deliverySpec());
  try {
    chart._eventPoint = event => ({ x: event.clientX, y: event.clientY });
    const bounds = chart.model.scene.find('node-done').bounds, original = edgeSnapshot(chart, 1);
    const target = {}, start = { pointerId: 1, clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2 };
    diagramPointer(chart, 'start', start, target);
    for (const offset of [-10, -20, -45, -60]) {
      const event = { ...start, clientY: start.clientY + offset };
      diagramPointer(chart, 'move', event, target);
      assert.deepEqual(edgeSnapshot(chart, 1), original);
    }
    diagramPointer(chart, 'end', { ...start, clientY: start.clientY - 60 }, target);
    assert.deepEqual(edgeSnapshot(chart, 1), original);
  } finally { chart.destroy(); }
});

test('stable local routes still reroute when a moving shape actually blocks them', () => {
  const from = { x: 40, y: 80, width: 100, height: 40 }, to = { x: 400, y: 80, width: 100, height: 40 };
  const edge = { fromPortDefinition: { side: 'right' }, toPortDefinition: { side: 'left' }, grid: 8 };
  const clear = routeEdgePath(edge, from, to, 'auto');
  assert.equal(clear.points.length, 2);
  for (const shape of ['rect', 'ellipse', 'polygon']) {
    const bounds = { x: 230, y: 70, width: 80, height: 60 };
    const obstacle = { shape, bounds, geometry: shape === 'ellipse' ? { cx: 270, cy: 100, rx: 40, ry: 30 } : shape === 'polygon' ? { points: [{ x: 270, y: 70 }, { x: 310, y: 100 }, { x: 270, y: 130 }, { x: 230, y: 100 }] } : bounds };
    const rerouted = routeEdgePath({ ...edge, obstacles: [obstacle] }, from, to, 'auto');
    assert.ok(rerouted.points.length > 2);
    rerouted.points.slice(1).forEach((point, index) => {
      const previous = rerouted.points[index];
      assert.ok(point.x === previous.x || point.y === previous.y);
      for (let step = 0; step <= 100; step += 1) {
        const sample = { x: previous.x + (point.x - previous.x) * step / 100, y: previous.y + (point.y - previous.y) * step / 100 };
        assert.equal(sample.x > bounds.x && sample.x < bounds.x + bounds.width && sample.y > bounds.y && sample.y < bounds.y + bounds.height, false);
      }
    });
  }
});

function labelChart(label, renderer = 'svg', blockers = []) {
  return createChart({
    type: 'flow', renderer, width: 640, height: 340,
    nodes: [
      { id: 'source', label: 'S', position: { x: 200, y: 40 }, ports: [{ id: 'out', side: 'bottom' }] },
      { id: 'target', label: 'T', position: { x: 200, y: 180 }, ports: [{ id: 'in', side: 'top' }] },
      ...blockers
    ],
    edges: [{ id: 'link', from: 'source', to: 'target', fromPort: 'out', toPort: 'in', label }],
    diagram: { layout: 'manual', routing: 'auto' }
  });
}

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer}: vertical and short segments do not force single words onto separate lines`, () => {
    for (const label of ['verify', 'release', 'Approve internationalization deployment pipeline']) {
      const chart = labelChart(label, renderer);
      try {
        const labels = edgeSnapshot(chart, 0).labels;
        assert.equal(labels.length, 1);
        assert.equal(labels[0].geometry.text, label);
        assert.equal(labels[0].font, chart.spec.theme.typography.axis.font);
        assert.equal(chart.getState().layout.labels.diagram.wrapped, 0);
        assert.equal(chart.getState().warnings.some(warning => warning.code === 'LABEL_TRUNCATED'), false);
      } finally { chart.destroy(); }
    }
  });

  test(`${renderer}: constrained English labels wrap only at word boundaries`, () => {
    const label = 'Approve internationalization deployment pipeline';
    const chart = labelChart(label, renderer, [
      { id: 'left', label: 'Left', position: { x: 70, y: 78 }, size: { width: 88, height: 100 } },
      { id: 'right', label: 'Right', position: { x: 354, y: 78 }, size: { width: 88, height: 100 } }
    ]);
    try {
      const lines = edgeSnapshot(chart, 0).labels.map(item => item.geometry.text);
      assert.equal(lines.length, 2);
      assert.equal(lines.join(' '), label);
      const words = new Set(label.split(' '));
      assert.ok(lines.flatMap(line => line.split(' ')).every(word => words.has(word)));
      assert.equal(chart.getState().warnings.some(warning => warning.code === 'LABEL_TRUNCATED'), false);
    } finally { chart.destroy(); }
  });
}

test('word-aware text fitting shrinks or truncates an oversized word without letter wrapping', () => {
  const fitted = fitTextBlock('internationalization', { maxWidth: 105, maxHeight: 30, size: 12, minSize: 10, maxLines: 2, wordWrap: true });
  assert.equal(fitted.lines.length, 1);
  assert.equal(fitted.lines[0], 'internationalization');
  assert.equal(fitted.scaled, true);
  const truncated = fitTextBlock('internationalization', { maxWidth: 36, maxHeight: 30, size: 12, minSize: 10, maxLines: 2, wordWrap: true });
  assert.equal(truncated.lines.length, 1);
  assert.ok(truncated.lines[0].endsWith('…'));
  assert.equal(truncated.truncated, true);
  const oversized = fitTextBlock('internationalization deployment', { maxWidth: 36, maxHeight: 30, size: 12, minSize: 10, maxLines: 2, wordWrap: true });
  assert.equal(oversized.truncated, true);
  assert.ok(oversized.lines.every(line => estimateTextWidth(line, oversized.size) <= 36));
  const chinese = fitTextBlock('通过审核发布', { maxWidth: 36, maxHeight: 30, size: 12, minSize: 10, maxLines: 2, wordWrap: true });
  assert.equal(chinese.lines.join(''), '通过审核发布');
});
