import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const files = (await readdir(root)).filter(file => file.endsWith('.mjs'));
const graph = new Map(files.map(file => [file, []]));
for (const file of files) {
  const source = await readFile(path.join(root, file), 'utf8');
  for (const match of source.matchAll(/(?:from|import\s*\()\s*['"](\.\/[^'"]+\.mjs)['"]/g)) {
    const target = path.basename(path.resolve(root, file, '..', match[1]));
    if (graph.has(target)) graph.get(file).push(target);
  }
}
const visiting = new Set(), visited = new Set(), cycles = [];
function visit(file, chain = []) {
  if (visiting.has(file)) { cycles.push([...chain.slice(chain.indexOf(file)), file].join(' -> ')); return; }
  if (visited.has(file)) return;
  visiting.add(file);
  graph.get(file).forEach(target => visit(target, [...chain, file]));
  visiting.delete(file);
  visited.add(file);
}
files.forEach(file => visit(file));
if (cycles.length) { console.error(`Module cycles detected:\n${cycles.join('\n')}`); process.exit(1); }
console.log(`Module cycle check passed: ${files.length} source modules.`);
