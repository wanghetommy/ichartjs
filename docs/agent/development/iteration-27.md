# Iteration 27 — Agent Incremental Board Building

## Scope

Extend the existing Freeform Board, not a new chart type or a second whiteboard mode. Reuse the preview/confirmation/revision principles of Iteration 26, BoardSpec validation and bounded EditHistory. Board compositions retain explicit positions; Flow layering is not applied to charts, images or drawings.

Included in the separately authorized `v2.0.27` release (2026-10-08). The original iteration acceptance records below describe pre-release work on `2.0.26`; they did not themselves authorize committing, tagging, pushing or publishing.

## 27A — Safe semantic turns

- `type: board-edit` supports add/update/remove for items and image assets; inspect syntax with `validateBoardCommand()`.
- Validate each complete batch's final BoardSpec and scene before publishing. Stable IDs, references, locked items, explicit cascades, opt-in editing/structural permissions and host confirmation are enforced.
- `previewEdit()` issues Board-specific, revision-bound previews; `applyEdit()` uses the stored preview rather than caller-mutated preview data. Host changes, history and different instances invalidate previews.
- One successful semantic turn creates one revision and Undo entry; invalid edits do not partially publish. Existing direct Board methods remain trusted-host APIs.

## 27B — Preserve composition and observe progress

- No automatic global rearrangement, zoom, pan, animation engine, prompt parser or network service. Use explicit position/size updates only for requested layout changes; preserve untouched drawings, chart boxes and locks.
- Expose board-space item bounds and text layout in preview/state. `subscribe()` reports committed turns, history and asset readiness; listener failures/reentrant edits cannot corrupt a transaction.
- Synchronize image caches/status on source changes, deletion and history; protect against stale asynchronous loads. Preview never requests images. `ready()` loads current sources and status remains inspectable in browser/headless environments.
- Recompute effective renderer after host updates, including `auto` thresholds. SVG/Canvas share transactions, visibility, history and JSON reconstruction.

## 27C — Agent discovery and acceptance demo

- Root and standalone `/board` expose the same Board transaction API without adding full chart runtime dependencies to the profile. Root supports all embedded chart families; Board profile supports standard charts.
- Add a validated Board building recipe and execute its confirmed turns in the recipe gate. Synchronize capability manifest, TypeScript, bilingual Board/conversational/runtime guides and Skill.
- Extend the existing Freeform Board page with explicit Start, command editing, separate visual Preview, Confirm and apply, Undo/Redo and host Save/Reload. Keep the original composition demo available.

## 27D — Validation

- Test sequential mixed-content construction, chart/data/style updates, explicit movement, final-reference validation, cascades and locks, permission/confirmation/stale guards, mutation resistance, history, subscribers, source races, renderer policies and JSON/SVG delivery.
- Exercise the actual browser demo in SVG/Canvas, including preview isolation, repeated turns, history, invalid batches and save/reload.
- Run full Agent gates and browser regression suite, Skill validation and whitespace checks. Retain existing browser footprint budgets.

## Preview

- SVG advanced acceptance: `http://localhost:3000/playground/canvas-board.html?scenario=advanced`
- Canvas advanced acceptance: `http://localhost:3000/playground/canvas-board.html?scenario=advanced&renderer=canvas`
- Start explicitly, Preview command, then Confirm and apply. Existing items do not move unless the current command requests it. Verify Undo/Redo, Save/Reload and JSON/SVG exports.
- The bare page and `?scenario=incremental` now use Next, Previous step and Restart to build the original composition in four turns: charts, logo, cat drawing and arc/sector/Bezier examples. Both modes share the same fixture and preserve geometry and layering. Developer tools retain the full workflow; `?scenario=composition` opens the complete chart/drawing composition immediately.

## Status

### Agent-driven Incremental Construction consolidation

- Reused Iterations 26/27 rather than adding a new runtime coordinator or transport service. Unified the name, scenario choice, live-host prerequisites, semantic batches, confirmation and final acceptance in bilingual usage/conversational guides, README and Skill.
- Both existing host demos share step/status and affected-ID diagnostics, explicit Cancel preview, invalidation on state changes, and Review delivery. Template counts and renderability do not imply task completion. Flow's final removal template retains its intentional branch warning for review.
- Final-review tests exposed stale preflight diagnostics after typed edits. The shared edit publisher now validates the resulting Spec and refreshes diagnostics for commits and history, restoring prior diagnostics on failed rendering. Regression tests cover SVG/Canvas and ensure current warnings reach `getState()`, `explain()` and health.
- Host controls language understanding, command transport, permission, step UI and persistence. Runtime APIs, static defaults, SVG/Canvas behavior, profile boundaries and package version remain unchanged.
- Acceptance covers cancellation without commits, repeated turns, revision/history changes invalidating previews, rejected commands, and final review preserving unresolved diagnostics. Validation results are recorded after the final gates below.

Consolidation acceptance on 2026-10-07: `npm run agent:check` passes with 361 unit tests, the full Chrome suite passes 31 browser tests, and documentation snippets, Skill validation and whitespace checks pass. Shared status panels are visually inspected in actual browser screenshots. Footprint reports are refreshed without relaxing budgets; version remains `2.0.26`, with no commit, tag, push or npm publication.

27A–27D are implemented and accepted in the working tree on 2026-10-07. Validation passes: 359 unit tests (35 Iteration 27 cases), 27 browser tests (five Board construction/image/renderer cases), `npm run agent:check`, Skill validation and `git diff --check`. Actual SVG/Canvas previews, raster pixel output, history/reload and the existing Gallery/Flow regressions are verified. Runtime/profile/package footprint reports are refreshed without increasing the existing browser growth allowance. Package version remains `2.0.26`; nothing is committed or published by this iteration.
