/**
 * Project-management and process visualization scene builders.
 * Covers Gantt, timeline, milestone, burndown, flow, and swimlane views.
 */
import { Scene, cubicBezierPoint } from './scene.mjs';
import { normalizeData } from './data.mjs';
import { layoutDiagram, normalizeDiagramData, routeEdgePath } from './diagram.mjs';
import { analyzeBurndownSeries, analyzeSchedule } from './project-analytics.mjs';
import { createLinkedProjectState, filterProjectRows, linkedRecordId } from './project-linking.mjs';
import { contrastRatio, resolveTheme } from './theme.mjs';
import { axisLabelLayout, titleLayout } from './layout.mjs';

export const projectTypes = ['gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane', 'architecture', 'mindmap'];
const day = 86400000;
export const timestamp = value => value == null || value === '' ? NaN : new Date(value).getTime();
const dateLabel = value => new Date(value).toISOString().slice(0, 10);
const dependencyId = dependency => typeof dependency === 'string' ? dependency : dependency?.id || null;
const markText = (theme, background) => (contrastRatio(theme.text, background) || 0) >= (contrastRatio(theme.background, background) || 0) ? theme.text : theme.background;

function text(scene, id, content, x, y, style = {}) {
  scene.add({ id, type: 'text', geometry: { text: String(content), x, y }, style: { fill: scene.theme?.text || '#334155', font: scene.theme?.typography?.label?.font || '12px system-ui', ...style }, zIndex: 4 });
}

function arrow(scene, id, points, reference, critical = false, curve = null) {
  const color = critical ? scene.theme?.status?.danger || '#dc2626' : scene.theme?.axis || '#64748b';
  const tip = points.at(-1), previous = points.at(-2);
  const angle = Math.atan2(tip.y - previous.y, tip.x - previous.x), size = 7;
  scene.add({ id, type: 'path', geometry: { points, ...(curve ? { curve } : {}) }, style: { fill: 'none', stroke: color, strokeWidth: critical ? 2.5 : 1.5 }, dataRef: reference, interactive: Boolean(reference?.edgeId), hitTolerance: 8, zIndex: 1 });
  scene.add({ id: id.startsWith('dependency-') ? id.replace('dependency-', 'dependency-arrow-') : `${id}-arrow`, type: 'path', geometry: { points: [tip, { x: tip.x - size * Math.cos(angle - Math.PI / 6), y: tip.y - size * Math.sin(angle - Math.PI / 6) }, { x: tip.x - size * Math.cos(angle + Math.PI / 6), y: tip.y - size * Math.sin(angle + Math.PI / 6) }, tip] }, style: { fill: color, stroke: color }, zIndex: 3 });
}

function timeAxis(scene, plot, min, max) {
  const map = value => plot.x + (timestamp(value) - min) / (max - min || day) * plot.width;
  const ticks = Math.max(2, Math.min(5, Math.floor(plot.width / 100)));
  const labelLayout = scene.xLabelLayout || axisLabelLayout({ theme: scene.theme }, Array(ticks).fill('2000-00-00'), plot.width);
  for (let index = 0; index < ticks; index += 1) {
    const time = min + (max - min) * index / (ticks - 1), x = map(time);
    scene.add({ id: `project-grid-${index}`, type: 'line', geometry: { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height }, style: { stroke: scene.theme?.grid || '#e2e8f0' } });
    text(scene, `project-tick-${index}`, dateLabel(time), x, plot.y + plot.height + (labelLayout.rotation ? 10 : 22), { fill: scene.theme?.muted, textAnchor: labelLayout.rotation ? 'end' : index === 0 ? 'start' : index === ticks - 1 ? 'end' : 'middle', textBaseline: labelLayout.rotation ? 'middle' : 'alphabetic', rotation: labelLayout.rotation, font: scene.theme?.typography?.axis?.font || '11px system-ui' });
  }
  return map;
}

function projectConfig(spec) {
  return spec.project || {};
}

function projectOverlays(spec) {
  const project = projectConfig(spec);
  return {
    criticalPath: project.overlays?.criticalPath !== false,
    slack: Boolean(project.overlays?.slack),
    baseline: Boolean(project.overlays?.baseline),
    actual: Boolean(project.overlays?.actual),
    variance: Boolean(project.overlays?.variance)
  };
}

function projectSelection(spec, state) {
  const linked = state.linked || createLinkedProjectState([], {});
  return new Set(linked.selection);
}

function rowWindow(row) {
  const values = [
    row.start, row.end, row.date,
    row.baselineStart, row.baselineEnd, row.baselineDate, row.baseline,
    row.actualStart, row.actualEnd, row.actualDate
  ].map(timestamp).filter(Number.isFinite);
  return values;
}

function taskDatum(row, analytics, recordId) {
  return {
    ...row,
    ...(analytics ? {
      critical: analytics.critical,
      float: analytics.float,
      slack: analytics.slack,
      adjustedStart: analytics.adjustedStart,
      adjustedEnd: analytics.adjustedEnd,
      baselineVarianceDays: analytics.baselineVarianceDays,
      startVarianceDays: analytics.startVarianceDays,
      endVarianceDays: analytics.endVarianceDays
    } : {}),
    recordId
  };
}

export function criticalSchedule(rows, options = {}) {
  const analysis = analyzeSchedule(rows, options);
  if (analysis.warnings.some(item => item.code === 'CYCLIC_DEPENDENCY')) throw new Error('Cyclic task dependencies');
  return {
    duration: analysis.duration,
    criticalIds: analysis.criticalIds,
    criticalEdges: analysis.criticalEdges,
    tasks: analysis.tasks.map(task => ({
      id: task.id,
      dependencies: task.dependencies.map(dependencyId).filter(Boolean),
      earliestStart: task.earliestStart,
      earliestFinish: task.earliestFinish,
      latestStart: task.latestStart,
      latestFinish: task.latestFinish,
      float: task.float,
      critical: task.critical
    })),
    calendar: analysis.calendar,
    assumptions: analysis.assumptions,
    warnings: analysis.warnings
  };
}

export function analyzeBurndown(rows, options = {}) {
  return analyzeBurndownSeries(rows, options);
}

function tasksScene(scene, spec, rows, state) {
  const plot = state.plot;
  const overlays = projectOverlays(spec);
  const values = rows.flatMap(rowWindow);
  let min = Math.min(...(values.length ? values : [Date.now()])), max = Math.max(...(values.length ? values : [Date.now() + day]));
  if (min === max) { min -= day; max += day; }
  const map = timeAxis(scene, plot, min, max), positions = new Map();
  const analyticsMap = new Map((state.schedule?.tasks || []).map(task => [task.id, task]));
  const highlighted = new Set(spec.criticalPath === false || !overlays.criticalPath ? [] : Array.isArray(spec.criticalPath) ? spec.criticalPath : state.schedule?.criticalIds || []);
  const selected = projectSelection(spec, state);
  const rowHeight = Math.max(32, plot.height / Math.max(1, rows.length));
  rows.forEach((row, index) => {
    const analytics = analyticsMap.get(row.id);
    const recordId = linkedRecordId(row, index);
    const startValue = row.start ?? row.date ?? row.end;
    const endValue = row.end ?? row.date ?? row.start;
    const baselineStart = row.baselineStart || row.baselineDate || row.baseline || null;
    const baselineEnd = row.baselineEnd || row.baselineDate || baselineStart;
    const actualStart = row.actualStart || row.actualDate || null;
    const actualEnd = row.actualEnd || row.actualDate || actualStart;
    const start = map(startValue), end = map(endValue);
    const y = plot.y + (index + 0.5) * rowHeight;
    const milestone = spec.type === 'milestone' || row.milestone || start === end;
    if (overlays.baseline && baselineStart) {
      const baselineStartX = map(baselineStart), baselineEndX = map(baselineEnd || baselineStart);
      if (milestone) scene.add({ id: `project-baseline-${index}`, type: 'circle', geometry: { cx: baselineStartX, cy: y, r: 4 }, bounds: { x: baselineStartX - 4, y: y - 4, width: 8, height: 8 }, style: { fill: spec.theme.background, stroke: spec.theme.axis, strokeWidth: 1.5 }, zIndex: 1 });
      else scene.add({ id: `project-baseline-${index}`, type: 'rect', geometry: { x: baselineStartX, y: y - 14, width: Math.max(2, baselineEndX - baselineStartX), height: 6 }, style: { fill: spec.theme.border }, zIndex: 1 });
    }
    if (overlays.actual && actualStart) {
      const actualStartX = map(actualStart), actualEndX = map(actualEnd || actualStart);
      if (milestone) scene.add({ id: `project-actual-${index}`, type: 'circle', geometry: { cx: actualStartX, cy: y, r: 3 }, bounds: { x: actualStartX - 3, y: y - 3, width: 6, height: 6 }, style: { fill: spec.theme.text }, zIndex: 3 });
      else scene.add({ id: `project-actual-${index}`, type: 'rect', geometry: { x: actualStartX, y: y + 8, width: Math.max(2, actualEndX - actualStartX), height: 4 }, style: { fill: spec.theme.text, opacity: 0.35 }, zIndex: 3 });
    }
    const geometry = milestone ? { cx: start, cy: y, r: 7 } : { x: start, y: y - 10, width: Math.max(2, end - start), height: 20 };
    const bounds = milestone ? { x: start - 8, y: y - 8, width: 16, height: 16 } : { ...geometry };
    const datum = taskDatum(row, analytics, recordId);
    scene.add({
      id: `project-item-${index}`,
      type: milestone ? 'circle' : 'rect',
      geometry,
      bounds,
      style: {
        fill: highlighted.has(row.id) ? spec.theme.status.danger : row.status === 'done' ? spec.theme.status.success : spec.colors[index % spec.colors.length],
        stroke: selected.has(recordId) ? spec.theme.selection : spec.theme.background,
        strokeWidth: selected.has(recordId) ? 2 : 1
      },
      dataRef: { dataIndex: index, taskId: row.id, recordId, datum },
      interactive: true,
      zIndex: 2
    });
    positions.set(row.id || recordId, { start, end, y });
    const label = row.name || row.title || row.label || row.id || `Item ${index + 1}`;
    text(scene, `project-label-${index}`, label.length > 17 ? `${label.slice(0, 16)}…` : label, plot.x - 12, y + 4, { textAnchor: 'end' });
    if (row.progress != null && !milestone) scene.add({ id: `project-progress-${index}`, type: 'rect', geometry: { ...geometry, width: geometry.width * (row.progress > 1 ? row.progress / 100 : row.progress) }, style: { fill: spec.theme.text, opacity: 0.25 }, zIndex: 3 });
    if (overlays.slack && analytics?.latestFinish && !milestone) {
      const latestEnd = map(analytics.latestFinish);
      scene.add({ id: `project-slack-${index}`, type: 'line', geometry: { x1: end, y1: y, x2: latestEnd, y2: y }, style: { stroke: spec.theme.status.warning, strokeWidth: 1.5, opacity: 0.9 } });
    }
    if (overlays.variance) {
      const variance = analytics?.endVarianceDays ?? analytics?.baselineVarianceDays ?? null;
      if (variance != null) text(scene, `project-variance-${index}`, `${variance > 0 ? '+' : ''}${variance}d`, milestone ? start + 12 : end + 8, y - 12, { font: spec.theme.typography.axis.font, fill: variance > 0 ? spec.theme.status.danger : variance < 0 ? spec.theme.status.info : spec.theme.muted });
    }
  });
  rows.forEach((row, index) => (row.dependencies || []).forEach((dependency, dependencyIndex) => {
    const fromId = dependencyId(dependency), toId = row.id;
    const from = positions.get(fromId), to = positions.get(toId);
    if (!from || !to) return;
    const critical = highlighted.has(fromId) && highlighted.has(toId) && state.schedule?.criticalEdges?.some(edge => edge.from === fromId && edge.to === toId);
    const bend = from.end + 12;
    arrow(scene, `dependency-${index}-${dependencyIndex}`, [{ x: from.end, y: from.y }, { x: bend, y: from.y }, { x: bend, y: to.y - 15 }, { x: to.start - 10, y: to.y - 15 }, { x: to.start - 10, y: to.y }, { x: to.start, y: to.y }], { from: fromId, to: toId, critical }, critical);
  }));
  state.timeDomain = [min, max];
}

function burndownScene(scene, spec, rows, state) {
  const analysis = analyzeBurndown(rows, projectConfig(spec).burndown || spec.burndown || {});
  const { samples, forecast } = analysis;
  const plot = state.plot;
  state.burndown = analysis;
  state.projectAnalytics = { ...(state.projectAnalytics || {}), burndown: analysis };
  const min = Math.min(analysis.start, samples[0]?.time || analysis.start || Date.now());
  const max = Math.max(analysis.end, samples.at(-1)?.time || analysis.end || min + day, forecast.time || 0, min + day);
  const map = timeAxis(scene, plot, min, max);
  const maxValue = Math.max(1, ...samples.flatMap(sample => [sample.remaining, sample.ideal, sample.scope]));
  const mapY = value => plot.y + plot.height - value / maxValue * plot.height;
  const selected = projectSelection(spec, state);
  const series = [['remaining', 'actual', spec.colors[0]], ['ideal', 'ideal', spec.theme.axis], ['scope', 'scope-total', spec.theme.status.warning]];
  series.forEach(([field, id, color]) => scene.add({ id: `burndown-${id}`, type: 'path', geometry: { points: samples.map(sample => ({ x: map(sample.time), y: mapY(sample[field]) })) }, style: { fill: 'none', stroke: color, strokeWidth: 2 } }));
  for (let index = 0; index <= 2; index += 1) text(scene, `burndown-y-${index}`, Number((maxValue * index / 2).toFixed(1)), plot.x - 12, mapY(maxValue * index / 2) + 4, { textAnchor: 'end' });
  samples.forEach(sample => {
    const x = map(sample.time), y = mapY(sample.remaining), index = sample.dataIndex;
    const recordId = linkedRecordId(sample, index);
    if (sample.scopeChange) scene.add({ id: `burndown-scope-${index}`, type: 'line', geometry: { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height }, style: { stroke: spec.theme.status.warning } });
    scene.add({ id: `burndown-item-${index}`, type: 'circle', geometry: { cx: x, cy: y, r: 5 }, bounds: { x: x - 8, y: y - 8, width: 16, height: 16 }, style: { fill: spec.colors[0], stroke: selected.has(recordId) ? spec.theme.selection : spec.theme.background, strokeWidth: selected.has(recordId) ? 2 : 1 }, dataRef: { dataIndex: index, recordId, datum: { ...sample, forecast: forecast.date, forecastReason: forecast.reason } }, interactive: true, zIndex: 2 });
  });
  if (forecast.reason === 'estimated') {
    const last = samples.at(-1);
    scene.add({ id: 'burndown-forecast', type: 'path', geometry: { points: [{ x: map(last.time), y: mapY(last.remaining) }, { x: map(forecast.time), y: mapY(0) }] }, style: { fill: 'none', stroke: spec.theme.status.danger, strokeWidth: 2 } });
  }
  text(scene, 'burndown-projected', forecast.date ? `Estimated finish: ${forecast.date}` : `Forecast unavailable: ${forecast.reason}`, plot.x, plot.y - 16, { font: spec.theme.typography.axis.font });
}

function diagramScene(scene, spec, rows, state) {
  const diagramSpec = normalizeDiagramData(spec);
  const plot = state.plot, mode = diagramSpec.diagram.mode, edges = diagramSpec.edges, lanes = diagramSpec.lanes, layers = diagramSpec.layers, groups = diagramSpec.groups, layout = layoutDiagram(diagramSpec, plot);
  rows = diagramSpec.nodes;
  const collapsedGroups = new Set(groups.filter(group => group.collapsed).map(group => group.id));
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
    scene.add({ id: `lane-${index}`, type: 'rect', geometry: { x: plot.x, y: plot.y + index * laneHeight, width: Math.max(plot.width, columns * gapX), height: laneHeight }, style: { fill: index % 2 ? spec.theme.surface : spec.theme.background, stroke: spec.theme.border }, zIndex: -1 });
    text(scene, `lane-label-${index}`, lane.label || lane.id, plot.x - 12, plot.y + index * laneHeight + 20, { textAnchor: 'end' });
  });
  const layerSlots = new Map();
  if (mode === 'architecture' && layers.length) layers.forEach(layer => layerSlots.set(layer.id, 0));
  if (mode === 'architecture' && layers.length) layers.forEach((layer, index) => {
    const layerHeight = plot.height / layers.length;
    scene.add({ id: `layer-${layer.id}`, type: 'rect', geometry: { x: plot.x, y: plot.y + index * layerHeight, width: plot.width, height: layerHeight }, style: { fill: index % 2 ? spec.theme.surface : spec.theme.background, stroke: spec.theme.border }, zIndex: -2 });
    text(scene, `layer-label-${layer.id}`, layer.label || layer.id, plot.x - 12, plot.y + index * layerHeight + 20, { textAnchor: 'end', font: spec.theme.typography.legend.font });
  });
  rows.forEach((row, index) => {
    const rank = ranks.get(row.id), lane = Math.max(0, lanes.findIndex(item => item.id === row.laneId));
    const slotKey = `${lane}:${rank}`, slot = slots.get(slotKey) || 0;
    slots.set(slotKey, slot + 1);
    const sameCell = rows.filter(item => ranks.get(item.id) === rank && (!lanes.length || item.laneId === row.laneId)).length;
    const generated = layout[row.id];
    const layerIndex = mode === 'architecture' && layers.length ? Math.max(0, layers.findIndex(layer => layer.id === row.layerId)) : -1;
    const layerHeight = layers.length ? plot.height / layers.length : plot.height;
    const layerSlot = layerIndex >= 0 ? layerSlots.get(row.layerId) : 0;
    if (layerIndex >= 0) layerSlots.set(row.layerId, layerSlot + 1);
    const layerCount = layerIndex >= 0 ? rows.filter(item => item.layerId === row.layerId).length : 1;
    const geometry = { x: row.position?.x ?? (layerIndex >= 0 ? plot.x + (layerIndex + 0.5) * plot.width / layers.length - 56 : generated?.x ?? plot.x + rank * gapX + 12), y: row.position?.y ?? (layerIndex >= 0 ? plot.y + layerIndex * layerHeight + (layerSlot + 0.5) * layerHeight / Math.max(1, layerCount) - 18 : generated?.y ?? plot.y + (lanes.length ? lane * laneHeight : 0) + (slot + 0.5) * (lanes.length ? laneHeight : Math.max(plot.height, sameCell * 64)) / sameCell - 18), width: row.size?.width || 112, height: row.size?.height || 36 };
    positions.set(row.id, geometry);
    if (collapsedGroups.has(row.groupId)) return;
    const depth = row.parentId ? (ranks.get(row.id) || 0) : 0;
    const colorIndex = mode === 'mindmap' ? depth % spec.colors.length : lane >= 0 ? lane % spec.colors.length : index % spec.colors.length;
    scene.add({ id: `node-${row.id}`, type: 'rect', geometry, bounds: { ...geometry }, style: { fill: spec.colors[colorIndex], stroke: row.root || mode === 'mindmap' && !row.parentId ? spec.theme.focus : spec.theme.background, strokeWidth: row.root || mode === 'mindmap' && !row.parentId ? 2 : 1 }, dataRef: { nodeId: row.id, dataIndex: index, datum: row, groupId: row.groupId || null, layerId: row.layerId || null, parentId: row.parentId || null }, interactive: true, zIndex: 2 });
    if (spec.editing?.enabled && spec.interaction?.portConnect) (row.ports || []).forEach(port => {
      const point = port.side === 'left' ? { x: geometry.x, y: geometry.y + geometry.height * (port.offset ?? 0.5) } : port.side === 'top' ? { x: geometry.x + geometry.width * (port.offset ?? 0.5), y: geometry.y } : port.side === 'bottom' ? { x: geometry.x + geometry.width * (port.offset ?? 0.5), y: geometry.y + geometry.height } : { x: geometry.x + geometry.width, y: geometry.y + geometry.height * (port.offset ?? 0.5) };
      scene.add({ id: `port-${row.id}-${port.id}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 4 }, bounds: { x: point.x - 6, y: point.y - 6, width: 12, height: 12 }, style: { fill: spec.theme.background, stroke: spec.theme.text, strokeWidth: 1.5 }, dataRef: { nodeId: row.id, portId: port.id, groupId: row.groupId || null }, interactive: true, zIndex: 4 });
    });
    text(scene, `node-label-${row.id}`, row.label || row.id, geometry.x + geometry.width / 2, geometry.y + geometry.height / 2 + 5, { fill: markText(spec.theme, spec.colors[lane % spec.colors.length]), textAnchor: 'middle' });
  });
  const groupBoxes = new Map();
  groups.forEach(group => {
    const boxes = rows.filter(row => row.groupId === group.id).map(row => positions.get(row.id)).filter(Boolean);
    if (!boxes.length) return;
    const padding = typeof group.padding === 'number' ? { left: group.padding, right: group.padding, top: group.padding, bottom: group.padding } : { left: group.padding?.left ?? 16, right: group.padding?.right ?? 16, top: group.padding?.top ?? 24, bottom: group.padding?.bottom ?? 16 };
    const left = Math.min(...boxes.map(box => box.x)) - padding.left, top = Math.min(...boxes.map(box => box.y)) - padding.top, right = Math.max(...boxes.map(box => box.x + box.width)) + padding.right, bottom = Math.max(...boxes.map(box => box.y + box.height)) + padding.bottom;
    const geometry = { x: left, y: top, width: right - left, height: bottom - top };
    groupBoxes.set(group.id, geometry);
    scene.add({ id: `group-${group.id}`, type: 'rect', geometry, bounds: { ...geometry }, style: { fill: group.collapsed ? spec.theme.surface : 'none', stroke: group.collapsed ? spec.theme.focus : spec.theme.axis, strokeWidth: group.collapsed ? 2 : 1.5, opacity: 0.9 }, dataRef: { groupId: group.id, collapsed: Boolean(group.collapsed) }, interactive: false, zIndex: 0 });
    text(scene, `group-label-${group.id}`, group.collapsed ? `${group.label || group.id} (${boxes.length})` : group.label || group.id, left + 8, top + 15, { font: spec.theme.typography.legend.font });
    const label = scene.find(`group-label-${group.id}`);
    if (label) { label.bounds = { x: left, y: top, width: right - left, height: 20 }; label.dataRef = { groupId: group.id, collapsed: Boolean(group.collapsed) }; label.interactive = true; }
  });
  if (mode === 'architecture') {
    diagramSpec.boundaries.forEach((boundary, boundaryIndex) => {
      const boxes = rows.filter(row => (boundary.nodeIds || []).includes(row.id)).map(row => positions.get(row.id)).filter(Boolean);
      if (!boxes.length) return;
      const padding = Number(boundary.padding) || 16, left = Math.min(...boxes.map(box => box.x)) - padding, top = Math.min(...boxes.map(box => box.y)) - padding, right = Math.max(...boxes.map(box => box.x + box.width)) + padding, bottom = Math.max(...boxes.map(box => box.y + box.height)) + padding;
      scene.add({ id: `boundary-${boundary.id || boundaryIndex}`, type: 'rect', geometry: { x: left, y: top, width: right - left, height: bottom - top }, bounds: { x: left, y: top, width: right - left, height: bottom - top }, style: { fill: 'none', stroke: boundary.color || spec.theme.focus, strokeWidth: 1.5, opacity: 0.8 }, dataRef: { boundaryId: boundary.id || `boundary-${boundaryIndex}` }, interactive: false, zIndex: -1 });
      text(scene, `boundary-label-${boundary.id || boundaryIndex}`, boundary.label || boundary.id || `Boundary ${boundaryIndex + 1}`, left + 8, top + 15, { font: spec.theme.typography.legend.font, fill: boundary.color || spec.theme.focus });
    });
  }
  edges.forEach((edge, index) => {
    const fromNode = rows.find(row => row.id === edge.from), toNode = rows.find(row => row.id === edge.to);
    if (!fromNode || !toNode) return;
    if (fromNode.groupId && fromNode.groupId === toNode.groupId && collapsedGroups.has(fromNode.groupId)) return;
    const from = fromNode.groupId && collapsedGroups.has(fromNode.groupId) ? groupBoxes.get(fromNode.groupId) : positions.get(edge.from);
    const to = toNode.groupId && collapsedGroups.has(toNode.groupId) ? groupBoxes.get(toNode.groupId) : positions.get(edge.to);
    if (!from || !to) return;
    const obstacles = [...positions.entries()].filter(([id]) => id !== edge.from && id !== edge.to && !collapsedGroups.has(rows.find(row => row.id === id)?.groupId)).map(([, box]) => box);
    const fromPortDefinition = fromNode.groupId && collapsedGroups.has(fromNode.groupId) ? null : fromNode?.ports?.find(port => port.id === edge.fromPort);
    const toPortDefinition = toNode.groupId && collapsedGroups.has(toNode.groupId) ? null : toNode?.ports?.find(port => port.id === edge.toPort);
    const routing = edge.routing || diagramSpec.diagram.routing;
    const path = routeEdgePath({ ...edge, curveTension: edge.curveTension ?? diagramSpec.diagram.curveTension, grid: diagramSpec.diagram.grid, obstacles, fromPortDefinition, toPortDefinition }, from, to, routing);
    const points = path.points;
    arrow(scene, `edge-${index}`, points, { from: edge.from, to: edge.to, edgeId: edge.id || `edge-${index}`, status: edge.status, routing, curveTension: edge.curveTension ?? diagramSpec.diagram.curveTension, waypoints: edge.waypoints || [], fromPortDefinition, toPortDefinition, fromGroupId: fromNode.groupId || null, toGroupId: toNode.groupId || null }, edge.critical === true, path.curve);
    if (edge.label) {
      const middle = path.curve === 'cubic' ? cubicBezierPoint(points, 0.5) : points[Math.floor(points.length / 2)];
      text(scene, `edge-label-${index}`, edge.label, middle.x, middle.y - 8, { textAnchor: 'middle', font: spec.theme.typography.axis.font });
    }
  });
  state.nodePositions = Object.fromEntries(positions);
  state.groupBoxes = Object.fromEntries(groupBoxes);
}

export function projectView(spec) {
  const view = spec.view || {};
  return { scale: Math.max(0.25, Math.min(8, Number(view.scale) || 1)), offsetX: Number(view.offsetX) || 0, offsetY: Number(view.offsetY) || 0 };
}

export function buildProjectScene(spec) {
  const theme = spec.theme && typeof spec.theme === 'object' && spec.theme.typography ? spec.theme : resolveTheme(spec.theme, spec);
  spec = { ...spec, theme, colors: spec.colors || theme.colors, background: spec.background || theme.background, padding: spec.padding || theme.layout.padding };
  const diagram = ['flow', 'swimlane', 'architecture', 'mindmap'].includes(spec.type);
  const rawRows = diagram ? spec.nodes ?? spec.data.nodes ?? [] : spec.data.values;
  const sourceRows = rawRows.map(row => ({ ...row }));
  const linked = createLinkedProjectState(sourceRows, projectConfig(spec).linked || {});
  const visibleRows = diagram ? sourceRows : filterProjectRows(sourceRows, projectConfig(spec).linked || {});
  const data = { ...normalizeData(visibleRows), rows: visibleRows.map(row => ({ ...row })), sourceRows: sourceRows.map(row => ({ ...row })) };
  const scene = new Scene(spec.width, spec.height);
  scene.theme = spec.theme;
  const left = ['gantt', 'timeline', 'milestone', 'swimlane', 'architecture'].includes(spec.type) ? Math.min(170, spec.width * 0.34) : spec.padding.left;
  const title = titleLayout(spec);
  const plotTop = Math.max(spec.padding.top, title.bottom + (title.bottom ? 12 : 0)) + (spec.type === 'burndown' ? 16 : 0);
  const plotWidth = Math.max(1, spec.width - left - spec.padding.right), xLabels = axisLabelLayout(spec, Array(Math.max(2, Math.min(5, Math.floor(plotWidth / 100)))).fill('2000-00-00'), plotWidth);
  const bottomReserve = Math.max(spec.padding.bottom + 16, Math.ceil(16 + xLabels.projectedHeight));
  const state = { plot: { x: left, y: plotTop, width: plotWidth, height: Math.max(1, spec.height - plotTop - bottomReserve) }, xLabels, compact: spec.width < 360 || spec.height < 240, recommendedSize: { minWidth: 280, minHeight: 220 }, linked, projectAnalytics: { linked } };
  scene.xLabelLayout = xLabels;
  if (spec.type === 'gantt') {
    state.schedule = analyzeSchedule(data.rows, { calendar: projectConfig(spec).calendar || {} });
    state.projectAnalytics.schedule = state.schedule;
    state.projectAnalytics.assumptions = state.schedule.assumptions;
    state.projectAnalytics.warnings = state.schedule.warnings;
  }
  if (!data.rows.length) text(scene, 'empty', sourceRows.length && linked.visibleCount === 0 ? 'No matching data' : spec.emptyText || 'No data', spec.width / 2, spec.height / 2, { textAnchor: 'middle' });
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
  if (spec.title?.text) text(scene, 'title', spec.title.text, spec.width / 2, title.titleY, { fill: spec.theme.text, font: spec.theme.typography.title.font, textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' });
  if (spec.title?.subtitle) text(scene, 'subtitle', spec.title.subtitle, spec.width / 2, title.subtitleY, { fill: spec.theme.muted, font: spec.theme.typography.subtitle.font, textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' });
  state.view = view;
  return { scene, data, state };
}

export function projectTooltip(type, row) {
  if (!row) return '';
  if (type === 'burndown') return [
    `Date: ${row.date}`,
    `Remaining: ${row.remaining ?? row.actual ?? row.value}`,
    `Scope change: ${row.scopeChange || 0}`,
    row.scope != null ? `Total scope: ${row.scope}` : null,
    row.completed != null ? `Completed: ${row.completed}` : null,
    row.forecast ? `Estimated finish: ${row.forecast}` : `Forecast: ${row.forecastReason || 'unavailable'}`
  ].filter(Boolean).join('\n');
  const dependencies = (row.dependencies || []).map(dependencyId).filter(Boolean);
  const variance = row.endVarianceDays ?? row.baselineVarianceDays ?? null;
  if (type === 'mindmap') return [row.label || row.id, row.parentId ? `Parent: ${row.parentId}` : 'Root topic', row.branch ? `Branch: ${row.branch}` : null, row.description].filter(value => value != null && value !== '').join('\n');
  if (type === 'architecture') return [row.label || row.id, row.layerId ? `Layer: ${row.layerId}` : null, row.boundaryId ? `Boundary: ${row.boundaryId}` : null, row.role ? `Role: ${row.role}` : null, row.description].filter(value => value != null && value !== '').join('\n');
  return [
    row.name || row.title || row.label || row.id,
    row.start ? `${row.start} → ${row.end || row.start}` : row.date,
    row.progress != null ? `Progress: ${row.progress <= 1 ? Math.round(row.progress * 100) : row.progress}%` : null,
    row.status ? `Status: ${row.status}` : null,
    row.owner || row.resource ? `Owner: ${row.owner || row.resource}` : null,
    dependencies.length ? `Depends on: ${dependencies.join(', ')}` : null,
    row.critical != null ? `Critical: ${row.critical ? 'yes' : 'no'} · Float: ${row.float ?? row.slack ?? 0} days` : null,
    variance != null ? `Variance: ${variance > 0 ? '+' : ''}${variance} days` : null,
    row.laneId ? `Lane: ${row.laneId}` : null,
    row.description
  ].filter(value => value != null && value !== '').join('\n');
}

export function rerouteDiagramScene(scene) {
  const nodeGeometries = new Map();
  scene.walk(item => { if (item.id.startsWith('node-') && item.dataRef?.nodeId && item.geometry) nodeGeometries.set(item.dataRef.nodeId, item.geometry); });
  scene.walk(node => {
    if (!node.id.startsWith('edge-') || !node.dataRef?.from || !node.dataRef?.to) return;
    const source = nodeGeometries.get(node.dataRef.from), destination = nodeGeometries.get(node.dataRef.to);
    if (!source || !destination) return;
    const obstacles = [...nodeGeometries.entries()].filter(([id]) => id !== node.dataRef.from && id !== node.dataRef.to).map(([, geometry]) => geometry);
    const path = routeEdgePath({ ...node.dataRef, obstacles, grid: 8 }, source, destination, node.dataRef.routing || 'orthogonal');
    node.geometry.points = path.points;
    if (path.curve) node.geometry.curve = path.curve;
    else delete node.geometry.curve;
    const end = node.geometry.points.at(-1);
    const arrowNode = scene.find(`${node.id}-arrow`), beforeTip = node.geometry.points.at(-2);
    if (arrowNode) arrowNode.geometry.points = [end, { x: end.x - 7 * Math.cos(Math.atan2(end.y - beforeTip.y, end.x - beforeTip.x) - Math.PI / 6), y: end.y - 7 * Math.sin(Math.atan2(end.y - beforeTip.y, end.x - beforeTip.x) - Math.PI / 6) }, { x: end.x - 7 * Math.cos(Math.atan2(end.y - beforeTip.y, end.x - beforeTip.x) + Math.PI / 6), y: end.y - 7 * Math.sin(Math.atan2(end.y - beforeTip.y, end.x - beforeTip.x) + Math.PI / 6) }, end];
    const edgeIndex = Number(node.id.slice(5)), label = scene.find(`edge-label-${edgeIndex}`), labelPoint = node.geometry.curve === 'cubic' ? cubicBezierPoint(node.geometry.points, 0.5) : node.geometry.points[Math.floor(node.geometry.points.length / 2)];
    if (label && labelPoint) { label.geometry.x = labelPoint.x; label.geometry.y = labelPoint.y - 8; }
  });
  return scene;
}
