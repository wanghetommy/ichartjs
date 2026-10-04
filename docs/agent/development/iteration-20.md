# Iteration 20 — Agent Ecosystem and Quality Scale

Iteration 20 follows the completed Production Trust work in Iteration 17. It does not repeat unknown-option diagnostics, basic self-checks, package gates, or static-safe defaults. It improves repeated Agent use across all existing chart types without adding a chart type, a CLI, MCP, HTTP service, or Python runtime.

## 20A — Per-chart Contract Completion

- Add `getChartContract(type)` as the canonical Agent-facing contract for each public chart type.
- Derive required roles, optional fields, channel semantics, feature applicability, renderers, exports, limits, and safe defaults from the contract registry.
- Expose the same contracts from `getCapabilities().chartContracts`, generated manifests, TypeScript declarations, and runtime documentation.
- Keep Recipes as starting templates; Agents still inject real data and call `validateSpec()`.

## 20B — Universal Data Quality

- Extend `inspectData()` with a machine-readable `quality` summary.
- Diagnose duplicate stable record IDs and mixed inferred measure units before chart planning.
- Preserve source data, stable diagnostic codes, JSON paths, suggestions, and the distinction between warnings and validation errors.
- Carry quality findings through `planChart()` and `chart.explain()`.

## 20C — Visual and Renderer Matrix

- Maintain a headless contract test for all 18 public chart types and both SVG/Canvas renderers.
- Keep browser screenshot acceptance for layout-sensitive labels, axes, diagrams, themes, and exports.
- Record visual regressions separately from semantic contract failures; do not replace semantic tests with screenshots.

## 20D — Data Scale and Performance Policy

- Benchmark representative 1k, 10k, and 50k datasets for Line, Area, Scatter, and Heatmap.
- Expose deterministic Renderer selection and record-count reasons through the existing `rendererSelection` contract.
- Add sampling or decimation only after measured bottlenecks justify a narrow API; streaming remains out of scope.

## 20E — Agent Integration Recipes

- Document the same workflow for browser, Node/headless, TypeScript, and Skill users.
- Provide a troubleshooting table mapping common symptoms to diagnostic codes and repair actions.
- Specify output choice explicitly: mounted chart, Spec, SVG, PNG/JPEG, or JSON checkpoint.

## Acceptance

```text
getCapabilities → inspectData → planChart → getChartContract → validateSpec
→ createChart → explain/getState → export or mount
```

- All public chart types expose a complete contract and TypeScript declaration.
- Data quality summaries remain deterministic and are visible to Agents before rendering.
- Existing Iteration 17 reliability gates remain green; no duplicate reliability layer is introduced.
- `npm run agent:check`, browser acceptance, package checks, and `git diff --check` pass.

## Current Delivery

20A–20E are implemented for the current release line: the runtime exposes generated per-chart contracts and data quality, the headless matrix covers all public types and renderers, `npm run performance:check` provides repeatable local scale smoke checks, and the Agent guides include output selection and diagnostic repair paths. Browser screenshots and physical-device measurements remain environment evidence rather than runtime guarantees; no chart behavior or public chart type was added.
