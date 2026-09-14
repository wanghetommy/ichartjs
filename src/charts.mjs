import { Scene, SceneNode } from './scene.mjs';
import { normalizeData } from './data.mjs';
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
  const numbers = data.rows.flatMap(row => yEncodings.map(encoding => Number(row[encoding.field]))).filter(Number.isFinite);
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
  const data = normalizeData(spec.data);
  if (spec.view && (spec.view.start !== undefined || spec.view.end !== undefined)) {
    const start = Math.max(0, Number(spec.view.start) || 0), end = Math.min(data.rows.length, spec.view.end === undefined ? data.rows.length : Number(spec.view.end));
    data.rows = data.rows.slice(start, Math.max(start, end));
    data.viewOffset = start;
  }
  const scene = new Scene(spec.width, spec.height);
  const state = layout(spec, data);
  const colors = spec.colors;
  if (spec.title?.text) addText(scene, 'title', spec.title.text, spec.width / 2, 24, { fill: '#0f172a', font: '600 16px system-ui', textAnchor: 'middle' });
  if (!['pie', 'funnel', 'gauge', 'gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane'].includes(spec.type)) addAxes(scene, spec, state);
  const hasDiagramNodes = ['flow', 'swimlane'].includes(spec.type) && (spec.nodes || spec.data.nodes)?.length;
  if (!data.rows.length && !hasDiagramNodes) { addText(scene, 'empty', spec.emptyText || 'No data', spec.width / 2, spec.height / 2, { fill: '#64748b', font: '14px system-ui', textAnchor: 'middle' }); return { scene, data, state }; }
  if (['gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane'].includes(spec.type)) { addProjectScene(scene, spec, data, state, colors); return { scene, data, state }; }
  const yField = state.yField;
  const series = Array.isArray(spec.encoding.y) ? spec.encoding.y : [{ ...spec.encoding.y, name: spec.encoding.y?.name || spec.encoding.y?.field }];
  if (spec.type === 'line' || spec.type === 'area') {
    series.forEach((encoding, seriesIndex) => { const yMap = seriesIndex === 1 ? state.yRight : state.y; const points = data.rows.map((row, index) => ({ x: state.x(pick(row, spec.encoding.x, 'name')), y: yMap(row[encoding.field]), row, index })).filter(point => Number.isFinite(point.y)); if (spec.type === 'area' && points.length && seriesIndex === 0) scene.add(new SceneNode({ id: `area-fill-${seriesIndex}`, type: 'path', geometry: { points: [{ x: points[0].x, y: state.plot.y + state.plot.height }, ...points.map(point => ({ x: point.x, y: point.y })), { x: points.at(-1).x, y: state.plot.y + state.plot.height }] }, style: { fill: `${colors[seriesIndex]}22`, stroke: 'transparent' } })); if (points.length > 1) scene.add(new SceneNode({ id: `series-${seriesIndex}-line`, type: 'path', geometry: { points }, style: { stroke: colors[seriesIndex], strokeWidth: 2, fill: spec.type === 'area' ? `${colors[seriesIndex]}22` : null } })); points.forEach(point => scene.add(new SceneNode({ id: `series-${seriesIndex}-item-${point.index}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 5 }, bounds: { x: point.x - 8, y: point.y - 8, width: 16, height: 16 }, style: { fill: colors[seriesIndex] }, dataRef: { seriesIndex, dataIndex: point.index, field: encoding.field }, interactive: true }))); });
  } else if (spec.type === 'bar' || spec.type === 'column') {
    const band = state.plot.width / Math.max(1, state.categories.length), bar = band * 0.58;
    series.forEach((encoding, seriesIndex) => { data.rows.forEach((row, index) => { const value = Number(row[encoding.field]) || 0, yMap = seriesIndex === 1 ? state.yRight : state.y, base = yMap(0), valueY = yMap(value); const vertical = spec.type === 'column'; const geometry = vertical ? { x: state.x(row[state.xField]) - bar / 2 + seriesIndex * bar / Math.max(1, series.length), y: Math.min(base, valueY), width: bar / Math.max(1, series.length), height: Math.abs(base - valueY) } : { x: state.plot.x, y: state.plot.y + index * state.plot.height / data.rows.length + 5 + seriesIndex * 3, width: Math.max(0, (value - state.min) / (state.max - state.min || 1) * state.plot.width), height: Math.max(6, state.plot.height / data.rows.length - 10) }; scene.add(new SceneNode({ id: `series-${seriesIndex}-item-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill: colors[seriesIndex] }, dataRef: { seriesIndex, dataIndex: index, field: encoding.field }, interactive: true })); }); });
  } else if (spec.type === 'scatter') {
    data.rows.forEach((row, index) => { const xValue = Number(row[state.xField]), yValue = Number(row[state.yField]); if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) return; const geometry = { cx: state.plot.x + ((xValue - state.min) / (state.max - state.min || 1)) * state.plot.width, cy: state.y(yValue), r: 5 }; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'circle', geometry, bounds: { x: geometry.cx - 8, y: geometry.cy - 8, width: 16, height: 16 }, style: { fill: colors[0] }, dataRef: { seriesIndex: 0, dataIndex: index }, interactive: true })); });
  } else if (spec.type === 'pie') {
    const categoryField = spec.encoding.category?.field || 'name', valueField = spec.encoding.value?.field || 'value', total = data.rows.reduce((sum, row) => sum + Math.max(0, Number(row[valueField]) || 0), 0) || 1, cx = spec.width / 2, cy = spec.height / 2 + 12, radius = Math.min(spec.width, spec.height) * 0.28; let angle = -Math.PI / 2;
    data.rows.forEach((row, index) => { const value = Math.max(0, Number(row[valueField]) || 0), end = angle + value / total * Math.PI * 2; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'arc', geometry: { cx, cy, r: radius, start: angle, end }, bounds: { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }, style: { fill: colors[index % colors.length], stroke: '#ffffff', strokeWidth: 1 }, dataRef: { seriesIndex: 0, dataIndex: index, category: row[categoryField], value }, interactive: true })); angle = end; });
  } else if (spec.type === 'funnel') {
    const valueField = spec.encoding.value?.field || 'value'; const maxValue = Math.max(...data.rows.map(row => Number(row[valueField]) || 0), 1); const segmentHeight = state.plot.height / data.rows.length;
    data.rows.forEach((row, index) => { const ratio = Math.max(0.1, (Number(row[valueField]) || 0) / maxValue); const width = state.plot.width * ratio; const geometry = { x: state.plot.x + (state.plot.width - width) / 2, y: state.plot.y + index * segmentHeight, width, height: Math.max(2, segmentHeight - 3) }; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill: colors[index % colors.length] }, dataRef: { seriesIndex: 0, dataIndex: index }, interactive: true })); });
  } else if (spec.type === 'gauge') {
    const valueField = spec.encoding.value?.field || 'value', value = Math.max(0, Math.min(100, Number(data.rows[0]?.[valueField]) || 0)), cx = spec.width / 2, cy = spec.height * 0.62, radius = Math.min(spec.width, spec.height) * 0.3, start = Math.PI, end = start + Math.PI * value / 100;
    scene.add(new SceneNode({ id: 'gauge-background', type: 'arc', geometry: { cx, cy, r: radius, start: Math.PI, end: Math.PI * 2 }, style: { fill: '#e2e8f0' } })); scene.add(new SceneNode({ id: 'gauge-value', type: 'arc', geometry: { cx, cy, r: radius, start, end }, style: { fill: colors[0] }, dataRef: { seriesIndex: 0, dataIndex: 0, value }, interactive: true })); addText(scene, 'gauge-label', `${value}%`, cx, cy - 12, { fill: '#0f172a', font: '600 24px system-ui', textAnchor: 'middle' });
  }
  return { scene, data, state };
}
