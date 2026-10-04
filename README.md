# iChart.js 2.0

iChart.js 2.0 is an Agent-first, renderer-independent visualization runtime. An Agent can inspect data, choose an appropriate chart, generate and validate a JSON-friendly Spec, render it with SVG or Canvas, and explain the result through public APIs.

Use it in one of three ways: integrate the Runtime into a web project, let a Coding Agent modify a project, or install the official Skill so an Agent can orchestrate chart selection and delivery. The Runtime produces interactive pages, SVG/PNG/JPEG artifacts, JSON checkpoints, and integration code; the Skill does not replace the Runtime.

<p align="center">
  <img src="docs/assets/github-promo.gif" alt="iChart.js Agent-first chart workflow" width="1280">
</p>

## For AI Agents

Do not guess chart types or configuration fields from source code. Use the public planning contract:

```text
getCapabilities
  → inspectData
  → planChart
  → getChartContract
  → build Spec
  → validateSpec
  → createChart
  → chart.explain + chart.getState
```

### Agent entry points

| Need | Entry point |
| --- | --- |
| Runtime and Agent planning APIs | `@taylorwong/ichartjs` |
| Standard chart profile | `@taylorwong/ichartjs/standard` |
| Project chart profile | `@taylorwong/ichartjs/project` |
| Diagram profile | `@taylorwong/ichartjs/diagram` |
| Freeform Board profile | `@taylorwong/ichartjs/board` |
| Machine-readable capability manifest | `@taylorwong/ichartjs/capabilities.json` |
| Machine-readable Recipe manifest | `@taylorwong/ichartjs/recipes/manifest` |
| Intent and chart recipes | `@taylorwong/ichartjs/recipes/*` |
| Agent quickstart | [`docs/agent/quickstart.md`](docs/agent/quickstart.md) |
| Usage scenarios and output formats | [`docs/agent/usage-scenarios.md`](docs/agent/usage-scenarios.md) |
| Chinese quickstart | [`docs/agent/zh-CN/quickstart.md`](docs/agent/zh-CN/quickstart.md) |
| Coding Agent integration | [`docs/agent/coding-agent-integration.md`](docs/agent/coding-agent-integration.md) |
| Frontend integration | [`docs/agent/frontend-integration.md`](docs/agent/frontend-integration.md) |
| Visual style and themes | [`docs/agent/theme-guide.md`](docs/agent/theme-guide.md) |
| Chart and page preferences | [`docs/agent/theme-guide.md`](docs/agent/theme-guide.md#chart-and-page-preferences) |
| Natural-language chart changes | [`docs/agent/conversational-workflow.md`](docs/agent/conversational-workflow.md) |
| Agent task validation and output contract | [`docs/agent/task-validation.md`](docs/agent/task-validation.md) |
| Runtime footprint and mobile loading | [`docs/agent/runtime-footprint.md`](docs/agent/runtime-footprint.md) |
| Official Agent Skill for Codex and WorkBuddy | [`skills/ichartjs/SKILL.md`](skills/ichartjs/SKILL.md) |

### Install

```bash
npm install @taylorwong/ichartjs@^2
```

If the npm registry is unavailable, install directly from GitHub as a fallback: `npm install github:wanghetommy/ichartjs#v2.0.24`.

For a reproducible release-pinned install, use `npm install @taylorwong/ichartjs@2.0.24` instead of the moving `@^2` range.

### Optional Agent Skill

The runtime API remains the source of truth; the Skill only teaches and orchestrates the workflow. Codex, WorkBuddy, and other Agent Skills-compatible hosts can import the same versioned Skill from:

```text
https://github.com/wanghetommy/ichartjs/tree/master/skills/ichartjs
```

Install the latest Skill with the standard Agent Skills CLI:

```bash
npx skills add wanghetommy/ichartjs --skill ichartjs
```

For a non-interactive global Codex installation:

```bash
npx skills add wanghetommy/ichartjs --skill ichartjs --agent codex --global --yes
```

For a release-pinned installation, use `npx skills add https://github.com/wanghetommy/ichartjs/tree/v2.0.24/skills/ichartjs --agent codex --global --yes`. WorkBuddy users can import the same tagged `skills/ichartjs` URL through the host's Skill interface; do not assume a `--agent workbuddy` adapter unless the installed CLI declares it. Package consumers can still copy `node_modules/@taylorwong/ichartjs/skills/ichartjs` as a manual fallback. After installation, invoke `$ichartjs` when named Skill invocation is supported, or select `ichartjs` in the host UI.

### Agent workflow

<!-- docs-check: agent-workflow -->
```js
import {
  createChart,
  getCapabilities,
  getChartContract,
  inspectData,
  planChart,
  validateSpec
} from '@taylorwong/ichartjs';

const rows = [
  { id: 'jan', month: 'Jan', revenue: 120 },
  { id: 'feb', month: 'Feb', revenue: 148 },
  { id: 'mar', month: 'Mar', revenue: 136 }
];

const capabilities = getCapabilities();
const inspection = inspectData(rows);
const plan = planChart(rows, { intent: 'trend', renderer: 'svg' });
const contract = getChartContract(plan.primary);

const candidate = {
  type: plan.primary,
  renderer: 'svg',
  data: { values: rows },
  encoding: {
    x: { field: plan.suggestedEncodings.dimension },
    y: { field: plan.suggestedEncodings.measure }
  },
  accessibility: { enabled: true },
  theme: {
    mode: 'auto',
    preset: plan.styleRecommendation.preset,
    palette: plan.styleRecommendation.palette
  }
};

const validation = validateSpec(candidate);
if (!validation.valid) throw new Error(JSON.stringify(validation.errors));

const chart = createChart(validation.spec);
const agentResult = {
  contractVersion: capabilities.contractVersion,
  chartContract: contract,
  inspection,
  plan,
  explanation: chart.explain(),
  state: chart.getState()
};

chart.destroy();
```

Run the complete executable workflow with:

```bash
npm run example:agent
```

Source: [`examples/agent-workflow.mjs`](examples/agent-workflow.mjs).

### Agent rules

- Call `getCapabilities()` instead of inventing chart types or options.
- Treat `inspectData()` field roles and units as inferences, not business truth.
- Stop and report `plan.requiredFields` when required data is missing.
- Call `validateSpec()` before every render or edit.
- Preserve stable source record IDs for selection, linking, and explanation.
- Return assumptions, warnings, unsupported requests, and validation diagnostics to the user.
- Use `chart.explain()` and `chart.getState()` for self-checking.
- Never generate geographic or 3D Specs unless the capability contract adds them.

### Integration boundary

iChart.js is a JavaScript UI component library. Coding Agents use the same ESM API as developers and may optionally load the Skill for workflow guidance. A daily-use assistant can use iChart.js only inside a host web application that runs JavaScript; integrating a non-coding assistant is the host application's responsibility. The core package does not add a CLI, MCP server, HTTP service, or Python runtime.

## Preview and Acceptance

Start the cache-safe local server:

```bash
npm run playground
```

- Playground Home: `http://localhost:3000/playground/index.html`
- GitHub Promo: `http://localhost:3000/playground/github-promo.html`
- Agent Workbench: `http://localhost:3000/playground/agent-workbench.html`
- Complete Gallery: `http://localhost:3000/playground/project-gallery.html`
- Profile Loading: `http://localhost:3000/playground/profile-loading.html`
- Foundational Gallery: `http://localhost:3000/playground/foundational-gallery.html`
- Theme Gallery: `http://localhost:3000/playground/theme-gallery.html`
- Page Preferences: `http://localhost:3000/playground/preferences-lab.html`
- Freeform Board: `http://localhost:3000/playground/canvas-board.html`
- Business Editing: `http://localhost:3000/playground/editing.html`
- Project Intelligence: `http://localhost:3000/playground/project-intelligence.html`
- Diagram Editor: `http://localhost:3000/playground/diagram-editor.html`
- Interaction Lab: `http://localhost:3000/playground/interaction-lab.html`
- Accessibility Lab: `http://localhost:3000/playground/accessibility-lab.html`
- Performance Lab: `http://localhost:3000/playground/performance-lab.html`

## For Developers

Use the main package entry when the chart type and Spec are already known:

<!-- docs-check: browser-chart -->
```js
import { createChart } from '@taylorwong/ichartjs';

const chart = createChart({
  container: '#chart',
  type: 'line',
  renderer: 'svg',
  data: {
    values: [
      { id: 'jan', month: 'Jan', sales: 120 },
      { id: 'feb', month: 'Feb', sales: 180 }
    ]
  },
  encoding: {
    x: { field: 'month', type: 'category' },
    y: { field: 'sales', type: 'quantitative' }
  },
  title: { text: 'Monthly Sales' }
});
```

Recipes are declarative starting templates, not executable tasks. Agents should copy a recipe, inject host-owned data or nodes, validate it with the validator declared in `@taylorwong/ichartjs/recipes/manifest`, and only then render or preview an edit. The public package includes ESM exports, TypeScript declarations, Agent documentation, manifests, recipes, examples, and the official Skill. The runtime has no external production dependency.

## Supported Surface

- Foundational charts: Line, Area, Bar, Column, Pie/Donut, Scatter, Funnel, Gauge, Heatmap, and Radar.
- Project views: Gantt, Timeline, Milestone, and Burndown.
- Diagrams: Flow, Swimlane, Architecture, and Mindmap with groups, ports, routing, and controlled editing.
- Freeform Board: bounded image, text, shape, connector, and embedded-chart composition with SVG/Canvas output.
- Renderers: SVG and Canvas.
- Agent contracts: capability discovery, data inspection, planning, validation, explanation, lineage, diagnostics, and safe editing.
- Branding signature: low-contrast `Powered by iChart.js` bottom-right watermark, consistent across live view and all export formats; controlled via `branding` on Spec/Theme.
- Exports: JSON (spec + runtime state, all environments), SVG (vector, zero-dependency headless), PNG/JPEG (raster, dual-engine, browser native + headless with optional `canvas` dependency), plus browser `downloadPNG/SVG/JSON` helpers.
- Deferred: geographic charts and 3D rendering.

## Development

Checks + playground (for all contributors):

```bash
npm run agent:check
npm run playground
```

README and Quickstart JavaScript snippets are extracted from Markdown and executed by `npm run docs:snippets` (Node) and `npm run test:browser` (DOM mounting). Node snippet checks also run in `npm test` and `npm run agent:check` on CI. Invisible `docs-check` markers bind each snippet to its test scenario; new JavaScript blocks must be registered rather than silently skipped. These checks never run installation, Skill setup, or release shell commands from the documentation.

### Release (AUTHOR ONLY)

Publishing to npm (`@taylorwong/ichartjs`) and merging `develop → master` are restricted to the package author (GitHub + npm account `taylorwong`) due to 2FA and access control.

Contributors should:
1. Open PRs / commit only to `develop`
2. Ensure `npm run agent:check` and `npm test` are green

Full author-only release SOP (preconditions, release sequence, must-not rules, and rollback procedure):
👉 [`docs/agent/development/release-sop.md`](docs/agent/development/release-sop.md)

Start with [`docs/agent/quickstart.md`](docs/agent/quickstart.md). Detailed runtime, charting, project, diagram, and editing contracts live in [`docs/agent/`](docs/agent/).

Contribution requirements are in [`CONTRIBUTING.md`](CONTRIBUTING.md). Report vulnerabilities privately according to [`SECURITY.md`](SECURITY.md).
