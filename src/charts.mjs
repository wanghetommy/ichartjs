/**
 * Chart-to-scene builders for generic and project visualizations.
 * Keeps chart specifications independent from Canvas and SVG renderers.
 */
import { Scene, SceneNode } from './scene.mjs';
import { normalizeData } from './data.mjs';
import { applyTransforms } from './transforms.mjs';
import { buildProjectScene } from './project.mjs';
import { formatValue } from './format.mjs';
import { contrastRatio, resolveTheme } from './theme.mjs';
import { axisLabelLayout, boxesOverlap, estimateTextWidth, fontSize, titleLayout, truncateText } from './layout.mjs';

const pick = (row, encoding, fallback) => row?.[encoding?.field || fallback];
const font = (spec, role, fallback = '12px system-ui') => spec.theme?.typography?.[role]?.font || fallback;
const niceMantissas = [1, 1.2, 1.5, 1.8, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];

function nearestNiceMantissa(value) {
  return niceMantissas.reduce((best, candidate) => Math.abs(Math.log(value / candidate)) < Math.abs(Math.log(value / best)) ? candidate : best, niceMantissas[0]);
}

function niceCeil(value) {
  const positive = Math.abs(Number(value));
  if (!(positive > 0) || !Number.isFinite(positive)) return 1;
  const power = 10 ** Math.floor(Math.log10(positive));
  const normalized = positive / power;
  const mantissa = niceMantissas.find(candidate => candidate >= normalized) || 10;
  return mantissa * power;
}

function validDomain(domain) {
  return Array.isArray(domain) && domain.length === 2 && domain.every(value => Number.isFinite(Number(value))) && Number(domain[1]) > Number(domain[0]);
}

function resolveAxisDomain(rawMin, rawMax, axis = {}, type = 'linear') {
  if (validDomain(axis.domain)) return [Number(axis.domain[0]), Number(axis.domain[1])];
  if (type === 'log') return [rawMin, rawMax];
  let min = rawMin, max = rawMax;
  if (axis.nice !== false) {
    min = min < 0 ? -niceCeil(-min) : 0;
    max = niceCeil(max);
  }
  if (!(max > min)) max = min + (niceCeil(Math.abs(min) || 1) || 1);
  return [min, max];
}

function axisTicks(min, max, axis = {}, type = 'linear') {
  if (!(max > min)) return [min, max];
  if (type === 'log') {
    const start = Math.ceil(Math.log10(Math.max(min, 0.000001)));
    const end = Math.floor(Math.log10(Math.max(max, 0.000001)));
    const powers = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => 10 ** (start + index));
    return [...new Set([min, ...powers.filter(value => value > min && value < max), max])];
  }
  const explicitCount = Number.isInteger(axis.ticks) && axis.ticks >= 2 ? axis.ticks : null;
  const targetIntervals = explicitCount ? explicitCount - 1 : 5;
  let intervals = explicitCount ? targetIntervals : 4, bestScore = Infinity;
  if (!explicitCount) {
    for (let candidate = 4; candidate <= 7; candidate += 1) {
      const step = (max - min) / candidate;
      const power = 10 ** Math.floor(Math.log10(Math.abs(step)));
      const score = Math.abs(Math.log((step / power) / nearestNiceMantissa(step / power))) + Math.abs(candidate - targetIntervals) * 0.08;
      if (score < bestScore) { bestScore = score; intervals = candidate; }
    }
  }
  return Array.from({ length: intervals + 1 }, (_, index) => min + (max - min) * index / intervals);
}

const axisFreeTypes = new Set(['pie', 'funnel', 'gauge', 'radar']);

function chromeLayout(spec, entries = []) {
  const title = titleLayout(spec);
  const visible = spec.legend?.visible !== false && entries.length >= 1;
  if (!visible) return { title, legend: { visible: false, items: [], position: 'top', top: title.bottom, bottom: title.bottom, left: spec.padding.left, right: spec.width - spec.padding.right, width: 0, height: 0 }, bottom: title.bottom };
  const size = fontSize(spec, 'legend', 12), lineHeight = Math.max(18, size * Number(spec.theme?.typography?.legend?.lineHeight || 1.4));
  const swatchSize = Math.max(8, Math.round(size * 0.75)), gap = Math.max(12, Math.round(size));
  const availableWidth = Math.max(1, spec.width - spec.padding.left - spec.padding.right);
  const requestedPosition = axisFreeTypes.has(spec.type) && ['top', 'right', 'bottom', 'left'].includes(spec.legend?.position) ? spec.legend.position : 'top';
  const sideLegend = requestedPosition === 'left' || requestedPosition === 'right';
  const labelBudget = sideLegend ? Math.max(size * 4, availableWidth * 0.34 - swatchSize - 6 - gap) : availableWidth - swatchSize - 6 - gap;
  const maxLabelWidth = Math.max(size, labelBudget);
  const measured = entries.map((entry, index) => {
    const rawName = String(entry.name), name = truncateText(rawName, maxLabelWidth, size);
    return { ...entry, name, rawName, truncated: name !== rawName, index, width: swatchSize + 6 + estimateTextWidth(name, size) + gap };
  });
  if (sideLegend) {
    const width = Math.max(size * 4, ...measured.map(item => item.width));
    const top = Math.max(spec.padding.top, title.bottom ? title.bottom + 8 : spec.padding.top);
    const items = measured.map((item, index) => ({ ...item, x: requestedPosition === 'left' ? spec.padding.left : spec.width - spec.padding.right - width, y: top + index * lineHeight + lineHeight / 2, swatchSize }));
    const bottom = top + measured.length * lineHeight;
    return { title, legend: { visible: true, items, position: requestedPosition, top, bottom, left: requestedPosition === 'left' ? spec.padding.left : spec.width - spec.padding.right - width, right: requestedPosition === 'left' ? spec.padding.left + width : spec.width - spec.padding.right, width, height: measured.length * lineHeight, truncatedCount: measured.filter(item => item.truncated).length }, bottom: title.bottom };
  }
  const rows = [];
  measured.forEach(item => {
    let row = rows.at(-1);
    if (!row || row.width + item.width > availableWidth) { row = { width: 0, items: [] }; rows.push(row); }
    row.items.push(item);
    row.width += item.width;
  });
  const legendHeight = rows.length * lineHeight;
  const top = requestedPosition === 'bottom' ? spec.height - spec.padding.bottom - legendHeight : title.bottom ? title.bottom + 8 : Math.max(8, (spec.padding.top - legendHeight) / 2);
  const items = [];
  rows.forEach((row, rowIndex) => {
    let x = Math.max(spec.padding.left, spec.width - spec.padding.right - row.width);
    const y = top + rowIndex * lineHeight + lineHeight / 2;
    row.items.forEach(item => { items.push({ ...item, x, y, swatchSize }); x += item.width; });
  });
  const bottom = top + rows.length * lineHeight;
  return { title, legend: { visible: true, items, position: requestedPosition, top, bottom, left: spec.padding.left, right: spec.width - spec.padding.right, width: availableWidth, height: legendHeight, truncatedCount: measured.filter(item => item.truncated).length }, bottom: requestedPosition === 'bottom' ? title.bottom : Math.max(title.bottom, bottom) };
}

function styledSpec(spec) {
  const theme = spec.theme && typeof spec.theme === 'object' && spec.theme.typography ? spec.theme : resolveTheme(spec.theme, spec);
  return { ...spec, theme, colors: spec.colors || theme.colors, background: spec.background || theme.background, padding: spec.padding || theme.layout.padding };
}

function layout(spec, data, legendEntries = [], layoutOptions = {}) {
  const p = spec.padding, width = spec.width, height = spec.height;
  const chrome = chromeLayout(spec, legendEntries);
  const xEncoding = spec.encoding.x || { field: 'name', type: 'category' };
  const xField = xEncoding.field || 'name';
  const categories = [...new Set(data.rows.map(row => String(row[xField] ?? '')))].filter(Boolean);
  const temporal = xEncoding.type === 'temporal' || xEncoding.type === 'time';
  const quantitativeX = xEncoding.type === 'quantitative' || xEncoding.type === 'linear';
  const dates = temporal ? data.rows.map(row => new Date(row[xField]).getTime()).filter(Number.isFinite) : [];
  const xNumbers = quantitativeX ? data.rows.map(row => Number(row[xField])).filter(Number.isFinite) : [];
  const xMin = dates.length ? Math.min(...dates) : xNumbers.length ? Math.min(...xNumbers) : 0, xMax = dates.length ? Math.max(...dates) : xNumbers.length ? Math.max(...xNumbers) : 1;
  const yEncodings = Array.isArray(spec.encoding.y) ? spec.encoding.y : [spec.encoding.y || { field: 'value', type: 'quantitative' }];
  const yField = yEncodings[0]?.field || 'value';
  const stackMode = typeof spec.stack === 'string' ? spec.stack : spec.stack?.mode;
  const stackTotals = stackMode ? data.rows.flatMap(row => {
    const values = yEncodings.map(encoding => Number(row[encoding.field])).filter(Number.isFinite);
    if (stackMode === 'percent') return [0, 1];
    return [values.filter(value => value >= 0).reduce((sum, value) => sum + value, 0), values.filter(value => value < 0).reduce((sum, value) => sum + value, 0)];
  }) : [];
  const numbers = (stackTotals.length ? stackTotals : data.rows.flatMap(row => yEncodings.map(encoding => Number(row[encoding.field])))).filter(Number.isFinite);
  const rawMin = Math.min(0, ...(numbers.length ? numbers : [0]));
  const rawMax = Math.max(1, ...(numbers.length ? numbers : [1]));
  const axisType = spec.yAxis?.type || yEncodings[0]?.type || 'linear';
  const [min, max] = resolveAxisDomain(rawMin, rawMax, spec.yAxis || {}, axisType);
  const x = category => temporal ? plot.x + ((new Date(category).getTime() - xMin) / (xMax - xMin || 1)) * plot.width : quantitativeX ? plot.x + ((Number(category) - xMin) / (xMax - xMin || 1)) * plot.width : plot.x + (categories.indexOf(String(category)) + 0.5) * plot.width / Math.max(1, categories.length);
  const transform = value => axisType === 'log' ? Math.log10(Math.max(0.000001, Number(value))) : Number(value);
  const transformedMin = transform(min), transformedMax = transform(max);
  const y = value => plot.y + plot.height - ((transform(value) - transformedMin) / (transformedMax - transformedMin || 1)) * plot.height;
  const yRightNumbers = data.rows.map(row => Number(row[yEncodings[1]?.field])).filter(Number.isFinite);
  const rawRightMin = Math.min(0, ...(yRightNumbers.length ? yRightNumbers : [0])), rawRightMax = Math.max(1, ...(yRightNumbers.length ? yRightNumbers : [1]));
  const rightType = spec.yAxis?.right?.type || yEncodings[1]?.type || 'linear';
  const [rightMin, rightMax] = resolveAxisDomain(rawRightMin, rawRightMax, spec.yAxis?.right || {}, rightType);
  const yTicks = axisTicks(min, max, spec.yAxis || {}, axisType), rightTicks = axisTicks(rightMin, rightMax, spec.yAxis?.right || {}, rightType);
  const axisSize = fontSize(spec, 'axis', 12);
  const maxWidth = values => Math.max(0, ...values.map(value => estimateTextWidth(value, axisSize)));
  const categoryField = spec.encoding.x?.field || 'name';
  const categoryTexts = data.rows.map(row => String(row[categoryField] ?? ''));
  const matrixYField = spec.encoding.y?.field || 'y', matrixTexts = spec.type === 'heatmap' ? data.rows.map(row => String(row[matrixYField] ?? '')) : [];
  const leftTexts = spec.type === 'bar' ? categoryTexts : yTicks.map(value => formatValue(value, spec.yAxis?.format, spec.locale));
  const leftLabelWidth = maxWidth(leftTexts), rightLabelWidth = yEncodings.length > 1 && !stackMode ? maxWidth(rightTicks.map(value => formatValue(value, spec.yAxis?.right?.format, spec.locale))) : 0;
  const axisFree = axisFreeTypes.has(spec.type);
  const sideLabelWidth = Math.max(spec.type === 'bar' ? leftLabelWidth : 0, spec.type === 'heatmap' ? maxWidth(matrixTexts) : 0);
  const leftTitleBand = spec.yAxis?.title ? axisSize + 16 : 0;
  const rightTitleBand = spec.yAxis?.right?.title && yEncodings.length > 1 && !stackMode ? axisSize + 16 : 0;
  const cartesianLeft = 8 + leftTitleBand + leftLabelWidth + 10;
  const plotLeft = axisFree
    ? Math.max(p.left, chrome.legend.position === 'left' ? chrome.legend.right + 12 : p.left)
    : spec.type === 'bar'
      ? Math.max(p.left, spec.yAxis?.title ? cartesianLeft : sideLabelWidth + 24)
      : spec.type === 'heatmap'
        ? Math.min(width * 0.35, Math.max(p.left, sideLabelWidth + 24))
        : Math.max(p.left, cartesianLeft);
  const plotRight = axisFree
    ? Math.max(p.right, chrome.legend.position === 'right' ? spec.width - chrome.legend.left + 12 : p.right)
    : Math.max(p.right, rightLabelWidth ? rightLabelWidth + rightTitleBand + 18 : 0);
  const labelTopReserve = spec.type === 'column' && spec.labels?.enabled ? Math.ceil(fontSize(spec, 'label', 12) * 1.5 + 4) : 0;
  const plotWidth = Math.max(1, width - plotLeft - plotRight);
  const axisLabelTexts = temporal ? timeTicks(xMin, xMax, 5).map(value => formatTime(value, xMax - xMin, spec.xAxis?.format, spec.locale)) : quantitativeX ? timeTicks(xMin, xMax, 5).map(value => formatValue(value, spec.xAxis?.format, spec.locale)) : categories;
  const xLabels = axisLabelLayout(spec, spec.type === 'bar' ? [] : axisLabelTexts, plotWidth);
  const topChrome = chrome.legend.position === 'top' && chrome.legend.visible ? chrome.legend.bottom + 12 : Math.max(p.top, chrome.title.bottom + (chrome.title.bottom ? 12 : 0));
  const axisFreeBottomPadding = Number(layoutOptions.axisFreeBottomPadding ?? p.bottom);
  const bottomChrome = chrome.legend.position === 'bottom' && chrome.legend.visible ? chrome.legend.top - 12 : height - axisFreeBottomPadding;
  const plotTop = axisFree ? Math.max(p.top, topChrome) + labelTopReserve : Math.max(p.top, chrome.bottom + (chrome.bottom ? 12 : 0)) + labelTopReserve;
  const bottomReserve = Math.max(p.bottom, Math.ceil(16 + xLabels.projectedHeight + (spec.xAxis?.title ? 20 : 0)));
  const plotBottom = axisFree ? Math.min(height - axisFreeBottomPadding, bottomChrome) : height - bottomReserve;
  const plot = { x: plotLeft, y: plotTop, width: plotWidth, height: Math.max(1, plotBottom - plotTop) };
  const axisTitles = {
    y: spec.yAxis?.title ? truncateText(spec.yAxis.title, plot.height, axisSize) : null,
    right: spec.yAxis?.right?.title && yEncodings.length > 1 && !stackMode ? truncateText(spec.yAxis.right.title, plot.height, axisSize) : null
  };
  const axisTitleWarnings = [];
  if (spec.yAxis?.title && axisTitles.y !== String(spec.yAxis.title)) axisTitleWarnings.push({ path: 'yAxis.title', title: String(spec.yAxis.title), availableWidth: plot.height });
  if (spec.yAxis?.right?.title && axisTitles.right !== String(spec.yAxis.right.title) && yEncodings.length > 1 && !stackMode) axisTitleWarnings.push({ path: 'yAxis.right.title', title: String(spec.yAxis.right.title), availableWidth: plot.height });
  const rightTransform = value => rightType === 'log' ? Math.log10(Math.max(0.000001, Number(value))) : Number(value);
  const yRight = value => plot.y + plot.height - ((rightTransform(value) - rightTransform(rightMin)) / (rightTransform(rightMax) - rightTransform(rightMin) || 1)) * plot.height;
  const axisInfo = (rawDomain, domain, ticks, axis) => ({ rawDomain, domain, ticks, step: ticks.length > 1 ? (ticks[1] - ticks[0]) : null, policy: validDomain(axis?.domain) ? 'explicit' : axis?.nice === false ? 'raw' : 'nice' });
  return { plot, chrome, layoutFamily: axisFree ? spec.type : 'cartesian', xLabels, axisTitles, axisTitleWarnings, axisLayout: { size: axisSize, leftLabelWidth, rightLabelWidth }, compact: width < 360 || height < 240, recommendedSize: { minWidth: 280, minHeight: 220 }, xField, xEncoding, temporal, quantitativeX, xMin, xMax, yField, yEncodings, categories, rawMin, rawMax, min, max, rawRightMin, rawRightMax, rightMin, rightMax, yTicks, rightTicks, axes: { y: axisInfo([rawMin, rawMax], [min, max], yTicks, spec.yAxis || {}), right: axisInfo([rawRightMin, rawRightMax], [rightMin, rightMax], rightTicks, spec.yAxis?.right || {}) }, x, y, yRight, axisType, rightType };
}

function addText(scene, id, text, x, y, style = {}, dataRef = null) { scene.add(new SceneNode({ id, type: 'text', geometry: { text: String(text), x, y }, style, dataRef })); }

function addAxes(scene, spec, state) {
  const { plot, categories, min, max, x, y, yRight } = state;
  const axisSize = state.axisLayout.size;
  scene.add(new SceneNode({ id: 'axis-x', type: 'line', geometry: { x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height }, style: { stroke: spec.theme.axis } }));
  scene.add(new SceneNode({ id: 'axis-y', type: 'line', geometry: { x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height }, style: { stroke: spec.theme.axis } }));
  if (spec.type === 'bar') {
    const ticks = state.yTicks, numericX = value => plot.x + ((value - min) / (max - min || 1)) * plot.width;
    if (spec.grid?.visible !== false) ticks.forEach((value, index) => scene.add(new SceneNode({ id: `grid-x-${index}`, type: 'line', geometry: { x1: numericX(value), y1: plot.y, x2: numericX(value), y2: plot.y + plot.height }, style: { stroke: spec.grid?.color || spec.theme.grid, strokeWidth: spec.theme.marks.gridWidth }, zIndex: -2 })));
    ticks.forEach(value => addText(scene, `label-x-value-${value}`, formatValue(value, spec.xAxis?.format || spec.yAxis?.format, spec.locale), numericX(value), plot.y + plot.height + 22, { fill: spec.theme.muted, font: font(spec, 'axis'), textAnchor: 'middle' }));
    categories.forEach((category, index) => addText(scene, `label-y-category-${index}`, category, plot.x - 10, plot.y + (index + .5) * plot.height / Math.max(1, categories.length) + 4, { fill: spec.theme.muted, font: font(spec, 'axis'), textAnchor: 'end' }));
    if (spec.xAxis?.title) addText(scene, 'axis-x-title', spec.xAxis.title, plot.x + plot.width / 2, plot.y + plot.height + 42, { fill: spec.theme.text, font: font(spec, 'axis'), textAnchor: 'middle' });
    if (state.axisTitles.y) addText(scene, 'axis-y-title', state.axisTitles.y, 8 + axisSize / 2, plot.y + plot.height / 2, { fill: spec.theme.text, font: font(spec, 'axis'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle', rotation: -90 });
    return;
  }
  const labels = state.temporal || state.quantitativeX ? timeTicks(state.xMin, state.xMax, 5) : categories;
  const yTicks = state.yTicks;
  if (spec.grid?.visible !== false) yTicks.forEach((value, index) => scene.add(new SceneNode({ id: `grid-y-${index}`, type: 'line', geometry: { x1: plot.x, y1: y(value), x2: plot.x + plot.width, y2: y(value) }, style: { stroke: spec.grid?.color || spec.theme.grid, strokeWidth: spec.theme.marks.gridWidth }, zIndex: -2 })));
  labels.forEach((category, index) => {
    if (index % state.xLabels.step !== 0 && index !== labels.length - 1) return;
    addText(scene, `label-x-${category}`, state.temporal ? formatTime(category, state.xMax - state.xMin, spec.xAxis?.format, spec.locale) : state.quantitativeX ? formatValue(category, spec.xAxis?.format, spec.locale) : category, x(category), plot.y + plot.height + (state.xLabels.rotation ? 10 : 22), { fill: spec.theme.muted, font: font(spec, 'axis'), textAnchor: state.xLabels.rotation ? 'end' : 'middle', textBaseline: state.xLabels.rotation ? 'middle' : 'alphabetic', rotation: state.xLabels.rotation });
  });
  yTicks.forEach(value => addText(scene, `label-y-${value}`, formatValue(value, spec.yAxis?.format, spec.locale), plot.x - 10, y(value) + 4, { fill: spec.theme.muted, font: font(spec, 'axis'), textAnchor: 'end' }));
  if (state.yEncodings.length > 1 && !spec.stack) state.rightTicks.forEach(value => addText(scene, `label-y-right-${value}`, formatValue(value, spec.yAxis?.right?.format, spec.locale), plot.x + plot.width + 10, yRight(value) + 4, { fill: spec.theme.muted, font: font(spec, 'axis') }));
  if (spec.xAxis?.title) addText(scene, 'axis-x-title', spec.xAxis.title, plot.x + plot.width / 2, plot.y + plot.height + (state.xLabels.rotation ? state.xLabels.projectedHeight + 20 : 42), { fill: spec.theme.text, font: font(spec, 'axis'), textAnchor: 'middle' });
  if (state.axisTitles.y) addText(scene, 'axis-y-title', state.axisTitles.y, 8 + axisSize / 2, plot.y + plot.height / 2, { fill: spec.theme.text, font: font(spec, 'axis'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle', rotation: -90 });
  if (state.axisTitles.right) addText(scene, 'axis-y-right-title', state.axisTitles.right, spec.width - 8 - axisSize / 2, plot.y + plot.height / 2, { fill: spec.theme.text, font: font(spec, 'axis'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle', rotation: 90 });
}

function addTitles(scene, spec, positions) {
  if (spec.title?.text) addText(scene, 'title', spec.title.text, spec.width / 2, positions.titleY, { fill: spec.theme.text, font: font(spec, 'title'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' });
  if (spec.title?.subtitle) addText(scene, 'subtitle', spec.title.subtitle, spec.width / 2, positions.subtitleY, { fill: spec.theme.muted, font: font(spec, 'subtitle'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' });
}

function addLegend(scene, spec, legend) {
  if (!legend.visible) return;
  legend.items.forEach(item => { scene.add(new SceneNode({ id: `legend-swatch-${item.index}`, type: 'rect', geometry: { x: item.x, y: item.y - item.swatchSize / 2, width: item.swatchSize, height: item.swatchSize }, style: { fill: item.color } })); addText(scene, `legend-label-${item.index}`, item.name, item.x + item.swatchSize + 6, item.y, { fill: spec.theme.muted, font: font(spec, 'legend'), textBaseline: 'middle', baseline: 'middle' }); });
}

function legendEntries(spec, data, series, colors) {
  if (!data.rows.length || spec.legend?.visible === false) return [];
  if (spec.type === 'radar') return data.rows.map((row, index) => ({ name: row.name || row.id || `Series ${index + 1}`, color: colors[index % colors.length] }));
  if (['line', 'area', 'bar', 'column'].includes(spec.type)) return series.map((encoding, index) => ({ name: encoding.name || encoding.field, color: colors[index % colors.length] }));
  if (spec.type === 'pie') { const categoryField = spec.encoding.category?.field || 'name'; return data.rows.map((row, index) => ({ name: String(row[categoryField]), color: colors[index % colors.length] })); }
  return [];
}

function readableLabelColor(spec, background) {
  const preferred = spec.labels?.color || spec.theme.text;
  const candidates = [preferred, spec.theme.text, spec.theme.background, '#ffffff', '#172033'];
  return candidates.find(color => (contrastRatio(color, background) || 0) >= 4.5) || preferred;
}

function addMarkLabel(scene, spec, id, value, x, y, dataRef, bounds = null, anchor = null, formatOverride = null, labelBackground = null) {
  if (!spec.labels?.enabled) return;
  const text = formatValue(value, formatOverride || spec.labels.format, spec.locale), size = fontSize(spec, 'label', 12), width = estimateTextWidth(text, size), height = size * 1.25;
  const baseArea = bounds || scene._labelArea || { x: 0, y: 0, width: spec.width, height: spec.height };
  const area = spec.type === 'column' && !anchor ? { ...baseArea, y: baseArea.y - height - 4, height: baseArea.height + height + 4 } : baseArea;
  const markBackground = spec.type === 'column' && !anchor && y - height / 2 < area.y ? spec.colors?.[dataRef?.seriesIndex || 0] : null;
  const labelY = markBackground ? y + height + 8 : spec.type === 'column' && !anchor ? y - height / 2 - 4 : y;
  const safeX = Math.max(area.x + width / 2, Math.min(area.x + area.width - width / 2, x));
  const safeY = Math.max(area.y + height / 2, Math.min(area.y + area.height - height / 2, labelY));
  const anchorRadius = Number(anchor?.radius) || 0, anchorGap = Number(anchor?.gap) || 6;
  const anchorBox = anchor ? { x: anchor.x - anchorRadius - anchorGap, y: anchor.y - anchorRadius - anchorGap, width: anchorRadius * 2 + anchorGap * 2, height: anchorRadius * 2 + anchorGap * 2 } : null;
  const preferred = anchor ? anchor.y - anchorRadius - anchorGap - height / 2 : safeY;
  const alternate = anchor ? anchor.y + anchorRadius + anchorGap + height / 2 : safeY;
  const shifts = anchor ? [preferred, alternate, preferred - height - 3, alternate + height + 3] : [safeY, safeY - height - 3, safeY + height + 3, safeY - 2 * (height + 3), safeY + 2 * (height + 3)];
  const occupied = scene._labelBoxes || (scene._labelBoxes = []);
  const placement = shifts.map(candidateY => Math.max(area.y + height / 2, Math.min(area.y + area.height - height / 2, candidateY))).map(candidateY => ({ x: safeX, y: candidateY, box: { x: safeX - width / 2, y: candidateY - height / 2, width, height } })).find(candidate => !occupied.some(box => boxesOverlap(candidate.box, box, 2)) && (!anchorBox || !boxesOverlap(candidate.box, anchorBox, 0)));
  if (!placement) return;
  occupied.push(placement.box);
  addText(scene, `${id}-label`, text, placement.x, placement.y, { fill: labelBackground || markBackground ? readableLabelColor(spec, labelBackground || markBackground) : spec.labels.color || spec.theme.text, font: spec.labels.font || font(spec, 'label'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' }, dataRef);
}

function hexRgb(value) { const hex = String(value || '').replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(hex)) return [37, 99, 235]; return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16)); }
function colorMix(start, end, ratio) { const left = hexRgb(start), right = hexRgb(end), value = Math.max(0, Math.min(1, ratio)); return `rgb(${left.map((channel, index) => Math.round(channel + (right[index] - channel) * value)).join(',')})`; }

function addHeatmapScene(scene, spec, data, state, colors) {
  const xField = spec.encoding.x?.field || 'x', yField = spec.encoding.y?.field || 'y', valueField = spec.encoding.color?.field || 'value';
  const xValues = [...new Set(data.rows.map(row => String(row[xField])))], yValues = [...new Set(data.rows.map(row => String(row[yField])))];
  const numericValue = row => row[valueField] == null || row[valueField] === '' ? null : Number(row[valueField]);
  const values = data.rows.map(numericValue).filter(Number.isFinite), min = spec.colorScale?.domain?.[0] ?? Math.min(...values, 0), max = spec.colorScale?.domain?.[1] ?? Math.max(...values, 1);
  const palette = spec.theme.palette === 'diverging' ? spec.theme.palettes.diverging : spec.theme.palettes.sequential;
  const low = spec.colorScale?.range?.[0] || palette[0], high = spec.colorScale?.range?.at(-1) || palette.at(-1) || colors[0], missing = spec.colorScale?.missing || spec.theme.palettes.missing;
  const gap = Math.max(0, Number(spec.cellPadding ?? 2)), width = state.plot.width / Math.max(1, xValues.length), height = state.plot.height / Math.max(1, yValues.length);
  xValues.forEach((value, index) => { if (index % state.xLabels.step !== 0 && index !== xValues.length - 1) return; addText(scene, `heatmap-x-${index}`, value, state.plot.x + (index + .5) * width, state.plot.y + state.plot.height + (state.xLabels.rotation ? 10 : 20), { fill: spec.theme.muted, font: font(spec, 'axis'), textAnchor: state.xLabels.rotation ? 'end' : 'middle', textBaseline: state.xLabels.rotation ? 'middle' : 'alphabetic', rotation: state.xLabels.rotation }); });
  const yStep = Math.max(1, Math.ceil(fontSize(spec, 'axis', 12) * 1.35 / Math.max(1, height)));
  yValues.forEach((value, index) => { if (index % yStep !== 0 && index !== yValues.length - 1) return; addText(scene, `heatmap-y-${index}`, value, state.plot.x - 10, state.plot.y + (index + .5) * height, { fill: spec.theme.muted, font: font(spec, 'axis'), textAnchor: 'end', textBaseline: 'middle', baseline: 'middle' }); });
  let hiddenLabels = 0, visibleLabels = 0;
  data.rows.forEach((row, index) => { const xIndex = xValues.indexOf(String(row[xField])), yIndex = yValues.indexOf(String(row[yField])), value = numericValue(row), ratio = Number.isFinite(value) ? (value - min) / (max - min || 1) : 0, cellFill = Number.isFinite(value) ? colorMix(low, high, ratio) : missing, geometry = { x: state.plot.x + xIndex * width + gap / 2, y: state.plot.y + yIndex * height + gap / 2, width: Math.max(1, width - gap), height: Math.max(1, height - gap) }; scene.add(new SceneNode({ id: `heatmap-cell-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill: cellFill, stroke: spec.theme.background, strokeWidth: 1 }, dataRef: { dataIndex: index, x: row[xField], y: row[yField], value: Number.isFinite(value) ? value : null, recordId: row.id || `record-${index}` }, interactive: true })); if (spec.labels?.enabled && Number.isFinite(value)) { const label = formatValue(value, spec.labels.format, spec.locale), size = fontSize(spec, 'label', 12); if (geometry.width >= estimateTextWidth(label, size) + 8 && geometry.height >= size * 1.35) { addText(scene, `heatmap-cell-label-${index}`, label, geometry.x + geometry.width / 2, geometry.y + geometry.height / 2, { fill: readableLabelColor(spec, cellFill), font: spec.labels.font || font(spec, 'label'), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' }); visibleLabels += 1; } else hiddenLabels += 1; } });
  state.labelLayout = { ...(state.labelLayout || {}), heatmap: { hidden: hiddenLabels, visible: visibleLabels } };
  if (hiddenLabels) data.warnings.push({ code: 'LABELS_SUPPRESSED', path: 'labels', count: hiddenLabels, message: `${hiddenLabels} heatmap labels were suppressed because cells are too small.`, suggestion: 'Increase chart width or height, reduce the matrix, or disable labels.' });
  state.matrix = { xValues, yValues, min, max };
}

function addRadarScene(scene, spec, data, state, colors) {
  const indicators = spec.indicators, cx = state.plot.x + state.plot.width / 2, cy = state.plot.y + state.plot.height / 2, radius = Math.min(state.plot.width, state.plot.height) * .44;
  if (indicators.some(indicator => !Number.isFinite(Number(indicator.min)) || !Number.isFinite(Number(indicator.max)))) data.warnings.push({ code: 'AMBIGUOUS_RADAR_DOMAIN', message: 'Declare finite min and max for every radar indicator, especially for mixed units.' });
  const point = (indicator, index, ratio = 1) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / indicators.length; return { x: cx + Math.cos(angle) * radius * ratio, y: cy + Math.sin(angle) * radius * ratio }; };
  [0.25, 0.5, 0.75, 1].forEach((ratio, level) => scene.add(new SceneNode({ id: `radar-grid-${level}`, type: 'path', geometry: { points: indicators.map((indicator, index) => point(indicator, index, ratio)), closed: true }, style: { fill: 'none', stroke: spec.theme.grid, strokeWidth: spec.theme.marks.gridWidth } })));
  const labelSize = fontSize(spec, 'axis', 12), occupied = [], labelTop = Math.max(4, state.plot.y - labelSize * 2), labelArea = { x: 4, y: labelTop, width: spec.width - 8, height: Math.max(1, state.plot.y + state.plot.height - labelTop) };
  let hiddenLabels = 0;
  indicators.forEach((indicator, index) => {
    const edge = point(indicator, index), angle = -Math.PI / 2 + index * Math.PI * 2 / indicators.length;
    scene.add(new SceneNode({ id: `radar-axis-${index}`, type: 'line', geometry: { x1: cx, y1: cy, x2: edge.x, y2: edge.y }, style: { stroke: spec.theme.axis } }));
    const rawText = String(indicator.name || indicator.field), maxChars = Math.max(5, Math.floor(Math.max(48, state.plot.width * 0.28) / (labelSize * 0.58))), labelText = rawText.length > maxChars ? `${rawText.slice(0, Math.max(1, maxChars - 1))}…` : rawText;
    const width = estimateTextWidth(labelText, labelSize), height = labelSize * 1.3, anchor = Math.cos(angle) > .2 ? 'start' : Math.cos(angle) < -.2 ? 'end' : 'middle';
    const candidates = [];
    [1.14, 1.26, 1.38, 1.5].forEach(ratio => {
      const base = point(indicator, index, ratio);
      [0, -height, height, -2 * height, 2 * height].forEach(offset => candidates.push({ x: base.x, y: base.y + offset }));
    });
    const placement = candidates.map(candidate => {
      let x = candidate.x, y = candidate.y;
      let box = { x: anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2, y: y - height / 2, width, height };
      const dx = box.x < labelArea.x ? labelArea.x - box.x : box.x + box.width > labelArea.x + labelArea.width ? labelArea.x + labelArea.width - box.x - box.width : 0;
      const dy = box.y < labelArea.y ? labelArea.y - box.y : box.y + box.height > labelArea.y + labelArea.height ? labelArea.y + labelArea.height - box.y - box.height : 0;
      x += dx; y += dy; box = { ...box, x: box.x + dx, y: box.y + dy };
      return { x, y, box };
    }).find(candidate => !occupied.some(box => boxesOverlap(candidate.box, box, 3)));
    if (!placement) { hiddenLabels += 1; return; }
    occupied.push(placement.box);
    addText(scene, `radar-label-${index}`, labelText, placement.x, placement.y, { fill: spec.theme.muted, font: font(spec, 'axis'), textAnchor: anchor, textBaseline: 'middle', baseline: 'middle' });
  });
  data.rows.forEach((row, seriesIndex) => { const points = indicators.map((indicator, index) => { const min = Number(indicator.min ?? 0), max = Number(indicator.max ?? 1), raw = row[indicator.field], value = raw == null || raw === '' ? NaN : Number(raw); if (!Number.isFinite(value)) data.warnings.push({ code: 'INVALID_RADAR_VALUE', path: `rows.${seriesIndex}.${indicator.field}`, message: 'Radar indicator value must be numeric.' }); return point(indicator, index, Number.isFinite(value) ? Math.max(0, Math.min(1, (value - min) / (max - min || 1))) : 0); }); scene.add(new SceneNode({ id: `radar-series-${seriesIndex}`, type: 'path', geometry: { points, closed: true }, style: { fill: `${colors[seriesIndex % colors.length]}33`, stroke: colors[seriesIndex % colors.length], strokeWidth: 2 }, dataRef: { dataIndex: seriesIndex, recordId: row.id || `record-${seriesIndex}` } })); points.forEach((position, indicatorIndex) => { const dataRef = { dataIndex: seriesIndex, indicatorIndex, field: indicators[indicatorIndex].field, recordId: row.id || `record-${seriesIndex}` }; scene.add(new SceneNode({ id: `radar-item-${seriesIndex}-${indicatorIndex}`, type: 'circle', geometry: { cx: position.x, cy: position.y, r: 4 }, bounds: { x: position.x - 7, y: position.y - 7, width: 14, height: 14 }, style: { fill: colors[seriesIndex % colors.length] }, dataRef, interactive: true })); addMarkLabel(scene, spec, `radar-item-${seriesIndex}-${indicatorIndex}`, row[indicators[indicatorIndex].field], position.x, position.y - 7, dataRef, state.plot, { x: position.x, y: position.y, radius: 4 }); }); });
  state.indicators = indicators.map(indicator => ({ ...indicator }));
  state.labelLayout = { ...(state.labelLayout || {}), radar: { hidden: hiddenLabels, visible: indicators.length - hiddenLabels } };
  if (hiddenLabels) data.warnings.push({ code: 'LABELS_SUPPRESSED', path: 'indicators', message: `${hiddenLabels} radar labels were suppressed because the available chart area cannot place them without overlap.`, suggestion: 'Increase chart width or height, shorten indicator names, or reduce the indicator count.' });
}

function timeTicks(min, max, count) { return Array.from({ length: count }, (_, index) => min + (max - min) * index / Math.max(1, count - 1)); }
function formatTime(value, span, format, locale = 'en-US') { const date = new Date(value); if (format) { const options = typeof format === 'string' ? { style: format } : format; return formatValue(value, options?.style || options?.options ? { style: options.style || 'date', ...options } : { style: 'date', options }, locale); } const days = span / 86400000, nowYear = date.getUTCFullYear(), startYear = new Date(value - span).getUTCFullYear(); if (days > 365 || (nowYear !== startYear && days > 45)) return String(nowYear); if (days > 60) return `${nowYear}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`; return `${date.getUTCMonth() + 1}/${date.getUTCDate()}${nowYear !== startYear ? `/${nowYear}` : ''}`; }

function projectRows(spec, data) { return data.rows.length ? data.rows : (spec.tasks || spec.events || []); }
function projectDate(value, min, max, plot) { const time = new Date(value).getTime(); return plot.x + ((time - min) / (max - min || 1)) * plot.width; }
function addProjectAxes(scene, plot, min, max, spec = {}) { scene.add(new SceneNode({ id: 'project-axis', type: 'line', geometry: { x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height }, style: { stroke: '#94a3b8' } })); timeTicks(min, max, 5).forEach(value => addText(scene, `project-label-${value}`, formatTime(value, max - min, spec.xAxis?.format, spec.locale), projectDate(value, min, max, plot), plot.y + plot.height + 22, { fill: '#475569', font: '12px system-ui', textAnchor: 'middle' })); }
function addProjectScene(scene, spec, data, state, colors) {
  const { plot } = state;
  if (['gantt', 'timeline', 'milestone'].includes(spec.type)) {
    const rows = projectRows(spec, data), dates = rows.flatMap(row => [new Date(row.start || row.date || row.end).getTime(), new Date(row.end || row.date || row.start).getTime()]).filter(Number.isFinite), min = Math.min(...(dates.length ? dates : [Date.now()])), max = Math.max(...(dates.length ? dates : [min + 86400000]));
    addProjectAxes(scene, plot, min, max, spec);
    const positions = new Map(); rows.forEach((row, index) => { const y = plot.y + (index + 0.5) * plot.height / Math.max(1, rows.length), start = projectDate(row.start || row.date || row.end, min, max, plot), end = projectDate(row.end || row.date || row.start, min, max, plot), x = Math.min(start, end), width = Math.max(8, Math.abs(end - start)); positions.set(row.id, { x, y, end, row }); const milestone = spec.type === 'milestone' || row.milestone || start === end; const geometry = milestone ? { cx: start, cy: y, r: 7 } : { x, y: y - 10, width, height: 20 }; scene.add(new SceneNode({ id: `project-item-${index}`, type: milestone ? 'circle' : 'rect', geometry, bounds: milestone ? { x: start - 10, y: y - 10, width: 20, height: 20 } : geometry, style: { fill: colors[index % colors.length], stroke: '#ffffff', strokeWidth: 1 }, dataRef: { dataIndex: index, taskId: row.id, field: 'project' }, interactive: true })); addText(scene, `project-label-${index}`, row.name || row.title || row.label || row.id || `Item ${index + 1}`, plot.x - 8, y + 4, { fill: '#334155', font: '12px system-ui', textAnchor: 'end' }); if (row.progress != null && !milestone) scene.add(new SceneNode({ id: `project-progress-${index}`, type: 'rect', geometry: { x, y: y - 10, width: width * Math.max(0, Math.min(1, Number(row.progress) > 1 ? Number(row.progress) / 100 : Number(row.progress))), height: 20 }, style: { fill: '#0f172a', opacity: 0.25 }, interactive: false })); });
    const criticalPath = new Set(spec.criticalPath || []);
    rows.forEach((row, index) => (row.dependencies || []).forEach((dependency, dependencyIndex) => { const from = positions.get(dependency), to = positions.get(row.id); if (!from || !to) return; const critical = criticalPath.has(row.id) && criticalPath.has(dependency); const angle = Math.atan2(to.y - from.y, to.x - from.end), arrow = 7; scene.add(new SceneNode({ id: `dependency-${index}-${dependencyIndex}`, type: 'line', geometry: { x1: from.end, y1: from.y, x2: to.x, y2: to.y }, style: { stroke: critical ? '#dc2626' : '#64748b', strokeWidth: critical ? 2.5 : 1.5, opacity: 0.85 }, dataRef: { from: dependency, to: row.id, critical }, interactive: false, zIndex: -1 })); scene.add(new SceneNode({ id: `dependency-arrow-${index}-${dependencyIndex}`, type: 'path', geometry: { points: [{ x: to.x, y: to.y }, { x: to.x - arrow * Math.cos(angle - Math.PI / 6), y: to.y - arrow * Math.sin(angle - Math.PI / 6) }, { x: to.x - arrow * Math.cos(angle + Math.PI / 6), y: to.y - arrow * Math.sin(angle + Math.PI / 6) }] }, style: { stroke: critical ? '#dc2626' : '#64748b', fill: critical ? '#dc2626' : '#64748b', strokeWidth: 1 }, interactive: false, zIndex: -1 })); }));
    return;
  }
  if (spec.type === 'burndown') {
    const rows = projectRows(spec, data), dates = rows.map(row => new Date(row.date).getTime()).filter(Number.isFinite), min = Math.min(...(dates.length ? dates : [Date.now()])), max = Math.max(...(dates.length ? dates : [min + 86400000])), values = rows.map(row => Number(row.remaining ?? row.actual ?? row.value)).filter(Number.isFinite), maxValue = Math.max(1, ...values, ...rows.map(row => Number(row.ideal)).filter(Number.isFinite)); addProjectAxes(scene, plot, min, max); const point = row => ({ x: projectDate(row.date, min, max, plot), y: plot.y + plot.height - (Number(row.remaining ?? row.actual ?? row.value) / maxValue) * plot.height }); const actual = rows.map(point).filter(point => Number.isFinite(point.y)); if (actual.length > 1) scene.add(new SceneNode({ id: 'burndown-actual', type: 'path', geometry: { points: actual, closed: false }, style: { stroke: colors[0], strokeWidth: 2 } })); const ideal = rows.map((row, index) => ({ x: projectDate(row.date, min, max, plot), y: plot.y + plot.height - (Number(row.ideal ?? maxValue * (1 - index / Math.max(1, rows.length - 1))) / maxValue) * plot.height })); if (ideal.length > 1) scene.add(new SceneNode({ id: 'burndown-ideal', type: 'path', geometry: { points: ideal, closed: false }, style: { stroke: '#94a3b8', strokeWidth: 1, opacity: 0.8 } })); rows.forEach((row, index) => { if (index && Number(row.scopeChange)) { const x = projectDate(row.date, min, max, plot); scene.add(new SceneNode({ id: `burndown-scope-${index}`, type: 'line', geometry: { x1: x, y1: plot.y, x2: x, y2: plot.y + plot.height }, style: { stroke: '#f59e0b', strokeWidth: 1.5, opacity: 0.8 }, dataRef: { dataIndex: index, field: 'scopeChange', datum: row } })); } }); actual.forEach((point, index) => scene.add(new SceneNode({ id: `burndown-item-${index}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 4 }, bounds: { x: point.x - 7, y: point.y - 7, width: 14, height: 14 }, style: { fill: colors[0] }, dataRef: { dataIndex: index, field: 'remaining', datum: rows[index] }, interactive: true }))); const last = actual.at(-1), lastRow = rows.at(-1); if (last && lastRow && Number(lastRow.remaining ?? lastRow.actual ?? lastRow.value) > 0 && rows.length > 1) { const slope = (Number(lastRow.remaining ?? lastRow.actual ?? lastRow.value) - Number(rows[0].remaining ?? rows[0].actual ?? rows[0].value)) / Math.max(1, dates.length - 1), projected = slope < 0 ? new Date(new Date(lastRow.date).getTime() + Math.ceil(Number(lastRow.remaining ?? lastRow.actual ?? lastRow.value) / -slope) * 86400000) : null; if (projected) addText(scene, 'burndown-projected', `Projected ${formatTime(projected, max - min)}`, Math.min(plot.x + plot.width, last.x + 12), plot.y + 18, { fill: '#dc2626', font: '12px system-ui' }); } return;
  }
  if (['flow', 'swimlane'].includes(spec.type)) {
    const nodes = spec.nodes || spec.data.nodes || [], edges = spec.edges || spec.data.edges || [], lanes = spec.lanes || spec.data.lanes || [], laneHeight = plot.height / Math.max(1, lanes.length || 1); const nodeMap = new Map(); nodes.forEach((node, index) => { const laneIndex = lanes.length ? Math.max(0, lanes.findIndex(lane => lane.id === node.laneId)) : 0, columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length))), column = index % columns, row = Math.floor(index / columns), x = plot.x + (column + 0.5) * plot.width / columns, y = lanes.length ? plot.y + laneIndex * laneHeight + laneHeight / 2 : plot.y + (row + 0.5) * plot.height / Math.max(1, Math.ceil(nodes.length / columns)); nodeMap.set(node.id, { ...node, x, y }); if (lanes.length) { scene.add(new SceneNode({ id: `lane-${laneIndex}`, type: 'rect', geometry: { x: plot.x, y: plot.y + laneIndex * laneHeight, width: plot.width, height: laneHeight }, style: { fill: laneIndex % 2 ? '#f8fafc' : '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 }, interactive: false })); addText(scene, `lane-label-${laneIndex}`, lanes[laneIndex].label || lanes[laneIndex].id, plot.x - 8, plot.y + laneIndex * laneHeight + 18, { fill: '#475569', font: '12px system-ui', textAnchor: 'end' }); } }); edges.forEach((edge, index) => { const from = nodeMap.get(edge.from), to = nodeMap.get(edge.to); if (!from || !to) return; scene.add(new SceneNode({ id: `edge-${index}`, type: 'line', geometry: { x1: from.x, y1: from.y, x2: to.x, y2: to.y }, style: { stroke: '#64748b', strokeWidth: 1.5 }, dataRef: { edgeIndex: index, from: edge.from, to: edge.to } })); }); nodeMap.forEach((node, id) => { const geometry = { x: node.x - 48, y: node.y - 18, width: 96, height: 36 }; scene.add(new SceneNode({ id: `node-${id}`, type: 'rect', geometry, bounds: geometry, style: { fill: colors[0], stroke: '#ffffff', strokeWidth: 1 }, dataRef: { nodeId: id, field: 'node' }, interactive: true })); addText(scene, `node-label-${id}`, node.label || id, node.x, node.y + 4, { fill: '#ffffff', font: '12px system-ui', textAnchor: 'middle' }); });
  }
}

function addBranding(scene, spec) {
  if (spec.branding?.enabled !== true) return;
  const x = Math.max(12, Number(spec.width) - 4);
  const y = Math.max(12, Number(spec.height) - 4);
  const fontFamily = spec.theme?.typography?.axis?.font ? `500 9px ${String(spec.theme.typography.axis.font).split(/px\s*/).slice(1).join('px ').trim() || 'system-ui'}` : '500 9px system-ui, sans-serif';
  scene.add(new SceneNode({
    id: 'branding-watermark',
    type: 'text',
    geometry: { text: 'Powered by iChart.js', x, y },
    style: {
      fill: spec.theme?.muted || '#536274',
      opacity: 0.35,
      font: fontFamily,
      textAnchor: 'end',
      textAlign: 'end',
      textBaseline: 'bottom',
      baseline: 'bottom',
      pointerEvents: 'none',
      ariaHidden: 'true',
      role: 'presentation'
    },
    interactive: false,
    zIndex: 9999,
    decorative: true
  }));
}

export function buildScene(spec) {
  const baseSpec = styledSpec(spec);
  const brandingEnabled = baseSpec.branding?.enabled === true;
  const effectivePadding = {
    top: Number(baseSpec.padding?.top ?? 48),
    right: Number(baseSpec.padding?.right ?? 24) + (brandingEnabled ? 2 : 0),
    bottom: Number(baseSpec.padding?.bottom ?? 48) + (brandingEnabled ? 18 : 0),
    left: Number(baseSpec.padding?.left ?? 56),
  };
  const themePadding = baseSpec.theme.layout.padding || {};
  const customPadding = ['top', 'right', 'bottom', 'left'].some(key => Number(baseSpec.padding?.[key]) !== Number(themePadding[key]));
  const axisFreeBottomPadding = customPadding ? effectivePadding.bottom : Math.max(28, Math.min(34, Number(themePadding.bottom ?? effectivePadding.bottom)));
  spec = { ...baseSpec, padding: effectivePadding };
  const isProjectFamily = ['gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane', 'architecture', 'mindmap'].includes(spec.type);
  if (isProjectFamily) {
    const result = buildProjectScene(spec);
    addBranding(result.scene, spec);
    return result;
  }
  const data = spec.transform ? applyTransforms(spec.data, spec.transform) : normalizeData(spec.data);
  if (spec.view && (spec.view.start !== undefined || spec.view.end !== undefined)) {
    const start = Math.max(0, Number(spec.view.start) || 0), end = Math.min(data.rows.length, spec.view.end === undefined ? data.rows.length : Number(spec.view.end));
    data.rows = data.rows.slice(start, Math.max(start, end));
    data.viewOffset = start;
  }
  const scene = new Scene(spec.width, spec.height);
  const colors = spec.colors;
  const series = Array.isArray(spec.encoding.y) ? spec.encoding.y : [{ ...spec.encoding.y, name: spec.encoding.y?.name || spec.encoding.y?.field }];
  const entries = legendEntries(spec, data, series, colors);
  const state = layout(spec, data, entries, { axisFreeBottomPadding });
  if (state.chrome.legend.truncatedCount) data.warnings.push({ code: 'LEGEND_OVERFLOW', path: 'legend', count: state.chrome.legend.truncatedCount, message: `${state.chrome.legend.truncatedCount} legend label${state.chrome.legend.truncatedCount === 1 ? '' : 's'} exceeded the available width and was truncated.`, suggestion: 'Use shorter category names or a wider chart.' });
  state.axisTitleWarnings.forEach(({ path, title, availableWidth }) => data.warnings.push({ code: 'TITLE_TRUNCATED', path, availableWidth, message: `Axis title "${title}" exceeded the available vertical plot space and was truncated.`, suggestion: 'Use a taller chart or a shorter axis title.' }));
  scene._labelArea = state.plot;
  addTitles(scene, spec, state.chrome.title);
  if (!['pie', 'funnel', 'gauge', 'heatmap', 'radar'].includes(spec.type)) addAxes(scene, spec, state);
  const hasDiagramNodes = ['flow', 'swimlane', 'architecture', 'mindmap'].includes(spec.type) && (spec.nodes || spec.data.nodes)?.length;
  if (!data.rows.length && !hasDiagramNodes) { addText(scene, 'empty', spec.emptyText || 'No data', spec.width / 2, spec.height / 2, { fill: spec.theme.muted, font: font(spec, 'subtitle'), textAnchor: 'middle' }); addBranding(scene, spec); return { scene, data, state }; }
  const yField = state.yField;
  if (spec.type === 'heatmap') addHeatmapScene(scene, spec, data, state, colors);
  else if (spec.type === 'radar') addRadarScene(scene, spec, data, state, colors);
  else if (spec.type === 'line' || spec.type === 'area') {
    const mode = typeof spec.stack === 'string' ? spec.stack : spec.stack?.mode, accumulators = data.rows.map(() => ({ positive: 0, negative: 0 }));
    series.forEach((encoding, seriesIndex) => { const yMap = seriesIndex === 1 && !mode ? state.yRight : state.y, values = data.rows.map(row => Number(row[encoding.field])), totals = data.rows.map((row, index) => series.reduce((sum, item) => sum + Math.abs(Number(row[item.field]) || 0), 0) || Math.abs(values[index]) || 1); const points = [], bases = []; data.rows.forEach((row, index) => { let value = values[index]; if (!Number.isFinite(value)) return; if (mode === 'percent') value /= totals[index]; const accumulator = value >= 0 ? 'positive' : 'negative', start = mode ? accumulators[index][accumulator] : 0, end = mode ? start + value : value; if (mode) accumulators[index][accumulator] = end; points.push({ x: state.x(pick(row, spec.encoding.x, 'name')), y: yMap(end), labelY: mode ? (yMap(start) + yMap(end)) / 2 : yMap(end) - 8, row, index, value }); bases.push({ x: state.x(pick(row, spec.encoding.x, 'name')), y: yMap(start) }); }); if (spec.type === 'area' && points.length) scene.add(new SceneNode({ id: `area-fill-${seriesIndex}`, type: 'path', geometry: { points: [...bases.slice().reverse(), ...points.map(point => ({ x: point.x, y: point.y }))], closed: true }, style: { fill: `${colors[seriesIndex]}33`, stroke: 'transparent' } })); if (points.length > 1) scene.add(new SceneNode({ id: `series-${seriesIndex}-line`, type: 'path', geometry: { points, closed: false }, style: { stroke: colors[seriesIndex], strokeWidth: 2, fill: 'none' } })); points.forEach(point => { const dataRef = { seriesIndex, dataIndex: point.index, field: encoding.field }; scene.add(new SceneNode({ id: `series-${seriesIndex}-item-${point.index}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 5 }, bounds: { x: point.x - 8, y: point.y - 8, width: 16, height: 16 }, style: { fill: colors[seriesIndex] }, dataRef, interactive: true })); addMarkLabel(scene, spec, `series-${seriesIndex}-item-${point.index}`, point.value, point.x, point.labelY, dataRef, state.plot, mode ? null : { x: point.x, y: point.y, radius: 5 }); }); });
  } else if (spec.type === 'bar' || spec.type === 'column') {
    const band = state.plot.width / Math.max(1, state.categories.length), bar = band * 0.58;
    const mode = typeof spec.stack === 'string' ? spec.stack : spec.stack?.mode, accumulators = data.rows.map(() => ({ positive: 0, negative: 0 }));
    series.forEach((encoding, seriesIndex) => { if (encoding.mark === 'line') { const yMap = encoding.axis === 'right' ? state.yRight : state.y, points = data.rows.map((row, index) => ({ x: state.x(row[state.xField]), y: yMap(row[encoding.field]), index, value: Number(row[encoding.field]) })).filter(point => Number.isFinite(point.y)); if (points.length > 1) scene.add(new SceneNode({ id: `series-${seriesIndex}-line`, type: 'path', geometry: { points, closed: false }, style: { fill: 'none', stroke: colors[seriesIndex], strokeWidth: 2 } })); points.forEach(point => { const dataRef = { seriesIndex, dataIndex: point.index, field: encoding.field }; scene.add(new SceneNode({ id: `series-${seriesIndex}-item-${point.index}`, type: 'circle', geometry: { cx: point.x, cy: point.y, r: 4 }, bounds: { x: point.x - 7, y: point.y - 7, width: 14, height: 14 }, style: { fill: colors[seriesIndex] }, dataRef, interactive: true })); addMarkLabel(scene, spec, `series-${seriesIndex}-item-${point.index}`, point.value, point.x, point.y - 7, dataRef, null, { x: point.x, y: point.y, radius: 4 }); }); return; } data.rows.forEach((row, index) => { let value = Number(row[encoding.field]) || 0; const barSeries = series.filter(item => item.mark !== 'line'), barSeriesIndex = barSeries.indexOf(encoding), total = barSeries.reduce((sum, item) => sum + Math.abs(Number(row[item.field]) || 0), 0) || 1; if (mode === 'percent') value /= total; const accumulator = value >= 0 ? 'positive' : 'negative', start = mode ? accumulators[index][accumulator] : 0, end = start + value; if (mode) accumulators[index][accumulator] = end; const yMap = encoding.axis === 'right' ? state.yRight : state.y, base = yMap(start), valueY = yMap(end); const vertical = spec.type === 'column'; const horizontalStart = state.plot.x + ((start - state.min) / (state.max - state.min || 1)) * state.plot.width, horizontalEnd = state.plot.x + ((end - state.min) / (state.max - state.min || 1)) * state.plot.width, rowBand = state.plot.height / Math.max(1, data.rows.length), totalHeight = rowBand * .62, itemHeight = mode ? totalHeight : totalHeight / Math.max(1, barSeries.length); const geometry = vertical ? { x: state.x(row[state.xField]) - bar / 2 + (mode ? 0 : seriesIndex * bar / Math.max(1, series.length)), y: Math.min(base, valueY), width: mode ? bar : bar / Math.max(1, series.length), height: Math.abs(base - valueY) } : { x: Math.min(horizontalStart, horizontalEnd), y: state.plot.y + index * rowBand + (rowBand - totalHeight) / 2 + (mode ? 0 : barSeriesIndex * itemHeight), width: Math.abs(horizontalEnd - horizontalStart), height: itemHeight }; const dataRef = { seriesIndex, dataIndex: index, field: encoding.field, stackStart: start, stackEnd: end }; scene.add(new SceneNode({ id: `series-${seriesIndex}-item-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill: colors[seriesIndex] }, dataRef, interactive: true })); addMarkLabel(scene, spec, `series-${seriesIndex}-item-${index}`, value, vertical ? geometry.x + geometry.width / 2 : geometry.x + geometry.width + 12, vertical ? geometry.y - 5 : geometry.y + geometry.height / 2 + 4, dataRef); }); });
  } else if (spec.type === 'scatter') {
    data.rows.forEach((row, index) => { const xValue = Number(row[state.xField]), yValue = Number(row[state.yField]); if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) return; const geometry = { cx: state.x(xValue), cy: state.y(yValue), r: 5 }, dataRef = { seriesIndex: 0, dataIndex: index, field: state.yField }; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'circle', geometry, bounds: { x: geometry.cx - 8, y: geometry.cy - 8, width: 16, height: 16 }, style: { fill: colors[0] }, dataRef, interactive: true })); addMarkLabel(scene, spec, `series-0-item-${index}`, yValue, geometry.cx, geometry.cy - 8, dataRef, state.plot, { x: geometry.cx, y: geometry.cy, radius: 5 }); });
  } else if (spec.type === 'pie') {
    const categoryField = spec.encoding.category?.field || 'name', valueField = spec.encoding.value?.field || 'value', values = data.rows.map(row => Number(row[valueField])), total = values.reduce((sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0), 0), negativeCount = values.filter(value => Number.isFinite(value) && value < 0).length, cx = state.plot.x + state.plot.width / 2, cy = state.plot.y + state.plot.height / 2, radius = Math.min(state.plot.width, state.plot.height) * 0.46, innerR = radius * Number(spec.innerRadius || 0); let angle = -Math.PI / 2;
    if (negativeCount) data.warnings.push({ code: 'NEGATIVE_VALUE_DROPPED', path: 'encoding.value', count: negativeCount, message: `Pie ignores ${negativeCount} negative value${negativeCount === 1 ? '' : 's'} when calculating shares.`, suggestion: 'Use non-negative part-to-whole values or choose a Cartesian chart for signed measures.' });
    if (!(total > 0)) { data.warnings.push({ code: 'ZERO_TOTAL', path: 'encoding.value', message: 'Pie requires a positive total.', suggestion: 'Provide at least one positive value or render an explicit empty state.' }); addText(scene, 'pie-zero-total', spec.emptyText || 'No positive values', cx, cy, { fill: spec.theme.muted, font: font(spec, 'subtitle'), textAnchor: 'middle' }); }
    else data.rows.forEach((row, index) => { const rawValue = values[index], value = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0, end = angle + value / total * Math.PI * 2, middle = angle + (end - angle) / 2, fill = colors[index % colors.length], dataRef = { seriesIndex: 0, dataIndex: index, category: row[categoryField], value, rawValue }; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'arc', geometry: { cx, cy, r: radius, innerR, start: angle, end }, bounds: { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }, style: { fill, stroke: spec.theme.background, strokeWidth: 1 }, dataRef, interactive: true })); addMarkLabel(scene, spec, `series-0-item-${index}`, value / total, cx + Math.cos(middle) * radius * .72, cy + Math.sin(middle) * radius * .72, dataRef, state.plot, null, spec.labels?.format || { style: 'percent' }, fill); angle = end; });
  } else if (spec.type === 'funnel') {
    const valueField = spec.encoding.value?.field || 'value'; const maxValue = Math.max(...data.rows.map(row => Number(row[valueField]) || 0), 1); const segmentHeight = state.plot.height / data.rows.length;
    data.rows.forEach((row, index) => { const value = Number(row[valueField]) || 0, ratio = Math.max(0.1, value / maxValue), fill = colors[index % colors.length]; const width = state.plot.width * ratio; const geometry = { x: state.plot.x + (state.plot.width - width) / 2, y: state.plot.y + index * segmentHeight, width, height: Math.max(2, segmentHeight - 3) }, dataRef = { seriesIndex: 0, dataIndex: index, field: valueField }; scene.add(new SceneNode({ id: `series-0-item-${index}`, type: 'rect', geometry, bounds: geometry, style: { fill }, dataRef, interactive: true })); addMarkLabel(scene, spec, `series-0-item-${index}`, value, geometry.x + geometry.width / 2, geometry.y + geometry.height / 2 + 4, dataRef, state.plot, null, null, fill); });
  } else if (spec.type === 'gauge') {
    const valueField = spec.encoding.value?.field || 'value', domain = Array.isArray(spec.domain) ? spec.domain : [0, 100], rawValue = Number(data.rows[0]?.[valueField]), numericValue = Number.isFinite(rawValue) ? rawValue : 0, value = Math.max(Number(domain[0]), Math.min(Number(domain[1]), numericValue)), ratio = (value - Number(domain[0])) / (Number(domain[1]) - Number(domain[0]) || 1), cx = state.plot.x + state.plot.width / 2, cy = state.plot.y + state.plot.height * 0.68, radius = Math.min(state.plot.width * 0.42, state.plot.height * 0.62), start = Math.PI, end = start + Math.PI * ratio;
    if (!Array.isArray(spec.domain)) data.warnings.push({ code: 'MISSING_GAUGE_DOMAIN', path: 'domain', message: 'Gauge rendered with a compatibility fallback; provide an explicit domain to make the value meaningful.' });
    if (numericValue < Number(domain[0]) || numericValue > Number(domain[1])) data.warnings.push({ code: 'VALUE_CLAMPED', path: `data.values[0].${valueField}`, count: 1, rawValue: numericValue, domain: [...domain], message: `Gauge value ${numericValue} is outside domain [${domain[0]}, ${domain[1]}] and was clamped for the arc.`, suggestion: 'Choose a domain that covers the value or review the source unit.' });
    scene.add(new SceneNode({ id: 'gauge-background', type: 'arc', geometry: { cx, cy, r: radius, start: Math.PI, end: Math.PI * 2 }, style: { fill: spec.theme.grid } })); scene.add(new SceneNode({ id: 'gauge-value', type: 'arc', geometry: { cx, cy, r: radius, start, end }, style: { fill: colors[0] }, dataRef: { seriesIndex: 0, dataIndex: 0, value, rawValue: numericValue }, interactive: true })); addText(scene, 'gauge-label', formatValue(numericValue, spec.labels?.format || spec.encoding.value?.format || { maximumFractionDigits: 2 }, spec.locale), cx, cy - 12, { fill: spec.theme.text, font: font(spec, 'metric'), textAnchor: 'middle' });
  }
  addLegend(scene, spec, state.chrome.legend);
  addBranding(scene, spec);
  return { scene, data, state };
}
