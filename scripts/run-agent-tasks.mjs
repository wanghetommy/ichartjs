import { createBoard, createChart, inspectData, planChart, validateBoardSpec, validateSpec } from '../src/index.mjs';

function fail(message) { throw new Error(message); }
function requireValue(value, message) { if (!value) fail(message); }

function chartTask(name, rows, spec, options = {}) {
  const report = inspectData(rows);
  const plan = planChart(rows, { intent: options.intent || 'comparison' });
  if (plan.requiredFields.length) fail(`${name}: planner requires ${plan.requiredFields.join(', ')}`);
  const checked = validateSpec({ ...spec, data: { values: rows } });
  if (!checked.valid) fail(`${name}: ${JSON.stringify(checked.errors)}`);
  const chart = createChart(checked.spec);
  try {
    const state = chart.getState();
    const explanation = chart.explain();
    requireValue(state.health.renderable, `${name}: chart is not renderable`);
    requireValue(explanation.lineage.sourcePreserved, `${name}: lineage was not preserved`);
    return {
      name,
      ok: true,
      chartType: explanation.type,
      warnings: state.warnings,
      assumptions: state.assumptions,
      health: state.health,
      lineage: explanation.lineage,
      output: { kind: 'svg', bytes: chart.export({ type: 'svg' }).length },
      dataQuality: report.quality
    };
  } finally {
    chart.destroy();
  }
}

export function runAgentTasks() {
  const results = [];
  results.push(chartTask('trend', [
    { id: 'jan', month: 'Jan', revenue: 120 },
    { id: 'feb', month: 'Feb', revenue: 160 },
    { id: 'mar', month: 'Mar', revenue: 210 }
  ], { type: 'line', encoding: { x: { field: 'month' }, y: { field: 'revenue' } }, title: { text: 'Revenue trend' } }, { intent: 'trend' }));

  const partToWhole = chartTask('part-to-whole', [
    { id: 'a', name: 'A', value: 10 },
    { id: 'b', name: 'B', value: -5 },
    { id: 'c', name: 'C', value: 8 }
  ], { type: 'pie', encoding: { category: { field: 'name' }, value: { field: 'value' } }, labels: { enabled: true } }, { intent: 'part-to-whole' });
  requireValue(partToWhole.warnings.some(item => item.code === 'NEGATIVE_VALUE_DROPPED'), 'part-to-whole: negative-value diagnostic is missing');
  results.push(partToWhole);

  const timeline = chartTask('timeline', [
    { id: 'm1', title: 'Start', date: '2026-01-01' },
    { id: 'm2', title: 'Review', date: '2026-01-10' },
    { id: 'm3', title: 'Release', date: '2026-12-31' }
  ], { type: 'timeline' }, { intent: 'timeline' });
  results.push(timeline);

  const flowSpec = {
    type: 'flow',
    nodes: [
      { id: 'start', label: 'Start', kind: 'start' },
      { id: 'review', label: 'Review', kind: 'decision' },
      { id: 'done', label: 'Done', kind: 'end' }
    ],
    edges: [{ id: 'yes', from: 'review', to: 'done', label: 'Yes' }],
    editing: { enabled: true }
  };
  const flowChecked = validateSpec(flowSpec);
  requireValue(flowChecked.valid, `flow: ${JSON.stringify(flowChecked.errors)}`);
  const flow = createChart(flowChecked.spec);
  try {
    flow.selectNodes(['review']);
    const edit = flow.moveSelectedBy({ x: 12, y: 0 }, { confirmed: true, source: 'agent' });
    requireValue(edit.valid, `flow: edit failed ${JSON.stringify(edit.errors)}`);
    requireValue(flow.getState().health.renderable, 'flow: edited chart is not renderable');
    results.push({ name: 'flow-edit', ok: true, chartType: 'flow', warnings: flow.getState().warnings, health: flow.getState().health, lineage: flow.explain().lineage, output: { kind: 'svg', bytes: flow.export({ type: 'svg' }).length } });
  } finally {
    flow.destroy();
  }

  const boardSpec = validateBoardSpec({
    width: 640,
    height: 360,
    renderer: 'svg',
    items: [
      { id: 'title', kind: 'text', position: { x: 24, y: 20 }, size: { width: 240, height: 48 }, text: 'Agent delivery board' },
      { id: 'chart', kind: 'chart', position: { x: 24, y: 96 }, size: { width: 560, height: 220 }, spec: { type: 'line', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] } }
    ]
  });
  requireValue(boardSpec.valid, `board: ${JSON.stringify(boardSpec.errors)}`);
  const board = createBoard(boardSpec.spec);
  try {
    const state = board.getState();
    requireValue(state.health.renderable, 'board: board is not renderable');
    results.push({ name: 'board', ok: true, chartType: 'board', warnings: board.explain().warnings, health: state.health, output: { kind: 'svg', bytes: board.export({ type: 'svg' }).length } });
  } finally {
    board.destroy();
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = runAgentTasks();
  console.log(JSON.stringify({ version: '1.0', ok: results.every(result => result.ok), tasks: results }, null, 2));
}
