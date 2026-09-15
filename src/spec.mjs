/**
 * Chart Spec defaults, normalization, and top-level validation.
 * The normalized Spec is the stable contract shared by all renderers.
 */
const chartTypes = new Set(['line', 'area', 'bar', 'column', 'pie', 'scatter', 'funnel', 'gauge', 'heatmap', 'radar', 'gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane']);

const defaults = {
  version: '2.0',
  renderer: 'canvas',
  width: 640,
  height: 360,
  padding: { top: 48, right: 24, bottom: 48, left: 56 },
  colors: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'],
  background: '#ffffff',
  title: { text: '' },
  interaction: { tooltip: true, hover: true, click: true, crosshair: false, zoom: false, brush: false, keyboard: true }
  ,responsive: [], accessibility: { enabled: false }, editing: { enabled: false, mode: 'command', requireConfirmation: true, allowDelete: false, allowStructuralChanges: false }, xAxis: {}, yAxis: {}
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

export function normalizeSpec(input = {}) {
  const spec = merge(defaults, input);
  if (!spec.data) spec.data = { values: [] };
  if (['flow', 'swimlane'].includes(spec.type) && spec.nodes && !spec.data.values) spec.data.values = [];
  if (Array.isArray(spec.data)) spec.data = { values: spec.data };
  if (!spec.encoding) spec.encoding = {};
  if (['pie', 'funnel', 'gauge'].includes(spec.type) && !spec.encoding.category) spec.encoding.category = { field: 'name', type: 'category' };
  if (['pie', 'funnel', 'gauge'].includes(spec.type) && !spec.encoding.value) spec.encoding.value = { field: 'value', type: 'quantitative' };
  if (spec.type === 'heatmap') { spec.encoding.x ||= { field: 'x', type: 'category' }; spec.encoding.y ||= { field: 'y', type: 'category' }; spec.encoding.color ||= { field: 'value', type: 'quantitative' }; }
  if (!['pie', 'funnel', 'gauge', 'gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane'].includes(spec.type)) {
    spec.encoding.x = spec.encoding.x || { field: 'name', type: 'category' };
    spec.encoding.y = spec.encoding.y || { field: 'value', type: 'quantitative' };
  }
  return spec;
}

export function validateSpec(input) {
  const spec = normalizeSpec(input);
  const errors = [];
  if (!chartTypes.has(spec.type)) errors.push({ code: 'INVALID_TYPE', path: 'type', message: `Unsupported chart type: ${spec.type}`, suggestion: 'Use a type returned by getCapabilities().' });
  if (!['canvas', 'svg', 'auto'].includes(spec.renderer)) errors.push({ code: 'INVALID_RENDERER', path: 'renderer', message: `Unsupported renderer: ${spec.renderer}`, suggestion: 'Use canvas, svg, or auto.' });
  if (Array.isArray(spec.encoding.y) && spec.encoding.y.length > 2) errors.push({ code: 'TOO_MANY_AXES', path: 'encoding.y', message: 'Only two quantitative axes are supported in this iteration.', suggestion: 'Use at most two y encodings.' });
  if (spec.stack && !['bar', 'column', 'area'].includes(spec.type)) errors.push({ code: 'INVALID_STACK', path: 'stack', message: 'Stacking is supported by bar, column, and area charts.', suggestion: 'Remove stack or use a supported chart type.' });
  if (spec.stack && !['stacked', 'percent'].includes(typeof spec.stack === 'string' ? spec.stack : spec.stack.mode)) errors.push({ code: 'INVALID_STACK_MODE', path: 'stack', message: 'Stack mode must be stacked or percent.', suggestion: 'Use stack: "stacked" or stack: "percent".' });
  if (spec.type === 'pie' && spec.innerRadius != null && (!(Number(spec.innerRadius) >= 0) || Number(spec.innerRadius) >= 1)) errors.push({ code: 'INVALID_INNER_RADIUS', path: 'innerRadius', message: 'Pie innerRadius must be a ratio from 0 up to, but not including, 1.', suggestion: 'Use a value such as 0.55.' });
  if (spec.type === 'radar' && (!Array.isArray(spec.indicators) || spec.indicators.length < 3)) errors.push({ code: 'INVALID_INDICATORS', path: 'indicators', message: 'Radar requires at least three indicators.', suggestion: 'Declare indicator name, field, min, and max.' });
  if (!spec.data || !Array.isArray(spec.data.values)) errors.push({ code: 'INVALID_DATA', path: 'data.values', message: 'data.values must be an array.', suggestion: 'Pass an array of row objects.' });
  if (['flow', 'swimlane'].includes(spec.type) && !Array.isArray(spec.nodes) && !Array.isArray(spec.data?.nodes)) errors.push({ code: 'INVALID_NODES', path: 'nodes', message: 'Flow and swimlane charts require nodes.', suggestion: 'Pass nodes on the Spec or in data.nodes.' });
  if (['gantt', 'timeline', 'milestone'].includes(spec.type)) {
    const rows = spec.data.values, dateKey = spec.type === 'gantt' ? 'start/end' : 'date';
    if (!rows.some(row => row.start || row.end || row.date)) errors.push({ code: 'INVALID_INTERVALS', path: 'data.values', message: `${spec.type} rows require ${dateKey} dates.`, suggestion: 'Add ISO date values to each row.' });
    rows.forEach((row, index) => { const values = spec.type === 'gantt' ? [row.start, row.end] : [row.date]; if (values.some(value => value != null && Number.isNaN(Date.parse(value)))) errors.push({ code: 'INVALID_DATE', path: `data.values[${index}]`, message: `${spec.type} contains an invalid date.`, suggestion: 'Use an ISO-8601 date such as 2026-09-14.' }); });
  }
  if (spec.type === 'gantt') errors.push(...dependencyErrors(spec.data.values));
  ['width', 'height'].forEach(key => { if (!(Number(spec[key]) > 0)) errors.push({ code: 'INVALID_DIMENSION', path: key, message: `${key} must be greater than zero.`, suggestion: `Set a positive ${key}.` }); });
  return { valid: errors.length === 0, errors, spec };
}

export { chartTypes };
