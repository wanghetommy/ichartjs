/**
 * Chart-to-scene builders for generic and project visualizations.
 * Keeps chart specifications independent from Canvas and SVG renderers.
 */
import { Scene, SceneNode } from './scene.mjs';
import { normalizeData } from './data.mjs';
import { applyTransforms } from './transforms.mjs';
import { buildProjectScene } from './project.mjs';

const pick = (row, encoding, fallback) => row?.[encoding?.field || fallback];

function layout(spec, data) {
  const p = spec.padding, width = spec.width, height = spec.height;
  const plot = { x: p.left, y: p.top, width: Math.max(1, width - p.left - p.right), height: Math.max(1, height - p.top - p.bottom) };
  const xEncoding = spec.encoding.x || { field: 'name', type: 'category' };
  const xField = xEncoding.field || 'name';
  const yEncodings = Array.isArray(spec.encoding.y) ? spec.encoding.y : [spec.encoding.y || { field: 'value', type: 'quantitative' }];
  const yField = yEncodings[0]?.field || 'value';
  const categories = [...new Set(data.rows.map(row => String(row[xField] ?? '')))].filter(Boolean);
  const stackMode = typeof spec.stack === 'string' ? spec.stack : spec.stack?.mode;
  const stackTotals = stackMode ? data.rows.flatMap(row => {
    const values = yEncodings.map(encoding => Number(row[encoding.field])).filter(Number.isFinite);
    if (stackMode === 'percent') return [0, 1];
    return [values.filter(value => value >= 0).reduce((sum, value) => sum + value, 0), values.filter(value => value < 0).reduce((sum, value) => sum + value, 0)];
  }) : [];
  const numbers = (stackTotals.length ? stackTotals : data.rows.flatMap(row => yEncodings.map(encoding => Number(row[encoding.field])))).filter(Number.isFinite);
  const min = Math.min(0, ...(numbers.length ? numbers : [0]));
  const max = Math.max(1, ...(numbers.length ? numbers : [1]));
  const temporal = xEncoding.type === 'temporal' || xEncoding.type === 'time';
  const dates = temporal ? data.rows.map(row => new Date(row[xField]).getTime()).filter(Number.isFinite) : [];
  const xMin = dates.length ? Math.min(...dates) : 0, xMax = dates.length ? Math.max(...dates) : 1;
  const x = category => temporal ? plot.x + ((new Date(category).getTime() - xMin) / (xMax - xMin || 1)) * plot.width : plot.x + (categories.indexOf(String(category)) + 0.5) * plot.width / Math.max(1, categories.length);
  const axisType = spec.yAxis?.type || yEncodings[0]?.type || 'linear';
  const transform = value => axisType === 'log' ? Math.log10(Math.max(0.000001, Number(value))) : Number(value);
  const transformedMin = transform(min), transformedMax = transform(max);
  const y = value => plot.y + plot.height - ((transform(value) - transformedMin) / (transformedMax - transformedMin || 1)) * plot.height;
  const yRightNumbers = data.rows.map(row => Number(row[yEncodings[1]?.field])).filter(Number.isFinite);
  const rightMin = Math.min(0, ...(yRightNumbers.length ? yRightNumbers : [0])), rightMax = Math.max(1, ...(yRightNumbers.length ? yRightNumbers : [1]));
  const rightType = spec.yAxis?.right?.type || yEncodings[1]?.type || 'linear';
  const rightTransform = value => rightType === 'log' ? Math.log10(Math.max(0.000001, Number(value))) : Number(value);
  const yRight = value => plot.y + plot.height - ((rightTransform(value) - rightTransform(rightMin)) / (rightTransform(rightMax) - rightTransform(rightMin) || 1)) * plot.height;
  return { plot, xField, xEncoding, temporal, xMin, xMax, yField, yEncodings, categories, min, max, rightMin, rightMax, x, y, yRight, axisType, rightType };
}

function addText(scene, id, text, x, y, style = {}, dataRef = null) { scene.add(new SceneNode({ id, type: 'text', geometry: { text: String(text), x, y }, style, dataRef })); }

function addAxes(scene, spec, state) {
  const { plot, categories, min, max, x, y, yRight } = state;
  scene.add(new SceneNode({ id: 'axis-x', type: 'line', geometry: { x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height }, style: { stroke: '#94a3b8' } }));
  scene.add(new SceneNode({ id: 'axis-y', type: 'line', geometry: { x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height }, style: { stroke: '#94a3b8' } }));
  const labels = state.temporal ? timeTicks(state.xMin, state.xMax, 5) : categories;
  labels.forEach(category => addText(scene, `label-x-${category}`, state.temporal ? formatTime(category, state.xMax - state.xMin) : category, x(category), plot.y + plot.height + 22, { fill: '#475569', font: '12px system-ui', textAnchor: 'middle' }));
  [min, min + (max - min) / 2, max].forEach(value => addText(scene, `label-y-${value}`, Number(value.toFixed(2)), plot.x - 10, y(value) + 4, { fill: '#475569', font: '12px system-ui', textAnchor: 'end' }));
  if (state.yEncodings.length > 1) [state.rightMin, (state.rightMin + state.rightMax) / 2, state.rightMax].forEach(value => addText(scene, `label-y-right-${value}`, Number(value.toFixed(2)), plot.x + plot.width + 10, yRight(value) + 4, { fill: '#475569', font: '12px system-ui' }));
}

function hexRgb(value) { const hex = String(value || '').replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(hex)) return [37, 99, 235]; return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16)); }
function colorMix(start, end, ratio) { const left = hexRgb(start), right = hexRgb(end), value = Math.max(0, Math.min(1, ratio)); return `rgb(${left.map((channel, index) => Math.round(channel + (right[index] - channel) * value)).join(',')})`; }

function addHeatmapScene(scene, spec, data, state, colors) {
  const xField = spec.encoding.x?.field || 'x', yField = spec.encoding.y?.field || 'y', valueField = spec.encoding.color?.field || 'value';
  const xValues = [...new Set(data.rows.map(row => String(row[xField])))], yValues = [...new Set(data.rows.map(row => String(row[yField])))];
  const numericValue = row => row[valueField] == null || row[valueField] === '' ? null : Number(row[valueField]);
  const values = data.rows.map(numericValue).filter(Number.isFinite), min = spec.colorScale?.domain?.[0] ?? Math.min(...values, 0), max = spec.colorScale?.domain?.[1] ?? Math.max(...values, 1);
  const low = spec.colorScale?.range?.[0] || '#dbeafe', high = spec.colorScale?.range?.at(-1) || colors[0], missing = spec.colorScale?.missing || '#e2e8f0';
  const gap = Math.max(0, Number(spec.cellPadding ?? 2)), width = state.plot.width / Math.max(1, xValues.length), height = state.plot.height / Math.max(1, yValues.length);
  xValues.forEach((value, index) => addText(scene, `heatmap-x-${index}`, value, state.plot.x + (index + .5) * width, state.plot.y + state.plot.height + 20, { fill: '#475569', font: '12px system-ui', textAnchor: 'middle' }));
  yValues.forEach((value, index) => addText(scene, `heatmap-y-${index}`, value, state.plot.x - 10, state.plot.y + (index + .5) * height + 4, { fill: '#475569', font: '12px system-ui', textAnchor: 'end' }));
  data.rows.forEach((row, index) => { const xIndex = xValues.indexOf(String(row[xField])), yIndex = yValues.indexOf(String(row[yField])), value = numericValue(row), geometry = { x: state.plot.x + xIndex * width + gap / 2, y: state.plot.y + yIndex * height + gap / 2, width: Math.max(1, width - gap), height: Math.max(1, height - gap) }; scene.add(new SceneNode({ id: `heatmap-cell-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill: Number.isFinite(value) ? colorMix(low, high, (value - min) / (max - min || 1)) : missing, stroke: '#ffffff', strokeWidth: 1 }, dataRef: { dataIndex: index, x: row[xField], y: row[yField], value: Number.isFinite(value) ? value : null, recordId: row.id || `record-${index}` }, interactive: true })); });
  state.matrix = { xValues, yValues, min, max };
}

function addRadarScene(scene, spec, data, state, colors) {
  const indicators = spec.indicators, cx = state.plot.x + state.plot.width / 2, cy = state.plot.y + state.plot.height / 2, radius = Math.min(state.plot.width, state.plot.height) * .38;
  if (indicators.some(indicator => !Number.isFinite(Number(indicator.min)) || !Number.isFinite(Number(indicator.max)))) data.warnings.push({ code: 'AMBIGUOUS_RADAR_DOMAIN', message: 'Declare finite min and max for every radar indicator, especially for mixed units.' });
  const point = (indicator, index, ratio = 1) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / indicators.length; return { x: cx + Math.cos(angle) * radius * ratio, y: cy + Math.sin(angle) * radius * ratio }; };
  [0.25, 0.5, 0.75, 1].forEach((ratio, level) => scene.add(new SceneNode({ id: `radar-grid-${level}`, type: 'path', geometry: { points: indicators.map((indicator, index) => point(indicator, index, ratio)), closed: true }, style: { fill: 'none', stroke: '#cbd5e1', strokeWidth: 1 } })));
  indicators.forEach((indicator, index) => { const edge = point(indicator, index); scene.add(new SceneNode({ id: `radar-axis-${index}`, type: 'line', geometry: { x1: cx, y1: cy, x2: edge.x, y2: edge.y }, style: { stroke: '#cbd5e1' } })); const label = point(indicator, index, 1.14); addText(scene, `radar-label-${index}`, indicator.name || indicator.field, label.x, label.y + 4, { fill: '#475569', font: '12px system-ui', textAnchor: 'middle' }); });
  data.rows.forEach((row, seriesIndex) => { const points = indicators.map((indicator, index) => { const min = Number(indicator.min ?? 0), max = Number(indicator.max ?? 1), raw = row[indicator.field], value = raw == null || raw === '' ? NaN : Number(raw); if (!Number.isFinite(value)) data.warnings.push({ code: 'INVALID_RADAR_VALUE', path: `rows.${seriesIndex}.${indicator.field}`, message: 'Radar indicator value must be numeric.' }); return point(indicator, index, Number.isFinite(value) ? Math.max(0, Math.min(1, (value - min) / (max - min || 1))) : 0); }); scene.add(new SceneNode({ id: `radar-series-${seriesIndex}`, type: 'path', geometry: { points, closed: true }, style: { fill: `${colors[seriesIndex % colors.length]}33`, stroke: colors[seriesIndex % colors.length], strokeWidth: 2 }, dataRef: { dataIndex: seriesIndex, recordId: row.id || `record-${seriesIndex}` } })); points.forEach((position, indicatorIndex) => scene.add(new SceneNode({ id: `radar-item-${seriesIndex}-${indicatorIndex}`, type: 'circle', geometry: { cx: position.x, cy: position.y, r: 4 }, bounds: { x: position.x - 7, y: position.y - 7, width: 14, height: 14 }, style: { fill: colors[seriesIndex % colors.length] }, dataRef: { dataIndex: seriesIndex, indicatorIndex, field: indicators[indicatorIndex].field, recordId: row.id || `record-${seriesIndex}` }, interactive: true }))); });
  state.indicators = indicators.map(indicator => ({ ...indicator }));
}

function timeTicks(min, max, count) { return Array.from({ length: count }, (_, index) => min + (max - min) * index / Math.max(1, count - 1)); }
function formatTime(value, span) { const date = new Date(value); if (span > 1000 * 86400000 * 365) return String(date.getUTCFullYear()); if (span > 1000 * 86400000 * 60) return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`; return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`; }

function projectRows(spec, data) { return data.rows.length ? data.rows : (spec.tasks || spec.events || []); }
function projectDate(value, min, max, plot) { const time = new Date(value).getTime(); return plot.x + ((time - min) / (max - min || 1)) * plot.width; }
function addProjectAxes(scene, plot, min, max) { scene.add(new SceneNode({ id: 'project-axis', type: 'line', geometry: { x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height }, style: { stroke: '#94a3b8' } })); timeTicks(min, max, 5).forEach(value => addText(scene, `project-label-${value}`, formatTime(value, max - min), projectDate(value, min, max, plot), plot.y + plot.height + 22, { fill: '#475569', font: '12px system-ui', textAnchor: 'middle' })); }
function addProjectScene(scene, spec, data, state, colors) {
  const { plot } = state;
  if (['gantt', 'timeline', 'milestone'].includes(spec.type)) {
    const rows = projectRows(spec, data), dates = rows.flatMap(row => [new Date(row.start || row.date || row.end).getTime(), new Date(row.end || row.date || row.start).getTime()]).filter(Number.isFinite), min = Math.min(...(dates.length ? dates : [Date.now()])), max = Math.max(...(dates.length ? dates : [min + 86400000]));
    addProjectAxes(scene, plot, min, max);
    const positions = new Map(); rows.forEach((row, index) => { const y = plot.y + (index + 0.5) * plot.height / Math.max(1, rows.length), start = projectDate(row.start || row.date || row.end, min, max, plot), end = projectDate(row.end || row.date || row.start, min, max, plot), x = Math.min(start, end), width = Math.max(8, Math.abs(end - start)); positions.set(row.id, { x, y, end, row }); const milestone = spec.type === 'milestone' || row.milestone || start === end; const geometry = milestone ? { cx: start, cy: y, r: 7 } : { x, y: y - 10, width, height: 20 }; scene.add(new SceneNode({ id: `project-item-${index}`, type: milestone ? 'circle' : 'rect', geometry, bounds: milestone ? { x: start - 10, y: y - 10, width: 20, height: 20 } : geometry, style: { fill: colors[index % colors.length], stroke: '#ffffff', strokeWidth: 1 }, dataRef: { dataIndex: index, taskId: row.id, field: 'project' }, interactive: true })); addText(scene, `project-label-${index}`, row.name || row.title || row.label || row.id || `Item ${index + 1}`, plot.x - 8, y + 4, { fill: '#334155', font: '12px system-ui', textAnchor: 'end' }); if (row.progress != null && !milestone) scene.add(new SceneNode({ id: `project-progress-${index}`, type: 'rect', geometry: { x, y: y - 10, width: width * Math.max(0, Math.min(1, Number(row.progress) > 1 ? Number(row.progress) / 100 : Number(row.progress))), height: 20 }, style: { fill: '#0f172a', opacity: 0.25 }, interactive: false })); });
    const criticalPath = new Set(spec.criticalPath || []);
    rows.forEach((row, index) => (row.dependencies || []).forEach((dependency, dependencyIndex) => { const from = positions.get(dependency), to = positions.get(row.id); if (!from || !to) return; const critical = criticalPath.has(row.id) && criticalPath.has(dependency); const angle = Math.atan2(to.y - from.y, to.x - from.end), arrow = 7; scene.add(new SceneNode({ id: `dependency-${index}-${dependencyIndex}`, type: 'line', geometry: { x1: from.end, y1: from.y, x2: to.x, y2: to.y }, style: { stroke: critical ? '#dc2626' : '#64748b', strokeWidth: critical ? 2.5 : 1.5, opacity: 0.85 }, dataRef: { from: dependency, to: row.id, critical }, interactive: false, zIndex: -1 })); scene.add(new SceneNode({ id: `dependency-arrow-${index}-${dependencyIndex}`, type: 'path', geometry: { points: [{ x: to.x, y: to.y }, { x: to.x - arrow * Math.cos(angle - Math.PI / 6), y: to.y - arrow * Math.sin(angle - Math.PI / 6) }, { x: to.x - arrow * Math.cos(angle + Math.PI / 6), y: to.y - arrow * Math.sin(angle + Math.PI / 6) }] }, style: { stroke: critical ? '#dc2626' : '#64748b', fill: critical ? '#dc2626' : '#64748b', strokeWidth: 1 }, interactive: false, zIndex: -1 })); }));
    return;
  }
  if (spec.type === 'burndown') {
    const rows = projectRows(spec, data), dates = rows.map(row => new Date(row.date).getTime()).filter(Number.isFinite), min = Math.min(...(dates.length ? dates : [Date.now()])), max = Math.max(...(dates.length ? dates : [min + 86400000])), values = rows.map(row => Number(row.remaining ?? row.actual ?? row.value)).filter(Number.isFinite), maxValue = Math.max(1, ...values, ...rows.map(row => Number(row.ideal)).filter(Number.isFinite)); addProjectAxes(scene, plot, min, max); const point = row => ({ x: projectDate(row.date, min, max, plot), y: plot.y + plot.height - (Number(row.remaining ?? row.actual ?? row.value) / maxValue) * plot.height }); const actual = rows.map(point).filter(point => Number.isFinite(point.y)); if (actual.length > 1) scene.add(new SceneNode({ id: 'burndown-actual', type: 'path', geometry: { points: actual }, style: { stroke: colors[0], strokeWidth: 2 } })); const ideal = rows.map((row, index) => ({ x: projectDate(row.date, min, max, plot), y: plot.y + plot.height - (Number(row.ideal ?? maxValue * (1 - index / Math.max(1, rows.length - 1))) / maxValue) * plot.height })); if (ideal.length > 1) scene.add(new SceneNode({ id: 'burndown-ideal', type: 'path', geometry: { points: ideal }, style: { stroke: '#94a3b8', strokeWidth: 1, opacity: 0.8 } })); rows.forEach((row, index) => { if (index && Number(row.scopeChange)) { const x = projectDate(row.date, min, max, plot); scene.add(new SceneNode({ id: `burndown-scope-${index}`, type: 'line', geometry: { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height }, style: { stroke: '#f59e0b', strokeWidth: 1.5, opacity: 0.8 }, dataRef: { dataIndex: index, field: 'scopeChange', datum: row } })); } }); actual.forEach((point, index) => scene.add(new SceneNode({ id: `burndown-item-${index}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 4 }, bounds: { x: point.x - 7, y: point.y - 7, width: 14, height: 14 }, style: { fill: colors[0] }, dataRef: { dataIndex: index, field: 'remaining', datum: rows[index] }, interactive: true }))); const last = actual.at(-1), lastRow = rows.at(-1); if (last && lastRow && Number(lastRow.remaining ?? lastRow.actual ?? lastRow.value) > 0 && rows.length > 1) { const slope = (Number(lastRow.remaining ?? lastRow.actual ?? lastRow.value) - Number(rows[0].remaining ?? rows[0].actual ?? rows[0].value)) / Math.max(1, dates.length - 1), projected = slope < 0 ? new Date(new Date(lastRow.date).getTime() + Math.ceil(Number(lastRow.remaining ?? lastRow.actual ?? lastRow.value) / -slope) * 86400000) : null; if (projected) addText(scene, 'burndown-projected', `Projected ${formatTime(projected, max - min)}`, Math.min(plot.x + plot.width, last.x + 12), plot.y + 18, { fill: '#dc2626', font: '12px system-ui' }); } return;
  }
  if (['flow', 'swimlane'].includes(spec.type)) {
    const nodes = spec.nodes || spec.data.nodes || [], edges = spec.edges || spec.data.edges || [], lanes = spec.lanes || spec.data.lanes || [], laneHeight = plot.height / Math.max(1, lanes.length || 1); const nodeMap = new Map(); nodes.forEach((node, index) => { const laneIndex = lanes.length ? Math.max(0, lanes.findIndex(lane => lane.id === node.laneId)) : 0, columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length))), column = index % columns, row = Math.floor(index / columns), x = plot.x + (column + 0.5) * plot.width / columns, y = lanes.length ? plot.y + laneIndex * laneHeight + laneHeight / 2 : plot.y + (row + 0.5) * plot.height / Math.max(1, Math.ceil(nodes.length / columns)); nodeMap.set(node.id, { ...node, x, y }); if (lanes.length) { scene.add(new SceneNode({ id: `lane-${laneIndex}`, type: 'rect', geometry: { x: plot.x, y: plot.y + laneIndex * laneHeight, width: plot.width, height: laneHeight }, style: { fill: laneIndex % 2 ? '#f8fafc' : '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 }, interactive: false })); addText(scene, `lane-label-${laneIndex}`, lanes[laneIndex].label || lanes[laneIndex].id, plot.x - 8, plot.y + laneIndex * laneHeight + 18, { fill: '#475569', font: '12px system-ui', textAnchor: 'end' }); } }); edges.forEach((edge, index) => { const from = nodeMap.get(edge.from), to = nodeMap.get(edge.to); if (!from || !to) return; scene.add(new SceneNode({ id: `edge-${index}`, type: 'line', geometry: { x1: from.x, y1: from.y, x2: to.x, y2: to.y }, style: { stroke: '#64748b', strokeWidth: 1.5 }, dataRef: { edgeIndex: index, from: edge.from, to: edge.to } })); }); nodeMap.forEach((node, id) => { const geometry = { x: node.x - 48, y: node.y - 18, width: 96, height: 36 }; scene.add(new SceneNode({ id: `node-${id}`, type: 'rect', geometry, bounds: geometry, style: { fill: colors[0], stroke: '#ffffff', strokeWidth: 1 }, dataRef: { nodeId: id, field: 'node' }, interactive: true })); addText(scene, `node-label-${id}`, node.label || id, node.x, node.y + 4, { fill: '#ffffff', font: '12px system-ui', textAnchor: 'middle' }); });
  }
}

export function buildScene(spec) {
  if (['gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane'].includes(spec.type)) return buildProjectScene(spec);
  const data = spec.transform ? applyTransforms(spec.data, spec.transform) : normalizeData(spec.data);
  if (spec.view && (spec.view.start !== undefined || spec.view.end !== undefined)) {
    const start = Math.max(0, Number(spec.view.start) || 0), end = Math.min(data.rows.length, spec.view.end === undefined ? data.rows.length : Number(spec.view.end));
    data.rows = data.rows.slice(start, Math.max(start, end));
    data.viewOffset = start;
  }
  const scene = new Scene(spec.width, spec.height);
  const state = layout(spec, data);
  const colors = spec.colors;
  if (spec.title?.text) addText(scene, 'title', spec.title.text, spec.width / 2, 24, { fill: '#0f172a', font: '600 16px system-ui', textAnchor: 'middle' });
  if (!['pie', 'funnel', 'gauge', 'heatmap', 'radar', 'gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane'].includes(spec.type)) addAxes(scene, spec, state);
  const hasDiagramNodes = ['flow', 'swimlane'].includes(spec.type) && (spec.nodes || spec.data.nodes)?.length;
  if (!data.rows.length && !hasDiagramNodes) { addText(scene, 'empty', spec.emptyText || 'No data', spec.width / 2, spec.height / 2, { fill: '#64748b', font: '14px system-ui', textAnchor: 'middle' }); return { scene, data, state }; }
  if (['gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane'].includes(spec.type)) { addProjectScene(scene, spec, data, state, colors); return { scene, data, state }; }
  const yField = state.yField;
  const series = Array.isArray(spec.encoding.y) ? spec.encoding.y : [{ ...spec.encoding.y, name: spec.encoding.y?.name || spec.encoding.y?.field }];
  if (spec.type === 'heatmap') addHeatmapScene(scene, spec, data, state, colors);
  else if (spec.type === 'radar') addRadarScene(scene, spec, data, state, colors);
  else if (spec.type === 'line' || spec.type === 'area') {
    series.forEach((encoding, seriesIndex) => { const yMap = seriesIndex === 1 ? state.yRight : state.y; const points = data.rows.map((row, index) => ({ x: state.x(pick(row, spec.encoding.x, 'name')), y: yMap(row[encoding.field]), row, index })).filter(point => Number.isFinite(point.y)); if (spec.type === 'area' && points.length && seriesIndex === 0) scene.add(new SceneNode({ id: `area-fill-${seriesIndex}`, type: 'path', geometry: { points: [{ x: points[0].x, y: state.plot.y + state.plot.height }, ...points.map(point => ({ x: point.x, y: point.y })), { x: points.at(-1).x, y: state.plot.y + state.plot.height }] }, style: { fill: `${colors[seriesIndex]}22`, stroke: 'transparent' } })); if (points.length > 1) scene.add(new SceneNode({ id: `series-${seriesIndex}-line`, type: 'path', geometry: { points }, style: { stroke: colors[seriesIndex], strokeWidth: 2, fill: 'none' } })); points.forEach(point => scene.add(new SceneNode({ id: `series-${seriesIndex}-item-${point.index}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 5 }, bounds: { x: point.x - 8, y: point.y - 8, width: 16, height: 16 }, style: { fill: colors[seriesIndex] }, dataRef: { seriesIndex, dataIndex: point.index, field: encoding.field }, interactive: true }))); });
  } else if (spec.type === 'bar' || spec.type === 'column') {
    const band = state.plot.width / Math.max(1, state.categories.length), bar = band * 0.58;
    const mode = typeof spec.stack === 'string' ? spec.stack : spec.stack?.mode, accumulators = data.rows.map(() => ({ positive: 0, negative: 0 }));
    series.forEach((encoding, seriesIndex) => { if (encoding.mark === 'line') { const yMap = encoding.axis === 'right' ? state.yRight : state.y, points = data.rows.map((row, index) => ({ x: state.x(row[state.xField]), y: yMap(row[encoding.field]), index })).filter(point => Number.isFinite(point.y)); if (points.length > 1) scene.add(new SceneNode({ id: `series-${seriesIndex}-line`, type: 'path', geometry: { points }, style: { fill: 'none', stroke: colors[seriesIndex], strokeWidth: 2 } })); points.forEach(point => scene.add(new SceneNode({ id: `series-${seriesIndex}-item-${point.index}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 4 }, bounds: { x: point.x - 7, y: point.y - 7, width: 14, height: 14 }, style: { fill: colors[seriesIndex] }, dataRef: { seriesIndex, dataIndex: point.index, field: encoding.field }, interactive: true }))); return; } data.rows.forEach((row, index) => { let value = Number(row[encoding.field]) || 0; const total = series.filter(item => item.mark !== 'line').reduce((sum, item) => sum + Math.abs(Number(row[item.field]) || 0), 0) || 1; if (mode === 'percent') value /= total; const accumulator = value >= 0 ? 'positive' : 'negative', start = mode ? accumulators[index][accumulator] : 0, end = start + value; if (mode) accumulators[index][accumulator] = end; const yMap = encoding.axis === 'right' ? state.yRight : state.y, base = yMap(start), valueY = yMap(end); const vertical = spec.type === 'column'; const geometry = vertical ? { x: state.x(row[state.xField]) - bar / 2 + (mode ? 0 : seriesIndex * bar / Math.max(1, series.length)), y: Math.min(base, valueY), width: mode ? bar : bar / Math.max(1, series.length), height: Math.abs(base - valueY) } : { x: state.plot.x + ((start - state.min) / (state.max - state.min || 1)) * state.plot.width, y: state.plot.y + index * state.plot.height / data.rows.length + 5 + (mode ? 0 : seriesIndex * 3), width: Math.abs(value / (state.max - state.min || 1) * state.plot.width), height: Math.max(6, state.plot.height / data.rows.length - 10) }; scene.add(new SceneNode({ id: `series-${seriesIndex}-item-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill: colors[seriesIndex] }, dataRef: { seriesIndex, dataIndex: index, field: encoding.field, stackStart: start, stackEnd: end }, interactive: true })); }); });
  } else if (spec.type === 'scatter') {
    data.rows.forEach((row, index) => { const xValue = Number(row[state.xField]), yValue = Number(row[state.yField]); if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) return; const geometry = { cx: state.plot.x + ((xValue - state.min) / (state.max - state.min || 1)) * state.plot.width, cy: state.y(yValue), r: 5 }; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'circle', geometry, bounds: { x: geometry.cx - 8, y: geometry.cy - 8, width: 16, height: 16 }, style: { fill: colors[0] }, dataRef: { seriesIndex: 0, dataIndex: index }, interactive: true })); });
  } else if (spec.type === 'pie') {
    const categoryField = spec.encoding.category?.field || 'name', valueField = spec.encoding.value?.field || 'value', total = data.rows.reduce((sum, row) => sum + Math.max(0, Number(row[valueField]) || 0), 0) || 1, cx = spec.width / 2, cy = spec.height / 2 + 12, radius = Math.min(spec.width, spec.height) * 0.28, innerR = radius * Number(spec.innerRadius || 0); let angle = -Math.PI / 2;
    data.rows.forEach((row, index) => { const value = Math.max(0, Number(row[valueField]) || 0), end = angle + value / total * Math.PI * 2; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'arc', geometry: { cx, cy, r: radius, innerR, start: angle, end }, bounds: { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }, style: { fill: colors[index % colors.length], stroke: '#ffffff', strokeWidth: 1 }, dataRef: { seriesIndex: 0, dataIndex: index, category: row[categoryField], value }, interactive: true })); angle = end; });
  } else if (spec.type === 'funnel') {
    const valueField = spec.encoding.value?.field || 'value'; const maxValue = Math.max(...data.rows.map(row => Number(row[valueField]) || 0), 1); const segmentHeight = state.plot.height / data.rows.length;
    data.rows.forEach((row, index) => { const ratio = Math.max(0.1, (Number(row[valueField]) || 0) / maxValue); const width = state.plot.width * ratio; const geometry = { x: state.plot.x + (state.plot.width - width) / 2, y: state.plot.y + index * segmentHeight, width, height: Math.max(2, segmentHeight - 3) }; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill: colors[index % colors.length] }, dataRef: { seriesIndex: 0, dataIndex: index }, interactive: true })); });
  } else if (spec.type === 'gauge') {
    const valueField = spec.encoding.value?.field || 'value', value = Math.max(0, Math.min(100, Number(data.rows[0]?.[valueField]) || 0)), cx = spec.width / 2, cy = spec.height * 0.62, radius = Math.min(spec.width, spec.height) * 0.3, start = Math.PI, end = start + Math.PI * value / 100;
    scene.add(new SceneNode({ id: 'gauge-background', type: 'arc', geometry: { cx, cy, r: radius, start: Math.PI, end: Math.PI * 2 }, style: { fill: '#e2e8f0' } })); scene.add(new SceneNode({ id: 'gauge-value', type: 'arc', geometry: { cx, cy, r: radius, start, end }, style: { fill: colors[0] }, dataRef: { seriesIndex: 0, dataIndex: 0, value }, interactive: true })); addText(scene, 'gauge-label', `${value}%`, cx, cy - 12, { fill: '#0f172a', font: '600 24px system-ui', textAnchor: 'middle' });
  }
  return { scene, data, state };
}
