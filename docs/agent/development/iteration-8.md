# Iteration 8 — Chart Completeness and Agent Experience

## Goal

Turn the existing chart catalog into a dependable, commonly complete, and Agent-native product surface. Iteration 8 prioritizes finishing expected chart behavior, making capabilities machine-discoverable and outputs explainable, then closing browser, packaging, performance, and 2.0 release gates.

## Current Delivery

Iteration 8A–8D is complete. The runtime exposes per-chart capability profiles, deterministic Agent planning and explanation, richer data inspection and diagnostics, common chart presentation behavior, corrected chart geometry, dedicated interaction/accessibility/performance labs, and a maintained full Gallery. Automated, Chromium, Firefox, WebKit, native Safari, 390 px responsive, lifecycle, and local performance acceptance passed. Physical iOS/Android checks remain a recorded host/device follow-up. Acceptance record is captured below in **§ Acceptance Record**.

## Scope Policy

- Do not add public chart types in Iteration 8.
- Improve the existing 16 public types: Line, Area, Bar, Column, Pie, Scatter, Funnel, Gauge, Heatmap, Radar, Gantt, Timeline, Milestone, Burndown, Flow, and Swimlane.
- A common feature is required only where its semantics are meaningful. Unsupported behavior must be declared explicitly rather than silently ignored.
- Prefer reusable runtime, interaction, transform, formatting, and accessibility contracts over chart-specific branches.
- Preserve deterministic output, stable source record IDs, JSON-safe Specs, and SVG/Canvas semantic parity.
- Agent recommendations must remain explainable suggestions, not hidden decisions or fabricated data.

## 8A — Existing Chart Feature Completeness

1. Create a chart-by-feature matrix covering title/subtitle, legend, axes, grid, tooltip, labels, formatters, theme, responsive sizing, animation, reduced motion, selection, zoom, pan, keyboard access, empty states, invalid-data states, export, and renderer support.
2. Audit every public chart type against the matrix and classify each cell as supported, not applicable, degraded, or missing.
3. Complete common presentation behavior: number/date/category formatting, label placement and collision policy, legend visibility and series toggling, axis domains and ticks, theme tokens, and deterministic layout defaults.
4. Complete common state behavior: loading, empty data, partial data, invalid values, no-result filters, disabled series, and structured warning display.
5. Complete chart-family behavior where applicable: positive/negative stacking, percentage totals, dual axes, pie zero totals, heatmap missing cells, radar domain handling, project schedule overlays, and diagram group/port hit policies.
6. Define large-data degradation rules for marks, labels, tooltips, animation, and renderer selection without changing source data.
7. Add focused regression tests for every capability newly marked supported.

### Checkpoint

- Every public chart has a reviewed feature profile and no declared capability is a placeholder.
- Common formatting, legend, tooltip, selection, responsive, empty-state, and export behavior is consistent where applicable.
- Missing or unsupported options produce structured diagnostics instead of silent no-ops.

## 8B — Interaction, Renderer, and Runtime Correctness

1. Systematically verify hover, tooltip, click, selection, wheel zoom, pinch zoom, zoom out, pan, drag, keyboard traversal, keyboard editing, and port connection across applicable chart families.
2. Define interaction conflict rules, including drag versus pan, click versus collapse, selection versus background hits, and touch gesture cancellation.
3. Align SVG and Canvas geometry, hit testing, semantic data references, focus order, and export-visible state.
4. Complete accessibility behavior: chart summaries, roles and labels, keyboard-only operation, focus visibility, reduced motion, contrast themes, and meaningful fallback descriptions.
5. Replace ad hoc development cache query keys with one coherent module-version and asset-cache strategy.
6. Audit public exports, module boundaries, circular dependencies, package entry points, direct browser loading, and destroy-time cleanup.
7. Add browser regression fixtures for previously observed Gallery and Diagram Editor failures.

### Checkpoint

- Zoom can both enter and return to the full domain, including from boundary windows.
- Background clicks never trigger unrelated chart or diagram actions.
- SVG and Canvas expose equivalent record identity and interaction results.
- Direct HTTP module loading does not depend on manually changing import query strings.
- Repeated create/destroy cycles do not retain listeners, observers, tooltips, or plugin state.

## 8C — Agent-Native Planning and Diagnostics

1. Expand the machine-readable capability manifest from global lists to per-chart profiles with supported data shapes, required encodings, compatible interactions, renderer constraints, defaults, limits, and export behavior.
2. Define a versioned Agent planning result that includes recommended chart, alternatives, confidence, reasons, required fields, assumptions, warnings, unsupported requests, and safe next actions.
3. Improve data inspection so an Agent can identify field roles, units, cardinality, temporal coverage, missingness, invalid values, and ambiguity before producing a Spec.
4. Improve Spec validation with stable error codes, precise JSON paths, expected values, actionable repair suggestions, and separation of errors, warnings, and normalizations.
5. Add deterministic chart description and explanation output covering selected chart semantics, encodings, transforms, filters, derived values, data lineage, assumptions, warnings, and accessibility summary.
6. Add option-level discoverability so an Agent can ask what a chart supports without loading implementation files or guessing configuration names.
7. Add compact, intent-oriented recipes for comparison, trend, composition, distribution, relationship, matrix, multidimensional profile, schedule, release, risk, workflow, and responsibility scenarios.
8. Add negative recipes and guardrails for misleading choices, including excessive pie categories, mixed-unit radar without domains, truncated axes, invalid stacking, insufficient forecasting data, and unsupported interactions.
9. Add Agent contract tests proving capability discovery, recommendation, validation, normalization, explanation, and recipe output are deterministic and mutually consistent.

### Checkpoint

- An Agent can discover, plan, validate, render, explain, and self-check a chart through public contracts alone.
- Capability profiles match actual runtime behavior for every chart and renderer.
- Recommendations explain tradeoffs and never invent missing fields, units, dates, domains, or business meaning.
- Diagnostics are stable enough for automated repair loops and concise enough for tool responses.

## 8D — Compatibility, Performance, and 2.0 Release Closure

1. Run the full Gallery and editor acceptance suite in current Chrome, Safari, and Firefox, recording browser-specific limitations.
2. Verify responsive layouts at representative 390 px, 768 px, and desktop widths, then perform physical-device touch checks on iOS and Android.
3. Establish repeatable performance budgets for representative Line, Heatmap, Gantt, and Diagram datasets, including initial render, interaction latency, memory, and export.
4. Verify lifecycle stability under repeated update, resize, renderer switch, plugin enable/disable, and destroy operations.
5. Tighten TypeScript declarations for public Specs, chart-specific options, capability profiles, planning results, diagnostics, state, events, and exports.
6. Complete 2.0 adoption guidance, API reference, bilingual Agent documentation, versioned manifests, visual baselines, changelog, and release checklist. A 1.x-to-2.0 migration guide is intentionally out of scope because 2.0 is a new Agent-first product line rather than a compatible upgrade.
7. Run final package-consumer smoke tests for ESM import, browser module import, representative Agent workflows, and all exact preview URLs.

## Verification

- `npm run agent:check` and `git diff --check` pass.
- The chart-by-feature matrix is backed by automated or recorded browser evidence.
- All 16 chart types render in the full Gallery with no uncaught errors.
- Capability, recommendation, validation, runtime state, documentation, and TypeScript declarations agree.
- SVG and Canvas parity is verified for supported common features and semantic record references.
- Chrome, Safari, Firefox, mobile viewport, physical-device, performance, and lifecycle gates have explicit results.
- No new public chart type is introduced during Iteration 8.

## Preview and Acceptance

- The target Playground information architecture, page responsibilities, migration decisions, and delivery order are defined in `docs/agent/development/playground-plan.md`.
- Full chart Gallery: `http://localhost:3000/playground/project-gallery.html`
- Foundational chart Gallery: `http://localhost:3000/playground/foundational-gallery.html`
- Project intelligence: `http://localhost:3000/playground/project-intelligence.html`
- Diagram editor: `http://localhost:3000/playground/diagram-editor.html`
- Business editing: `http://localhost:3000/playground/editing.html`
- Start the no-cache server from the repository root with `npm run playground`.
- Every phase delivery report must state changed capabilities, exact preview URLs, automated results, manual acceptance steps, and deferred environment checks.

## Deliverables

- Audited chart-by-feature capability matrix for all 16 public chart types.
- Completed common chart behavior and chart-family-specific gap fixes.
- Per-chart machine-readable capability and option metadata.
- Agent planning, diagnostics, explanation, and self-check contracts.
- Expanded positive and negative Agent recipes with deterministic contract tests.
- Browser, mobile, accessibility, performance, lifecycle, packaging, and release acceptance records.
- Updated runtime, TypeScript declarations, manifests, bilingual documentation, demos, tests, and 2.0 release checklist.

## Completion Definition

Iteration 8 is complete when all existing chart types provide their applicable common features reliably; unsupported behavior is explicitly discoverable; an Agent can select, configure, validate, render, explain, and verify charts without reading source code; SVG and Canvas semantics are consistent; browser, mobile, accessibility, performance, lifecycle, packaging, and preview gates are recorded; and the repository is ready for a final iChart.js 2.0 release decision without adding new chart types.

## Acceptance Record

Date: 2026-09-16

### Result

Iteration 8A–8D is implemented and accepted for the repository runtime, public Agent contracts, maintained Playground pages, responsive browser viewport, lifecycle checks, and repeatable performance fixtures. Chromium, Firefox 144, WebKit 26, and native Safari 26.6.2 checks pass. Physical iOS/Android checks remain a separately recorded host/device follow-up.

### Automated Evidence

- `npm run agent:check`: passed.
- `git diff --check`: passed.
- Core tests: 51 passed, 0 failed.
- Agent documentation check: 16 charts, 24 commands, and 7 schemas.
- Syntax check: every `src/*.mjs` file passed `node --check`.
- Node.js 18.20.8, 20.20.2, and 22.22.2: Agent checks and the executable Agent workflow passed.
- Package-consumer coverage: public ESM imports, capability discovery, planning, validation, explanation, chart creation, lifecycle, and active Playground entry files are covered by the core suite.

### Browser Evidence

- Environments: Codex in-app Chromium, Playwright Firefox 144, and Playwright WebKit 26 against `npm run playground` on `127.0.0.1:3000`.
- Full Gallery: all 16 public chart types rendered; 0 error cards and no uncaught page errors.
- Renderer switch: all Gallery cases rendered with SVG when forced; default mixed SVG/Canvas cases also passed.
- Responsive checks: desktop and a true 390 x 844 viewport completed without body overflow.
- Agent Workbench: `id` remained a stable identifier, `month` was selected as the dimension, validation passed, record IDs were preserved, and the expected missing-value warning remained visible.
- Interaction Lab: zoom in, zoom out to the full window, pan, reset, selection clearing, keyboard behavior, and Canvas switching passed.
- Accessibility Lab: Line, Pie, Heatmap, Radar, Gantt, and Flow exposed role, accessible label, focusability, and family-specific semantic output.
- Regression pages: Foundational Gallery, Project Intelligence, Business Editing, and Diagram Editor loaded with ready states and no uncaught page errors.
- Lifecycle fixture: 25 create/destroy cycles left 0 chart children and 0 tooltips.
- Firefox/WebKit matrix: 22/22 desktop and 390 x 844 touch-viewport page scenarios passed after fixing Project Intelligence grid shrink behavior and redundant ResizeObserver rendering.
- Native Safari 26.6.2: 11/11 desktop and 390 x 844 page scenarios passed without horizontal overflow.

### Performance Sample

These are local acceptance samples, not universal device budgets.

| Scenario | Renderer | Create | Resize | JSON export |
| --- | --- | ---: | ---: | ---: |
| Line, 100 rows | Canvas | 1.7 ms | 0.6 ms | 0.1 ms |
| Line, 1,000 rows | Canvas | 6.3 ms | 4.9 ms | 0.3 ms |
| Line, 5,000 rows, Firefox | Canvas | 110 ms | 96 ms | 3 ms |
| Line, 5,000 rows, WebKit | Canvas | 81 ms | 75 ms | 2 ms |
| Heatmap, 5,000 rows, Firefox | Canvas | 19 ms | 15 ms | 2 ms |
| Heatmap, 5,000 rows, WebKit | Canvas | 15 ms | 10 ms | 2 ms |

The Performance Lab also includes repeatable 5,000-row Line, Heatmap, Gantt, and Diagram scenarios for release-host measurements.

### Post-release Host/Device Follow-up

- Physical-device touch acceptance on iOS and Android.
- Release-host performance budgets across representative low-end and high-end devices.

These checks remain important integration evidence, but the three-engine browser matrix, native Safari run, responsive touch viewport, and deterministic local performance fixtures are sufficient for the 2.0 source release.
