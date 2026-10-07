# Agent Quickstart

Use this guide when an Agent needs to turn user data or project information into an iChart.js visualization. Use public contracts only; do not inspect renderer or chart implementation files to guess behavior.

## Install

For a new JavaScript or TypeScript project, install the runtime before importing it:

```bash
npm install @taylorwong/ichartjs@^2
```

Pin `@taylorwong/ichartjs@2.0.27` for a reproducible release. Use the package root when the Agent needs discovery and cross-family APIs; use `/standard`, `/project`, `/diagram`, or `/board` when the chart family is already known and the host wants a smaller entry.

Profile entries are independent public entry points and do not require importing the root entry first. The root entry is the complete cross-family runtime; it is not a prerequisite or a plugin registry for the focused entries. Run `node examples/consumer-quickstart.mjs` to verify the root, all Profiles, SVG output, and Board output from one consumer fixture.

## Import Surface

Choose the integration mode before starting: use the Runtime for a product component, the Coding Agent guide when modifying a repository, or the official Skill when an Agent must repeatedly plan and deliver charts. See [Usage Scenarios](usage-scenarios.md) for the input/output contract.

<!-- docs-check: imports -->
```js
import {
  createChart,
  getCapabilities,
  getChartCapability,
  getChartContract,
  inspectData,
  planChart,
  validateSpec
} from '@taylorwong/ichartjs';
```

Agents and developers use the same `@taylorwong/ichartjs` ESM entry. Agent behavior comes from the public planning APIs and optional Skill, not from a second runtime.

Additional package resources:

- `@taylorwong/ichartjs/capabilities.json`: machine-readable catalog, including per-chart exports, branding, and interaction declarations.
- `@taylorwong/ichartjs/recipes/manifest`: machine-readable index of every chart, diagram, and BoardSpec recipe, including its validator and output contract.
- `@taylorwong/ichartjs/recipes/foundational-analysis`: foundational chart recipes.
- `@taylorwong/ichartjs/recipes/project-management`: project intelligence recipes.
- `@taylorwong/ichartjs/recipes/diagrams/workflow`: diagram editing recipe.
- `skills/ichartjs/SKILL.md`: optional workflow adapter for Codex, WorkBuddy, and other Agent Skills-compatible hosts.

The current style enums are discoverable from `getCapabilities().styleSystem`: modes are `auto`, `light`, `dark`, and `contrast`; presets are `auto`, `analysis`, `dashboard`, `report`, `presentation`, `project`, and `diagram`; palettes are `auto`, `categorical`, `sequential`, `diverging`, and `status`.

The Skill is not the runtime. Install or register it only when the Agent host supports Skills; it must still call the package's public APIs and capability contract.

Recipes are declarative starting templates, not executable tasks. Copy a recipe before changing it, inject host-owned data or nodes, run the validator named by the recipe manifest, and only then call `createChart()`, `createBoard()`, or an edit preview API. The `diagrams/workflow` recipe is an edit-command template and is not directly renderable until its nodes and edges are populated.

### Load and validate a Recipe

Use the manifest to discover the public path and validator instead of guessing filenames or treating a Recipe as a ready-to-run task:

<!-- docs-check: recipe-line -->
```js
import manifest from '@taylorwong/ichartjs/recipes/manifest' with { type: 'json' };
import catalog from '@taylorwong/ichartjs/recipes/minimal-specs' with { type: 'json' };
import { validateSpec } from '@taylorwong/ichartjs';

const entry = manifest.entries.find(item => item.id === 'minimal-specs');
const candidate = structuredClone(catalog.examples.line);
candidate.data = { values: rows };
const checked = validateSpec(candidate);
if (!checked.valid) throw new Error(JSON.stringify({ validator: entry.validator, errors: checked.errors }));
```

For a BoardSpec, select the `drawings/cat` or `logo-spec` entry, import its JSON, call `validateBoardSpec()`, and then call `createBoard()`. For `diagrams/workflow`, validate both the populated Spec and each `commands[]` item before previewing an edit.

For coding environments such as Codex, read [Coding Agent Integration](coding-agent-integration.md). For application integration, read [Frontend Integration](frontend-integration.md).

For delivery-oriented tasks, read [Task Validation](task-validation.md). For mobile loading and bundle boundaries, read [Runtime Footprint](runtime-footprint.md). Use a documented profile entry for mobile or focused applications; use the root entry when the complete API is required. Profile imports are `@taylorwong/ichartjs/standard`, `/project`, `/diagram`, and `/board`.

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

#### Use registered intents only

`intent` is an exact machine token, not a natural-language sentence. Discover the allowlist from `getCapabilities().intents`, then pass values such as `trend`, `time-series`, `comparison`, `ranking`, `distribution`, `relationship`, `matrix`, `multidimensional`, `schedule`, `architecture`, or `mindmap`. Do not pass `trend over time` or `show a sales trend` directly. If an unknown token is passed, `planChart()` returns an `UNKNOWN_INTENT` warning and a safe fallback, which may select the wrong chart if the warning is ignored.

If the user gives prose, map it to a registered token before calling `planChart()` and preserve the original prose separately as user intent.

### 4. Build a JSON-Friendly Spec

For a trend or comparison with one dimension and one or more measures:

<!-- docs-check: build -->
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

Use `data: { values: rows }` as the canonical public shape. The runtime also accepts a raw row array for compatibility, and the minimal recipe catalog uses that shorter form; do not mix diagram collections into `data.values`. Diagram inputs such as `nodes`, `edges`, `lanes`, `layers`, and `boundaries` stay at the Spec top level.

#### Put options at the contract level

Keep `encoding` for field roles and series semantics. Put presentation and axis options at the Spec level:

| Need | Correct location | Common mistake |
| --- | --- | --- |
| Axis title | `xAxis.title`, `yAxis.title` | `encoding.x.title`, `encoding.y.title` |
| Axis number/date format | `xAxis.format`, `yAxis.format` | `encoding.x.format`, `encoding.y.format` |
| Data labels | `labels.enabled`, `labels.format` | `encoding.labels` |
| Legend | `legend.visible` | `encoding.legend` |
| Theme and palette | `theme.mode`, `theme.preset`, `theme.palette` | series or encoding color guesses |

`validateSpec()` reports these misplaced options as structured warnings. Repair them before presenting the chart. A single-series Cartesian chart shows the encoded field name in the legend by default; set `legend: { visible: false }` when that label adds no value.

#### Know the domain contract

Numeric Cartesian charts use a readable y-axis domain by default: `yAxis.nice` is `true`, and `yAxis.ticks` is `"auto"`. For an explicit range, use `yAxis.domain: [min, max]`; for example, `{ domain: [0, 2000], ticks: 5 }` produces a stable five-label scale. Set `yAxis.nice: false` to retain the raw data boundary. `yAxis.format` only changes display formatting. `chart.getState().axes` and `chart.explain().axes` expose `rawDomain`, resolved `domain`, `ticks`, `step`, and `policy` for Agent self-checks. `yAxis.right` accepts the same controls for a secondary numeric axis. `xAxis.min/max` and `xAxis.domain` remain unsupported because categorical/time x-axis ranges are derived from records. The other supported domain controls are chart-specific: `gauge.domain`, `heatmap.colorScale.domain`, and `radar.indicators[].min/max`. Project chart date ranges are derived from their records in the current version.

Chart-specific encoding is strict: Cartesian charts use `x`/`y`, Pie/Funnel use `category`/`value`, Gauge uses `value`, Heatmap uses `x`/`y`/`color`, and Radar uses `indicators[].field`. Missing or unsupported fields are validation errors, not silent fallbacks. Agents can inspect the complete per-chart contract with `getChartContract(type)` before constructing a Spec. Gauge Specs must declare `domain`; inspect `VALUE_CLAMPED` when a value falls outside it. Pie reports `NEGATIVE_VALUE_DROPPED` for signed values and `ZERO_TOTAL` for an empty part-to-whole result. Use the complete minimal catalog at `@taylorwong/ichartjs/recipes/minimal-specs` when starting a new chart:

<!-- docs-check: recipe-radar -->
```js
import catalog from '@taylorwong/ichartjs/recipes/minimal-specs' with { type: 'json' };

const spec = structuredClone(catalog.examples.radar);
```

For Agent self-checks, `chart.getState().health` and `chart.explain().health` expose `ready`, `degraded`, or `empty`, plus warning, suppressed-label, clamped-value, and rendered-mark metrics. `locale` defaults to `en-US`; use `locale: "zh-CN"` for localized number/date output while keeping input dates in ISO-8601 form.

### Troubleshooting by diagnostic

| Symptom | Inspect | Repair |
| --- | --- | --- |
| The selected chart type is unexpected | `plan.warnings`, `plan.fallbackUsed` | Map prose to a registered intent, then inspect `getChartContract(plan.primary)`. |
| Linked selections do not remain stable | `data.quality.issues`, `explain().lineage` | Add unique string `id` values to every input record. |
| Combined measures use different units | `data.quality.issues` for `MIXED_MEASURE_UNITS` | Confirm units and use separate axes or separate charts. |
| A chart looks usable but should not be accepted | `getState().health`, `getState().warnings` | Stop on errors; repair warnings such as `VALUE_CLAMPED`, `LABEL_TRUNCATED`, or `ZERO_TOTAL`. |
| Output choice is unclear | `getChartContract(type).exports`, `getCapabilities().export` | Use SVG for inspectable structure, PNG/JPEG for presentation, and JSON for persistence. |

### 5. Validate

<!-- docs-check: validate -->
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

Diagnostics have two phases: `validateSpec()` reports preflight contract problems, while layout-dependent warnings can appear only after `createChart()` in `chart.getState().warnings` and `chart.explain().warnings`. Always inspect both before returning a chart, especially for narrow Funnel labels.

### 6. Render

Browser rendering:

<!-- docs-check: render-browser -->
```js
const chart = createChart({ ...validation.spec, container: '#chart' });
```

Headless planning and scene creation:

<!-- docs-check: render-headless -->
```js
const chart = createChart(validation.spec);
```

Headless environment capabilities:
- JSON and SVG string export work with zero dependencies.
- PNG/JPEG raster export requires the optional `canvas` npm package; otherwise a structured `HEADLESS_EXPORT_UNSUPPORTED` error is returned.
- The on-screen renderer is decoupled from the export backend; any mounted renderer can export any supported format.
- Prefer `svg` for accessibility, DOM inspection, and diagram editing; prefer `canvas` for larger mark counts when lower DOM overhead matters.

### 7. Explain, Export, and Self-Check

<!-- docs-check: export -->
```js
// JSON export (zero-dependency, all environments)
const jsonPayload = chart.export({ type: 'json', as: 'object' });
const jsonString = chart.export({ type: 'json' });

// SVG vector export (zero-dependency, browser + headless)
const svgString = chart.export({ type: 'svg' });

// PNG raster (browser sync; Node headless uses the optional canvas package)
const pngDataUrl = typeof document !== 'undefined'
  ? chart.toDataURL('image/png')
  : null;
const headlessPng = await chart.exportAsync({ type: 'png' });

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

For deterministic lineage checks and linked updates, give every input row a stable string `id`. Without one, the runtime uses a positional fallback such as `record-0`; that is sufficient for a local render but should not be treated as a durable business identity.

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
