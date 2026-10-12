import { performance } from 'node:perf_hooks';
import { createChart } from '../src/index.mjs';

const fixtures = [
  ['line-1k', 'line', 1_000],
  ['line-10k', 'line', 10_000],
  ['line-50k', 'line', 50_000],
  ['heatmap-2.5k', 'heatmap', 2_500]
];
const results = [];
for (const [name, type, count] of fixtures) {
  const data = type === 'heatmap'
    ? Array.from({ length: count }, (_, index) => ({ id: `cell-${index}`, x: `x${index % 50}`, y: `y${Math.floor(index / 50)}`, value: index % 17 }))
    : Array.from({ length: count }, (_, index) => ({ id: `row-${index}`, name: `P${index}`, value: index % 100 }));
  const started = performance.now();
  const chart = createChart({ type, renderer: 'auto', width: 960, height: 480, data: type === 'heatmap' ? data : data });
  const elapsedMs = Number((performance.now() - started).toFixed(2));
  const state = chart.getState();
  const updateStarted = performance.now();
  chart.setData(data);
  const updateMs = Number((performance.now() - updateStarted).toFixed(2));
  const resizeStarted = performance.now();
  chart.resize(800, 400);
  const resizeMs = Number((performance.now() - resizeStarted).toFixed(2));
  results.push({ name, count, elapsedMs, updateMs, resizeMs, renderer: state.rendererSelection.effective, recordCount: state.rendererSelection.recordCount, renderable: state.health.renderable });
  chart.destroy();
  if (!state.health.renderable) throw new Error(`${name}: chart is not renderable`);
  if (Math.max(elapsedMs, updateMs, resizeMs) > 5000) throw new Error(`${name}: exceeded 5000ms local lifecycle budget (${Math.max(elapsedMs, updateMs, resizeMs)}ms)`);
}
console.log(JSON.stringify({ version: '1.0', policy: 'local-smoke-budget', results }, null, 2));
