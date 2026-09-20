# Changelog

## 2.0.9 - 2026-09-20

- Fixed Radar normalization so normalized Specs validate and render without unsupported Cartesian encodings.
- Added explicit Pie diagnostics for dropped negative values and empty totals, with deduplicated runtime health reporting.
- Made Gauge a true single-value contract, removed default-option false positives for non-Cartesian charts, and clarified top-level Diagram structure errors.
- Updated minimal recipes and bilingual Agent/Skill guidance for chart-specific channels and ESM JSON recipe imports.

## 2.0.8 - 2026-09-20

- Hardened chart-specific encoding and field validation, including explicit Swimlane requirements and actionable diagnostics for Agents.
- Added Gauge domain contracts and clamping diagnostics, Heatmap label rendering, locale-aware temporal formatting, semantic Pie labels, and runtime health checkpoints.
- Added intent fallback suggestions, locale capability metadata, a complete minimal Spec catalog, and synchronized Agent guidance and capability manifests.

## 2.0.7 - 2026-09-20

- Added Architecture and Mindmap chart types with shared diagram contracts, layers, boundaries, parent-child validation, deterministic tree/radial layouts, and Agent-readable schemas and capabilities.
- Added renderer-parity edge selection and editing, persistent manual waypoints, obstacle-aware routing, and true cubic-Bezier Mindmap edges while keeping navigation and editing disabled by default.
- Improved chart layout reflow, diagram connection routing, label spacing, legend and branding controls, and compact chart preference behavior.
- Fixed chart settings placement so scrolling preserves the selected side without viewport snapping and closes the menu directly after its anchor leaves the viewport.

## 2.0.6 - 2026-09-18

- Added compact per-chart visual settings with explicit default font sizing, capability-aware visibility toggles, bilingual labels, and theme-aware hamburger icon contrast.
- Added shared page-level preferences with localStorage persistence and Agent JSON patch support through the Preferences API and Playground settings page.
- Synchronized Runtime, Playground, package metadata, release-pinned installation guidance, and roadmap status for the `v2.0.6` release.

## 2.0.5 - 2026-09-18

- Hardened JSON, SVG, PNG, and JPEG export contracts with deterministic type errors, JSON output representations, and an explicit optional Node `canvas` path through `exportAsync()`.
- Aligned Canvas and SVG background, fill, stroke, and transparent-paint behavior; normalized `theme.branding` into the shared branding contract.
- Hardened the Playground server's port detection, path containment, malformed URI handling, and escaped 404 responses.
- Added bilingual usage-scenario guidance for Runtime integration, Coding Agents, the official Skill, one-off artifacts, project/diagram workflows, and CI reports.
- Expanded export, headless Canvas, branding, documentation, and package regression coverage.

## 2.0.4 - 2026-09-18

- Synchronized current Agent documentation, scoped package paths, GitHub fallback instructions, Skill links, Playground links, and release status.
- Corrected Runtime and Playground version displays to `2.0.4`.
- Marked the original `2.0.0` release-readiness document as historical and added stronger documentation consistency checks.

## 2.0.3 - 2026-09-17

- Completed Iteration 8 acceptance documentation and added the author-only release SOP.
- Added README and official Skill release guardrails for the scoped npm package and controlled publishing workflow.

## 2.0.2 - 2026-09-17

- Fixed Line and Area rendering so `fill: 'none'` does not create an unintended filled area.

## 2.0.1 - 2026-09-17

- Added dual-engine raster export, branding signature support, and synchronized documentation and TypeScript declarations.

## 2.0.0 - 2026-09-16

- Added Iteration 9's lightweight visual style system with adaptive modes, semantic presets and palettes, live switching, contrast diagnostics, Agent recommendations, bilingual guidance, and Theme Gallery while retaining version `2.0.0`.
- Released the new Agent-first iChart.js 2.0 product line with one ESM/TypeScript runtime surface, 16 public chart types, project intelligence, controlled diagram editing, capability discovery, planning, validation, explanation, and stable lineage.
- Accepted 51 core tests, the executable Agent workflow, official Skill validation, strict TypeScript consumption, package installation, and Node.js 18/20/22 GitHub Actions.
- Accepted Chromium, Firefox 144, WebKit 26, and native Safari 26.6.2 across maintained Playground pages, plus 390 x 844 responsive/touch viewport checks.
- Accepted local 5,000-row Line and Heatmap, 1,000-task Gantt, 300-node Diagram, Canvas/SVG, and lifecycle samples.
- Deferred npm publication while retaining GitHub Tag installation. Physical iOS/Android verification remains a documented host/device follow-up and does not block the source release.

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
- Kept native Safari automation, physical iOS/Android, and representative release-host performance checks as explicit RC release gates.

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
