import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, createBoard, getCapabilities } from '../src/index.mjs';
import { createChart as standard, getCapabilities as standardCapabilities } from '../src/standard.mjs';
import { createChart as project } from '../src/project-profile.mjs';
import { createChart as diagram } from '../src/diagram-profile.mjs';
import { createBoard as board, getCapabilities as boardCapabilities } from '../src/board-profile.mjs';
import { Scene } from '../src/scene.mjs';
import { exportRaster, resolveExport } from '../src/export.mjs';

const line = { type: 'line', renderer: 'svg', data: [{ id: 'one', name: 'A', value: 2 }] };
const factories = {
  root: () => createChart(line), standard: () => standard(line),
  project: () => project({ type: 'gantt', data: [{ id: 'task', name: 'Plan', start: '2026-01-01', end: '2026-01-02' }] }),
  diagram: () => diagram({ type: 'flow', nodes: [{ id: 'start', label: 'Start', kind: 'start' }] }),
  board: () => board({ items: [] }), rootBoard: () => createBoard({ items: [] })
};

for (const [name, create] of Object.entries(factories)) test(`${name}: exact export formats and representations reject without mutation`, async () => {
  const chart = create(), before = JSON.stringify({ spec: chart.getSpec(), state: chart.getState() });
  try {
    for (const type of ['pdf', 'tiff', 'application/not-svg', 'png-extra', '__proto__', 'constructor', '', null, {}, 42]) assert.equal(chart.export({ type }).code, 'EXPORT_TYPE_UNSUPPORTED', String(type));
    for (const type of ['svg', 'png', 'jpeg']) for (const as of ['object', 'buffer', null]) assert.equal(chart.export({ type, as }).code, 'EXPORT_TYPE_UNSUPPORTED');
    for (const options of [null, [], 'png']) assert.equal(chart.export(options).code, 'EXPORT_TYPE_UNSUPPORTED');
    assert.equal(chart.export({ type: 'png' }).code, 'HEADLESS_EXPORT_UNSUPPORTED');
    assert.equal(chart.export({ type: 'svg', as: 'blob' }).code, 'BLOB_HEADLESS');
    if (chart.exportAsync) assert.equal((await chart.exportAsync({ type: 'pdf' })).code, 'EXPORT_TYPE_UNSUPPORTED');
    assert.equal(JSON.stringify({ spec: chart.getSpec(), state: chart.getState() }), before);
    const object = chart.export({ type: 'json', as: 'object' });
    assert.deepEqual(JSON.parse(chart.export({ type: 'json', as: 'string' })), object);
    assert.deepEqual(JSON.parse(decodeURIComponent(chart.export({ type: 'application/json', as: 'dataurl' }).split(',')[1])), object);
    const blob = chart.export({ type: 'json', as: 'blob' });
    assert.equal(blob.type, 'application/json'); assert.deepEqual(JSON.parse(await blob.text()), object);
    assert.match(chart.export({ type: 'IMAGE/SVG+XML' }), /<svg/);
    if (name.includes('Board') || name === 'board') assert.deepEqual(chart.export({ type: 'json' }), chart.getSpec());
    else assert.equal(typeof chart.export({ type: 'json' }), 'string');
  } finally { chart.destroy(); }
  assert.equal(chart.export({ type: 'svg' }).code, 'EXPORT_DESTROYED');
});

test('export discovery declares JPEG, representations and browser/headless limits', () => {
  for (const capabilities of [getCapabilities(), standardCapabilities(), boardCapabilities()]) {
    assert.ok(capabilities.exports.includes('jpeg'));
    assert.deepEqual(capabilities.export.delivery.representations.png, ['dataurl', 'string', 'blob']);
    assert.match(capabilities.export.delivery.nodeRaster, /root exportAsync only/);
  }
  assert.equal(resolveExport({ type: 'image/jpg' }).kind, 'jpeg');
});

test('detached raster failures release resources and preserve the source scene', () => {
  const scene = new Scene(80, 60), spec = { width: 80, height: 60 }, request = resolveExport({ type: 'png' });
  const canvas = { width: 9, height: 9, getContext: () => null };
  assert.equal(exportRaster(spec, scene, request, () => canvas).code, 'EXPORT_CONTEXT_UNAVAILABLE');
  assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
  const context = { setTransform() {}, clearRect() {}, save() {}, restore() {}, fillRect() {} };
  canvas.getContext = () => context;
  canvas.toDataURL = () => { const error = new Error('tainted'); error.name = 'SecurityError'; throw error; };
  assert.equal(exportRaster(spec, scene, request, () => canvas).code, 'EXPORT_TAINTED_CANVAS');
  canvas.toDataURL = () => 'data:image/jpeg;base64,/9j/';
  assert.equal(exportRaster(spec, scene, request, () => canvas).code, 'EXPORT_TYPE_UNSUPPORTED');
  canvas.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
  assert.match(exportRaster(spec, scene, request, () => canvas), /^data:image\/png;/);
  scene.add({ id: 'pending', type: 'image', geometry: { src: 'pending.png' } });
  assert.equal(exportRaster(spec, scene, request, () => canvas).code, 'EXPORT_ASSET_UNAVAILABLE');
});

test('root convenience exports reject unsupported requests instead of substituting PNG', () => {
  const chart = createChart(line);
  for (const method of ['toDataURL', 'toBlob']) {
    const result = chart[method]('pdf');
    assert.equal(result.code, 'EXPORT_TYPE_UNSUPPORTED');
  }
  assert.equal(chart.download({ type: 'pdf' }).code, 'EXPORT_TYPE_UNSUPPORTED');
  chart.destroy();
});
