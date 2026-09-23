import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

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
