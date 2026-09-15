# Scenario: Data Charting

Agent usage and development guide for generic data analysis and metric visualization.

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

## Agent Workflow

1. Call `inspectData(data)` to identify fields and missing values.
2. Select a chart type from the business intent; use `recommend(data, { intent })` for automated selection.
3. Create a JSON-serializable Chart Spec.
4. Call `validateSpec(spec)` before `createChart(spec)`.
5. Inspect the result with `chart.describe()` and `chart.getState()`.

## Minimal Spec

```js
{
  type: 'line',
  renderer: 'svg',
  container: '#chart',
  data: { values: [{ month: 'Jan', sales: 120 }] },
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
