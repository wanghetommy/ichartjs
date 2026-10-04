import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profiles = {
  standard: { entry: 'src/standard.mjs', forbidden: ['src/index.mjs', 'src/charts.mjs', 'src/project.mjs', 'src/board.mjs'], run: async module => { const chart = module.createChart({ type: 'line', width: 420, height: 240, renderer: 'svg', data: { values: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] }, encoding: { x: { field: 'name' }, y: { field: 'value' } } }); return { type: chart.getState().type, svg: chart.export({ type: 'svg' }), health: chart.getState().health }; } },
  project: { entry: 'src/project-profile.mjs', forbidden: ['src/index.mjs', 'src/charts.mjs', 'src/board.mjs'], run: async module => { const chart = module.createChart({ type: 'gantt', width: 420, height: 240, renderer: 'svg', data: { values: [{ id: 'a', name: 'Plan', start: '2026-01-01', end: '2026-01-03' }] } }); return { type: chart.getState().type, svg: chart.export({ type: 'svg' }), health: chart.getState().health }; } },
  diagram: { entry: 'src/diagram-profile.mjs', forbidden: ['src/index.mjs', 'src/charts.mjs', 'src/board.mjs'], run: async module => { const chart = module.createChart({ type: 'flow', width: 420, height: 240, renderer: 'svg', nodes: [{ id: 'start', label: 'Start', kind: 'start' }, { id: 'end', label: 'End', kind: 'end' }], edges: [{ id: 'edge', from: 'start', to: 'end' }] }); return { type: chart.getState().type, svg: chart.export({ type: 'svg' }), health: chart.getState().health }; } },
  board: { entry: 'src/board-profile.mjs', forbidden: ['src/index.mjs', 'src/charts.mjs'], run: async module => { const board = module.createBoard({ width: 420, height: 240, renderer: 'svg', items: [{ id: 'label', kind: 'text', position: { x: 20, y: 20 }, size: { width: 160, height: 48 }, text: 'Board profile' }, { id: 'chart', kind: 'chart', position: { x: 20, y: 90 }, size: { width: 240, height: 120 }, spec: { type: 'line', data: { values: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] } } }] }); return { type: 'board', svg: board.export({ type: 'svg' }), health: board.getState().health }; } }
};

async function graph(entry) {
  const seen = new Set();
  const visit = async file => {
    const absolute = resolve(root, file);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const source = await readFile(absolute, 'utf8');
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"](\.[^'"]+)['"]/g)) await visit(resolve(dirname(absolute), match[1]));
  };
  await visit(entry);
  return [...seen].map(file => file.slice(root.length + 1));
}

const report = {};
for (const [name, config] of Object.entries(profiles)) {
  const files = await graph(config.entry);
  const forbidden = files.filter(file => config.forbidden.includes(file));
  if (forbidden.length) throw new Error(`${name} profile imports forbidden modules: ${forbidden.join(', ')}`);
  const module = await import(pathToFileURL(resolve(root, config.entry)));
  const result = await config.run(module);
  if (!result.svg.includes('<svg') || !result.health) throw new Error(`${name} profile did not produce a usable SVG and health result.`);
  report[name] = { files: files.length, rawBytes: (await Promise.all(files.map(file => readFile(resolve(root, file))))).reduce((sum, content) => sum + content.length, 0), chartType: result.type, renderable: result.health.renderable };
}
console.log(JSON.stringify({ version: '1.0', profiles: report }, null, 2));
