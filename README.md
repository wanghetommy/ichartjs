# iChart.js 2.0 RC.1

iChart.js 2.0 introduces an Agent-friendly, renderer-independent chart core. The legacy 1.x implementation is retained separately under `archive/ichartjs-1.x/` for reference only.

## Current scope

- `Chart Spec` with JSON-friendly configuration.
- Data normalization and `inspectData()`.
- Canvas and SVG renderers.
- `line`, `area`, `bar`, `column`, and `pie` charts.
- Basic `hover`, `click`, HTML tooltip, resize, PNG/SVG export.
- Agent discovery with `getCapabilities()`, `inspectData()`, and `recommend()`.
- Beta APIs for data transforms, selection state, zoom/pan, and scale primitives.
- Iteration 2 foundations for themes, accessibility, plugins, responsive resize, scatter, funnel, and gauge charts.
- Iteration 3 project-management views (`gantt`, `timeline`, `milestone`, `burndown`) and process diagrams (`flow`, `swimlane`).
- Geographic charts and 3D rendering are explicitly deferred.
- No external runtime dependency.

## Example

```js
import { createChart } from './src/index.mjs';

const chart = createChart({
  container: '#chart',
  type: 'line',
  renderer: 'svg',
  data: { values: [
    { month: 'Jan', sales: 120 },
    { month: 'Feb', sales: 180 }
  ] },
  encoding: {
    x: { field: 'month', type: 'category' },
    y: { field: 'sales', type: 'quantitative' }
  },
  title: { text: 'Monthly Sales' }
});

chart.on('click', event => console.log(event.datum));
```

## Development

```bash
npm test
npm run check
```

This is `2.0.0-rc.1`. Framework adapters, external persistence, and advanced diagram/project-intelligence features remain outside the RC runtime.

Agent documentation lives in `docs/agent/`; machine-readable recipes live in `agent-recipes/`; the small browser demos are only for visual verification.

The complete Iteration 3 scope, task list, demo deliverables, and verification criteria are documented in `docs/agent/iteration-3.md`.

The forward roadmap for production hardening, diagram editing, and project intelligence is documented in `docs/agent/roadmap.md`.

The RC gate report is documented in `docs/agent/rc-1-acceptance.md`; run `npm run rc:check` for the repeatable local checks.

Iteration 4 implements versioned business data schemas, typed edit commands, deterministic previews, guarded local commits, revision checks, audit metadata, change sets, undo/redo, and recipe validation. External persistence and authorization remain host responsibilities. See `docs/agent/iteration-4.md` and the running demo at `http://localhost:3000/playground/editing`.

`examples/index.html` is a standalone demo and can be opened directly with `file://`. `examples/module.html` is the real ESM integration demo and must be served over HTTP because browsers block local ES module imports.
