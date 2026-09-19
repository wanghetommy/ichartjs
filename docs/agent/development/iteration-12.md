# Iteration 12 — Structured Diagrams: Architecture and Mindmap

Release status: Iteration 12A–12G is included in `v2.0.7`.

Iteration 12 extends the existing Flow/Swimlane diagram runtime with two structured-diagram modes. Architecture diagrams and mindmaps share the same JSON-safe nodes, edges, layout, interaction, export, and Agent contracts; they are not separate renderer implementations.

## 12A — Shared Structured Diagram Model

- Reuse stable node IDs, edges, groups, ports, positions, sizes, routing, selection, keyboard navigation, history, Canvas/SVG rendering, and JSON/SVG/PNG export.
- Normalize `diagram.mode` as `process`, `architecture`, or `mindmap`.
- Derive mindmap parent-child edges from `node.parentId` while preserving explicit edges.
- Validate missing parents, self-parenting, duplicate IDs, layer references, and mindmap cycles.
- Keep `validateDiagram()` as the Agent-facing validation entry point.

## 12B — Architecture Diagram Mode

- Add `type: 'architecture'` for business, data, and technical architecture views.
- Support `layers` for stable vertical or horizontal architectural strata.
- Support `boundaries` with `nodeIds`, labels, padding, and color for bounded contexts, domains, systems, or platform boundaries.
- Keep regular edges for dependencies, realizes, persists, publishes, and other declared relationships; the runtime does not infer business semantics.
- Preserve manual positions when supplied and use deterministic layered placement otherwise.

## 12C — Mindmap Mode

- Add `type: 'mindmap'` with `parentId` as the compact Agent-friendly hierarchy contract.
- Support deterministic `tree` and `radial` layouts through the existing diagram layout modes.
- Render root and branch emphasis without introducing a new renderer or a separate editing model.
- Keep explicit IDs and parent references so Agents can update one branch without replacing the whole mindmap.

## 12D — Agent Contract and Schemas

- Expose `architecture` and `mindmap` in `getCapabilities()`, `planChart()`, chart profiles, TypeScript declarations, and manifests.
- Add `architecture-node`, `architecture-edge`, and `mindmap-node` business schemas.
- Return assumptions and structured validation diagnostics instead of silently guessing layer, boundary, or parent semantics.
- Keep architecture and mindmap in the `diagram` family and recommend them only for `architecture`, `hierarchy`, `brainstorm`, and related intents.

## 12E — Playground and Documentation

- Add Architecture and Mindmap examples to `playground/project-gallery.html`.
- Document the distinction: architecture is a domain/system structure; a mindmap is a hierarchy of ideas. Both are structured diagrams, but a mindmap is not an architecture diagram by default.
- Use `npm run playground` and preview `http://localhost:3000/playground/project-gallery.html`, then search `Architecture` or `Mindmap`.

## 12F — Renderer-Parity Edge Editing

Direct edge editing must remain a renderer-independent Diagram capability. SVG may be used to validate the interaction first, but Canvas and SVG must expose the same public operations, editing semantics, persisted data, keyboard behavior, and final acceptance status. The feature is not complete while either renderer is read-only or has reduced editing behavior.

The default runtime state must be static and safe, with no unexpected viewport or structural changes. Zoom, pan, brush selection, node dragging, edge dragging, port connection, and structural commands are disabled by default and must be explicitly enabled by the host. Agent-driven edits continue to use the validated preview/commit contract and do not implicitly enable pointer editing in the UI.

### Phase 1 — Edge Hit Testing and Selection

- Add geometry-aware edge hit testing with a forgiving interaction tolerance instead of relying on rectangular scene bounds.
- Make diagram edges selectable in Flow, Swimlane, Architecture, and Mindmap without changing chart-series line behavior.
- Support selected, hover, focus, delete, Escape, and keyboard traversal states consistently in Canvas and SVG.
- Keep hit testing in the shared Scene Graph; SVG transparent strokes may optimize DOM interaction but must not become the source of truth.
- Expose explicit edge-selection and edge-editing support through `getCapabilities()`.
- Keep navigation and editing disabled in default chart specs; Gallery and read-only embeds must not enable them implicitly.

### Phase 2 — Waypoint and Segment Handles

- Show bend-point and segment-midpoint handles only after an edge is selected in editing mode.
- Dragging a bend point updates one waypoint; dragging an orthogonal segment midpoint moves only that horizontal or vertical segment.
- Use enlarged invisible hit regions and minimum target sizes so thin lines remain usable without visually thickening them.
- Reuse preview, confirmation, commit, undo, redo, and audit behavior from the shared edit controller.
- Validate the interaction in SVG first if useful, but do not publish renderer-specific public behavior.

### Phase 3 — Persistent Manual Routing

- Add JSON-safe `waypoints` to the edge contract and preserve stable edge IDs.
- Apply the same waypoint model to Canvas rendering, SVG rendering, JSON export, SVG/PNG export, copy/paste, duplicate, and Agent edits.
- Define routing precedence as explicit waypoints first, automatic obstacle-aware routing otherwise.
- When connected nodes move, preserve valid manual segments, repair invalid endpoint segments, and fall back to deterministic automatic routing when the manual path becomes unusable.
- Support Agent updates through validated `updateEdge` operations rather than renderer-specific commands.

### 12F Acceptance

- Canvas and SVG pass the same edge hit-testing, selection, handle dragging, persistence, undo/redo, keyboard, and export tests.
- Flow, Swimlane, Architecture, and Mindmap use the same edge-editing contract and interaction implementation.
- Thin edges remain easy to select without changing their visible stroke width.
- Manual waypoints survive rerender, renderer switching, serialization, export, and chart recreation.
- Node movement never leaves an edge passing through a node; invalid manual routes are repaired or deterministically rerouted.
- Until all parity criteria pass, capabilities report segment dragging as unavailable rather than advertising SVG-only support.
- Default charts remain static: zoom, pan, brush, node drag, edge drag, port connection, and structural editing only activate through explicit host configuration.

## 12G — Mindmap Curved Edges

- Mindmap parent-child edges default to `routing: 'curved'`; Flow, Swimlane, and Architecture keep orthogonal defaults.
- `curved` renders one cubic Bezier segment in both Canvas and SVG instead of a four-point polyline.
- `diagram.curveTension` and per-edge `curveTension` accept values from `0.2` to `0.8`, with `0.4` as the default.
- Labels use the Bezier midpoint and arrowheads use the end tangent. Shared Scene Graph hit testing samples the curve so Canvas and SVG selection remain equivalent.
- Curves that intersect another node fall back deterministically to obstacle-aware orthogonal routing.
- Explicit `waypoints` retain precedence and render as manual polylines. Bezier control-point editing is intentionally excluded; moving nodes recalculates the curve.

## Acceptance

- `npm run agent:check` passes with 18 public chart types and 10 business schemas.
- Architecture validates and renders layers, boundaries, nodes, and dependency edges in both SVG and Canvas.
- Mindmap validates parent references and cycles, derives stable parent-child edges, and renders tree and radial layouts deterministically.
- Existing Flow and Swimlane tests and previews remain unchanged and pass.
- Existing export, accessibility, selection, keyboard, and preference behavior remains available through the shared diagram runtime.
- Iteration 12F is accepted only when Canvas and SVG expose equivalent edge-editing behavior.
- Iteration 12G is accepted only when Canvas, browser SVG, and headless SVG all emit true cubic Bezier paths and preserve static-by-default interaction behavior.
