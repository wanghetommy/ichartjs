import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createChart, getCapabilities, validateSpec } from '../src/index.mjs';

const catalog = JSON.parse(await readFile(new URL('../agent-recipes/minimal-specs.json', import.meta.url), 'utf8'));

for (const renderer of ['svg', 'canvas']) {
  test(`minimal chart catalog renders with ${renderer}`, () => {
    const capabilities = getCapabilities();
    assert.deepEqual(Object.keys(catalog.examples).sort(), [...capabilities.chartTypes].sort());
    for (const [type, recipe] of Object.entries(catalog.examples)) {
      const validation = validateSpec({ ...structuredClone(recipe), renderer });
      assert.equal(validation.valid, true, `${type} should validate for ${renderer}`);
      const chart = createChart(validation.spec);
      const state = chart.getState();
      assert.equal(state.health.renderable, true, `${type} should be renderable for ${renderer}`);
      assert.ok(['ready', 'degraded'].includes(state.health.status), `${type} should expose a usable health status for ${renderer}`);
      assert.equal(chart.explain().type, type, `${type} explanation should preserve chart type`);
      chart.destroy();
    }
  });
}
