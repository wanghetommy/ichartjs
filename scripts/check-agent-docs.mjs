/**
 * Checks Agent document coverage, canonical-language boundaries, and manifest lists.
 * Presence and identifier checks do not establish translation or browser correctness.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCapabilities } from '../src/index.mjs';

const readJSON = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const failures = [];
const capabilities = getCapabilities();
const manifest = readJSON('docs/manifests/capabilities.json');
const commands = readJSON('docs/manifests/commands.json');
const schemas = readJSON('docs/manifests/schemas.json');
const expectedDocs = ['README.md', 'usage-scenarios.md', 'quickstart.md', 'coding-agent-integration.md', 'frontend-integration.md', 'theme-guide.md', 'charting-scenario.md', 'project-scenario.md', 'diagram-scenario.md', 'runtime-contract.md', 'editing-contract.md', 'development-guide.md'];
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
if (JSON.stringify(manifest.export) !== JSON.stringify(capabilities.export)) failures.push('Manifest export contract does not match getCapabilities().export.');
if (JSON.stringify(manifest.preferences?.fields) !== JSON.stringify(capabilities.preferences?.fields)) failures.push('Manifest preference fields do not match getCapabilities().preferences.fields.');
if (JSON.stringify(manifest.preferences?.precedence) !== JSON.stringify(capabilities.preferences?.precedence)) failures.push('Manifest preference precedence does not match getCapabilities().preferences.precedence.');
if (!manifest.preferences?.discovery?.capabilities?.startsWith('getPreferenceCapabilities')) failures.push('Manifest is missing the preference discovery API.');
if (manifest.usageScenarios !== 'docs/agent/usage-scenarios.md') failures.push('Manifest is missing the canonical usage-scenarios entry.');
if (JSON.stringify(Object.keys(commands.commands)) !== JSON.stringify(capabilities.editing.operations)) failures.push('Manifest commands do not match getCapabilities().editing.operations.');
if (JSON.stringify(Object.keys(schemas.models)) !== JSON.stringify(Object.keys({ 'project-task': 1, 'timeline-event': 1, milestone: 1, 'burndown-sample': 1, 'flow-node': 1, 'flow-edge': 1, swimlane: 1, 'architecture-node': 1, 'architecture-edge': 1, 'mindmap-node': 1 }))) failures.push('Manifest schema model coverage is incomplete.');
const gallery = fs.readFileSync('playground/project-gallery.html', 'utf8') + fs.readFileSync('playground/gallery-cases.mjs', 'utf8');
capabilities.chartTypes.forEach(type => { if (!gallery.includes(`type:'${type}'`)) failures.push(`Gallery is missing chart type: ${type}`); });
const packageMetadata = readJSON('package.json');
const currentVersion = packageMetadata.version;
if (packageMetadata.exports?.['.']?.types !== './types/index.d.ts') failures.push('Package root export is missing TypeScript declarations.');
if (packageMetadata.exports?.['./agent']) failures.push('Package must expose one runtime entry instead of a duplicate Agent alias.');
if (!packageMetadata.files?.includes('skills/ichartjs/')) failures.push('Published files do not include the official iChart.js Skill.');
['skills/ichartjs/SKILL.md', 'skills/ichartjs/agents/openai.yaml', 'examples/agent-workflow.mjs'].forEach(path => { if (!fs.existsSync(path)) failures.push(`Missing Agent integration artifact: ${path}`); });
['README.md', 'docs/agent/usage-scenarios.md', 'docs/agent/zh-CN/usage-scenarios.md', 'docs/agent/coding-agent-integration.md', 'docs/agent/zh-CN/coding-agent-integration.md', 'skills/ichartjs/SKILL.md'].forEach(file => {
  if (!fs.readFileSync(file, 'utf8').includes('npx skills add wanghetommy/ichartjs')) failures.push(`${file}: missing canonical npx Skill installation command.`);
});
const currentDocs = [
  'README.md',
  'docs/agent/README.md',
  ...expectedDocs.slice(1).map(file => `docs/agent/${file}`),
  ...expectedDocs.map(file => `docs/agent/zh-CN/${file}`),
  'skills/ichartjs/SKILL.md'
];
const staleCurrentDocTokens = [
  'github:wanghetommy/ichartjs#v2.0.1`',
  'node_modules/ichartjs/',
  '`ichartjs/capabilities.json`',
  '`ichartjs/recipes',
  '正式 npm scope',
  '13-step SOP'
];
currentDocs.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  staleCurrentDocTokens.forEach(token => {
    if (content.includes(token)) failures.push(`${file}: stale release or package reference: ${token}`);
  });
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0].trim();
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) failures.push(`${file}: broken local link: ${match[1]}`);
  }
});
const versionChecks = [
  ['src/index.mjs', `version: '${currentVersion}'`],
  ['playground/playground.mjs', `runtimeVersion = '${currentVersion}'`],
  ['docs/index.html', `iChart.js ${currentVersion}`]
];
versionChecks.forEach(([file, token]) => {
  if (!fs.readFileSync(file, 'utf8').includes(token)) failures.push(`${file}: does not expose package version ${currentVersion}.`);
});
currentDocs.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(/github:wanghetommy\/ichartjs#v(\d+\.\d+\.\d+)/g)) {
    if (match[1] !== currentVersion) failures.push(`${file}: GitHub fallback tag v${match[1]} does not match package version ${currentVersion}.`);
  }
  for (const match of content.matchAll(/github\.com\/wanghetommy\/ichartjs\/tree\/v(\d+\.\d+\.\d+)\/skills\/ichartjs/g)) {
    if (match[1] !== currentVersion) failures.push(`${file}: pinned Skill tag v${match[1]} does not match package version ${currentVersion}.`);
  }
});
const previewPages = ['index.html', 'github-promo.html', 'agent-workbench.html', 'project-gallery.html', 'foundational-gallery.html', 'theme-gallery.html', 'preferences-lab.html', 'editing.html', 'project-intelligence.html', 'diagram-editor.html', 'interaction-lab.html', 'accessibility-lab.html', 'performance-lab.html'];
previewPages.forEach(file => { if (!fs.existsSync(`playground/${file}`)) failures.push(`Missing maintained Playground page: playground/${file}`); });
const playgroundHome = fs.readFileSync('playground/index.html', 'utf8');
if (!playgroundHome.includes('npm run playground')) failures.push('Playground Home must direct users to npm run playground.');
if (playgroundHome.includes('python3 -m http.server')) failures.push('Playground Home must not direct users to the Python static server.');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Agent documentation check passed: ${capabilities.chartTypes.length} charts, ${Object.keys(commands.commands).length} commands, ${Object.keys(schemas.models).length} schemas.`);
