# Iteration 25 — Diagram Editing Usability Closure

Release: `v2.0.27` (2026-10-08).

This iteration completes the existing Diagram editing workflow. It adds no chart type, service, automatic persistence layer, or default interaction.

## 25A — Predictable manual routing

- Dragging an orthogonal corner couples adjacent bends and keeps endpoint coordinates fixed. Segment dragging and grid snapping operate in diagram coordinates, including after zoom and pan.
- Manual routes for `auto` and `orthogonal` path shapes must remain orthogonal. Explicit non-orthogonal path shapes retain their intent.
- Validate connection directions, visible node-shape obstacles, and source/destination interiors.
- Reject invalid pointer edits and Chart `previewEdit()` / `applyEdit()` route commands with `EDGE_MANUAL_ROUTE_INVALID`. The previously committed Spec, route, revision, and undo history remain unchanged.
- Report the reason: `ORTHOGONAL_REQUIRED`, `PORT_DIRECTION`, `NODE_INTERSECTION`, `SELF_INTERSECTION`, or `EMPTY_WAYPOINTS`.
- Reject retraced or self-crossing paths. Automatic bent routes leave sufficient straight segments at both ports, including when source and target edges align or nearly align.
- Render connector bodies to the arrowhead base center while keeping the logical endpoint at the target port. Trim cubic curves without changing their remaining shape; scale arrowheads for short explicit segments. Shared SVG, Canvas, Gantt, export, and embedded-board rendering use the same geometry.
- Imported or previously valid routes can become invalid after layout changes. Render a safe automatic fallback with a warning rather than silently changing the route. This read/render fallback is not permission to commit an invalid manual edit.
- Expose requested/effective routing modes and visibility through `getState().edgeRoutes` and `explain().edgeRoutes`. Hidden internal group edges are not editable until expanded.

## 25B — Recovery and feedback

- Add Restore automatic routing to the existing Diagram Editor using `updateEdge`, not a new public API.
- Keep the button disabled without a selected edge or when editing is disabled.
- Show requested/effective modes, live rejection reasons, committed edits, and Undo/Redo results.
- Returning to automatic routing keeps saved waypoints inactive, allowing Undo to restore the exact manual route.
- Keep SVG and Canvas behavior equivalent.
- Expanded group frames include internal connector geometry, arrowheads, and labels, not only member nodes. Cross-group connectors do not enlarge frames; collapse uses node-based bounds and group-level external anchors.

## 25C — Save and deliver

- Save the plain Chart Spec as JSON and populate an editable text area.
- Reload either a plain Flow Spec or an existing JSON export envelope via `payload.spec`. Rebind the host container and renderer; do not restore edit history from exported runtime state.
- Invalid JSON or an invalid Spec must leave the current chart usable.
- Export SVG without selection handles, ports, or selection-only styling, while preserving node positions, route geometry, view, and line styles. Export must not mutate the interactive chart or its history.
- Keep storage outside the library: file download and paste/reload demonstrate the existing host-owned persistence contract.

## Follow-up — Connected port alignment

- Grid snapping uses node origins, so unequal node sizes can make port alignment impossible on the grid. While dragging, facing connected ports of automatic orthogonal edges take priority within 6 CSS screen pixels; the other axis remains grid-snapped.
- Show temporary alignment guides; remove them on release or cancellation. Preserve the aligned positions through commit, Undo/Redo, and Spec reload, even when the origin is off-grid.
- Alt or `diagram.snap: false` disables snapping. Multi-selection keeps relative positions; internal edges, curved edges, and manual routes do not attract the selection. Obstacle routing and explicit port sides remain unchanged.
- Add separate X-center (vertical column) and Y-center (horizontal row) toolbar actions using existing alignment commands.

## Follow-up — Manual channels follow endpoint edits

- Moving or resizing an endpoint through pointer, keyboard, or Chart edit transactions adjusts only the endpoint connection and adjacent coupled bends, preserving the manually positioned middle channel. Do not reinterpret endpoint movement as an invalid diagonal and reset to automatic routing.
- Translating both endpoints together translates the entire saved route. Unrelated node movement leaves a still-valid manual route unchanged.
- Include generated waypoint updates in the same command preview, audit, history, and serialized Spec as the node edit. Pointer preview and release must match; cancellation must leave the committed Spec unchanged.
- Preserve manual import validation and explicit invalid-route rejection. Do not persist endpoint repairs that cross real obstacles, self-intersect, or violate port directions; keep diagnostic fallback for unsatisfiable layouts. Raw `chart.update()` remains Spec replacement, not an edit transaction.
- Cover Flow, Architecture, Mindmap, and Swimlane in SVG and Canvas, including zoom/pan, repeated endpoint edits, node resizing, group translation, Undo/Redo, and reload. Reproduce dragging Verify downward before moving QA in the real Diagram Editor.

## Acceptance

- Routing/readability follow-up: prefer obstacle-free endpoint-local channels before considering obstacle-derived channels; moving a distant Done must not change Review → QA route or label during preview, commit, Undo, or reload. Still reroute around real blockers of every supported shape. Fit edge labels against available horizontal space, prefer one line, and wrap English only between words; retain truncation diagnostics when space is truly insufficient.

- Unit coverage: constrained corner dragging, repeated drags after zoom/pan, obstacle/endpoint rejection, cancellation, atomic Agent preview/commit rejection, imported fallback diagnostics, auto-route Undo/Redo, Spec roundtrip, and clean SVG export.
- Browser coverage: perform the actual edit → reject invalid drag → restore auto → undo → save → reload → export workflow in both SVG and Canvas; malformed reload leaves the chart intact.
- Run `npm test`, `npm run agent:check`, and `npm run test:browser`, plus `git diff --check`.

## Preview

- SVG: `http://localhost:3000/playground/diagram-editor.html?scenario=editor`
- Canvas: `http://localhost:3000/playground/diagram-editor.html?scenario=editor&renderer=canvas`
- Existing chart regressions: `http://localhost:3000/playground/project-gallery.html`
