# Changelog

## 2.0.0-rc.1 Iteration 8 - 2026-09-16

- Reorganized the root README around the Agent discovery, inspection, planning, validation, rendering, and self-check workflow.
- Added one publishable ESM entry plus manifest, recipe, TypeScript, example, and official Skill package surfaces.
- Added English and Chinese Agent quickstarts plus an executable end-to-end Agent workflow.
- Completed common presentation and geometry behavior across the existing 16 public chart types without adding a new type.
- Added per-chart capability profiles, deterministic Agent planning, richer data inspection, validation diagnostics, explanations, and stable lineage output.
- Added a unified Playground home, full Gallery, Agent Workbench, Interaction Lab, Accessibility Lab, Performance Lab, and a no-cache preview server.
- Expanded TypeScript declarations, manifests, bilingual Agent contracts, regression tests, and local browser acceptance evidence.
- Added Node.js 18/20/22 CI, contribution guidance, private vulnerability-reporting guidance, and an Apache 2.0 license file.
- Completed Chromium, Firefox 144, and WebKit 26 desktop/mobile-viewport regression plus local 5,000-row performance and lifecycle samples.
- Kept native Safari automation, physical iOS/Android, and representative release-host performance checks as explicit final release gates.

## 2.0.0-alpha.1 - 2026-09-14

- Added the initial 2.0 module tree under `src/`.
- Added JSON-friendly Chart Spec normalization and validation.
- Added data normalization and inspection.
- Added renderer-independent Scene Graph.
- Added Canvas and SVG renderers.
- Added line, area, bar, column, and pie charts.
- Added basic hover, click, tooltip, resize, and export APIs.
- Added Node-based core tests.

The legacy 1.x implementation remains unchanged.

## 2.0.0-beta.1 - 2026-09-14

- Added chainable data transforms: filter, sortBy, groupBy, sum, average, topN, and percentage.
- Added selection state, selected data, element lookup, JSON patches, and zoom reset APIs.
- Added standalone Scale primitives for category, linear, and time mapping.
- Added multi-series line/column rendering with left and right y-axis mappings.
- Added temporal x-axis tick generation and adaptive date labels.
- Added touch pan, pinch zoom, pointer brush, wheel zoom, and keyboard focus navigation.
- Added Annotation, DataZoom, DataLabels, and Accessibility plugin exports.

## Iteration 3 plan - 2026-09-14

- Planned project-management views: Gantt, timeline, milestone, and burndown.
- Planned process visualizations: flow chart and swimlane chart.
- Planned shared interval, dependency, graph layout, lane, interaction, accessibility, export, and Agent Recipe capabilities.
- Deferred geographic charts, 3D rendering, fishbone diagrams, organization charts, dependency networks, resource-load views, and Kanban boards.

## Iteration 3 product hardening - 2026-09-14

- Added Gantt critical-path analysis with automatic critical tasks, dependency arrowheads, and critical-edge emphasis.
- Added Flow node dragging with persisted `node.position`, edge rerouting, `drag`, and `dragend` events.
- Added Burndown scope-change markers, total-scope series, completion velocity, and estimated finish date.
- Added project-specific tooltips for tasks, milestones, burndown points, nodes, and swimlanes.
- Added shared project viewport scaling, mobile single-finger drag, and two-finger pinch behavior.
- Added renderer-independent scene-structure checks for SVG and Canvas outputs.

## Iteration 4 plan - 2026-09-14

- Planned a versioned Business Data Schema for Agent-readable fields, permissions, relationships, and business rules.
- Planned typed Edit Commands for task scheduling, progress, dependencies, milestones, Flow nodes, and Swimlane ownership.
- Planned deterministic preview diffs, confirmation policies, audit records, rollback, undo, redo, and stale-version protection.
- Planned TypeScript declarations, Recipe validation, headless preview/export, and an editing acceptance demo.
