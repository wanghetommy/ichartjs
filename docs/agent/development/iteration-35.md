# Iteration 35 — Default Visual Quality

Status: 35A–35D implemented and accepted for `v2.0.35`. The author explicitly authorized a patch release on 2026-10-17; publication follows the Release SOP.

## Scope

Make ordinary valid Specs readable and proportionate without Agent-authored styling workarounds. Reuse existing themes, layout helpers, Scene geometry, profiles and Playground pages. Add no chart type, service, dependency or public configuration family.

| Stage | Implementation | Acceptance |
| --- | --- | --- |
| 35A | Protect Diagram edge text using final geometry, not placement flags; opaque local plates and render-only line gaps preserve transparent backgrounds. | Soft Flow at 768px; own/other edges, curves, zoom, resize, themes, SVG/Canvas, export and manual-route reconstruction. |
| 35B | Derive unspecified node sizes from text, shape, icons and existing typography; preserve explicit dimensions and positions. Reuse bounded stroke sizing. | Short/long English and CJK, semantic shapes, font changes, automatic layouts and constrained hosts. |
| 35C | Share automatic foreground contrast selection, retain and diagnose explicit label colors, account for composited backgrounds, and avoid unnecessary diagram axis gutters. Keep ordinary chart labels plate-free and prefer positions away from data lines. | Light/dark/contrast, custom fills and opacity, title/legend/font updates, polar chart and Cartesian label regressions. |
| 35D | Add default-first Scene and real-browser visual acceptance with representative data, synchronize guides and Skill, verify footprint/performance. | 390/560/768/1024px, root/Profiles, both renderers, PNG/SVG/JSON and physical-space diagnostics. |

## Constraints

- Do not change logical routes, saved waypoints, hit targets, explicit node geometry or the viewport to hide visual defects.
- Preserve static navigation/editing defaults, the optional classic/soft choice and the existing 640 KiB raw / 160 KiB gzip root limits.
- Do not add generic label backgrounds to Pie, Gauge, Radar or Cartesian charts. Only Diagram edge labels get local line protection.
- Prefer automatic sizes before wrapping, bounded font fitting and diagnosed truncation. Do not promise unlimited content at every physical size.
- Validation/renderability is not visual acceptance. Use realistic multi-record/multi-node examples, not only one-record minimal Specs.

## Preview

Reuse the existing pages; no per-example visual workaround or new Playground page was added.

- SVG: `http://localhost:3000/playground/project-gallery.html?case=flow-soft&size=768&renderer=svg`.
- Canvas: `http://localhost:3000/playground/project-gallery.html?case=flow-soft&size=768&renderer=canvas`.
- Manual routes and history: `http://localhost:3000/playground/diagram-editor.html?scenario=editor&loop=1`.

Inspect `High risk`, then switch width/mode, enlarge and export SVG/PNG. Edge text must interrupt every crossing connector, not just its own route. Ordinary Pie/Gauge/Cartesian labels must remain plate-free. Drag a connector twice, move an endpoint, undo/redo and reload the Spec: protection must not modify the saved route or viewport.

## Delivered

- **35A:** final Scene text bounds protect both inline and offset Diagram labels from every crossing Diagram connector. Opaque local backgrounds use matching opaque borderless plates; transparent backgrounds use render-only gaps, not white patches. Cubic segments retain exact subdivided Bezier geometry. Logical route points, hit sampling, arrows and manual waypoints are unchanged. Protection is rebuilt after viewport transforms and rerouting; embedded Board transforms and zero-padding group frames account for display-sized labels.
- **35B:** unspecified node dimensions use existing typography, measured text, semantic shape interiors, icons and bounded two-line fitting. Flow, Architecture, tree Mindmap and Swimlane share the sizing helper; explicit dimensions and positions remain authoritative. Stroke scaling uses measured node height and retains the existing 0.8–1.35 preset bound. Constrained layouts report overflow, overlap or label fallback instead of silently shrinking user geometry or changing the viewport.
- **35C:** shared foreground selection accounts for supported alpha colors and actual mark opacity, with black/white fallbacks where needed. Explicit `labels.color` is retained and diagnosed below 4.5:1. Gauge metrics avoid mixed-color boundaries and use their actual sector background. Line/Area labels avoid all series paths and points, synchronizing annotation occupancy; bounded suppression remains diagnostic. The Diagram preset has 16px outer padding and no date-axis gutter; title, lane and layer reserves remain content-driven.
- **35D:** default-first regression fixtures cover realistic data and topology without relying on demo-specific fonts, colors or node geometry. English/Chinese Diagram and Theme guides and the Skill readability reference describe the defaults, explicit overrides, constraints and intended-size acceptance. No new public configuration, dependency or chart type was added.

## Acceptance — 2026-10-17

- `npm run agent:check`: passed, including **497 unit tests**, contracts, TypeScript, dependency cycles, recipes, documentation, package/consumer checks, profiles and syntax.
- `npm run test:browser`: **59/59 passed** in Chrome, serially, about 611 seconds. The new browser helper covers **48 Soft Flow** combinations (four widths, three modes, root/Diagram Profile, SVG/Canvas) and **432 default-first** combinations (18 chart fixtures, four widths, three modes, SVG/Canvas), with actual text bounds and opaque/transparent PNG pixel checks. The surrounding suite covers manual route/history/reload, group clearance, resized/enlarged previews, host lifecycle and exports.
- Initial complete-browser run was **57/59**, not accepted: an older test incorrectly connected separate SVG `M` subpaths across the new text gaps, and one Gallery enlargement timed out. The route assertion now checks both logical points and actual drawn subpaths; no routing implementation or timeout threshold was weakened. Isolated retests and the final serial 59/59 run passed. No persistent Gallery defect was reproduced.
- `npm run consumer:browser -- --artifacts=/tmp/ichart-35-final-delivery`: final local-tarball run passed **10 host-lifecycle, 20 delivery and four Agent-task** combinations across all five entries. SVG/PNG/JSON task artifacts were saved for inspection.
- `npm run performance:check`: passed the existing local lifecycle smoke budget. Largest measured lifecycle operation was about 206ms (50k-point Line); this is not a physical-device benchmark or a dense-Diagram performance guarantee.
- `npm run bundle:measure -- --output=playground/bundle-footprint.json`: refreshed real production-bundle evidence. Root is **323,910 bytes minified / 103,519 bytes gzip**; source-graph footprint is a different metric.
- `npm run footprint:check`: passed without changing budgets. Root source graph is **629,037 bytes raw / 157,118 bytes gzip**, an increase of **12,443 / 3,562 bytes** from v2.0.34. Limits remain **655,360 / 163,840 bytes** (640/160 KiB), leaving 6,722 gzip bytes. npm tarball is **335,922 bytes**, unpacked **1,236,659 bytes**, both within existing ceilings.
- `git diff --check`: passed. Existing public API and static interaction defaults are unchanged; the initial implementation acceptance above preceded the release metadata update.

## Release Acceptance — v2.0.35

- Updated package/lockfile, runtime, Playground, manifest and release-pinned English/Chinese Agent/Skill guidance to `2.0.35`; added the Changelog and Roadmap entry.
- Re-ran `npm run agent:check` (**497/497 unit tests**), `npm run test:browser` (**59/59**, Chrome), `npm run performance:check`, `npm run docs:snippets` (nine Node scenarios, 19 tracked blocks), and `git diff --check`: passed.
- Refreshed generated reports for the release candidate: root source **629,037 bytes raw / 157,118 bytes gzip**; npm tarball **336,239 bytes**, unpacked **1,237,677 bytes**. Production root remains **323,910 bytes minified / 103,519 bytes gzip**. Existing budgets are unchanged and pass.
- npm author identity and Registry were verified before publication. Push the release commit and matching tag before npm publication; merge `develop` to `master` with `--no-ff` afterward, following the Release SOP.

## Boundaries

Physical space is finite; visible overflow, overlap, constrained placement and suppression diagnostics still require review at the intended output size. The color helper supports common hex and comma RGB/RGBA forms, not all CSS color syntaxes; an unknown transparent host background cannot receive a contrast guarantee. Ordinary chart labels never receive Diagram plates. Browser evidence is local Chrome, not Safari/Firefox, physical mobile devices or certification of every possible Spec. The 18-fixture matrix excludes the separately tested optional Soft Flow fixture; it does not introduce another chart type.

## Post-release Follow-up — Enlarged Manual Diagram Labels

Status: follow-up accepted for `v2.0.36`; publication explicitly authorized on 2026-10-17. The following evidence was collected locally before the release metadata update.

User screenshot review confirmed missing Start/End labels and a truncated Load data label in the enlarged Delivery flow. A larger label font reproduces this even though the default 12px card looks correct. Node fitting used saved, unscaled dimensions before the viewport transform; ellipse/diamond width also subtracted rectangular padding on top of the inscribed-area limit. Multiline spacing was subsequently scaled even though glyph sizes stayed in display pixels.

The shared Diagram fitting helper now measures visible shape dimensions and converts fitted block metrics back to logical coordinates before the common Scene transform. Semantic shapes use their inscribed text area, and blocks below the bounded readable height are suppressed rather than overflowing. Spec geometry, routes and view values are preserved. The change applies to Flow, Architecture, Mindmap and Swimlane through root/Diagram Profile and both renderers; it does not enlarge the demo nodes or lower the font minimum.

The earlier Gallery preview regression checked node enlargement, not text content after font preferences; the default-first matrix also removed manual node sizes. New regressions retain the actual Gallery fixture, combine larger fonts with preview/restore, assert full labels and display-sized multiline spacing, and inspect real SVG text and Canvas text pixels in an isolated preferences context. Follow-up acceptance is recorded separately from the published v2.0.35 results above.

- Reproduced the failure before the fix: 15px node text hid Start/End despite a 3x viewport, and multiline spacing was multiplied by view scale. Both new unit regressions failed on the old helper and pass after the fix.
- Final `npm run agent:check`: **499/499 unit tests** and all contract/type/docs/package/footprint/Profile checks passed. Focused Flow/Diagram suites passed **29/29**. Existing performance smoke and `git diff --check` passed.
- Full Chrome run: **59/60 passed**; the one failure was the older Soft Flow preview assertion expecting two `ICON_SUPPRESSED` warnings after enlargement. With correct visible-space fitting, all six labels/icons now fit. Updated that assertion to require zero warnings, six visible labels and `ready`; retained the narrow-card suppression and restore assertions. The unchanged runtime then passed the two affected browser tests **2/2**, including real SVG text and Canvas pixels, menu font changes and close/restore. No timeout or visual constraint was relaxed; the complete suite was not rerun after this test-only expectation update.
- Source graph: **629,229 bytes raw / 157,167 bytes gzip** (only **192 / 49 bytes** above v2.0.35); root production bundle **323,996 bytes minified / 103,550 bytes gzip**. npm candidate **336,700 bytes**, unpacked **1,238,752 bytes**. Budgets are unchanged and pass.
- Manually inspected the actual Gallery preview with the menu's `1.3` (extra-large) text setting: Start, End and Load data are complete; restored the prior font preference afterward. Proof: `/tmp/ichart-delivery-flow-enlarged-fixed.jpg`.

## Post-release Follow-up — Diagnostic Guidance

Status: follow-up implemented and accepted for `v2.0.36`; publication explicitly authorized on 2026-10-17. Includes the preceding manual-label fix. The following evidence preceded the release metadata update.

- Count color-coded groups/series instead of X categories for `HIGH_CARDINALITY_COLOR`; cover false positives in single-series Cartesian charts, Scatter and Heatmap, and missed Radar series identified only by IDs. Preserve genuine high-cardinality warnings with machine-readable counts.
- Reject explicitly supplied falsy scalar `size`, `position` and `ports` values. Retain per-node/field errors and add stable IDs, precise paths, expected/received values and correct examples; do not merge different paths into one generic error.
- Attach current and estimated recommended chart sizes to Diagram overflow, measuring placed node bounds and existing reserves rather than assuming equal node widths. Keep existing minimum gaps, explicit geometry and static viewport defaults. Diagnose small fixed nodes separately from chart size.
- Make `LAYOUT_MODE` list the canonical choices, received value and manual-layout guidance. Do not add a direction/layout alias. Clarify continuous Heatmap scales and `colorScale.range` across bilingual guides and Skill references.
- Related issue found during root/Profile regression: Profiles omitted resolved theme diagnostics, and resolving an exported theme could preserve stale warning snapshots. Include current theme warnings in Profile state/explanation and recompute derived theme diagnostics on every resolution.

### Follow-up Acceptance

- Added nine focused regression tests and synchronized optional diagnostic metadata in TypeScript declarations and the consumer fixture. Explicit falsy/null layout values are rejected rather than silently replaced with the default. Swimlane color counts resolve default-lane aliases and exclude unused lanes.
- `npm run agent:check`: **508/508 unit tests** passed, together with contracts, TypeScript, documentation, recipes, package/consumer checks, footprint, profiles and syntax. Focused diagnostic tests passed **9/9**; existing performance smoke passed without changing thresholds.
- Complete Chrome browser suite: **61/61 passed**, with no skips. The added diagnostic test covers eight root/Profile and SVG/Canvas combinations, warning refresh, resize recovery, atomic rejection of malformed updates and SVG text preservation. This complete run also closes the earlier manual-label follow-up's full-suite verification gap; its initial 59/60 result remains recorded above.
- Refreshed reports: root source graph **631,980 bytes raw / 158,050 bytes gzip**, leaving **5,790 gzip bytes** under the unchanged 640/160 KiB limits. Production root bundle is **326,006 bytes minified / 104,367 bytes gzip**. npm candidate is **340,392 bytes**, unpacked **1,248,721 bytes**, within existing ceilings. Development acceptance records are excluded from the npm package.
- Boundary: the minimal six-node Flow at 760px reproduced layout overflow, not six suppressed labels; all six labels were visible. Its measured recommendation is 786px with current chrome reserves, and resizing clears the overflow. The reporter's exact all-label suppression cannot be confirmed without the original Spec. Recommendations remain estimates, not automatic resizing or guarantees for arbitrary pinned positions/routes; small explicit nodes require node-size repair instead.
- Preview diagnostics in the existing Diagram Editor Spec import/output area: `http://localhost:3000/playground/diagram-editor.html?scenario=editor`. Existing Gallery defaults and enlarged labels remain available at `http://localhost:3000/playground/project-gallery.html`. No new preview page, dependency, layout mode or public method was added.

## Release Acceptance — v2.0.36

- Publication explicitly authorized by the author on 2026-10-17. The release includes both post-release follow-ups above, without adding chart types, changing static interaction defaults or raising budgets.
- Synchronized package/lockfile, runtime, Playground, capability manifest and release-pinned bilingual Agent/Skill instructions to `2.0.36`; updated the Changelog, Roadmap and development index.
- Re-ran `npm run agent:check`: **508/508 unit tests** plus contract, type, documentation, recipes, package/consumer, footprint, profile and syntax checks passed. `npm run docs:snippets` passed nine Node scenarios and tracked 19 blocks; existing performance smoke passed.
- Complete release-candidate Chrome suite: **61/61 passed**, no skips, about 678 seconds. Installed local-tarball browser acceptance passed **10 lifecycle, 20 delivery and four Agent-task** combinations; task artifacts are in `/tmp/ichart-2.0.36-consumer`.
- Refreshed final reports: root source graph **631,980 bytes raw / 158,049 bytes gzip**; production root **326,006 bytes minified / 104,367 bytes gzip**; npm tarball **340,680 bytes**, unpacked **1,249,602 bytes**. Existing fixed budgets are unchanged and pass. Development acceptance records are excluded from npm packaging.
- Verified the npm author identity is `taylorwong`, the registry is npmjs, and `2.0.36` was not already published. Push the matching develop commit/tag before npm publication, then merge develop into master with `--no-ff`, following the Release SOP.
