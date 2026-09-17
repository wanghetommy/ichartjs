# iChart.js 2.0

iChart.js is an Agent-first, renderer-independent visualization runtime. An Agent can inspect data, choose an appropriate chart, generate and validate a JSON-friendly Spec, render it with SVG or Canvas, and explain the result through public APIs.

## For AI Agents

Do not guess chart types or configuration fields from source code. Use the public planning contract:

```text
getCapabilities
  → inspectData
  → planChart
  → build Spec
  → validateSpec
  → createChart
  → chart.explain + chart.getState
```

### Agent entry points

| Need | Entry point |
| --- | --- |
| Runtime and Agent planning APIs | `ichartjs` |
| Machine-readable capability manifest | `ichartjs/capabilities.json` |
| Intent and chart recipes | `ichartjs/recipes/*` |
| Agent quickstart | [`docs/agent/quickstart.md`](docs/agent/quickstart.md) |
| Chinese quickstart | [`docs/agent/zh-CN/quickstart.md`](docs/agent/zh-CN/quickstart.md) |
| Coding Agent integration | [`docs/agent/coding-agent-integration.md`](docs/agent/coding-agent-integration.md) |
| Frontend integration | [`docs/agent/frontend-integration.md`](docs/agent/frontend-integration.md) |
| Visual style and themes | [`docs/agent/theme-guide.md`](docs/agent/theme-guide.md) |
| Official Agent Skill for Codex and WorkBuddy | [`skills/ichartjs/SKILL.md`](skills/ichartjs/SKILL.md) |

### Install

```bash
npm install @taylorwong/ichartjs@^2
```

As a fallback for environments without npm access, install directly from GitHub: `npm install github:wanghetommy/ichartjs#v2.0.1`.

### Optional Agent Skill

The runtime API remains the source of truth; the Skill only teaches and orchestrates the workflow. Codex, WorkBuddy, and other Agent Skills-compatible hosts can import the same versioned Skill from:

```text
https://github.com/wanghetommy/ichartjs/tree/master/skills/ichartjs
```

From a repository checkout, install it into Codex with:

```bash
cp -R skills/ichartjs "${CODEX_HOME:-$HOME/.codex}/skills/"
```

WorkBuddy users can import or register the same `skills/ichartjs` folder through the host's Skill interface. Package consumers can copy it from `node_modules/ichartjs/skills/ichartjs` into their Agent host's Skill directory. After installation, invoke it as `$ichartjs` when the host supports named Skill invocation, or select the `ichartjs` Skill in the host UI.

### Agent workflow

```js
import {
  createChart,
  getCapabilities,
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
- Agent Workbench: `http://localhost:3000/playground/agent-workbench.html`
- Complete Gallery: `http://localhost:3000/playground/project-gallery.html`
- Theme Gallery: `http://localhost:3000/playground/theme-gallery.html`
- Project Intelligence: `http://localhost:3000/playground/project-intelligence.html`
- Diagram Editor: `http://localhost:3000/playground/diagram-editor.html`

## For Developers

Use the main package entry when the chart type and Spec are already known:

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

The public package includes ESM exports, TypeScript declarations, Agent documentation, manifests, recipes, examples, and the official Skill. The runtime has no external production dependency.

## Supported Surface

- Foundational charts: Line, Area, Bar, Column, Pie/Donut, Scatter, Funnel, Gauge, Heatmap, and Radar.
- Project views: Gantt, Timeline, Milestone, and Burndown.
- Diagrams: Flow and Swimlane with groups, ports, routing, and controlled editing.
- Renderers: SVG and Canvas.
- Agent contracts: capability discovery, data inspection, planning, validation, explanation, lineage, diagnostics, and safe editing.
- Branding signature: low-contrast `Powered by iChart.js` bottom-right watermark, consistent across live view and all export formats; controlled via `branding` on Spec/Theme.
- Exports: JSON (spec + runtime state, all environments), SVG (vector, zero-dependency headless), PNG/JPEG (raster, dual-engine, browser native + headless with optional `canvas` dependency), plus browser `downloadPNG/SVG/JSON` helpers.
- Deferred: geographic charts and 3D rendering.

## Development

```bash
npm run agent:check
npm run playground
```

Start with [`docs/agent/quickstart.md`](docs/agent/quickstart.md). Detailed runtime, charting, project, diagram, and editing contracts live in [`docs/agent/`](docs/agent/).

Contribution requirements are in [`CONTRIBUTING.md`](CONTRIBUTING.md). Report vulnerabilities privately according to [`SECURITY.md`](SECURITY.md).
