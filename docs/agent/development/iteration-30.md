# Iteration 30 — Reliable Updates & Responsiveness

## Status and Scope

Implemented for release `v2.0.30`, 2026-10-14, with publication explicitly authorized by the author. Fix existing lifecycle defects without adding chart types, services or dependencies. Preserve static navigation/editing defaults and manual composition. Restored the original gzip baseline of 129561 bytes and retained the 15% growth allowance.

## 30A — Atomic Updates

- Stage Profile style overrides, diagnostics, Spec and scene until validation and rendering succeed.
- Reject cross-family updates without affecting subsequent theme changes.
- Restore the previous mounted surface after scene or renderer publication failure; test related root and Board paths.
- Reject lifecycle calls after destroy before changing state.

## 30B — Renderer Lifecycle

- Honor explicit SVG/Canvas changes in Profile updates and make effective renderer state agree with exports.
- Re-evaluate Profile auto selection on updates, including threshold crossings and accessibility requests.
- Preserve root's creation-time auto policy on ordinary data updates; explicit renderer updates are host requests, not implicit navigation.
- Dispose replaced renderer resources only after successful publication; restore on failure.

## 30C — Measured Responsiveness

- Record browser create/update/resize/theme latency before and after the change.
- Replace repeated categorical position lookups with one per-scene index, preserving ordering and repeated-category behavior.
- Reuse Performance Lab and Profile Loading for measurement and lifecycle acceptance; no new gallery.
- Keep local smoke budgets and source footprint budgets unchanged.

## 30D — Acceptance and Guidance

- Cover consecutive success/failure/theme/renderer/data/resize/export/reload sequences in root, standard, project, diagram and Board.
- Verify mounted SVG/Canvas surface cleanup and failure recovery in Chrome.
- Synchronize bilingual runtime/profile guidance and effective renderer declarations.
- Run focused tests, Agent gates, browser acceptance, snippets, performance and footprint checks. Report measured results and remaining limits; release only with separate author authorization.

## Evidence — 2026-10-14

- Focused lifecycle regressions: 18/18 passed. Agent quality gate: 429/429 unit tests plus contracts, types, recipes, docs, installed package consumers and Profile isolation passed.
- Full Chrome regression: 42/42 passed. The final Profile controls and Board text-contrast adjustment were additionally rechecked in the mounted lifecycle scenario.
- Desktop and 390 px screenshots inspected: all four Profile cards ready, no horizontal page overflow, readable Board text after background switching. This is browser-viewport evidence, not physical-device certification.
- Node Line 50k create/update/resize timings changed from 1568/1552/1493 ms to 173/146/86 ms in the local smoke check; the 5000 ms budget was unchanged. These are headless lifecycle timings, not Canvas paint timings.
- Mounted Chrome Line 50k categorical lookup comparison, warmup plus three-run median, synchronous API durations:

| Operation | Before category indexing | After category indexing |
| --- | ---: | ---: |
| Create | 2229.3 ms | 307.0 ms |
| Update | 2281.6 ms | 218.0 ms |
| Resize | 2246.1 ms | 478.5 ms |
| Theme | 2124.6 ms | 496.6 ms |

Small-dataset results varied substantially, including higher 10k creation measurements in the post-change Chrome run. Do not infer universal speedups from these measurements. The demonstrated improvement is removal of the repeated linear categorical lookup; no points, labels or source records were sampled or dropped. Measurements exclude total frame-paint latency.

- Root gzip: 148913 bytes, within the restored original ceiling of 148996 bytes. Public root/Profile entries and performance budgets were not relaxed.
- `npm run docs:snippets` and `git diff --check`: passed. TypeScript exposes effective Profile renderer selection.

## Preview and Manual Acceptance

The canonical port remains 3000 when available. During this run, other projects occupied 3000/3001 and were left running; the iChart.js preview uses:

- `http://127.0.0.1:3010/playground/profile-loading.html`: select Canvas/SVG/auto, reject an invalid update, then switch Light/Dark. Inspect requested/effective renderer, unchanged rejection state and readable content.
- `http://127.0.0.1:3010/playground/performance-lab.html`: select Line and a data size, rerun measurement, inspect create/update/resize/theme/export durations.
- `http://127.0.0.1:3010/playground/project-gallery.html`: check existing chart families, with no new chart type.

Start the same preview from the repository root with `PORT=3010 npm run playground` when that port is free. Local preview services are not a new runtime service or package API.
