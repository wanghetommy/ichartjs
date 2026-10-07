/** JSON annotations anchored to numeric axes or stable records, shared by chart profiles. */
import { SceneNode } from './scene.mjs';
import { boxesOverlap, fitTextBlock, fontAtSize, fontSize, labelFont } from './layout.mjs';

const cartesianTypes = ['line', 'area', 'bar', 'column', 'scatter'];
export function validateAnnotations(spec, errors, warnings) {
  if (spec.annotations === undefined) return;
  const fail = (path, message) => errors.push({ code: 'INVALID_ANNOTATION', path, message });
  if (!Array.isArray(spec.annotations) || spec.annotations.length > 100) { fail('annotations', 'Use an array of at most 100 annotations.'); return; }
  if (spec.annotations.length && !cartesianTypes.includes(spec.type)) fail('annotations', 'Annotations currently support Cartesian charts only. Use Board text for other compositions.');
  const ids = new Set();
  spec.annotations.forEach((item, index) => {
    const path = `annotations.${index}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) { fail(path, 'Expected an annotation object.'); return; }
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) fail(`${path}.id`, 'Provide a unique, nonempty annotation ID.');
    ids.add(item.id);
    if (!['reference-line', 'callout'].includes(item.type)) fail(`${path}.type`, 'Use reference-line or callout.');
    const allowed = new Set(['id', 'type', 'text', 'color', ...(item.type === 'reference-line' ? ['axis', 'value'] : ['recordId', 'field', 'offset'])]);
    Object.keys(item).filter(key => !allowed.has(key)).forEach(key => warnings.push({ code: 'UNKNOWN_ANNOTATION_OPTION', path: `${path}.${key}`, message: `Annotation option ${key} is ignored.`, suggestion: `Use ${[...allowed].join(', ')}.` }));
    if (item.text !== undefined && typeof item.text !== 'string') fail(`${path}.text`, 'Text must be a plain string.');
    if (item.color !== undefined && (typeof item.color !== 'string' || !item.color.trim())) fail(`${path}.color`, 'Color must be a nonempty CSS color string.');
    if (item.type === 'reference-line') {
      if (!['x', 'y'].includes(item.axis) || !Number.isFinite(item.value)) fail(path, 'A reference line needs axis: x/y and a finite numeric value.');
      const numericX = spec.type === 'bar' || spec.type === 'scatter' || spec.encoding?.x?.type === 'quantitative';
      if (item.axis === 'x' && !numericX || item.axis === 'y' && spec.type === 'bar') fail(`${path}.axis`, 'Reference lines require a numeric axis; use x for horizontal bar charts.');
      if (spec[`${item.axis}Axis`]?.type === 'log' && item.value <= 0) fail(`${path}.value`, 'Log-axis reference values must be positive.');
    } else if (item.type === 'callout') {
      if (typeof item.recordId !== 'string' || !item.recordId) fail(`${path}.recordId`, 'Use a stable data.values[].id string.');
      if (typeof item.text !== 'string' || !item.text.trim()) fail(`${path}.text`, 'Callouts require nonempty plain text.');
      if (item.field !== undefined && (typeof item.field !== 'string' || !item.field)) fail(`${path}.field`, 'Use a measure field to select a series.');
      if (item.offset !== undefined && (!item.offset || !Number.isFinite(item.offset.x) || !Number.isFinite(item.offset.y))) fail(`${path}.offset`, 'Provide finite offset.x and offset.y in chart pixels.');
    }
  });
}

export function addAnnotations(model, spec) {
  if (!spec.annotations?.length) return;
  const { scene, data, state } = model, plot = state.plot, results = [], occupied = [...(scene._labelBoxes || [])], size = fontSize(spec, 'label', 12), font = labelFont(spec);
  const warn = (code, index, message, suggestion) => data.warnings.push({ code, path: `annotations.${index}`, message, suggestion });
  const add = (id, type, geometry, style) => scene.add(new SceneNode({ id, type, geometry, style, zIndex: 5 }));
  spec.annotations.forEach((item, index) => {
    const id = `annotation-${item.id}`, color = item.color || spec.theme.text;
    let anchor;
    if (item.type === 'reference-line') {
      const domain = state.domain || [state.min, state.max];
      const coordinate = item.axis === 'y' ? state.y(item.value) : spec.type === 'bar' ? plot.x + (item.value - domain[0]) / (domain[1] - domain[0] || 1) * plot.width : state.x(item.value);
      const low = item.axis === 'y' ? plot.y : plot.x, extent = item.axis === 'y' ? plot.height : plot.width;
      if (!Number.isFinite(coordinate) || coordinate < low || coordinate > low + extent) { warn('ANNOTATION_OUT_OF_VIEW', index, 'Reference line is outside the current axis domain.', 'Adjust the axis domain or annotation value; annotations do not expand domains.'); results.push({ id: item.id, visible: false }); return; }
      add(id, 'line', item.axis === 'y' ? { x1: plot.x, y1: coordinate, x2: plot.x + plot.width, y2: coordinate } : { x1: coordinate, y1: plot.y, x2: coordinate, y2: plot.y + plot.height }, { stroke: color, strokeWidth: 1.5, lineDash: [5, 4] });
      anchor = item.axis === 'y' ? { x: plot.x + plot.width - 4, y: coordinate - size } : { x: coordinate + size, y: plot.y + size };
      anchor.linePoint = item.axis === 'y' ? { x: plot.x + plot.width - 4, y: coordinate } : { x: coordinate, y: plot.y + 4 };
    } else {
      const dataIndex = data.rows.findIndex(row => typeof row.id === 'string' && row.id === item.recordId);
      let target;
      scene.walk(node => { if (!target && dataIndex >= 0 && node.interactive && node.dataRef?.dataIndex === dataIndex && node.type !== 'text' && (!item.field || node.dataRef.field === item.field)) target = node; });
      if (!target) { warn('ANNOTATION_TARGET_MISSING', index, `No visible mark matches record ${item.recordId}${item.field ? ` / ${item.field}` : ''}.`, 'Keep stable row IDs; review transforms, filtered views and measure fields.'); results.push({ id: item.id, visible: false }); return; }
      const geometry = target.geometry, bounds = target.bounds;
      const point = { x: geometry.cx ?? bounds.x + bounds.width / 2, y: geometry.cy ?? bounds.y + bounds.height / 2 };
      anchor = { x: point.x + (item.offset?.x ?? 20), y: point.y + (item.offset?.y ?? -28) };
      results.push({ id: item.id, visible: true, recordId: item.recordId, anchor: point });
      anchor.target = point;
    }
    if (item.text) {
      const block = fitTextBlock(item.text, { maxWidth: Math.max(1, Math.min(180, plot.width - 12)), maxHeight: Math.max(1, Math.min(72, plot.height - 12)), size, minSize: Math.min(size, 10), maxLines: 3, wordWrap: true, font });
      const width = Math.min(plot.width, block.width + 8), height = block.height + 6;
      const candidates = [0, -height - 8, height + 8, -2 * (height + 8), 2 * (height + 8)].map(shift => ({ x: Math.max(plot.x, Math.min(plot.x + plot.width - width, item.type === 'reference-line' ? anchor.x - width : anchor.x)), y: Math.max(plot.y, Math.min(plot.y + plot.height - height, anchor.y - height / 2 + shift)), width, height }));
      const targetBox = anchor.target ? { x: anchor.target.x - 6, y: anchor.target.y - 6, width: 12, height: 12 } : null;
      const placement = candidates.find(box => !occupied.some(other => boxesOverlap(box, other, 3)) && (!targetBox || !boxesOverlap(box, targetBox, 2)));
      if (!placement) warn('ANNOTATION_LABEL_OVERLAP', index, 'Annotation text cannot avoid existing labels in this plot.', 'Adjust offset, reduce annotation density or increase chart size.');
      const { x, y } = placement || candidates[0];
      occupied.push(placement || candidates[0]);
      const source = anchor.target || anchor.linePoint;
      add(`${id}-leader`, 'line', { x1: source.x, y1: source.y, x2: x + width / 2, y2: y + height / 2 }, { stroke: color, strokeWidth: 1 });
      add(`${id}-background`, 'rect', { x, y, width, height }, { fill: spec.theme.background, opacity: .94 });
      block.lines.forEach((line, lineIndex) => add(lineIndex ? `${id}-text-${lineIndex}` : `${id}-text`, 'text', { text: line, x: x + 4, y: y + 3 + block.lineHeight * (lineIndex + .5) }, { fill: color, font: fontAtSize(font, block.size), textBaseline: 'middle', baseline: 'middle' }));
      if (block.truncated || block.overflowed) warn('ANNOTATION_TEXT_TRUNCATED', index, 'Annotation text exceeds the available plot space.', 'Increase chart size or shorten the annotation.');
    }
    if (item.type === 'reference-line') results.push({ id: item.id, visible: true });
  });
  state.annotations = results;
}
