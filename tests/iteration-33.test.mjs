import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, createBoard, getCapabilities, getBusinessSchema, validateSpec, resolveTheme, validateThemeContrast } from '../src/index.mjs';
import { createChart as diagram, getCapabilities as diagramCapabilities } from '../src/diagram-profile.mjs';
import { validateBoardSpec, boardCapabilities } from '../src/board-profile.mjs';
import { iconNames, iconNodes } from '../src/icons.mjs';
import { safeCornerRadii } from '../src/diagram.mjs';
import { pathCommands, rectanglePath, samplePath } from '../src/path.mjs';
import { Scene } from '../src/scene.mjs';
import { sceneToSvgString } from '../src/scene-svg.mjs';
import { CanvasRenderer } from '../src/renderer.mjs';
import { rerouteDiagramScene } from '../src/project.mjs';
import { baseline, allowedGrowth, featureAllowance, footprintLimits, footprintFailures } from '../scripts/footprint-lib.mjs';

const spec = { type: 'flow', renderer: 'svg', width: 680, height: 400, nodes: [{ id: 'request', kind: 'process', label: 'Request', icon: 'user', position: { x: 40, y: 80 }, size: { width: 180, height: 72 } }, { id: 'check', kind: 'process', label: 'Risk check', icon: 'shield', tone: 'secondary', position: { x: 380, y: 240 }, size: { width: 180, height: 72 } }], edges: [{ id: 'link', from: 'request', to: 'check' }], theme: { mode: 'light', palette: 'soft' }, diagram: { layout: 'manual', appearance: 'soft', routing: 'orthogonal' } };

test('soft palette is independent from diagram geometry and safe in all theme modes', () => {
  for (const mode of ['light', 'dark', 'contrast']) {
    const theme = resolveTheme({ mode, palette: 'soft' });
    assert.ok(theme.colors.length >= 6); assert.deepEqual(validateThemeContrast(theme), []);
  }
  const chart = createChart({ ...spec, nodes: spec.nodes.map(({ icon, tone, ...node }) => node), diagram: { layout: 'manual' } });
  assert.equal(chart.model.scene.find('node-request').geometry.radius, undefined);
  assert.equal(chart.model.scene.find('edge-0-arrow').style.fill === 'none', false);
  chart.destroy();
});

test('root and diagram Profile preserve soft visuals, schema edits and JSON reconstruction', () => {
  for (const factory of [createChart, diagram]) {
    const chart = factory(spec), snapshot = chart.getSpec();
    assert.equal(chart.model.scene.find('node-request').geometry.radius, 10);
    assert.equal(chart.model.scene.find('edge-0-arrow').geometry.points.length, 3);
    assert.equal(chart.model.scene.find('edge-0-arrow').style.fill, 'none');
    assert.ok(chart.model.scene.find('edge-0').geometry.cornerRadii.some(value => value > 0));
    assert.match(chart.export({ type: 'svg' }), /rx="10"/);
    assert.ok(chart.model.scene.find('icon-request-0').decorative);
    const restored = factory(chart.export({ type: 'json', as: 'object' }).spec);
    assert.deepEqual(restored.getSpec(), snapshot); restored.destroy();
    chart.update({ diagram: { layout: 'manual', appearance: 'classic' } });
    assert.equal(chart.model.scene.find('node-request').geometry.radius, undefined);
    chart.destroy();
  }
  assert.equal(getBusinessSchema('flow-node').fields.icon.editable, true);
  assert.ok(getBusinessSchema('architecture-edge').fields.tone.values.includes('danger'));
});

test('all sixteen glyphs are bounded, decorative and shared with Board discovery', () => {
  assert.equal(iconNames.length, 16); assert.equal(new Set(iconNames).size, 16);
  assert.deepEqual(getCapabilities().diagram.visuals.icons, iconNames);
  assert.deepEqual(diagramCapabilities().diagram.visuals.icons, iconNames);
  assert.deepEqual(boardCapabilities.icons.names, iconNames);
  for (const name of iconNames) {
    const nodes = iconNodes(name, { x: 10, y: 20, width: 24, height: 24 }, '#008080', name);
    assert.ok(nodes.length > 0);
    for (const node of nodes) {
      assert.equal(node.decorative, true); assert.equal(node.interactive, undefined);
      if (node.geometry.points) for (const point of node.geometry.points) assert.ok(point.x >= 10 && point.x <= 34 && point.y >= 20 && point.y <= 44, name);
    }
  }
  assert.deepEqual(iconNodes('__proto__', { width: 24, height: 24 }, '#000', 'bad'), []);
});

test('top icons are measured; narrow nodes retain text and report suppression', () => {
  const chart = createChart({ ...spec, diagram: { ...spec.diagram, iconPosition: 'top', iconBadge: false }, nodes: [{ ...spec.nodes[0], size: { width: 180, height: 104 } }], edges: [] });
  assert.ok(chart.model.scene.find('icon-request-0'));
  assert.equal(chart.model.scene.find('icon-badge-request'), undefined);
  chart.update({ nodes: [{ ...spec.nodes[0], label: 'Request', size: { width: 88, height: 36 } }] });
  assert.equal(chart.model.scene.find('icon-request-0'), undefined);
  assert.ok(chart.getState().warnings.some(warning => warning.code === 'ICON_SUPPRESSED'));
  assert.ok(chart.model.scene.find('node-label-request')); chart.destroy();
  const words = createChart({ ...spec, nodes: [{ ...spec.nodes[0], label: 'Human approval', size: { width: 132, height: 64 } }], edges: [] });
  const lines = []; words.model.scene.walk(node => { if (node.type === 'text' && node.dataRef?.nodeId === 'request') lines.push(node.geometry.text); });
  assert.deepEqual(lines, ['Human', 'approval']); words.destroy();
});

test('visual validation rejects invalid options and diagnoses unknown glyphs', () => {
  for (const diagram of [{ appearance: 'unknown' }, { arrow: 'x' }, { cornerRadius: -1 }, { cornerRadius: Infinity }, { iconBadge: 'yes' }, { iconPosition: 'right' }]) assert.equal(validateSpec({ ...spec, diagram }).valid, false);
  const unknown = validateSpec({ ...spec, nodes: [{ ...spec.nodes[0], icon: 'unknown' }], edges: [] });
  assert.equal(unknown.valid, true); assert.ok(unknown.warnings.some(warning => warning.code === 'UNKNOWN_ICON'));
  assert.equal(validateSpec({ ...spec, nodes: [{ ...spec.nodes[0], icon: {} }], edges: [] }).valid, false);
  assert.equal(validateSpec({ ...spec, nodes: [{ ...spec.nodes[0], tone: 'red-risk-guessed' }], edges: [] }).valid, false);
  assert.equal(validateSpec({ ...spec, edges: [{ ...spec.edges[0], icon: 'user' }] }).valid, false);
});

test('soft appearance preserves semantic shapes and text before decoration', () => {
  for (const [kind, type] of [['process', 'rect'], ['start', 'ellipse'], ['end', 'ellipse'], ['decision', 'path'], ['io', 'path'], ['connector', 'circle']]) {
    const chart = createChart({ ...spec, nodes: [{ ...spec.nodes[0], kind }], edges: [] });
    assert.equal(chart.model.scene.find('node-request').type, type, kind);
    if (kind === 'connector') assert.equal(chart.model.scene.find('icon-request-0'), undefined);
    chart.destroy();
  }
});

test('rounded paths use real cubics; unsafe hulls stay sharp and waypoints are unchanged', () => {
  const points = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 80 }], before = structuredClone(points);
  const radii = safeCornerRadii(points, 10);
  assert.equal(radii[1], 10);
  const geometry = { points, cornerRadii: radii };
  assert.ok(pathCommands(geometry).some(command => command[0] === 'C'));
  assert.ok(samplePath(geometry).length > 3);
  assert.equal(pathCommands({ points: [...points, { x: 0, y: 80 }], curve: 'cubic', closed: true }).at(-1)[0], 'Z');
  assert.equal(safeCornerRadii(points, 10, [{ x: 74, y: 3, width: 3, height: 3 }])[1], 0);
  assert.deepEqual(points, before);
  const chart = createChart({ ...spec, diagram: { layout: 'manual', cornerRadius: 8 } });
  assert.equal(chart.model.scene.find('edge-0').dataRef.radius, 8);
  rerouteDiagramScene(chart.model.scene);
  assert.ok(chart.model.scene.find('edge-0').geometry.cornerRadii.some(radius => radius > 0));
  assert.notEqual(chart.model.scene.find('edge-0-arrow').style.fill, 'none'); chart.destroy();
});

test('rounded rectangle hits and Canvas/SVG geometry agree, including corner ports', () => {
  const scene = new Scene(100, 100), box = { x: 10, y: 10, width: 80, height: 60, radius: 12 };
  scene.add({ id: 'node', type: 'rect', geometry: box, bounds: box, interactive: true, style: { fill: '#008080' } });
  assert.equal(scene.hit(10, 10), null); assert.equal(scene.hit(50, 40).id, 'node');
  assert.equal(pathCommands(rectanglePath(box)).filter(command => command[0] === 'C').length, 4);
  assert.match(sceneToSvgString(scene), /rx="12"/);
  let curves = 0;
  const context = new Proxy({}, { get: (_, key) => key === 'bezierCurveTo' ? () => { curves += 1; } : () => {} });
  const renderer = new CanvasRenderer(); renderer.ctx = context; renderer.render(scene); assert.equal(curves, 4);
  const chart = createChart({ ...spec, nodes: [{ ...spec.nodes[0], ports: [{ id: 'corner', side: 'left', offset: 0 }] }], edges: [] });
  assert.equal(chart.model.scene.find('node-request').geometry.radius, 0); chart.destroy();
});

test('Board glyphs use existing shapes, survive edits/history and retain opacity', () => {
  const item = { id: 'db', kind: 'shape', shape: 'ellipse', icon: 'database', position: { x: 20, y: 20 }, size: { width: 64, height: 64 }, opacity: 0.5, style: { fill: '#e8f5f2', stroke: '#008080' } };
  const board = createBoard({ items: [item] });
  assert.equal(board.scene.find('icon-db-0').style.opacity, 0.5);
  board.update({ items: [{ ...item, icon: 'server' }] }); assert.equal(board.getSpec().items[0].icon, 'server');
  board.undo(); assert.equal(board.getSpec().items[0].icon, 'database');
  const restored = createBoard(board.export({ type: 'json' })); assert.ok(restored.scene.find('icon-db-0')); restored.destroy(); board.destroy();
  assert.ok(validateBoardSpec({ items: [{ ...item, icon: 'unknown' }] }).warnings.some(warning => warning.code === 'UNKNOWN_ICON'));
});

test('reviewed feature allowance preserves the original footprint baseline and enforces exact ceilings', () => {
  assert.deepEqual(baseline, { moduleRawBytes: 535216, moduleGzipBytes: 129561, packageBytes: 344082, unpackedBytes: 1231449 });
  assert.equal(allowedGrowth, 1.15); assert.equal(featureAllowance.iteration, 33);
  assert.deepEqual(footprintFailures(footprintLimits), []);
  for (const key of Object.keys(footprintLimits)) assert.equal(footprintFailures({ ...footprintLimits, [key]: footprintLimits[key] + 1 }).length, 1);
});
