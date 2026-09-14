# iChart.js 2.0 Agent Guide

The 2.0 API is Spec-first. An Agent should inspect data, choose a chart, create a JSON-friendly Spec, validate it, and then render it.

## Recommended flow

```js
const report = ichart.inspectData(data);
const recommendation = ichart.recommend(data, { intent: 'trend' });
const spec = {
  type: recommendation.primary,
  renderer: 'svg',
  container: '#chart',
  data: { values: data },
  encoding: { x: { field: 'month' }, y: { field: 'sales' } }
};
ichart.validateSpec(spec);
const chart = ichart.createChart(spec);
chart.describe();
```

Use `getCapabilities()` to discover supported chart types, project-management views, diagrams, renderers, interactions, exports, and data operations. Iteration 3 adds project-management and process visualization; see `docs/agent/iteration-3.md` for scope and acceptance criteria. Use `chart.getSpec()`, `chart.getState()`, `chart.getSelectedData()`, and `chart.toDataTable()` to inspect a live chart.

For the post-Iteration 3 development sequence, see `docs/agent/roadmap.md`.

Iteration 4A–4E currently implements schema inspection, data validation, typed command validation, read-only previews, guarded local commits, revision checks, audit metadata, change sets, undo/redo, and recipe validation. The chart runtime intentionally does not persist external business data or provide authorization; the host application owns those responsibilities. See `docs/agent/iteration-4.md` and the viewable demo at `http://localhost:3000/playground/editing`.

## Selection rules

- Use `line` or `area` for temporal trends.
- Use `bar` for category comparison or long labels.
- Use `column` for compact category comparison.
- Use `pie` only for a small part-to-whole view.
- Prefer `svg` when DOM interaction or accessibility is important.
- Prefer `canvas` when rendering many marks or targeting lower-power devices.
- Use `gantt`, `timeline`, `milestone`, or `burndown` for project delivery views.
- Use `flow` or `swimlane` for process, ownership, and responsibility views.
- Do not generate `map` or `3d` Specs in the 2.0 roadmap unless a later capability declaration enables them.

## Error handling

Always call `validateSpec()` before rendering. Validation errors contain `code`, `path`, `message`, and `suggestion`.
