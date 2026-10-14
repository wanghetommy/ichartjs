import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

export const root = process.cwd();
export const baseline = {
  moduleRawBytes: 535216,
  moduleGzipBytes: 129561,
  packageBytes: 344082,
  unpackedBytes: 1231449
};
export const allowedGrowth = 1.15;

async function moduleGraph(entry) {
  const seen = new Set();
  const files = [];
  const visit = async file => {
    const absolute = resolve(root, file);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const source = await readFile(absolute, 'utf8');
    files.push(absolute);
    const imports = [...source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"](\.[^'"]+)['"]/g)].map(match => match[1]);
    for (const value of imports) await visit(resolve(dirname(absolute), value));
  };
  await visit(entry);
  return files;
}

export async function moduleStats(entry) {
  const files = await moduleGraph(entry);
  const content = Buffer.concat(await Promise.all(files.sort().map(file => readFile(file))));
  return {
    files: files.length,
    rawBytes: content.length,
    gzipBytes: gzipSync(content, { level: 9 }).length
  };
}

function packageReport() {
  const work = mkdtempSync(join(tmpdir(), 'ichartjs-footprint-'));
  const cache = mkdtempSync(join(tmpdir(), 'ichartjs-footprint-cache-'));
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    const output = execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: root,
      env: { ...process.env, npm_config_cache: cache },
      encoding: 'utf8'
    });
    const report = JSON.parse(output.trim()).at(-1);
    return {
      size: report.size,
      unpackedSize: report.unpackedSize,
      entryCount: report.entryCount,
      files: report.files || []
    };
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(cache, { recursive: true, force: true });
  }
}

function resourceGroup(path) {
  if (path.startsWith('src/')) return 'runtime source';
  if (path.startsWith('types/')) return 'TypeScript declarations';
  if (path.startsWith('docs/agent/development/')) return 'development docs';
  if (path.startsWith('docs/agent/zh-CN/')) return 'Chinese guides';
  if (path.startsWith('docs/agent/')) return 'English guides';
  if (path.startsWith('docs/manifests/')) return 'capability manifests';
  if (path.startsWith('skills/')) return 'Skill';
  if (path.startsWith('agent-recipes/')) return 'Recipes';
  if (path === 'README.md' || path === 'CHANGELOG.md') return 'README + changelog';
  return 'other';
}

function resourceStats(files) {
  const groups = {};
  for (const file of files) {
    const group = resourceGroup(file.path);
    groups[group] ||= { files: 0, bytes: 0 };
    groups[group].files += 1;
    groups[group].bytes += file.size || 0;
  }
  return {
    groups,
    totalBytes: files.reduce((total, file) => total + (file.size || 0), 0)
  };
}

export async function buildFootprintReport() {
  const packageStats = packageReport();
  const rootStats = await moduleStats('src/index.mjs');
  const packageVersion = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
  return {
    version: '1.0',
    packageVersion,
    generatedFrom: 'npm pack --dry-run --json',
    policy: 'source-module-graph-baseline',
    entry: 'src/index.mjs',
    files: rootStats.files,
    moduleRawBytes: rootStats.rawBytes,
    moduleGzipBytes: rootStats.gzipBytes,
    packageBytes: packageStats.size,
    unpackedBytes: packageStats.unpackedSize,
    entryCount: packageStats.entryCount,
    treeShaking: 'profile entries are available; root entry remains the complete runtime',
    profiles: {
      standard: await moduleStats('src/standard.mjs'),
      project: await moduleStats('src/project-profile.mjs'),
      diagram: await moduleStats('src/diagram-profile.mjs'),
      board: await moduleStats('src/board-profile.mjs')
    },
    resources: resourceStats(packageStats.files)
  };
}

export function footprintFailures(report) {
  return Object.entries(baseline)
    .filter(([key, value]) => report[key] > Math.ceil(value * allowedGrowth))
    .map(([key, value]) => `${key} ${report[key]} exceeds ${Math.ceil(value * allowedGrowth)} (baseline ${value})`);
}
