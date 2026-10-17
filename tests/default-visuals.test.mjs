import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createChart, createBoard, contrastRatio } from '../src/index.mjs';
import { createChart as createDiagram } from '../src/diagram-profile.mjs';
import { createChart as createStandard } from '../src/standard.mjs';
import { compositeColor } from '../src/theme.mjs';
import { diagramNodeSize, estimateTextWidth, fontPixels } from '../src/layout.mjs';
import { pathCommands, pathIntersectsBox, samplePath } from '../src/path.mjs';
import { cubicBezierPoint } from '../src/scene.mjs';
import { createSoftFlow } from '../playground/diagram-visuals.mjs';
import { galleryCases } from '../playground/gallery-cases.mjs';

function renderedSamples(geometry) {
  const samples = [];
  let current;
  for (const [kind, ...values] of pathCommands(geometry)) {
    const end = { x: values.at(-2), y: values.at(-1) };
    if (kind === 'L' || kind === 'C') for (let step = 0; step <= 40; step += 1) {
      const ratio = step / 40;
      samples.push(kind === 'C' ? cubicBezierPoint([current, { x: values[0], y: values[1] }, { x: values[2], y: values[3] }, end], ratio) : { x: current.x + (end.x - current.x) * ratio, y: current.y + (end.y - current.y) * ratio });
    }
    current = end;
  }
  return samples;
}

const inside = (point, box) => point.x > box.x + 0.001 && point.x < box.x + box.width - 0.001 && point.y > box.y + 0.001 && point.y < box.y + box.height - 0.001;

test('render-only gaps preserve exact cubic commands, logical routes and hit geometry', () => {
  for (const curve of [null, 'cubic']) {
    const geometry = curve ? { points: [{ x: 0, y: 30 }, { x: 60, y: 0 }, { x: 120, y: 80 }, { x: 180, y: 30 }], curve } : { points: [{ x: 0, y: 30 }, { x: 180, y: 30 }] };
    const box = { x: 70, y: -20, width: 40, height: 120 }, original = structuredClone(geometry), logical = samplePath(geometry);
    geometry.exclusions = [box];
    assert.equal(pathIntersectsBox(geometry, box), true);
    assert.ok(pathCommands(geometry).filter(command => command[0] === 'M').length >= 2);
    if (curve) assert.ok(pathCommands(geometry).some(command => command[0] === 'C'));
    assert.ok(renderedSamples(geometry).every(point => !inside(point, box)));
    assert.deepEqual(samplePath(geometry), logical);
    assert.deepEqual(geometry.points, original.points);
    assert.equal(pathIntersectsBox(geometry, { x: 300, y: 0, width: 10, height: 10 }), false);
  }
});

for (const renderer of ['svg', 'canvas']) {
  test(`${renderer}: Soft Flow at every target size protects final text, not only inline flags`, () => {
    for (const factory of [createChart, createDiagram]) for (const width of [390, 560, 768, 1024]) for (const mode of ['light', 'dark', 'contrast']) {
      const chart = factory({ ...createSoftFlow(width), renderer, theme: { mode, palette: 'soft' } });
      try {
        const scene = chart.model.scene, labels = [], edges = [];
        scene.walk(node => { if (node.type === 'text' && node.dataRef?.edgeId) labels.push(node); if (node.type === 'path' && node.dataRef?.from) edges.push(node); });
        for (const label of labels) {
          const size = fontPixels(label.style.font), textWidth = estimateTextWidth(label.geometry.text, size, label.style.font);
          const box = { x: label.geometry.x - textWidth / 2 - 1, y: label.geometry.y - size * 0.6 - 1, width: textWidth + 2, height: size * 1.2 + 2 };
          for (const edge of edges) assert.ok(renderedSamples(edge.geometry).every(point => !inside(point, box)), `${width}/${mode}/${label.geometry.text}`);
        }
        if (width === 768) {
          assert.equal(scene.find('edge-label-3').dataRef.onLine, false);
          assert.equal(scene.find('edge-label-3-background').style.opacity, 1);
          assert.ok(scene.find('edge-3').geometry.exclusions.length);
        }
        const restored = factory(chart.export({ type: 'json', as: 'object' }).spec);
        assert.equal(restored.export({ type: 'svg' }), chart.export({ type: 'svg' })); restored.destroy();
      } finally { chart.destroy(); }
    }
  });

  test(`${renderer}: transparent custom backgrounds, zoom and rerouting keep text clear without white patches`, () => {
    for (const type of ['flow', 'swimlane', 'architecture', 'mindmap']) {
      const spec = { type, renderer, width: 640, height: 400, background: 'transparent', view: { scale: 0.64, offsetX: 20, offsetY: 10 }, diagram: { layout: 'manual', routing: 'orthogonal' }, nodes: [{ id: 'source', label: 'Source', position: { x: 200, y: 40 }, size: { width: 120, height: 40 }, ports: [{ id: 'out', side: 'bottom' }] }, { id: 'target', label: 'Target', position: { x: 200, y: 260 }, size: { width: 120, height: 40 }, ports: [{ id: 'in', side: 'top' }] }], edges: [{ id: 'link', from: 'source', to: 'target', fromPort: 'out', toPort: 'in', label: 'Release' }], ...(type === 'swimlane' ? { lanes: [{ id: 'team', label: 'Team' }] } : {}) };
      const chart = createChart(spec);
      const background = chart.model.scene.find('edge-label-0-background');
      if (type === 'swimlane') { assert.equal(background.style.fill, chart.spec.theme.background); assert.equal(background.style.opacity, 1); }
      else assert.equal(background, undefined);
      const edge = chart.model.scene.find('edge-0');
      assert.ok(edge.geometry.exclusions?.length);
      const middle = { x: edge.geometry.points[0].x, y: (edge.geometry.points[0].y + edge.geometry.points.at(-1).y) / 2 };
      assert.equal(chart.model.scene.hit(middle.x, middle.y)?.dataRef.edgeId, 'link');
      chart.resize(768, 450); assert.ok(chart.model.scene.find('edge-0').geometry.exclusions?.length);
      chart.destroy();
    }
  });
}

test('unspecified Diagram sizes fit content while explicit geometry and fonts remain authoritative', () => {
  const node = { id: 'request', label: 'Approve international deployment', icon: 'user' };
  assert.ok(diagramNodeSize(node).width > 112);
  assert.equal(diagramNodeSize({ ...node, kind: 'connector' }).width, 28);
  for (const type of ['flow', 'swimlane', 'architecture', 'mindmap']) {
    const chart = createChart({ type, nodes: [node], ...(type === 'swimlane' ? { lanes: [{ id: 'team', label: 'Team' }] } : {}), theme: { typography: { label: { size: 16, font: '550 16px system-ui' } } } });
    const shape = chart.model.scene.find('node-request');
    assert.ok(shape.bounds.width >= 128); assert.ok(shape.bounds.height >= 44);
    assert.ok(chart.model.scene.find('node-label-request').style.font.includes('16px'));
    assert.equal(chart.getState().warnings.some(warning => warning.code === 'LABEL_TRUNCATED'), false);
    assert.equal(chart.getSpec().nodes[0].size, undefined);
    chart.destroy();
  }
  const chart = createChart({ type: 'flow', nodes: [{ ...node, position: { x: 80, y: 100 }, size: { width: 56, height: 28 } }], diagram: { layout: 'manual' } });
  assert.deepEqual(chart.model.scene.find('node-request').bounds, { x: 80, y: 100, width: 56, height: 28 });
  assert.ok(chart.getState().warnings.some(warning => ['LABEL_TRUNCATED', 'LABELS_SUPPRESSED', 'ICON_SUPPRESSED'].includes(warning.code))); chart.destroy();
});

test('shared foreground selection composites alpha and diagnoses rather than changes explicit colors', () => {
  assert.equal(compositeColor('#000000', '#ffffff', 0.1), '#e6e6e6');
  assert.equal(compositeColor('rgba(0,0,0,0.1)', '#ffffff'), '#e6e6e6');
  assert.equal(contrastRatio('rgba(0,0,0,0)', '#ffffff'), 1);
  assert.equal(compositeColor('transparent', 'transparent'), null);
  for (const factory of [createChart, createStandard]) for (const opacity of [1, 0.1]) {
    const spec = { type: 'pie', width: 560, data: [{ name: 'A', value: 10 }], colors: ['#777777'], labels: { enabled: true }, theme: { mode: 'light', marks: { opacity } } };
    const chart = factory(spec), label = chart.model.scene.find('series-0-item-0-label');
    assert.ok(contrastRatio(label.style.fill, compositeColor('#777777', '#ffffff', opacity)) >= 4.5);
    assert.equal(chart.model.scene.find('series-0-item-0-label-background'), undefined); chart.destroy();
    const explicit = factory({ ...spec, labels: { enabled: true, color: '#888888' } });
    assert.equal(explicit.model.scene.find('series-0-item-0-label').style.fill, '#888888');
    assert.ok(explicit.getState().warnings.some(warning => warning.code === 'INSUFFICIENT_TEXT_CONTRAST')); explicit.destroy();
  }
  for (const factory of [createChart, createStandard]) {
    const chart = factory({ type: 'heatmap', data: [{ x: 'Mon', y: 'AM', value: 12 }], colors: ['#777777'], labels: { enabled: true, color: '#888888' }, theme: { marks: { opacity: 0.1 } } });
    assert.equal(chart.model.scene.find('heatmap-cell-label-0').style.fill, '#888888');
    assert.ok(chart.getState().warnings.some(warning => warning.code === 'INSUFFICIENT_TEXT_CONTRAST')); chart.destroy();
  }
});

test('Gauge metrics use their actual sector background and move off mixed-contrast boundaries', () => {
  for (const factory of [createChart, createStandard]) for (const mode of ['light', 'dark', 'contrast']) for (const value of [0, 30, 50, 72, 100]) {
    const chart = factory({ type: 'gauge', width: 560, domain: [0, 100], data: [{ value }], theme: { mode } });
    const label = chart.model.scene.find('gauge-label'), sector = chart.model.scene.find('gauge-value'), background = chart.model.scene.find('gauge-background'), size = fontPixels(label.style.font), width = estimateTextWidth(label.geometry.text, size, label.style.font);
    for (const horizontal of [-1, 1]) for (const vertical of [-1, 1]) {
      const angle = Math.atan2(label.geometry.y + vertical * size * 0.6 - sector.geometry.cy, label.geometry.x + horizontal * width / 2 - sector.geometry.cx) + Math.PI * 2;
      const fill = angle <= sector.geometry.end ? sector.style.fill : background.style.fill;
      assert.ok(contrastRatio(label.style.fill, fill) >= 4.5, `${mode}/${value}`);
    }
    assert.equal(chart.model.scene.find('gauge-label-background'), undefined); chart.destroy();
  }
});

test('Line and Area labels avoid every series path without hiding the data or adding plates', () => {
  const source = galleryCases.find(item => item.id === 'area').spec;
  for (const factory of [createChart, createStandard]) for (const type of ['line', 'area']) {
    const chart = factory({ ...source, stack: undefined, type, width: 768, labels: { enabled: true } }), paths = [], labels = [];
    chart.model.scene.walk(node => { if (/^series-\d+-line$/.test(node.id)) paths.push(node); if (node.visible && /^series-\d+-item-\d+-label$/.test(node.id)) labels.push(node); });
    assert.ok(labels.length);
    for (const label of labels) {
      const size = fontPixels(label.style.font), width = estimateTextWidth(label.geometry.text, size, label.style.font), box = { x: label.geometry.x - width / 2, y: label.geometry.y - size * 0.6, width, height: size * 1.2 };
      for (const path of paths) { assert.equal(pathIntersectsBox(path.geometry, box), false); assert.equal(path.geometry.exclusions, undefined); }
      assert.ok(chart.model.scene._labelBoxes.some(occupied => Math.abs(occupied.y + occupied.height / 2 - label.geometry.y) < 1e-8));
    }
    assert.doesNotMatch(chart.export({ type: 'svg' }), /label-background/); chart.destroy();
  }
});

test('diagram gutters have no axis reservation, but explicit padding and node sizes stay fixed', () => {
  for (const factory of [createChart, createDiagram]) {
    const spec = { type: 'flow', nodes: [{ id: 'a', label: 'A' }], branding: { enabled: false } }, automatic = factory(spec);
    assert.equal(automatic.model.state.plot.x, 16);
    assert.equal(automatic.model.state.plot.y, 16);
    assert.equal(automatic.model.state.plot.height, 328); automatic.destroy();
    const explicit = factory({ ...spec, padding: { top: 50, right: 28, bottom: 44, left: 58 } });
    assert.equal(explicit.model.state.plot.x, 58); assert.equal(explicit.model.state.plot.y, 50); assert.equal(explicit.model.state.plot.height, 266); explicit.destroy();
  }
});

test('zero-padding group frames enclose display-sized label plates at non-unit zoom', () => {
  for (const scale of [0.64, 1, 1.5]) {
    const chart = createChart({ type: 'flow', width: 800, height: 500, view: { scale }, diagram: { layout: 'manual', routing: 'orthogonal' }, groups: [{ id: 'team', padding: 0 }], nodes: [{ id: 'from', label: 'From', groupId: 'team', size: { width: 112, height: 36 }, position: { x: 200, y: 50 }, ports: [{ id: 'out', side: 'bottom' }] }, { id: 'to', label: 'To', groupId: 'team', size: { width: 112, height: 36 }, position: { x: 200, y: 280 }, ports: [{ id: 'in', side: 'top' }] }], edges: [{ from: 'from', to: 'to', fromPort: 'out', toPort: 'in', label: 'Approve international release' }] });
    const frame = chart.model.scene.find('group-team').geometry, plate = chart.model.scene.find('edge-label-0-background')?.geometry;
    assert.ok(plate);
    assert.ok(plate.x >= frame.x - 1e-8 && plate.x + plate.width <= frame.x + frame.width + 1e-8, `${scale}`);
    chart.destroy();
  }
});

test('bounded stroke sizing follows measured automatic node height and respects explicit widths', () => {
  const spec = { type: 'flow', width: 1200, height: 800, nodes: [{ id: 'a', label: 'Approve request' }, { id: 'b', label: 'Deliver' }], edges: [{ from: 'a', to: 'b' }] };
  const regular = createChart(spec), large = createChart({ ...spec, theme: { typography: { label: { size: 24, font: '550 24px system-ui' } } } });
  assert.ok(large.model.scene.find('edge-0').style.strokeWidth > regular.model.scene.find('edge-0').style.strokeWidth);
  assert.ok(large.model.scene.find('edge-0').style.strokeWidth <= 1.75 * 1.35);
  const explicit = createChart({ ...spec, theme: { marks: { lineWidth: 2 }, typography: { label: { size: 24, font: '550 24px system-ui' } } } });
  assert.equal(explicit.model.scene.find('edge-0').style.strokeWidth, 2);
  regular.destroy(); large.destroy(); explicit.destroy();
});

test('automatic semantic nodes keep English/CJK text inside the actual shape with left/top icons', () => {
  for (const kind of ['start', 'end', 'decision', 'process', 'io']) for (const label of ['Approve international deployment', '审批国际业务发布流程']) for (const iconPosition of ['left', 'top']) {
    const chart = createChart({ type: 'flow', width: 600, height: 500, nodes: [{ id: 'item', kind, label, icon: 'user' }], diagram: { appearance: 'soft', iconPosition } });
    const shape = chart.model.scene.find('node-item'), text = [];
    chart.model.scene.walk(node => { if (node.type === 'text' && node.dataRef?.nodeId === 'item') text.push(node); });
    assert.equal(text.map(node => node.geometry.text).join('').replaceAll(' ', ''), label.replaceAll(' ', ''), `${kind}/${iconPosition}`);
    for (const node of text) {
      const size = fontPixels(node.style.font), width = estimateTextWidth(node.geometry.text, size, node.style.font), box = shape.bounds;
      for (const horizontal of [-1, 1]) for (const vertical of [-1, 1]) {
        const normalizedX = Math.abs(node.geometry.x + horizontal * width / 2 - box.x - box.width / 2) / (box.width / 2), normalizedY = Math.abs(node.geometry.y + vertical * size * 0.6 - box.y - box.height / 2) / (box.height / 2);
        if (kind === 'decision') assert.ok(normalizedX + normalizedY <= 1.001, `${kind}/${iconPosition}`);
        else if (['start', 'end'].includes(kind)) assert.ok(normalizedX ** 2 + normalizedY ** 2 <= 1.001, `${kind}/${iconPosition}`);
      }
    }
    chart.destroy();
  }
});

test('physically constrained label fallback is diagnosed without changing geometry or the viewport', () => {
  const spec = { type: 'flow', width: 160, height: 40, diagram: { layout: 'manual' }, nodes: [{ id: 'a', label: 'A', position: { x: 0, y: 0 }, size: { width: 64, height: 36 } }, { id: 'b', label: 'B', position: { x: 96, y: 0 }, size: { width: 64, height: 36 } }], edges: [{ from: 'a', to: 'b', label: 'A very long deployment label' }] };
  const chart = createChart(spec);
  assert.ok(chart.getState().warnings.some(warning => warning.code === 'LABEL_LAYOUT_CONSTRAINED'));
  assert.deepEqual(chart.getSpec().nodes.map(node => node.position), spec.nodes.map(node => node.position));
  assert.equal(chart.getSpec().view, undefined); assert.equal(chart.model.state.view.scale, 1); chart.destroy();
});

test('embedded Diagram line gaps follow Board translation and do not change chart checkpoints', () => {
  const spec = { ...createSoftFlow(768), background: 'transparent', theme: { mode: 'light', palette: 'soft', marks: { lineWidth: 2 } } }, chart = createChart(spec);
  const original = chart.model.scene.find('edge-3').geometry.exclusions;
  const board = createBoard({ width: 1000, height: 600, items: [{ id: 'workflow', kind: 'chart', position: { x: 70, y: 40 }, size: { width: 768, height: 450 }, spec }] });
  const paths = []; board.scene.walk(node => { if (node.geometry.exclusions?.length) paths.push(node); });
  assert.ok(paths.length);
  const embedded = paths.find(node => node.id.endsWith('edge-3'));
  assert.ok(embedded); assert.equal(embedded.geometry.exclusions[0].x, original[0].x + 70);
  assert.equal(embedded.geometry.exclusions[0].y, original[0].y + 40);
  assert.deepEqual(board.getSpec().items[0].spec.edges, chart.getSpec().edges);
  board.update({ items: [{ ...board.getSpec().items[0], size: { width: 384, height: 225 } }] });
  const scaled = []; board.scene.walk(node => { if (node.id.endsWith('edge-3')) scaled.push(node); });
  assert.equal(scaled[0].geometry.exclusions[0].width, original[0].width);
  assert.equal(scaled[0].geometry.exclusions[0].height, original[0].height);
  assert.ok(Math.abs(scaled[0].geometry.exclusions[0].x + original[0].width / 2 - ((original[0].x + original[0].width / 2) * 0.5 + 70)) < 1e-8);
  board.destroy(); chart.destroy();
});

test('default-first representative charts render across widths, modes and both renderers without enabling interactions', () => {
  const minimal = JSON.parse(readFileSync(new URL('../agent-recipes/minimal-specs.json', import.meta.url), 'utf8')).examples;
  for (const sample of galleryCases.filter(item => item.id !== 'flow-soft')) for (const width of [390, 560, 768, 1024]) for (const mode of ['light', 'dark', 'contrast']) for (const renderer of ['svg', 'canvas']) {
    const spec = structuredClone(sample.spec); delete spec.padding; delete spec.view;
    spec.width = width; spec.height = 420; spec.renderer = renderer; spec.theme = { mode }; spec.interaction = {};
    if (spec.nodes) { spec.nodes = spec.nodes.map(({ position, size, ...node }) => node); spec.diagram = { layout: spec.type === 'mindmap' ? 'tree' : 'layered' }; }
    const chart = createChart(spec);
    assert.equal(chart.getState().health.renderable, true, `${sample.id}/${width}/${mode}/${renderer}`);
    assert.equal(chart.getSpec().interaction.zoom, false); assert.equal(chart.getSpec().interaction.pan, false);
    assert.doesNotMatch(chart.export({ type: 'svg' }), /(?:NaN|Infinity)/);
    chart.destroy();
  }
  assert.equal(Object.keys(minimal).length, 18);
});
