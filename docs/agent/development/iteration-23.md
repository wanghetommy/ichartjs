# Iteration 23 — Consumer Confidence and First-Run

Iteration 23 improves the path from installation to a trustworthy delivered artifact. It does not add chart types, a service runtime, a CLI, MCP, Python bindings, or default editing/navigation behavior.

## 23A — Public Entry Contract

- Document the root entry and the independent `standard`, `project`, `diagram`, and `board` entries as one selection matrix.
- State explicitly that a Profile does not require importing the root entry first.
- Keep the root entry as the complete cross-family Agent runtime and keep focused entries as smaller capability roots.
- Verify package exports, TypeScript declarations, profile boundaries, and documented import paths together.

## 23B — Consumer Fixtures

- Add a runnable Node ESM consumer covering the root, all four Profiles, SVG output, health state, and Board output.
- Add a browser consumer fixture using the public root import and an explicit accessibility description.
- Run the Node fixture both from the repository and from the installed `npm pack` tarball.
- Keep the browser fixture's import map explicitly marked as a repository preview mechanism; published applications resolve package imports through their bundler.

## 23C — Data and Diagnostic Boundary

- Verify that malformed `data.values` returns a targeted `INVALID_DATA` error and repair suggestion.
- Verify duplicate stable IDs remain visible through `DUPLICATE_RECORD_ID` data-quality diagnostics.
- Keep validation, planning, and rendering conservative: do not silently invent fields, convert business meaning, or repair ambiguous data.
- Preserve stable record lineage in Profile `getState()` and `explain()` just as in the root runtime.

## 23D — Output Reliability

- Run root/Profile consumer checks against SVG and health state.
- Run browser acceptance for the published browser fixture, Profile loading, exports, and existing Gallery behavior.
- Prefer semantic output and state assertions over brittle screenshots.
- Keep SVG/Canvas/Auto behavior and export errors explicit; do not substitute a different format silently.

## 23E — Agent First-Run Guidance

- Put entry selection, install, first render, validation, self-check, and output choice in the README and Quickstart path.
- Link the runnable consumer fixtures from the user-facing guides.
- Keep English technical identifiers canonical and mirror the entry-selection guidance in the Chinese guide.
- Keep the official Skill as orchestration guidance, not as a second runtime implementation.

## 23F — Release Gate

- Add `first-run:check` to the Agent quality gate.
- Ensure `consumer:check` installs the packed tarball and executes the packaged consumer fixture.
- Keep package exports, examples, types, manifests, docs, footprint data, and runtime version synchronized.
- Release only after the full Agent gate, browser matrix, package consumer check, and `git diff --check` pass.

## Acceptance

- `npm run first-run:check` passes the entry matrix, consumer fixture, malformed-data diagnostic, and duplicate-ID diagnostic.
- `npm run consumer:check` passes against the generated npm tarball.
- `npm test` passes, including Profile lineage coverage.
- `npm run test:browser` passes the browser consumer fixture and existing acceptance matrix.
- `npm run agent:check` includes the new first-run gate.
- No new chart type or service runtime is introduced.

## User-facing Verification

- Root and Profile browser fixture: `http://localhost:3000/examples/consumer-browser.html`
- Profile loading: `http://localhost:3000/playground/profile-loading.html`
- Full Gallery: `http://localhost:3000/playground/project-gallery.html`
- Playground Home: `http://localhost:3000/playground/index.html`
