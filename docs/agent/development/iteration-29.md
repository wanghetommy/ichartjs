# Iteration 29 — Unified Chart Component Layout & Readability

## Status and Scope

Implemented and released in `v2.0.29`, 2026-10-12. This is component consistency work, not a new chart type. Preserve public entry names, profile isolation, renderer parity, stable IDs, static navigation/editing defaults and existing footprint budgets.

## 29A — Shared Layout and Entry Consistency

- Remove the duplicated standard-chart builder: root and `/standard` must share axes, domains, chrome, labels and marks without importing project/diagram/board code into `/standard`.
- Share font-aware title, legend and branding space; expose effective chrome/plot boxes and diagnose insufficient space.
- Match project/diagram profile layout with root. Preserve manual positions and routes.
- Make legend placement, alignment, fitting and bounded overflow explicit; no unlimited legend growth into the body.

## 29B — Text and Label Reliability

- Reuse effective-font measurement for axes, legends and side labels.
- Preserve existing mark/polar collision policies, plain labels without plates, diagram inline plates and grapheme-safe fitting.
- Fit long Funnel stage labels before truncation; retain semantic warnings when physical space is insufficient.
- Localize generated empty-state text and keep its position within the allocated body.

## 29C — Visual Token Enforcement

- Honor resolved line width, point radius and mark opacity in shared builders; keep selection styles and contrast visible.
- Reuse contrast-ratio decisions for labels rather than profile-specific brightness heuristics.
- Avoid adding tokens with no rendering implementation or loosening size/performance budgets.

## 29D — Interaction and Output

- Use chart encodings/names, formats and locale for standard-chart tooltips; do not dump arbitrary IDs/internal fields.
- Respect explicit hover/click switches, hide stale tooltips after updates and keep host-owned navigation/editing opt-in.
- Keep focused profile updates inside their declared chart family; theme-derived colors, background and padding must refresh unless explicitly overridden.
- Preserve documented lightweight profile interaction/export boundaries; no second interaction runtime.
- Verify SVG/Canvas, JSON reconstruction and mounted exports against the same effective scene.

## Acceptance

- Root/profile scene parity for all 18 chart types, including multiple series, temporal/numeric axes, stacked/Combo/Bin, legend positions, large text, dark/contrast, empty data and constrained sizes.
- Focused regressions then `npm run agent:check`, `npm run docs:snippets`, `npm run performance:check`, `npm run test:browser` and `git diff --check`.
- Refresh generated manifests and footprint without increasing budgets.
- Reuse Project Gallery, Profile Loading and Accessibility Lab for acceptance; do not add a second gallery. Preview URLs: `http://localhost:3000/playground/project-gallery.html`, `http://localhost:3000/playground/profile-loading.html`, `http://localhost:3000/playground/accessibility-lab.html`.

## Evidence

- `npm run test:browser`: 39/39 real-browser scenarios passed across SVG and Canvas.
- `npm run agent:check`: 411/411 unit tests passed; contracts, types, recipes, docs, package, consumers and profiles passed.
- `npm run performance:check`: Line 1k/10k/50k and Heatmap 2.5k create/update/resize checks passed.
- `git diff --check`: passed. Package version is `2.0.29`; tag and npm publication are recorded by the release SOP.
