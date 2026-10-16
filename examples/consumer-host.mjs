const entrySelect = document.querySelector('#entry'), rendererSelect = document.querySelector('#renderer');
const container = document.querySelector('#chart'), wrapper = document.querySelector('#chart-wrap');
const status = document.querySelector('#status'), output = document.querySelector('#output');
const query = new URLSearchParams(location.search);
if ([...entrySelect.options].some(option => option.value === query.get('entry'))) entrySelect.value = query.get('entry');
if (query.get('renderer') === 'canvas') rendererSelect.value = 'canvas';
let chart, observer, chartTypes, request = 0, generation = 0, dark = false, revision = 0, lastAction = 'mount';

function content(entry, value) {
  if (entry === 'project') return { type: 'gantt', data: [{ id: 'plan', name: `Plan ${value}`, start: '2026-01-01', end: '2026-01-05' }, { id: 'build', name: 'Build', start: '2026-01-06', end: '2026-01-12', progress: value * 10 }] };
  if (entry === 'diagram') return { type: 'flow', nodes: [{ id: 'start', label: 'Start', kind: 'start' }, { id: 'step', label: `Build ${value}`, kind: 'process' }, { id: 'end', label: 'Done', kind: 'end' }], edges: [{ id: 'a', from: 'start', to: 'step' }, { id: 'b', from: 'step', to: 'end' }] };
  if (entry === 'board') return { items: [{ id: 'label', kind: 'text', text: `Delivery ${value}`, position: { x: 24, y: 24 }, size: { width: 200, height: 44 }, background: '#dbeafe', style: { fill: '#0f172a' } }, { id: 'box', kind: 'shape', position: { x: 40, y: 100 }, size: { width: 160, height: 100 }, style: { fill: '#2563eb' } }] };
  return { type: 'line', data: [{ id: 'jan', month: 'Jan', revenue: 120 + value }, { id: 'feb', month: 'Feb', revenue: 148 + value }, { id: 'mar', month: 'Mar', revenue: 136 + value }], encoding: { x: { field: 'month' }, y: { field: 'revenue' } } };
}

function report(action = lastAction) {
  lastAction = action;
  const state = chart.getState();
  const count = chartTypes ? `${chartTypes} chart types available · ` : '';
  status.textContent = `${count}${state.health.status} · ${action}`;
  output.textContent = JSON.stringify({ entry: entrySelect.value, renderer: rendererSelect.value, generation, request, revision, action, width: chart.getSpec().width, height: chart.getSpec().height, surfaces: container.querySelectorAll('svg,canvas').length, health: state.health }, null, 2);
}

function dispose() {
  request += 1;
  generation += 1;
  observer?.disconnect(); observer = null;
  chart?.destroy(); chart = null;
  window.consumerChart = null;
  document.querySelectorAll('.toolbar button').forEach(button => { button.disabled = true; });
}

async function mount() {
  dispose();
  const current = generation, entry = entrySelect.value;
  container.style.minWidth = entry === 'diagram' ? '560px' : '0';
  wrapper.style.overflowX = entry === 'diagram' ? 'auto' : 'hidden';
  status.textContent = 'Loading…';
  const api = await import(`@taylorwong/ichartjs${entry === 'root' ? '' : `/${entry}`}`);
  if (current !== generation) return;
  chartTypes = api.getCapabilities?.().chartTypes?.length;
  const input = { ...content(entry, revision), renderer: rendererSelect.value, width: Math.max(320, container.clientWidth), height: 320, background: dark ? '#0f172a' : '#ffffff' };
  if (entry === 'board') chart = api.createBoard(input).mount(container);
  else chart = api.createChart({ ...input, container: '#chart', theme: dark ? 'dark' : 'light' });
  window.consumerChart = chart;
  document.querySelectorAll('.toolbar button').forEach(button => { button.disabled = false; });
  if (entry === 'root') chart.on('resize', () => { if (current === generation && chart) report('parent resized'); });
  if (entry !== 'root') {
    observer = new ResizeObserver(entries => {
      const width = Math.round(entries[0]?.contentRect.width || 0);
      if (chart && current === generation && width > 0 && width !== chart.getSpec().width) {
        if (entry === 'board') chart.update({ width }); else chart.resize(width, 320);
        report('parent resized');
      }
    });
    observer.observe(container);
  }
  report('mounted');
}

async function load(value, delay) {
  const token = ++request, current = generation;
  await new Promise(resolve => setTimeout(resolve, delay));
  if (!chart || token !== request || current !== generation) return;
  chart.update(content(entrySelect.value, value)); revision = value;
  report(`data ${value} applied; stale responses ignored`);
}

async function run(action) {
  try { await action(); } catch (error) { status.textContent = `Error: ${error.message}`; }
}

entrySelect.onchange = rendererSelect.onchange = () => run(mount);
document.querySelector('#load').onclick = () => run(() => load((revision + 1) % 10, 120));
document.querySelector('#race').onclick = () => run(async () => { await Promise.all([load(1, 180), load(2, 40)]); });
document.querySelector('#size').onclick = () => { wrapper.style.width = wrapper.style.width === 'min(360px, 100%)' ? '100%' : 'min(360px, 100%)'; };
document.querySelector('#visibility').onclick = () => { wrapper.hidden = !wrapper.hidden; };
document.querySelector('#theme').onclick = () => run(() => { dark = !dark; chart.update({ background: dark ? '#0f172a' : '#ffffff', ...(entrySelect.value === 'board' ? {} : { theme: dark ? 'dark' : 'light' }) }); report('theme switched'); });
document.querySelector('#reject').onclick = () => run(() => {
  const before = JSON.stringify(chart.getSpec());
  try { chart.update({ renderer: 'invalid', background: '#abcdef' }); }
  catch (error) { if (before !== JSON.stringify(chart.getSpec())) throw new Error('Rejected update changed the Spec.'); report('invalid update rejected; Spec unchanged'); }
});
document.querySelector('#remount').onclick = () => run(mount);
for (const type of ['svg', 'png', 'jpeg', 'json']) document.querySelector(`#${type}`).onclick = () => run(() => {
  const value = chart.export({ type, as: 'blob' });
  if (!(value instanceof Blob)) throw new Error(value.message || 'Export failed.');
  const link = document.createElement('a'), url = URL.createObjectURL(value);
  link.href = url; link.download = `consumer.${type}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  report(`${type.toUpperCase()} exported; ${value.size} bytes; display unchanged`);
});
window.addEventListener('pagehide', dispose);
window.hostDemo = { mount, load, dispose, get revision() { return revision; } };
await run(mount);
