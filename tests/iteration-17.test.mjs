import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, getCapabilities, planChart, validateSpec } from '../src/index.mjs';

test('diagnoses unknown top-level Spec options instead of silently ignoring them', () => {
  const result = validateSpec({ type: 'line', data: [{ name: 'A', value: 1 }], renderer: 'svg', customOption: true });
  const diagnostic = result.warnings.find(warning => warning.code === 'UNKNOWN_SPEC_OPTION');
  assert.equal(diagnostic?.path, 'customOption');
  assert.match(diagnostic?.suggestion || '', /host metadata/);
});

test('surfaces effective options and normalization in Agent explanations', () => {
  const chart = createChart({ type: 'line', renderer: 'svg', title: 'Revenue', data: [{ name: 'A', value: 1 }] });
  const explanation = chart.explain();
  assert.equal(explanation.effective.renderer, 'svg');
  assert.equal(explanation.effective.title.text, 'Revenue');
  assert.ok(explanation.normalizations.some(item => item.code === 'NORMALIZED_TITLE'));
  chart.destroy();
});

test('reports unsupported renderer requests during planning', () => {
  const plan = planChart([{ name: 'A', value: 1 }], { intent: 'trend', renderer: 'webgl' });
  assert.deepEqual(plan.unsupportedRequests, ['renderer:webgl']);
  assert.ok(plan.warnings.some(warning => warning.code === 'UNSUPPORTED_RENDERER'));
  assert.ok(plan.nextActions.some(action => action.includes('Change renderer')));
});

test('publishes Agent reliability and safe default contracts', () => {
  const capabilities = getCapabilities();
  assert.equal(capabilities.agentReliability.contract.validationBeforeRender, true);
  assert.equal(capabilities.agentReliability.defaults.navigation, false);
  assert.equal(capabilities.agentReliability.defaults.editing, false);
});
