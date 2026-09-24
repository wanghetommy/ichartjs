# Scenario: Data Charting

Agent usage and development guide for generic data analysis and metric visualization.

## Capability Boundaries

- `scatter` is a single x/y measure pair; it does not provide series or legend encoding.
- `heatmap` uses matrix row/column labels from `encoding.x` and `encoding.y`; Cartesian `xAxis`/`yAxis` configuration is not supported.
- `funnel` renders stage names from `encoding.category` (default `name`) and optional values from `labels.enabled`; it has no legend.
- `area` and `column` accept at most two quantitative `encoding.y` measures.

## Supported Types

| Type | Typical intent | Recommended renderer |
| --- | --- | --- |
| `line` | Trends and time changes | `svg` |
| `area` | Trends and cumulative volume | `svg` |
| `bar` | Category comparison and long labels | `svg` |
| `column` | Compact category comparison | `canvas` or `svg` |
| `pie` | Small part-to-whole views | `svg` |
| `scatter` | Relationship between two numeric variables | `canvas` |
| `funnel` | Conversion stages | `svg` |
| `gauge` | Single-metric completion | `canvas` |
| `heatmap` | Matrix intensity and calendar patterns | `canvas` or `svg` |
| `radar` | Multidimensional profile comparison | `svg` |

## Foundational Modes

- Use `stack: "stacked"` or `stack: "percent"` with Bar, Column, or Area rather than a separate stacked type.
- Use `type: "pie"` with `innerRadius` for Donut charts.
- Use per-series `mark: "column"` or `mark: "line"` and optional `axis: "right"` for Combo charts.
- Use `transform: { type: "bin", field, thresholds | step, extent }` for Histogram workflows.
- Heatmap treats missing values separately from numeric zero through `colorScale.missing`.
- Radar should declare `min` and `max` for every indicator; omitted or mixed-unit domains produce warnings.

## Configuration Placement

`encoding` describes field roles and series semantics. Keep these options at the Spec level:

| Concern | Correct location | Applies to |
| --- | --- | --- |
| Axis title and format | `xAxis.title/format`, `yAxis.title/format` | Line, Area, Bar, Column, Scatter |
| Readable numeric domain | `yAxis.nice`, `yAxis.ticks`, `yAxis.domain` | Line, Area, Bar, Column, Scatter |
| Data labels | `labels.enabled/format` | Charts that declare `labels` in capabilities |
| Legend | `legend.visible` | Multi-series Cartesian, Pie, and Radar |
| Gauge domain | `domain: [min, max]` | Gauge |
| Heatmap color domain | `colorScale.domain` | Heatmap |
| Radar indicator domain | `indicators[].min/max` | Radar |

Do not put `title`, `format`, `labels`, or `legend` under `encoding`; `validateSpec()` reports those placements as warnings. Numeric y-axes use readable domains by default (`nice: true`, `ticks: "auto"`). Use `yAxis.domain: [min, max]` for an explicit range, or `yAxis.nice: false` to retain the raw boundary. `xAxis.min/max` and `xAxis.domain` are unsupported for categorical/time layouts and produce a structured warning.

Layout is deterministic and renderer-independent. Legend items use Unicode-aware text estimates for spacing and automatically wrap when a row is full; a single label that cannot fit is truncated and reports `LEGEND_OVERFLOW`. Y-axis titles are centered beside their tick columns; Bar also places its categorical y-axis title vertically and centered on the left, with space reserved before the plot rectangle. If the chart is physically too short for a title, the renderer truncates it and reports `TITLE_TRUNCATED`. Axis and project-label reserves are computed before the plot rectangle, so Canvas, SVG, headless rendering, and exports share the same geometry.

## Encoding Contracts

Use only the channels declared for the selected chart: Cartesian charts use `encoding.x` and `encoding.y`; Pie and Funnel use `encoding.category` and `encoding.value`; Gauge uses only `encoding.value`; Heatmap uses `encoding.x`, `encoding.y`, and `encoding.color`; Radar uses `indicators[].field`. `validateSpec()` reports `UNSUPPORTED_ENCODING_CHANNEL` for an unused channel and `MISSING_ENCODING_FIELD` when a referenced field is absent. Gauge additionally requires `domain: [min, max]`; values outside the domain are clamped for the rendered arc and report `VALUE_CLAMPED`. Pie reports `NEGATIVE_VALUE_DROPPED` instead of silently treating negative values as valid shares, and reports `ZERO_TOTAL` for an empty result.

The complete set of small starting Specs is available at `@taylorwong/ichartjs/recipes/minimal-specs`. Import the JSON catalog with `with { type: 'json' }`, then select `catalog.examples[type]`.

## Intent Vocabulary

Pass an exact value from `getCapabilities().intents` to `planChart()`. Common mappings are:

| User need | Registered intent | Primary chart |
| --- | --- | --- |
| Trend over time | `trend` or `time-series` | Line |
| Compare categories | `comparison` | Bar |
| Rank categories | `ranking` | Bar |
| Distribution or histogram | `distribution` | Column with `bin` transform |
| Relationship or correlation | `relationship` or `correlation` | Scatter |
| Composition | `composition` | Column or Area |
| Matrix intensity | `matrix` or `correlation-grid` | Heatmap |
| Profile across measures | `multidimensional` or `profile` | Radar |

Natural-language prose such as `trend over time` is not an intent token. Map it to `trend` first. An unknown token returns `UNKNOWN_INTENT` plus a fallback plan; never ignore that warning.

Unknown intent plans expose `intentKnown: false`, `fallbackUsed: true`, and deterministic `intentSuggestions`. Use those fields to remap the request or ask for confirmation instead of silently accepting the fallback chart.

## Agent Workflow

1. Call `inspectData(data)` to identify fields and missing values.
2. Select a chart type from the business intent; use `recommend(data, { intent })` for automated selection.
3. Create a JSON-serializable Chart Spec.
4. Call `validateSpec(spec)` before `createChart(spec)`.
5. Inspect the result with `chart.describe()` and `chart.getState()`.
6. Add stable string `id` values to rows when lineage checks, linked selection, or later updates matter.
7. Check `chart.getState().health.renderable`, `health.status`, and `warnings` before presenting the result. `ready` means no material diagnostic is active; `degraded` means the chart rendered with a material warning; `empty` means it has no meaningful result.

`locale` defaults to `en-US` and controls axis, label, tooltip, and export formatting. Set `locale: "zh-CN"` for Chinese output. Input dates should remain ISO-8601 strings; natural-language date parsing is not part of the runtime contract.

## Minimal Spec

```js
{
  type: 'line',
  renderer: 'svg',
  container: '#chart',
  data: { values: [{ id: 'jan', month: 'Jan', sales: 120 }] },
  encoding: {
    x: { field: 'month', type: 'category' },
    y: { field: 'sales', type: 'quantitative' }
  }
}
```

## Renderer Rules

- Use `svg` for DOM interaction, accessibility, element inspection, or fewer marks.
- Use `canvas` for many marks and rendering performance when individual DOM elements are unnecessary.
- Layout and data semantics must remain independent of the renderer.

## Implementation Map

- Spec and chart types: `src/spec.mjs`
- Data inspection and transforms: `src/data.mjs`
- Scene construction: `src/charts.mjs`
- Scales: `src/scale.mjs`
- Canvas/SVG renderers: `src/renderer.mjs`
- Tests: `tests/core.test.mjs`
- Full gallery: `playground/project-gallery.html`
- Iteration 7 gallery: `playground/foundational-gallery.html`

## Development Checklist

- Update `src/spec.mjs` and `src/charts.mjs`.
- Add data, Scene, and renderer-independence tests for the new type.
- Add the chart to `playground/project-gallery.html`.
- Update `docs/manifests/capabilities.json`.
- Update this guide's type table and limitations.

## Acceptance

- The Spec passes `validateSpec()`.
- The Gallery creates the chart with a `ready` status.
- Canvas and SVG expose the same Scene structure.
- Declared capabilities such as tooltip, selection, and zoom match actual behavior.
