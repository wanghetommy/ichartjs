# Iteration 10 — Export Contract Hardening

Iteration 10A hardens the v2.0 export contract without adding chart types or changing chart behavior. The work targets `v2.0.5`, stays on the `2.0.x` line, and keeps the existing dual-engine, single-Scene-Graph architecture.

## 10A — Export Contract Hardening

- Keep JSON, SVG, PNG, and JPEG export type detection deterministic.
- Return stable structured errors for unknown formats and unavailable headless raster paths.
- Support JSON `string`, `object`, `dataurl`, and `blob` representations.
- Provide an explicit `exportAsync()` path for optional Node `canvas` raster export.
- Prevent headless Canvas calls from throwing when no canvas surface is mounted.
- Keep Canvas and SVG fill, stroke, background, and transparent-paint semantics aligned.
- Resolve `theme.branding` into the normalized top-level branding contract.
- Fix playground port detection, path traversal checks, malformed URI handling, and escaped 404 paths.
- Add regression coverage for export representations, unsupported types, headless Canvas, and theme branding.

## Acceptance

- `npm run agent:check` passes.
- `npm run example:agent` passes.
- `git diff --check` passes.
- Browser preview remains available at `http://localhost:3000/playground/project-gallery.html` through `npm run playground`.
- No new public chart type or chart behavior is introduced by 10A.

## v2.0.5 Release Readiness

- Package, Runtime, Playground, documentation home, GitHub fallback instructions, Changelog, and Roadmap identify `2.0.5` consistently.
- `npm run agent:check` passes with 61 tests, 16 chart types, 24 edit commands, and 7 business schemas.
- `npm run example:agent` and `git diff --check` pass.
- `npm pack --dry-run` reports `@taylorwong/ichartjs@2.0.5`, 83 package entries, and includes the English/Chinese usage guides plus this Iteration 10 record.
- npm identity is `taylorwong`, Registry is `https://registry.npmjs.org/`, and the currently published package remains `2.0.4` before release.
- Author-only commit, tag, push, npm publish, and `develop` to `master` merge remain pending under `release-sop.md`.
