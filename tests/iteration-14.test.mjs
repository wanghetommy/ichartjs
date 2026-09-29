import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, getCapabilities, normalizeSpec, validateSpec } from '../src/index.mjs';
import { buildProjectScene } from '../src/project.mjs';

const semanticFlow = {
  type: 'flow',
  renderer: 'svg',
  nodes: [
    { id: 'start', kind: 'start', label: 'Start' },
    { id: 'load', kind: 'process', label: 'Load' },
    { id: 'check', kind: 'decision', label: 'Valid?' },
    { id: 'output', kind: 'io', label: 'Output' },
    { id: 'jump', kind: 'connector', label: 'Retry' },
    { id: 'end', kind: 'end', label: 'End' }
  ],
  edges: [
    { id: 'start-load', from: 'start', to: 'load' },
    { id: 'load-check', from: 'load', to: 'check' },
    { id: 'check-yes', from: 'check', to: 'output', label: 'yes' },
    { id: 'check-no', from: 'check', to: 'jump', label: 'no' },
    { id: 'jump-load', from: 'jump', to: 'load' },
    { id: 'output-end', from: 'output', to: 'end' }
  ]
};

test('exposes lightweight Flow semantics through capabilities', () => {
  const capabilities = getCapabilities();
  assert.deepEqual(capabilities.diagram.flowNodeKinds, ['start', 'end', 'process', 'decision', 'io', 'connector']);
  assert.equal(capabilities.diagram.flowBranchEdges.label, 'edge.label');
  assert.equal(capabilities.diagram.flowLoops, 'supported');
  assert.equal(capabilities.charts.flow.features['semantic-shapes'], 'supported');
  assert.equal(capabilities.charts.flow.features.connectors, 'supported');
});

test('validates Flow decisions, loops, and connectors without rejecting cycles', () => {
  const validation = validateSpec(semanticFlow);
  assert.equal(validation.valid, true);
  assert.equal(validation.warnings.some(warning => warning.code === 'FLOW_DECISION_BRANCHES'), false);
  assert.equal(validation.warnings.some(warning => warning.code === 'FLOW_MISSING_START'), false);
  assert.equal(validation.warnings.some(warning => warning.code === 'FLOW_MISSING_END'), false);

  const unknown = validateSpec({ ...semanticFlow, nodes: [{ id: 'bad', kind: 'gateway', label: 'Bad' }] });
  assert.equal(unknown.valid, false);
  assert.equal(unknown.errors.find(error => error.code === 'FLOW_NODE_KIND').path, 'nodes.0.kind');

  const incomplete = validateSpec({ type: 'flow', nodes: [{ id: 'check', kind: 'decision', label: 'Check' }] });
  assert.ok(incomplete.warnings.some(warning => warning.code === 'FLOW_DECISION_BRANCHES'));
  assert.ok(incomplete.warnings.some(warning => warning.code === 'FLOW_MISSING_START'));
  assert.ok(incomplete.warnings.some(warning => warning.code === 'FLOW_MISSING_END'));
});

for (const renderer of ['svg', 'canvas']) {
  test(`renders semantic Flow shapes with ${renderer}`, () => {
    const chart = createChart({ ...structuredClone(semanticFlow), renderer });
    const nodes = [];
    chart.model.scene.walk(node => nodes.push(node));
    const semanticNodes = nodes.filter(node => node.dataRef?.kind);
    assert.deepEqual(semanticNodes.map(node => node.dataRef.kind), ['start', 'process', 'decision', 'io', 'connector', 'end']);
    assert.equal(semanticNodes.find(node => node.dataRef.kind === 'start').type, 'path');
    assert.equal(semanticNodes.find(node => node.dataRef.kind === 'decision').type, 'path');
    assert.equal(semanticNodes.find(node => node.dataRef.kind === 'io').type, 'path');
    assert.equal(semanticNodes.find(node => node.dataRef.kind === 'connector').type, 'circle');
    assert.equal(chart.getState().health.renderable, true);
    assert.equal(chart.explain().type, 'flow');
    chart.destroy();
  });
}

test('defaults unspecified Flow nodes to process rectangles', () => {
  const chart = createChart({ type: 'flow', renderer: 'svg', nodes: [{ id: 'legacy', label: 'Legacy' }], edges: [] });
  const node = chart.model.scene.find('node-legacy');
  assert.equal(node.type, 'rect');
  assert.equal(node.dataRef.kind, 'process');
  chart.destroy();
});

test('centers diagram labels, bounds compact text, and centers Swimlane nodes', () => {
  const flow = createChart({
    type: 'flow',
    renderer: 'svg',
    width: 560,
    height: 300,
    nodes: [
      { id: 'wide', kind: 'process', label: 'A deliberately long process label', size: { width: 72, height: 36 }, position: { x: 80, y: 100 } },
      { id: 'small', kind: 'connector', label: 'Retry', size: { width: 28, height: 28 }, position: { x: 220, y: 100 } }
    ],
    edges: []
  });
  const wideNode = flow.model.scene.find('node-wide'), wideLabels = [];
  flow.model.scene.walk(item => { if (item.id?.startsWith('node-label-wide')) wideLabels.push(item); });
  assert.ok(wideLabels.length >= 1);
  assert.equal((wideLabels[0].geometry.y + wideLabels.at(-1).geometry.y) / 2, wideNode.geometry.y + wideNode.geometry.height / 2);
  assert.equal(wideLabels[0].style.textBaseline, 'middle');
  assert.notEqual(wideLabels.map(item => item.geometry.text).join(''), 'A deliberately long process label');
  assert.equal(flow.model.scene.find('node-label-small'), undefined);
  flow.destroy();

  const swimlane = buildProjectScene(normalizeSpec({
    type: 'swimlane',
    renderer: 'svg',
    width: 560,
    height: 300,
    lanes: [{ id: 'product', label: 'Product' }, { id: 'agent', label: 'Agent' }],
    nodes: [{ id: 'request', label: 'Request', laneId: 'product' }, { id: 'plan', label: 'Plan', laneId: 'agent' }],
    edges: []
  }));
  const lane = swimlane.scene.find('lane-0'), node = swimlane.scene.find('node-request');
  assert.equal(node.geometry.y + node.geometry.height / 2, lane.geometry.y + lane.geometry.height / 2);
});
