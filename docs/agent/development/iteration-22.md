# Iteration 22 — Agent Adoption and Production Benchmark

Iteration 22 turns the existing Agent contracts and Playground labs into a repeatable production-adoption gate. It does not add chart types, a CLI, MCP, HTTP, or a Python runtime.

## 22A — Real Agent Scenario Matrix

The executable matrix covers five representative outputs:

- Trend: intent planning, Line Spec validation, SVG/JSON export, lineage, and accessibility metadata.
- Composition: Pie planning with a negative value and a visible `NEGATIVE_VALUE_DROPPED` warning.
- Project schedule: Gantt rendering with health and artifact output.
- Workflow: Flow rendering with semantic nodes and edges.
- Freeform Board: Board validation, embedded chart output, SVG export, and lifecycle cleanup.

The matrix follows the public workflow:

```text
inspect data → plan → build Spec → validate → render → explain/getState → export → destroy
```

## 22B — Profile and Footprint Evidence

The four public profile entries are exercised independently:

- `standard`: analysis charts.
- `project`: schedule charts.
- `diagram`: Flow and structured diagrams.
- `board`: Freeform Board.

`npm run profiles:check` verifies dependency boundaries and SVG output. `npm run footprint:generate` refreshes the Playground's checked-in footprint report; `npm run footprint:check` measures the root graph, profile graphs, npm tarball, unpacked package, and packaged Agent resources against the maintained regression budget and rejects stale generated data.

## 22C — Repairable Diagnostics

The gate verifies that common Agent mistakes stop safely and provide repair information:

- Missing encoding fields return stable error codes, paths, and suggestions.
- Unknown natural-language intents expose fallback metadata and registered alternatives.
- Unsupported interactions are warnings rather than silent behavior changes.

No automatic repair is applied to business data or an invalid Spec.

## 22D — Accessibility and Locale Matrix

The same Line fixture is rendered for `en-US` and `zh-CN` under light, dark, and contrast themes. Every case must remain renderable, expose an accessible explanation, and preserve the requested resolved theme mode. Browser-level keyboard and semantic checks remain in `npm run test:browser` and `playground/accessibility-lab.html`.

## 22E — Documentation and Recipe Contract

The gate checks that README, Quickstart, and Skill guidance contain the public installation and validation workflow, and that the Recipe manifest remains populated. Existing `npm run docs:snippets`, `npm run docs:check`, and `npm run recipes:check` remain the source-of-truth checks for documentation and templates.

## Acceptance

- `npm run adoption:check` prints a machine-readable successful report.
- `npm run agent:check` includes adoption, task, consumer, footprint, and profile checks.
- `npm run footprint:generate` keeps `playground/footprint.json` synchronized after runtime, package, or documentation changes.
- `npm test` includes `tests/iteration-22.test.mjs`.
- `npm run test:browser` passes the maintained browser matrix.
- No new chart type or service runtime is introduced.

## User-facing Verification

- Agent workflow: `http://localhost:3000/playground/agent-workbench.html`
- Profile verification: `http://localhost:3000/playground/profile-loading.html`
- Accessibility: `http://localhost:3000/playground/accessibility-lab.html`
- Performance: `http://localhost:3000/playground/performance-lab.html`
- Full navigation: `http://localhost:3000/playground/index.html`
