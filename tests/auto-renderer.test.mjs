import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, getCapabilities } from '../src/index.mjs';

test('selects SVG for small auto charts and exposes the decision', () => {
  const chart = createChart({ type: 'line', renderer: 'auto', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] });
  const state = chart.getState();
  const explanation = chart.explain();
  assert.equal(state.renderer, 'SVGRenderer');
  assert.equal(state.rendererSelection.requested, 'auto');
  assert.equal(state.rendererSelection.effective, 'svg');
  assert.equal(explanation.renderer, 'svg');
  assert.equal(explanation.requestedRenderer, 'auto');
  assert.equal(explanation.effective.renderer, 'svg');
  chart.destroy();
});

test('selects Canvas for large auto charts but keeps small interactive charts in SVG', () => {
  const large = createChart({ type: 'line', renderer: 'auto', data: Array.from({ length: 401 }, (_, index) => ({ name: `P${index}`, value: index })) });
  assert.equal(large.getState().rendererSelection.effective, 'canvas');
  assert.deepEqual(large.getState().rendererSelection.reasons, ['large-scene']);
  large.destroy();

  const interactive = createChart({ type: 'flow', renderer: 'auto', interaction: { drag: true }, nodes: [{ id: 'start', label: 'Start' }], edges: [] });
  assert.equal(interactive.getState().rendererSelection.effective, 'svg');
  assert.deepEqual(interactive.getState().rendererSelection.reasons, ['text-and-structure-heavy']);
  interactive.destroy();
});

test('keeps explicit renderer requests unchanged and publishes the auto policy', () => {
  const chart = createChart({ type: 'line', renderer: 'canvas', data: [{ name: 'A', value: 1 }] });
  assert.equal(chart.getState().renderer, 'CanvasRenderer');
  assert.deepEqual(chart.getState().rendererSelection.reasons, ['explicit-renderer']);
  assert.equal(getCapabilities().agentReliability.rendererSelection.auto, 'deterministic-at-creation');
  chart.destroy();
});
