# Playground Information Architecture

## Purpose

The `playground/` directory is the browser-visible product and acceptance surface for iChart.js. It must let a human reviewer browse capabilities, let an Agent integration developer exercise public contracts, and let maintainers reproduce interaction and release failures without reading implementation code.

The Playground is not a collection of iteration snapshots. Active pages are organized by stable user task; historical iteration pages should be retired after their unique coverage moves to a maintained page.

## Page Classes

### Entry and Catalog

| Page | Role | Required content |
| --- | --- | --- |
| `index.html` | Unified Playground home and acceptance entry point. | Runtime version, available chart count, links grouped by catalog/workbench/lab, server instructions, page readiness status, and exact acceptance URLs. |
| `project-gallery.html` | Canonical full catalog and first visual smoke test for all 16 public chart types. Keep this URL stable despite the historical filename. | Search and category filters, every public chart type, SVG/Canvas coverage, theme and viewport controls, enlarged preview, visible initialization status, Spec inspection, diagnostics, and links to specialized pages. |
| `foundational-gallery.html` | Focused regression gallery for reusable foundational features introduced in Iteration 7. | Grouped/stacked/percent charts, Donut, Combo, Histogram/Bin, Heatmap, Radar, renderer coverage, source record identity, and expected warnings. |

### Agent and Business Workbenches

| Page | Role | Required content |
| --- | --- | --- |
| `agent-workbench.html` | Primary Agent integration workbench and Iteration 8 Agent acceptance page. | Editable JSON data and intent, `inspectData`, per-chart capabilities, recommendation and alternatives, planning reasons/confidence, generated or editable Spec, validation/repair diagnostics, render result, chart explanation, normalized state, data lineage, and export. |
| `project-intelligence.html` | Project analytics and linked-view workbench. | Schedule assumptions/warnings, critical path and slack, baseline/actual variance, capacity, velocity, release forecast, risk, issue aging, linked filters, linked selection, and derived output inspection. |
| `editing.html` | Safe business-data editing workflow. | Schema inspection, typed command, deterministic preview, affected records, warnings, confirmation boundary, commit, undo/redo, revision, audit metadata, and explicit local-only persistence notice. |
| `diagram-editor.html` | Diagram authoring and editing workbench. | Node/group/lane/port editing, pointer and keyboard connections, routing, multi-select, clipboard, collapse, validation, normalized DiagramSpec, history, and visible interaction state. |

### Acceptance Labs

| Page | Role | Required content |
| --- | --- | --- |
| `interaction-lab.html` | Reproduce and verify common interaction behavior independently of Gallery layout. | Hover, tooltip, click, selection, wheel/pinch zoom in and out, pan, drag, keyboard traversal, touch cancellation, event/state log, reset controls, and boundary cases. |
| `accessibility-lab.html` | Keyboard and semantic acceptance for all applicable chart families. | Focus order, accessible names and summaries, keyboard-only tasks, contrast themes, reduced motion, missing-data descriptions, SVG/Canvas fallback differences, and a visible checklist. |
| `performance-lab.html` | Repeatable local performance and lifecycle measurements. | Deterministic dataset sizes, renderer switch, render/update/resize/export timing, mark counts, repeated create/destroy cycles, listener/observer status, memory notes, and downloadable result JSON. |

## Existing Page Decisions

| Current page | Decision |
| --- | --- |
| `project-gallery.html` | Keep as the stable full-gallery URL and improve it; do not rename during 2.0 release closure. |
| `foundational-gallery.html` | Keep as a focused foundational regression page; avoid adding unrelated future features. |
| `project-intelligence.html` | Keep as the project analytics workbench. |
| `editing.html` | Keep as the business editing workbench. |
| `diagram-editor.html` | Keep as the diagram editing workbench. |
| `iteration-2.html` | Migrate any unique examples into the full Gallery or interaction lab, then move out of the active Playground or replace it with a compatibility link. Do not continue extending it. |

## Responsibilities and Boundaries

- `project-gallery.html` answers: "What chart types exist, and do they render?"
- `foundational-gallery.html` answers: "Do the shared composition and analysis foundations still work?"
- `agent-workbench.html` answers: "Can an Agent discover, choose, configure, validate, explain, and verify a chart?"
- Domain workbenches answer: "Can a user complete this business workflow?"
- Acceptance labs answer: "Does one cross-cutting quality contract work across chart families?"
- A page must not duplicate another page's full dataset and controls merely to provide navigation; link to the owning page instead.
- Release-critical behavior must not be demonstrated only in an old iteration page.

## Shared Page Contract

Every active HTML page must:

1. Load directly over HTTP without first visiting another page.
2. Import public APIs through the single `playground/runtime.mjs` browser entry; per-page ad hoc cache-busting query strings are not part of the final contract.
3. Include a consistent header with page purpose, runtime version, Home link, and related-page links.
4. Show initialization, ready, warning, and error states in the page instead of relying on the console.
5. Provide deterministic fixtures with stable IDs and no required external network requests.
6. Provide a visible reset action for mutable interactions.
7. State the exact actions and expected results needed for manual acceptance.
8. Expose the relevant Spec, normalized state, diagnostics, events, or measurement output.
9. Work at 390 px, 768 px, and desktop widths, with keyboard-visible focus and reduced-motion support.
10. Destroy charts and listeners when examples are replaced or the page is unloaded.

## Shared Implementation Direction

- Move repeated styles, navigation, status badges, fixture data, and chart-card setup into small shared Playground modules rather than copying them between pages.
- Serve Playground assets through `npm run playground`, which sends `Cache-Control: no-store`; keep HTML pages and source-module imports free of cache-busting query keys.
- Keep page-specific scenarios declarative and JSON-friendly so they can also drive automated browser checks.
- Support deterministic query parameters where useful, such as `renderer`, `theme`, `case`, `size`, and `seed`; ignore unknown parameters with a visible warning.
- Assign every scenario a stable ID so browser tests, screenshots, Agent explanations, and acceptance records refer to the same case.
- Keep test instrumentation optional and visually separated from the chart itself.
- The full Gallery remains lightweight; expensive stress datasets and lifecycle loops belong only in `performance-lab.html`.

## Navigation Model

```text
index.html
├── project-gallery.html
│   └── foundational-gallery.html
├── agent-workbench.html
├── project-intelligence.html
├── editing.html
├── diagram-editor.html
├── interaction-lab.html
├── accessibility-lab.html
└── performance-lab.html
```

All active pages link back to `index.html`. The full Gallery links to relevant focused pages, and focused pages link back to the full Gallery when they display chart output.

## Iteration 8 Delivery Order

### 8A — Catalog Foundation

1. Add `index.html` and shared navigation/status utilities.
2. Add the chart-by-feature matrix to the full Gallery or link it from the Gallery.
3. Enhance the full Gallery with renderer, theme, viewport, diagnostics, and deterministic scenario controls.
4. Migrate unique `iteration-2.html` coverage and freeze the historical page.

### 8B — Interaction and Accessibility Labs

1. Add `interaction-lab.html` with observable events and state.
2. Add `accessibility-lab.html` with keyboard and semantic checklists.
3. Convert previously fixed Gallery and Diagram Editor bugs into named regression scenarios.

### 8C — Agent Workbench

1. Add `agent-workbench.html` around the public capability, inspection, planning, validation, rendering, explanation, and export contracts.
2. Ensure every diagnostic is visible and copyable as structured JSON.
3. Add representative successful, ambiguous, invalid, and unsupported Agent scenarios.

### 8D — Performance and Release Hub

1. Add `performance-lab.html` with reproducible datasets and downloadable results.
2. Make `index.html` show automated and manual acceptance status for every active page.
3. Synchronize README, Agent docs, capability manifests, and release records with exact URLs.

## Exact Target URLs

Start the cache-safe preview server with `npm run playground` before opening these URLs.

- Home: `http://localhost:3000/playground/index.html`
- Full Gallery: `http://localhost:3000/playground/project-gallery.html`
- Foundational Gallery: `http://localhost:3000/playground/foundational-gallery.html`
- Agent Workbench: `http://localhost:3000/playground/agent-workbench.html`
- Project Intelligence: `http://localhost:3000/playground/project-intelligence.html`
- Business Editing: `http://localhost:3000/playground/editing.html`
- Diagram Editor: `http://localhost:3000/playground/diagram-editor.html`
- Interaction Lab: `http://localhost:3000/playground/interaction-lab.html`
- Accessibility Lab: `http://localhost:3000/playground/accessibility-lab.html`
- Performance Lab: `http://localhost:3000/playground/performance-lab.html`

## Completion Definition

The Playground plan is complete when every active page has one clear owner responsibility, all stable URLs are reachable from the Home page, the full catalog and specialized workflows do not conflict, Agent behavior is independently verifiable, cross-cutting quality has dedicated labs, historical iteration pages are no longer release dependencies, and every Iteration 8 delivery report identifies an exact URL and reproducible acceptance procedure.
