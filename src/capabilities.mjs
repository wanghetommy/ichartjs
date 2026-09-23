/**
 * Machine-readable chart capabilities and deterministic Agent planning.
 */
import { inspectData } from './data.mjs';
import { planStyle, styleCapabilities } from './theme.mjs';
import { defaultPreferences, preferenceDensities, preferenceMotions, preferenceTriStates } from './preferences.mjs';
import { businessModels, chartProfiles, chartTypes, commandTypes, contractVersion, diagramEdgeModels, diagramOperations, exportTypes, interactionDefaults, renderers } from './contract-registry.mjs';

export { chartProfiles, chartTypes };

const cartesian = ['line', 'area', 'bar', 'column', 'scatter'];
const project = ['gantt', 'timeline', 'milestone', 'burndown'];
const diagrams = ['flow', 'swimlane', 'architecture', 'mindmap'];

const intentMap = {
  schedule: 'gantt', variance: 'gantt', timeline: 'timeline', milestone: 'milestone', progress: 'burndown', release: 'burndown', capacity: 'column', risk: 'scatter', aging: 'bar', matrix: 'heatmap', 'correlation-grid': 'heatmap', multidimensional: 'radar', profile: 'radar', workflow: 'flow', responsibility: 'swimlane', architecture: 'architecture', 'business-architecture': 'architecture', 'data-architecture': 'architecture', 'technical-architecture': 'architecture', mindmap: 'mindmap', hierarchy: 'mindmap', brainstorm: 'mindmap', trend: 'line', 'time-series': 'line', 'part-to-whole': 'pie', distribution: 'column', relationship: 'scatter', correlation: 'scatter', funnel: 'funnel', conversion: 'funnel', 'single-value': 'gauge', ranking: 'bar', comparison: 'bar', composition: 'column'
};

const intentAliases = {
  trend: ['trend', 'time-series'], time: ['trend', 'time-series'], compare: ['comparison', 'ranking'], rank: ['ranking', 'comparison'],
  distribution: ['distribution', 'comparison'], relationship: ['relationship', 'correlation'], correlation: ['correlation', 'relationship'],
  matrix: ['matrix', 'correlation-grid'], profile: ['multidimensional', 'profile'], architecture: ['architecture', 'business-architecture', 'data-architecture', 'technical-architecture'],
  mind: ['mindmap', 'hierarchy', 'brainstorm']
};

const alternatives = {
  heatmap: ['scatter', 'column'], radar: ['bar', 'line'], gantt: ['timeline', 'milestone'], timeline: ['milestone', 'gantt'], milestone: ['timeline', 'gantt'], burndown: ['line', 'gantt'], column: ['bar', 'line'], scatter: ['bar', 'line'], bar: ['column', 'line'], flow: ['swimlane', 'architecture'], swimlane: ['flow', 'architecture'], architecture: ['flow', 'mindmap'], mindmap: ['architecture', 'flow'], line: ['area', 'column'], pie: ['bar', 'column'], funnel: ['bar', 'column'], gauge: ['column', 'bar']
};

function warning(code, path, message, suggestion) { return { code, path, message, ...(suggestion ? { suggestion } : {}) }; }

function suggestIntents(requested) {
  const value = String(requested || '').trim().toLowerCase();
  if (!value) return ['comparison'];
  if (intentAliases[value]) return intentAliases[value];
  const tokens = value.split(/[^a-z0-9-]+/).filter(Boolean);
  return [...new Set(tokens.flatMap(token => intentAliases[token] || (intentMap[token] ? [token] : [])))].slice(0, 5);
}

export function getChartCapability(type) {
  return chartProfiles[type] ? JSON.parse(JSON.stringify(chartProfiles[type])) : null;
}

const preferenceMessages = {
  en: {
    groups: { theme: 'Theme', typography: 'Typography', components: 'Components', behavior: 'Behavior' },
    fields: { mode: 'Theme', preset: 'Style preset', palette: 'Palette', scale: 'Font size', density: 'Density', legend: 'Legend', labels: 'Data labels', grid: 'Grid lines', branding: 'Branding', motion: 'Motion' },
    descriptions: { mode: 'Select automatic, light, dark, or high-contrast rendering.', preset: 'Select a semantic visual preset.', palette: 'Select a semantic color palette.', scale: 'Scale chart typography without changing business data.', density: 'Adjust chart spacing and padding density.', legend: 'Show, hide, or automatically resolve the legend.', labels: 'Show, hide, or automatically resolve data labels.', grid: 'Show, hide, or automatically resolve grid lines.', branding: 'Control the Powered by iChart.js signature.', motion: 'Control animation and motion preference.' },
    options: { auto: 'Auto', light: 'Light', dark: 'Dark', contrast: 'High contrast', analysis: 'Analysis', dashboard: 'Dashboard', report: 'Report', presentation: 'Presentation', project: 'Project', diagram: 'Diagram', categorical: 'Categorical', sequential: 'Sequential', diverging: 'Diverging', status: 'Status', compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious', full: 'Full', reduced: 'Reduced', off: 'Off', true: 'Show', false: 'Hide', '0.85': 'Small', '1': 'Default', '1.15': 'Large', '1.3': 'Extra large' }
  },
  'zh-CN': {
    groups: { theme: '主题', typography: '排版', components: '显示内容', behavior: '行为' },
    fields: { mode: '主题', preset: '样式预设', palette: '配色', scale: '字号', density: '布局密度', legend: '图例', labels: '数据标签', grid: '网格线', branding: '品牌署名', motion: '动效' },
    descriptions: { mode: '选择自动、浅色、深色或高对比度主题。', preset: '选择语义化视觉预设。', palette: '选择语义化配色方案。', scale: '在不改变业务数据的情况下缩放图表字体。', density: '调整图表间距与内边距密度。', legend: '显示、隐藏或自动判断图例。', labels: '显示、隐藏或自动判断数据标签。', grid: '显示、隐藏或自动判断网格线。', branding: '控制 Powered by iChart.js 品牌署名。', motion: '控制动画和动效偏好。' },
    options: { auto: '自动', light: '浅色', dark: '深色', contrast: '高对比度', analysis: '分析', dashboard: '仪表盘', report: '报告', presentation: '演示', project: '项目', diagram: '图表结构', categorical: '分类', sequential: '渐变', diverging: '发散', status: '状态', compact: '紧凑', comfortable: '舒适', spacious: '宽松', full: '完整', reduced: '减少', off: '关闭', true: '显示', false: '隐藏', '0.85': '小', '1': '默认', '1.15': '大', '1.3': '特大' }
  }
};

function preferenceLocale(locale) {
  const normalized = String(locale || 'en').toLowerCase();
  return normalized === 'zh' || normalized.startsWith('zh-') ? 'zh-CN' : 'en';
}

export function getPreferenceCapabilities(chartType = null, { locale = 'en' } = {}) {
  const resolvedLocale = preferenceLocale(locale), text = preferenceMessages[resolvedLocale], profile = chartType ? chartProfiles[chartType] || null : null;
  const option = value => ({ value, label: text.options[String(value ?? 'auto')] || String(value ?? 'auto') });
  const feature = name => chartType == null ? { supported: true, applicability: 'chart-dependent' } : { supported: profile?.features?.[name] === 'supported', applicability: profile?.features?.[name] || 'not-applicable' };
  const scopes = ['global', 'chart'];
  const field = ({ path, group, key, type, values, defaultValue, menu = false, control = 'select', support = { supported: true, applicability: 'all-charts' }, minimum, maximum }) => ({
    path, group, groupLabel: text.groups[group], type, label: text.fields[key], description: text.descriptions[key], default: defaultValue, options: values.map(option), scopes: [...scopes], supported: support.supported, applicability: support.applicability, menu: { visible: menu && support.supported, control }, ...(minimum == null ? {} : { minimum }), ...(maximum == null ? {} : { maximum })
  });
  const fields = [
    field({ path: 'theme.mode', group: 'theme', key: 'mode', type: 'enum', values: [null, ...styleCapabilities.modes.filter(value => value !== 'auto')], defaultValue: defaultPreferences.theme.mode, menu: true }),
    field({ path: 'theme.preset', group: 'theme', key: 'preset', type: 'enum', values: [null, ...styleCapabilities.presets.filter(value => value !== 'auto')], defaultValue: defaultPreferences.theme.preset }),
    field({ path: 'theme.palette', group: 'theme', key: 'palette', type: 'enum', values: [null, ...styleCapabilities.palettes.filter(value => value !== 'auto')], defaultValue: defaultPreferences.theme.palette, menu: true }),
    field({ path: 'typography.scale', group: 'typography', key: 'scale', type: 'number', values: [0.85, 1, 1.15, 1.3], defaultValue: defaultPreferences.typography.scale, menu: true, minimum: 0.75, maximum: 1.5 }),
    field({ path: 'density', group: 'typography', key: 'density', type: 'enum', values: preferenceDensities, defaultValue: defaultPreferences.density }),
    field({ path: 'components.legend', group: 'components', key: 'legend', type: 'tri-state', values: preferenceTriStates, defaultValue: defaultPreferences.components.legend, menu: true, control: 'toggle', support: feature('legend') }),
    field({ path: 'components.labels', group: 'components', key: 'labels', type: 'tri-state', values: preferenceTriStates, defaultValue: defaultPreferences.components.labels, menu: true, control: 'toggle', support: feature('labels') }),
    field({ path: 'components.grid', group: 'components', key: 'grid', type: 'tri-state', values: preferenceTriStates, defaultValue: defaultPreferences.components.grid, menu: true, control: 'toggle', support: feature('grid') }),
    field({ path: 'branding.enabled', group: 'components', key: 'branding', type: 'tri-state', values: preferenceTriStates, defaultValue: defaultPreferences.branding.enabled }),
    field({ path: 'motion', group: 'behavior', key: 'motion', type: 'enum', values: preferenceMotions, defaultValue: defaultPreferences.motion })
  ];
  return { version: '1.0', locale: resolvedLocale, chartType: profile?.type || null, scopes, persistence: ['memory', 'localStorage', 'adapter'], precedence: ['defaults', 'global', 'chart', 'temporary-agent-patch'], fields };
}

export function planChart(input, options = {}) {
  const report = inspectData(input);
  const requestedIntent = options.intent || 'comparison';
  const warnings = [...report.warnings];
  const intentKnown = Boolean(intentMap[requestedIntent]);
  const intentSuggestions = intentKnown ? [] : suggestIntents(requestedIntent);
  let primary = intentMap[requestedIntent];
  if (!primary) {
    primary = report.fields.some(field => field.type === 'temporal') ? 'line' : report.measures.length >= 2 && report.dimensions.length === 0 ? 'scatter' : 'bar';
    warnings.push(warning('UNKNOWN_INTENT', 'intent', `Intent ${requestedIntent} is not registered.`, intentSuggestions.length ? `Use one of: ${intentSuggestions.join(', ')}.` : 'Use an intent returned by getCapabilities().intents.'));
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
    intentKnown,
    intentSuggestions,
    fallbackUsed: !intentKnown,
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
    axes: model.state?.axes || null,
    style: spec.theme && typeof spec.theme === 'object' ? { name: spec.theme.name, preset: spec.theme.preset, mode: spec.theme.mode, resolvedMode: spec.theme.resolvedMode, palette: spec.theme.palette, reasons: spec.theme.reasons || [], warnings: spec.theme.warnings || [] } : planStyle(spec),
    lineage: { recordIds: (model.data?.rows || []).map((row, index) => String(row.id ?? row.key ?? `record-${index}`)), sourcePreserved: true },
    accessibility: { enabled: Boolean(spec.accessibility?.enabled), summary: spec.accessibility?.description || spec.title?.text || `${spec.type} chart with ${model.data?.rows?.length || 0} data items.` }
  };
}

export function getCapabilities() {
  const intents = [...new Set(Object.values(chartProfiles).flatMap(profile => profile.intents))];
  const preferenceCapabilities = getPreferenceCapabilities();
  const exp = {
    types: ['png', 'jpeg', 'svg', 'json'],
    mime: { png: 'image/png', jpeg: 'image/jpeg', svg: 'image/svg+xml', json: 'application/json' },
    browser: { png: true, jpeg: true, svg: true, json: true },
    headless: {
      png: 'optional: install the `canvas` npm package for createCanvas and use exportAsync',
      jpeg: 'same as png',
      svg: true,
      json: true,
    },
    methods: {
      exportPNG: 'chart.export({ type:"png" }) returns a browser data URL. In Node headless use chart.exportAsync({ type:"png" }) after installing the optional canvas package, or fall back to SVG.',
      exportSVG: 'chart.export({ type:"svg" }) returns the SVG string in both browser and headless; as:"dataurl" for embeds, as:"blob" for a Blob (browser).',
      exportJSON: 'chart.export({ type:"json" }) returns pretty JSON; use as:"object", as:"dataurl", or as:"blob" for the corresponding representation.',
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
    contractVersion,
    chartTypes,
    charts: JSON.parse(JSON.stringify(chartProfiles)),
    intents,
    locale: { default: 'en-US', recommended: ['en-US', 'zh-CN'], appliesTo: ['axis', 'labels', 'tooltip', 'export'], inputDates: 'ISO-8601 strings; natural-language date parsing is not supported.' },
    chartModes: { stack: ['stacked', 'percent'], pie: ['standard', 'donut'], composition: ['multi-series', 'mixed-line-column', 'dual-axis'], transforms: ['bin'], diagrams: ['process', 'architecture', 'mindmap'], mindmapLayouts: ['tree', 'radial'], mindmapEdges: ['curved', 'straight', 'orthogonal'] },
    projectManagement: project,
    projectIntelligence: {
      intents: ['schedule', 'milestone', 'progress', 'variance', 'capacity', 'release', 'risk', 'aging', 'workflow', 'responsibility', 'architecture', 'mindmap'],
      views: ['gantt', 'burndown', 'column', 'area', 'scatter', 'bar'],
      analytics: ['calendar', 'dependency-normalization', 'critical-path', 'slack', 'baseline-actual-variance', 'capacity', 'cumulative-flow', 'velocity', 'release-forecast', 'risk-matrix', 'issue-aging'],
      linkedState: ['owner', 'status', 'priority', 'sprint', 'label'],
    },
    diagrams,
    excluded: ['map', '3d'],
    renderers: [...renderers],
    interactionDefaults: { ...interactionDefaults },
    interactions: [...new Set(Object.values(chartProfiles).flatMap(profile => profile.interactions))],
    exports: [...exportTypes],
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
    preferences: {
      version: '1.0',
      scopes: preferenceCapabilities.scopes,
      persistence: preferenceCapabilities.persistence,
      fields: preferenceCapabilities.fields.map(field => field.path),
      agentAdjustable: true,
      interactiveSettingsUI: true,
      precedence: preferenceCapabilities.precedence,
      schema: preferenceCapabilities
    },
    commands: [...commandTypes],
    diagramOperations: [...diagramOperations],
    businessModels: [...businessModels],
    diagramEdgeModels: [...diagramEdgeModels],
    plugins: true,
    branding: { defaultEnabled: true, signature: 'Powered by iChart.js', options: [{ name: 'enabled', type: 'boolean', default: true }] },
  };
}
