---
name: ichartjs
description: Plan, validate, render, explain, and safely edit iChart.js visualizations from tabular, project, or diagram data. Use when Codex needs to choose a chart, create or repair an iChart.js Spec, build a browser preview, produce Gantt or project analytics, create Flow or Swimlane diagrams, or verify visualization accessibility, diagnostics, lineage, and runtime state.
---

# iChart.js

Use the public Agent contract as the source of truth. Do not infer capabilities from renderer internals or duplicate chart-selection logic in generated code.

Read the [usage scenarios](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/usage-scenarios.md) when the request is ambiguous about whether the output should be a live project component, a Coding Agent change, a Skill-generated artifact, or a scheduled report.

## Source and Runtime Setup

- Official repository: `https://github.com/wanghetommy/ichartjs`
- Official Skill source: `https://github.com/wanghetommy/ichartjs/tree/master/skills/ichartjs`
- Supported Skill hosts include Codex, WorkBuddy, and other Agent Skills-compatible environments.

Recommended installation:

```bash
npx skills add wanghetommy/ichartjs --skill ichartjs
```

Use `--agent codex --global --yes` for global non-interactive Codex installation. Use the tagged directory `https://github.com/wanghetommy/ichartjs/tree/v2.0.9/skills/ichartjs` when reproducibility matters. WorkBuddy can import the same directory through its Skill interface; do not assume a `--agent workbuddy` adapter unless the installed CLI declares it.

The Skill is a workflow adapter, not the chart runtime. If the current JavaScript or TypeScript project does not already depend on iChart.js, install the matching runtime from GitHub:

```bash
npm install @taylorwong/ichartjs@^2
```

Do not install the unscoped npm registry package named `ichartjs`; it is currently a security holding package and is not this project.

## Workflow

1. Locate the package or repository root. Read `docs/agent/quickstart.md` when available.
2. Call `getCapabilities()` before selecting a chart or interaction.
3. Call `inspectData()` and preserve stable record IDs.
4. Discover `getCapabilities().intents`; map natural-language requests to an exact registered token before calling `planChart(data, { intent, renderer, context })`.
5. Inspect the complete planning result, including `styleRecommendation`, warnings, and fallback status.
6. Stop when `requiredFields` is non-empty; request data or explain a supported alternative.
7. Build a JSON-serializable Spec using `suggestedEncodings`, the selected capability, and an applicable recipe.
8. Use chart-specific channels: Cartesian `x`/`y`, Pie/Funnel `category`/`value`, Gauge `value`, Heatmap `x`/`y`/`color`, and Radar `indicators[].field`. To load a recipe, use `import catalog from '@taylorwong/ichartjs/recipes/minimal-specs' with { type: 'json' }` and select `catalog.examples[type]`.
9. Keep titles/formats under `xAxis`/`yAxis`, labels under `labels`, and legend under `legend`; do not place them inside `encoding`.
10. Call `validateSpec()` before rendering. Repair `UNSUPPORTED_ENCODING_CHANNEL`, `MISSING_ENCODING_FIELD`, `MISSING_GAUGE_DOMAIN`, `UNKNOWN_INTENT`, misplaced-option, and unsupported-axis warnings before presenting the chart.
11. Call `createChart()` only after validation succeeds. Gauge Specs must declare a meaningful `domain`.
12. Self-check with `chart.explain()`, `chart.getState()`, `health.renderable`, and JSON export. Treat `VALUE_CLAMPED`, `LABELS_SUPPRESSED`, `NEGATIVE_VALUE_DROPPED`, and `ZERO_TOTAL` as material diagnostics to report.
12. Provide an exact preview URL or artifact path and report assumptions, warnings, and deferred checks.
13. Prefer `theme: { mode: 'auto', preset, palette }`; preserve explicit user style choices and use `chart.setTheme()` for live switching.
14. For post-creation visual changes, call `getPreferenceCapabilities(chartType, { locale })`, validate the patch with `validatePreferences()`, apply it with `chart.setPreferences(..., { source: 'agent' })`, and verify `chart.getState().preferences`.

Use `@taylorwong/ichartjs` for package imports. Use `examples/agent-workflow.mjs` as the executable baseline when working in the repository.

## Task Routing

Route by requested output:

- **Live product component**: modify the host JavaScript project and mount `createChart()`; return changed files and the host preview URL.
- **Coding Agent change**: inspect the repository, use the Runtime, run focused checks, and return the validated Spec plus changed files.
- **One-off artifact**: generate SVG/JSON directly; use browser PNG export or `exportAsync()` with optional `canvas` for Node PNG/JPEG.
- **Project or Diagram workflow**: load the matching scenario guide and preserve all stable IDs.
- **CI/report output**: keep JSON as the reproducible checkpoint and SVG/PNG as presentation artifacts.

- For standard data analysis, read `references/chart-selection.md` and use foundational recipes.
- For Gantt, Timeline, Milestone, Burndown, capacity, release, risk, or aging, use project capabilities and `agent-recipes/project-management.json`.
- For Flow or Swimlane, preserve node, edge, lane, group, and port IDs; use diagram recipes and validated edit commands.
- For business edits, preview first, preserve the preview ID and revision, require confirmation when declared, then commit or reject atomically.
- For browser deliverables, start `npm run playground` and return the exact maintained Playground URL.
- Release workflow (npm publish + develop→master merge) is **AUTHOR ONLY**. Read the [release SOP](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/development/release-sop.md). Never initiate any release step unless the author explicitly instructs.

## Guardrails

- Never invent fields, units, dates, dependencies, calendar rules, domains, or forecast confidence.
- Never silently drop validation errors, warnings, assumptions, normalizations, or unsupported requests.
- Treat `getCapabilities().intents` as an allowlist; never pass a natural-language sentence as `planChart().intent`.
- If planning returns `fallbackUsed: true`, use `intentSuggestions` to remap or ask for confirmation; never silently accept the fallback chart.
- Keep axis titles/formats under `xAxis`/`yAxis`, labels under `labels`, and legend settings under `legend`.
- Repair `UNKNOWN_INTENT`, misplaced-option, and unsupported-axis warnings before presenting a chart. For numeric y-axes, prefer the default readable domain; use `yAxis.domain: [min, max]` for an explicit range, `yAxis.nice: false` for raw boundaries, and `yAxis.ticks` for a stable label count.
- Add stable string `id` values to tabular rows when lineage or linked updates are part of the deliverable.
- Avoid Pie for high-cardinality categories; prefer Bar for comparison.
- Require explicit Radar domains when units differ.
- Distinguish missing Heatmap values from zero.
- Set `locale` explicitly when output needs localization; the default is `en-US`, and input dates must be ISO-8601 strings.
- Use categorical, sequential, diverging, or status palettes by data semantics; do not invent arbitrary color sets or rely on color alone.
- Surface theme contrast diagnostics and high-cardinality color warnings.
- Do not generate Map or 3D Specs unless capabilities explicitly add them.
- Prefer SVG for accessibility, DOM interaction, and diagram editing; prefer Canvas for larger mark counts when supported.
- Destroy replaced charts and verify lifecycle cleanup.

## Deliverable

Return:

- the selected chart and reasons;
- the validated Spec or structured repair request;
- assumptions, warnings, and unsupported requests;
- explanation lineage and runtime self-check;
- changed files when coding;
- the exact preview URL and acceptance actions.

Read `references/agent-contract.md` for the required API sequence and response checklist. Read `references/chart-selection.md` only when selecting or challenging a chart type.
