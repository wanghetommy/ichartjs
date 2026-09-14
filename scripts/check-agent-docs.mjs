/**
 * Checks Agent document coverage, canonical-language boundaries, and manifest lists.
 * Presence and identifier checks do not establish translation or browser correctness.
 */
import fs from 'node:fs';
import { getCapabilities } from '../src/index.mjs';

const readJSON = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const failures = [];
const capabilities = getCapabilities();
const manifest = readJSON('docs/manifests/capabilities.json');
const commands = readJSON('docs/manifests/commands.json');
const schemas = readJSON('docs/manifests/schemas.json');
const expectedDocs = ['README.md', 'charting-scenario.md', 'project-scenario.md', 'diagram-scenario.md', 'runtime-contract.md', 'editing-contract.md', 'development-guide.md'];
expectedDocs.forEach(file => { if (!fs.existsSync(`docs/agent/${file}`)) failures.push(`Missing Agent document: docs/agent/${file}`); });
expectedDocs.forEach(file => { if (!fs.existsSync(`docs/agent/zh-CN/${file}`)) failures.push(`Missing Chinese Agent document: docs/agent/zh-CN/${file}`); });
fs.readdirSync('docs/agent', { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
  .forEach(entry => {
    const path = `docs/agent/${entry.name}`;
    fs.readFileSync(path, 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (/\p{Script=Han}/u.test(line)) failures.push(`${path}:${index + 1}: Chinese text in an English core document; use docs/agent/zh-CN/ for Chinese guidance.`);
    });
  });
const manifestCharts = Object.values(manifest.scenarios).flat();
if (JSON.stringify(manifestCharts) !== JSON.stringify(capabilities.chartTypes)) failures.push('Manifest chart scenarios do not match getCapabilities().chartTypes.');
if (JSON.stringify(Object.keys(commands.commands)) !== JSON.stringify(capabilities.editing.operations)) failures.push('Manifest commands do not match getCapabilities().editing.operations.');
if (JSON.stringify(Object.keys(schemas.models)) !== JSON.stringify(Object.keys({ 'project-task': 1, 'timeline-event': 1, milestone: 1, 'burndown-sample': 1, 'flow-node': 1, 'flow-edge': 1, swimlane: 1 }))) failures.push('Manifest schema model coverage is incomplete.');
const gallery = fs.readFileSync('playground/project-gallery.html', 'utf8');
capabilities.chartTypes.forEach(type => { if (!gallery.includes(`type:'${type}'`)) failures.push(`Gallery is missing chart type: ${type}`); });
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Agent documentation check passed: ${capabilities.chartTypes.length} charts, ${Object.keys(commands.commands).length} commands, ${Object.keys(schemas.models).length} schemas.`);
