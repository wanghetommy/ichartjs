import { createChart, getCapabilities, mountChartSettings } from './runtime.mjs';
import { runtimeVersion } from './playground.mjs';

const charts = [];
const base = { renderer: 'svg', accessibility: { enabled: true }, interaction: { tooltip: true, hover: true, keyboard: true }, editing: { enabled: false }, branding: { enabled: false }, theme: { mode: 'light', preset: 'presentation', palette: 'categorical', typography: { axis: { size: 10, font: '450 10px system-ui, sans-serif' }, legend: { size: 10, font: '550 10px system-ui, sans-serif' } } }, locale: 'en-US' };

const specs = {
  trend: { ...base, type: 'line', renderer: 'svg', width: 560, height: 220, legend: { visible: false }, data: [{ id: 'jan', name: 'Jan', value: 22 }, { id: 'feb', name: 'Feb', value: 31 }, { id: 'mar', name: 'Mar', value: 27 }, { id: 'apr', name: 'Apr', value: 43 }, { id: 'may', name: 'May', value: 51 }, { id: 'jun', name: 'Jun', value: 64 }], title: { text: 'Adoption trend', subtitle: 'Agent-ready chart planning' }, labels: { enabled: false } },
  mix: { ...base, type: 'pie', renderer: 'canvas', width: 320, height: 190, padding: { top: 12, right: 12, bottom: 18, left: 12 }, legend: { visible: false }, data: [{ id: 'product', name: 'Product', value: 48 }, { id: 'service', name: 'Service', value: 32 }, { id: 'other', name: 'Other', value: 20 }], labels: { enabled: true, format: { style: 'percent' } }, innerRadius: .52 },
  delivery: { ...base, type: 'gantt', renderer: 'svg', width: 420, height: 190, padding: { top: 30, right: 20, bottom: 72, left: 24 }, theme: { ...base.theme, typography: { axis: { size: 10, font: '450 10px system-ui, sans-serif' }, legend: { size: 10, font: '550 10px system-ui, sans-serif' } } }, data: [{ id: 'discover', name: 'Discover', start: '2026-09-01', end: '2026-09-05', progress: 1 }, { id: 'build', name: 'Build', start: '2026-09-06', end: '2026-09-15', progress: .72, dependencies: ['discover'] }, { id: 'verify', name: 'Verify', start: '2026-09-16', end: '2026-09-20', progress: .35, dependencies: ['build'] }], title: { text: 'Delivery plan' } },
  architecture: { ...base, type: 'architecture', renderer: 'svg', width: 600, height: 220, theme: { ...base.theme, typography: { title: { size: 14 }, subtitle: { size: 9 }, axis: { size: 10, font: '450 10px system-ui, sans-serif' }, label: { size: 9 }, legend: { size: 10, font: '550 10px system-ui, sans-serif' } } }, layers: [{ id: 'experience', label: 'Experience' }, { id: 'runtime', label: 'Runtime' }, { id: 'data', label: 'Data' }], nodes: [{ id: 'agent', label: 'Agent', layerId: 'experience' }, { id: 'charts', label: 'iChart.js', layerId: 'runtime' }, { id: 'records', label: 'Records', layerId: 'data' }], edges: [{ id: 'agent-charts', from: 'agent', to: 'charts', relation: 'plans' }, { id: 'records-charts', from: 'records', to: 'charts', relation: 'feeds' }], diagram: { mode: 'architecture', layout: 'layered', routing: 'orthogonal' } }
};

function setHealth(id, chart) {
  const target = document.querySelector(`#${id}-health`), state = chart.getState();
  target.textContent = state.health.status === 'ready' ? 'ready' : state.health.status;
  target.classList.toggle('warn', state.health.status !== 'ready');
}

function mount(id) {
  const chart = createChart({ ...specs[id], container: `#${id}-chart` });
  charts.push(chart);
  setHealth(id, chart);
  if (id === 'trend' || id === 'delivery') mountChartSettings(chart, { locale: 'en-US', title: 'Chart settings', placement: 'auto' });
  return chart;
}

const capabilities = getCapabilities();
document.querySelector('#version').textContent = `Runtime ${runtimeVersion}`;
document.querySelector('#chart-count').textContent = capabilities.chartTypes.length;
Object.keys(specs).forEach(mount);

const stages = [
  ['Inspect data', 'Machine-readable by design'],
  ['Plan chart', 'Intent-aware selection'],
  ['Validate Spec', 'Warnings stay visible'],
  ['Render & explain', 'Trust the output'],
  ['Switch theme', 'Live visual styling']
];
const chartIds = ['trend', 'mix', 'delivery', 'architecture'];
const themeVariants = {
  trend: { mode: 'dark', preset: 'presentation', palette: 'categorical', tokens: { background: '#0f172a', surface: '#172033', colors: ['#60a5fa', '#93c5fd', '#2563eb'] } },
  mix: { mode: 'dark', preset: 'presentation', palette: 'categorical', tokens: { background: '#1e1b4b', surface: '#312e81', colors: ['#c084fc', '#38bdf8', '#2dd4bf'] } },
  delivery: { mode: 'contrast', preset: 'presentation', palette: 'categorical', typography: { axis: { size: 10, font: '450 10px system-ui, sans-serif' }, legend: { size: 10, font: '550 10px system-ui, sans-serif' } }, tokens: { background: '#111827', surface: '#111827', colors: ['#f59e0b', '#22d3ee', '#f43f5e'], status: { danger: '#f59e0b' } } },
  architecture: { mode: 'dark', preset: 'presentation', palette: 'categorical', typography: { axis: { size: 10, font: '450 10px system-ui, sans-serif' }, legend: { size: 10, font: '550 10px system-ui, sans-serif' } }, tokens: { background: '#2e1065', surface: '#4c1d95', colors: ['#f472b6', '#c084fc', '#60a5fa'] } }
};
let current = 0;
let timer;
function activateStage(index) {
  current = index;
  charts.forEach((chart, chartIndex) => chart.setTheme(index === 4 ? themeVariants[chartIds[chartIndex]] : base.theme));
  document.querySelectorAll('[data-step]').forEach(item => { const active = Number(item.dataset.step) === current; item.classList.toggle('active', active); item.setAttribute('aria-current', active ? 'step' : 'false'); });
  document.querySelector('#workflow-caption').textContent = stages[current][1];
  document.querySelectorAll('[data-card]').forEach(item => item.dataset.active = item.dataset.card === chartIds[current] ? 'true' : 'false');
}
function selectStage(index, manual = false) { if (manual && timer) { clearInterval(timer); timer = null; } activateStage(index); }
document.querySelectorAll('[data-step]').forEach(item => {
  const select = () => selectStage(Number(item.dataset.step), true);
  item.addEventListener('click', select);
  item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
});
activateStage(0);
timer = setInterval(() => activateStage((current + 1) % stages.length), 2200);
window.addEventListener('pagehide', () => { clearInterval(timer); charts.forEach(chart => chart.destroy()); });
