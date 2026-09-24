# Coding Agent Integration

Use this guide with Codex, WorkBuddy, and similar Agents that can read a repository, edit JavaScript, execute tests, and open a local browser preview.

For the complete choice between project integration, one-off artifacts, Skill orchestration, and CI output, read [Usage Scenarios](usage-scenarios.md).

## Responsibility Boundary

iChart.js is a JavaScript UI component library. The coding Agent writes or updates the host application and calls the public `@taylorwong/ichartjs` ESM API. The optional Skill provides workflow guidance only; it does not introduce a second runtime or service.

Do not add a CLI, MCP server, HTTP API, or Python adapter to complete an ordinary charting task.

## Setup

Inside a consumer project:

```bash
npm install @taylorwong/ichartjs@^2
```

Do not install the unscoped npm registry package named `ichartjs`; it is an npm security holding package and is not this project. The published package is `@taylorwong/ichartjs`.

Inside this repository:

```bash
npm install
npm run playground
```

Install the official Skill with the standard Agent Skills CLI:

```bash
npx skills add wanghetommy/ichartjs --skill ichartjs
```

For global non-interactive Codex setup, append `--agent codex --global --yes`. To pin the released workflow, install `https://github.com/wanghetommy/ichartjs/tree/v2.0.15/skills/ichartjs`. WorkBuddy can import that tagged directory through its Skill interface; only use a host-specific `--agent` value when the installed CLI declares it.

Verify discovery with `npx skills add wanghetommy/ichartjs --list`; the result should include `ichartjs`.

## Agent Request Pattern

A useful request is explicit about data, intent, output, and acceptance:

```text
Use iChart.js to inspect this dataset, choose and validate an appropriate chart,
add it to the current web page, run the focused tests, and return the exact preview URL.
Keep assumptions and data-quality warnings visible.
```

If the host supports named Skill invocation, the request may start with `Use $ichartjs`; otherwise select or name the `ichartjs` Skill through the host interface.

## Required Workflow

1. Inspect existing application structure and local instructions.
2. Import public APIs from `@taylorwong/ichartjs`.
3. Call `getCapabilities()`, `inspectData()`, and `planChart()`.
4. Stop or ask for input when required fields are missing.
5. Build a JSON-friendly Spec and call `validateSpec()`.
6. Mount the chart through the application's normal component lifecycle.
7. Verify `chart.explain()`, `chart.getState()`, warnings, and record lineage.
8. Destroy replaced charts and event handlers.
9. Run focused tests, then broader checks.
10. Return the exact local preview URL and manual acceptance actions.

## Minimal Coding-Agent Example

```js
import { createChart, inspectData, planChart, validateSpec } from '@taylorwong/ichartjs';

const inspection = inspectData(rows);
const plan = planChart(rows, { intent: 'comparison' });
const candidate = {
  type: plan.primary,
  data: { values: rows },
  encoding: {
    x: { field: plan.suggestedEncodings.dimension },
    y: { field: plan.suggestedEncodings.measure }
  }
};
const validation = validateSpec(candidate);
if (!validation.valid) throw new Error(JSON.stringify(validation.errors));
const chart = createChart({ ...validation.spec, container: '#chart' });
```

Use `examples/agent-workflow.mjs` for the full executable lifecycle.

## Acceptance

- The application imports only `@taylorwong/ichartjs`, not source internals.
- The chosen chart exists in capabilities.
- Validation passes before rendering.
- Warnings and assumptions remain visible.
- Stable source IDs remain in explanation lineage.
- The user receives a working preview URL.

The final Agent response should also state whether the deliverable is a live component, code change, SVG/PNG/JPEG artifact, JSON checkpoint, or a combination of these.
