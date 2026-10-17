import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { readDocumentSnippets, quickstartWorkflowSource } from '../../scripts/check-doc-snippets.mjs';
import { measureMountedLifecycle } from './lifecycle-benchmark.mjs';
import { verifyHostLifecycle } from './host-lifecycle.mjs';
import { verifyExportDelivery } from './export-delivery.mjs';
import { verifyAgentTasks } from './task-acceptance.mjs';
import { verifyDefaultVisuals } from './default-visuals.mjs';

const root = new URL('../../', import.meta.url);
const browserPort = Number(process.env.BROWSER_PORT || 34567);
const baseUrl = `http://127.0.0.1:${browserPort}`;
const chromeCandidates = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

let browser;
let page;
let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/playground/project-gallery.html`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Playground server did not become ready');
}

before(async () => {
  const executablePath = chromeCandidates.find(existsSync);
  if (!executablePath) throw new Error('Chrome executable not found; set CHROME_BIN');
  server = spawn(process.execPath, ['scripts/serve-playground.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(browserPort), HOST: '127.0.0.1' },
    stdio: 'ignore'
  });
  await waitForServer();
  browser = await chromium.launch({ executablePath, headless: true });
  page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(15_000);
});

async function goto(path, options = {}) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000, ...options });
  if (path.includes('project-gallery')) {
    await page.waitForFunction(() => document.querySelector('#count')?.textContent.includes(' / '));
  } else if (path.includes('diagram-editor')) {
    await page.locator('#chart svg, #chart canvas').first().waitFor({ state: 'attached' });
  } else if (path.includes('canvas-board')) {
    await page.locator('#board svg, #board canvas').first().waitFor({ state: 'attached' });
  } else if (path.includes('accessibility-lab')) {
    await page.waitForFunction(() => Boolean(document.querySelector('#output')?.textContent?.trim()));
  } else if (path.includes('consumer-browser')) {
    await page.locator('#chart svg, #chart canvas').first().waitFor({ state: 'attached' });
  }
}

after(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
});

test('Iteration 35: default visuals protect real text and transparent PNG pixels across renderers', async () => {
  await goto('/playground/index.html');
  const report = await page.evaluate(verifyDefaultVisuals);
  assert.equal(report.softCases, 48);
  assert.equal(report.defaultCases, 432);
  for (const [check, passed] of Object.entries(report.checks)) assert.equal(passed, true, `${check} ${JSON.stringify(report.difference || {})}`);
});

test('Agent delivery tasks preserve trend data and incremental Flow semantics', async () => {
  await goto('/playground/index.html');
  const tasks = await page.evaluate(verifyAgentTasks, { root: '/src/index.mjs', standard: '/src/standard.mjs' });
  assert.equal(tasks.length, 4);
  for (const task of tasks) for (const [name, passed] of Object.entries(task.checks)) assert.equal(passed, true, `${task.task}/${task.renderer}: ${name}`);
});

for (const renderer of ['svg', 'canvas']) {
  test(`Diagram Editor ${renderer}: group clearance respects room, actual zoomed labels and constrained fallback`, async () => {
    await page.setViewportSize({ width: 658, height: 900 });
    try {
      await goto(`/playground/diagram-editor.html?scenario=editor&loop=1&renderer=${renderer}`);
      await page.locator('#save-spec').click();
      const spec = JSON.parse(await page.locator('#spec-text').inputValue());
      spec.view = { scale: 0.64, offsetX: 0, offsetY: 0 };
      const positions = { review: { x: 320, y: 160 }, qa: { x: 400, y: 376 }, done: { x: 672, y: 152 } };
      spec.nodes = spec.nodes.map(node => ({ ...node, position: positions[node.id] || node.position }));
      const load = async value => {
        await page.locator('#spec-text').fill(JSON.stringify(value));
        await page.locator('#load-spec').click();
        return JSON.parse(await page.locator('#output').textContent()).state;
      };
      const measure = async () => {
        const downloading = page.waitForEvent('download');
        await page.locator('#export-svg').click();
        const download = await downloading, source = await readFile(await download.path(), 'utf8');
        return page.evaluate(source => {
          const host = document.createElement('div');
          Object.assign(host.style, { position: 'fixed', left: '-10000px' });
          host.innerHTML = source;
          document.body.append(host);
          try {
            const frame = host.querySelector('#group-delivery').getBBox(), label = host.querySelector('#edge-label-2').getBBox();
            const path = host.querySelector('#edge-2').getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
            return { path, gap: path[2] - frame.x - frame.width, labelGap: label.x - frame.x - frame.width, text: host.querySelector('#edge-label-2').textContent };
          } finally { host.remove(); }
        }, source);
      };
      const ready = await load(spec), normal = await measure();
      assert.equal(ready.warnings.some(warning => warning.code === 'EDGE_GROUP_CLEARANCE_REDUCED'), false);
      assert.ok(normal.gap >= 12 * 0.64 - 0.001);
      assert.ok(normal.labelGap >= 12 * 0.64 - 0.5, `${normal.labelGap}`);
      assert.equal(normal.text, 'release');
      const constrained = { ...spec, nodes: [...spec.nodes, { id: 'blocker', label: 'Blocker', position: { x: 568, y: 300 }, size: { width: 32, height: 180 } }] };
      const reduced = await load(constrained), tight = await measure();
      assert.ok(reduced.warnings.some(warning => warning.code === 'EDGE_GROUP_CLEARANCE_REDUCED' && warning.edgeId === 'qa-done'));
      assert.ok(tight.gap < 12 * 0.64);
      const recovered = await load(spec), restored = await measure();
      assert.equal(recovered.warnings.some(warning => warning.code === 'EDGE_GROUP_CLEARANCE_REDUCED'), false);
      assert.deepEqual(restored, normal);
    } finally { await page.setViewportSize({ width: 900, height: 600 }); }
  });
}

for (const renderer of ['svg', 'canvas']) {
  test(`Diagram Editor ${renderer}: reciprocal return channels survive repeated pointer edits and node movement`, async () => {
    await goto(`/playground/diagram-editor.html?scenario=editor&loop=1&renderer=${renderer}`);
    const surface = page.locator('#chart svg, #chart canvas').first();
    const save = async () => {
      await page.locator('#save-spec').click();
      return JSON.parse(await page.locator('#spec-text').inputValue());
    };
    const inspect = async spec => page.evaluate(async spec => {
      const { createChart } = await import('/src/index.mjs');
      const chart = createChart({ ...spec, container: undefined });
      try {
        chart.selectEdges(['qa-review']);
        const path = chart.model.scene.find('edge-3').geometry.points;
        let handle;
        chart.model.scene.walk(node => {
          if (node.dataRef?.edgeId !== 'qa-review' || node.dataRef.edgeHandle !== 'segment') return;
          const points = node.dataRef.routePoints, index = node.dataRef.segmentIndex;
          if (points[index].y === points[index + 1].y && (points[index].y < 160 || points[index].y > 224)) handle = { x: node.geometry.x + 5, y: node.geometry.y + 5 };
        });
        return { path, handle, route: chart.getState().edgeRoutes.find(route => route.edgeId === 'qa-review') };
      } finally { chart.destroy(); }
    }, spec);
    const position = async (point, spec) => {
      await surface.scrollIntoViewIfNeeded();
      const box = await surface.boundingBox();
      return { x: box.x + point.x * box.width / spec.width, y: box.y + point.y * box.height / spec.height };
    };
    const original = await save();
    let current = original;
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const before = await inspect(current);
      assert.ok(before.handle);
      const start = await position(before.handle, current);
      await page.mouse.click(start.x, start.y);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      const shift = before.handle.y < 160 ? -24 : 24;
      const end = await position({ ...before.handle, y: before.handle.y + shift }, current);
      await page.mouse.move(end.x, end.y, { steps: 6 });
      await page.mouse.up();
      const next = await save(), route = next.edges.find(edge => edge.id === 'qa-review');
      assert.equal(route.routingMode, 'manual');
      assert.notDeepEqual(route.waypoints, current.edges.find(edge => edge.id === 'qa-review').waypoints);
      assert.equal((await inspect(next)).route.effectiveRoutingMode, 'manual');
      current = next;
    }
    const edited = current.edges.find(edge => edge.id === 'qa-review');
    const node = current.nodes.find(node => node.id === 'qa');
    const start = await position({ x: node.position.x + node.size.width / 2, y: node.position.y + node.size.height / 2 }, current);
    const end = await position({ x: node.position.x + node.size.width / 2 + 32, y: node.position.y + node.size.height / 2 }, current);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 6 });
    await page.mouse.up();
    const moved = await save();
    assert.notDeepEqual(moved.nodes.find(node => node.id === 'qa').position, node.position);
    assert.equal(moved.edges.find(edge => edge.id === 'qa-review').waypoints[1].y, edited.waypoints[1].y);
    assert.equal((await inspect(moved)).route.effectiveRoutingMode, 'manual');
    await page.locator('#undo').click();
    assert.deepEqual((await save()).edges, current.edges);
    await page.locator('#redo').click();
    assert.deepEqual((await save()).edges, moved.edges);
    await page.locator('#load-spec').click();
    assert.match(await page.locator('#status').textContent(), /Spec reloaded/);
    assert.equal((await inspect(await save())).route.effectiveRoutingMode, 'manual');
    await page.locator('#reset').click();
    const reset = await save();
    assert.deepEqual(reset.nodes, original.nodes);
    assert.deepEqual(reset.edges, original.edges);
  });
}

test('stroke sizing survives mounted resize and produces identical SVG/Canvas exports', async () => {
  await goto('/playground/index.html');
  const reports = await page.evaluate(async () => {
    const { createChart } = await import('/src/index.mjs');
    const host = document.createElement('div');
    host.style.display = 'inline-block';
    document.body.append(host);
    const reports = [];
    try {
      for (const type of ['line', 'area', 'flow']) {
        const images = new Map();
        for (const renderer of ['svg', 'canvas']) {
          host.style.width = '320px';
          const chart = createChart({ container: host, type, renderer, width: 320, height: 240, data: [{ name: 'A', value: 1 }, { name: 'B', value: 3 }], ...(type === 'flow' ? { nodes: [{ id: 'a', kind: 'start', label: 'Start' }, { id: 'b', kind: 'end', label: 'End' }], edges: [{ id: 'next', from: 'a', to: 'b' }], diagram: { appearance: 'soft' } } : {}) });
          try {
            const id = type === 'flow' ? 'edge-0' : 'series-0-line';
            const small = chart.model.scene.find(id).style.strokeWidth;
            host.style.width = '900px';
            chart.resize(900, 520);
            const large = chart.model.scene.find(id).style.strokeWidth;
            const xml = new DOMParser().parseFromString(chart.export({ type: 'svg' }), 'image/svg+xml');
            const png = chart.export({ type: 'png' });
            if (!images.has(type)) images.set(type, png);
            const mountedWidth = renderer === 'svg' ? Number(host.querySelector(`[id="${id}"]`).getAttribute('stroke-width')) : large;
            reports.push({ type, renderer, grows: large > small, bounded: large <= chart.getTheme().marks.lineWidth * 1.35, mounted: mountedWidth === large, exported: Number(xml.querySelector(`[id="${id}"]`).getAttribute('stroke-width')) === large, rasterParity: png === images.get(type) });
          } finally { chart.destroy(); }
        }
      }
    } finally { host.remove(); }
    return reports;
  });
  assert.equal(reports.length, 6);
  for (const report of reports) for (const key of ['grows', 'bounded', 'mounted', 'exported', 'rasterParity']) assert.equal(report[key], true, `${report.type}/${report.renderer}: ${key}`);
});

test('Iteration 33: soft diagram geometry, icons and browser delivery share both renderers and entries', async () => {
  await goto('/playground/index.html');
  const reports = await page.evaluate(async () => {
    const root = await import('/src/index.mjs'), profile = await import('/src/diagram-profile.mjs');
    const host = document.createElement('div'); document.body.append(host);
    const reports = [], images = new Map();
    for (const type of ['flow', 'architecture', 'mindmap', 'swimlane']) for (const mode of ['light', 'dark', 'contrast']) for (const [entry, api] of [['root', root], ['diagram', profile]]) for (const renderer of ['svg', 'canvas']) {
      const nodes = [{ id: 'a', label: 'Request', icon: 'user', position: { x: 30, y: 60 }, size: { width: 160, height: 72 } }, { id: 'b', label: 'Review', icon: 'shield', tone: 'secondary', position: { x: 330, y: 200 }, size: { width: 160, height: 72 } }];
      if (type === 'mindmap') nodes[1].parentId = 'a';
      if (type === 'architecture') nodes.forEach(node => { node.layerId = 'layer'; });
      if (type === 'swimlane') nodes.forEach(node => { node.lane = 'lane'; });
      const spec = { type, nodes, edges: [{ id: 'link', from: 'a', to: 'b' }], ...(type === 'architecture' ? { layers: [{ id: 'layer', label: 'Services' }] } : {}), ...(type === 'swimlane' ? { lanes: [{ id: 'lane', label: 'Team' }] } : {}), theme: { mode, palette: 'soft' }, diagram: { layout: 'manual', appearance: 'soft' }, width: 560, height: 360, renderer, branding: false };
      const chart = api.createChart({ ...spec, container: host });
      try {
        const svg = chart.export({ type: 'svg' }), xml = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const png = chart.export({ type: 'png' }), key = `${type}/${mode}`;
        if (!images.has(key)) images.set(key, png);
        const icons = [...xml.querySelectorAll('[id^="icon-"]')];
        const saved = chart.export({ type: 'json', as: 'object' });
        const restored = api.createChart(saved.spec);
        const sameSpec = JSON.stringify(restored.getSpec()) === JSON.stringify(chart.getSpec()); restored.destroy();
        reports.push({ type, mode, entry, renderer, renderable: chart.getState().health.renderable, mounted: host.querySelectorAll('svg,canvas').length === 1, xml: !xml.querySelector('parsererror'), rounded: xml.querySelector('#node-a')?.getAttribute('rx') === '10', open: xml.querySelector('#edge-0-arrow')?.getAttribute('fill') === 'none', decorative: icons.length > 0 && icons.every(icon => icon.getAttribute('aria-hidden') === 'true' && icon.getAttribute('role') === 'presentation'), parity: png === images.get(key), jpeg: chart.export({ type: 'jpeg' }).startsWith('data:image/jpeg;'), sameSpec });
      } finally { chart.destroy(); }
    }
    host.remove(); return reports;
  });
  assert.equal(reports.length, 48);
  for (const report of reports) for (const key of ['renderable', 'mounted', 'xml', 'rounded', 'open', 'decorative', 'parity', 'jpeg', 'sameSpec']) assert.equal(report[key], true, `${report.type}/${report.mode}/${report.entry}/${report.renderer}: ${key}`);
});

test('Iteration 33: Gallery preserves tall soft diagrams and Board keeps icons readable in narrow hosts', async () => {
  for (const renderer of ['svg', 'canvas']) {
    await goto(`/playground/project-gallery.html?case=flow-soft&renderer=${renderer}`);
    const host = page.locator('#chart-flow-soft');
    assert.equal(Math.round((await host.boundingBox()).height), 450);
    const state = JSON.parse(await page.locator('[data-output]').textContent());
    assert.equal(state.state.health.renderable, true);
    assert.equal(state.state.warnings.length, 0);
    await page.locator('[data-preview]').click(); await page.locator('#dialogClose').click();
    assert.equal(Math.round((await host.boundingBox()).height), 450);
    await page.locator('#size').selectOption('390');
    assert.equal(Math.round((await host.boundingBox()).height), 450);
    assert.equal(JSON.parse(await page.locator('[data-output]').textContent()).state.health.renderable, true);
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await goto(`/playground/canvas-board.html?scenario=icons&mode=dark&renderer=${renderer}`);
      const result = await page.locator('#board').evaluate(host => ({ pageFits: document.documentElement.scrollWidth <= innerWidth, scrolls: host.scrollWidth > host.clientWidth, width: host.querySelector('svg,canvas').getBoundingClientRect().width, icons: host.querySelectorAll('[id^="icon-"]').length }));
      assert.equal(result.pageFits, true); assert.equal(result.scrolls, true); assert.equal(result.width, 800);
      if (renderer === 'svg') assert.ok(result.icons >= 16);
    } finally { await page.setViewportSize({ width: 900, height: 600 }); }
  }
});

test('Gallery manual previews measure visible hosts, center content and restore card views', async () => {
  try {
    for (const renderer of ['svg', 'canvas']) {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await goto(`/playground/project-gallery.html?case=flow-soft&renderer=${renderer}`);
      const state = async selector => JSON.parse(await page.locator(selector).textContent()).state;
      const before = await state('[data-output]');
      await page.locator('[data-preview]').click();
      const inspect = async () => page.locator('#dialogChart > .chart').evaluate(host => {
        const report = JSON.parse(document.querySelector('#dialogOutput').textContent), surface = host.querySelector('svg,canvas');
        const holder = document.querySelector('#dialogChart');
        return { width: host.clientWidth, height: host.clientHeight, specWidth: report.state.width, specHeight: report.state.height, view: report.state.view, viewport: surface.getBoundingClientRect().toJSON(), host: host.getBoundingClientRect().toJSON(), holder: holder.getBoundingClientRect().toJSON(), scrolls: holder.scrollWidth > holder.clientWidth };
      });
      const enlarged = await inspect();
      assert.equal(enlarged.specWidth, enlarged.width); assert.equal(enlarged.specHeight, enlarged.height);
      assert.ok(enlarged.view.scale > 1.3);
      assert.ok(enlarged.view.offsetX > 0, 'aspect-ratio space is centered, not left aligned');
      if (renderer === 'svg' && process.env.PREVIEW_SCREENSHOT) await page.screenshot({ path: process.env.PREVIEW_SCREENSHOT });
      await page.locator('#chart-flow-soft .ichart-preferences__button').click();
      await page.locator('.ichart-preferences__panel[data-open="true"] [data-key="scale"]').selectOption('1.15');
      assert.equal((await state('#dialogOutput')).warnings.length, 2);
      assert.equal(await page.locator('[data-status]').textContent(), 'ready · 2 warnings');
      await page.locator('.ichart-preferences__panel[data-open="true"] [data-key="scale"]').selectOption('1');
      assert.equal((await state('#dialogOutput')).warnings.length, 0);
      await page.locator('#chart-flow-soft .ichart-preferences__button').click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => document.querySelector('#dialogChart').scrollWidth > document.querySelector('#dialogChart').clientWidth);
      const narrow = await inspect();
      assert.equal(narrow.specWidth, narrow.width); assert.equal(narrow.specHeight, narrow.height);
      assert.ok(narrow.view.scale >= 1, 'manual content scrolls instead of shrinking readable labels');
      assert.equal(narrow.scrolls, true); assert.ok(narrow.holder.right <= 390);
      assert.ok(narrow.viewport.right <= narrow.host.right + 1);
      await page.locator('#dialogClose').click();
      await page.setViewportSize({ width: 1400, height: 1000 });
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-output]').textContent).state.width > 500);
      const restored = await state('[data-output]');
      assert.equal(restored.height, before.height); assert.equal(restored.view, before.view);
      assert.deepEqual(restored.layout.diagram.nodes, before.layout.diagram.nodes);
      await page.locator('#size').selectOption('390');
      assert.deepEqual((await state('[data-output]')).warnings.map(warning => warning.code), ['ICON_SUPPRESSED', 'ICON_SUPPRESSED']);
      assert.match(await page.locator('[data-status]').getAttribute('title'), /ICON_SUPPRESSED/);
      await page.locator('[data-preview]').click(); await page.locator('#dialogClose').click();
      assert.deepEqual((await state('[data-output]')).warnings.map(warning => warning.code), ['ICON_SUPPRESSED', 'ICON_SUPPRESSED']);
      await page.locator('#size').selectOption('560');
      assert.equal(await page.locator('[data-status]').textContent(), 'ready');
      assert.equal((await state('[data-output]')).warnings.length, 0);
      await page.locator('#chart-flow-soft .ichart-preferences__button').click();
      await page.locator('.ichart-preferences__panel[data-open="true"] [data-key="scale"]').selectOption('1.15');
      assert.equal((await state('[data-output]')).warnings.length, 2);
      assert.equal(await page.locator('[data-status]').textContent(), 'ready · 2 warnings');
      await page.locator('.ichart-preferences__panel[data-open="true"] [data-key="scale"]').selectOption('1');
      assert.equal((await state('[data-output]')).warnings.length, 0);
      assert.equal(await page.locator('[data-status]').textContent(), 'ready');
      await page.locator('#chart-flow-soft .ichart-preferences__button').click();
    }
  } finally { await page.setViewportSize({ width: 900, height: 600 }); }
});

test('Iteration 31: host resizing, late data, failure cleanup and repeated mounting', async () => {
  await goto('/examples/consumer-browser.html');
  const entries = { root: `${baseUrl}/src/index.mjs`, standard: `${baseUrl}/src/standard.mjs`, project: `${baseUrl}/src/project-profile.mjs`, diagram: `${baseUrl}/src/diagram-profile.mjs`, board: `${baseUrl}/src/board-profile.mjs` };
  const results = await page.evaluate(verifyHostLifecycle, entries);
  assert.equal(results.length, 10);
  for (const result of results) for (const [name, passed] of Object.entries(result.checks)) assert.equal(passed, true, `${result.entry}/${result.renderer}: ${name}`);
});

test('Iteration 31: browser consumer controls keep late data and remounting host-owned', async () => {
  const errors = [], onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    for (const renderer of ['svg', 'canvas']) for (const entry of ['root', 'standard', 'project', 'diagram', 'board']) {
      await goto(`/examples/consumer-browser.html?entry=${entry}&renderer=${renderer}`);
      await page.waitForFunction(() => Boolean(window.consumerChart));
      await page.locator('#race').click();
      await page.waitForFunction(() => window.hostDemo.revision === 2);
      await page.evaluate(async () => { const late = window.hostDemo.load(9, 60); await window.hostDemo.mount(); await late; });
      assert.equal(await page.evaluate(() => window.hostDemo.revision), 2);
      assert.equal(await page.locator('#chart svg,#chart canvas').count(), 1);
      await page.locator('#size').click();
      await page.waitForFunction(entry => entry === 'diagram' ? window.consumerChart.getSpec().width === 560 : window.consumerChart.getSpec().width < 400, entry);
      await page.locator('#visibility').click();
      assert.equal(await page.locator('#chart-wrap').isHidden(), true);
      await page.locator('#size').click(); await page.locator('#visibility').click();
      await page.waitForFunction(() => window.consumerChart.getSpec().width > 400);
      await page.locator('#theme').click(); await page.locator('#reject').click();
      assert.match(await page.locator('#status').textContent(), /Spec unchanged/);
      assert.equal(await page.evaluate(() => window.consumerChart.getSpec().background), '#0f172a');
      assert.equal(await page.locator('#png').isDisabled(), false);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await goto('/examples/consumer-browser.html?entry=diagram');
    await page.waitForFunction(() => Boolean(window.consumerChart));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.evaluate(() => document.querySelector('#chart-wrap').scrollWidth > document.querySelector('#chart-wrap').clientWidth), true);
    await page.locator('#chart-wrap').evaluate(element => { element.scrollLeft = element.scrollWidth; });
    assert.equal(await page.locator('#chart svg').evaluate(element => [...element.querySelectorAll('text')].some(node => node.textContent === 'Done')), true);
    assert.deepEqual(errors, []);
  } finally { page.off('pageerror', onError); await page.setViewportSize({ width: 900, height: 600 }); }
});

test('Iteration 31: multi-chart presentation timing and lifecycle residue remain inspectable', async () => {
  await goto('/playground/performance-lab.html');
  await page.locator('#status.ready').waitFor();
  await page.locator('#kind').selectOption('dashboard');
  for (const renderer of ['svg', 'canvas']) {
    await page.locator('#renderer').selectOption(renderer); await page.locator('#run').click();
    await page.locator('#status.ready').waitFor();
    const result = await page.evaluate(() => window.performanceResult);
    assert.equal(result.chartCount, 3);
    assert.deepEqual(result.actualCounts, [100, 100, 100]);
    assert.deepEqual(result.effectiveRenderers, [renderer, renderer, renderer]);
    assert.equal(await page.locator('#chart svg,#chart canvas').count(), 3);
    for (const value of result.measurements.filter(value => value.presentationOpportunityMs !== undefined)) assert.ok(value.presentationOpportunityMs >= value.durationMs);
    assert.ok(['svg-export', 'png-export', 'json-export'].every(label => result.measurements.some(value => value.label === label && value.bytes > 0)));
    await page.locator('#lifecycle').click(); await page.locator('#status.ready').waitFor();
    assert.deepEqual(await page.evaluate(() => ({ cycles: window.performanceResult.lifecycleCycles, maximum: window.performanceResult.maximumRemainingChildren, remaining: window.performanceResult.remainingChildren })), { cycles: 25, maximum: 0, remaining: 0 });
  }
});

test('Iteration 31: actual bilingual frontend lifecycle snippets reject stale data and clean up', async () => {
  const snippets = readDocumentSnippets();
  await goto('/playground/index.html');
  for (const file of ['docs/agent/frontend-integration.md', 'docs/agent/zh-CN/frontend-integration.md']) for (const id of ['frontend-chart', 'host-lifecycle']) {
    const source = snippets[`${file}:${id}`].code;
    const result = await page.evaluate(async ({ source, id }) => {
      document.body.innerHTML = '<div id="chart" style="width:520px;height:320px"></div>';
      const rows = [{ id: 'a', category: 'A', value: 2, month: 'Jan', revenue: 2 }, { id: 'b', category: 'B', value: 4, month: 'Feb', revenue: 4 }];
      const code = `const rows = ${JSON.stringify(rows)};\n${source}\nexport { chart${id === 'host-lifecycle' ? ',refreshRows,dispose' : ''} };`.replaceAll("'@taylorwong/ichartjs/standard'", `'${location.origin}/src/standard.mjs'`).replaceAll("'@taylorwong/ichartjs'", `'${location.origin}/src/index.mjs'`);
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      let module;
      try {
        module = await import(url);
        if (id === 'host-lifecycle') {
          let resolveOld;
          const late = module.refreshRows(() => new Promise(resolve => { resolveOld = resolve; }));
          await module.refreshRows(() => Promise.resolve(rows)); resolveOld([{ id: 'stale', month: 'Old', revenue: 1 }]); await late;
        }
        const result = { renderable: module.chart.getState().health.renderable, ids: module.chart.explain().lineage.recordIds, mounted: Boolean(document.querySelector('#chart svg,#chart canvas')) };
        if (id === 'host-lifecycle') module.dispose(); else module.chart.destroy();
        return { ...result, remaining: document.querySelector('#chart').childElementCount };
      } finally { if (module?.dispose) module.dispose(); else module?.chart.destroy(); URL.revokeObjectURL(url); }
    }, { source, id });
    assert.deepEqual(result, { renderable: true, ids: ['a', 'b'], mounted: true, remaining: 0 }, `${file}:${id}`);
  }
});

test('Iteration 30: mounted updates, rejection recovery, renderer replacement and Profile controls', async () => {
  await goto('/playground/profile-loading.html');
  await page.locator('#chart-board svg').waitFor({ state: 'attached' });
  for (const name of ['standard', 'project', 'diagram', 'board']) {
    const card = page.locator('.profile-card').filter({ has: page.locator(`#chart-${name}`) });
    await card.locator('[data-renderer]').selectOption('canvas');
    await page.locator(`#chart-${name} canvas`).waitFor({ state: 'attached' });
    await card.locator('[data-reject]').click();
    const rejected = JSON.parse(await card.locator('[data-output]').textContent());
    assert.equal(rejected.rejection.unchanged, true);
    assert.ok(rejected.rejection.codes.length);
    await card.locator('[data-theme]').click();
    const styled = JSON.parse(await card.locator('[data-output]').textContent());
    assert.equal(styled.background, '#0f172a');
    if (name === 'board') assert.equal(await card.evaluate(element => element._instance.getSpec().items.find(item => item.id === 'title').style.fill), '#f8fafc');
    assert.equal(await page.locator(`#chart-${name} canvas`).evaluate(surface => surface.style.background), 'rgb(15, 23, 42)');
    await card.locator('[data-renderer]').selectOption('svg');
    assert.equal(await page.locator(`#chart-${name} svg, #chart-${name} canvas`).count(), 1);
  }
  const result = await page.evaluate(async () => {
    const root = await import('/src/index.mjs'), standard = await import('/src/standard.mjs'), project = await import('/src/project-profile.mjs'), diagram = await import('/src/diagram-profile.mjs'), board = await import('/src/board-profile.mjs');
    const { CanvasRenderer } = await import('/src/renderer.mjs');
    const host = document.createElement('div'); host.id = 'update-acceptance'; document.body.append(host);
    const reports = [];
    const line = { type: 'line', data: [{ id: 'a', name: 'A', value: 1 }, { id: 'b', name: 'B', value: 2 }] };
    const boardSpec = { items: [{ id: 'box', kind: 'shape', position: { x: 20, y: 20 }, size: { width: 80, height: 40 }, style: { fill: '#2563eb' } }] };
    for (const [name, factory, spec] of [['root', root.createChart, line], ['standard', standard.createChart, line], ['project', project.createChart, { type: 'gantt', data: [{ id: 'p', name: 'Plan', start: '2026-01-01', end: '2026-01-03' }] }], ['diagram', diagram.createChart, { type: 'flow', nodes: [{ id: 'a', label: 'A' }] }], ['root Board', spec => root.createBoard(spec).mount('#update-acceptance'), boardSpec], ['board Profile', spec => board.createBoard(spec).mount('#update-acceptance'), boardSpec]]) {
      const chart = factory({ ...spec, container: '#update-acceptance', renderer: 'svg', theme: 'light', width: 500, height: 260, interaction: { tooltip: false } });
      const before = JSON.stringify({ spec: chart.getSpec(), state: chart.getState() }), surface = chart.renderer.svg;
      const render = CanvasRenderer.prototype.render;
      CanvasRenderer.prototype.render = () => { throw new Error('injected rendering failure'); };
      let rejected;
      try { chart.update({ renderer: 'canvas', background: '#abcdef', theme: 'dark' }); } catch (error) { rejected = error.message; }
      finally { CanvasRenderer.prototype.render = render; }
      const unchanged = before === JSON.stringify({ spec: chart.getSpec(), state: chart.getState() });
      const restored = chart.renderer.svg === surface && surface.isConnected && host.querySelectorAll('svg,canvas').length === 1;
      let clicks = 0;
      chart.on?.('click', () => { clicks += 1; });
      for (const renderer of ['canvas', 'svg', 'canvas']) chart.update({ renderer });
      surface.dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 100 }));
      if (chart.setTheme) chart.setTheme({ mode: 'dark' }); else chart.update({ background: '#0f172a' });
      if (chart.resize) chart.resize(620, 300); else chart.update({ width: 620, height: 300 });
      const png = chart.export({ type: 'png' }), exported = chart.export({ type: 'json', as: 'object' }), saved = exported.spec ? exported : { spec: exported };
      reports.push({ name, rejected, unchanged, restored, staleClicks: clicks, surfaces: host.querySelectorAll('svg,canvas').length, background: chart.getSpec().background, png: typeof png === 'string' && png.startsWith('data:image/png'), width: saved.spec.width, height: saved.spec.height });
      chart.destroy(); host.replaceChildren();
    }
    host.remove(); return reports;
  });
  for (const report of result) {
    assert.equal(report.rejected, 'injected rendering failure', report.name);
    assert.equal(report.unchanged, true, report.name);
    assert.equal(report.restored, true, report.name);
    assert.equal(report.staleClicks, 0, report.name);
    assert.equal(report.surfaces, 1, report.name);
    assert.equal(report.background, '#0f172a', report.name);
    assert.equal(report.png, true, report.name);
    assert.equal(report.width, 620, report.name);
    assert.equal(report.height, 300, report.name);
  }
});

test('Iteration 30: mounted Canvas lifecycle latency remains within local smoke budgets', async context => {
  await goto('/examples/consumer-browser.html');
  const results = await page.evaluate(measureMountedLifecycle);
  context.diagnostic(JSON.stringify({ policy: 'Chrome synchronous lifecycle; warmup plus three-run median', results }));
  for (const result of results) for (const key of ['create', 'update', 'resize', 'theme']) {
    assert.ok(result[key] < 5000, `${result.count} ${key}: ${result[key]}ms`);
  }
});

test('Iteration 30: auto threshold updates keep a single mounted surface and current exports', async () => {
  await goto('/examples/consumer-browser.html');
  const result = await page.evaluate(async () => {
    const { createChart } = await import('/src/standard.mjs');
    const host = document.createElement('div'); host.id = 'auto-acceptance'; document.body.append(host);
    const rows = count => Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `P${index}`, value: index % 100 }));
    const chart = createChart({ type: 'line', renderer: 'auto', container: '#auto-acceptance', data: rows(2) });
    const records = [];
    for (const count of [401, 400, 401, 2]) {
      chart.update({ data: rows(count) });
      records.push({ count, actual: (chart.renderer.svg || chart.renderer.canvas).tagName.toLowerCase(), state: chart.getState().renderer, surfaces: host.querySelectorAll('svg,canvas').length, ids: chart.getState().lineage.recordIds.length });
    }
    const saved = JSON.parse(chart.export({ type: 'json' }));
    chart.destroy(); host.replaceChildren();
    const restored = createChart(saved.spec);
    const reload = { ids: restored.getState().lineage.recordIds, svg: restored.export({ type: 'svg' }).includes('<svg') };
    restored.destroy(); host.remove(); return { records, reload };
  });
  for (const record of result.records) {
    assert.equal(record.actual, record.count > 400 ? 'canvas' : 'svg');
    assert.equal(record.actual, record.state);
    assert.equal(record.surfaces, 1);
    assert.equal(record.ids, record.count);
  }
  assert.deepEqual(result.reload.ids, ['p0', 'p1']);
  assert.equal(result.reload.svg, true);
});

for (const renderer of ['svg', 'canvas']) for (const scenario of [
  { kind: 'flow', page: 'diagram-editor', surface: '#chart', state: '#output', counts: [1, 2, 3, 5], restore: '#reset' },
  { kind: 'board', page: 'canvas-board', surface: '#board', state: '#state', counts: [7, 10, 20, 29], restore: '#render' }
]) {
  test(`Simple construction ${scenario.kind} ${renderer}: next, previous, restart and developer isolation`, async () => {
    const errors = [], onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    try {
      await goto(`/playground/${scenario.page}.html?renderer=${renderer}&lang=en`);
      const panel = page.locator('#simple-construction'), next = page.locator('#simple-next');
      await page.locator('#simple-status[data-phase=ready]').waitFor();
      const state = async () => { const value = JSON.parse(await page.locator(scenario.state).textContent()); return value.state || value; };
      const count = value => scenario.kind === 'flow' ? Object.keys(value.layout.diagram.nodes).length : value.itemCount;
      assert.equal(count(await state()), 0);
      assert.equal(await page.locator('#developer-tools').getAttribute('open'), null);
      assert.equal(await panel.locator('button:visible').count(), 3);
      assert.equal(await page.locator('#simple-back').isDisabled(), true);
      await page.locator(`${scenario.surface} ${renderer}`).waitFor();
      for (const [index, expected] of scenario.counts.entries()) {
        await next.click();
        await page.locator('#simple-status[data-phase=ready]').waitFor();
        assert.equal(await panel.getAttribute('data-step'), String(index + 1));
        assert.equal(count(await state()), expected);
        assert.equal((await state()).history.undo, index + 1);
        if (index === 0 && scenario.kind === 'flow') {
          await page.setViewportSize({ width: 980, height: 600 });
          await page.locator('#chart svg, #chart canvas').evaluate(node => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        }
      }
      assert.equal(await next.isDisabled(), true);
      assert.match(await page.locator('#simple-prompt').textContent(), /Example complete/);
      if (scenario.kind === 'board') {
        const ids = (await state()).layout.items.map(item => item.id);
        for (const id of ['line', 'bar', 'area', 'logo-red', 'logo-blue', 'logo-yellow', 'animal-body', 'eye-left', 'eye-right', 'arc-demo', 'sector-demo', 'curve-demo']) assert.ok(ids.includes(id), id);
        assert.equal((await state()).width, 1280);
        assert.equal((await state()).height, 720);
      }
      await page.screenshot({ path: `/tmp/ichart-simple-${scenario.kind}-${renderer}.png`, fullPage: true });
      const final = (await state()).layout;
      await page.locator('#simple-back').click();
      await page.locator('#simple-status[data-phase=ready]').waitFor();
      assert.equal(await panel.getAttribute('data-step'), '3');
      assert.equal(count(await state()), scenario.counts[2]);
      await next.click();
      await page.locator('#simple-status[data-phase=ready]').waitFor();
      assert.deepEqual((await state()).layout, final);
      await page.locator('#simple-restart').click();
      await page.locator('#simple-status[data-phase=ready]').waitFor();
      assert.equal(count(await state()), 0);
      assert.equal((await state()).history.undo, 0);
      await page.locator('#developer-tools > summary').click();
      await page.locator(scenario.restore).click();
      assert.equal(await panel.getAttribute('data-changed'), 'true');
      assert.equal(await next.isDisabled(), true);
      assert.equal(await page.locator('#simple-back').isDisabled(), true);
      await page.locator('#simple-restart').click();
      await page.locator('#simple-status[data-phase=ready]').waitFor();
      assert.equal(await panel.getAttribute('data-changed'), 'false');
      assert.equal(count(await state()), 0);
      await next.click();
      await page.locator('#simple-status[data-phase=ready]').waitFor();
      assert.equal(count(await state()), scenario.counts[0]);
      assert.deepEqual(errors, []);
    } finally { page.off('pageerror', onError); await page.setViewportSize({ width: 900, height: 600 }); }
  });
}

test('Simple construction: localized instructions, narrow layouts and intermediate diagnostics', async () => {
  try {
    for (const width of [390, 768]) for (const name of ['diagram-editor', 'canvas-board']) {
      await page.setViewportSize({ width, height: 860 });
      await goto(`/playground/${name}.html?lang=zh-CN`);
      await page.locator('#simple-status[data-phase=ready]').waitFor();
      assert.match(await page.locator('#simple-next').textContent(), /下一步/);
      await page.locator('#simple-next').click();
      await page.locator('#simple-status[data-phase=ready]').waitFor();
      if (name === 'diagram-editor') assert.match(await page.locator('#simple-status').textContent(), /诊断/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: `/tmp/ichart-simple-${name}-${width}.png`, fullPage: true });
    }
    await goto('/playground/diagram-editor.html?scenario=incremental&lang=fr');
    await page.locator('#simple-status[data-phase=ready]').waitFor();
    assert.match(await page.locator('#simple-next').textContent(), /Next:/);
    assert.equal(await page.locator('#developer-tools').getAttribute('open'), null);
  } finally { await page.setViewportSize({ width: 900, height: 600 }); }
});

for (const renderer of ['svg', 'canvas']) {
  test(`Text and annotations ${renderer}: readable fitting, data anchors and JSON reload`, async () => {
    const errors = [], onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    try {
      await goto('/playground/accessibility-lab.html');
      await page.locator('#renderer').selectOption(renderer);
      await page.locator('#text-output').waitFor({ state: 'attached' });
      const initial = JSON.parse(await page.locator('#text-output').textContent());
      assert.equal(initial.chartWarnings.length, 0);
      assert.equal(initial.boardWarnings.length, 0);
      assert.equal(initial.boardText[0].lines, 2);
      assert.equal(initial.boardText[1].scaled, true);
      const boardAspect = await page.locator('#text-board svg, #text-board canvas').evaluate(node => { const box = node.getBoundingClientRect(); return box.width / box.height; });
      assert.ok(Math.abs(boardAspect - 560 / 260) < .05);
      await page.locator('#text-update').click();
      const changed = JSON.parse(await page.locator('#text-output').textContent());
      assert.notDeepEqual(changed.annotations[1].anchor, initial.annotations[1].anchor);
      await page.locator('#text-reload').click();
      assert.deepEqual(JSON.parse(await page.locator('#text-output').textContent()).annotations, changed.annotations);
      await page.locator('#text-acceptance').screenshot({ path: `/tmp/ichart-text-annotations-${renderer}.png` });
      const evidence = await page.evaluate(async effectiveRenderer => {
        const root = await import('/src/index.mjs'), standard = await import('/src/standard.mjs');
        await document.fonts.ready;
        const host = document.createElement('div'); host.id = 'font-acceptance'; document.body.appendChild(host);
        const results = [];
        for (const factory of [root.createChart, standard.createChart]) {
          const chart = factory({ type: 'line', renderer: effectiveRenderer, container: '#font-acceptance', width: 320, height: 240, legend: { visible: false }, labels: { enabled: true, font: '72px monospace' }, data: [{ id: 'a', name: 'A', value: 1000 }, { id: 'b', name: 'B', value: 1001 }] });
          const exported = document.createElement('div'); exported.innerHTML = chart.export({ type: 'svg' }); document.body.appendChild(exported);
          const labels = [...exported.querySelectorAll('text')].filter(node => /^1,?00[01]$/.test(node.textContent)).map(node => ({ text: node.textContent, font: node.style.fontSize || node.getAttribute('font-size'), box: { x: node.getBBox().x, y: node.getBBox().y, width: node.getBBox().width, height: node.getBBox().height } }));
          const overlap = labels.length === 2 && labels[0].box.x < labels[1].box.x + labels[1].box.width && labels[0].box.x + labels[0].box.width > labels[1].box.x && labels[0].box.y < labels[1].box.y + labels[1].box.height && labels[0].box.y + labels[0].box.height > labels[1].box.y;
          results.push({ labels, overlap, warnings: chart.getState().warnings });
          exported.remove(); chart.destroy(); host.replaceChildren();
        }
        const board = root.createBoard({ renderer: effectiveRenderer, width: 400, height: 160, items: [{ id: 'note', kind: 'text', text: 'Hi', position: { x: 16, y: 16 }, size: { width: 300, height: 16 }, style: { font: '80px monospace' }, wrap: false }] }).mount('#font-acceptance');
        const exported = document.createElement('div'); exported.innerHTML = board.export({ type: 'svg' }); document.body.appendChild(exported);
        const boardHeight = exported.querySelector('text').getBBox().height;
        const boardWarnings = board.explain().warnings;
        exported.remove(); board.destroy(); host.remove();
        const annotationHost = document.createElement('div'); annotationHost.id = 'annotation-export'; document.body.appendChild(annotationHost);
        const annotated = root.createChart({ type: 'line', renderer: effectiveRenderer, container: '#annotation-export', width: 420, height: 280, data: [{ id: 'a', name: 'A', value: 30 }, { id: 'b', name: 'B', value: 50 }], annotations: [{ id: 'target', type: 'reference-line', axis: 'y', value: 40, text: 'Target' }, { id: 'note', type: 'callout', recordId: 'b', text: 'Observation' }] });
        const annotationSvg = annotated.export({ type: 'svg' }), png = annotated.export({ type: 'png' }), saved = annotated.export({ type: 'json', as: 'object' });
        annotated.destroy(); annotationHost.replaceChildren();
        const restored = root.createChart(saved.spec);
        const stable = JSON.stringify(restored.getState().layout.annotations) === JSON.stringify(saved.state.layout.annotations);
        restored.destroy(); annotationHost.remove();
        return { results, boardHeight, boardWarnings, annotationSvg, png: typeof png === 'string' && png.startsWith('data:image/png'), stable };
      }, renderer);
      for (const result of evidence.results) {
        assert.equal(result.overlap, false);
        assert.ok(result.labels.length > 0 || result.warnings.some(item => item.code === 'LABELS_SUPPRESSED'));
        for (const label of result.labels) assert.equal(label.font, '72px');
      }
      assert.ok(evidence.boardHeight <= 16);
      assert.equal(evidence.boardWarnings.length, 0);
      assert.match(evidence.annotationSvg, /annotation-target/);
      assert.match(evidence.annotationSvg, /annotation-note-text/);
      assert.equal(evidence.png, true);
      assert.equal(evidence.stable, true);
      assert.deepEqual(errors, []);
    } finally { page.off('pageerror', onError); }
  });
}

for (const renderer of ['svg', 'canvas']) {
  for (const scenario of [
    { name: 'Flow', page: 'diagram-editor', prefix: 'builder', state: '#output', output: '#builder-output', undo: '#undo', redo: '#redo' },
    { name: 'Board', page: 'canvas-board', prefix: 'board', state: '#state', output: '#board-builder-output', undo: '#board-undo', redo: '#board-redo' }
  ]) {
    test(`Incremental construction ${scenario.name} ${renderer}: cancellation, stale UI, rejected input and review`, async () => {
      const errors = [], onError = error => errors.push(error.message);
      page.on('pageerror', onError);
      try {
        await goto(`/playground/${scenario.page}.html?scenario=advanced&renderer=${renderer}`);
        const control = suffix => page.locator(`#${scenario.prefix}-${suffix}`);
        await control('template').locator('option').nth(4).waitFor({ state: 'attached' });
        const readState = async () => { const payload = JSON.parse(await page.locator(scenario.state).textContent()); return payload.state || payload; };
        await control('start').click();
        const initial = await readState();
        await control('preview-command').click();
        assert.equal(await control('construction-status').getAttribute('data-phase'), 'preview');
        assert.match(await control('construction-summary').textContent(), /Affected IDs:/);
        await control('construction-status').locator('..').screenshot({ path: `/tmp/ichart-construction-${scenario.name.toLowerCase()}-${renderer}.png` });
        await control('cancel').click();
        assert.equal(await control('apply').isDisabled(), true);
        assert.equal(await control('cancel').isDisabled(), true);
        assert.equal(await control('construction-status').getAttribute('data-phase'), 'cancelled');
        assert.deepEqual(await readState(), initial);
        await control('preview-command').click();
        await control('apply').click();
        await control('construction-status').filter({ hasText: 'Committed:' }).waitFor();
        assert.equal(await control('construction-status').getAttribute('data-phase'), 'committed');
        const committed = await readState();
        assert.equal(committed.history.undo, 1);
        await control('preview-command').click();
        await page.locator(scenario.undo).click();
        assert.equal(await control('apply').isDisabled(), true);
        assert.equal(await control('construction-status').getAttribute('data-phase'), 'changed');
        await page.locator(scenario.redo).click();
        assert.deepEqual((await readState()).layout, committed.layout);
        await control('command').fill('{');
        await control('preview-command').click();
        assert.equal(await control('construction-status').getAttribute('data-phase'), 'rejected');
        assert.equal(await control('apply').isDisabled(), true);
        const beforeReview = await readState();
        await control('review').click();
        await control('construction-status').filter({ hasText: 'Delivery review;' }).waitFor();
        const review = JSON.parse(await page.locator(scenario.output).textContent());
        assert.equal(review.kind, 'delivery-review');
        assert.equal(review.revision, beforeReview.revision);
        assert.equal(review.taskAcceptance, 'host-review-required');
        assert.ok(review.recordIds.length > 1);
        assert.deepEqual((await readState()).history, beforeReview.history);
        assert.deepEqual((await readState()).layout, beforeReview.layout);
        assert.deepEqual(errors, []);
      } finally { page.off('pageerror', onError); }
    });
  }
}

for (const renderer of ['svg', 'canvas']) {
  test(`Iteration 27 ${renderer}: visible Board turns, confirmed previews, history and reload`, async () => {
    const errors = [], onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    try {
      await goto(`/playground/canvas-board.html?scenario=advanced&renderer=${renderer}`);
      await page.locator('#board-template option').nth(4).waitFor({ state: 'attached' });
      await page.locator('#board-start').click();
      const state = async () => JSON.parse(await page.locator('#state').textContent());
      await page.locator(`#board ${renderer}`).waitFor();
      assert.equal((await state()).itemCount, 1);
      for (let index = 0; index < 5; index += 1) {
        const before = await state();
        await page.locator('#board-preview-command').click();
        await page.locator(`#board-preview ${renderer}`).waitFor();
        assert.equal(JSON.parse(await page.locator('#board-builder-output').textContent()).valid, true);
        assert.deepEqual((await state()).layout, before.layout);
        assert.equal((await state()).revision, before.revision);
        assert.equal(await page.locator('#board-apply').isDisabled(), false);
        await page.locator('#board-apply').click();
        const after = await state();
        assert.equal(after.history.undo, index + 1);
        assert.equal(after.revision, index + 1);
        assert.equal(after.layout.items[0].x, 48);
        assert.equal(after.renderer, renderer);
      }
      const final = await state();
      assert.equal(final.itemCount, 7);
      await page.locator('#board-undo').click();
      assert.notDeepEqual((await state()).layout, final.layout);
      await page.locator('#board-redo').click();
      assert.deepEqual((await state()).layout, final.layout);
      await page.locator('#board-save').click();
      await page.locator('#board-reload').click();
      assert.deepEqual((await state()).layout, final.layout);
      assert.equal((await state()).history.undo, 0);
      await page.locator('#board-command').fill(JSON.stringify({ type: 'board-edit', operations: [{ op: 'addItem', item: { id: 'invalid', kind: 'shape', position: { x: 0, y: 0 }, size: { width: 3, height: 30 } } }] }));
      await page.locator('#board-preview-command').click();
      assert.equal(JSON.parse(await page.locator('#board-builder-output').textContent()).valid, false);
      assert.equal(await page.locator('#board-apply').isDisabled(), true);
      assert.deepEqual((await state()).layout, final.layout);
      assert.deepEqual(errors, []);
      await page.locator('#board').screenshot({ path: `/tmp/ichart-27-${renderer}.png` });
    } finally { page.off('pageerror', onError); }
  });
}

for (const renderer of ['svg', 'canvas']) {
  test(`Iteration 27 ${renderer}: incremental image source, raster pixels and history`, async () => {
    await goto('/playground/canvas-board.html?scenario=composition');
    const report = await page.evaluate(async renderer => {
      const { createBoard } = await import('/src/board-profile.mjs');
      const container = document.createElement('div'); document.body.append(container);
      const imageSource = color => { const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 16, 16); return canvas.toDataURL(); };
      const red = imageSource('#ef4444'), blue = imageSource('#2563eb');
      const board = createBoard({ width: 128, height: 96, renderer, editing: { enabled: true, allowStructuralChanges: true } }).mount(container);
      const apply = operations => { const preview = board.previewEdit({ type: 'board-edit', operations }); const result = board.applyEdit(preview.command, { preview, confirmed: true }); if (!result.valid) throw new Error(JSON.stringify(result.errors)); };
      const sample = () => renderer === 'canvas' ? Array.from(board.renderer.ctx.getImageData(35, 35, 1, 1).data) : null;
      try {
        apply([{ op: 'addAsset', asset: { id: 'pixel', type: 'image', src: red, alt: 'Red pixel' } }, { op: 'addItem', item: { id: 'picture', kind: 'image', assetId: 'pixel', position: { x: 20, y: 20 }, size: { width: 40, height: 40 } } }]);
        await board.ready(); const first = { status: board.getState().assets[0].status, sample: sample() };
        apply([{ op: 'updateAsset', assetId: 'pixel', changes: { src: blue, alt: 'Blue pixel' } }]);
        const oldImageCleared = !board.scene.find('picture').geometry.image;
        await board.ready(); const second = { status: board.getState().assets[0].status, sample: sample() };
        const svg = board.export({ type: 'svg' }), raster = renderer === 'canvas' ? board.export({ type: 'png' }) : null;
        board.undo(); await board.ready(); const undo = { status: board.getState().assets[0].status, sample: sample() };
        apply([{ op: 'removeAsset', assetId: 'pixel', policy: 'cascade' }]);
        return { first, second, undo, oldImageCleared, svgMatches: svg.includes(blue), raster, final: board.getState() };
      } finally { board.destroy(); container.remove(); }
    }, renderer);
    assert.equal(report.first.status, 'loaded');
    assert.equal(report.second.status, 'loaded');
    assert.equal(report.undo.status, 'loaded');
    assert.equal(report.oldImageCleared, true);
    assert.equal(report.svgMatches, true);
    if (renderer === 'canvas') {
      assert.deepEqual(report.first.sample, [239, 68, 68, 255]);
      assert.deepEqual(report.second.sample, [37, 99, 235, 255]);
      assert.deepEqual(report.undo.sample, report.first.sample);
      assert.match(report.raster, /^data:image\/png/);
    }
    assert.equal(report.final.itemCount, 0);
    assert.equal(report.final.assets.length, 0);
  });
}

test('Iteration 27 mounted auto Board changes renderer and restores SVG through history', async () => {
  const report = await page.evaluate(async () => {
    const { createBoard } = await import('/src/board-profile.mjs');
    const container = document.createElement('div'); document.body.append(container);
    const board = createBoard({ width: 160, height: 120, renderer: 'auto' }).mount(container);
    const snapshots = [];
    const capture = () => snapshots.push({ renderer: board.getState().renderer, svg: Boolean(container.querySelector('svg')), canvas: Boolean(container.querySelector('canvas')) });
    try {
      capture();
      board.update({ items: Array.from({ length: 401 }, (_, index) => ({ id: `item-${index}`, kind: 'shape', position: { x: 0, y: 0 }, size: { width: 16, height: 16 } })) });
      capture(); board.undo(); capture(); board.redo(); capture();
      return snapshots;
    } finally { board.destroy(); container.remove(); }
  });
  assert.deepEqual(report, [{ renderer: 'svg', svg: true, canvas: false }, { renderer: 'canvas', svg: false, canvas: true }, { renderer: 'svg', svg: true, canvas: false }, { renderer: 'canvas', svg: false, canvas: true }]);
});

for (const renderer of ['svg', 'canvas']) {
  test(`Iteration 26 ${renderer}: multi-turn Flow visual preview, atomic commit, and delivery`, async () => {
    await goto(`/playground/diagram-editor.html?scenario=advanced&renderer=${renderer}`);
    await page.locator('#builder-template option').nth(4).waitFor({ state: 'attached' });
    await page.locator('#builder-start').click();
    const state = async () => JSON.parse(await page.locator('#output').textContent()).state;
    const mounted = () => page.locator(`#chart ${renderer}`);
    await mounted().waitFor();
    assert.equal(Object.keys((await state()).layout.diagram.nodes).length, 1);
    for (let index = 0; index < 5; index += 1) {
      const before = await state();
      await page.locator('#builder-preview-command').click();
      await page.locator(`#builder-preview ${renderer}`).waitFor();
      const preview = JSON.parse(await page.locator('#builder-output').textContent());
      assert.equal(preview.valid, true);
      assert.deepEqual((await state()).layout.diagram, before.layout.diagram);
      assert.equal((await state()).revision, before.revision);
      assert.equal(await page.locator('#builder-apply').isDisabled(), false);
      await page.locator('#builder-apply').click();
      const after = await state();
      assert.deepEqual(after.layout.diagram, preview.layout);
      assert.equal(after.history.undo, index + 1);
      assert.ok(after.edgeRoutes.every(route => route.visible));
      assert.equal(after.warnings.some(warning => ['FLOW_LAYOUT_OVERFLOW', 'FLOW_NODE_OVERLAP', 'EDGE_ROUTE_BLOCKED'].includes(warning.code)), false);
      assert.equal(await page.locator('#builder-apply').isDisabled(), true);
      await page.locator('#undo').click();
      assert.deepEqual((await state()).layout.diagram, before.layout.diagram);
      await page.locator('#redo').click();
      assert.deepEqual((await state()).layout.diagram, after.layout.diagram);
    }
    const completed = await state();
    await page.locator('#builder-review').click();
    await page.locator('#builder-construction-status').filter({ hasText: 'Delivery review;' }).waitFor();
    const deliveryReview = JSON.parse(await page.locator('#builder-output').textContent());
    assert.equal(deliveryReview.taskAcceptance, 'host-review-required');
    assert.ok(deliveryReview.warnings.some(warning => warning.code === 'FLOW_DECISION_BRANCHES'));
    assert.match(await page.locator('#builder-construction-summary').textContent(), /FLOW_DECISION_BRANCHES/);
    const downloading = page.waitForEvent('download');
    await page.locator('#save-spec').click();
    const saved = JSON.parse(await readFile(await (await downloading).path(), 'utf8'));
    assert.equal(saved.nodes.find(node => node.id === 'review').label, 'Security review');
    assert.equal(saved.nodes.some(node => node.id === 'retry'), false);
    await page.locator('#spec-text').fill(JSON.stringify(saved));
    await page.locator('#load-spec').click();
    assert.match(await page.locator('#status').textContent(), /Spec reloaded/);
    assert.deepEqual((await state()).layout.diagram, completed.layout.diagram);
    assert.equal((await state()).history.undo, 0);
    const exported = page.waitForEvent('download');
    await page.locator('#export-svg').click();
    const svg = await readFile(await (await exported).path(), 'utf8');
    assert.match(svg, /Security review/);
    assert.equal(svg.includes('edge-handle-'), false);
    const before = await state();
    await page.locator('#builder-command').fill(JSON.stringify({ type: 'layout-edit', operations: [{ op: 'addNode', node: { id: 'start', label: 'Duplicate' } }] }));
    await page.locator('#builder-preview-command').click();
    assert.equal(JSON.parse(await page.locator('#builder-output').textContent()).valid, false);
    assert.deepEqual((await state()).layout.diagram, before.layout.diagram);
    assert.equal((await state()).revision, before.revision);
  });
}

for (const renderer of ['svg', 'canvas']) {
  test(`Diagram Editor ${renderer}: port snapping survives real pointer release and reload`, async () => {
    await goto(`/playground/diagram-editor.html?scenario=editor&renderer=${renderer}`);
    await page.locator('#middle').waitFor();
    assert.equal(await page.locator('#center').textContent(), 'Align X Centers');
    await page.locator('#select').click();
    await page.locator('#middle').click();
    let output = JSON.parse(await page.locator('#output').textContent());
    const aligned = output.selectedData;
    assert.equal(aligned.length, 2);
    assert.equal(aligned[0].position.y + aligned[0].size.height / 2, aligned[1].position.y + aligned[1].size.height / 2);
    for (const kind of ['process', 'decision']) {
      const spec = {
        type: 'flow', width: 1000, height: 700, renderer,
        nodes: [
          { id: 'qa', label: 'QA', position: { x: 40, y: 224 }, size: { width: 120, height: 44 }, ports: [{ id: 'out', side: 'right' }] },
          { id: 'done', label: 'Done', kind, position: { x: 360, y: 320 }, size: { width: 112, height: 36 }, ports: [{ id: 'in', side: 'left' }] }
        ],
        edges: [{ id: 'release', from: 'qa', to: 'done', fromPort: 'out', toPort: 'in' }],
        view: { scale: 1.25, offsetX: 12, offsetY: 8 },
        diagram: { layout: 'manual', routing: 'auto', grid: 8 },
        interaction: { drag: true }, editing: { enabled: true, requireConfirmation: false }
      };
      const reload = async value => {
        await page.locator('#spec-text').fill(JSON.stringify(value));
        await page.locator('#load-spec').click();
        assert.match(await page.locator('#status').textContent(), /Spec reloaded/);
      };
      const save = async () => {
        const downloading = page.waitForEvent('download');
        await page.locator('#save-spec').click();
        const download = await downloading;
        return JSON.parse(await readFile(await download.path(), 'utf8'));
      };
      await reload(spec);
      const mountedSpec = await save();
      const surface = page.locator('#chart svg, #chart canvas');
      await surface.evaluate((element, spec) => {
        document.querySelector('#port-test-sizing')?.remove();
        const style = document.createElement('style');
        style.id = 'port-test-sizing';
        style.textContent = `.port-test-surface { width: ${spec.width * 0.6}px !important; height: ${spec.height * 0.6}px !important; }`;
        document.head.append(style);
        element.classList.add('port-test-surface');
      }, mountedSpec);
      await surface.scrollIntoViewIfNeeded();
      const rect = await surface.boundingBox();
      const start = { x: rect.x + (416 * 1.25 + 12) * rect.width / mountedSpec.width, y: rect.y + (338 * 1.25 + 8) * rect.height / mountedSpec.height };
      const end = { x: start.x + 3 * 1.25 * rect.width / mountedSpec.width, y: start.y - 96 * 1.25 * rect.height / mountedSpec.height };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 6 });
      if (renderer === 'svg') assert.equal(await page.locator('#diagram-align-guide-y').count(), 1);
      await page.mouse.up();
      assert.equal(await page.locator('#diagram-align-guide-y').count(), 0);
      const saved = await save();
      assert.deepEqual(saved.nodes.find(node => node.id === 'done').position, { x: 360, y: 228 });
      output = JSON.parse(await page.locator('#output').textContent());
      assert.equal(output.state.history.undo, 1);
      await page.locator('#undo').click();
      assert.deepEqual((await save()).nodes.find(node => node.id === 'done').position, { x: 360, y: 320 });
      await page.locator('#redo').click();
      await reload(await save());
      assert.equal(await surface.count(), 1);
      const points = await page.evaluate(async spec => {
        const { createChart } = await import('/src/index.mjs');
        const shadow = createChart({ ...spec, container: undefined });
        const points = shadow.model.scene.find('edge-0').geometry.points;
        shadow.destroy();
        return points;
      }, saved);
      assert.equal(points.length, 2);
      assert.equal(points[0].y, points[1].y);
      if (renderer === 'svg') {
        const path = await page.locator('#edge-0').getAttribute('d');
        assert.equal((path.match(/L/g) || []).length, 1);
      }
    }
  });
}

for (const renderer of ['svg', 'canvas']) {
  test(`Diagram Editor ${renderer}: manual verify channel survives QA dragging, undo, and reload`, async () => {
    await goto(`/playground/diagram-editor.html?scenario=editor&renderer=${renderer}`);
    await page.locator('#select-edge').click();
    const save = async () => {
      const downloading = page.waitForEvent('download');
      await page.locator('#save-spec').click();
      return JSON.parse(await readFile(await (await downloading).path(), 'utf8'));
    };
    const route = spec => spec.edges.find(edge => edge.from === 'review' && edge.to === 'qa');
    const surface = page.locator('#chart svg, #chart canvas');
    const geometry = spec => page.evaluate(async spec => {
      const { createChart } = await import('/src/index.mjs');
      const shadow = createChart({ ...spec, container: undefined });
      const edge = spec.edges.find(edge => edge.from === 'review' && edge.to === 'qa');
      shadow.selectEdges([edge.id]);
      let handle;
      shadow.model.scene.walk(node => {
        if (handle || node.dataRef?.edgeHandle !== 'segment') return;
        const points = node.dataRef.routePoints, index = node.dataRef.segmentIndex;
        if (points[index].y === points[index + 1].y) handle = node;
      });
      const bounds = shadow.model.scene.find('node-qa').bounds;
      const result = { handle: { x: handle.geometry.x + 5, y: handle.geometry.y + 5 }, channelIndex: handle.dataRef.segmentIndex - 1, center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, scale: shadow.model.state.view.scale, points: shadow.model.scene.find('edge-1').geometry.points, routingMode: shadow.getState().edgeRoutes.find(route => route.edgeId === edge.id).effectiveRoutingMode };
      shadow.destroy();
      return result;
    }, spec);
    const drag = async (spec, start, delta, inspect) => {
      await surface.scrollIntoViewIfNeeded();
      const rect = await surface.boundingBox();
      const from = { x: rect.x + start.x * rect.width / spec.width, y: rect.y + start.y * rect.height / spec.height };
      await page.keyboard.down('Alt');
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + delta.x * rect.width / spec.width, from.y + delta.y * rect.height / spec.height, { steps: 6 });
      if (inspect) await inspect();
      await page.mouse.up();
      await page.keyboard.up('Alt');
    };
    const initial = await save(), initialGeometry = await geometry(initial);
    await drag(initial, initialGeometry.handle, { x: 0, y: 8 * initialGeometry.scale });
    const manual = await save(), index = initialGeometry.channelIndex;
    assert.equal(route(manual).routingMode, 'manual');
    const channelY = route(manual).waypoints[index].y;
    assert.equal(route(manual).waypoints[index + 1].y, channelY);
    const beforeMove = await geometry(manual);
    let previewPath;
    await drag(manual, beforeMove.center, { x: 24 * beforeMove.scale, y: 16 * beforeMove.scale }, async () => {
      if (renderer === 'svg') {
        previewPath = await page.locator('#edge-1').getAttribute('d');
        const reference = JSON.parse(await page.locator('#edge-1').getAttribute('data-data-ref'));
        assert.equal(reference.routingMode, 'manual');
        assert.equal(reference.diagramPoints[index + 1].y, channelY);
      }
    });
    const moved = await save();
    assert.equal(route(moved).waypoints[index].y, channelY);
    assert.equal(route(moved).waypoints[index + 1].y, channelY);
    assert.equal((await geometry(moved)).routingMode, 'manual');
    assert.equal(moved.nodes.find(node => node.id === 'qa').position.y, manual.nodes.find(node => node.id === 'qa').position.y + 16);
    if (renderer === 'svg') assert.equal(await page.locator('#edge-1').getAttribute('d'), previewPath);
    await page.locator('#select-edge').click();
    assert.match(await page.locator('#route-state').textContent(), /manual.*manual/);
    assert.equal(JSON.parse(await page.locator('#output').textContent()).state.history.undo, 2);
    await page.locator('#undo').click();
    const undone = await save();
    assert.deepEqual(undone.nodes, manual.nodes);
    assert.deepEqual(undone.edges, manual.edges);
    await page.locator('#redo').click();
    const redone = await save();
    assert.deepEqual(redone.nodes, moved.nodes);
    assert.deepEqual(redone.edges, moved.edges);
    await page.locator('#spec-text').fill(JSON.stringify(moved));
    await page.locator('#load-spec').click();
    assert.match(await page.locator('#status').textContent(), /Spec reloaded/);
    const reloaded = await save(), restoredGeometry = await geometry(reloaded);
    assert.deepEqual(restoredGeometry.points, (await geometry(moved)).points);
    assert.equal(restoredGeometry.routingMode, 'manual');
    await drag(reloaded, restoredGeometry.center, { x: 8 * restoredGeometry.scale, y: 8 * restoredGeometry.scale });
    const next = await save();
    assert.equal(route(next).waypoints[index].y, channelY);
    assert.equal(route(next).waypoints[index + 1].y, channelY);
    assert.equal((await geometry(next)).routingMode, 'manual');
  });
}

for (const renderer of ['svg', 'canvas']) {
  test(`Diagram Editor ${renderer}: moving Done leaves verify routing and label unchanged`, async () => {
    await goto(`/playground/diagram-editor.html?scenario=editor&renderer=${renderer}`);
    await page.locator('#middle').waitFor();
    const readDownload = async (selector, type) => {
      const downloading = page.waitForEvent('download');
      await page.locator(selector).click();
      const download = await downloading, contents = await readFile(await download.path(), 'utf8');
      return type === 'json' ? JSON.parse(contents) : contents;
    };
    const snapshot = svg => page.evaluate(svg => {
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const edge = document.getElementById('edge-1');
      const labels = [...document.querySelectorAll('text')].filter(element => element.id === 'edge-label-1' || element.id.startsWith('edge-label-1-')).map(element => ({ text: element.textContent, x: element.getAttribute('x'), y: element.getAttribute('y') }));
      return { path: edge.getAttribute('d'), labels };
    }, svg);
    const saved = await readDownload('#save-spec', 'json');
    const before = await snapshot(await readDownload('#export-svg', 'svg'));
    assert.equal(before.labels.length, 1);
    assert.equal(before.labels[0].text, 'verify');
    const surface = page.locator('#chart svg, #chart canvas');
    await surface.scrollIntoViewIfNeeded();
    const points = await page.evaluate(async spec => {
      const { createChart } = await import('/src/index.mjs');
      const shadow = createChart({ ...spec, container: undefined });
      const bounds = shadow.model.scene.find('node-done').bounds, view = shadow.model.state.view;
      const rect = document.querySelector('#chart svg, #chart canvas').getBoundingClientRect();
      const start = { x: rect.x + (bounds.x + bounds.width / 2) * rect.width / spec.width, y: rect.y + (bounds.y + bounds.height / 2) * rect.height / spec.height };
      const end = { x: start.x, y: start.y - 45 * view.scale * rect.height / spec.height };
      shadow.destroy();
      return { start, end };
    }, saved);
    const livePath = renderer === 'svg' ? await page.locator('#edge-1').getAttribute('d') : null;
    await page.mouse.move(points.start.x, points.start.y);
    await page.mouse.down();
    for (const portion of [0.25, 0.5, 1]) {
      await page.mouse.move(points.start.x, points.start.y + (points.end.y - points.start.y) * portion);
      if (renderer === 'svg') {
        assert.equal(await page.locator('#edge-1').getAttribute('d'), livePath);
        assert.equal(await page.locator('#edge-label-1').textContent(), 'verify');
        assert.equal(await page.locator('#edge-label-1-1').count(), 0);
      }
    }
    await page.mouse.up();
    assert.deepEqual(await snapshot(await readDownload('#export-svg', 'svg')), before);
    const after = await readDownload('#save-spec', 'json');
    assert.equal(after.nodes.find(node => node.id === 'done').position.y, 120);
    const stationary = spec => spec.nodes.filter(node => ['review', 'qa'].includes(node.id)).map(node => ({ id: node.id, position: node.position, size: node.size, ports: node.ports }));
    assert.deepEqual(stationary(after), stationary(saved));
    await page.locator('#undo').click();
    assert.deepEqual(await snapshot(await readDownload('#export-svg', 'svg')), before);
  });
}

test('Diagram Editor keeps auto routes orthogonal after dragging Done left of QA', async () => {
  await goto('/playground/diagram-editor.html?scenario=editor');
  const done = page.locator('#node-done');
  await done.scrollIntoViewIfNeeded();
  const position = await done.evaluate(element => {
    const box = element.getBBox(), matrix = element.getCTM(), svgBox = element.ownerSVGElement.getBoundingClientRect();
    const center = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(matrix);
    const target = new DOMPoint(200, 265).matrixTransform(matrix);
    return { start: { x: svgBox.x + center.x, y: svgBox.y + center.y }, end: { x: svgBox.x + target.x, y: svgBox.y + target.y } };
  });
  await page.mouse.move(position.start.x, position.start.y);
  await page.mouse.down();
  await page.mouse.move(position.end.x, position.end.y, { steps: 10 });
  await page.mouse.up();
  const result = await page.evaluate(() => {
    const done = document.querySelector('#node-done'), qa = document.querySelector('#node-qa');
    const edges = [...document.querySelectorAll('path[data-data-ref]')].filter(element => JSON.parse(element.getAttribute('data-data-ref')).edgeId);
    const routes = edges.map(element => {
      const reference = JSON.parse(element.getAttribute('data-data-ref'));
      const commands = (element.getAttribute('d').match(/[MLCZ][^MLCZ]*/g) || []).map(command => ({ kind: command[0], values: (command.slice(1).match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) || []).map(Number) }));
      return { id: reference.edgeId, points: reference.diagramPoints, commands };
    });
    return { doneX: Number(done.getAttribute('x')), qaX: Number(qa.getAttribute('x')), routes };
  });
  assert.ok(result.doneX < result.qaX);
  assert.equal(result.routes.length, 3);
  for (const route of result.routes) {
    for (let index = 1; index < route.points.length; index += 1) assert.ok(route.points[index].x === route.points[index - 1].x || route.points[index].y === route.points[index - 1].y, `${route.id} has a logical diagonal segment`);
    let previous;
    for (const command of route.commands) {
      assert.ok(['M', 'L'].includes(command.kind)); assert.equal(command.values.length, 2);
      if (command.kind === 'L') assert.ok(Math.abs(command.values[0] - previous[0]) < 1e-7 || Math.abs(command.values[1] - previous[1]) < 1e-7, `${route.id} draws a diagonal segment`);
      previous = command.values;
    }
  }
  assert.ok(result.routes.find(route => route.id === 'qa-done').points.length > 2);
});

test('Diagram Editor encloses internal connector geometry and labels in the group frame', async () => {
  await goto('/playground/diagram-editor.html?scenario=editor');
  await page.locator('#group-delivery').waitFor({ state: 'attached' });
  const result = await page.evaluate(() => {
    const frame = document.querySelector('#group-delivery').getBBox();
    return ['edge-1', 'edge-1-arrow', 'edge-label-1', 'edge-label-1-background'].map(id => {
      const element = document.getElementById(id);
      if (!element) return { id, contained: true };
      const box = element.getBBox();
      return { id, contained: box.x >= frame.x && box.y >= frame.y && box.x + box.width <= frame.x + frame.width && box.y + box.height <= frame.y + frame.height };
    });
  });
  assert.ok(result.every(item => item.contained), JSON.stringify(result));
});

test('Diagram Editor renders near-aligned ports without retracing and joins the arrow base', async () => {
  await goto('/playground/diagram-editor.html?scenario=editor');
  await page.locator('#save-spec').click();
  const original = JSON.parse(await page.locator('#spec-text').inputValue());
  for (const offset of [-1, 0, 1]) {
    const spec = structuredClone(original), review = spec.nodes.find(node => node.id === 'review');
    spec.nodes.find(node => node.id === 'qa').position.x = review.position.x + review.size.width + offset;
    await page.locator('#spec-text').fill(JSON.stringify(spec));
    await page.locator('#load-spec').click();
    assert.equal(await page.locator('#status').getAttribute('class'), 'ok', await page.locator('#status').textContent());
    const result = await page.evaluate(() => {
      const points = id => {
        const element = document.getElementById(id);
        if (!element) throw new Error(`${id} missing: ${document.querySelector('#status').textContent}; ${document.querySelector('#output').textContent}`);
        const values = element.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
        return Array.from({ length: values.length / 2 }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
      };
      const body = points('edge-1'), head = points('edge-1-arrow');
      return { body, head, port: { x: Number(document.querySelector('#port-qa-in').getAttribute('cx')), y: Number(document.querySelector('#port-qa-in').getAttribute('cy')) } };
    });
    const keys = result.body.map(point => `${point.x}:${point.y}`);
    assert.equal(new Set(keys).size, keys.length);
    for (let index = 1; index < result.body.length - 1; index += 1) {
      const previous = result.body[index - 1], point = result.body[index], next = result.body[index + 1];
      const collinear = previous.x === point.x && point.x === next.x || previous.y === point.y && point.y === next.y;
      assert.equal(collinear && (point.x - previous.x) * (next.x - point.x) + (point.y - previous.y) * (next.y - point.y) < 0, false);
    }
    const base = result.body.at(-1), middle = { x: (result.head[1].x + result.head[2].x) / 2, y: (result.head[1].y + result.head[2].y) / 2 };
    assert.ok(Math.hypot(base.x - middle.x, base.y - middle.y) < 1e-6);
    assert.deepEqual(result.head[0], result.port);
    assert.notDeepEqual(base, result.port);
  }
});

test('Diagram Editor preserves a connector after two successive segment drags', async () => {
  await goto('/playground/diagram-editor.html?scenario=editor');
  await page.locator('#select-edge').click();
  const edge = page.locator('path#edge-1');
  const original = await edge.getAttribute('d');
  const routes = [];
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const handle = page.locator('[id^="edge-handle-segment-edge-1-"]').first();
    await handle.scrollIntoViewIfNeeded();
    const position = await handle.evaluate(element => {
      const reference = JSON.parse(element.getAttribute('data-data-ref'));
      const first = reference.routePoints[reference.segmentIndex], second = reference.routePoints[reference.segmentIndex + 1];
      const box = element.getBBox();
      const start = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2);
      const end = new DOMPoint(start.x + (first.x === second.x ? 24 : 0), start.y + (first.x === second.x ? 0 : 24));
      const matrix = element.getScreenCTM();
      const from = start.matrixTransform(matrix), to = end.matrixTransform(matrix);
      return { start: { x: from.x, y: from.y }, end: { x: to.x, y: to.y } };
    });
    await page.mouse.move(position.start.x, position.start.y);
    await page.mouse.down();
    await page.mouse.move(position.end.x, position.end.y, { steps: 6 });
    const preview = await edge.getAttribute('d');
    await page.mouse.up();
    assert.equal(await edge.getAttribute('d'), preview, 'release preserves the dragged connector');
    assert.notEqual(preview, routes.at(-1) || original, 'each drag changes the connector');
    routes.push(preview);
    await page.locator('#select-edge').click();
    const selected = JSON.parse(await page.locator('#output').textContent()).selectedData;
    assert.equal(selected[0].routingMode, 'manual');
    assert.ok(selected[0].waypoints.length > 0);
  }
  await page.locator('#undo').click();
  assert.equal(await edge.getAttribute('d'), routes[0]);
  await page.locator('#redo').click();
  assert.equal(await edge.getAttribute('d'), routes[1]);
});

test('Iteration 25 editor completes valid/rejected drags, routing recovery, Spec reload, and clean SVG delivery', async () => {
  for (const appearance of ['classic', 'soft']) for (const renderer of ['svg', 'canvas']) {
    await goto(`/playground/diagram-editor.html?scenario=editor&renderer=${renderer}&appearance=${appearance}`);
    assert.equal(await page.locator('#auto-route').isDisabled(), true);
    await page.locator('#select-edge').click();
    const save = async () => {
      const downloading = page.waitForEvent('download');
      await page.locator('#save-spec').click();
      const download = await downloading;
      const spec = JSON.parse(await readFile(await download.path(), 'utf8'));
      assert.equal(spec.type, 'flow');
      return spec;
    };
    let saved = await save();
    if (appearance === 'soft') assert.equal(saved.diagram.appearance, 'soft');
    const dragHandle = async delta => {
      await page.locator('#chart').scrollIntoViewIfNeeded();
      const position = await page.evaluate(async ({ saved, delta }) => {
        const { createChart } = await import('/src/index.mjs');
        const shadow = createChart({ ...saved, container: undefined });
        shadow.selectEdges(['review-qa']);
        let handle;
        shadow.model.scene.walk(node => { if (!handle && node.dataRef?.edgeId === 'review-qa' && node.dataRef?.edgeHandle === 'segment') handle = node; });
        const surface = document.querySelector('#chart svg, #chart canvas'), box = surface.getBoundingClientRect();
        const first = handle.dataRef.routePoints[handle.dataRef.segmentIndex], second = handle.dataRef.routePoints[handle.dataRef.segmentIndex + 1];
        const point = { x: handle.geometry.x + 5, y: handle.geometry.y + 5 };
        const start = { x: box.x + point.x * box.width / saved.width, y: box.y + point.y * box.height / saved.height };
        const end = { x: start.x + (first.x === second.x ? delta * box.width / saved.width : 0), y: start.y + (first.x === second.x ? 0 : delta * box.height / saved.height) };
        shadow.destroy();
        return { start, end };
      }, { saved, delta });
      await page.mouse.move(position.start.x, position.start.y);
      await page.mouse.down();
      await page.mouse.move(position.end.x, position.end.y, { steps: 6 });
      await page.mouse.up();
    };
    const state = async () => JSON.parse(await page.locator('#output').textContent());
    await dragHandle(24);
    assert.match(await page.locator('#route-state').textContent(), /manual → manual/);
    assert.equal((await state()).state.history.undo, 1);
    saved = await save();
    const manual = saved.edges.find(edge => edge.id === 'review-qa');
    assert.equal(manual.routingMode, 'manual');
    await dragHandle(-120);
    assert.match(await page.locator('#status').textContent(), /EDGE_MANUAL_ROUTE_INVALID/);
    assert.equal((await state()).state.history.undo, 1);
    assert.deepEqual((await state()).selectedData[0].waypoints, manual.waypoints);
    await page.locator('#auto-route').click();
    assert.match(await page.locator('#route-state').textContent(), /auto → auto/);
    await page.locator('#undo').click();
    assert.match(await page.locator('#route-state').textContent(), /manual → manual/);
    await page.locator('#load-spec').click();
    assert.equal(await page.locator('#status').getAttribute('class'), 'ok', await page.locator('#status').textContent());
    assert.equal(await page.locator(`#chart ${renderer === 'svg' ? 'svg' : 'canvas'}`).count(), 1);
    assert.equal((await state()).state.history.undo, 0);
    await page.locator('#select-edge').click();
    assert.deepEqual((await state()).selectedData[0].waypoints, manual.waypoints);
    saved = await save();
    await dragHandle(8);
    assert.equal((await state()).state.history.undo, 1, 'reloaded chart remains editable');
    const downloading = page.waitForEvent('download');
    await page.locator('#export-svg').click();
    const svg = await readFile(await (await downloading).path(), 'utf8');
    assert.match(svg, /<svg/);
    assert.equal(svg.includes('edge-handle-'), false);
    assert.equal(svg.includes('port-review-'), false);
    const before = (await state()).state;
    await page.locator('#spec-text').fill('{ broken json');
    await page.locator('#load-spec').click();
    assert.equal(await page.locator('#status').getAttribute('class'), 'warn');
    assert.equal((await state()).state.revision, before.revision);
    assert.equal((await state()).state.dataCount, before.dataCount);
  }
});

test('keeps legend, y-axis title, and project labels collision-free in Chrome', async () => {
  const result = await page.evaluate(async () => {
    const { createChart } = await import(`/src/index.mjs?layout-test=${Date.now()}`);
    const mount = spec => {
      document.body.innerHTML = '<div id="chart"></div>';
      document.body.style.margin = '0';
      return createChart({ width: 760, height: 440, renderer: 'svg', branding: false, container: '#chart', ...spec });
    };
    const box = element => {
      const bounds = element.getBBox(), matrix = element.getCTM();
      const corners = [
        new DOMPoint(bounds.x, bounds.y),
        new DOMPoint(bounds.x + bounds.width, bounds.y),
        new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height),
        new DOMPoint(bounds.x, bounds.y + bounds.height)
      ].map(point => point.matrixTransform(matrix));
      const xs = corners.map(point => point.x), ys = corners.map(point => point.y);
      return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    };
    const overlaps = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);

    let chart = mount({
      type: 'pie',
      data: [
        { name: '客户反馈与工单系统', value: 42 },
        { name: '内部产品规划会议', value: 28 },
        { name: '竞品功能对标分析', value: 18 },
        { name: '市场数据洞察报告', value: 12 }
      ],
      encoding: { category: { field: 'name' }, value: { field: 'value' } },
      labels: { enabled: false },
      legend: { visible: true }
    });
    const legend = [...document.querySelectorAll('[id^="legend-label-"]')].map(box);
    const legendOverlap = legend.some((current, index) => legend.slice(index + 1).some(candidate => overlaps(current, candidate)));
    const legendOverflow = legend.some(bounds => bounds.x < 0 || bounds.x + bounds.width > 760);
    chart.destroy();

    chart = mount({
      type: 'scatter',
      data: [{ x: 12, y: 320 }, { x: 18, y: 410 }, { x: 25, y: 560 }, { x: 31, y: 640 }, { x: 38, y: 810 }, { x: 44, y: 880 }, { x: 52, y: 1020 }, { x: 60, y: 1140 }],
      encoding: { x: { field: 'x' }, y: { field: 'y' } },
      xAxis: { title: '广告投入（万元）' },
      yAxis: { title: '新增用户（人）' }
    });
    const yTitle = box(document.querySelector('#axis-y-title'));
    const yLabels = [...document.querySelectorAll('[id^="label-y-"]')].map(box);
    const axisOverlap = yLabels.some(bounds => overlaps(yTitle, bounds));
    chart.destroy();

    chart = mount({
      type: 'bar',
      data: [{ name: 'A', value: 10 }, { name: 'B', value: 20 }],
      encoding: { x: { field: 'name' }, y: { field: 'value' } },
      yAxis: { title: '出生人口（万人）' }
    });
    const barTitle = document.querySelector('#axis-y-title');
    const barTitleBounds = box(barTitle);
    const barTitleText = barTitle.textContent;
    const barTitleRotation = barTitle.getAttribute('transform');
    const barTitleWithinChart = barTitleBounds.x >= 0 && barTitleBounds.y >= 0 && barTitleBounds.x + barTitleBounds.width <= 760 && barTitleBounds.y + barTitleBounds.height <= 440;
    chart.destroy();

    chart = mount({
      type: 'timeline',
      data: [
        { id: 'e1', date: '2026-09-01', title: '项目启动' },
        { id: 'e2', date: '2026-09-08', title: '方案定稿' },
        { id: 'e3', date: '2026-09-15', title: '首版交付' }
      ]
    });
    const projectLabels = [...document.querySelectorAll('[id^="project-label-"]')].map(box);
    const projectOverflow = projectLabels.some(bounds => bounds.x < 0 || bounds.x + bounds.width > 760);
    chart.destroy();
    return { legendOverlap, legendOverflow, axisOverlap, projectOverflow, barTitleText, barTitleRotation, barTitleWithinChart };
  });

  assert.deepEqual(result, { legendOverlap: false, legendOverflow: false, axisOverlap: false, projectOverflow: false, barTitleText: '出生人口（万人）', barTitleRotation: 'rotate(-90 14 220)', barTitleWithinChart: true });
});

test('keeps Timeline and Milestone event coordinates aligned with the horizontal time axis', async () => {
  const result = await page.evaluate(async () => {
    const { createChart } = await import(`/src/index.mjs?time-axis-test=${Date.now()}`);
    const chart = createChart({
      type: 'timeline', renderer: 'svg', width: 640, height: 360, branding: false, container: '#chart',
      data: [
        { id: 'x0', title: 'M1', date: '2026-01-01' },
        { id: 'x1', title: 'M2', date: '2026-01-10' },
        { id: 'x2', title: 'M3', date: '2026-12-31' }
      ]
    });
    const itemX = [0, 1, 2].map(index => Number(document.querySelector(`#project-item-${index}`).getAttribute('cx')));
    const itemY = [0, 1, 2].map(index => Number(document.querySelector(`#project-item-${index}`).getAttribute('cy')));
    const tickX = [...document.querySelectorAll('[id^="project-tick-"]')].map(node => Number(node.getAttribute('x')));
    const state = chart.getState();
    chart.destroy();
    return { state: state.timeAxis, itemX, itemY, tickX };
  });
  assert.equal(result.state.orientation, 'horizontal');
  assert.equal(result.state.coordinate, 'x');
  assert.ok((result.itemX[1] - result.itemX[0]) / (result.itemX[2] - result.itemX[0]) < 0.05);
  assert.ok(Math.abs(
    (result.itemY[1] - result.itemY[0]) - (result.itemY[2] - result.itemY[1])
  ) < 1e-9);
  assert.ok(result.tickX.every((value, index) => index === 0 || value > result.tickX[index - 1]));
});

test('re-renders Flow content at the enlarged Gallery preview size', async () => {
  await goto('/playground/project-gallery.html');
  await page.locator('#chart-flow #node-load').waitFor({ state: 'attached' });
  const before = await page.locator('#chart-flow #node-load').evaluate(node => node.getBBox().width);
  await page.locator('[data-case="flow"] [data-preview]').click();
  await page.locator('#dialog.open').waitFor({ state: 'visible', timeoutMs: 2000 });
  const after = await page.locator('#dialogChart #node-load').evaluate(node => node.getBBox().width);
  assert.ok(after > before * 1.1, `Flow preview geometry did not scale: before=${before}, after=${after}`);
  await page.locator('#dialogClose').click();
  assert.equal(await page.locator('#chart-flow #node-load').evaluate(node => node.getBBox().width), before);
});

test('enlarges automatically fitted Mindmap content without applying a second view scale', async () => {
  await goto('/playground/project-gallery.html');
  await page.selectOption('#renderer', 'svg');
  await page.locator('[data-case="mindmap"] [data-preview]').click();
  const result = await page.locator('#dialogChart svg').evaluate(svg => {
    const nodes = [...svg.querySelectorAll('[id^="node-"]')].filter(node => node.tagName === 'rect');
    const boxes = nodes.map(node => node.getBBox());
    return { width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height')), boxes: boxes.map(box => ({ x: box.x, y: box.y, width: box.width, height: box.height })) };
  });
  assert.ok(result.boxes.length > 0);
  for (const box of result.boxes) {
    assert.ok(box.x >= 0 && box.x + box.width <= result.width);
    assert.ok(box.y >= 0 && box.y + box.height <= result.height);
  }
  await page.locator('#dialogClose').click();
});

test('applies Gallery top-level theme controls over stored chart preferences', async () => {
  await goto('/playground/project-gallery.html?theme-control-test=1');
  const readLineStyle = async () => JSON.parse(await page.locator('[data-case="line"] [data-output]').textContent()).state.style;
  await page.selectOption('#theme', 'dark');
  let style = await readLineStyle();
  assert.equal(style.mode, 'dark');
  assert.equal(style.resolvedMode, 'dark');
  await page.selectOption('#preset', 'dashboard');
  await page.selectOption('#palette', 'sequential');
  style = await readLineStyle();
  assert.equal(style.preset, 'dashboard');
  assert.equal(style.palette, 'sequential');
});

test('Iteration 32: five entries deliver strict formats without changing SVG/Canvas display', async () => {
  await goto('/examples/consumer-browser.html');
  await page.waitForFunction(() => Boolean(window.consumerChart));
  const entries = { root: '/src/index.mjs', standard: '/src/standard.mjs', project: '/src/project-profile.mjs', diagram: '/src/diagram-profile.mjs', board: '/src/board-profile.mjs' };
  const reports = await page.evaluate(verifyExportDelivery, entries);
  assert.equal(reports.length, 20);
  for (const report of reports) for (const [check, passed] of Object.entries(report.checks)) assert.equal(passed, true, `${report.entry}/${report.renderer}/DPR${report.ratio}: ${check} ${JSON.stringify(report.artifacts)}`);
});

test('Iteration 32: existing consumer downloads carry the requested file bytes', async () => {
  for (const entry of ['root', 'standard', 'project', 'diagram', 'board']) {
    await goto(`/examples/consumer-browser.html?entry=${entry}`);
    await page.waitForFunction(() => Boolean(window.consumerChart));
    for (const type of ['png', 'jpeg', 'svg', 'json']) {
      const event = page.waitForEvent('download'); await page.locator(`#${type}`).click();
      const download = await event, bytes = await readFile(await download.path());
      assert.equal(download.suggestedFilename(), `consumer.${type}`);
      if (type === 'png') assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      else if (type === 'jpeg') assert.deepEqual([...bytes.subarray(0, 2)], [255, 216]);
      else if (type === 'svg') assert.match(bytes.toString(), /<svg/);
      else assert.ok(JSON.parse(bytes.toString()));
    }
  }
});

test('Iteration 32: real image CORS failures, taint and clean retry are diagnosed', async () => {
  await goto('/examples/consumer-browser.html?entry=board');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4;
    canvas.getContext('2d').fillRect(0, 0, 4, 4); return canvas.toDataURL().split(',')[1];
  });
  const assets = createServer((request, response) => {
    if (request.url.startsWith('/cors')) response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', 'image/png'); response.end(Buffer.from(png, 'base64'));
  });
  await new Promise(resolve => assets.listen(0, '127.0.0.1', resolve));
  try {
    const evidence = await page.evaluate(async origin => {
      const { createBoard } = await import('/src/board-profile.mjs');
      const board = createBoard({ renderer: 'svg', assets: [{ id: 'asset', type: 'image', src: `${origin}/blocked.png` }], items: [{ id: 'image', kind: 'image', assetId: 'asset', position: { x: 20, y: 20 }, size: { width: 40, height: 40 } }] });
      try {
        await board.ready();
        const blocked = board.getState().assets[0].status === 'failed' && board.export({ type: 'png' }).code === 'EXPORT_ASSET_UNAVAILABLE';
        board.update({ assets: [{ id: 'asset', type: 'image', src: `${origin}/cors.png` }] }); await board.ready();
        const allowed = board.export({ type: 'png', as: 'blob' }) instanceof Blob;
        const unsafe = new Image(); await new Promise((resolve, reject) => { unsafe.onload = resolve; unsafe.onerror = reject; unsafe.src = `${origin}/unsafe.png`; });
        board._images.set('asset', unsafe); board._rebuild();
        const before = JSON.stringify({ spec: board.getSpec(), state: board.getState() });
        const taint = board.export({ type: 'png' }).code === 'EXPORT_TAINTED_CANVAS';
        const atomic = before === JSON.stringify({ spec: board.getSpec(), state: board.getState() });
        board.update({ assets: [{ id: 'asset', type: 'image', src: `${origin}/cors-retry.png` }] }); await board.ready();
        return { blocked, allowed, taint, atomic, retry: board.export({ type: 'png', as: 'blob' }) instanceof Blob };
      } finally { board.destroy(); }
    }, `http://127.0.0.1:${assets.address().port}`);
    assert.deepEqual(evidence, { blocked: true, allowed: true, taint: true, atomic: true, retry: true });
  } finally { await new Promise(resolve => assets.close(resolve)); }
});

test('mounts and exports the installed browser consumer through SVG and Canvas', async () => {
  const result = await page.evaluate(async () => {
    const { createChart } = await import(`/src/index.mjs?consumer-test=${Date.now()}`);
    const output = {};
    for (const renderer of ['svg', 'canvas']) {
      document.body.innerHTML = '<div id="chart"></div>';
      const chart = createChart({
        type: 'line', renderer, width: 420, height: 240, branding: false, container: '#chart',
        data: [{ id: 'a', name: 'A', value: 1 }, { id: 'b', name: 'B', value: 2 }]
      });
      const state = chart.getState();
      const svg = chart.export({ type: 'svg' });
      const raster = chart.export({ type: 'png' });
      output[renderer] = { renderable: state.health.renderable, svg: svg.startsWith('<svg'), raster: typeof raster === 'string' && raster.startsWith('data:image/png') };
      chart.destroy();
    }
    return output;
  });
  assert.deepEqual(result, {
    svg: { renderable: true, svg: true, raster: true },
    canvas: { renderable: true, svg: true, raster: true }
  });
});

test('renders annual dimensions and atomic array patches in mounted SVG and Canvas charts', async () => {
  await goto('/playground/index.html');
  const result = await page.evaluate(async () => {
    const { createChart, inspectData, planChart } = await import('/src/index.mjs');
    document.body.innerHTML = '<div id="patch-chart"></div>';
    const results = [];
    for (const renderer of ['svg', 'canvas']) {
      const rows = [{ id: '2016', year: '2016', value: 12 }, { id: '2018', year: '2018', value: 24 }];
      const plan = planChart(rows, { intent: 'trend' });
      const chart = createChart({ type: plan.primary, renderer, container: '#patch-chart', width: 800, height: 480, data: { values: rows }, encoding: { x: { field: plan.suggestedEncodings.dimension }, y: { field: plan.suggestedEncodings.measure } } });
      try {
        chart.applyPatch([{ op: 'add', path: '/data/values/1', value: { id: '2017', year: '2017', value: 18 } }, { op: 'remove', path: '/data/values/0' }, { op: 'add', path: '/data/values/-', value: { id: '2019', year: '2019', value: 30 } }]);
        const before = JSON.stringify(chart.getSpec()), revision = chart.getState().revision;
        let rejected = false;
        try { chart.applyPatch([{ op: 'add', path: '/data/values/hello', value: {} }]); } catch (error) { rejected = error.name === 'ChartValidationError'; }
        results.push({ renderer, dimension: plan.suggestedEncodings.dimension, measure: plan.suggestedEncodings.measure, requiredFields: plan.requiredFields, roles: inspectData(rows).fields.map(field => field.role), ids: chart.explain().lineage.recordIds, renderable: chart.getState().health.renderable, mounted: Boolean(document.querySelector(`#patch-chart ${renderer === 'svg' ? 'svg' : 'canvas'}`)), svg: chart.export({ type: 'svg' }).includes('2017'), rejected, unchanged: before === JSON.stringify(chart.getSpec()), revisionUnchanged: revision === chart.getState().revision });
      } finally { chart.destroy(); }
    }
    return results;
  });
  for (const renderer of ['svg', 'canvas']) assert.deepEqual(result.find(item => item.renderer === renderer), { renderer, dimension: 'year', measure: 'value', requiredFields: [], roles: ['identifier', 'dimension', 'measure'], ids: ['2017', '2018', '2019'], renderable: true, mounted: true, svg: true, rejected: true, unchanged: true, revisionUnchanged: true });
});

test('loads each public capability profile in the Profile Loading Playground', async () => {
  await goto('/playground/profile-loading.html');
  await page.locator('#chart-board svg').waitFor({ state: 'visible', timeoutMs: 5000 });
  const result = await page.locator('.profile-card').evaluateAll(cards => cards.map(card => ({ status: card.querySelector('[data-status]')?.textContent, type: card.querySelector('[data-type]')?.textContent, hasSvg: Boolean(card.querySelector('svg')) })));
  assert.equal(result.length, 4);
  assert.ok(result.every(item => item.status === 'ready'));
  assert.ok(result.every(item => item.hasSvg));
});

test('runs the published browser consumer fixture through the public root entry', async () => {
  await goto('/examples/consumer-browser.html');
  await page.locator('#chart svg').waitFor({ state: 'visible', timeoutMs: 5000 });
  const result = await page.evaluate(() => ({
    status: document.querySelector('#status')?.textContent,
    renderable: window.consumerChart?.getState().health.renderable,
    chartTypes: window.consumerChart ? window.consumerChart.explain().type : null
  }));
  assert.match(result.status, /18 chart types available/);
  assert.equal(result.renderable, true);
  assert.equal(result.chartTypes, 'line');
});

test('mounts the actual README and Quickstart browser snippets', async () => {
  const snippets = readDocumentSnippets();
  const scenarios = [
    { name: 'README', source: snippets['README.md:browser-chart'].code + '\nexport { chart as outcome };', ids: ['jan', 'feb'] },
    { name: 'Quickstart', source: quickstartWorkflowSource(snippets, 'render-browser') + '\nexport { outcome };', ids: ['jan', 'feb', 'mar'] }
  ];
  await goto('/playground/index.html');
  for (const scenario of scenarios) {
    const result = await page.evaluate(async source => {
      document.body.innerHTML = '<div id="chart"></div>';
      const browserSource = source.replaceAll("'@taylorwong/ichartjs'", `'${location.origin}/src/index.mjs'`);
      const url = URL.createObjectURL(new Blob([browserSource], { type: 'text/javascript' }));
      let chart;
      try {
        chart = (await import(url)).outcome;
        return { renderable: chart.getState().health.renderable, svg: Boolean(document.querySelector('#chart svg')), exported: chart.export({ type: 'svg' }).includes('<svg'), ids: chart.explain().lineage.recordIds };
      } finally {
        chart?.destroy();
        URL.revokeObjectURL(url);
      }
    }, scenario.source);
    assert.deepEqual(result, { renderable: true, svg: true, exported: true, ids: scenario.ids }, scenario.name);
  }
});
