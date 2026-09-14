import { Scene } from './scene.mjs';
import { normalizeData } from './data.mjs';

export const projectTypes = ['gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane'];
const day = 86400000;
export const timestamp = value => value == null || value === '' ? NaN : new Date(value).getTime();
const dateLabel = value => new Date(value).toISOString().slice(0, 10);

export function criticalSchedule(rows) {
  const tasks = new Map(rows.map(row => [row.id, { id: row.id, duration: (timestamp(row.end) - timestamp(row.start)) / day, dependencies: row.dependencies || [], successors: [] }]));
  tasks.forEach(task => task.dependencies.forEach(id => tasks.get(id).successors.push(task.id)));
  const order = [], pending = new Map([...tasks].map(([id, task]) => [id, task.dependencies.length]));
  const queue = [...tasks.keys()].filter(id => !pending.get(id));
  for (let index = 0; index < queue.length; index += 1) {
    const task = tasks.get(queue[index]);
    task.earliestStart = Math.max(0, ...task.dependencies.map(id => tasks.get(id).earliestFinish));
    task.earliestFinish = task.earliestStart + task.duration;
    order.push(task);
    task.successors.forEach(id => { pending.set(id, pending.get(id) - 1); if (!pending.get(id)) queue.push(id); });
  }
  if (order.length !== rows.length) throw new Error('Cyclic task dependencies');
  const duration = Math.max(0, ...order.map(task => task.earliestFinish));
  [...order].reverse().forEach(task => {
    task.latestFinish = task.successors.length ? Math.min(...task.successors.map(id => tasks.get(id).latestStart)) : duration;
    task.latestStart = task.latestFinish - task.duration;
    task.float = Math.max(0, task.latestStart - task.earliestStart);
    task.critical = task.float < 1e-8;
  });
  const criticalIds = order.filter(task => task.critical).map(task => task.id);
  const criticalEdges = order.flatMap(task => task.dependencies.filter(id => task.critical && tasks.get(id).critical && Math.abs(tasks.get(id).earliestFinish - task.earliestStart) < 1e-8).map(from => ({ from, to: task.id })));
  return { duration, criticalIds, criticalEdges, tasks: order };
}

export function analyzeBurndown(rows, options = {}) {
  const samples = rows.map((row, dataIndex) => ({ ...row, dataIndex, time: timestamp(row.date), remaining: Number(row.remaining ?? row.actual ?? row.value), scopeChange: Number(row.scopeChange || 0) })).sort((left, right) => left.time - right.time);
  if (!samples.length) return { samples, forecast: { date: null, reason: 'insufficient-data' } };
  const first = samples[0], last = samples.at(-1);
  const initial = options.initialScope ?? first.remaining;
  let cumulativeScope = initial;
  samples.forEach(sample => {
    cumulativeScope += sample.scopeChange;
    sample.scope = cumulativeScope;
    sample.completed = cumulativeScope - sample.remaining;
  });
  const elapsedDays = (last.time - first.time) / day;
  const completedSinceFirst = last.completed - first.completed;
  const velocity = elapsedDays > 0 ? completedSinceFirst / elapsedDays : 0;
  let forecast = { date: null, velocity, reason: samples.length < 2 ? 'insufficient-data' : 'non-positive-velocity' };
  if (last.remaining === 0) forecast = { date: dateLabel(last.time), velocity, reason: 'complete' };
  else if (velocity > 0) {
    const projectedTime = last.time + last.remaining / velocity * day;
    if (Number.isFinite(projectedTime) && Math.abs(projectedTime) < 8.64e15) forecast = { date: dateLabel(projectedTime), time: projectedTime, velocity, reason: 'estimated' };
  }
  const start = options.start ? timestamp(options.start) : first.time;
  const end = options.end ? timestamp(options.end) : last.time;
  samples.forEach(sample => { sample.ideal = sample.ideal ?? Math.max(0, initial * (1 - (sample.time - start) / (end - start || day))); });
  return { samples, initialScope: initial, start, end, forecast };
}

function text(scene, id, content, x, y, style = {}) {
  scene.add({ id, type: 'text', geometry: { text: String(content), x, y }, style: { fill: '#334155', font: '12px system-ui', ...style }, zIndex: 4 });
}

function arrow(scene, id, points, reference, critical = false) {
  const color = critical ? '#dc2626' : '#64748b', tip = points.at(-1), previous = points.at(-2);
  const angle = Math.atan2(tip.y - previous.y, tip.x - previous.x), size = 7;
  scene.add({ id, type: 'path', geometry: { points }, style: { fill: 'none', stroke: color, strokeWidth: critical ? 2.5 : 1.5 }, dataRef: reference, zIndex: 1 });
  scene.add({ id: id.startsWith('dependency-') ? id.replace('dependency-', 'dependency-arrow-') : `${id}-arrow`, type: 'path', geometry: { points: [tip, { x: tip.x - size * Math.cos(angle - Math.PI / 6), y: tip.y - size * Math.sin(angle - Math.PI / 6) }, { x: tip.x - size * Math.cos(angle + Math.PI / 6), y: tip.y - size * Math.sin(angle + Math.PI / 6) }, tip] }, style: { fill: color, stroke: color }, zIndex: 3 });
}

function timeAxis(scene, plot, min, max) {
  const map = value => plot.x + (timestamp(value) - min) / (max - min) * plot.width;
  const ticks = Math.max(2, Math.min(5, Math.floor(plot.width / 100)));
  for (let index = 0; index < ticks; index += 1) {
    const time = min + (max - min) * index / (ticks - 1), x = map(time);
    scene.add({ id: `project-grid-${index}`, type: 'line', geometry: { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height }, style: { stroke: '#e2e8f0' } });
    text(scene, `project-tick-${index}`, dateLabel(time), x, plot.y + plot.height + 22, { textAnchor: index === 0 ? 'start' : index === ticks - 1 ? 'end' : 'middle', font: '11px system-ui' });
  }
  return map;
}

function tasksScene(scene, spec, rows, state) {
  const plot = state.plot;
  const times = rows.flatMap(row => [timestamp(row.start ?? row.date ?? row.end), timestamp(row.end ?? row.date ?? row.start)]);
  let min = Math.min(...times), max = Math.max(...times);
  if (min === max) { min -= day; max += day; }
  const map = timeAxis(scene, plot, min, max), positions = new Map();
  if (spec.type === 'gantt') state.schedule = criticalSchedule(rows);
  const highlighted = new Set(spec.criticalPath === false ? [] : Array.isArray(spec.criticalPath) ? spec.criticalPath : state.schedule?.criticalIds || []);
  const rowHeight = Math.max(32, plot.height / rows.length);
  rows.forEach((row, index) => {
    const start = map(row.start ?? row.date ?? row.end), end = map(row.end ?? row.date ?? row.start);
    const y = plot.y + (index + 0.5) * rowHeight, milestone = spec.type === 'milestone' || row.milestone || start === end;
    const geometry = milestone ? { cx: start, cy: y, r: 7 } : { x: start, y: y - 10, width: Math.max(2, end - start), height: 20 };
    const bounds = milestone ? { x: start - 8, y: y - 8, width: 16, height: 16 } : { ...geometry };
    const schedule = state.schedule?.tasks.find(task => task.id === row.id);
    const datum = { ...row, ...(schedule ? { critical: schedule.critical, float: schedule.float } : {}) };
    scene.add({ id: `project-item-${index}`, type: milestone ? 'circle' : 'rect', geometry, bounds, style: { fill: highlighted.has(row.id) ? '#dc2626' : row.status === 'done' ? '#16a34a' : spec.colors[index % spec.colors.length] }, dataRef: { dataIndex: index, taskId: row.id, datum }, interactive: true, zIndex: 2 });
    positions.set(row.id, { start, end, y });
    const label = row.name || row.title || row.label || row.id || `Item ${index + 1}`;
    text(scene, `project-label-${index}`, label.length > 17 ? `${label.slice(0, 16)}…` : label, plot.x - 12, y + 4, { textAnchor: 'end' });
    if (row.progress != null && !milestone) scene.add({ id: `project-progress-${index}`, type: 'rect', geometry: { ...geometry, width: geometry.width * (row.progress > 1 ? row.progress / 100 : row.progress) }, style: { fill: '#0f172a', opacity: 0.25 }, zIndex: 3 });
  });
  rows.forEach((row, index) => (row.dependencies || []).forEach((dependency, dependencyIndex) => {
    const from = positions.get(dependency), to = positions.get(row.id);
    const critical = highlighted.has(dependency) && highlighted.has(row.id) && (Array.isArray(spec.criticalPath) || state.schedule.criticalEdges.some(edge => edge.from === dependency && edge.to === row.id));
    const bend = from.end + 12;
    arrow(scene, `dependency-${index}-${dependencyIndex}`, [{ x: from.end, y: from.y }, { x: bend, y: from.y }, { x: bend, y: to.y - 15 }, { x: to.start - 10, y: to.y - 15 }, { x: to.start - 10, y: to.y }, { x: to.start, y: to.y }], { from: dependency, to: row.id, critical }, critical);
  }));
  state.timeDomain = [min, max];
}

function burndownScene(scene, spec, rows, state) {
  const analysis = analyzeBurndown(rows, spec.burndown), { samples, forecast } = analysis, plot = state.plot;
  state.burndown = analysis;
  const min = Math.min(analysis.start, samples[0].time), max = Math.max(analysis.end, samples.at(-1).time, forecast.time || 0, min + day);
  const map = timeAxis(scene, plot, min, max);
  const maxValue = Math.max(1, ...samples.flatMap(sample => [sample.remaining, sample.ideal, sample.scope]));
  const mapY = value => plot.y + plot.height - value / maxValue * plot.height;
  const series = [['remaining', 'actual', spec.colors[0]], ['ideal', 'ideal', '#94a3b8'], ['scope', 'scope-total', '#d97706']];
  series.forEach(([field, id, color]) => scene.add({ id: `burndown-${id}`, type: 'path', geometry: { points: samples.map(sample => ({ x: map(sample.time), y: mapY(sample[field]) })) }, style: { fill: 'none', stroke: color, strokeWidth: 2 } }));
  for (let index = 0; index <= 2; index += 1) text(scene, `burndown-y-${index}`, Number((maxValue * index / 2).toFixed(1)), plot.x - 12, mapY(maxValue * index / 2) + 4, { textAnchor: 'end' });
  samples.forEach(sample => {
    const x = map(sample.time), y = mapY(sample.remaining), index = sample.dataIndex;
    if (sample.scopeChange) scene.add({ id: `burndown-scope-${index}`, type: 'line', geometry: { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height }, style: { stroke: '#f59e0b' } });
    scene.add({ id: `burndown-item-${index}`, type: 'circle', geometry: { cx: x, cy: y, r: 5 }, bounds: { x: x - 8, y: y - 8, width: 16, height: 16 }, style: { fill: spec.colors[0] }, dataRef: { dataIndex: index, datum: { ...sample, forecast: forecast.date, forecastReason: forecast.reason } }, interactive: true, zIndex: 2 });
  });
  if (forecast.reason === 'estimated') {
    const last = samples.at(-1);
    scene.add({ id: 'burndown-forecast', type: 'path', geometry: { points: [{ x: map(last.time), y: mapY(last.remaining) }, { x: map(forecast.time), y: mapY(0) }] }, style: { fill: 'none', stroke: '#dc2626', strokeWidth: 2 } });
  }
  text(scene, 'burndown-projected', forecast.date ? `Estimated finish: ${forecast.date}` : `Forecast unavailable: ${forecast.reason}`, plot.x, plot.y - 16, { font: '11px system-ui' });
}

function diagramScene(scene, spec, rows, state) {
  const plot = state.plot, edges = spec.edges ?? spec.data.edges ?? [], lanes = spec.lanes ?? spec.data.lanes ?? [];
  const ranks = new Map(rows.map(row => [row.id, 0]));
  const pending = new Map(rows.map(row => [row.id, edges.filter(edge => edge.to === row.id).length]));
  const queue = rows.filter(row => pending.get(row.id) === 0).map(row => row.id);
  for (let index = 0; index < queue.length; index += 1) edges.filter(edge => edge.from === queue[index]).forEach(edge => {
    ranks.set(edge.to, Math.max(ranks.get(edge.to), ranks.get(edge.from) + 1));
    pending.set(edge.to, pending.get(edge.to) - 1);
    if (!pending.get(edge.to)) queue.push(edge.to);
  });
  rows.filter(row => !queue.includes(row.id)).forEach((row, index) => ranks.set(row.id, queue.length + index));
  const columns = Math.max(1, ...[...ranks.values()].map(rank => rank + 1));
  const gapX = Math.max(144, plot.width / columns), laneHeight = Math.max(80, plot.height / Math.max(1, lanes.length));
  const positions = new Map(), slots = new Map();
  lanes.forEach((lane, index) => {
    scene.add({ id: `lane-${index}`, type: 'rect', geometry: { x: plot.x, y: plot.y + index * laneHeight, width: Math.max(plot.width, columns * gapX), height: laneHeight }, style: { fill: index % 2 ? '#f1f5f9' : '#f8fafc', stroke: '#cbd5e1' }, zIndex: -1 });
    text(scene, `lane-label-${index}`, lane.label || lane.id, plot.x - 12, plot.y + index * laneHeight + 20, { textAnchor: 'end' });
  });
  rows.forEach((row, index) => {
    const rank = ranks.get(row.id), lane = Math.max(0, lanes.findIndex(item => item.id === row.laneId));
    const slotKey = `${lane}:${rank}`, slot = slots.get(slotKey) || 0;
    slots.set(slotKey, slot + 1);
    const sameCell = rows.filter(item => ranks.get(item.id) === rank && (!lanes.length || item.laneId === row.laneId)).length;
    const geometry = { x: row.position?.x ?? plot.x + rank * gapX + 12, y: row.position?.y ?? plot.y + (lanes.length ? lane * laneHeight : 0) + (slot + 0.5) * (lanes.length ? laneHeight : Math.max(plot.height, sameCell * 64)) / sameCell - 18, width: 112, height: 36 };
    positions.set(row.id, geometry);
    scene.add({ id: `node-${row.id}`, type: 'rect', geometry, bounds: { ...geometry }, style: { fill: spec.colors[lane % spec.colors.length] }, dataRef: { nodeId: row.id, dataIndex: index, datum: row }, interactive: true, zIndex: 2 });
    text(scene, `node-label-${row.id}`, row.label || row.id, geometry.x + 56, geometry.y + 23, { fill: '#ffffff', textAnchor: 'middle' });
  });
  edges.forEach((edge, index) => {
    const from = positions.get(edge.from), to = positions.get(edge.to), middle = (from.x + from.width + to.x) / 2;
    arrow(scene, `edge-${index}`, [{ x: from.x + from.width, y: from.y + 18 }, { x: middle, y: from.y + 18 }, { x: middle, y: to.y + 18 }, { x: to.x, y: to.y + 18 }], { from: edge.from, to: edge.to });
    if (edge.label) text(scene, `edge-label-${index}`, edge.label, middle, (from.y + to.y) / 2 + 10, { textAnchor: 'middle', font: '11px system-ui' });
  });
  state.nodePositions = Object.fromEntries(positions);
}

export function projectView(spec) {
  const view = spec.view || {};
  return { scale: Math.max(0.25, Math.min(8, Number(view.scale) || 1)), offsetX: Number(view.offsetX) || 0, offsetY: Number(view.offsetY) || 0 };
}

export function buildProjectScene(spec) {
  const diagram = ['flow', 'swimlane'].includes(spec.type);
  const rows = diagram ? spec.nodes ?? spec.data.nodes ?? [] : spec.data.values;
  const data = { ...normalizeData(rows), rows: rows.map(row => ({ ...row })) }, scene = new Scene(spec.width, spec.height);
  const left = ['gantt', 'timeline', 'milestone', 'swimlane'].includes(spec.type) ? Math.min(150, spec.width * 0.32) : spec.padding.left;
  const state = { plot: { x: left, y: spec.padding.top + (spec.type === 'burndown' ? 16 : 0), width: Math.max(1, spec.width - left - spec.padding.right), height: Math.max(1, spec.height - spec.padding.top - spec.padding.bottom - 16) } };
  if (!rows.length) text(scene, 'empty', spec.emptyText || 'No data', spec.width / 2, spec.height / 2, { textAnchor: 'middle' });
  else if (diagram) diagramScene(scene, spec, data.rows, state);
  else if (spec.type === 'burndown') burndownScene(scene, spec, data.rows, state);
  else tasksScene(scene, spec, data.rows, state);
  const view = projectView(spec), mapX = value => value * view.scale + view.offsetX, mapY = value => value * view.scale + view.offsetY;
  scene.walk(node => {
    const geometry = node.geometry;
    ['x', 'x1', 'x2', 'cx'].forEach(key => { if (geometry[key] != null) geometry[key] = mapX(geometry[key]); });
    ['y', 'y1', 'y2', 'cy'].forEach(key => { if (geometry[key] != null) geometry[key] = mapY(geometry[key]); });
    ['width', 'height', 'r'].forEach(key => { if (geometry[key] != null) geometry[key] *= view.scale; });
    if (geometry.points) geometry.points = geometry.points.map(point => ({ x: mapX(point.x), y: mapY(point.y) }));
    if (node.bounds) node.bounds = { x: mapX(node.bounds.x), y: mapY(node.bounds.y), width: node.bounds.width * view.scale, height: node.bounds.height * view.scale };
  });
  if (spec.title?.text) text(scene, 'title', spec.title.text, spec.width / 2, 24, { font: '600 16px system-ui', textAnchor: 'middle' });
  state.view = view;
  return { scene, data, state };
}

export function projectTooltip(type, row) {
  if (!row) return '';
  if (type === 'burndown') return [`Date: ${row.date}`, `Remaining: ${row.remaining ?? row.actual ?? row.value}`, `Scope change: ${row.scopeChange || 0}`, row.scope != null ? `Total scope: ${row.scope}` : null, row.completed != null ? `Completed: ${row.completed}` : null, row.forecast ? `Estimated finish: ${row.forecast}` : `Forecast: ${row.forecastReason || 'unavailable'}`].filter(Boolean).join('\n');
  return [row.name || row.title || row.label || row.id, row.start ? `${row.start} → ${row.end || row.start}` : row.date, row.progress != null ? `Progress: ${row.progress <= 1 ? Math.round(row.progress * 100) : row.progress}%` : null, row.status ? `Status: ${row.status}` : null, row.dependencies?.length ? `Depends on: ${row.dependencies.join(', ')}` : null, row.critical != null ? `Critical: ${row.critical ? 'yes' : 'no'} · Float: ${row.float} days` : null, row.laneId ? `Lane: ${row.laneId}` : null, row.description].filter(value => value != null && value !== '').join('\n');
}

export function rerouteDiagramScene(scene) {
  scene.walk(node => {
    if (!node.id.startsWith('edge-') || !node.dataRef?.from || !node.dataRef?.to) return;
    const source = scene.find(`node-${node.dataRef.from}`), destination = scene.find(`node-${node.dataRef.to}`);
    if (!source || !destination) return;
    const start = { x: source.geometry.x + source.geometry.width, y: source.geometry.y + source.geometry.height / 2 }, end = { x: destination.geometry.x, y: destination.geometry.y + destination.geometry.height / 2 }, middle = (start.x + end.x) / 2;
    node.geometry.points = [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end];
    const arrow = scene.find(`${node.id}-arrow`), beforeTip = node.geometry.points.at(-2);
    if (arrow) arrow.geometry.points = [end, { x: end.x - 7 * Math.cos(Math.atan2(end.y - beforeTip.y, end.x - beforeTip.x) - Math.PI / 6), y: end.y - 7 * Math.sin(Math.atan2(end.y - beforeTip.y, end.x - beforeTip.x) - Math.PI / 6) }, { x: end.x - 7 * Math.cos(Math.atan2(end.y - beforeTip.y, end.x - beforeTip.x) + Math.PI / 6), y: end.y - 7 * Math.sin(Math.atan2(end.y - beforeTip.y, end.x - beforeTip.x) + Math.PI / 6) }, end];
  });
  return scene;
}
