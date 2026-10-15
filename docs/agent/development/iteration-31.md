# Iteration 31 — Host Integration & Lean Runtime

## Status and Scope

Implemented for release `2.0.31`, 2026-10-15, with author authorization. Published `2.0.30` is the measurement baseline. Public APIs, static defaults and budgets are preserved; no new chart type, service, framework adapter or runtime dependency.

## 31A — Host Lifecycle

- Reproduce asynchronous data updates, parent-container resizing, hidden/revealed hosts, unmount/remount and rendering failures.
- Cover root and independent standard/project/diagram/board entries with SVG and Canvas.

## 31B — Visible Responsiveness

- Reuse Performance Lab for multi-chart updates and theme changes.
- Verify SVG/PNG output after updates and repeated lifecycle transitions without manually clearing evidence of leftover surfaces.

## 31C — Measured Lean Runtime

- Build the installed package through a pinned production bundler, recording minified JS, gzip and included runtime modules for each public factory entry.
- Compare published baseline and current tarball with identical settings, without confusing source-graph gzip estimates with deployment artifacts.
- Keep the measurement tool outside runtime dependencies and avoid adding a mandatory network-dependent CI gate.

## 31D — Integration Guidance and Acceptance

- Extend the existing browser consumer and Profile Loading surfaces instead of introducing a new gallery.
- Synchronize English and Chinese lifecycle/loading guidance for entry choice, measurable dimensions, late data, failure recovery and destruction.

Follow the existing [Development Guide](../development-guide.md) for quality gates; evidence and limits are recorded below.

## Confirmed Defects and Fixes

Runtime-owned surfaces survived destruction, missing selectors silently produced unmounted charts, Element bindings were JSON-cloned, and failed first rendering left mounted content. Shared ownership and host-only bindings now address these causes. Root constructor plugins use live callbacks; queued resize work ignores destruction. Canvas Board moves remove old owned content. Shared SVG serialization no longer duplicates decorative attributes. Dense Cartesian ticks retain endpoints without crowding the final tick.

## Acceptance Evidence

- Focused Iterations 30/31: 26/26. Agent gate: 437/437 tests; contracts, types, consumers and unchanged footprint budgets passed.
- Release-candidate Chrome suite: 46/46, including the final narrow-host/tick adjustment.
- Installed local npm tarball: ten SVG/Canvas host scenarios across five public entries passed, including recovery, late data, resize, hidden/reveal, caller surfaces, moved Board mounts, SVG XML and supported PNG dimensions. SVG Profiles/Board retain their raster diagnostics.
- Nine Node documentation scenarios and nineteen tracked blocks; six mounted scenarios include the actual bilingual frontend snippets.
- Desktop/390 px images inspected. The Flow host explicitly scrolls 560 px content; all nodes are accessible without changing chart zoom/pan. This is not physical-device certification.

## Production Bundles

Pinned esbuild 0.28.2, browser ESM/ES2022, factory-only exports, minify, level-9 gzip; Node canvas is external. Byte counts compare registry 2.0.30 with the local candidate, not a complete application:

| Entry | Baseline gzip | Candidate gzip | Candidate minified JS |
| --- | ---: | ---: | ---: |
| root | 97926 | 97933 | 316197 |
| standard | 41482 | 41611 | 131690 |
| project | 48646 | 48748 | 149826 |
| diagram | 48643 | 48745 | 149824 |
| board | 50463 | 50570 | 159721 |

The changes do not establish a significant bundle reduction. Reused container resolution/Blob decoding and removed redundant paint/resize work; no speculative splitting or weakened validation. Root source gzip is 148961 bytes, below the unchanged 148996 ceiling. API durations and double-frame presentation opportunities are separate measurements, not exact GPU paint/FPS. Zero DOM residue does not prove zero heap retention.

## Preview

- `http://127.0.0.1:3010/playground/profile-loading.html`: measured production bundles and the existing host-fixture link.
- `http://127.0.0.1:3010/examples/consumer-browser.html?entry=standard`: race responses, resize, hide/reveal, remount and export; select Canvas for Profile/Board PNG.
- `http://127.0.0.1:3010/playground/performance-lab.html`: dashboard, API/frame-opportunity timings and 25 destroy cycles without surface clearing.

The preview reuses the existing 3010 server; port 3000 remains canonical when available.
