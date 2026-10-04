import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const baseline = { moduleRawBytes: 535216, moduleGzipBytes: 129561, packageBytes: 294592, unpackedBytes: 1065489 };
const allowedGrowth = 1.15;

async function moduleGraph(entry) {
  const seen = new Set();
  const files = [];
  const visit = async file => {
    const absolute = resolve(root, file);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const source = await readFileAsync(absolute, 'utf8');
    files.push(absolute);
    const imports = [...source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"](\.[^'"]+)['"]/g)].map(match => match[1]);
    for (const value of imports) await visit(resolve(dirname(absolute), value));
  };
  await visit(entry);
  return files;
}

async function moduleStats(entry) {
  const files = await moduleGraph(entry);
  const content = Buffer.concat(await Promise.all(files.sort().map(file => readFileAsync(file))));
  return { files: files.length, rawBytes: content.length, gzipBytes: gzipSync(content, { level: 9 }).length };
}

function packSummary() {
  const work = mkdtempSync(join(tmpdir(), 'ichartjs-footprint-'));
  const cache = mkdtempSync(join(tmpdir(), 'ichartjs-footprint-cache-'));
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    const output = execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, env: { ...process.env, npm_config_cache: cache }, encoding: 'utf8' });
    const report = JSON.parse(output.trim()).at(-1);
    return { packageBytes: report.size, unpackedBytes: report.unpackedSize, entryCount: report.entryCount };
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(cache, { recursive: true, force: true });
  }
}

const rootStats = await moduleStats('src/index.mjs');
const packageStats = packSummary();
const report = {
  version: '1.0',
  policy: 'source-module-graph-baseline',
  entry: 'src/index.mjs',
  files: rootStats.files,
  moduleRawBytes: rootStats.rawBytes,
  moduleGzipBytes: rootStats.gzipBytes,
  ...packageStats,
  treeShaking: 'profile entries are available; root entry remains the complete runtime',
  profiles: {
    standard: await moduleStats('src/standard.mjs'),
    project: await moduleStats('src/project-profile.mjs'),
    diagram: await moduleStats('src/diagram-profile.mjs'),
    board: await moduleStats('src/board-profile.mjs')
  }
};
const failures = Object.entries(baseline).filter(([key, value]) => report[key] > Math.ceil(value * allowedGrowth)).map(([key, value]) => `${key} ${report[key]} exceeds ${Math.ceil(value * allowedGrowth)} (baseline ${value})`);
console.log(JSON.stringify(report, null, 2));
if (failures.length) throw new Error(`Runtime footprint regression: ${failures.join('; ')}`);
