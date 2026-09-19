# iChart.js 2.0 Agent Guide

This is the user-facing Agent entry point for iChart.js 2.0. Read this file first, then load one scenario guide as needed.

## Language

- English technical contract: current documents.
- Chinese companion guide: [`zh-CN/README.md`](zh-CN/README.md).
- APIs, fields, commands, error codes, and manifests use English identifiers. The English documents define the canonical technical contract; Chinese documents provide equivalent guidance.

## Start Here

- [Agent Quickstart](quickstart.md): install, import, plan, validate, render, explain, and self-check.
- [Usage Scenarios](usage-scenarios.md): choose Runtime, Coding Agent, Skill, one-off artifact, project, diagram, or CI usage and select the right output.
- [Coding Agent Integration](coding-agent-integration.md): use from Codex and similar code-editing Agents.
- [Frontend Integration](frontend-integration.md): use from ordinary JavaScript applications.
- [Visual Style and Themes](theme-guide.md): automatic matching, presets, palettes, switching, and contrast checks.
- [Data Charting](charting-scenario.md): generic data analysis charts.
- [Project Management](project-scenario.md): Gantt, Timeline, Milestone, and Burndown.
- [Interactive Diagrams](diagram-scenario.md): Flow, Swimlane, Architecture, Mindmap, Groups, Ports, and editing.
- [Runtime Contract](runtime-contract.md): shared Spec, renderer, interaction, and export rules.
- [Editing Contract](editing-contract.md): schemas, commands, preview, commit, and undo/redo.
- Machine-readable capability manifests are in `docs/manifests/` and should be loaded on demand.

The 2.0 API is Spec-first. Import from `@taylorwong/ichartjs`, inspect data, plan a chart, create a JSON-friendly Spec, validate it, render it, and self-check the explanation and runtime state.

## Recommended flow

```js
const report = ichart.inspectData(data);
const recommendation = ichart.planChart(data, { intent: 'trend' });
const spec = {
  type: recommendation.primary,
  renderer: 'svg',
  container: '#chart',
  data: { values: data },
  encoding: { x: { field: 'month' }, y: { field: 'sales' } }
};
const validation = ichart.validateSpec(spec);
if (!validation.valid) return validation.errors;
const chart = ichart.createChart(validation.spec);
chart.explain();
```

Use `getCapabilities()` to discover supported chart types, project-management views, diagrams, renderers, interactions, exports, and data operations. Use `chart.getSpec()`, `chart.getState()`, `chart.getSelectedData()`, and `chart.toDataTable()` to inspect a live chart.

For a visual overview of all supported chart types, open `playground/project-gallery.html`. For style-system acceptance, open `playground/theme-gallery.html`.

## Selection rules

- Use `line` or `area` for temporal trends.
- Use `bar` for category comparison or long labels.
- Use `column` for compact category comparison.
- Use `pie` only for a small part-to-whole view.
- Prefer `svg` when DOM interaction or accessibility is important.
- Prefer `canvas` when rendering many marks or targeting lower-power devices.
- Use `gantt`, `timeline`, `milestone`, or `burndown` for project delivery views.
- Use `flow` or `swimlane` for process, ownership, and responsibility views.
- Use `architecture` for business, data, and technical system structures with declared layers and boundaries.
- Use `mindmap` for hierarchical ideas, with stable `parentId` references and tree or radial layout.
- Do not generate `map` or `3d` Specs unless `getCapabilities()` declares them.

## Error handling

Always call `validateSpec()` before rendering. Validation errors contain `code`, `path`, `message`, and `suggestion`.
