/**
 * Machine-readable chart capabilities and deterministic Agent planning.
 */
import { inspectData } from './data.mjs';
import { planStyle, styleCapabilities } from './theme.mjs';

export const chartTypes = ['line', 'area', 'bar', 'column', 'pie', 'scatter', 'funnel', 'gauge', 'heatmap', 'radar', 'gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane'];

const cartesian = ['line', 'area', 'bar', 'column', 'scatter'];
const project = ['gantt', 'timeline', 'milestone', 'burndown'];
const diagrams = ['flow', 'swimlane'];
const status = (supported, notApplicable = []) => Object.fromEntries(supported.map(name => [name, 'supported']).concat(notApplicable.map(name => [name, 'not-applicable'])));
const commonPresentation = ['title', 'subtitle', 'theme', 'responsive', 'empty-state', 'invalid-data-state', 'export', 'branding'];

const definitions = {
  line: { family: 'cartesian', intents: ['trend', 'time-series'], required: ['dimension', 'measure'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'crosshair', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'legend', 'labels', 'formatting', 'multi-series', 'dual-axis']) },
  area: { family: 'cartesian', intents: ['trend', 'composition'], required: ['dimension', 'measure'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'crosshair', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'legend', 'labels', 'formatting', 'multi-series', 'stacked', 'percent-stacked']) },
  bar: { family: 'cartesian', intents: ['comparison', 'ranking'], required: ['dimension', 'measure'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'legend', 'labels', 'formatting', 'multi-series', 'stacked', 'percent-stacked']) },
  column: { family: 'cartesian', intents: ['comparison', 'distribution', 'composition'], required: ['dimension', 'measure'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'legend', 'labels', 'formatting', 'multi-series', 'stacked', 'percent-stacked', 'mixed-line-column', 'dual-axis', 'bin']) },
  pie: { family: 'part-to-whole', intents: ['part-to-whole'], required: ['dimension', 'measure'], optional: [], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'legend', 'labels', 'formatting', 'donut', 'zero-total'], ['axes', 'grid', 'zoom', 'pan']) },
  scatter: { family: 'cartesian', intents: ['relationship', 'correlation'], required: ['measure', 'measure'], optional: ['dimension'], interactions: ['hover', 'tooltip', 'selection', 'brush', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'labels', 'formatting'], ['stacked']) },
  funnel: { family: 'stage', intents: ['funnel', 'conversion'], required: ['dimension', 'measure'], optional: [], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'labels', 'formatting'], ['axes', 'grid', 'zoom', 'pan']) },
  gauge: { family: 'indicator', intents: ['progress', 'single-value'], required: ['measure'], optional: ['dimension'], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'labels', 'formatting', 'domain'], ['axes', 'grid', 'legend', 'zoom', 'pan']) },
  heatmap: { family: 'matrix', intents: ['matrix', 'correlation-grid'], required: ['dimension', 'dimension', 'measure'], optional: [], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'axes', 'labels', 'formatting', 'color-scale', 'missing-values'], ['zoom', 'pan']) },
  radar: { family: 'radial', intents: ['multidimensional', 'profile'], required: ['three-or-more-measures'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'legend', 'labels', 'formatting', 'multi-series', 'indicator-domains', 'mixed-unit-warning'], ['axes', 'grid', 'zoom', 'pan']) },
  gantt: { family: 'project', intents: ['schedule', 'variance'], required: ['id', 'start', 'end'], optional: ['dependencies', 'progress', 'baseline', 'actual'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard', 'linked-filter', 'linked-selection'], features: status([...commonPresentation, 'labels', 'formatting', 'critical-path', 'slack', 'baseline-actual-variance', 'working-calendar', 'dependencies']) },
  timeline: { family: 'project', intents: ['timeline', 'milestone'], required: ['date', 'label'], optional: ['status'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'labels', 'formatting']) },
  milestone: { family: 'project', intents: ['milestone'], required: ['date', 'label'], optional: ['baseline', 'actual'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'labels', 'formatting', 'baseline-actual-variance']) },
  burndown: { family: 'project', intents: ['progress', 'release'], required: ['date', 'remaining'], optional: ['ideal', 'scopeChange'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'labels', 'formatting', 'scope-change', 'release-forecast']) },
  flow: { family: 'diagram', intents: ['workflow'], required: ['nodes'], optional: ['edges', 'groups', 'ports'], interactions: ['hover', 'selection', 'drag', 'keyboard-edit', 'keyboard-port-connect', 'port-connect', 'copy-paste'], features: status([...commonPresentation, 'labels', 'routing', 'layout', 'groups', 'ports', 'history'], ['axes', 'grid', 'legend']) },
  swimlane: { family: 'diagram', intents: ['responsibility'], required: ['nodes', 'lanes'], optional: ['edges', 'groups', 'ports'], interactions: ['hover', 'selection', 'drag', 'keyboard-edit', 'keyboard-port-connect', 'port-connect', 'copy-paste'], features: status([...commonPresentation, 'labels', 'routing', 'layout', 'groups', 'ports', 'lanes', 'history'], ['axes', 'grid', 'legend']) }
};

export const chartProfiles = Object.fromEntries(chartTypes.map(type => [type, {
  type,
  ...definitions[type],
  dataShapes: definitions[type].family === 'diagram' ? ['diagram-spec'] : definitions[type].family === 'project' ? ['records'] : ['records', 'data-table'],
  renderers: ['canvas', 'svg'],
  exports: ['png', 'svg', 'json'],
  limits: type === 'pie' ? { recommendedCategories: 8 } : type === 'radar' ? { minimumIndicators: 3, recommendedIndicators: 8 } : type === 'heatmap' ? { recommendedCells: 2500 } : {}
}]));

const intentMap = {
  schedule: 'gantt', variance: 'gantt', timeline: 'timeline', milestone: 'milestone', progress: 'burndown', release: 'burndown', capacity: 'column', risk: 'scatter', aging: 'bar', matrix: 'heatmap', 'correlation-grid': 'heatmap', multidimensional: 'radar', profile: 'radar', workflow: 'flow', responsibility: 'swimlane', trend: 'line', 'time-series': 'line', 'part-to-whole': 'pie', distribution: 'column', relationship: 'scatter', correlation: 'scatter', funnel: 'funnel', conversion: 'funnel', 'single-value': 'gauge', ranking: 'bar', comparison: 'bar', composition: 'column'
};

const alternatives = {
  heatmap: ['scatter', 'column'], radar: ['bar', 'line'], gantt: ['timeline', 'milestone'], timeline: ['milestone', 'gantt'], milestone: ['timeline', 'gantt'], burndown: ['line', 'gantt'], column: ['bar', 'line'], scatter: ['bar', 'line'], bar: ['column', 'line'], flow: ['swimlane', 'gantt'], swimlane: ['flow', 'gantt'], line: ['area', 'column'], pie: ['bar', 'column'], funnel: ['bar', 'column'], gauge: ['column', 'bar']
};

function warning(code, path, message, suggestion) { return { code, path, message, ...(suggestion ? { suggestion } : {}) }; }

export function getChartCapability(type) {
  return chartProfiles[type] ? JSON.parse(JSON.stringify(chartProfiles[type])) : null;
}

export function planChart(input, options = {}) {
  const report = inspectData(input);
  const requestedIntent = options.intent || 'comparison';
  const warnings = [...report.warnings];
  let primary = intentMap[requestedIntent];
  if (!primary) {
    primary = report.fields.some(field => field.type === 'temporal') ? 'line' : report.measures.length >= 2 && report.dimensions.length === 0 ? 'scatter' : 'bar';
    warnings.push(warning('UNKNOWN_INTENT', 'intent', `Intent ${requestedIntent} is not registered.`, 'Use an intent returned by getCapabilities().intents.'));
  }
  const profile = chartProfiles[primary];
  const requiredFields = [];
  const nextActions = [];
  if (!report.rows && !diagrams.includes(primary)) warnings.push(warning('EMPTY_DATA', 'data', 'No rows are available for chart planning.', 'Provide at least one record.'));
  if (['pie', 'funnel'].includes(primary) && report.dimensions.length) {
    const field = report.fields.find(item => item.name === report.dimensions[0]);
    if (field?.cardinality > 8) warnings.push(warning('HIGH_CARDINALITY_PART_TO_WHOLE', `data.${field.name}`, `${field.cardinality} categories may make ${primary} hard to read.`, 'Use bar for comparison or filter to the most important categories.'));
  }
  if (profile.family === 'cartesian' || ['part-to-whole', 'stage'].includes(profile.family)) {
    if (!report.dimensions.length) requiredFields.push('dimension');
    if (!report.measures.length) requiredFields.push('measure');
  }
  if (primary === 'heatmap') {
    if (report.dimensions.length < 2) requiredFields.push('second dimension');
    if (!report.measures.length) requiredFields.push('measure');
  }
  if (primary === 'radar' && report.measures.length < 3) requiredFields.push('three quantitative measures');
  if (requiredFields.length) {
    warnings.push(warning('INSUFFICIENT_FIELDS', 'data', `${primary} requires ${requiredFields.join(' and ')}.`, 'Add the required fields or choose an alternative chart.'));
    nextActions.push(`Provide ${requiredFields.join(' and ')}.`);
  }
  if (warnings.length) nextActions.push('Review warnings before rendering.');
  nextActions.push(`Validate the ${primary} Spec with validateSpec().`);
  const confidence = !report.rows || requiredFields.length ? 0.35 : warnings.some(item => item.code !== 'MISSING_VALUE') ? 0.65 : 0.9;
  const styleRecommendation = planStyle({ type: primary, intent: requestedIntent, data: Array.isArray(input) ? input : input?.values || input, encoding: { x: report.dimensions[0] ? { field: report.dimensions[0] } : undefined, y: report.measures.map(field => ({ field })) } }, options);
  warnings.push(...styleRecommendation.warnings);
  return {
    version: '1.0',
    intent: requestedIntent,
    primary,
    alternatives: alternatives[primary] || ['column', 'line'],
    confidence,
    reasons: [`${primary} supports the ${requestedIntent} intent.`, `Detected ${report.dimensions.length} dimensions and ${report.measures.length} measures across ${report.rows} rows.`],
    requiredFields,
    suggestedEncodings: { dimension: report.dimensions[0] || null, measure: report.measures[0] || null, secondaryMeasure: report.measures[1] || null },
    assumptions: ['Field roles are inferred from provided values; business meaning and units are not inferred.'],
    warnings,
    unsupportedRequests: options.renderer && !profile.renderers.includes(options.renderer) ? [`renderer:${options.renderer}`] : [],
    nextActions,
    capability: getChartCapability(primary),
    styleRecommendation,
    data: report
  };
}

export function explainChart(spec, model = {}) {
  const profile = chartProfiles[spec.type];
  const encodings = Object.fromEntries(Object.entries(spec.encoding || {}).map(([channel, value]) => [channel, Array.isArray(value) ? value.map(item => item?.field).filter(Boolean) : value?.field]).filter(([, value]) => Array.isArray(value) ? value.length : value));
  const warnings = [...(model.data?.warnings || []), ...(model.state?.projectAnalytics?.warnings || [])];
  return {
    version: '1.0',
    type: spec.type,
    family: profile?.family || 'unknown',
    purpose: profile?.intents?.[0] || 'visualization',
    renderer: spec.renderer,
    dataCount: model.data?.rows?.length || 0,
    encodings,
    transforms: spec.transform ? (Array.isArray(spec.transform) ? spec.transform : [spec.transform]).map(item => item.type) : [],
    interactions: Object.keys(spec.interaction || {}).filter(key => spec.interaction[key]),
    assumptions: [...(model.data?.assumptions || []), ...(model.state?.projectAnalytics?.assumptions || [])],
    warnings,
    style: spec.theme && typeof spec.theme === 'object' ? { name: spec.theme.name, preset: spec.theme.preset, mode: spec.theme.mode, resolvedMode: spec.theme.resolvedMode, palette: spec.theme.palette, reasons: spec.theme.reasons || [], warnings: spec.theme.warnings || [] } : planStyle(spec),
    lineage: { recordIds: (model.data?.rows || []).map((row, index) => String(row.id ?? row.key ?? `record-${index}`)), sourcePreserved: true },
    accessibility: { enabled: Boolean(spec.accessibility?.enabled), summary: spec.accessibility?.description || spec.title?.text || `${spec.type} chart with ${model.data?.rows?.length || 0} data items.` }
  };
}

export function getCapabilities() {
  const intents = [...new Set(Object.values(chartProfiles).flatMap(profile => profile.intents))];
  const exp = {
    types: ['png', 'jpeg', 'svg', 'json'],
    mime: { png: 'image/png', jpeg: 'image/jpeg', svg: 'image/svg+xml', json: 'application/json' },
    browser: { png: true, jpeg: true, svg: true, json: true },
    headless: {
      png: 'optional: install the `canvas` npm package for createCanvas',
      jpeg: 'same as png',
      svg: true,
      json: true,
    },
    methods: {
      exportPNG: 'chart.export({ type:"png" }) returns base64 data URL (browser); pass as:"blob" for a Blob. In Node headless either install the canvas package or fall back to SVG.',
      exportSVG: 'chart.export({ type:"svg" }) returns the SVG string in both browser and headless; as:"dataurl" for embeds, as:"blob" for a Blob (browser).',
      exportJSON: 'chart.export({ type:"json" }) returns pretty JSON; use as:"object" to get the parsed {version,spec,state}.',
      downloadPNG: 'chart.downloadPNG() triggers a browser save-as dialog (filename derived from title + timestamp).',
      downloadSVG: 'chart.downloadSVG() same semantics as downloadPNG but for SVG.',
      downloadJSON: 'chart.downloadJSON() saves {version,spec,state} as a .json document.',
      toDataURL: 'chart.toDataURL("image/png"|"image/svg+xml") returns a data URL string.',
      toBlob: 'chart.toBlob("image/png"|"image/svg+xml") returns a Blob (browser-only).',
    },
    options: { as: ['string', 'object', 'dataurl', 'blob'] },
    branding: 'By default PNG/SVG exports include the Powered by iChart.js branding watermark. Pass branding: { enabled: false } or branding: false to remove it for white-label output.',
  };
  return {
    version: '2.0',
    contractVersion: '1.0',
    chartTypes,
    charts: JSON.parse(JSON.stringify(chartProfiles)),
    intents,
    chartModes: { stack: ['stacked', 'percent'], pie: ['standard', 'donut'], composition: ['multi-series', 'mixed-line-column', 'dual-axis'], transforms: ['bin'] },
    projectManagement: project,
    projectIntelligence: {
      intents: ['schedule', 'milestone', 'progress', 'variance', 'capacity', 'release', 'risk', 'aging', 'workflow', 'responsibility'],
      views: ['gantt', 'burndown', 'column', 'area', 'scatter', 'bar'],
      analytics: ['calendar', 'dependency-normalization', 'critical-path', 'slack', 'baseline-actual-variance', 'capacity', 'cumulative-flow', 'velocity', 'release-forecast', 'risk-matrix', 'issue-aging'],
      linkedState: ['owner', 'status', 'priority', 'sprint', 'label'],
    },
    diagrams,
    excluded: ['map', '3d'],
    renderers: ['canvas', 'svg'],
    interactions: [...new Set(Object.values(chartProfiles).flatMap(profile => profile.interactions))],
    exports: ['png', 'svg', 'json'],
    headless: {
      preview: true,
      json: true,
      svg: true,
      png: 'Node headless PNG requires the optional `canvas` npm package (createCanvas). Otherwise use chart.export({type:"svg"}).',
    },
    export: exp,
    data: ['normalize', 'inspect', 'filter', 'sort', 'groupBy', 'sum', 'average', 'topN', 'percentage', 'bin'],
    themes: [...styleCapabilities.modes],
    styleSystem: JSON.parse(JSON.stringify(styleCapabilities)),
    plugins: true,
    branding: { defaultEnabled: true, signature: 'Powered by iChart.js', options: [{ name: 'enabled', type: 'boolean', default: true }] },
  };
}
