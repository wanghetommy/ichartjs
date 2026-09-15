# Iteration 7 — Foundational Chart Coverage

## Goal

Close the highest-frequency foundational chart gaps without creating redundant public chart types. First strengthen reusable composition and transform capabilities, then add `heatmap` and `radar` as independently supported chart types.

## Admission Policy

- Donut remains a `pie` mode configured with `innerRadius`; do not register `donut` as a public type.
- Stacked and percent-stacked charts remain modes of `bar`, `column`, and `area`.
- Combo charts use mixed multi-series encodings and optional dual axes; do not register `combo` as a public type.
- Histograms use a deterministic `bin` transform rendered with `bar` or `column`; do not register `histogram` as a public type.
- `heatmap` and `radar` become public chart types because they require distinct layout, interaction, accessibility, and rendering semantics.
- Treemap, box plot, Sankey, waterfall, maps, and 3D remain outside Iteration 7.

## 7A — Composition and Transform Foundations

1. Define normalized stack configuration for `bar`, `column`, and `area`, including grouped, stacked, and percent-stacked modes.
2. Implement positive and negative stack accumulation with deterministic domains and stable source record references.
3. Add `pie.innerRadius` with validation, normalized geometry, tooltip behavior, labels, and zero-total handling.
4. Extend multi-series encodings with explicit per-series mark type so line and column marks can share one coordinate system.
5. Define combo-axis rules, legend semantics, hit testing, selection, and renderer-equivalent data references.
6. Add a deterministic `bin` transform with explicit field, thresholds or step, extent, interval closure, and invalid-value warnings.
7. Ensure transforms never mutate source rows and expose normalized output through inspection and JSON export.

### Checkpoint

- Grouped, stacked, and percent-stacked examples render consistently in SVG and Canvas.
- Donut output is produced by `type: "pie"` plus `innerRadius`.
- A column-line combo uses one Spec and preserves per-series tooltip and axis identity.
- Histogram bins are reproducible and reconcile with the valid numeric input count.

## 7B — Heatmap

1. Register `heatmap` in Spec validation, capabilities, recommendations, recipes, and TypeScript declarations.
2. Define categorical and temporal x/y matrix encodings plus a quantitative color encoding.
3. Add continuous and discrete color scales with explicit domain, range, clamp, and missing-value color.
4. Implement deterministic cell layout, padding, labels, tooltip, hit testing, keyboard navigation, and linked selection.
5. Preserve empty cells and distinguish missing values from numeric zero.
6. Support responsive sizing, large-matrix degradation rules, SVG, Canvas, accessibility summaries, and normalized export.

### Checkpoint

- Categorical and calendar-style heatmaps render from the same normalized matrix contract.
- Missing, zero, minimum, and maximum values have distinguishable semantics.
- Keyboard navigation identifies row, column, value, and source record.

## 7C — Radar

1. Register `radar` in Spec validation, capabilities, recommendations, recipes, and TypeScript declarations.
2. Define indicator names, domains, normalization rules, axis order, and multi-series data shape.
3. Implement polygon grid, radial axes, labels, series lines, points, and optional area fill.
4. Add explicit handling for mixed units, missing indicators, negative domains, and constant-value domains.
5. Add tooltip, legend selection, keyboard traversal, responsive label collision handling, and semantic summaries.
6. Maintain SVG/Canvas parity and stable source record references in normalized JSON export.

### Checkpoint

- Single-series and multi-series radar charts use declared indicator domains reproducibly.
- Mixed-unit inputs warn unless explicit per-indicator domains are provided.
- Labels remain readable at desktop and mobile widths.

## 7D — Agent, Gallery, and Release Closure

1. Update the public capability manifest, API reference, chart-selection guidance, and schema examples.
2. Add Agent recipes for composition comparison, distribution analysis, matrix analysis, and multidimensional comparison.
3. Add focused unit tests for normalization, geometry, invalid data, source immutability, and stable record IDs.
4. Add SVG/Canvas semantic parity, lifecycle, accessibility, responsive, and performance regression coverage.
5. Add a dedicated foundational chart gallery and synchronize the full Gallery count and filters.
6. Complete desktop and mobile browser acceptance and record deferred physical-device checks separately.

## Verification

- `npm run agent:check` and `git diff --check` pass.
- Existing Specs remain backward compatible and unchanged defaults preserve current rendering.
- No new public type is introduced for Donut, Combo, Stacked, or Histogram.
- Stack totals, percent totals, pie radii, and bin boundaries are deterministic.
- Heatmap and Radar provide equivalent semantic references in SVG and Canvas.
- Missing, invalid, ambiguous, and mixed-unit data produce structured warnings rather than silent guesses.
- Gallery examples remain usable at desktop and mobile viewport widths.

## Preview and Acceptance

- Full gallery: `http://localhost:3000/playground/project-gallery.html`
- Iteration 7 gallery: `http://localhost:3000/playground/foundational-gallery.html`
- Start the server from the repository root with `python3 -m http.server 3000 --bind 127.0.0.1`.
- 7A acceptance must show grouped/stacked/percent charts, Donut, Combo, and Histogram examples.
- 7B acceptance must show categorical and calendar heatmaps, missing values, tooltips, and keyboard focus.
- 7C acceptance must show single/multi-series Radar, explicit indicator domains, and mobile label behavior.
- Every phase delivery report must include its exact preview URL and manual acceptance steps.

## Deliverables

- Stack, mixed-mark series, pie radius, and bin-transform contracts under `src/`.
- Public `heatmap` and `radar` chart implementations.
- Updated capability manifests, TypeScript declarations, documentation, and Agent recipes.
- `playground/foundational-gallery.html` plus synchronized full Gallery coverage.
- Iteration 7 automated and browser acceptance record.

## Completion Definition

Iteration 7 is complete when stacked charts, Donut, Combo, and Histogram workflows are stable reusable capabilities; Heatmap and Radar are fully supported public chart types; SVG, Canvas, interactions, accessibility, export, recipes, tests, and HTTP demos pass acceptance; and no redundant chart type has been added.

## Current Delivery

- 7A provides stacked and percent-stacked Bar/Column geometry, Donut through `pie.innerRadius`, mixed line-column series, and deterministic bin transforms.
- 7B registers Heatmap with matrix encodings, continuous colors, explicit missing-value color, stable record references, SVG/Canvas rendering, and keyboard traversal through shared interactive Scene nodes.
- 7C registers Radar with explicit indicators, polygon grids, multi-series rendering, stable record references, and warnings for ambiguous domains or invalid values.
- 7D updates capabilities, declarations, recipes, documentation, automated coverage, the full Gallery, and `playground/foundational-gallery.html`.

## Acceptance Record

- `npm run agent:check`: pass, 16 chart types and 42 automated tests.
- `git diff --check`: pass.
- Desktop browser, isolated local server: `playground/foundational-gallery.html` renders 8/8 cards with 5 SVG and 3 Canvas charts; no console warnings or errors.
- Desktop browser, isolated local server: `playground/project-gallery.html` renders 16/16 chart types with 10 SVG and 6 Canvas charts; no console warnings or errors.
- The browser viewport override was requested at 390 x 844, but the connected browser continued reporting a fixed 1280-pixel viewport. Responsive CSS and chart initialization passed, while true mobile viewport and physical-device acceptance remain a release-environment check.
