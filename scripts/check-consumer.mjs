import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), 'ichartjs-consumer-'));
const cache = mkdtempSync(join(tmpdir(), 'ichartjs-npm-cache-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = { ...process.env, npm_config_cache: cache };
try {
  const packed = execFileSync(npm, ['pack', '--silent', '--ignore-scripts', '--pack-destination', work], { cwd: root, env, encoding: 'utf8' }).trim().split(/\r?\n/).at(-1);
  const tarball = join(work, packed);
  if (!existsSync(tarball)) throw new Error(`Package tarball was not created: ${tarball}`);
  execFileSync(npm, ['init', '-y'], { cwd: work, env, stdio: 'ignore' });
  execFileSync(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], { cwd: work, env, stdio: 'ignore' });
  const consumer = `
import { createChart, getCapabilities } from '@taylorwong/ichartjs';
import { createChart as createStandardChart, getCapabilities as getStandardCapabilities } from '@taylorwong/ichartjs/standard';
import { createChart as createProjectChart } from '@taylorwong/ichartjs/project';
import { createChart as createDiagramChart } from '@taylorwong/ichartjs/diagram';
import { createBoard as createProfileBoard } from '@taylorwong/ichartjs/board';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const capabilities = require('@taylorwong/ichartjs/capabilities.json');
const recipe = require('@taylorwong/ichartjs/recipes/trend-line');
const chart = createChart({ type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] });
const standard = createStandardChart({ type: 'line', renderer: 'svg', data: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] });
const project = createProjectChart({ type: 'gantt', renderer: 'svg', data: { values: [{ id: 'task', name: 'Task', start: '2026-01-01', end: '2026-01-02' }] } });
const diagram = createDiagramChart({ type: 'flow', renderer: 'svg', nodes: [{ id: 'a', label: 'A', kind: 'start' }, { id: 'b', label: 'B', kind: 'end' }], edges: [{ id: 'e', from: 'a', to: 'b' }] });
const board = createProfileBoard({ width: 160, height: 120, renderer: 'svg', items: [] });
const svg = chart.export({ type: 'svg' });
const json = chart.export({ type: 'json', as: 'object' });
const result = { types: getCapabilities().chartTypes.length, manifest: capabilities.chartTypes.length, recipe: recipe.spec?.type, svg: svg.includes('<svg'), json: json.spec.type, health: chart.getState().health.renderable, profiles: { standard: getStandardCapabilities().chartTypes.length, project: project.getState().type, diagram: diagram.getState().type, board: board.getState().health.renderable, standardSvg: standard.export({type:'svg'}).includes('<svg'), projectSvg: project.export({type:'svg'}).includes('<svg'), diagramSvg: diagram.export({type:'svg'}).includes('<svg') } };
chart.destroy(); standard.destroy(); project.destroy(); diagram.destroy(); board.destroy();
if (!result.types || !result.manifest || !result.recipe || !result.svg || !result.json || !result.health || !result.profiles.standard || result.profiles.project !== 'gantt' || result.profiles.diagram !== 'flow' || !result.profiles.board || !result.profiles.standardSvg || !result.profiles.projectSvg || !result.profiles.diagramSvg) throw new Error(JSON.stringify(result));
console.log(JSON.stringify(result));
`;
  const entry = join(work, 'consumer.mjs');
  writeFileSync(entry, consumer);
  const output = execFileSync(process.execPath, [entry], { cwd: work, env, encoding: 'utf8' }).trim();
  const packageRoot = join(work, 'node_modules/@taylorwong/ichartjs');
  if (!existsSync(join(packageRoot, 'types/index.d.ts'))) throw new Error('Consumer package is missing TypeScript declarations.');
  console.log(`Consumer package check passed: ${JSON.parse(output).types} chart types from installed tarball.`);
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
}
