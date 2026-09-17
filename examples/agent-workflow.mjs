import { pathToFileURL } from 'node:url';
import {
  createChart,
  getCapabilities,
  getChartCapability,
  inspectData,
  planChart,
  recommend,
  validateSpec
} from '@taylorwong/ichartjs';
export const sampleRows = [
  { id: 'jan', month: 'Jan', revenue: 120, cost: 82 },
  { id: 'feb', month: 'Feb', revenue: 148, cost: 91 },
  { id: 'mar', month: 'Mar', revenue: 136, cost: 88 },
  { id: 'apr', month: 'Apr', revenue: 176, cost: 105 }
];

function buildCandidate(rows, plan, renderer) {
  const measureFields = [plan.suggestedEncodings.measure, plan.suggestedEncodings.secondaryMeasure].filter(Boolean);
  return {
    type: plan.primary,
    renderer,
    data: { values: rows },
    title: { text: `Agent plan: ${plan.intent}`, subtitle: `confidence ${plan.confidence}` },
    encoding: {
      x: { field: plan.suggestedEncodings.dimension, type: 'category' },
      y: measureFields.length === 1 ? { field: measureFields[0], type: 'quantitative' } : measureFields.map(field => ({ field, type: 'quantitative' }))
    },
    interaction: { tooltip: true, hover: true, keyboard: true },
    accessibility: { enabled: true },
    theme: {
      mode: 'auto',
      preset: plan.styleRecommendation.preset,
      palette: plan.styleRecommendation.palette
    }
  };
}

export function runAgentWorkflow(rows, options = {}) {
  const intent = options.intent || 'trend';
  const renderer = options.renderer || 'svg';
  const capabilities = getCapabilities();
  const inspection = inspectData(rows);
  const plan = planChart(rows, { intent, renderer, context: options.context || 'analysis' });

  if (plan.requiredFields.length) {
    return { ok: false, stage: 'planning', capabilitiesContract: capabilities.contractVersion, inspection, plan };
  }

  const candidate = buildCandidate(rows, plan, renderer);
  const validation = validateSpec(candidate);
  if (!validation.valid) {
    return { ok: false, stage: 'validation', capabilitiesContract: capabilities.contractVersion, inspection, plan, candidate, validation };
  }

  const chart = createChart(validation.spec);
  try {
    const explanation = chart.explain();
    const state = chart.getState();
    return {
      ok: true,
      stage: 'complete',
      capabilitiesContract: capabilities.contractVersion,
      inspection,
      plan,
      capability: getChartCapability(plan.primary),
      validation,
      explanation,
      state,
      selfCheck: {
        chartDeclared: capabilities.chartTypes.includes(plan.primary),
        recordIdsPreserved: rows.every(row => explanation.lineage.recordIds.includes(row.id)),
        warningsVisible: plan.warnings.every(warning => state.warnings.some(item => item.code === warning.code)),
        styleExplained: explanation.style?.preset === plan.styleRecommendation.preset
      },
      export: JSON.parse(chart.export({ type: 'json' }))
    };
  } finally {
    chart.destroy();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runAgentWorkflow(sampleRows);
  console.log(JSON.stringify({
    ok: result.ok,
    stage: result.stage,
    chartType: result.plan.primary,
    confidence: result.plan.confidence,
    encodings: result.explanation?.encodings,
    warnings: result.state?.warnings || result.plan.warnings,
    selfCheck: result.selfCheck
  }, null, 2));
}
