import { createChart } from './runtime.mjs';
import { downloadJSON, json, measure, pageNav, setStatus } from './playground.mjs';

document.querySelector('#nav').innerHTML = pageNav('performance-lab.html');
const host = document.querySelector('#chart'), status = document.querySelector('#status');
let charts = [], lastResult = null;
const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function rows(kind, count) {
  if (kind === 'heatmap') return Array.from({ length: count }, (_, index) => ({ id: `cell-${index}`, x: `C${index % 50}`, y: `R${Math.floor(index / 50)}`, value: (index * 37) % 101 }));
  if (kind === 'gantt') return Array.from({ length: Math.min(count, 1000) }, (_, index) => ({ id: `task-${index}`, name: `Task ${index}`, start: `2026-09-${String(index % 27 + 1).padStart(2, '0')}`, end: `2026-10-${String(index % 27 + 1).padStart(2, '0')}`, progress: (index % 100) / 100 }));
  if (kind === 'diagram') return Array.from({ length: Math.min(count, 300) }, (_, index) => ({ id: `node-${index}`, label: `Node ${index}`, position: { x: 40 + (index % 12) * 100, y: 40 + Math.floor(index / 12) * 60 } }));
  return Array.from({ length: count }, (_, index) => ({ id: `point-${index}`, name: `P${index}`, value: 50 + Math.sin(index / 12) * 30 + (index % 7) }));
}

function spec(kind, count, renderer) {
  const data = rows(kind, count), base = { renderer, width: 760, height: 360, title: { text: `${kind} · ${data.length}` }, theme: 'light', accessibility: { enabled: true } };
  if (kind === 'heatmap') return { ...base, type: 'heatmap', data, encoding: { x: { field: 'x' }, y: { field: 'y' }, color: { field: 'value' } } };
  if (kind === 'gantt') return { ...base, type: 'gantt', data };
  if (kind === 'diagram') return { ...base, type: 'flow', nodes: data, edges: data.slice(1).map((node, index) => ({ id: `edge-${index}`, from: data[index].id, to: node.id })), diagram: { layout: 'manual', routing: 'straight' } };
  return { ...base, type: kind === 'column' ? 'column' : 'line', data };
}

async function presented(label, operation) {
  const start = performance.now(), result = measure(label, operation);
  await frame();
  return { label, durationMs: result.durationMs, presentationOpportunityMs: Number((performance.now() - start).toFixed(3)) };
}

function publish(result) {
  lastResult = result; window.performanceResult = result;
  document.querySelector('#output').textContent = json(result);
}

function dispose() { charts.forEach(chart => chart.destroy()); charts = []; }

async function run() {
  dispose(); host.replaceChildren();
  const kind = document.querySelector('#kind').value, count = Number(document.querySelector('#count').value), renderer = document.querySelector('#renderer').value;
  const kinds = kind === 'dashboard' ? ['line', 'line', 'column'] : [kind];
  host.classList.toggle('multi', kinds.length > 1);
  const inputs = kinds.map(value => spec(value, count, renderer));
  const measurements = [];
  measurements.push(await presented('create', () => {
    for (const [index, input] of inputs.entries()) {
      const target = document.createElement('div'); target.className = 'lab-host'; target.id = `performance-chart-${index}`; host.append(target);
      charts.push(createChart({ ...input, width: Math.max(320, target.clientWidth), container: `#${target.id}` }));
    }
  }));
  measurements.push(await presented('update', () => charts.forEach((chart, index) => chart.update({ ...(inputs[index].nodes ? { nodes: inputs[index].nodes } : { data: inputs[index].data }) }))));
  measurements.push(await presented('resize', () => charts.forEach(chart => chart.resize(chart.getSpec().width, 320))));
  measurements.push(await presented('theme', () => charts.forEach(chart => chart.setTheme('dark'))));
  for (const type of ['svg', 'png', 'json']) {
    const result = measure(`${type}-export`, () => charts.map(chart => chart.export({ type })));
    if (result.value.some(value => typeof value !== 'string')) throw new Error(`${type} export failed.`);
    measurements.push({ label: result.label, durationMs: result.durationMs, bytes: result.value.reduce((sum, value) => sum + new TextEncoder().encode(value).length, 0), representation: type === 'png' ? 'data URL, not binary PNG bytes' : 'UTF-8 string' });
  }
  publish({ timestamp: new Date().toISOString(), policy: 'local smoke, not frame-rate certification', kind, chartCount: charts.length, requestedCountPerChart: count, actualCounts: inputs.map(input => (input.nodes || input.data).length), renderer, effectiveRenderers: charts.map(chart => chart.getState().rendererSelection.effective), measurements });
  setStatus(status, 'ready', `${charts.length} chart(s) measured`);
}

async function lifecycle() {
  dispose(); host.replaceChildren(); host.classList.remove('multi');
  const input = spec('line', 100, document.querySelector('#renderer').value);
  let maximumRemainingChildren = 0;
  const result = measure('25-create-destroy', () => {
    for (let cycle = 0; cycle < 25; cycle += 1) {
      const chart = createChart({ ...input, container: '#chart' }); chart.destroy();
      maximumRemainingChildren = Math.max(maximumRemainingChildren, host.childElementCount);
    }
  });
  await frame();
  publish({ lifecycleCycles: 25, durationMs: result.durationMs, maximumRemainingChildren, remainingChildren: host.childElementCount, remainingTooltips: document.querySelectorAll('.ichart-v2-tooltip').length });
  const leaked = maximumRemainingChildren || lastResult.remainingTooltips;
  setStatus(status, leaked ? 'error' : 'ready', leaked ? 'visible lifecycle residue' : '25 cycles clean without clearing surfaces');
}

async function execute(operation) {
  const buttons = [...document.querySelectorAll('#run,#lifecycle')]; buttons.forEach(button => { button.disabled = true; });
  setStatus(status, 'waiting', 'measuring…');
  try { await operation(); } catch (error) { setStatus(status, 'error', error.message); }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}
document.querySelector('#run').onclick = () => execute(run);
document.querySelector('#lifecycle').onclick = () => execute(lifecycle);
document.querySelector('#download').onclick = () => lastResult && downloadJSON('ichart-performance-result.json', lastResult);
window.addEventListener('pagehide', dispose);
await execute(run);
