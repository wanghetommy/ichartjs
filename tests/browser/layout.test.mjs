import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { readDocumentSnippets, quickstartWorkflowSource } from '../../scripts/check-doc-snippets.mjs';

const root = new URL('../../', import.meta.url);
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
      const response = await fetch('http://127.0.0.1:3000/playground/project-gallery.html');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Playground server did not become ready');
}

before(async () => {
  const executablePath = chromeCandidates.find(existsSync);
  if (!executablePath) throw new Error('Chrome executable not found; set CHROME_BIN');
  server = spawn(process.execPath, ['scripts/serve-playground.mjs'], { cwd: root, stdio: 'ignore' });
  await waitForServer();
  browser = await chromium.launch({ executablePath, headless: true });
  page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await page.goto('http://127.0.0.1:3000/playground/project-gallery.html');
});

after(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
});

test('Diagram Editor keeps auto routes orthogonal after dragging Done left of QA', async () => {
  await page.goto('http://127.0.0.1:3000/playground/diagram-editor.html');
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
    const routes = edges.map(element => ({ id: JSON.parse(element.getAttribute('data-data-ref')).edgeId, points: element.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number) }));
    return { doneX: Number(done.getAttribute('x')), qaX: Number(qa.getAttribute('x')), routes };
  });
  assert.ok(result.doneX < result.qaX);
  assert.equal(result.routes.length, 3);
  for (const route of result.routes) {
    for (let index = 2; index < route.points.length; index += 2) assert.ok(route.points[index] === route.points[index - 2] || route.points[index + 1] === route.points[index - 1], `${route.id} has a diagonal segment`);
  }
  assert.ok(result.routes.find(route => route.id === 'qa-done').points.length > 4);
});

test('Diagram Editor preserves a connector after two successive segment drags', async () => {
  await page.goto('http://127.0.0.1:3000/playground/diagram-editor.html');
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
  await page.goto('http://127.0.0.1:3000/playground/project-gallery.html');
  const before = await page.locator('#chart-flow #node-load').evaluate(node => node.getBBox().width);
  await page.locator('[data-case="flow"] [data-preview]').click();
  await page.locator('#dialog.open').waitFor({ state: 'visible', timeoutMs: 2000 });
  const after = await page.locator('#dialogChart #node-load').evaluate(node => node.getBBox().width);
  assert.ok(after > before * 1.1, `Flow preview geometry did not scale: before=${before}, after=${after}`);
  await page.locator('#dialogClose').click();
  assert.equal(await page.locator('#chart-flow #node-load').evaluate(node => node.getBBox().width), before);
});

test('enlarges automatically fitted Mindmap content without applying a second view scale', async () => {
  await page.goto('http://127.0.0.1:3000/playground/project-gallery.html');
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
  await page.goto('http://127.0.0.1:3000/playground/project-gallery.html?theme-control-test=1');
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

test('loads each public capability profile in the Profile Loading Playground', async () => {
  await page.goto('http://127.0.0.1:3000/playground/profile-loading.html');
  await page.locator('#chart-board svg').waitFor({ state: 'visible', timeoutMs: 5000 });
  const result = await page.locator('.profile-card').evaluateAll(cards => cards.map(card => ({ status: card.querySelector('[data-status]')?.textContent, type: card.querySelector('[data-type]')?.textContent, hasSvg: Boolean(card.querySelector('svg')) })));
  assert.equal(result.length, 4);
  assert.ok(result.every(item => item.status === 'ready'));
  assert.ok(result.every(item => item.hasSvg));
});

test('runs the published browser consumer fixture through the public root entry', async () => {
  await page.goto('http://127.0.0.1:3000/examples/consumer-browser.html');
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
  await page.goto('http://127.0.0.1:3000/playground/index.html');
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
