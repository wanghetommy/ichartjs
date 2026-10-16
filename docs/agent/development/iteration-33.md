# Iteration 33 — Diagram Visual Language

Opt-in soft palette and diagram appearance, rounded nodes/safe orthogonal corners, open arrows and sixteen original vector icons. Preserve semantic shapes, routing, manual edits, static defaults and Iteration 32 delivery. No dependencies, chart types or implicit risk inference. Target release v2.0.32; the author explicitly authorized commit and publication.

## Implemented Scope

| Phase | Delivery |
| --- | --- |
| 33A | Independent `theme.palette: 'soft'` and `diagram.appearance: 'soft'`, light/dark colors and high-contrast fallback. No new preset or automatic business-status inference. |
| 33B | Shared rounded rectangles and cubic path construction, open/filled arrows, renderer-independent SVG attributes and Canvas geometry. Semantic Flow shapes stay unchanged. |
| 33C | Round only safe orthogonal corners; test a conservative curve hull against every obstacle, keeping unsafe corners sharp. Original waypoints, ports, handles and routing policy remain authoritative. |
| 33D | Sixteen original vector glyphs, left/top placement, optional badges and explicit node/edge tones. Text takes priority; unknown/suppressed glyphs are diagnosed. Board reuses shape items, without another item kind. |
| 33E | Root/Profile discovery, editable schemas, TypeScript, bilingual guides, Skill guidance, and existing Gallery/Editor/Board previews. JSON/history and browser export checks cover both renderers. |

Common code is shared through the path codec, SVG node attributes and JSON utilities; there are no external icon fonts, SVG parsers, assets or runtime dependencies.

## Reviewed Footprint Allowance

On 2026-10-16 the user approved retaining the complete 33A–33E scope and reviewing its additional footprint separately. The original baseline and 15% growth factor are unchanged. A fixed, visible Iteration 33 allowance is added to the original ceilings, not compounded into a new baseline:

| Metric | Additional allowance | Effective ceiling (bytes) |
| --- | --- | --- |
| Root source raw | 0 | 615,499 |
| Root source gzip | 4 KiB | 153,092 |
| npm tarball | 10 KiB | 405,935 |
| npm unpacked | 24 KiB | 1,440,743 |

The pre-33 Iteration 32 candidate measured 603,951 / 148,333 / 395,661 / 1,412,517 bytes respectively, leaving almost no original package headroom. Shared-code consolidation reduces duplication, but cannot make an entire new capability cost-free. `playground/footprint.json` records both baseline and reviewed allowance; boundary tests reject even one byte beyond each effective ceiling. Production minified bundles are measured separately and do not include documentation or Skill files.

## Previews

- [Soft Flow](http://localhost:3000/playground/project-gallery.html?case=flow-soft): palette/mode switching and SVG/Canvas, with a 450px host instead of clipping this taller example to the generic 300px card.
- [Soft manual editor](http://localhost:3000/playground/diagram-editor.html?scenario=editor&appearance=soft): explicit editing, route dragging, undo and Spec reload. Add `&renderer=canvas` for Canvas.
- [Vector icon catalog](http://localhost:3000/playground/canvas-board.html?scenario=icons): sixteen glyphs; add `&mode=dark&renderer=canvas`. Narrow hosts scroll without shrinking glyph text.

Narrow Gallery nodes may explicitly suppress icons to preserve text; no guarantee of unlimited content in physically small nodes is made.

## Acceptance — 2026-10-16

Implemented and accepted for v2.0.32; publication follows the author-only Release SOP.

- `npm run agent:check`: passed, including 456 unit tests, contracts, types, recipes, documentation, installed consumers, profiles, syntax and the reviewed footprint ceilings.
- `npm run test:browser`: final rerun 51/51 passed. New coverage checks 48 type/mode/entry/renderer combinations, equal PNG output, valid SVG, decorative icons, JPEG and JSON restoration; existing manual-route drag/rejection/undo/reload acceptance runs with both classic and soft appearances in SVG and Canvas.
- Installed, minified npm-tarball browser acceptance: 10 host lifecycle scenarios and 20 delivery scenarios passed, including Diagram/Board icons. No runtime dependency was added.
- `npm run docs:snippets`, `npm run performance:check` and `git diff --check`: passed. Visually inspected light/dark and narrow Soft Flow, manual editor and icon catalog. Closed cubic Board paths retain `Z` in SVG and Canvas closure after shared-path consolidation.
- Initial browser verification caught an editor initialization-order regression during demo reset integration; it was fixed and the complete suite rerun, rather than treating partial results as acceptance.

Production minified gzip measurements (bytes), compared with the pre-33 Iteration 32 candidate: root 99,830 (+1,917), standard 43,347 (+275), project 52,219 (+1,865), diagram 52,216 (+1,865), Board 53,131 (+1,354). These are browser transfer artifacts, not source-module gzip or the npm tarball. The generated footprint report records final package/resource measurements separately.

### Gallery Follow-up

Measure the dialog only after it becomes visible, using the actual content box rather than a hidden-element fallback or a forced 720px width. Fit and center manual diagrams against their declared composition size, refit on window resize, and restore the original card dimensions/view on close. Small windows scroll inside the dialog instead of shrinking nodes around unscaled text. Automatic layouts still rebuild at the preview dimensions without a second view scale.

Warning badges and JSON now refresh on render and preference changes, with diagnostic codes in the badge tooltip. The default 560px Soft Flow has no warnings. A 390px composition or larger persisted fonts can legitimately produce two `ICON_SUPPRESSED` warnings (Request and Agent); these decorative-icon limits remain visible, not suppressed to make acceptance green. Regression coverage checks visible dimensions, centering, local scrolling, restoration and font-warning recovery in SVG and Canvas.

Follow-up verification: 52/52 browser regressions plus the final targeted SVG/Canvas preview test passed; `agent:check` passed with 456 unit tests and the existing reviewed footprint ceilings. Runtime source and production bundle sizes are unchanged by this Playground-only fix.
