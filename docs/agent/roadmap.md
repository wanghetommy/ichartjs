# iChart.js 2.0 Roadmap

> Roadmap baseline: 2026-09-14. Geographic charts and 3D rendering remain out of scope until explicitly reintroduced.

## Current Status

- Iteration 1: Agent-first core, Chart Spec, Scene Graph, Canvas/SVG renderers, basic chart types.
- Iteration 2: Data transforms, scales, multi-series axes, plugins, responsive behavior, touch basics, and chart gallery foundations.
- Iteration 3: Project management and process visualization foundations, including Gantt, timeline, milestone, burndown, flow, and swimlane.
- Iteration 3 core functionality is complete; browser/mobile gesture verification remains a release acceptance item.

## Iteration 4 — Agent Data Contract and Business Editing

### Current status

4A–4E local runtime implementation is complete and the repository is at `2.0.0-rc.1` review stage. See `docs/agent/rc-1-acceptance.md` for passed gates and explicitly deferred host/device checks.

### Goal

Make the runtime reliable for production Agent integrations and allow safe, explainable business-data edits. The complete task list is in `docs/agent/iteration-4.md`.

### Tasks

1. Define versioned Business Data Schema and project/diagram data models.
2. Add field types, edit permissions, relationships, and cross-field business rules.
3. Add typed commands for field, record, task, dependency, progress, node, and lane edits.
4. Implement schema validation, data validation, command validation, and deterministic diff preview.
5. Add affected-record analysis, dependency policy, critical-path warnings, and confirmation rules.
6. Implement commit, rollback, undo, redo, optimistic version checks, and audit records.
7. Add editing capability discovery, Agent response contract, and Recipe validation.
8. Add TypeScript declarations and framework-neutral data-store adapters.
9. Add headless preview/export and deterministic SVG, PNG, and JSON checks.
10. Complete keyboard, ARIA, reduced-motion, and mobile editing behavior.
11. Add preview/confirm/commit/undo demos for Gantt and Flow.
12. Complete real-browser acceptance for desktop, mobile viewport, SVG, and Canvas.
13. Retain public API stability, module boundaries, performance benchmarks, and lifecycle leak checks as RC release gates; track them as tasks 66–72 in the detailed plan.

### Verification

- `npm test`, `npm run check`, and `git diff --check` pass.
- Type declarations compile against representative Agent editing examples.
- Headless preview and export work without a browser DOM.
- A schema and typed command can preview, confirm, commit, and undo a business edit.
- Failed or stale edits do not partially mutate source data.
- SVG and Canvas produce equivalent semantic node/data references.
- No listener, observer, tooltip, or plugin leak remains after `destroy()`.
- All public capabilities are discoverable and recipe validation is deterministic.
- Browser acceptance covers the full gallery and mobile gestures.

### Deliverables

- `types/`
- `docs/agent/api-reference.md`
- `docs/agent/iteration-4.md`
- `http://localhost:3000/playground/editing` (source page: `playground/editing.html`)
- `agent-recipes/manifest.json`

## Iteration 5 — Advanced Diagram and Editing Runtime

### Goal

Turn Flow and Swimlane into a reusable diagram runtime with controlled editing, persistence, and collaboration-friendly patches.

### Tasks

1. Introduce a graph model with node, edge, lane, group, and port entities.
2. Add orthogonal, straight, and curved edge routing modes.
3. Add arrowhead, label, condition, and edge-status rendering.
4. Add node drag, resize, alignment, snapping, and lane reassignment.
5. Extend Iteration 4's command/history engine to advanced diagram operations; do not build a separate undo/redo stack.
6. Add expand/collapse for groups and subprocesses.
7. Add layout modes: layered, tree, radial, and manual.
8. Add diagram validation for unreachable nodes, duplicate IDs, invalid ports, and cycles by policy.
9. Add selection rectangle, multi-select, copy/paste, and keyboard shortcuts.
10. Add diagram-specific SVG accessibility relationships.
11. Add import/export of normalized DiagramSpec.
12. Add recipes for workflow, approval process, Agent orchestration, and responsibility mapping.

### Verification

- Same input graph produces stable layout output.
- Dragging and lane reassignment persist in normalized Spec.
- Undo/redo restores both geometry and relationships.
- Edge routing avoids node bodies in supported routing modes.
- Keyboard-only editing covers selection, movement, and deletion.
- Flow and Swimlane remain usable at mobile widths.

### Deliverables

- Diagram Runtime package.
- `playground/diagram-editor.html`.
- Diagram API and editing guide.
- Flow/Swimlane recipe collection.

## Iteration 6 — Project Intelligence and Business Views

### Goal

Add higher-level project analytics that Agents can generate from task and delivery data.

### Tasks

1. Add critical-path and slack visualization controls to Gantt.
2. Add baseline versus actual schedule comparison.
3. Add dependency lag/lead and working-calendar support.
4. Add resource load and capacity views.
5. Add cumulative-flow diagram.
6. Add velocity and release burndown views.
7. Add risk matrix and issue aging views.
8. Add milestone variance and forecast confidence indicators.
9. Add filtering by owner, status, priority, sprint, and label.
10. Add linked brushing between project views.
11. Add natural-language intent recipes for schedule, risk, capacity, and release reporting.
12. Add data quality warnings for incomplete dates, inconsistent status, and scope anomalies.

### Verification

- Schedule calculations use explicit calendar and timezone rules.
- Baseline/actual variance is numerically reproducible.
- Forecasts expose assumptions and confidence limitations.
- Filters update all linked views consistently.
- Agent output includes warnings when source data is insufficient.
- All analytics have SVG and Canvas fallback behavior where applicable.

### Deliverables

- Project Intelligence module.
- `playground/project-intelligence.html`.
- Project analytics recipes.
- Agent data-quality and assumption documentation.

## Deferred Scope

The following remain deferred beyond this roadmap baseline:

- Geographic and map charts.
- 3D and perspective rendering.
- Fishbone / Ishikawa diagrams.
- Organization charts.
- Kanban boards.
- Full collaborative multi-user editing.

They should only be scheduled after the core runtime, diagram model, and project analytics contracts are stable.

## Recommended Execution Order

1. Finish Iteration 3 browser acceptance.
2. Execute Iteration 4 before adding more chart types.
3. Execute Iteration 5 if diagram editing is a primary product direction.
4. Execute Iteration 6 if project analytics and Agent reporting are primary use cases.
5. Re-evaluate geographic and 3D scope only after usage data confirms demand.
