import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBoard, createChart, getCapabilities, getChartCapability, inspectData, planChart, validateBoardSpec, validateSpec } from '../src/index.mjs';

function renderChart(spec) {
  const checked = validateSpec(spec);
  assert.equal(checked.valid, true, `${spec.type} Spec is invalid: ${JSON.stringify(checked.errors)}`);
  const chart = createChart({ ...checked.spec, renderer: 'svg' });
  try {
    const state = chart.getState();
    const explanation = chart.explain();
    assert.equal(state.health.renderable, true, `${spec.type} is not renderable`);
    assert.ok(chart.export({ type: 'svg' }).includes('<svg'), `${spec.type} SVG export is missing`);
    assert.ok(chart.export({ type: 'json' }).includes('"spec"'), `${spec.type} JSON export is missing`);
    return { type: spec.type, health: state.health, warnings: state.warnings, lineage: explanation.lineage, accessibility: explanation.accessibility };
  } finally {
    chart.destroy();
  }
}

async function checkScenarios() {
  const trendRows = [
    { id: 'jan', month: 'Jan', revenue: 120 },
    { id: 'feb', month: 'Feb', revenue: 160 },
    { id: 'mar', month: 'Mar', revenue: 210 }
  ];
  const trendInspection = inspectData(trendRows);
  assert.equal(trendInspection.quality.status, 'ready');
  const trendPlan = planChart(trendRows, { intent: 'trend' });
  assert.equal(trendPlan.primary, 'line');
  const trend = renderChart({ type: 'line', data: { values: trendRows }, encoding: { x: { field: 'month' }, y: { field: 'revenue' } }, title: { text: 'Revenue trend' }, accessibility: { enabled: true, description: 'Revenue trend' } });

  const compositionRows = [{ id: 'a', name: 'A', value: 10 }, { id: 'b', name: 'B', value: -5 }, { id: 'c', name: 'C', value: 8 }];
  const compositionPlan = planChart(compositionRows, { intent: 'part-to-whole' });
  assert.equal(compositionPlan.primary, 'pie');
  const composition = renderChart({ type: 'pie', data: { values: compositionRows }, encoding: { category: { field: 'name' }, value: { field: 'value' } }, labels: { enabled: true } });
  assert.ok(composition.warnings.some(item => item.code === 'NEGATIVE_VALUE_DROPPED'));

  const project = renderChart({ type: 'gantt', data: { values: [{ id: 'plan', name: 'Plan', start: '2026-01-01', end: '2026-01-05', progress: 0.6 }] }, project: { dependencies: [] }, accessibility: { enabled: true } });
  const flow = renderChart({ type: 'flow', nodes: [{ id: 'start', label: 'Start', kind: 'start' }, { id: 'review', label: 'Review', kind: 'decision' }, { id: 'retry', label: 'Retry', kind: 'process' }, { id: 'done', label: 'Done', kind: 'end' }], edges: [{ id: 'yes', from: 'review', to: 'done', label: 'Yes' }, { id: 'no', from: 'review', to: 'retry', label: 'No' }], accessibility: { enabled: true } });

  const boardChecked = validateBoardSpec({ width: 640, height: 360, renderer: 'svg', items: [{ id: 'title', kind: 'text', position: { x: 24, y: 20 }, size: { width: 240, height: 48 }, text: 'Agent board' }, { id: 'chart', kind: 'chart', position: { x: 24, y: 96 }, size: { width: 560, height: 220 }, spec: { type: 'line', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] } }] });
  assert.equal(boardChecked.valid, true, JSON.stringify(boardChecked.errors));
  const board = createBoard(boardChecked.spec);
  let boardResult;
  try {
    const state = board.getState();
    assert.equal(state.health.renderable, true);
    assert.ok(board.export({ type: 'svg' }).includes('<svg'));
    boardResult = { type: 'board', health: state.health, warnings: board.explain().warnings };
  } finally {
    board.destroy();
  }
  return { trend: { inspect: trendInspection, plan: trendPlan, render: trend }, composition: { plan: compositionPlan, render: composition }, project, flow, board: boardResult };
}

async function checkProfiles() {
  const entries = [
    { name: 'standard', module: await import('../src/standard.mjs'), run: module => module.createChart({ type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] }) },
    { name: 'project', module: await import('../src/project-profile.mjs'), run: module => module.createChart({ type: 'gantt', renderer: 'svg', data: [{ id: 'task', name: 'Task', start: '2026-01-01', end: '2026-01-03' }] }) },
    { name: 'diagram', module: await import('../src/diagram-profile.mjs'), run: module => module.createChart({ type: 'flow', renderer: 'svg', nodes: [{ id: 'start', label: 'Start', kind: 'start' }, { id: 'end', label: 'End', kind: 'end' }], edges: [{ from: 'start', to: 'end' }] }) },
    { name: 'board', module: await import('../src/board-profile.mjs'), run: module => module.createBoard({ width: 160, height: 120, renderer: 'svg', items: [] }) }
  ];
  return entries.map(({ name, module, run }) => {
    const capabilities = module.getCapabilities();
    assert.equal(capabilities.profile, name);
    const instance = run(module);
    try {
      const state = instance.getState();
      assert.equal(state.health.renderable, true);
      assert.ok(instance.export({ type: 'svg' }).includes('<svg'));
      return { name, chartTypes: capabilities.chartTypes || [], renderable: state.health.renderable, svg: true };
    } finally {
      instance.destroy();
    }
  });
}

function checkDiagnostics() {
  const invalid = validateSpec({ type: 'line', data: [{ month: 'Jan', value: 1 }], encoding: { x: { field: 'missing' }, y: { field: 'value' } } });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors[0].code, 'MISSING_ENCODING_FIELD');
  assert.ok(invalid.errors[0].suggestion);
  const unknownIntent = planChart([{ month: 'Jan', value: 1 }], { intent: 'trend over time' });
  assert.equal(unknownIntent.fallbackUsed, true);
  assert.ok(unknownIntent.warnings.some(item => item.code === 'UNKNOWN_INTENT'));
  const unsupported = validateSpec({ type: 'pie', data: [{ name: 'A', value: 1 }], interaction: { zoom: true } });
  assert.ok(unsupported.warnings.some(item => item.code === 'UNSUPPORTED_INTERACTION'));
  return { invalid: invalid.errors, unknownIntent: unknownIntent.warnings, unsupported: unsupported.warnings };
}

function checkAccessibilityAndLocale() {
  const results = {};
  for (const locale of ['en-US', 'zh-CN']) {
    for (const theme of ['light', 'dark', 'contrast']) {
      const chart = createChart({ type: 'line', renderer: 'svg', locale, theme, title: { text: locale === 'zh-CN' ? '收入趋势' : 'Revenue trend' }, accessibility: { enabled: true, description: 'Accessible trend chart' }, data: [{ id: 'a', name: 'A', value: 1 }, { id: 'b', name: 'B', value: 2 }] });
      try {
        const state = chart.getState();
        const explanation = chart.explain();
        assert.equal(state.health.renderable, true);
        assert.equal(explanation.accessibility.enabled, true);
        assert.equal(chart.getTheme().resolvedMode, theme);
        results[`${locale}-${theme}`] = { renderable: true, accessible: true, resolvedMode: chart.getTheme().resolvedMode };
      } finally {
        chart.destroy();
      }
    }
  }
  return results;
}

async function checkDocumentationAndRecipes() {
  const [readme, quickstart, skill, manifestText] = await Promise.all([
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/agent/quickstart.md', import.meta.url), 'utf8'),
    readFile(new URL('../skills/ichartjs/SKILL.md', import.meta.url), 'utf8'),
    readFile(new URL('../agent-recipes/manifest.json', import.meta.url), 'utf8')
  ]);
  const manifest = JSON.parse(manifestText);
  assert.ok(readme.includes('npm install @taylorwong/ichartjs'));
  assert.ok(readme.includes('validateSpec'));
  assert.ok(quickstart.includes('createChart') && quickstart.includes('explain'));
  assert.ok(skill.includes('npx skills add') && skill.includes('validateSpec'));
  assert.ok(Array.isArray(manifest.entries) && manifest.entries.length > 0);
  return { install: true, workflow: true, skill: true, recipeCount: manifest.entries.length };
}

export async function runAgentAdoptionChecks() {
  const capabilities = getCapabilities();
  assert.ok(capabilities.chartTypes.length >= 18);
  assert.ok(getChartCapability('line')?.features?.export);
  return {
    version: '1.0',
    scenarios: await checkScenarios(),
    profiles: await checkProfiles(),
    diagnostics: checkDiagnostics(),
    accessibilityLocale: checkAccessibilityAndLocale(),
    documentationRecipes: await checkDocumentationAndRecipes(),
    capabilities: { chartTypes: capabilities.chartTypes.length, intents: capabilities.intents.length }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runAgentAdoptionChecks();
  console.log(JSON.stringify({ ok: true, version: report.version, scenarios: ['trend', 'composition', 'project', 'flow', 'board'], profiles: report.profiles, diagnostics: { invalid: report.diagnostics.invalid.map(item => item.code), unknownIntent: report.diagnostics.unknownIntent.map(item => item.code), unsupported: report.diagnostics.unsupported.map(item => item.code) }, accessibilityLocaleCases: Object.keys(report.accessibilityLocale).length, documentationRecipes: report.documentationRecipes, capabilities: report.capabilities }, null, 2));
}
