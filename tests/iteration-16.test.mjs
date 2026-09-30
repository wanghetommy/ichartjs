import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, createPreferencesStore, getCapabilities, getPreferenceCapabilities, validatePreferences } from '../src/index.mjs';

test('exposes effective preference precedence and change sources', () => {
  const store = createPreferencesStore({ global: { theme: { preset: 'report' } } });
  const chart = createChart({
    chartId: 'sales',
    type: 'line',
    renderer: 'svg',
    theme: { mode: 'light' },
    data: [{ name: 'A', value: 1 }],
    preferences: store
  });

  assert.deepEqual(chart.getPreferenceResolution(), {
    version: '1.0',
    precedence: ['defaults', 'spec', 'global', 'chart'],
    storage: 'memory',
    scopes: { defaults: 'runtime', spec: 'chart-spec', global: 'host', chart: null }
  });
  assert.equal(chart.getTheme().preset, 'report');

  chart.setPreferences({ theme: { mode: 'dark' } }, { source: 'agent' });
  assert.equal(chart.getState().preferenceResolution.scopes.chart, 'agent');
  assert.equal(chart.getTheme().resolvedMode, 'dark');
  chart.destroy();
});

test('publishes conversational routing and validates the same preference patch as the UI', () => {
  const capabilities = getCapabilities();
  assert.deepEqual(capabilities.conversationalWorkflow.routing, {
    visual: 'setPreferences or setTheme',
    replaceData: 'setData',
    businessData: 'previewEdit then applyEdit',
    spec: 'update',
    jsonPointer: 'applyPatch',
    diagram: 'previewEdit then applyEdit'
  });
  assert.deepEqual(getPreferenceCapabilities('line').precedence, ['defaults', 'spec', 'global', 'chart']);
  assert.equal(validatePreferences({ theme: { mode: 'dark' }, typography: { scale: 1.15 } }, { partial: true }).valid, true);
});

test('keeps repeated preference updates and destroy lifecycle stable', () => {
  const store = createPreferencesStore();
  const chart = createChart({ chartId: 'lifecycle', type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }], preferences: store });
  let renders = 0;
  chart.on('render', () => { renders += 1; });
  for (const mode of ['dark', 'light', 'contrast']) store.setChart('lifecycle', { theme: { mode } }, { source: 'agent', persist: false });
  assert.equal(chart.getTheme().resolvedMode, 'contrast');
  assert.equal(chart.getState().preferenceResolution.scopes.chart, 'agent');
  assert.ok(renders >= 3);
  chart.destroy();
  assert.doesNotThrow(() => chart.destroy());
});
