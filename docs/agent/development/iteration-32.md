# Iteration 32 — Export Delivery Consistency

## Scope

Implemented 2026-10-16 for release v2.0.32. Strict delivery across entries; unchanged APIs/JSON defaults, static interactions, isolation and budgets. No PDF/GIF, dependency or Node service. Publication explicitly authorized by the author.

## 32A–32D

- 32A: shared type/as validation and encoding; retain JSON shapes.
- 32B: detached scene replay; preserve display/state; diagnose context/assets/origin errors.
- 32C: five-entry, two-renderer file/pixel checks, including DPR and recovery.
- 32D: discovery, types, bilingual guidance and existing host fixture; Node raster remains root-only.

## Acceptance

446 unit tests, 49 Chrome tests; installed tarball: 10 host + 20 delivery cases. Agent/docs/types/profiles/performance/footprint gates passed. Desktop/390px previews inspected.

## Preview

`http://127.0.0.1:3000/examples/consumer-browser.html?entry=standard&renderer=svg`: download PNG/JPEG without switching display. Choose other entries in the selector.
