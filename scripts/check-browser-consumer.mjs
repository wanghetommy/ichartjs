import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { buildConsumerBundles } from './consumer-bundle-lib.mjs';
import { verifyHostLifecycle } from '../tests/browser/host-lifecycle.mjs';
import { verifyExportDelivery } from '../tests/browser/export-delivery.mjs';

const work = mkdtempSync(join(tmpdir(), 'ichartjs-mounted-consumer-'));
let server, browser;
try {
  const report = await buildConsumerBundles({ outputDirectory: work });
  const imports = Object.fromEntries(Object.entries(report.entries).map(([name, entry]) => [entry.import, `/bundles/${name}.mjs`]));
  const html = (await readFile(new URL('../examples/consumer-browser.html', import.meta.url), 'utf8')).replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">${JSON.stringify({ imports })}</script>`);
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    try {
      if (path === '/examples/consumer-browser.html') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
      const bundle = path.match(/^\/bundles\/(root|standard|project|diagram|board)\.mjs$/);
      const content = bundle ? await readFile(join(work, `${bundle[1]}.mjs`)) : path === '/examples/consumer-host.mjs' ? await readFile(new URL('../examples/consumer-host.mjs', import.meta.url)) : null;
      if (!content) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', 'application/javascript'); response.end(content);
    } catch { response.writeHead(500).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(path => path && existsSync(path));
  if (!executablePath) throw new Error('Chrome executable not found; set CHROME_BIN.');
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/examples/consumer-browser.html`);
  await page.waitForFunction(() => Boolean(window.consumerChart));
  const entries = Object.fromEntries(Object.keys(report.entries).map(name => [name, `${base}/bundles/${name}.mjs`]));
  const results = await page.evaluate(verifyHostLifecycle, entries);
  const delivery = await page.evaluate(verifyExportDelivery, entries);
  for (const result of delivery) for (const [name, passed] of Object.entries(result.checks)) assert.equal(passed, true, `${result.entry}/${result.renderer}/DPR${result.ratio}: ${name}`);
  for (const result of results) for (const [name, passed] of Object.entries(result.checks)) assert.equal(passed, true, `${result.entry}/${result.renderer}: ${name}`);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ source: 'installed local npm tarball through minified browser bundles', packageVersion: report.packageVersion, scenarios: results, delivery }, null, 2));
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  rmSync(work, { recursive: true, force: true });
}
