# Iteration 26 — Agent Incremental Flow Building

## Scope

Status: 26A–26D implemented and accepted in the working tree on 2026-10-07, then included in the separately authorized `v2.0.27` release (2026-10-08). The iteration's implementation acceptance did not itself authorize publishing.

Complete the existing Flow's multi-turn Agent workflow: stable-ID structural commands, atomic layout preview/commit, readable automatic layout, history, and delivery. No new chart type, parser, LLM service, animation engine, collaboration layer, or automatic navigation.

## 26A — Incremental editing contract

- Add `addNode` with `node: { id, label, kind?, size?, position?, ports? }`, and `removeNode` with `nodeId` and optional `policy: reject | cascade`.
- Default removal rejects incident edges. Confirmed cascade removes only explicit incident edges, preserving unrelated nodes/edges; remaining parent/group/port references must validate.
- Use existing `updateField` / `updateRecord` for declared editable node/edge fields, rejecting unknown/read-only fields and unsupported model commands.
- Combine node and edge changes into one preview, audit, revision, and Undo/Redo entry. Validate the final graph; invalid transactions never publish partial state.
- Structural commands remain opt-in and require host-confirmed, current chart previews. No API enables interaction implicitly.

## 26B — Deterministic Flow reflow

- Reuse `diagram.layout: layered` and `routing: auto`; unpositioned nodes reflow after edits, explicit positions remain authoritative.
- Separate loop back-edges from forward layering. Account for actual node sizes, center columns/rows, and reduce gaps only within readable limits.
- Do not shrink nodes or change zoom/pan to disguise space shortage. Expose `FLOW_LAYOUT_OVERFLOW` and `FLOW_NODE_OVERLAP`; retain routing warnings for blocked/manual connectors.
- Preserve valid manual channels through endpoint changes. Do not erase saved waypoints during structural edits.
- Expose diagram-space layout snapshots through `preview.layout`, `getState().layout.diagram`, and `explain().layout.diagram`. Preview and commit must agree; empty graphs retain an inspectable layout.
- This is full deterministic recomputation, not minimum-displacement incremental layout or an optimal graph layout guarantee.

## 26C — Agent guidance and demo

- Publish the incremental contract via capability and chart-contract discovery; synchronize command manifest and TypeScript declarations.
- Add `agent-recipes/diagrams/incremental-flow.json` as a starting Spec and ordered templates; CI validates and executes its preview/commit workflow.
- Extend the existing Diagram Editor with explicit Start, editable command templates, a separate non-editable visual preview, and Confirm and apply. Existing history/save/reload/export remain reusable.
- Keep natural-language interpretation in the host Agent. Bilingual guides, runtime contract, conversational workflow, and Skill distinguish incremental edits from Spec replacement.
- Intermediate missing-end/decision-branch warnings are expected while building, but must be reported and resolved according to the requested final workflow.

## 26D — Acceptance

- Sequential construction, insertion, branching/merging, loops, rename, default/cascade deletion, and removing the last node.
- Duplicate IDs, malformed shapes/ports/sizes, missing references, read-only fields, disabled edits, missing confirmation, stale previews, and host cancellation remain atomic.
- Each turn preserves IDs and history; Undo/Redo, serialization, reload, repeated construction, and diagram-coordinate previews work in SVG/Canvas, including zoom/pan.
- Explicit nodes/manual edges remain unchanged when feasible; real blockers retain diagnostics. Large/variable-sized nodes and small containers report physical limits.
- Run `npm run agent:check`, the full browser suite, Skill validation, and `git diff --check`. Version remains unchanged; no release is authorized by this iteration.

## Preview

Acceptance evidence: 324 unit tests and 22 browser tests pass, including 28 Iteration 26 unit cases and SVG/Canvas multi-turn editor workflows. `npm run agent:check`, package/Profile/contract/recipe/doc/type gates, Skill validation, and whitespace checks pass. The npm resource baseline is refreshed for the added guides/recipe; browser-module raw/gzip baselines and the 15% allowance remain unchanged.

- SVG advanced acceptance: `http://localhost:3000/playground/diagram-editor.html?scenario=advanced`
- Canvas advanced acceptance: `http://localhost:3000/playground/diagram-editor.html?scenario=advanced&renderer=canvas`
- Explicitly Start the demo, then preview/apply each template. Verify Undo/Redo, save/reload, and SVG export from the existing toolbar.
- The bare page and `?scenario=incremental` now use a simpler four-step approval example with Next, Previous step and Restart. Developer tools retain the full workflow above.
