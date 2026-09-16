# Runtime Contract

Shared iChart.js 2.0 Runtime rules used by all three scenarios.

## Standard Flow

```text
getCapabilities → inspectData → planChart → create Spec → validateSpec → createChart → explain and inspect state
```

Agents should use `getCapabilities()` first instead of hard-coding undeclared types or operations.

Iteration 8 adds per-chart profiles through `getChartCapability(type)`. Each profile declares required data roles, supported interactions, renderers, feature status, exports, and practical limits. Unsupported behavior must be handled from this profile or from validation diagnostics rather than guessed.

`planChart(data, { intent, renderer })` returns a versioned planning result with a primary chart, alternatives, confidence, reasons, required fields, suggested encodings, assumptions, warnings, unsupported requests, safe next actions, and the selected capability profile. Planning never invents business meaning, units, dates, or missing fields.

## Spec Rules

- Specs must be JSON-serializable.
- Call `validateSpec()` before rendering.
- Chart layout and data semantics are renderer-independent.
- `flow` and `swimlane` use `nodes/edges/lanes`; generic charts use `data.values`.

## Renderer

- Use `svg` for DOM-level interaction, accessibility, and Diagram editing.
- Use `canvas` for many marks and lower DOM overhead.
- Headless mode supports JSON export; PNG/SVG string export requires a mounted renderer.

## Common APIs

```text
inspectData(data)
normalizeData(data)
recommend(data, options)
planChart(data, options)
validateSpec(spec)
createChart(spec)
getCapabilities()
getChartCapability(type)
chart.describe()
chart.explain()
chart.getState()
chart.getSelectedData()
chart.export(options)
```

Validation results contain separate `errors`, `warnings`, and `normalizations`. Diagnostics use stable codes, JSON-oriented paths, expected values where useful, and actionable suggestions. `chart.explain()` returns encodings, transforms, interactions, assumptions, warnings, stable record lineage, and an accessibility summary.

## Interaction

Common interactions include Tooltip, Hover, Click, Selection, Zoom, Pan, Drag, Touch, and Keyboard; each chart's enabled interactions are controlled by its Spec and capability declaration.

## Implementation Map

- Public runtime: `src/index.mjs`
- Spec: `src/spec.mjs`
- Scene: `src/scene.mjs`
- Renderers: `src/renderer.mjs`
- Plugins: `src/plugin.mjs`
- Scales: `src/scale.mjs`

## Acceptance

- The Gallery covers every `getCapabilities().chartTypes` entry.
- Canvas and SVG use the same Scene data structure.
- Invalid Specs return structured errors with `code`, `path`, `message`, and `suggestion`.
