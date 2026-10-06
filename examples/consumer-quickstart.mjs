import { createChart, getCapabilities, validateSpec } from '@taylorwong/ichartjs';
import { createChart as createStandardChart } from '@taylorwong/ichartjs/standard';
import { createChart as createProjectChart } from '@taylorwong/ichartjs/project';
import { createChart as createDiagramChart } from '@taylorwong/ichartjs/diagram';
import { createBoard } from '@taylorwong/ichartjs/board';

const rows = [
  { id: 'jan', month: 'Jan', revenue: 120 },
  { id: 'feb', month: 'Feb', revenue: 148 }
];

const trendSpec = {
  type: 'line',
  renderer: 'svg',
  data: { values: rows },
  encoding: { x: { field: 'month' }, y: { field: 'revenue' } }
};

function renderChart(factory, spec) {
  const checked = validateSpec(spec);
  if (!checked.valid) throw new Error(JSON.stringify(checked.errors));
  const chart = factory(checked.spec);
  const result = {
    type: chart.getState().type,
    renderable: chart.getState().health.renderable,
    svg: chart.export({ type: 'svg' }).includes('<svg'),
    lineage: chart.explain().lineage?.recordIds || []
  };
  chart.destroy();
  return result;
}

const root = renderChart(createChart, trendSpec);
const standard = renderChart(createStandardChart, trendSpec);
const project = renderChart(createProjectChart, {
  type: 'gantt',
  renderer: 'svg',
  data: { values: [{ id: 'task-1', name: 'Plan', start: '2026-01-01', end: '2026-01-03' }] }
});
const diagram = renderChart(createDiagramChart, {
  type: 'flow',
  renderer: 'svg',
  nodes: [{ id: 'start', label: 'Start', kind: 'start' }, { id: 'end', label: 'End', kind: 'end' }],
  edges: [{ id: 'edge', from: 'start', to: 'end' }]
});

const board = createBoard({ width: 240, height: 160, renderer: 'svg', items: [] });
const boardResult = { renderable: board.getState().health.renderable, svg: board.export({ type: 'svg' }).includes('<svg') };
board.destroy();

const result = {
  rootEntry: { chartTypes: getCapabilities().chartTypes.length, ...root },
  independentProfiles: { standard, project, diagram, board: boardResult }
};

if (!result.rootEntry.renderable || !result.rootEntry.svg || !result.independentProfiles.standard.renderable || !result.independentProfiles.project.renderable || !result.independentProfiles.diagram.renderable || !result.independentProfiles.board.renderable) {
  throw new Error(JSON.stringify(result));
}

console.log(JSON.stringify(result, null, 2));
