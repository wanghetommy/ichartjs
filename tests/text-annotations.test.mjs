import test from 'node:test';
import assert from 'node:assert/strict';
import { annotationPlugin, createBoard, createChart, getCapabilities, getChartContract, validateBoardSpec, validateSpec } from '../src/index.mjs';
import { createChart as createStandard } from '../src/standard.mjs';
import { boardTextLayout, boxesOverlap, fitTextBlock, fontPixels, truncateText } from '../src/layout.mjs';

const rows = [{ id: 'jan', name: 'Jan', value: 50 }, { id: 'feb', name: 'Feb', value: 60 }];
const base = { type: 'line', renderer: 'svg', width: 640, height: 360, legend: { visible: false }, data: rows };
const annotations = [{ id: 'target', type: 'reference-line', axis: 'y', value: 40, text: 'Target' }, { id: 'peak', type: 'callout', recordId: 'feb', text: 'Highest\nmonth' }];

test('text fitting preserves hard breaks, empty paragraphs, CRLF and whole graphemes', () => {
  const fit = fitTextBlock('First\r\n\nSecond', { maxWidth: 300, maxHeight: 100, size: 16, minSize: 8, maxLines: 3, wordWrap: true });
  assert.deepEqual(fit.lines, ['First', '', 'Second']);
  assert.equal(fit.truncated, false);
  const limited = fitTextBlock('First\nSecond', { maxWidth: 100, maxHeight: 20, size: 16, minSize: 16, maxLines: 1 });
  assert.equal(limited.truncated, true);
  assert.match(limited.lines[0], /…$/);
  const family = truncateText('👨‍👩‍👧‍👦 family', 28, 12);
  assert.ok(family === '…' || family.startsWith('👨‍👩‍👧‍👦'));
  assert.equal(truncateText('e\u0301xyz', 12, 12), '…');
});

test('Board text uses one fitting contract including wrap:false and style.font', () => {
  for (const item of [
    { text: 'First\nSecond', fontSize: 16, size: { width: 300, height: 100 }, wrap: false },
    { text: 'Hi', fontSize: 80, size: { width: 300, height: 16 }, wrap: false },
    { text: 'Hi', fontSize: 16, style: { font: '80px monospace' }, size: { width: 300, height: 16 } }
  ]) {
    const spec = { width: 400, height: 160, items: [{ id: 'note', kind: 'text', position: { x: 16, y: 16 }, ...item }] };
    const validation = validateBoardSpec(spec), board = createBoard(spec), layout = boardTextLayout(spec.items[0]);
    assert.equal(validation.valid, true);
    assert.equal(board.getState().layout.text[0].lines, layout.lines.length);
    assert.equal(fontPixels(board.scene.find('note-line-0').style.font), layout.size);
    assert.ok(layout.height <= item.size.height);
    board.destroy();
  }
  const tiny = { width: 400, height: 160, items: [{ id: 'note', kind: 'text', text: 'Hi', minFontSize: 80, fontSize: 80, wrap: false, size: { width: 300, height: 16 }, position: { x: 16, y: 16 } }] };
  assert.ok(validateBoardSpec(tiny).warnings.some(item => item.code === 'TEXT_OVERFLOW'));
  assert.equal(validateBoardSpec({ ...tiny, items: [{ ...tiny.items[0], style: { font: 'bad font' } }] }).valid, false);
});

for (const [entry, factory] of [['root', createChart], ['standard', createStandard]]) {
  test(`${entry}: custom label font drives collision checks and stays plate-free`, () => {
    const chart = factory({ ...base, width: 320, height: 240, data: [{ id: 'a', name: 'A', value: 1000 }, { id: 'b', name: 'B', value: 1001 }], labels: { enabled: true, font: '72px monospace' } });
    const nodes = [];
    chart.model.scene.walk(node => { if (node.type === 'text' && /^1,?00[01]$/.test(node.geometry.text)) nodes.push(node); });
    for (const node of nodes) assert.equal(node.style.font, '72px monospace');
    if (nodes.length === 2) {
      const box = node => ({ x: node.geometry.x - 172.8 / 2, y: node.geometry.y - 90 / 2, width: 172.8, height: 90 });
      assert.equal(boxesOverlap(box(nodes[0]), box(nodes[1])), false);
    } else assert.ok(chart.getState().warnings.some(item => item.code === 'LABELS_SUPPRESSED'));
    assert.doesNotMatch(chart.export({ type: 'svg' }), /label-background/);
    chart.destroy();
  });

  test(`${entry}: title hard breaks reserve chrome and oversized headings diagnose truncation`, () => {
    const chart = factory({ ...base, title: { text: 'First\nSecond', subtitle: 'Subtitle' } });
    assert.equal(chart.model.scene.find('title-line-1').geometry.text, 'Second');
    assert.ok(chart.model.scene.find('subtitle').geometry.y > chart.model.scene.find('title-line-1').geometry.y);
    chart.update({ width: 180, height: 120, title: { text: 'Very long title '.repeat(30) } });
    assert.ok(chart.getState().warnings.some(item => item.code === 'TITLE_TRUNCATED'));
    chart.destroy();
  });

  for (const type of ['bar', 'column']) test(`${entry}: ${type} inside/outside placement changes geometry`, () => {
    const inside = factory({ ...base, type, labels: { enabled: true, position: 'inside' } });
    const outside = factory({ ...base, type, labels: { enabled: true, position: 'outside' } });
    const mark = inside.model.scene.find('series-0-item-0'), label = inside.model.scene.find('series-0-item-0-label');
    assert.ok(label);
    assert.equal(label.geometry.y, mark.geometry.y + mark.geometry.height / 2);
    assert.notDeepEqual(label.geometry, outside.model.scene.find('series-0-item-0-label').geometry);
    inside.destroy(); outside.destroy();
  });

  test(`${entry}: annotations are semantic, updateable and survive JSON reconstruction`, () => {
    const chart = factory({ ...base, annotations });
    assert.ok(chart.model.scene.find('annotation-target'));
    assert.equal(chart.model.scene.find('annotation-target-leader').geometry.y1, chart.model.scene.find('annotation-target').geometry.y1);
    assert.deepEqual(chart.explain().layout.annotations, chart.getState().layout.annotations);
    assert.equal(chart.model.scene.find('annotation-peak-text-1').geometry.text, 'month');
    const original = chart.getState().layout.annotations.find(item => item.id === 'peak').anchor;
    chart.update({ data: [{ ...rows[1], value: 10 }, rows[0]] });
    const moved = chart.getState().layout.annotations.find(item => item.id === 'peak').anchor;
    assert.notDeepEqual(moved, original);
    const copy = factory(chart.export({ type: 'json', as: 'object' }).spec);
    assert.deepEqual(copy.getSpec().annotations, annotations);
    assert.deepEqual(copy.getState().layout.annotations, chart.getState().layout.annotations);
    chart.update({ annotations: [{ id: 'lost', type: 'callout', recordId: 'missing', text: 'Missing' }, { id: 'far', type: 'reference-line', axis: 'y', value: 999 }] });
    assert.deepEqual(chart.getState().warnings.map(item => item.code).sort(), ['ANNOTATION_OUT_OF_VIEW', 'ANNOTATION_TARGET_MISSING']);
    chart.update({ annotations: [] });
    assert.equal(chart.model.scene.find('annotation-target'), undefined);
    chart.update({ data: [], annotations: [annotations[1]] });
    assert.ok(chart.getState().warnings.some(item => item.code === 'ANNOTATION_TARGET_MISSING'));
    copy.destroy(); chart.destroy();
  });
}

test('annotation validation and discovery are explicit and chart-specific', () => {
  assert.equal(getChartContract('line').annotations.supported, true);
  assert.equal(getChartContract('pie').annotations.supported, false);
  assert.deepEqual(getCapabilities().annotations.types, ['reference-line', 'callout']);
  assert.equal(getCapabilities().canvasComposition.text.hardBreaks, true);
  for (const value of [null, [{ id: 'a', type: 'text' }], [{ id: 'a', type: 'reference-line', axis: 'x', value: 1 }], [{ id: 'a', type: 'callout', recordId: 'a', text: 12 }]]) assert.equal(validateSpec({ ...base, annotations: value }).valid, false);
  assert.equal(validateSpec({ ...base, annotations: [{ id: 'a', type: 'callout', recordId: 'a', text: 'A', offset: { x: 'bad', y: 1 } }] }).valid, false);
  assert.equal(validateSpec({ ...base, annotations: [annotations[0], annotations[0]] }).valid, false);
  assert.ok(validateSpec({ ...base, annotations: [{ ...annotations[0], invented: true }] }).warnings.some(item => item.code === 'UNKNOWN_ANNOTATION_OPTION'));
  assert.ok(validateSpec({ ...base, labels: { position: 'inside' } }).warnings.some(item => item.code === 'UNSUPPORTED_LABEL_POSITION'));
  for (const font of ['0px system-ui', '-12px system-ui', '100000px system-ui', '12pt system-ui']) assert.equal(validateSpec({ ...base, labels: { font } }).valid, false);
  assert.equal(validateSpec({ ...base, title: { text: 12 } }).valid, false);
  assert.equal(validateSpec({ ...base, yAxis: { type: 'log' }, annotations: [{ id: 'zero', type: 'reference-line', axis: 'y', value: 0 }] }).valid, false);
});

for (const [entry, factory] of [['root', createChart], ['standard', createStandard]]) {
  test(`${entry}: related chart families honor custom fonts without label plates`, () => {
    const specs = [
      { type: 'area', data: rows },
      { type: 'scatter', data: [{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 20, y: 40 }] },
      { type: 'pie', data: rows },
      { type: 'funnel', data: rows },
      { type: 'gauge', domain: [0, 100], data: [{ id: 'a', value: 20 }] },
      { type: 'heatmap', data: [{ id: 'a', x: 'A', y: 'B', value: 20 }] },
      { type: 'radar', indicators: ['quality', 'speed', 'cost'].map(field => ({ field, name: field, min: 0, max: 100 })), data: [{ id: 'a', quality: 50, speed: 60, cost: 70 }] }
    ];
    for (const spec of specs) {
      const chart = factory({ ...base, ...spec, width: 640, height: 400, labels: { enabled: true, font: '20px monospace' } });
      const numeric = [];
      chart.model.scene.walk(node => { if (node.type === 'text' && (/item-\d+-label$|point-\d+-label$|^scatter-\d+-label$|^funnel-value-|^gauge-label$|^heatmap.*label|^radar-\d+-\d+-label$|^radar-item-.*-label$/.test(node.id))) numeric.push(node); });
      assert.ok(numeric.length > 0, `${entry}/${spec.type} numeric labels missing`);
      for (const node of numeric) { assert.match(node.style.font, /monospace/); assert.ok(fontPixels(node.style.font) <= 20); }
      assert.doesNotMatch(chart.export({ type: 'svg' }), /label-background/);
      chart.destroy();
    }
  });
}

test('root: filtered targets warn; multi-series callouts select the requested measure', () => {
  const chart = createChart({ ...base, data: rows.map(row => ({ ...row, cost: 10 })), encoding: { x: { field: 'name' }, y: [{ field: 'value' }, { field: 'cost' }] }, annotations: [{ id: 'cost', type: 'callout', recordId: 'jan', field: 'cost', text: 'Cost' }] });
  assert.equal(chart.getState().layout.annotations[0].anchor.y, chart.model.scene.find('series-1-item-0').geometry.cy);
  chart.update({ view: { start: 1, end: 2 } });
  assert.ok(chart.getState().warnings.some(item => item.code === 'ANNOTATION_TARGET_MISSING'));
  chart.destroy();
});

test('annotation plugin remains ephemeral and diagnoses unsupported annotations', () => {
  const chart = createChart(base);
  chart.use(annotationPlugin([{ type: 'line', geometry: { x1: 10, y1: 10, x2: 30, y2: 10 } }, { type: 'text' }]));
  assert.ok(chart.model.scene.find('annotation-line-0'));
  assert.ok(chart.getState().warnings.some(item => item.code === 'INVALID_PLUGIN_ANNOTATION'));
  assert.equal(chart.getSpec().annotations, undefined);
  chart.destroy();
});

test('annotation boxes avoid existing numeric labels and diagnose dense collisions', () => {
  const chart = createChart({ ...base, labels: { enabled: true }, annotations });
  for (const id of ['target', 'peak']) {
    const box = chart.model.scene.find(`annotation-${id}-background`).geometry;
    assert.ok(chart.model.scene._labelBoxes.every(label => !boxesOverlap(box, label, 3)));
  }
  chart.update({ width: 200, height: 120, annotations: Array.from({ length: 8 }, (_, index) => ({ id: `note-${index}`, type: 'callout', recordId: 'feb', text: 'Dense annotation' })) });
  assert.ok(chart.getState().warnings.some(item => item.code === 'ANNOTATION_LABEL_OVERLAP'));
  chart.destroy();
});
