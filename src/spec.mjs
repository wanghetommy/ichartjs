/**
 * Chart Spec defaults, normalization, and top-level validation.
 * The normalized Spec is the stable contract shared by all renderers.
 */
import { chartProfiles } from './capabilities.mjs';
import { themeModes, themePalettes, themePresets } from './theme.mjs';
import { validateDiagram } from './diagram.mjs';

const chartTypes = new Set(Object.keys(chartProfiles));

const defaults = {
  version: '2.0',
  renderer: 'canvas',
  width: 640,
  height: 360,
  padding: { top: 48, right: 24, bottom: 48, left: 56 },
  colors: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'],
  background: '#ffffff',
  theme: 'auto',
  title: { text: '', subtitle: '' },
  legend: { visible: true, position: 'top' },
  grid: { visible: true },
  labels: { enabled: false },
  branding: { enabled: true },
  interaction: { tooltip: true, hover: true, click: true, crosshair: false, zoom: false, pan: false, brush: false, drag: false, edgeDrag: false, portConnect: false, keyboard: true }
  ,responsive: [], accessibility: { enabled: false }, editing: { enabled: false, mode: 'command', requireConfirmation: true, allowDelete: false, allowStructuralChanges: false }, xAxis: {}, yAxis: { nice: true, ticks: 'auto' }
  ,locale: 'en-US'
};

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function merge(base, extra) {
  const result = clone(base);
  Object.keys(extra || {}).forEach(key => {
    if (extra[key] && typeof extra[key] === 'object' && !Array.isArray(extra[key]) && result[key] && typeof result[key] === 'object') {
      result[key] = merge(result[key], extra[key]);
    } else if (extra[key] !== undefined) {
      result[key] = clone(extra[key]);
    }
  });
  return result;
}

function dependencyId(dependency) {
  return typeof dependency === 'string' ? dependency : dependency && typeof dependency === 'object' && typeof dependency.id === 'string' ? dependency.id : null;
}

function dependencyErrors(rows) {
  const errors = [], ids = new Set(rows.map(row => row.id).filter(Boolean)), graph = new Map(rows.map(row => [row.id, (row.dependencies || []).map(dependencyId).filter(Boolean)]));
  rows.forEach((row, index) => (row.dependencies || []).forEach((dependency, dependencyIndex) => {
    const id = dependencyId(dependency);
    if (!id) errors.push({ code: 'INVALID_DEPENDENCY', path: `data.values[${index}].dependencies[${dependencyIndex}]`, message: 'Dependency must be a task id or an object with an id.', suggestion: 'Use a string id or { id, type, lag, lead }.' });
    else if (!ids.has(id)) errors.push({ code: 'MISSING_DEPENDENCY', path: `data.values[${index}].dependencies`, message: `Task ${row.id || index} references missing task ${id}.`, suggestion: 'Use an existing task id.' });
  }));
  const visiting = new Set(), visited = new Set();
  function visit(id) { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); const cycle = (graph.get(id) || []).some(visit); visiting.delete(id); visited.add(id); return cycle; }
  graph.forEach((_, id) => { if (visit(id)) errors.push({ code: 'CYCLIC_DEPENDENCY', path: 'data.values', message: 'Gantt dependencies contain a cycle.', suggestion: 'Dependencies must form a directed acyclic graph.' }); });
  return errors;
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function projectRowErrors(type, rows) {
  const errors = [], ids = new Map(), requiresId = ['gantt', 'timeline', 'milestone'].includes(type);
  rows.forEach((row, index) => {
    const path = `data.values[${index}]`;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push({ code: 'INVALID_PROJECT_ROW', path, message: `${type} rows must be objects.`, suggestion: 'Provide one JSON object per project record.' });
      return;
    }
    if (requiresId && (typeof row.id !== 'string' || !row.id.trim())) errors.push({ code: 'MISSING_RECORD_ID', path: `${path}.id`, message: `${type} rows require a stable string id.`, suggestion: 'Add a unique id to every project record so edits and lineage remain stable.' });
    if (typeof row.id === 'string' && row.id.trim()) {
      if (ids.has(row.id)) errors.push({ code: 'DUPLICATE_RECORD_ID', path: `${path}.id`, message: `Record id ${row.id} is duplicated.`, suggestion: 'Use a unique stable id for every project record.' });
      ids.set(row.id, index);
    }
    if (type === 'gantt') {
      for (const key of ['start', 'end']) {
        if (!isIsoDate(row[key])) errors.push({ code: 'MISSING_REQUIRED_DATE', path: `${path}.${key}`, message: `Gantt rows require a valid ISO ${key} date.`, suggestion: `Use ${key}: "2026-09-14" or an explicit ISO timestamp.` });
      }
      if (isIsoDate(row.start) && isIsoDate(row.end) && Date.parse(row.end) < Date.parse(row.start)) errors.push({ code: 'INVALID_INTERVAL', path, message: 'Gantt end must not precede start.', suggestion: 'Set end to the same day or a later ISO date.' });
    } else if (['timeline', 'milestone'].includes(type)) {
      if (!isIsoDate(row.date)) errors.push({ code: 'MISSING_REQUIRED_DATE', path: `${path}.date`, message: `${type} rows require a valid ISO date.`, suggestion: 'Use date: "2026-09-14" or an explicit ISO timestamp.' });
      if (typeof (row.title ?? row.name ?? row.label) !== 'string' || !(row.title ?? row.name ?? row.label).trim()) errors.push({ code: 'MISSING_RECORD_LABEL', path: `${path}.title`, message: `${type} rows require a title, name, or label.`, suggestion: 'Add a human-readable title for the project record.' });
    } else if (type === 'burndown') {
      if (!isIsoDate(row.date)) errors.push({ code: 'MISSING_REQUIRED_DATE', path: `${path}.date`, message: 'burndown rows require a valid ISO date.', suggestion: 'Use date: "2026-09-14" or an explicit ISO timestamp.' });
      if (!Number.isFinite(Number(row.remaining)) || Number(row.remaining) < 0) errors.push({ code: 'INVALID_REMAINING', path: `${path}.remaining`, message: 'Burndown remaining must be a non-negative finite number.', suggestion: 'Provide remaining: 0 or a positive numeric value.' });
    }
  });
  return errors;
}

const encodingChannels = {
  line: ['x', 'y'], area: ['x', 'y'], bar: ['x', 'y'], column: ['x', 'y'], scatter: ['x', 'y'],
  pie: ['category', 'value'], funnel: ['category', 'value'], gauge: ['value'], heatmap: ['x', 'y', 'color'], radar: [],
  gantt: [], timeline: [], milestone: [], burndown: [], flow: [], swimlane: [], architecture: [], mindmap: []
};

const presentationEncodingKeys = new Set(['title', 'format', 'labels', 'legend']);
const diagramTypes = new Set(['flow', 'swimlane', 'architecture', 'mindmap']);
const diagramFields = ['nodes', 'edges', 'lanes', 'groups', 'layers', 'boundaries'];
const nonCartesianAnalysisTypes = new Set(['pie', 'funnel', 'gauge', 'heatmap', 'radar']);

function finiteDomain(domain) {
  return Array.isArray(domain) && domain.length === 2 && domain.every(value => Number.isFinite(Number(value))) && Number(domain[1]) > Number(domain[0]);
}

function validateEncodingContract(input, spec, errors) {
  const rows = Array.isArray(spec.data?.values) ? spec.data.values : [], fields = new Set(rows.flatMap(row => Object.keys(row || {})));
  if (!rows.length) return;
  const rawEncoding = input.encoding && typeof input.encoding === 'object' ? input.encoding : {};
  const allowed = new Set(encodingChannels[spec.type] || []);
  Object.keys(rawEncoding).forEach(channel => {
    if (presentationEncodingKeys.has(channel) || allowed.has(channel)) return;
    errors.push({ code: 'UNSUPPORTED_ENCODING_CHANNEL', path: `encoding.${channel}`, message: `${spec.type} does not use encoding.${channel}.`, expected: [...allowed], suggestion: allowed.size ? `Use encoding.${[...allowed].join(' or encoding.')} for ${spec.type}.` : 'Remove field encodings from this chart type.' });
  });
  const check = (path, encoding) => {
    const items = Array.isArray(encoding) ? encoding : [encoding];
    items.forEach((item, index) => {
      if (!item) return;
      const field = item.field, itemPath = Array.isArray(encoding) ? `${path}.${index}.field` : `${path}.field`;
      if (typeof field !== 'string' || !field) errors.push({ code: 'INVALID_ENCODING_FIELD', path: itemPath, message: 'Encoding fields must be non-empty strings.', suggestion: 'Use a field name that exists in data.values.' });
      else if (!fields.has(field)) errors.push({ code: 'MISSING_ENCODING_FIELD', path: itemPath, message: `Field ${field} is not present in data.values.`, expected: [...fields], suggestion: 'Inspect the data schema and use an existing field.' });
    });
  };
  if (['pie', 'funnel'].includes(spec.type) && (rawEncoding.x !== undefined || rawEncoding.y !== undefined)) return;
  (encodingChannels[spec.type] || []).forEach(channel => check(`encoding.${channel}`, spec.encoding?.[channel]));
  if (spec.type === 'radar') (spec.indicators || []).forEach((indicator, index) => check(`indicators.${index}`, indicator));
}

export function normalizeSpec(input = {}) {
  const spec = merge(defaults, input);
  if (input.branding === undefined && input.theme && typeof input.theme === 'object' && input.theme.branding !== undefined) spec.branding = clone(input.theme.branding);
  if (spec.branding === false) spec.branding = { enabled: false };
  else if (spec.branding === true) spec.branding = { enabled: true };
  else if (spec.branding == null) spec.branding = { enabled: true };
  else if (typeof spec.branding === 'object' && !Array.isArray(spec.branding)) {
    if (spec.branding.enabled === undefined) spec.branding = { ...spec.branding, enabled: true };
  }
  if (!spec.data) spec.data = { values: [] };
  if (diagramTypes.has(spec.type) && !Array.isArray(spec.data.values)) spec.data.values = [];
  if (Array.isArray(spec.data)) spec.data = { values: spec.data };
  if (!spec.encoding) spec.encoding = {};
  if (['pie', 'funnel'].includes(spec.type) && !spec.encoding.category) spec.encoding.category = { field: 'name', type: 'category' };
  if (['pie', 'funnel', 'gauge'].includes(spec.type) && !spec.encoding.value) spec.encoding.value = { field: 'value', type: 'quantitative' };
  if (spec.type === 'scatter' && !input.encoding?.x) spec.encoding.x = { field: 'x', type: 'quantitative' };
  if (spec.type === 'scatter' && !input.encoding?.y) spec.encoding.y = { field: 'y', type: 'quantitative' };
  if (spec.type === 'heatmap') { spec.encoding.x ||= { field: 'x', type: 'category' }; spec.encoding.y ||= { field: 'y', type: 'category' }; spec.encoding.color ||= { field: 'value', type: 'quantitative' }; }
  if (!['pie', 'funnel', 'gauge', 'radar', 'gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane', 'architecture', 'mindmap'].includes(spec.type)) {
    spec.encoding.x = spec.encoding.x || { field: 'name', type: 'category' };
    spec.encoding.y = spec.encoding.y || { field: 'value', type: 'quantitative' };
  }
  if (nonCartesianAnalysisTypes.has(spec.type)) {
    ['grid', 'xAxis', 'yAxis'].forEach(key => { if (input[key] === undefined) delete spec[key]; });
    ['legend', 'labels'].forEach(key => { if (input[key] === undefined && chartProfiles[spec.type]?.features?.[key] !== 'supported') delete spec[key]; });
  }
  return spec;
}

export function validateSpec(input = {}) {
  const spec = normalizeSpec(input);
  const errors = [], warnings = [], normalizations = [];
  if (!chartTypes.has(spec.type)) errors.push({ code: 'INVALID_TYPE', path: 'type', message: `Unsupported chart type: ${spec.type}`, suggestion: 'Use a type returned by getCapabilities().' });
  if (!['canvas', 'svg', 'auto'].includes(spec.renderer)) errors.push({ code: 'INVALID_RENDERER', path: 'renderer', message: `Unsupported renderer: ${spec.renderer}`, suggestion: 'Use canvas, svg, or auto.' });
  if (typeof spec.theme === 'string' && !themeModes.includes(spec.theme) && !themePresets.includes(spec.theme)) errors.push({ code: 'INVALID_THEME', path: 'theme', message: `Unsupported theme: ${spec.theme}`, suggestion: 'Use auto, light, dark, contrast, or a named style preset.' });
  if (spec.theme && typeof spec.theme === 'object') {
    if (spec.theme.mode && !themeModes.includes(spec.theme.mode)) errors.push({ code: 'INVALID_THEME_MODE', path: 'theme.mode', message: `Unsupported theme mode: ${spec.theme.mode}`, suggestion: `Use ${themeModes.join(', ')}.` });
    if (spec.theme.preset && !themePresets.includes(spec.theme.preset)) errors.push({ code: 'INVALID_THEME_PRESET', path: 'theme.preset', message: `Unsupported theme preset: ${spec.theme.preset}`, suggestion: `Use ${themePresets.join(', ')}.` });
    if (spec.theme.palette && !themePalettes.includes(spec.theme.palette)) errors.push({ code: 'INVALID_THEME_PALETTE', path: 'theme.palette', message: `Unsupported theme palette: ${spec.theme.palette}`, suggestion: `Use ${themePalettes.join(', ')}.` });
    if (spec.theme.branding != null && typeof spec.theme.branding !== 'boolean' && !(spec.theme.branding && typeof spec.theme.branding === 'object')) errors.push({ code: 'INVALID_BRANDING', path: 'theme.branding', message: 'theme.branding must be a boolean or a { enabled: boolean } object.', suggestion: 'Use theme: { branding: false } or theme: { branding: { enabled: false } }.' });
    else if (spec.theme.branding && typeof spec.theme.branding === 'object' && (Object.keys(spec.theme.branding).some(key => key !== 'enabled') || typeof spec.theme.branding.enabled !== 'boolean')) errors.push({ code: 'INVALID_BRANDING', path: 'theme.branding', message: 'theme.branding objects only support a boolean enabled property.', suggestion: 'Use theme: { branding: { enabled: false } }.' });
  }
  if (typeof spec.locale !== 'string' || !spec.locale.trim()) errors.push({ code: 'INVALID_LOCALE', path: 'locale', message: 'locale must be a non-empty BCP 47 locale string.', suggestion: 'Use for example locale: "en-US" or locale: "zh-CN".' });
  validateEncodingContract(input, spec, errors);
  const axisEncodings = [['x', 'xAxis'], ['y', 'yAxis']];
  axisEncodings.forEach(([encodingName, axisName]) => {
    const encoding = spec.encoding?.[encodingName];
    const encodingItems = Array.isArray(encoding) ? encoding : [encoding];
    encodingItems.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const pathPrefix = Array.isArray(encoding) ? `encoding.${encodingName}.${index}` : `encoding.${encodingName}`;
      if (item.title !== undefined) warnings.push({ code: 'MISPLACED_AXIS_TITLE', path: `${pathPrefix}.title`, message: `Axis titles belong on ${axisName}.title, not on an encoding.`, suggestion: `Move it to ${axisName}: { title: ... }.` });
      if (item.format !== undefined) warnings.push({ code: 'MISPLACED_AXIS_FORMAT', path: `${pathPrefix}.format`, message: `Axis formats belong on ${axisName}.format, not on an encoding.`, suggestion: `Move it to ${axisName}: { format: ... }.` });
    });
  });
  if (spec.encoding?.labels !== undefined) warnings.push({ code: 'MISPLACED_LABELS', path: 'encoding.labels', message: 'Data labels are a chart-level option.', suggestion: 'Move it to labels: { enabled: true, ... }.' });
  if (spec.encoding?.legend !== undefined) warnings.push({ code: 'MISPLACED_LEGEND', path: 'encoding.legend', message: 'Legend visibility is a chart-level option.', suggestion: 'Move it to legend: { visible: false }.' });
  [['xAxis', spec.xAxis], ['yAxis', spec.yAxis]].forEach(([axisName, axis]) => {
    ['min', 'max'].forEach(bound => {
      if (axis?.[bound] !== undefined || axis?.right?.[bound] !== undefined) warnings.push({ code: 'UNSUPPORTED_AXIS_DOMAIN', path: `${axisName}.${bound}`, message: 'Use axis.domain rather than axis.min/axis.max for an explicit numeric domain.', suggestion: 'Use yAxis: { domain: [0, 2000] } or yAxis: { nice: true }.' });
    });
    if (axisName === 'xAxis' && axis?.domain !== undefined) warnings.push({ code: 'UNSUPPORTED_AXIS_DOMAIN', path: 'xAxis.domain', message: 'Explicit x-axis domain is not supported by the current categorical/time layout.', suggestion: 'Use yAxis.domain for numeric value axes; x-axis ranges are derived from records.' });
    if (axisName === 'xAxis' && (axis?.nice !== undefined || axis?.ticks !== undefined)) warnings.push({ code: 'UNSUPPORTED_AXIS_TICKS', path: 'xAxis', message: 'Nice domains and tick counts currently apply to yAxis, not categorical/time x-axis layouts.', suggestion: 'Move numeric scale controls to yAxis.' });
    if (axisName === 'xAxis') return;
    [axis, axis?.right].forEach((axisConfig, index) => {
      if (!axisConfig) return;
      const pathPrefix = index ? `${axisName}.right` : axisName;
      if (axisConfig.domain !== undefined && !(Array.isArray(axisConfig.domain) && axisConfig.domain.length === 2 && axisConfig.domain.every(value => Number.isFinite(Number(value))) && Number(axisConfig.domain[1]) > Number(axisConfig.domain[0]))) errors.push({ code: 'INVALID_AXIS_DOMAIN', path: `${pathPrefix}.domain`, message: 'Axis domain must be [min, max] with two finite numbers and max greater than min.', suggestion: 'Use for example yAxis: { domain: [0, 2000] }.' });
      if (axisConfig.nice !== undefined && typeof axisConfig.nice !== 'boolean') errors.push({ code: 'INVALID_AXIS_NICE', path: `${pathPrefix}.nice`, message: 'Axis nice must be a boolean.', suggestion: 'Use nice: true or nice: false.' });
      if (axisConfig.ticks !== undefined && axisConfig.ticks !== 'auto' && !(Number.isInteger(axisConfig.ticks) && axisConfig.ticks >= 2)) errors.push({ code: 'INVALID_AXIS_TICKS', path: `${pathPrefix}.ticks`, message: 'Axis ticks must be auto or an integer of at least 2 labels.', suggestion: 'Use ticks: "auto" or ticks: 5.' });
    });
  });
  if (Array.isArray(spec.encoding.y) && spec.encoding.y.length > 2) errors.push({ code: 'TOO_MANY_AXES', path: 'encoding.y', message: 'Only two quantitative axes are supported in this iteration.', suggestion: 'Use at most two y encodings.' });
  if (spec.stack && !['bar', 'column', 'area'].includes(spec.type)) errors.push({ code: 'INVALID_STACK', path: 'stack', message: 'Stacking is supported by bar, column, and area charts.', suggestion: 'Remove stack or use a supported chart type.' });
  if (spec.stack && !['stacked', 'percent'].includes(typeof spec.stack === 'string' ? spec.stack : spec.stack.mode)) errors.push({ code: 'INVALID_STACK_MODE', path: 'stack', message: 'Stack mode must be stacked or percent.', suggestion: 'Use stack: "stacked" or stack: "percent".' });
  if (spec.type === 'pie' && spec.innerRadius != null && (!(Number(spec.innerRadius) >= 0) || Number(spec.innerRadius) >= 1)) errors.push({ code: 'INVALID_INNER_RADIUS', path: 'innerRadius', message: 'Pie innerRadius must be a ratio from 0 up to, but not including, 1.', suggestion: 'Use a value such as 0.55.' });
  if (spec.type === 'gauge') {
    if (spec.domain === undefined) errors.push({ code: 'MISSING_GAUGE_DOMAIN', path: 'domain', message: 'Gauge requires an explicit numeric domain to avoid silently clipping values.', suggestion: 'Use domain: [0, 100] for a percentage KPI or declare the business range.' });
    else if (!finiteDomain(spec.domain)) errors.push({ code: 'INVALID_GAUGE_DOMAIN', path: 'domain', message: 'Gauge domain must be [min, max] with finite numbers and max greater than min.', suggestion: 'Use for example domain: [0, 100].' });
  }
  if (spec.type === 'radar' && (!Array.isArray(spec.indicators) || spec.indicators.length < 3)) errors.push({ code: 'INVALID_INDICATORS', path: 'indicators', message: 'Radar requires at least three indicators.', suggestion: 'Declare indicator name, field, min, and max.' });
  if (!diagramTypes.has(spec.type) && (!spec.data || !Array.isArray(spec.data.values))) errors.push({ code: 'INVALID_DATA', path: 'data.values', message: 'data.values must be an array.', suggestion: 'Pass an array of row objects.' });
  const misplacedDiagramFields = diagramTypes.has(spec.type) ? diagramFields.filter(field => input.data && input.data[field] !== undefined) : [];
  misplacedDiagramFields.forEach(field => errors.push({ code: 'MISPLACED_DIAGRAM_FIELD', path: `data.${field}`, message: `${field} belongs at the top level of a ${spec.type} Spec.`, suggestion: `Move data.${field} to ${field}.` }));
  if (diagramTypes.has(spec.type) && !Array.isArray(spec.nodes) && !misplacedDiagramFields.includes('nodes')) errors.push({ code: 'INVALID_NODES', path: 'nodes', message: `${spec.type} charts require top-level nodes.`, suggestion: 'Pass nodes: [{ id, label }].' });
  if (diagramTypes.has(spec.type)) {
    const diagramInput = { type: spec.type, ...(Array.isArray(spec.nodes) ? { nodes: spec.nodes } : {}), ...(Array.isArray(spec.edges) ? { edges: spec.edges } : {}), ...(Array.isArray(spec.lanes) ? { lanes: spec.lanes } : {}), ...(Array.isArray(spec.groups) ? { groups: spec.groups } : {}), ...(Array.isArray(spec.layers) ? { layers: spec.layers } : {}), ...(Array.isArray(spec.boundaries) ? { boundaries: spec.boundaries } : {}), ...(spec.diagram ? { diagram: spec.diagram } : {}) };
    const diagramValidation = validateDiagram(diagramInput);
    diagramValidation.errors.forEach(error => errors.push({ ...error, path: error.path || 'diagram' }));
  }
  if (['gantt', 'timeline', 'milestone', 'burndown'].includes(spec.type)) {
    const rows = spec.data.values, dateKey = spec.type === 'gantt' ? 'start/end' : 'date';
    if (!rows.some(row => row && (row.start || row.end || row.date))) errors.push({ code: 'INVALID_INTERVALS', path: 'data.values', message: `${spec.type} rows require ${dateKey} dates.`, suggestion: 'Add ISO date values to each row.' });
    errors.push(...projectRowErrors(spec.type, rows));
    if (spec.type === 'burndown') {
      const seenDates = new Set(), validDates = rows.map(row => row?.date).filter(isIsoDate);
      validDates.forEach((date, index) => {
        if (seenDates.has(date)) warnings.push({ code: 'DUPLICATE_DATE', severity: 'warning', path: 'data.values', message: `Burndown contains duplicate date ${date}; input order is preserved.`, suggestion: 'Aggregate duplicate dates before rendering for one sample per day.' });
        seenDates.add(date);
        if (index && Date.parse(date) < Date.parse(validDates[index - 1])) warnings.push({ code: 'OUT_OF_ORDER_DATE', severity: 'warning', path: 'data.values', message: 'Burndown dates are not sorted; input order is preserved.', suggestion: 'Sort samples by date before creating the chart.' });
      });
    }
  }
  if (spec.type === 'gantt') errors.push(...dependencyErrors(spec.data.values));
  const rows = Array.isArray(spec.data?.values) ? spec.data.values : [];
  if (spec.type === 'pie' && rows.length > 8) warnings.push({ code: 'HIGH_CARDINALITY_PIE', path: 'data.values', message: `Pie contains ${rows.length} categories.`, expected: '8 or fewer categories', suggestion: 'Use bar/column or group smaller categories.' });
  if (spec.type === 'pie') {
    const valueField = spec.encoding.value?.field || 'value', values = rows.map(row => Number(row?.[valueField])), negativeCount = values.filter(value => Number.isFinite(value) && value < 0).length, positiveTotal = values.reduce((sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0), 0);
    if (negativeCount) warnings.push({ code: 'NEGATIVE_VALUE_DROPPED', path: 'encoding.value', count: negativeCount, message: `Pie ignores ${negativeCount} negative value${negativeCount === 1 ? '' : 's'} when calculating shares.`, suggestion: 'Use non-negative part-to-whole values or choose a Cartesian chart for signed measures.' });
    if (!(positiveTotal > 0)) warnings.push({ code: 'ZERO_TOTAL', path: 'encoding.value', message: 'Pie requires a positive total.', suggestion: 'Provide at least one positive value or render an explicit empty state.' });
  }
  if (spec.type === 'radar' && Array.isArray(spec.indicators) && spec.indicators.some(indicator => !Number.isFinite(Number(indicator.min)) || !Number.isFinite(Number(indicator.max)))) warnings.push({ code: 'AMBIGUOUS_RADAR_DOMAIN', path: 'indicators', message: 'Radar indicator domains are incomplete.', expected: 'finite min and max for every indicator', suggestion: 'Declare explicit domains, especially for mixed units.' });
  const profile = chartProfiles[spec.type], inputOptions = input && typeof input === 'object' ? input : {};
  [['legend', 'legend'], ['grid', 'grid'], ['labels', 'labels']].forEach(([option, feature]) => {
    if (inputOptions[option] !== undefined && profile?.features?.[feature] !== 'supported') warnings.push({ code: `UNSUPPORTED_${option.toUpperCase()}`, path: option, message: `${spec.type} does not support ${option} configuration in the current contract.`, suggestion: 'Remove the option or use a chart type that declares this feature.' });
  });
  if ((inputOptions.xAxis !== undefined || inputOptions.yAxis !== undefined) && !['line', 'area', 'bar', 'column', 'scatter'].includes(spec.type)) warnings.push({ code: 'UNSUPPORTED_AXIS', path: inputOptions.xAxis !== undefined ? 'xAxis' : 'yAxis', message: `${spec.type} does not expose Cartesian axis configuration.`, suggestion: 'Use chart-specific options such as domain, colorScale, or indicators.' });
  if (spec.type === 'swimlane' && !(Array.isArray(spec.lanes) && spec.lanes.length)) errors.push({ code: 'MISSING_REQUIRED', path: 'lanes', message: 'Swimlane requires at least one top-level lane.', suggestion: 'Provide lanes: [{ id, label }].' });
  const supportedInteractions = chartProfiles[spec.type]?.interactions || [];
  Object.entries(spec.interaction || {}).forEach(([name, enabled]) => { if (enabled && !supportedInteractions.includes(name) && !['hover', 'click'].includes(name)) warnings.push({ code: 'UNSUPPORTED_INTERACTION', path: `interaction.${name}`, message: `${name} is not declared for ${spec.type}.`, expected: supportedInteractions, suggestion: 'Disable the interaction or use a compatible chart type.' }); });
  if (spec.branding != null && typeof spec.branding !== 'boolean' && !(spec.branding && typeof spec.branding === 'object')) {
    errors.push({ code: 'INVALID_BRANDING', path: 'branding', message: 'branding must be a boolean or a { enabled: boolean } object.', suggestion: 'Use branding: true, branding: false, or branding: { enabled: false }.' });
  } else if (spec.branding && typeof spec.branding === 'object') {
    const keys = new Set(Object.keys(spec.branding));
    if (keys.size > 1 || !keys.has('enabled')) {
      errors.push({ code: 'UNSUPPORTED_BRANDING_OPTIONS', path: 'branding', message: 'This iteration of branding only supports the enabled option.', expected: ['enabled'], suggestion: 'Custom text, links, position, and font are intentionally not exposed in the current version.' });
    } else if (typeof spec.branding.enabled !== 'boolean') {
      errors.push({ code: 'INVALID_BRANDING_ENABLED', path: 'branding.enabled', message: 'branding.enabled must be a boolean.', suggestion: 'Use true to show the Powered by iChart.js signature or false to hide.' });
    }
  }
  ['width', 'height'].forEach(key => { if (!(Number(spec[key]) > 0)) errors.push({ code: 'INVALID_DIMENSION', path: key, message: `${key} must be greater than zero.`, suggestion: `Set a positive ${key}.` }); });
  return { valid: errors.length === 0, errors, warnings, normalizations, spec };
}

export { chartTypes };
