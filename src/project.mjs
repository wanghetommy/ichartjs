/**
 * Project-management and process visualization scene builders.
 * Covers Gantt, timeline, milestone, burndown, flow, and swimlane views.
 */
import { Scene, cubicBezierPoint } from './scene.mjs';
import { normalizeData } from './data.mjs';
import { layoutArchitectureNodes, layoutDiagram, normalizeDiagramData, routeEdgePath } from './diagram.mjs';
import { analyzeBurndownSeries, analyzeSchedule } from './project-analytics.mjs';
import { createLinkedProjectState, filterProjectRows, linkedRecordId } from './project-linking.mjs';
import { contrastRatio, resolveTheme } from './theme.mjs';
import { axisLabelLayout, boxesOverlap, estimateTextWidth, fitTextBlock, fontSize, titleLayout, truncateText } from './layout.mjs';

export const projectTypes = ['gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane', 'architecture', 'mindmap'];
const day = 86400000;
export const timestamp = value => value == null || value === '' ? NaN : new Date(value).getTime();
const projectMessages = locale => String(locale || 'en-US').toLowerCase().startsWith('zh') ? {
  estimatedFinish: '预计完成',
  forecastUnavailable: '无法预测',
  date: '日期', remaining: '剩余', scopeChange: '范围变更', totalScope: '范围总量', completed: '已完成',
  forecast: '预测', parent: '父主题', rootTopic: '根主题', branch: '分支', layer: '层', boundary: '边界', role: '角色',
  progress: '进度', status: '状态', owner: '负责人', dependsOn: '依赖', critical: '关键路径', float: '浮动时间', variance: '偏差', lane: '泳道', days: '天', yes: '是', no: '否', unavailable: '不可用'
} : {
  estimatedFinish: 'Estimated finish',
  forecastUnavailable: 'Forecast unavailable',
  date: 'Date', remaining: 'Remaining', scopeChange: 'Scope change', totalScope: 'Total scope', completed: 'Completed',
  forecast: 'Forecast', parent: 'Parent', rootTopic: 'Root topic', branch: 'Branch', layer: 'Layer', boundary: 'Boundary', role: 'Role',
  progress: 'Progress', status: 'Status', owner: 'Owner', dependsOn: 'Depends on', critical: 'Critical', float: 'Float', variance: 'Variance', lane: 'Lane', days: 'days', yes: 'yes', no: 'no', unavailable: 'unavailable'
};
const dateLabel = (value, locale = 'en-US') => {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  } catch {
    return new Date(value).toISOString().slice(0, 10);
  }
};
const projectTickCount = width => Math.max(2, Math.min(6, Math.floor(width / 100)));
function projectTickValues(min, max, count = 5) {
  return Array.from({ length: count }, (_, index) => min + (max - min) * index / Math.max(1, count - 1));
}
function projectTickLabels(min, max, width, locale = 'en-US') {
  return projectTickValues(min, max, projectTickCount(width)).map(value => dateLabel(value, locale));
}

function projectDateDomain(spec, rows) {
  const values = spec.type === 'gantt' ? rows.flatMap(rowWindow) : rows.map(row => timestamp(row?.date ?? row?.start ?? row?.end)).filter(Number.isFinite);
  let min = Math.min(...(values.length ? values : [Date.now()])), max = Math.max(...(values.length ? values : [Date.now() + day]));
  if (min === max) { min -= day; max += day; }
  if (['timeline', 'milestone'].includes(spec.type)) {
    const padding = Math.max(day, (max - min) * 0.03);
    min -= padding;
    max += padding;
  }
  return [min, max];
}
const dependencyId = dependency => typeof dependency === 'string' ? dependency : dependency?.id || null;
const dependencyType = dependency => typeof dependency === 'object' && dependency?.type ? dependency.type : 'finish-to-start';
const markText = (theme, background) => (contrastRatio(theme.text, background) || 0) >= (contrastRatio(theme.background, background) || 0) ? theme.text : theme.background;
const flowNodeKind = node => node?.kind || 'process';

function diagramNodeLabelLayout(row, kind, geometry, spec, font = null) {
  const size = font ? Number(String(font).match(/(\d+(?:\.\d+)?)px/)?.[1]) || fontSize(spec, 'label', 12) : fontSize(spec, 'label', 12);
  const minDimension = Math.min(geometry.width, geometry.height);
  const horizontalPadding = kind === 'decision' ? size * 1.8 : size * 1.25;
  const maxWidth = Math.max(0, geometry.width - horizontalPadding * 2);
  if (minDimension < Math.max(24, size * 2) || maxWidth < size * 2.4) return null;
  return fitTextBlock(row.label || row.id, { maxWidth, maxHeight: Math.max(size, geometry.height - size * 0.45), size, minSize: Math.max(10, Math.min(size, size - 2)), maxLines: 2 });
}

function flowNodeVisual(kind, box) {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  if (kind === 'start' || kind === 'end') return { type: 'path', geometry: { points: Array.from({ length: 16 }, (_, index) => { const angle = index / 16 * Math.PI * 2; return { x: cx + box.width / 2 * Math.cos(angle), y: cy + box.height / 2 * Math.sin(angle) }; }), closed: true } };
  if (kind === 'decision') return { type: 'path', geometry: { points: [{ x: cx, y: box.y }, { x: box.x + box.width, y: cy }, { x: cx, y: box.y + box.height }, { x: box.x, y: cy }], closed: true } };
  if (kind === 'io') {
    const skew = Math.min(18, box.width * 0.18);
    return { type: 'path', geometry: { points: [{ x: box.x + skew, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width - skew, y: box.y + box.height }, { x: box.x, y: box.y + box.height }], closed: true } };
  }
  if (kind === 'connector') return { type: 'circle', geometry: { cx, cy, r: Math.min(box.width, box.height) / 2 } };
  return { type: 'rect', geometry: box };
}

function flowNodeBox(row, generated, fallback) {
  const kind = flowNodeKind(row), connector = kind === 'connector';
  const width = Number(row.size?.width) || (connector ? 28 : 112), height = Number(row.size?.height) || (connector ? 28 : 36);
  return { x: row.position?.x ?? generated?.x ?? fallback.x, y: row.position?.y ?? generated?.y ?? fallback.y, width, height };
}

function compactRoute(points) {
  return points.filter((point, index) => {
    const previous = points[index - 1], next = points[index + 1];
    if (previous && point.x === previous.x && point.y === previous.y) return false;
    return !(previous && next && (previous.x === point.x && point.x === next.x || previous.y === point.y && point.y === next.y));
  });
}

function routeGanttDependency(dependency, from, to, positions, barOffset, plot) {
  const type = dependencyType(dependency);
  const sourceAtStart = type === 'start-to-start' || type === 'start-to-finish';
  const targetAtEnd = type === 'finish-to-finish' || type === 'start-to-finish';
  const source = { x: sourceAtStart ? from.start : from.end, y: from.y };
  const target = { x: targetAtEnd ? to.end : to.start, y: to.y };
  const gap = target.x - source.x;
  if (type === 'finish-to-start' && gap > 4) {
    const channelX = source.x + Math.min(12, gap / 2);
    const top = Math.min(source.y, target.y), bottom = Math.max(source.y, target.y);
    const blocked = [...positions.values()].some(position => position !== from && position !== to && position.y + barOffset >= top && position.y - barOffset <= bottom && channelX >= position.start - 2 && channelX <= position.end + 2);
    if (!blocked) return compactRoute([source, { x: channelX, y: source.y }, { x: channelX, y: target.y }, target]);
  }
  const clampX = value => Math.max(plot.x, Math.min(plot.x + plot.width, value));
  const sourceStubX = clampX(source.x + (sourceAtStart ? -12 : 12));
  const targetStubX = clampX(target.x + (targetAtEnd ? 10 : -10));
  const corridorY = Math.min(source.y, target.y) - Math.max(6, barOffset + 3);
  return compactRoute([source, { x: sourceStubX, y: source.y }, { x: sourceStubX, y: corridorY }, { x: targetStubX, y: corridorY }, { x: targetStubX, y: target.y }, target]);
}

function text(scene, id, content, x, y, style = {}, dataRef = null) {
  scene.add({ id, type: 'text', geometry: { text: String(content), x, y }, style: { fill: scene.theme?.text || '#334155', font: scene.theme?.typography?.label?.font || '12px system-ui', ...style }, dataRef, zIndex: 4 });
}

function textBlock(scene, id, block, x, y, style = {}, dataRef = null) {
  if (!block) return;
  const start = y - (block.lines.length - 1) * block.lineHeight / 2;
  block.lines.forEach((line, index) => text(scene, index ? `${id}-${index}` : id, line, x, start + index * block.lineHeight, { textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle', ...style }, dataRef));
}

function labelPlate(scene, id, box, fill, opacity = 0.94) {
  scene.add({ id: `${id}-background`, type: 'rect', geometry: { x: box.x - 3, y: box.y - 2, width: box.width + 6, height: box.height + 4 }, style: { fill, opacity, stroke: 'none' }, zIndex: 3 });
}

function polylineMidpoint(points) {
  if (!points?.length) return null;
  if (points.length === 1) return { point: points[0], start: points[0], end: points[0] };
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const target = lengths.reduce((sum, value) => sum + value, 0) / 2;
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = lengths[index - 1];
    if (traversed + length >= target) {
      const ratio = length ? (target - traversed) / length : 0;
      return { point: { x: points[index - 1].x + (points[index].x - points[index - 1].x) * ratio, y: points[index - 1].y + (points[index].y - points[index - 1].y) * ratio }, start: points[index - 1], end: points[index] };
    }
    traversed += length;
  }
  return { point: points.at(-1), start: points.at(-2), end: points.at(-1) };
}

function edgeLabelLayout(edge, spec, positions, occupied = []) {
  const points = edge.points, midpoint = edge.curve === 'cubic' ? { point: cubicBezierPoint(points, 0.5), start: cubicBezierPoint(points, 0.45), end: cubicBezierPoint(points, 0.55) } : polylineMidpoint(points);
  if (!midpoint) return null;
  const length = Math.max(1, edge.curve === 'cubic' ? Math.hypot(points.at(-1).x - points[0].x, points.at(-1).y - points[0].y) : Math.hypot(midpoint.end.x - midpoint.start.x, midpoint.end.y - midpoint.start.y));
  const angle = Math.atan2(midpoint.end.y - midpoint.start.y, midpoint.end.x - midpoint.start.x), normal = { x: -Math.sin(angle), y: Math.cos(angle) }, size = fontSize(spec, 'axis', 12);
  const block = fitTextBlock(edge.label, { maxWidth: Math.max(size * 3, Math.min(180, length - 10)), maxHeight: size * 2.6, size, minSize: 10, maxLines: 2 });
  const inlineOffset = 8, candidates = [
    { x: midpoint.point.x, y: midpoint.point.y - inlineOffset, onLine: true },
    { x: midpoint.point.x + normal.x * (inlineOffset + block.height + 6), y: midpoint.point.y + normal.y * (inlineOffset + block.height + 6), onLine: false },
    { x: midpoint.point.x - normal.x * (inlineOffset + block.height + 6), y: midpoint.point.y - normal.y * (inlineOffset + block.height + 6), onLine: false },
    { x: midpoint.point.x + normal.x * (inlineOffset + 2 * (block.height + 6)), y: midpoint.point.y + normal.y * (inlineOffset + 2 * (block.height + 6)), onLine: false },
    { x: midpoint.point.x - normal.x * (inlineOffset + 2 * (block.height + 6)), y: midpoint.point.y - normal.y * (inlineOffset + 2 * (block.height + 6)), onLine: false }
  ];
  const nodeBoxes = [...positions.values()];
  for (const candidate of candidates) {
    const box = { x: candidate.x - block.width / 2, y: candidate.y - block.height / 2, width: block.width, height: block.height };
    if (!nodeBoxes.some(node => boxesOverlap(box, node, 2)) && !occupied.some(item => boxesOverlap(box, item, 3))) return { ...candidate, anchor: midpoint.point, box, block };
  }
  return { ...candidates[0], anchor: midpoint.point, box: { x: candidates[0].x - block.width / 2, y: candidates[0].y - block.height / 2, width: block.width, height: block.height }, block, suppressed: false };
}

function arrow(scene, id, points, reference, critical = false, curve = null) {
  const color = critical ? scene.theme?.status?.danger || '#dc2626' : scene.theme?.axis || '#64748b';
  const tip = points.at(-1), previous = points.at(-2);
  const angle = Math.atan2(tip.y - previous.y, tip.x - previous.x), size = 7;
  scene.add({ id, type: 'path', geometry: { points, ...(curve ? { curve } : {}) }, style: { fill: 'none', stroke: color, strokeWidth: critical ? 2.5 : 1.5 }, dataRef: reference, interactive: Boolean(reference?.edgeId), hitTolerance: 8, zIndex: 1 });
  scene.add({ id: id.startsWith('dependency-') ? id.replace('dependency-', 'dependency-arrow-') : `${id}-arrow`, type: 'path', geometry: { points: [tip, { x: tip.x - size * Math.cos(angle - Math.PI / 6), y: tip.y - size * Math.sin(angle - Math.PI / 6) }, { x: tip.x - size * Math.cos(angle + Math.PI / 6), y: tip.y - size * Math.sin(angle + Math.PI / 6) }, tip] }, style: { fill: color, stroke: color }, zIndex: 3 });
}

function timeAxis(scene, plot, min, max, locale = 'en-US') {
  const map = value => plot.x + (timestamp(value) - min) / (max - min || day) * plot.width;
  const ticks = projectTickCount(plot.width), values = projectTickValues(min, max, ticks), labels = values.map(value => dateLabel(value, locale));
  const labelLayout = scene.xLabelLayout || axisLabelLayout({ theme: scene.theme }, labels, plot.width);
  scene.xLabelLayout = labelLayout;
  values.forEach((time, index) => {
    const x = map(time);
    scene.add({ id: `project-grid-${index}`, type: 'line', geometry: { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height }, style: { stroke: scene.theme?.grid || '#e2e8f0' } });
    text(scene, `project-tick-${index}`, dateLabel(time, locale), x, plot.y + plot.height + (labelLayout.rotation ? 10 : 22), { fill: scene.theme?.muted, textAnchor: labelLayout.rotation ? 'end' : index === 0 ? 'start' : index === ticks - 1 ? 'end' : 'middle', textBaseline: labelLayout.rotation ? 'middle' : 'alphabetic', rotation: labelLayout.rotation, font: scene.theme?.typography?.axis?.font || '11px system-ui' });
  });
  return map;
}

function projectConfig(spec) {
  return spec.project || {};
}

function projectLabelReserve(spec, rows) {
  const labels = spec.type === 'swimlane'
    ? (spec.lanes || []).map(lane => lane.label || lane.id)
    : rows.map(row => row.name || row.title || row.label || row.id);
  const labelSize = fontSize(spec, 'label', 12);
  const widest = Math.max(0, ...labels.filter(Boolean).map(label => estimateTextWidth(label, labelSize)));
  return Math.min(170, Math.max(spec.padding.left, Math.ceil(widest + 20)));
}

function architectureLabelReserve(spec) {
  const labels = (spec.layers || spec.data?.layers || []).map(layer => layer.label || layer.id).filter(Boolean);
  const widest = Math.max(0, ...labels.map(label => estimateTextWidth(label, fontSize(spec, 'legend', 12))));
  return Math.min(170, Math.max(Math.min(110, spec.width * 0.2), Math.ceil(widest + 20)));
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
  const [min, max] = state.timeDomain || projectDateDomain(spec, rows);
  const map = timeAxis(scene, plot, min, max, spec.locale), positions = new Map();
  const analyticsMap = new Map((state.schedule?.tasks || []).map(task => [task.id, task]));
  const highlighted = new Set(spec.criticalPath === false || !overlays.criticalPath ? [] : Array.isArray(spec.criticalPath) ? spec.criticalPath : state.schedule?.criticalIds || []);
  const selected = projectSelection(spec, state);
  const rowHeight = plot.height / Math.max(1, rows.length), barHeight = Math.min(20, Math.max(10, rowHeight * 0.62)), barOffset = barHeight / 2, isEventTimeline = ['timeline', 'milestone'].includes(spec.type), eventRadius = Math.min(7, Math.max(3, rowHeight * 0.28)), placedEvents = [];
  let collisionsResolved = 0, collisionsUnresolved = 0;
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
    const baseY = plot.y + (index + 0.5) * rowHeight;
    const markerX = map(startValue);
    const eventOffsets = [0, eventRadius * 1.5, -eventRadius * 1.5, eventRadius * 3, -eventRadius * 3];
    const eventY = isEventTimeline ? eventOffsets.map(offset => Math.max(plot.y + eventRadius, Math.min(plot.y + plot.height - eventRadius, baseY + offset))).find(candidate => !placedEvents.some(event => Math.abs(event.x - markerX) < eventRadius * 2 + 4 && Math.abs(event.y - candidate) < eventRadius * 2 + 4)) : null;
    if (isEventTimeline && eventY == null) collisionsUnresolved += 1;
    const y = isEventTimeline ? eventY ?? baseY : baseY;
    if (isEventTimeline && y !== baseY) collisionsResolved += 1;
    if (isEventTimeline) placedEvents.push({ x: markerX, y });
    const milestone = spec.type === 'milestone' || row.milestone || start === end;
    if (overlays.baseline && baselineStart) {
      const baselineStartX = map(baselineStart), baselineEndX = map(baselineEnd || baselineStart);
      if (milestone) scene.add({ id: `project-baseline-${index}`, type: 'circle', geometry: { cx: baselineStartX, cy: y, r: 4 }, bounds: { x: baselineStartX - 4, y: y - 4, width: 8, height: 8 }, style: { fill: spec.theme.background, stroke: spec.theme.axis, strokeWidth: 1.5 }, zIndex: 1 });
      else scene.add({ id: `project-baseline-${index}`, type: 'rect', geometry: { x: baselineStartX, y: y - barOffset - 4, width: Math.max(2, baselineEndX - baselineStartX), height: 4 }, style: { fill: spec.theme.border }, zIndex: 1 });
    }
    if (overlays.actual && actualStart) {
      const actualStartX = map(actualStart), actualEndX = map(actualEnd || actualStart);
      if (milestone) scene.add({ id: `project-actual-${index}`, type: 'circle', geometry: { cx: actualStartX, cy: y, r: 3 }, bounds: { x: actualStartX - 3, y: y - 3, width: 6, height: 6 }, style: { fill: spec.theme.text }, zIndex: 3 });
      else scene.add({ id: `project-actual-${index}`, type: 'rect', geometry: { x: actualStartX, y: y + barOffset + 2, width: Math.max(2, actualEndX - actualStartX), height: 3 }, style: { fill: spec.theme.text, opacity: 0.35 }, zIndex: 3 });
    }
    const geometry = milestone ? { cx: start, cy: y, r: eventRadius } : { x: start, y: y - barOffset, width: Math.max(2, end - start), height: barHeight };
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
    const labelSize = Math.max(9, Math.min(fontSize(spec, 'axis', 12), rowHeight * 0.45));
    text(scene, `project-label-${index}`, truncateText(label, Math.max(labelSize, plot.x - 20), labelSize), plot.x - 12, y + 4, { textAnchor: 'end', font: `${labelSize}px system-ui` });
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
  if (isEventTimeline) state.eventLayout = { collisionsResolved, collisionsUnresolved, rows: rows.length };
  rows.forEach((row, index) => (row.dependencies || []).forEach((dependency, dependencyIndex) => {
    const fromId = dependencyId(dependency), toId = row.id;
    const from = positions.get(fromId), to = positions.get(toId);
    if (!from || !to) return;
    const critical = highlighted.has(fromId) && highlighted.has(toId) && state.schedule?.criticalEdges?.some(edge => edge.from === fromId && edge.to === toId);
    arrow(scene, `dependency-${index}-${dependencyIndex}`, routeGanttDependency(dependency, from, to, positions, barOffset, plot), { from: fromId, to: toId, type: dependencyType(dependency), critical }, critical);
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
  const map = timeAxis(scene, plot, min, max, spec.locale);
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
  const messages = projectMessages(spec.locale);
  text(scene, 'burndown-projected', forecast.date ? `${messages.estimatedFinish}: ${forecast.date}` : `${messages.forecastUnavailable}: ${forecast.reason}`, plot.x, plot.y - 16, { font: spec.theme.typography.axis.font });
}

function diagramScene(scene, spec, rows, state) {
  const diagramSpec = normalizeDiagramData(spec);
  const plot = state.plot, mode = diagramSpec.diagram.mode, edges = diagramSpec.edges, lanes = diagramSpec.lanes, layers = diagramSpec.layers, groups = diagramSpec.groups, layout = layoutDiagram(diagramSpec, plot);
  const architectureLayout = mode === 'architecture' && layers.length ? layoutArchitectureNodes(diagramSpec, plot) : {};
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
  const edgeLabelBoxes = [], labelLayout = { visible: 0, wrapped: 0, scaled: 0, truncated: 0, suppressed: 0, edgeOnLine: 0, edgeOffset: 0, backgrounded: 0 };
  state.labelLayout = { ...(state.labelLayout || {}), diagram: labelLayout };
  state.labelWarnings = [];
  lanes.forEach((lane, index) => {
    scene.add({ id: `lane-${index}`, type: 'rect', geometry: { x: plot.x, y: plot.y + index * laneHeight, width: Math.max(plot.width, columns * gapX), height: laneHeight }, style: { fill: index % 2 ? spec.theme.surface : spec.theme.background, stroke: spec.theme.border }, zIndex: -1 });
    text(scene, `lane-label-${index}`, lane.label || lane.id, plot.x - 12, plot.y + index * laneHeight + 20, { textAnchor: 'end' });
  });
  if (mode === 'architecture' && layers.length) layers.forEach((layer, index) => {
    const layerHeight = plot.height / layers.length;
    scene.add({ id: `layer-${layer.id}`, type: 'rect', geometry: { x: plot.x, y: plot.y + index * layerHeight, width: plot.width, height: layerHeight }, style: { fill: index % 2 ? spec.theme.surface : spec.theme.background, stroke: spec.theme.border }, zIndex: -2 });
    const compactLegendSize = Math.min(10, Number(spec.theme.typography.legend.size) || 9);
    text(scene, `layer-label-${layer.id}`, layer.label || layer.id, plot.x - 12, plot.y + index * layerHeight + Math.min(20, layerHeight / 2 + 4), { textAnchor: 'end', font: state.compact ? `550 ${compactLegendSize}px system-ui, sans-serif` : spec.theme.typography.legend.font });
  });
  rows.forEach((row, index) => {
    const rank = ranks.get(row.id), lane = Math.max(0, lanes.findIndex(item => item.id === row.laneId));
    const slotKey = `${lane}:${rank}`, slot = slots.get(slotKey) || 0;
    slots.set(slotKey, slot + 1);
    const sameCell = rows.filter(item => ranks.get(item.id) === rank && (!lanes.length || item.laneId === row.laneId)).length;
    const generated = layout[row.id];
    const nodeFont = mode === 'architecture' && state.compact ? '550 10px system-ui, sans-serif' : null;
      const architectureBox = architectureLayout[row.id];
      const geometry = architectureBox
        ? { ...architectureBox, x: row.position?.x ?? architectureBox.x, y: row.position?.y ?? architectureBox.y }
        : flowNodeBox(row, lanes.length ? { ...generated, y: undefined } : generated, { x: plot.x + rank * gapX + 12, y: plot.y + (lanes.length ? lane * laneHeight : 0) + (slot + 0.5) * (lanes.length ? laneHeight : Math.max(plot.height, sameCell * 64)) / sameCell - (flowNodeKind(row) === 'connector' ? 14 : 18) });
    positions.set(row.id, geometry);
    if (collapsedGroups.has(row.groupId)) return;
    const depth = row.parentId ? (ranks.get(row.id) || 0) : 0;
    const colorIndex = mode === 'mindmap' ? depth % spec.colors.length : lane >= 0 ? lane % spec.colors.length : index % spec.colors.length;
    const kind = mode === 'process' && spec.type === 'flow' ? flowNodeKind(row) : 'process', visual = flowNodeVisual(kind, geometry);
    scene.add({ id: `node-${row.id}`, type: visual.type, geometry: visual.geometry, bounds: { ...geometry }, style: { fill: spec.colors[colorIndex], stroke: row.root || mode === 'mindmap' && !row.parentId ? spec.theme.focus : spec.theme.background, strokeWidth: row.root || mode === 'mindmap' && !row.parentId ? 2 : 1 }, dataRef: { nodeId: row.id, kind, dataIndex: index, datum: row, groupId: row.groupId || null, layerId: row.layerId || null, parentId: row.parentId || null }, interactive: true, zIndex: 2 });
    if (spec.editing?.enabled && spec.interaction?.portConnect) (row.ports || []).forEach(port => {
      const point = port.side === 'left' ? { x: geometry.x, y: geometry.y + geometry.height * (port.offset ?? 0.5) } : port.side === 'top' ? { x: geometry.x + geometry.width * (port.offset ?? 0.5), y: geometry.y } : port.side === 'bottom' ? { x: geometry.x + geometry.width * (port.offset ?? 0.5), y: geometry.y + geometry.height } : { x: geometry.x + geometry.width, y: geometry.y + geometry.height * (port.offset ?? 0.5) };
      scene.add({ id: `port-${row.id}-${port.id}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 4 }, bounds: { x: point.x - 6, y: point.y - 6, width: 12, height: 12 }, style: { fill: spec.theme.background, stroke: spec.theme.text, strokeWidth: 1.5 }, dataRef: { nodeId: row.id, portId: port.id, groupId: row.groupId || null }, interactive: true, zIndex: 4 });
    });
    const label = diagramNodeLabelLayout(row, kind, geometry, spec, nodeFont);
    if (label) {
      const rawLabel = String(row.label || row.id), labelFont = nodeFont ? nodeFont.replace(/\d+(?:\.\d+)?px/, `${label.size}px`) : `${label.size}px system-ui`;
      textBlock(scene, `node-label-${row.id}`, label, geometry.x + geometry.width / 2, geometry.y + geometry.height / 2, { fill: markText(spec.theme, spec.colors[lane % spec.colors.length]), font: labelFont }, { nodeId: row.id, rawLabel, renderedLabel: label.lines.join('\n'), truncated: label.truncated });
      labelLayout.visible += 1;
      if (label.wrapped) labelLayout.wrapped += 1;
      if (label.scaled) labelLayout.scaled += 1;
      if (label.truncated) { labelLayout.truncated += 1; state.labelWarnings.push({ code: 'LABEL_TRUNCATED', path: `nodes.${index}.label`, nodeId: row.id, rawLabel, renderedLabel: label.lines.join('\n'), message: `Node label "${rawLabel}" was truncated to fit its shape.`, suggestion: 'Increase node size or shorten the label.' }); }
    } else if (kind !== 'connector') {
      labelLayout.suppressed += 1;
      state.labelWarnings.push({ code: 'LABELS_SUPPRESSED', path: `nodes.${index}.label`, count: 1, nodeId: row.id, message: `Node label for "${row.label || row.id}" was hidden because the node is too small.`, suggestion: 'Increase node size or use the node tooltip/accessibility text.' });
    }
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
    const path = routeEdgePath({ ...edge, curveTension: edge.curveTension ?? diagramSpec.diagram.curveTension, grid: diagramSpec.diagram.grid, obstacles, fromPortDefinition, toPortDefinition, preserveSides: mode === 'architecture' }, from, to, routing);
    const points = path.points;
    arrow(scene, `edge-${index}`, points, { from: edge.from, to: edge.to, edgeId: edge.id || `edge-${index}`, status: edge.status, routing, curveTension: edge.curveTension ?? diagramSpec.diagram.curveTension, waypoints: edge.waypoints || [], fromPortDefinition, toPortDefinition, fromGroupId: fromNode.groupId || null, toGroupId: toNode.groupId || null }, edge.critical === true, path.curve);
    if (edge.label) {
      const placement = edgeLabelLayout({ ...edge, points, curve: path.curve }, spec, positions, edgeLabelBoxes);
      if (placement) {
        edgeLabelBoxes.push(placement.box);
        const rawLabel = String(edge.label), labelFont = `${placement.block.size}px system-ui`;
        if (placement.onLine) labelLayout.edgeOnLine += 1; else labelLayout.edgeOffset += 1;
        if (placement.block.wrapped) labelLayout.wrapped += 1;
        if (placement.block.scaled) labelLayout.scaled += 1;
        if (placement.block.truncated) { labelLayout.truncated += 1; state.labelWarnings.push({ code: 'LABEL_TRUNCATED', path: `edges.${index}.label`, edgeId: edge.id || `edge-${index}`, rawLabel, renderedLabel: placement.block.lines.join('\n'), message: `Edge label "${rawLabel}" was truncated to fit the available line space.`, suggestion: 'Increase the edge length or shorten the label.' }); }
        if (placement.onLine) { labelPlate(scene, `edge-label-${index}`, placement.box, spec.theme.background); labelLayout.backgrounded += 1; }
        textBlock(scene, `edge-label-${index}`, placement.block, placement.x, placement.y, { fill: spec.theme.text, font: labelFont }, { edgeId: edge.id || `edge-${index}`, rawLabel, renderedLabel: placement.block.lines.join('\n'), onLine: placement.onLine, offsetX: placement.x - placement.anchor.x, offsetY: placement.y - placement.anchor.y });
      }
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
  const left = spec.type === 'architecture' ? architectureLabelReserve(spec) : ['gantt', 'timeline', 'milestone', 'swimlane'].includes(spec.type) ? projectLabelReserve(spec, sourceRows) : spec.padding.left;
  const title = titleLayout(spec);
  const plotTop = Math.max(spec.padding.top, title.bottom + (title.bottom ? 12 : 0)) + (spec.type === 'burndown' ? 16 : 0);
  const plotWidth = Math.max(1, spec.width - left - spec.padding.right), dateDomain = projectDateDomain(spec, sourceRows), xLabels = axisLabelLayout(spec, projectTickLabels(dateDomain[0], dateDomain[1], plotWidth, spec.locale), plotWidth);
  const bottomReserve = Math.max(spec.padding.bottom + 16, Math.ceil(16 + xLabels.projectedHeight));
  const temporalProject = ['gantt', 'timeline', 'milestone'].includes(spec.type);
  const timeAxis = ['timeline', 'milestone'].includes(spec.type) ? {
    orientation: 'horizontal',
    field: 'date',
    coordinate: 'x',
    rowCoordinate: 'y',
    domain: [...dateDomain],
    domainISO: dateDomain.map(value => new Date(value).toISOString())
  } : null;
  const state = { plot: { x: left, y: plotTop, width: plotWidth, height: Math.max(1, spec.height - plotTop - bottomReserve) }, xLabels, compact: spec.width < 360 || spec.height < 240, recommendedSize: { minWidth: 280, minHeight: 220 }, linked, projectAnalytics: { linked }, timeDomain: temporalProject ? [...dateDomain] : null, timeAxis };
  scene.xLabelLayout = xLabels;
  if (spec.type === 'gantt') {
    state.schedule = analyzeSchedule(data.rows, { calendar: projectConfig(spec).calendar || {} });
    state.projectAnalytics.schedule = state.schedule;
    state.projectAnalytics.assumptions = state.schedule.assumptions;
    state.projectAnalytics.warnings = state.schedule.warnings;
  }
  if (!data.rows.length) text(scene, 'empty', sourceRows.length && linked.visibleCount === 0 ? 'No matching data' : spec.emptyText || 'No data', spec.width / 2, spec.height / 2, { textAnchor: 'middle' });
  else if (diagram) {
    diagramScene(scene, spec, data.rows, state);
    if (state.labelWarnings?.length) data.warnings.push(...state.labelWarnings);
  }
  else if (spec.type === 'burndown') burndownScene(scene, spec, data.rows, state);
  else tasksScene(scene, spec, data.rows, state);
  if (state.eventLayout?.collisionsUnresolved) data.warnings.push({
    code: 'TIMELINE_COLLISION',
    message: 'Timeline or milestone markers could not be fully separated in the available space.',
    suggestion: 'Increase the chart height or reduce the number of events.'
  });
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

export function projectTooltip(type, row, locale = 'en-US') {
  if (!row) return '';
  const messages = projectMessages(locale);
  if (type === 'burndown') return [
    `${messages.date}: ${row.date}`,
    `${messages.remaining}: ${row.remaining ?? row.actual ?? row.value}`,
    `${messages.scopeChange}: ${row.scopeChange || 0}`,
    row.scope != null ? `${messages.totalScope}: ${row.scope}` : null,
    row.completed != null ? `${messages.completed}: ${row.completed}` : null,
    row.forecast ? `${messages.estimatedFinish}: ${row.forecast}` : `${messages.forecast}: ${row.forecastReason || messages.unavailable}`
  ].filter(Boolean).join('\n');
  const dependencies = (row.dependencies || []).map(dependencyId).filter(Boolean);
  const variance = row.endVarianceDays ?? row.baselineVarianceDays ?? null;
  if (type === 'mindmap') return [row.label || row.id, row.parentId ? `${messages.parent}: ${row.parentId}` : messages.rootTopic, row.branch ? `${messages.branch}: ${row.branch}` : null, row.description].filter(value => value != null && value !== '').join('\n');
  if (type === 'architecture') return [row.label || row.id, row.layerId ? `${messages.layer}: ${row.layerId}` : null, row.boundaryId ? `${messages.boundary}: ${row.boundaryId}` : null, row.role ? `${messages.role}: ${row.role}` : null, row.description].filter(value => value != null && value !== '').join('\n');
  return [
    row.name || row.title || row.label || row.id,
    row.start ? `${row.start} → ${row.end || row.start}` : row.date,
    row.progress != null ? `${messages.progress}: ${row.progress <= 1 ? Math.round(row.progress * 100) : row.progress}%` : null,
    row.status ? `${messages.status}: ${row.status}` : null,
    row.owner || row.resource ? `${messages.owner}: ${row.owner || row.resource}` : null,
    dependencies.length ? `${messages.dependsOn}: ${dependencies.join(', ')}` : null,
    row.critical != null ? `${messages.critical}: ${row.critical ? messages.yes : messages.no} · ${messages.float}: ${row.float ?? row.slack ?? 0} ${messages.days}` : null,
    variance != null ? `${messages.variance}: ${variance > 0 ? '+' : ''}${variance} ${messages.days}` : null,
    row.laneId ? `${messages.lane}: ${row.laneId}` : null,
    row.description
  ].filter(value => value != null && value !== '').join('\n');
}

export function rerouteDiagramScene(scene) {
  const nodeGeometries = new Map();
  scene.walk(item => { if (item.id.startsWith('node-') && !item.id.startsWith('node-label-') && item.dataRef?.nodeId && item.geometry) nodeGeometries.set(item.dataRef.nodeId, item.geometry); });
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
    if (label && labelPoint) {
      const old = { x: label.geometry.x, y: label.geometry.y }, offsetX = Number(label.dataRef?.offsetX) || 0, offsetY = Number(label.dataRef?.offsetY) || 0;
      label.geometry.x = labelPoint.x + offsetX; label.geometry.y = labelPoint.y + offsetY;
      const background = scene.find(`edge-label-${edgeIndex}-background`), dx = label.geometry.x - old.x, dy = label.geometry.y - old.y;
      if (background) { background.geometry.x += dx; background.geometry.y += dy; }
      for (let lineIndex = 1; ; lineIndex += 1) { const line = scene.find(`edge-label-${edgeIndex}-${lineIndex}`); if (!line) break; line.geometry.x += dx; line.geometry.y += dy; }
    }
  });
  return scene;
}
