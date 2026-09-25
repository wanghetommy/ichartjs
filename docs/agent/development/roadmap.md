# iChart.js 2.0 Roadmap

> Roadmap baseline: 2026-09-14. Current release status: `v2.0.17` includes the completed Iteration 12 structured-diagram work, Iteration 13 contract hardening, the Bar y-axis title layout fix, the 13F axis-free chart layout strategy, Timeline/Milestone layout hardening, and chart diagnostic improvements. Geographic charts and 3D rendering remain out of scope until explicitly reintroduced.

## Current Status

- Iteration 1: Agent-first core, Chart Spec, Scene Graph, Canvas/SVG renderers, basic chart types.
- Iteration 2: Data transforms, scales, multi-series axes, plugins, responsive behavior, touch basics, and chart gallery foundations.
- Iteration 3: Project management and process visualization foundations, including Gantt, timeline, milestone, burndown, flow, and swimlane.
- Iteration 3 core functionality is complete; browser/mobile gesture verification remains a release acceptance item.
- Iteration 6 project intelligence local runtime and browser acceptance are complete.
- Iteration 7 local runtime and browser acceptance are complete for foundational composition, Heatmap, and Radar; physical-device checks remain host integration evidence.
- Iteration 8A–8D is complete and accepted in automated tests, Chromium, Firefox 144, WebKit 26, native Safari 26.6.2, and a 390 px touch viewport. Physical iOS/Android and representative release-host measurements remain post-release host/device follow-up. No new public chart type was introduced.
- Iteration 9A–9D implemented the lightweight visual style system, adaptive theme planning, runtime switching, renderer integration, and bilingual Agent guidance without adding a chart type; these capabilities remain in the `2.0.x` line.
- Iteration 10A Export Contract Hardening was implemented and released in `v2.0.5`: export representations and type errors are deterministic, optional Node raster export uses `exportAsync()`, Canvas/SVG paint semantics are aligned, and the playground server has safer port/path handling. No chart behavior or public chart type was added.
- Iteration 11 visual preference controls are included in the `v2.0.6` release: compact per-chart settings, capability-aware visibility controls, theme-aware icon contrast, explicit font-size defaults, shared page preferences, and Agent-adjustable global settings.
- Iteration 12A–12G is included in `v2.0.7`: shared structured-diagram contracts, Architecture layers/boundaries, Mindmap parent-child tree/radial layouts with true cubic-Bezier edges, Agent schemas/capabilities, renderer-parity edge hit testing and selection, waypoint/segment handles, persistent manual routing, and Gallery/documentation coverage. Navigation and editing remain disabled by default and require explicit host activation.
- Iteration 13A–13F is complete and included in `v2.0.17`: canonical contract registry and generated capability projection, atomic Spec/data/style mutations, row-complete project validation, explicit Mindmap edge metadata, complete public TypeScript declarations and consumer fixture, module-cycle and documentation/example gates, browser acceptance, package dry-run evidence, an axis-free layout strategy for Pie, Funnel, Gauge, and Radar, Timeline/Milestone layout hardening, and runtime diagnostics for constrained Funnel labels and Swimlane label aliases. No chart type was added.
- The original `2.0.0` readiness record is historical and superseded by the published `2.0.x` releases. Current release checks are defined by `docs/agent/development/release-sop.md`.

## Iteration 4 — Agent Data Contract and Business Editing

### Current status

4A–4E local runtime implementation is complete and included in `2.0.0`. See `docs/agent/development/rc-1-acceptance.md` for the historical RC evidence and `docs/agent/development/2.0-release-readiness.md` for final acceptance.

### Goal

Make the runtime reliable for production Agent integrations and allow safe, explainable business-data edits. The complete task list is in `docs/agent/development/iteration-4.md`.

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
- `docs/agent/development/iteration-4.md`
- `http://localhost:3000/playground/editing` (source page: `playground/editing.html`)
- `agent-recipes/manifest.json`

## Iteration 5 — Advanced Diagram and Editing Runtime

### Current status

Iteration 5 local runtime scope is complete: normalized models, deterministic layouts, routing modes, node and member-derived group resizing, validation, capability discovery, shared history, group lifecycle operations, clipboard editing, pointer and keyboard port connections, typed edges, deterministic multi-obstacle orthogonal routing, recipes, and a viewable editor demo at `http://localhost:3000/playground/diagram-editor.html`. Cross-browser acceptance passed; physical-device behavior remains host integration evidence.

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

Add higher-level project analytics that Agents can generate from task and delivery data. The phased plan and chart-type admission policy are defined in `docs/agent/development/iteration-6.md`.

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

## Iteration 7 — Foundational Chart Coverage

### Goal

Complete high-frequency foundational composition modes, then add Heatmap and Radar as fully supported public chart types. The phased implementation and admission policy are defined in `docs/agent/development/iteration-7.md`.

### Tasks

1. Add grouped, stacked, and percent-stacked modes to Bar, Column, and Area.
2. Add Donut as `pie.innerRadius`, without creating a separate public type.
3. Add mixed line/column multi-series composition and dual-axis rules.
4. Add deterministic bin transforms for Histogram workflows.
5. Add Heatmap with matrix encodings, color scales, missing-value semantics, and keyboard navigation.
6. Add Radar with explicit indicator domains, multi-series comparison, and mixed-unit warnings.
7. Complete SVG/Canvas parity, accessibility, responsive behavior, export, recipes, tests, and Gallery coverage.

### Verification

- Composition modes preserve backward compatibility and stable source record references.
- Stack totals, percentage normalization, pie radii, and bin boundaries are deterministic.
- Heatmap distinguishes missing values from zero and supports semantic keyboard navigation.
- Radar requires explicit domains when inputs use mixed units.
- `npm run agent:check`, `git diff --check`, and browser acceptance pass.

### Deliverables

- Reusable stack, mixed-mark, Donut, and bin-transform contracts.
- Public `heatmap` and `radar` chart types.
- `playground/foundational-gallery.html`.
- Updated capabilities, types, recipes, documentation, tests, and acceptance record.

## Iteration 8 — Chart Completeness and Agent Experience

### Goal

Finish the commonly expected behavior of the existing 16 chart types, improve machine-discoverable planning and diagnostics for Agents, and close the runtime, browser, packaging, performance, and 2.0 release gates. The phased plan is defined in `docs/agent/development/iteration-8.md`; the browser demo and acceptance-page architecture is defined in `docs/agent/development/playground-plan.md`.

### Tasks

1. Build and audit a per-chart feature matrix for common presentation, interaction, accessibility, responsive, state, export, and renderer behavior.
2. Complete missing applicable behavior across existing charts without adding public chart types.
3. Align interaction correctness, SVG/Canvas semantics, hit testing, keyboard behavior, lifecycle cleanup, and module loading.
4. Expand capability discovery to per-chart data, option, interaction, renderer, limit, and export profiles.
5. Add explainable Agent planning with alternatives, confidence, reasons, assumptions, warnings, unsupported requests, and safe next actions.
6. Improve inspection, validation, repair diagnostics, chart descriptions, data lineage, recipes, and Agent self-check contracts.
7. Complete cross-browser, mobile-device, accessibility, performance, package-consumer, documentation, and release acceptance.

### Verification

- Every declared chart feature has automated or recorded browser evidence.
- An Agent can discover, plan, validate, render, explain, and self-check through public contracts alone.
- Capability manifests, runtime behavior, documentation, recipes, and TypeScript declarations agree.
- All 16 chart types pass full Gallery acceptance without uncaught errors.
- `npm run agent:check`, `git diff --check`, browser, mobile, lifecycle, and performance gates have explicit results.

### Deliverables

- Chart-by-feature capability matrix and completed feature-gap fixes.
- Per-chart Agent capability and option metadata.
- Agent planning, diagnostics, explanation, recipes, and contract tests.
- Browser, mobile, accessibility, performance, lifecycle, packaging, and 2.0 release records.
- Updated full Gallery and exact preview acceptance instructions.

## Iteration 9 — Visual Style System and Adaptive Theming

### Goal

Give all existing chart families a consistent, accessible built-in visual language that Agents can select semantically and users can switch without chart recreation. The detailed 9A–9D plan is in `docs/agent/development/iteration-9.md`.

### Tasks

1. Define shared visual tokens, typography roles, layout density, mark styling, and semantic colors.
2. Add automatic, light, dark, and contrast modes.
3. Add analysis, dashboard, report, presentation, project, and diagram presets.
4. Add categorical, sequential, diverging, and status palettes.
5. Add deterministic Agent style planning, reasons, warnings, and capability discovery.
6. Add live theme switching, host color-scheme following, and explicit override preservation.
7. Apply resolved tokens across SVG, Canvas, charts, project views, diagrams, and tooltips.
8. Add bilingual guidance, TypeScript declarations, regression tests, and Theme Gallery acceptance.

### Verification

- Built-in modes satisfy declared contrast thresholds.
- Automatic choices are deterministic and visible in plan, state, and explanation output.
- User mode, preset, palette, and custom token overrides take precedence.
- Theme switching does not recreate a chart or lose explicit Spec overrides.
- `npm run agent:check`, `git diff --check`, and Theme Gallery acceptance pass.

### Deliverables

- Lightweight style engine in `src/theme.mjs`.
- Public style-planning and runtime-switching APIs.
- English and Chinese theme guides.
- `playground/theme-gallery.html` and enhanced full Gallery controls.
- Iteration 9 remains within version `2.0.0` and adds no chart type.

## Deferred Scope

The following remain deferred beyond this roadmap baseline:

- Geographic and map charts.
- 3D and perspective rendering.
- Fishbone / Ishikawa diagrams.
- Organization charts.
- Kanban boards.
- Full collaborative multi-user editing.

They should only be scheduled after the core runtime, diagram model, and project analytics contracts are stable.

## Iteration 11 — Chart Preferences and Agent Adjustments

### Goal

Allow users and Agents to adjust a chart's visual presentation after creation through one small, auditable contract. The detailed 11A–11D plan is in `docs/agent/development/iteration-11.md`.

### Tasks

1. Add allowlisted preferences for theme, typography scale, density, components, branding, and motion.
2. Support chart-scoped and page-global inheritance through an explicit Preferences Store.
3. Persist only versioned preference state through browser `localStorage` or a host adapter.
4. Add an optional accessible settings button outside the SVG/Canvas export surface.
5. Let Agents apply natural-language intent as a validated preference patch with source and scope metadata.
6. Add Playground and bilingual guidance for UI and Agent adjustment workflows.

### Verification

- Global changes reach all charts sharing a store; chart overrides remain isolated.
- UI, Agent, and host code use the same `preferenceschange` event path.
- Invalid patches do not mutate preferences or business data.
- Settings UI is excluded from SVG, PNG, and JSON chart exports.
- `npm run agent:check`, `git diff --check`, and `http://localhost:3000/playground/preferences-lab.html` acceptance pass.

## Recommended Execution Order

1. Finish Iteration 3 browser acceptance.
2. Execute Iteration 4 before adding more chart types.
3. Execute Iteration 5 if diagram editing is a primary product direction.
4. Execute Iteration 6 if project analytics and Agent reporting are primary use cases.
5. Execute Iteration 7 foundations before considering additional specialized chart types.
6. Execute Iteration 8 to complete existing chart behavior, Agent adaptation, and the 2.0 release gates.
7. Execute Iteration 9 to standardize adaptive visual styling without expanding chart count.
8. Execute Iteration 11 to add post-creation chart and page preferences without expanding chart count.
9. Re-evaluate geographic and 3D scope only after usage data confirms demand.
