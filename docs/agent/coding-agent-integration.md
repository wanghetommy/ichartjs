# Coding Agent Integration

Use this guide with Codex and similar Agents that can read a repository, edit JavaScript, execute tests, and open a local browser preview.

## Responsibility Boundary

iChart.js is a JavaScript UI component library. The coding Agent writes or updates the host application and calls the public `ichartjs` ESM API. The optional Skill provides workflow guidance only; it does not introduce a second runtime or service.

Do not add a CLI, MCP server, HTTP API, or Python adapter to complete an ordinary charting task.

## Setup

Inside a consumer project:

```bash
npm install github:wanghetommy/ichartjs#v2.0.0
```

Do not install the unscoped npm registry package named `ichartjs`; it is currently an npm security holding package. Use the GitHub source until the project publishes under a confirmed npm scope.

Inside this repository:

```bash
npm install
npm run playground
```

Optional Codex Skill installation from a repository checkout:

```bash
cp -R skills/ichartjs "${CODEX_HOME:-$HOME/.codex}/skills/"
```

## Agent Request Pattern

A useful request is explicit about data, intent, output, and acceptance:

```text
Use iChart.js to inspect this dataset, choose and validate an appropriate chart,
add it to the current web page, run the focused tests, and return the exact preview URL.
Keep assumptions and data-quality warnings visible.
```

If the Skill is installed, the request may start with `Use $ichartjs`.

## Required Workflow

1. Inspect existing application structure and local instructions.
2. Import public APIs from `ichartjs`.
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
import { createChart, inspectData, planChart, validateSpec } from 'ichartjs';

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

- The application imports only `ichartjs`, not source internals.
- The chosen chart exists in capabilities.
- Validation passes before rendering.
- Warnings and assumptions remain visible.
- Stable source IDs remain in explanation lineage.
- The user receives a working preview URL.
