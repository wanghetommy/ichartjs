/**
 * Standard chart profile scene builders.
 * This module intentionally contains no project, diagram, or board imports.
 */
import { Scene, SceneNode } from './scene.mjs';
import { normalizeData } from './data.mjs';
import { applyTransforms } from './transforms.mjs';
import { formatValue } from './format.mjs';
import { estimateTextWidth, fontSize, polarLabelLayout, titleLayout, truncateText } from './layout.mjs';

export const standardChartTypes = ['line', 'area', 'bar', 'column', 'pie', 'scatter', 'funnel', 'gauge', 'heatmap', 'radar'];
const axisFree = new Set(['pie', 'funnel', 'gauge', 'radar']);
const pick = (row, encoding, fallback) => row?.[encoding?.field || fallback];
const font = (spec, role, fallback = '12px system-ui') => spec.theme?.typography?.[role]?.font || fallback;
const text = (scene, id, value, x, y, style = {}, dataRef = null) => scene.add(new SceneNode({ id, type: 'text', geometry: { text: String(value), x, y }, style, dataRef, zIndex: 4 }));
const niceCeil = value => { const positive = Math.abs(Number(value)); if (!(positive > 0)) return 1; const power = 10 ** Math.floor(Math.log10(positive)); const normalized = positive / power; const mantissa = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10].find(item => item >= normalized) || 10; return mantissa * power; };
const colorForText = (spec, fill) => { const hex = String(fill || '').replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(hex)) return spec.theme.text; const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16)); return (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000 > 155 ? '#0f172a' : '#ffffff'; };

function addTitle(scene, spec) {
  const title = titleLayout(spec);
  if (spec.title?.text) text(scene, 'title', spec.title.text, spec.width / 2, title.titleY, { fill: spec.theme.text, font: font(spec, 'title'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' });
  if (spec.title?.subtitle) text(scene, 'subtitle', spec.title.subtitle, spec.width / 2, title.subtitleY, { fill: spec.theme.muted, font: font(spec, 'subtitle'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' });
  return title;
}

function legendEntries(spec, data, series) {
  if (spec.legend?.visible === false) return [];
  if (spec.type === 'pie') { const field = spec.encoding.category?.field || 'name'; return data.rows.map((row, index) => ({ name: String(row[field] ?? `Item ${index + 1}`), color: spec.colors[index % spec.colors.length] })); }
  return series.map((item, index) => ({ name: item.name || item.field || `Series ${index + 1}`, color: spec.colors[index % spec.colors.length] }));
}

function addLegend(scene, spec, entries, title) {
  if (!entries.length) return { bottom: title.bottom, visible: false };
  const size = fontSize(spec, 'legend', 12), lineHeight = Math.max(18, size * 1.4), available = spec.width - spec.padding.left - spec.padding.right;
  let x = spec.padding.left, y = title.bottom ? title.bottom + 12 : spec.padding.top, row = 0;
  entries.forEach((entry, index) => {
    const label = truncateText(entry.name, Math.max(size * 4, available - 20), size), width = 18 + estimateTextWidth(label, size) + 16;
    if (x + width > spec.width - spec.padding.right && x > spec.padding.left) { row += 1; x = spec.padding.left; }
    scene.add(new SceneNode({ id: `legend-swatch-${index}`, type: 'rect', geometry: { x, y: y + row * lineHeight - 6, width: 10, height: 10 }, style: { fill: entry.color }, zIndex: 4 }));
    text(scene, `legend-label-${index}`, label, x + 16, y + row * lineHeight, { fill: spec.theme.text, font: font(spec, 'legend'), textBaseline: 'middle', baseline: 'middle' });
    x += width;
  });
  return { bottom: y + (row + 1) * lineHeight, visible: true };
}

function layout(spec, data, series, title, legend) {
  const xEncoding = spec.encoding.x || { field: 'name', type: 'category' }, xField = xEncoding.field || 'name';
  const categories = [...new Set(data.rows.map(row => String(row[xField] ?? '')))].filter(Boolean);
  const values = data.rows.flatMap(row => series.map(item => Number(row[item.field]))).filter(Number.isFinite);
  const rawMin = Math.min(0, ...(values.length ? values : [0])), rawMax = Math.max(1, ...(values.length ? values : [1]));
  const domain = Array.isArray(spec.yAxis?.domain) ? spec.yAxis.domain.map(Number) : [rawMin, spec.yAxis?.nice === false ? rawMax : niceCeil(rawMax)];
  const leftLabels = spec.type === 'bar' ? categories : domain.map(value => formatValue(value, spec.yAxis?.format, spec.locale));
  const leftWidth = Math.max(28, ...leftLabels.map(value => estimateTextWidth(value, fontSize(spec, 'axis', 12))));
  const top = axisFree.has(spec.type) ? Math.max(spec.padding.top, legend.bottom) : Math.max(spec.padding.top, legend.bottom) + 8;
  const bottom = axisFree.has(spec.type) ? spec.height - spec.padding.bottom : spec.height - spec.padding.bottom - 30;
  const plot = { x: spec.type === 'bar' ? spec.padding.left + leftWidth + 20 : spec.padding.left + (axisFree.has(spec.type) ? 0 : leftWidth + 20), y: top, width: spec.width - spec.padding.left - spec.padding.right - (spec.type === 'bar' ? leftWidth + 20 : axisFree.has(spec.type) ? 0 : leftWidth + 20), height: Math.max(1, bottom - top) };
  const x = category => spec.type === 'scatter' || xEncoding.type === 'quantitative' ? plot.x + ((Number(category) - rawMin) / (rawMax - rawMin || 1)) * plot.width : plot.x + (categories.indexOf(String(category)) + 0.5) * plot.width / Math.max(1, categories.length);
  const y = value => plot.y + plot.height - ((Number(value) - domain[0]) / (domain[1] - domain[0] || 1)) * plot.height;
  return { x, y, plot, categories, domain, xField, series, top, bottom };
}

function addAxes(scene, spec, state) {
  const { plot, categories, domain, x, y } = state, axisFont = font(spec, 'axis'), axisColor = spec.theme.axis;
  scene.add(new SceneNode({ id: 'axis-x', type: 'line', geometry: { x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height }, style: { stroke: axisColor } }));
  scene.add(new SceneNode({ id: 'axis-y', type: 'line', geometry: { x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height }, style: { stroke: axisColor } }));
  if (spec.grid?.visible !== false) [0, .25, .5, .75, 1].forEach((ratio, index) => scene.add(new SceneNode({ id: `grid-${index}`, type: 'line', geometry: { x1: plot.x, y1: plot.y + plot.height * ratio, x2: plot.x + plot.width, y2: plot.y + plot.height * ratio }, style: { stroke: spec.grid?.color || spec.theme.grid, strokeWidth: spec.theme.marks.gridWidth }, zIndex: -2 })));
  const ticks = [0, .25, .5, .75, 1];
  ticks.forEach((ratio, index) => text(scene, `axis-y-label-${index}`, formatValue(domain[0] + (domain[1] - domain[0]) * (1 - ratio), spec.yAxis?.format, spec.locale), plot.x - 8, plot.y + plot.height * ratio, { fill: spec.theme.muted, font: axisFont, textAnchor: 'end', textBaseline: 'middle', baseline: 'middle' }));
  if (spec.type !== 'bar') categories.forEach((category, index) => text(scene, `axis-x-label-${index}`, category, x(category), plot.y + plot.height + 20, { fill: spec.theme.muted, font: axisFont, textAnchor: 'middle' }));
  if (spec.xAxis?.title) text(scene, 'axis-x-title', spec.xAxis.title, plot.x + plot.width / 2, spec.height - spec.padding.bottom + 4, { fill: spec.theme.text, font: axisFont, textAnchor: 'middle' });
  if (spec.yAxis?.title) text(scene, 'axis-y-title', spec.yAxis.title, spec.padding.left / 2, plot.y + plot.height / 2, { fill: spec.theme.text, font: axisFont, textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle', rotation: -90 });
}

function addMarkLabel(scene, spec, id, value, x, y, dataRef, fill = spec.theme.text) {
  if (!spec.labels?.enabled) return;
  text(scene, `${id}-label`, formatValue(value, spec.labels.format, spec.locale), x, y, { fill, font: font(spec, 'label'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' }, dataRef);
}

export function buildStandardScene(spec) {
  const data = spec.transform ? applyTransforms(spec.data, spec.transform) : normalizeData(spec.data);
  const scene = new Scene(spec.width, spec.height), series = Array.isArray(spec.encoding.y) ? spec.encoding.y : [spec.encoding.y || { field: 'value', name: 'Value' }], title = addTitle(scene, spec), legend = addLegend(scene, spec, legendEntries(spec, data, series), title), state = layout(spec, data, series, title, legend);
  if (!axisFree.has(spec.type)) addAxes(scene, spec, state);
  if (!data.rows.length) { text(scene, 'empty', spec.emptyText || 'No data', spec.width / 2, spec.height / 2, { fill: spec.theme.muted, font: font(spec, 'subtitle'), textAnchor: 'middle' }); return { scene, data, state }; }
  if (spec.type === 'pie') {
    const category = spec.encoding.category?.field || 'name', field = spec.encoding.value?.field || 'value', values = data.rows.map(row => Number(row[field])), total = values.reduce((sum, value) => sum + (value > 0 ? value : 0), 0), cx = spec.width / 2, cy = state.plot.y + state.plot.height / 2, radius = Math.min(state.plot.width, state.plot.height) * .44; let angle = -Math.PI / 2;
    data.rows.forEach((row, index) => { const raw = values[index], value = Number.isFinite(raw) ? Math.max(0, raw) : 0, end = angle + (total ? value / total : 0) * Math.PI * 2, fill = spec.colors[index % spec.colors.length]; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'arc', geometry: { cx, cy, r: radius, start: angle, end }, bounds: { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }, style: { fill, stroke: spec.theme.background, strokeWidth: 1 }, dataRef: { dataIndex: index, category: row[category], value: raw }, interactive: true })); if (spec.labels?.enabled && total) { const placement = polarLabelLayout(formatValue(value / total, { style: 'percent' }, spec.locale), { cx, cy, outerRadius: radius, size: fontSize(spec, 'label', 12), minSize: 10, padding: 4, startAngle: angle, endAngle: end }); addMarkLabel(scene, spec, `series-0-item-${index}`, value / total, placement.x, placement.y, { dataIndex: index }, colorForText(spec, fill)); } angle = end; });
    if (values.some(value => value < 0)) data.warnings.push({ code: 'NEGATIVE_VALUE_DROPPED', path: `data.values.${field}`, message: 'Negative pie values are ignored when calculating shares.', suggestion: 'Use non-negative part-to-whole values.' });
  } else if (spec.type === 'funnel') {
    const field = spec.encoding.value?.field || 'value', category = spec.encoding.category?.field || 'name', max = Math.max(...data.rows.map(row => Number(row[field]) || 0), 1), height = state.plot.height / data.rows.length;
    data.rows.forEach((row, index) => { const value = Number(row[field]) || 0, width = state.plot.width * Math.max(.1, value / max), geometry = { x: state.plot.x + (state.plot.width - width) / 2, y: state.plot.y + index * height, width, height: Math.max(2, height - 3) }, fill = spec.colors[index % spec.colors.length]; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill }, dataRef: { dataIndex: index, category: row[category], value }, interactive: true })); text(scene, `funnel-label-${index}`, truncateText(row[category] ?? `Stage ${index + 1}`, Math.max(20, width - 8), fontSize(spec, 'label', 12)), geometry.x + width / 2, geometry.y + geometry.height / 2, { fill: colorForText(spec, fill), font: font(spec, 'label'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' }); });
  } else if (spec.type === 'gauge') {
    const field = spec.encoding.value?.field || 'value', value = Number(data.rows[0]?.[field]) || 0, domain = spec.domain || [0, 100], ratio = Math.max(0, Math.min(1, (value - domain[0]) / (domain[1] - domain[0] || 1))), cx = spec.width / 2, cy = state.plot.y + state.plot.height * .66, radius = Math.min(state.plot.width * .42, state.plot.height * .62); scene.add(new SceneNode({ id: 'gauge-background', type: 'arc', geometry: { cx, cy, r: radius, start: Math.PI, end: Math.PI * 2 }, style: { fill: spec.theme.grid } })); scene.add(new SceneNode({ id: 'gauge-value', type: 'arc', geometry: { cx, cy, r: radius, start: Math.PI, end: Math.PI + Math.PI * ratio }, style: { fill: spec.colors[0] }, interactive: true })); text(scene, 'gauge-label', formatValue(value, spec.labels?.format, spec.locale), cx, cy - radius * .28, { fill: spec.theme.text, font: font(spec, 'metric'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' });
  } else if (spec.type === 'radar') {
    const category = spec.encoding.category?.field || 'name', metrics = Object.keys(data.rows[0] || {}).filter(key => key !== category && Number.isFinite(Number(data.rows[0][key]))), cx = spec.width / 2, cy = state.plot.y + state.plot.height / 2, radius = Math.min(state.plot.width, state.plot.height) * .36;
    metrics.forEach((metric, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, metrics.length), x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius; scene.add(new SceneNode({ id: `radar-axis-${index}`, type: 'line', geometry: { x1: cx, y1: cy, x2: x, y2: y }, style: { stroke: spec.theme.grid } })); text(scene, `radar-label-${index}`, metric, cx + Math.cos(angle) * (radius + 18), cy + Math.sin(angle) * (radius + 18), { fill: spec.theme.text, font: font(spec, 'axis'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' }); });
    data.rows.forEach((row, seriesIndex) => { const max = Math.max(1, ...metrics.map(metric => Number(row[metric]) || 0)), points = metrics.map((metric, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, metrics.length), ratio = Number(row[metric]) / max; return { x: cx + Math.cos(angle) * radius * ratio, y: cy + Math.sin(angle) * radius * ratio }; }); scene.add(new SceneNode({ id: `radar-series-${seriesIndex}`, type: 'path', geometry: { points, closed: true }, style: { fill: `${spec.colors[seriesIndex % spec.colors.length]}55`, stroke: spec.colors[seriesIndex % spec.colors.length], strokeWidth: 2 }, interactive: true })); });
  } else if (spec.type === 'heatmap') {
    const xField = spec.encoding.x?.field || 'x', yField = spec.encoding.y?.field || 'y', valueField = spec.encoding.color?.field || 'value', xs = [...new Set(data.rows.map(row => String(row[xField])))], ys = [...new Set(data.rows.map(row => String(row[yField])))], cellWidth = state.plot.width / Math.max(1, xs.length), cellHeight = state.plot.height / Math.max(1, ys.length), max = Math.max(1, ...data.rows.map(row => Number(row[valueField]) || 0));
    data.rows.forEach((row, index) => { const xIndex = xs.indexOf(String(row[xField])), yIndex = ys.indexOf(String(row[yField])), value = Number(row[valueField]) || 0, geometry = { x: state.plot.x + xIndex * cellWidth, y: state.plot.y + yIndex * cellHeight, width: cellWidth - 1, height: cellHeight - 1 }, fill = spec.colors[Math.min(spec.colors.length - 1, Math.floor(Math.max(0, value / max) * spec.colors.length))]; scene.add(new SceneNode({ id: `heatmap-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill }, dataRef: { dataIndex: index, value }, interactive: true })); });
  } else {
    const values = series, accumulators = data.rows.map(() => 0), band = state.plot.width / Math.max(1, state.categories.length);
    values.forEach((encoding, seriesIndex) => data.rows.forEach((row, index) => { const value = Number(row[encoding.field]) || 0, x = state.x(row[state.xField]), y = state.y(value), base = state.y(0), dataRef = { seriesIndex, dataIndex: index, field: encoding.field }; if (spec.type === 'line' || spec.type === 'area') { if (index > 0) { const previous = data.rows[index - 1], previousValue = Number(previous[encoding.field]) || 0; scene.add(new SceneNode({ id: `series-${seriesIndex}-line-${index}`, type: 'line', geometry: { x1: state.x(previous[state.xField]), y1: state.y(previousValue), x2: x, y2: y }, style: { stroke: spec.colors[seriesIndex], strokeWidth: 2 } })); } scene.add(new SceneNode({ id: `series-${seriesIndex}-point-${index}`, type: 'circle', geometry: { cx: x, cy: y, r: 4 }, bounds: { x: x - 6, y: y - 6, width: 12, height: 12 }, style: { fill: spec.colors[seriesIndex] }, dataRef, interactive: true })); addMarkLabel(scene, spec, `series-${seriesIndex}-point-${index}`, value, x, y - 10, dataRef); } else if (spec.type === 'scatter') { scene.add(new SceneNode({ id: `scatter-${index}`, type: 'circle', geometry: { cx: state.x(row[state.xField]), cy: state.y(value), r: 5 }, bounds: { x: state.x(row[state.xField]) - 7, y: state.y(value) - 7, width: 14, height: 14 }, style: { fill: spec.colors[0] }, dataRef, interactive: true })); } else { const vertical = spec.type === 'column', barWidth = band * .58 / Math.max(1, values.length), start = vertical ? state.x(row[state.xField]) - band * .29 + seriesIndex * barWidth : state.plot.x + ((accumulators[index] - state.domain[0]) / (state.domain[1] - state.domain[0] || 1)) * state.plot.width, geometry = vertical ? { x: start, y: Math.min(base, y), width: barWidth - 2, height: Math.abs(base - y) } : { x: Math.min(start, state.plot.x + ((value - state.domain[0]) / (state.domain[1] - state.domain[0] || 1)) * state.plot.width), y: state.plot.y + index * state.plot.height / data.rows.length + 3, width: Math.abs(((value - state.domain[0]) / (state.domain[1] - state.domain[0] || 1)) * state.plot.width - ((accumulators[index] - state.domain[0]) / (state.domain[1] - state.domain[0] || 1)) * state.plot.width), height: Math.max(8, state.plot.height / data.rows.length - 6) }; scene.add(new SceneNode({ id: `series-${seriesIndex}-item-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill: spec.colors[seriesIndex] }, dataRef, interactive: true })); addMarkLabel(scene, spec, `series-${seriesIndex}-item-${index}`, value, vertical ? geometry.x + geometry.width / 2 : geometry.x + geometry.width + 10, vertical ? geometry.y - 6 : geometry.y + geometry.height / 2, dataRef, colorForText(spec, spec.colors[seriesIndex])); accumulators[index] += value; } }));
  }
  return { scene, data, state };
}
