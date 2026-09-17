# Agent Quickstart

Use this guide when an Agent needs to turn user data or project information into an iChart.js visualization. Use public contracts only; do not inspect renderer or chart implementation files to guess behavior.

## Import Surface

```js
import {
  createChart,
  getCapabilities,
  getChartCapability,
  inspectData,
  planChart,
  validateSpec
} from '@taylorwong/ichartjs';
```

Agents and developers use the same `ichartjs` ESM entry. Agent behavior comes from the public planning APIs and optional Skill, not from a second runtime.

Additional package resources:

- `ichartjs/capabilities.json`: machine-readable catalog, including per-chart exports, branding, and interaction declarations.
- `ichartjs/recipes/foundational-analysis`: foundational chart recipes.
- `ichartjs/recipes/project-management`: project intelligence recipes.
- `ichartjs/recipes/diagrams/workflow`: diagram editing recipe.
- `skills/ichartjs/SKILL.md`: optional workflow adapter for Codex, WorkBuddy, and other Agent Skills-compatible hosts.

The Skill is not the runtime. Install or register it only when the Agent host supports Skills; it must still call the package's public APIs and capability contract.

For coding environments such as Codex, read [Coding Agent Integration](coding-agent-integration.md). For application integration, read [Frontend Integration](frontend-integration.md).

## Standard Workflow

```text
discover → inspect → plan → build → validate → render → explain, export, self-check
```

### 1. Discover

Call `getCapabilities()` before choosing a chart. Use `getChartCapability(type)` to verify required roles, interactions, renderers, feature status, exports, and practical limits for a candidate type.

### 2. Inspect

Call `inspectData(rows)` and review:

- field roles and inferred types;
- stable identifier fields;
- dimensions, measures, and temporal coverage;
- cardinality, missing values, and invalid values;
- warnings that must remain visible to the user.

Inferred roles and units are suggestions. Do not convert them into business facts without user-provided semantics.

### 3. Plan

Call `planChart(rows, { intent, renderer })`. Read the full result rather than only `primary`:

- `alternatives` and `confidence`;
- `reasons` and `suggestedEncodings`;
- `requiredFields`;
- `assumptions` and `warnings`;
- `unsupportedRequests` and `nextActions`;
- the selected per-chart capability profile;
- `styleRecommendation`, including the resolved preset, mode, palette, reasons, and warnings.

Stop before rendering when `requiredFields` is not empty. Ask for the missing information or choose a supported alternative without fabricating data.

### 4. Build a JSON-Friendly Spec

For a trend or comparison with one dimension and one or more measures:

```js
const y = [plan.suggestedEncodings.measure, plan.suggestedEncodings.secondaryMeasure]
  .filter(Boolean)
  .map(field => ({ field, type: 'quantitative' }));

const spec = {
  type: plan.primary,
  renderer: 'svg',
  data: { values: rows },
  encoding: {
    x: { field: plan.suggestedEncodings.dimension },
    y: y.length === 1 ? y[0] : y
  },
  interaction: { tooltip: true, hover: true, keyboard: true },
  accessibility: { enabled: true },
  // branding: true is the default; set explicitly branding: false to disable signature + extra bottom padding
  theme: {
    mode: 'auto',
    preset: plan.styleRecommendation.preset,
    palette: plan.styleRecommendation.palette
  }
};
```

Use the selected capability and recipes for Pie, Gauge, Heatmap, Radar, project views, and diagrams because their required encodings differ.

### 5. Validate

```js
const validation = validateSpec(spec);
if (!validation.valid) {
  return {
    status: 'needs-repair',
    errors: validation.errors,
    warnings: validation.warnings,
    normalizations: validation.normalizations
  };
}
```

Do not silently discard diagnostics. Preserve stable `code`, `path`, `message`, `expected`, and `suggestion` fields in Agent output and automated repair loops.

### 6. Render

Browser rendering:

```js
const chart = createChart({ ...validation.spec, container: '#chart' });
```

Headless planning and scene creation:

```js
const chart = createChart(validation.spec);
```

Headless environment capabilities:
- JSON and SVG string export work with zero dependencies.
- PNG/JPEG raster export requires the optional `canvas` npm package; otherwise a structured `HEADLESS_EXPORT_UNSUPPORTED` error is returned.
- The on-screen renderer is decoupled from the export backend; any mounted renderer can export any supported format.

### 7. Explain, Export, and Self-Check

```js
// JSON export (zero-dependency, all environments)
const jsonPayload = chart.export({ type: 'json', as: 'object' });
const jsonString = chart.export({ type: 'json' });

// SVG vector export (zero-dependency, browser + headless)
const svgString = chart.export({ type: 'svg' });

// PNG raster (browser always works; headless requires the canvas package)
const pngDataUrl = typeof document !== 'undefined'
  ? chart.toDataURL('image/png')
  : null;

// Browser-only convenience downloads
if (typeof document !== 'undefined') {
  chart.downloadPNG();
  chart.downloadSVG();
  chart.downloadJSON();
}

const result = {
  plan,
  explanation: chart.explain(),
  state: chart.getState(),
  json: jsonPayload,
  svg: svgString,
  png: pngDataUrl
};

chart.destroy();
```

Before returning a result, verify:

- the selected type exists in capabilities;
- validation passed;
- source record IDs remain present in explanation lineage;
- warnings and assumptions are visible;
- requested interactions are supported;
- the branding on/off state is documented so live view and exports stay consistent;
- the preview URL or output artifact (JSON/SVG/PNG/JPEG) is provided to the user.

## Branding (Signature) Defaults

- Default `branding: true`: a low-contrast `Powered by iChart.js` signature appears in the bottom-right corner, synchronized across live rendering, PNG/SVG raster export, and JSON state persistence.
- Disable explicitly with `branding: false` on the Spec or Theme: the signature text is removed from all surfaces, and the reserved bottom padding is released.
- Consistency is enforced by a single gate inside `buildScene()`; live view and every export format remain 100% aligned.

## Complete Executable Example

Run:

```bash
npm run example:agent
```

Read [`../../examples/agent-workflow.mjs`](../../examples/agent-workflow.mjs) for a complete inspect, plan, build, validate, render, explain, export, and destroy workflow.

For interactive verification, start `npm run playground` and open `http://localhost:3000/playground/agent-workbench.html`. The top-right Export buttons on every Gallery page exercise the PNG, SVG, and JSON download flows.

For visual style selection and live switching, read [Visual Style and Themes](theme-guide.md) and open `http://localhost:3000/playground/theme-gallery.html`.

## Guardrails

- Prefer Bar over Pie when category cardinality is high.
- Require explicit indicator domains for Radar, especially with mixed units.
- Distinguish missing Heatmap cells from zero values.
- Do not infer schedule dates, dependencies, working calendars, or forecast confidence.
- Do not enable interactions that the chart capability does not declare.
- Do not generate Map or 3D Specs; those types are outside the current contract.
- Treat structured export errors (valid=false, code=...) as first-class diagnostics; do not silently fall back to a different format.
