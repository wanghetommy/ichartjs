# Iteration 21 — Agent Task Success and Delivery Evidence

Iteration 21 improves the evidence that an Agent can create, change, verify, and deliver a visualization. It does not add chart types, natural-language parsing, a CLI, MCP, HTTP, or a Python runtime.

## 21A — Executable Agent Task Fixtures

- Cover trend, part-to-whole, timeline, diagram editing, and Freeform Board tasks with structured fixtures.
- Require each task to preserve stable record IDs, expose assumptions and warnings, and finish with a verifiable artifact or checkpoint.
- Keep host-language interpretation outside the runtime; CI validates the structured result after the Agent has mapped the request.

## 21B — Contract and Repair Examples

- Publish minimal valid Specs beside representative invalid inputs and repair diagnostics.
- Make the task runner stop before rendering when planning or validation is not safe.
- Keep chart contracts, TypeScript declarations, recipes, and examples generated from the same runtime contract.

## 21C — Browser Evidence Matrix

- Add browser checks for SVG and Canvas mounting, export, responsive re-rendering, long labels, themes, and historical layout risks.
- Keep semantic assertions separate from screenshots; screenshots are evidence for layout changes, not the source of truth for data semantics.
- Cover a representative matrix instead of every chart × renderer × viewport combination.

## 21D — Consumer Package Verification

- Pack the repository, install the tarball in a temporary consumer project, and verify ESM, TypeScript, headless SVG/JSON, recipes, and capability discovery.
- Verify the published package boundary rather than only importing source files from the repository.

## 21E — Runtime Footprint Baseline

- Measure the local ESM module graph, source/gzip footprint, npm tarball, and unpacked package size.
- Fail CI only on a measured regression budget; profile entries now provide measured capability boundaries while the root entry remains complete.
- Keep the full root entry for Agent and Node users that need cross-family discovery. Focused browser applications should import the matching profile entry.

## Acceptance

```text
inspect data → plan → build Spec → validate → render → explain/getState
→ verify artifact → destroy
```

- `npm run agent:check`, `npm run tasks:check`, `npm run consumer:check`, `npm run footprint:check`, and browser acceptance pass.
- `npm run profiles:check` passes for all four public capability entries.
- Task fixtures report deterministic warnings, health, lineage, and output kinds.
- A temporary project can consume the npm tarball without reaching into repository source paths.
- The footprint report makes the absence or presence of effective profile-level tree-shaking explicit.

## 21F — Profile Entry Points

The package now exposes four additive capability entries without changing the complete root entry:

```js
import { createChart } from '@taylorwong/ichartjs/standard';
import { createChart } from '@taylorwong/ichartjs/project';
import { createChart } from '@taylorwong/ichartjs/diagram';
import { createBoard } from '@taylorwong/ichartjs/board';
```

`standard` covers analysis charts, `project` covers Gantt/timeline/milestone/burndown, `diagram` covers Flow/Swimlane/Architecture/Mindmap, and `board` covers Freeform Board. The root entry remains the compatibility entry for the complete API.

## 21G — Internal Module Boundaries

- Standard charts use `src/profile-standard.mjs` and do not import the complete chart dispatcher, project renderer, or board runtime.
- Project and diagram entries share the project scene builder but do not import the complete root runtime.
- Board embeds standard chart scenes through an injected builder; the board profile does not import `src/charts.mjs`.
- Profile charts expose the common Agent contract: `createChart`, `getState`, `explain`, `export`, and `destroy`.

## 21H — Real Profile Verification

`npm run profiles:check` imports every public profile, renders a representative SVG, checks health, and walks each local ESM graph to reject forbidden cross-profile imports. This is a dependency-boundary check, not a claim that every profile has identical byte size; future bundler builds can use these entries as stable roots.
