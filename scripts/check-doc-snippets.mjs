import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const documents = {
  'README.md': ['agent-workflow', 'browser-chart'],
  'docs/agent/quickstart.md': ['imports', 'recipe-line', 'build', 'recipe-radar', 'validate', 'render-browser', 'render-headless', 'export'],
  'docs/agent/text-annotations.md': ['annotations']
};
const root = new URL('../', import.meta.url);

export function readDocumentSnippets() {
  const snippets = {};
  for (const [file, expected] of Object.entries(documents)) {
    const markdown = readFileSync(new URL(file, root), 'utf8');
    const blocks = [...markdown.matchAll(/^```(?:js|javascript)\s*\r?\n([\s\S]*?)^```\s*$/gm)];
    const ids = [];
    for (const block of blocks) {
      const line = markdown.slice(0, block.index).split('\n').length;
      const marker = markdown.slice(0, block.index).match(/<!-- docs-check: ([\w-]+) -->\s*$/);
      assert.ok(marker, `${file}:${line}: JavaScript snippet needs a docs-check marker and an execution scenario.`);
      const id = marker[1];
      ids.push(id);
      snippets[`${file}:${id}`] = { code: block[1], file, line };
    }
    assert.deepEqual(ids, expected, `${file}: snippet coverage changed; update the execution scenarios.`);
  }
  return snippets;
}

export function quickstartWorkflowSource(snippets, renderer) {
  const get = id => snippets[`docs/agent/quickstart.md:${id}`].code;
  return `${get('imports')}
const rows = [
  { id: 'jan', month: 'Jan', revenue: 120, cost: 72 },
  { id: 'feb', month: 'Feb', revenue: 148, cost: 80 },
  { id: 'mar', month: 'Mar', revenue: 136, cost: 78 }
];
const plan = planChart(rows, { intent: 'trend', renderer: 'svg' });
async function runWorkflow() {
${get('build')}
${get('validate')}
${get(renderer)}
${renderer === 'render-headless' ? get('export') + '\nreturn { ...result, headlessPng };' : 'return chart;'}
}
const outcome = await runWorkflow();`;
}

export function runDocumentSnippets() {
  const snippets = readDocumentSnippets();
  const get = (file, id) => snippets[`${file}:${id}`].code;
  const scenarios = [
    {
      name: 'text-annotations',
      code: get('docs/agent/text-annotations.md', 'annotations') + `
assert.equal(result.valid, true);
assert.equal(warnings.length, 0);
assert.equal(annotations.length, 2);
assert.ok(annotations.every(item => item.visible));
assert.ok(svg.includes('annotation-target'));`
    },
    {
      name: 'readme-agent-workflow',
      code: get('README.md', 'agent-workflow') + `
assert.equal(agentResult.state.health.renderable, true);
assert.equal(agentResult.plan.primary, 'line');
assert.deepEqual(agentResult.explanation.lineage.recordIds, rows.map(row => row.id));
assert.equal(agentResult.chartContract.type, 'line');`
    },
    {
      name: 'quickstart-line-recipe',
      code: `const rows = [{ id: 'jan', month: 'Jan', value: 12 }, { id: 'feb', month: 'Feb', value: 24 }];
${get('docs/agent/quickstart.md', 'recipe-line')}
assert.equal(entry.validator, 'validateSpec');
assert.equal(checked.valid, true);
assert.equal(checked.spec.type, 'line');`
    },
    {
      name: 'quickstart-radar-recipe',
      code: `import { createChart, validateSpec } from '@taylorwong/ichartjs';
${get('docs/agent/quickstart.md', 'recipe-radar')}
const checked = validateSpec(spec);
assert.equal(checked.valid, true);
const chart = createChart(checked.spec);
try {
  assert.equal(chart.getState().health.renderable, true);
  assert.ok(chart.export({ type: 'svg' }).includes('<svg'));
} finally { chart.destroy(); }`
    },
    {
      name: 'quickstart-headless-workflow',
      code: quickstartWorkflowSource(snippets, 'render-headless') + `
assert.equal(outcome.state.health.renderable, true);
assert.deepEqual(outcome.explanation.lineage.recordIds, rows.map(row => row.id));
assert.equal(outcome.json.spec.type, 'line');
assert.ok(outcome.svg.includes('<svg'));
if (typeof outcome.headlessPng === 'string') assert.ok(outcome.headlessPng.startsWith('data:image/png;base64,'));
else assert.equal(outcome.headlessPng.code, 'HEADLESS_EXPORT_UNSUPPORTED');`
    }
  ];
  const directory = mkdtempSync(new URL('.doc-snippets-', import.meta.url));
  try {
    for (const scenario of scenarios) {
      const path = join(directory, `${scenario.name}.mjs`);
      writeFileSync(path, `import assert from 'node:assert/strict';\n${scenario.code}`);
      try {
        execFileSync(process.execPath, [path], { cwd: root, encoding: 'utf8', timeout: 20000, stdio: 'pipe' });
      } catch (error) {
        throw new Error(`${scenario.name}:\n${error.stderr || error.message}`, { cause: error });
      }
    }
    return { nodeScenarios: scenarios.length, snippets: Object.keys(snippets).length, browserScenarios: 2 };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runDocumentSnippets();
  console.log(`Documentation snippets passed: ${result.nodeScenarios} Node scenarios; ${result.snippets} blocks tracked. The ${result.browserScenarios} mounted scenarios run in npm run test:browser.`);
}
