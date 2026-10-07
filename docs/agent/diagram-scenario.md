# Scenario: Interactive Diagrams

Agent usage and development guide for process modeling, responsibility mapping, and editable diagrams.

## Supported Types

- `flow`: a process graph made of nodes and edges.
- `swimlane`: a process graph organized by responsibility lanes.
- `architecture`: a layered business, data, or technical architecture graph with optional boundaries.
- `mindmap`: a parent-child hierarchy of ideas rendered as a tree or radial diagram.

Architecture and mindmap are both structured diagrams, but they are not interchangeable: architecture describes declared domain or system relationships, while a mindmap describes an idea hierarchy.

Architecture layers are horizontal bands ordered from top to bottom. Automatic layout places nodes in the same layer left to right on a shared row, then adds another row only when the available width cannot hold the layer. An explicit `node.position` remains authoritative, including after editing; automatic layout never rewrites the Spec.

## Data Model

```js
{
  type: 'architecture',
  layers: [{ id: 'business', label: 'Business' }, { id: 'technology', label: 'Technology' }],
  boundaries: [{ id: 'platform', label: 'Platform', nodeIds: ['api'] }],
  nodes: [{
    id: 'api', label: 'Order API', layerId: 'technology', position: { x: 240, y: 100 }
  }],
  edges: [{ id: 'orders-api', from: 'orders', to: 'api', relation: 'realizes', waypoints: [{ x: 220, y: 80 }, { x: 220, y: 160 }] }]
}
```

`from` and `to` are the only edge endpoint fields. `source` and `target` are not aliases and return a structured validation error. Display text uses `label` for nodes, lanes, layers, groups, and boundaries; using `name` is diagnosed rather than silently treated as display text.

For a mindmap, prefer the compact parent contract:

```js
{
  type: 'mindmap',
  nodes: [
    { id: 'root', label: 'Release plan' },
    { id: 'scope', label: 'Scope', parentId: 'root' },
    { id: 'risk', label: 'Risks', parentId: 'root' }
  ],
  diagram: { mode: 'mindmap', layout: 'tree', routing: 'curved', curveTension: 0.4 }
}
```

### Lightweight Flow Semantics

`flow` supports a small, unambiguous set of semantic node kinds. Nodes without `kind` use `process` as a convenience default; non-process semantics should be explicit.

```js
{
  type: 'flow',
  nodes: [
    { id: 'start', kind: 'start', label: 'Start' },
    { id: 'load', kind: 'process', label: 'Load data' },
    { id: 'valid', kind: 'decision', label: 'Valid?' },
    { id: 'output', kind: 'io', label: 'Output result' },
    { id: 'loop', kind: 'connector', label: 'retry' },
    { id: 'end', kind: 'end', label: 'End' }
  ],
  edges: [
    { id: 'start-load', from: 'start', to: 'load' },
    { id: 'load-valid', from: 'load', to: 'valid' },
    { id: 'valid-yes', from: 'valid', to: 'output', label: 'yes' },
    { id: 'valid-no', from: 'valid', to: 'loop', label: 'no' },
    { id: 'loop-load', from: 'loop', to: 'load' },
    { id: 'output-end', from: 'output', to: 'end' }
  ]
}
```

Supported kinds are `start`, `end`, `process`, `decision`, `io`, and `connector`. A decision should have at least two outgoing labeled edges. Loops are ordinary explicit `from`/`to` edges and are allowed. Connectors are circular hand-off points; they do not use implicit matching, so every connection remains visible in `edges`.

Flow `start` and `end` nodes render as true ellipse shapes; `process` nodes are rectangles, `decision` nodes are diamonds, and `io` nodes are parallelograms.

Node labels are centered on the node and use adaptive fitting: they wrap to at most two lines, reduce to a bounded minimum font size, and truncate only as a last resort. Compact nodes such as small connectors suppress their internal label rather than rendering unreadable text; the full label remains in the node data and accessibility surface. Edge labels stay inline when space permits, use a high-opacity background plate when the line would reduce contrast, and move aside only when they collide with nodes or other labels. `getState().layout.labels` and `explain().warnings` expose any wrapping, scaling, truncation, or suppression.

## Current Capabilities

Supported:

- Nodes, edges, lanes, groups, and ports.
- Flow semantic shapes: start/end, process, decision, input/output, and connector.
- `manual`, `layered`, `tree`, and `radial` layouts.
- Architecture layers and boundaries, plus mindmap parent-child derivation.
- `auto`, `straight`, `orthogonal`, and true cubic-Bezier `curved` routing. Automatic and fallback routes avoid all visible node shapes, not only rectangles.
- `routingMode: 'auto' | 'manual'`, persistent `waypoints`, and `lineStyle: 'solid' | 'dashed' | 'dotted'` for explicit edge control.
- Node dragging, multi-selection, alignment, and grid snapping.
- Automatic orthogonal routing first tries channels determined by the two endpoint nodes and checks them against every obstacle. Obstacle-derived channels are only added when these local routes are blocked, so moving a distant node does not introduce a competing shortcut. A node that actually blocks the route must still trigger rerouting. Connector labels use available horizontal space between nodes, other labels, and the viewport—not the length of a vertical or short segment. They prefer a single line, then a smaller readable font, then word-boundary wrapping for English; an oversized word is truncated with `LABEL_TRUNCATED` rather than split across lines. Chinese text can wrap between characters. These rules apply to Flow, Architecture, Mindmap, and Swimlane, in SVG and Canvas.
- With `diagram.snap` enabled, dragging first aligns facing ports of connected automatic orthogonal edges within 6 CSS screen pixels, then applies grid snapping on the other axis. Zoom and CSS resizing preserve this screen-space tolerance. Temporary guides disappear on release or cancellation. Hold Alt, or set `diagram.snap: false`, to bypass both kinds of snapping. Multi-selection moves together; internal edges, manual routes, and curved edges do not attract the selection. Alignment does not bypass obstacle avoidance or change port sides/offsets. `alignSelected('middle')` aligns node Y centers into a horizontal row; `'center'` aligns X centers into a vertical column, not arbitrary offset ports.
- Keyboard movement, copy/paste, duplicate, group collapse/expand, undo/redo, and a shared Canvas/SVG Scene.
- Port-aware drag-to-connect interaction and typed edge creation.
- Geometry-aware edge selection, waypoint handles, orthogonal segment handles, persistent manual routing, and edge deletion.
- Group collapse/expand with collapsed group summary rendering.

Navigation and editing are opt-in. The default chart is static: zoom, pan, brush, node drag, edge drag, port connection, and structural editing are disabled until the host enables them.

```js
interaction: { zoom: true, pan: true, drag: true, edgeDrag: true, portConnect: true },
editing: { enabled: true, allowDelete: true, allowStructuralChanges: true }
```

Canvas and SVG use the same Scene Graph hit testing, `waypoints` contract, commands, history, and interaction behavior.

Dragging a waypoint or segment handle automatically sets `routingMode: 'manual'` and saves diagram-space `waypoints`, so rerendering, zoom/pan, and subsequent drags retain the edited path. Undo/Redo restores both the route mode and the points. Set `routingMode: 'auto'` through `updateEdge` to resume automatic routing; saved waypoints are then ignored. If `routingMode` is omitted, existing waypoints imply a manual route.

Moving or resizing an endpoint node through pointer, keyboard, or Chart edit APIs reconnects a valid manual orthogonal route at that endpoint while preserving its edited middle channel. Moving both endpoints together translates the entire route. Node positions and adjusted waypoints share one preview, commit, and Undo/Redo entry, and survive Spec save/reload. An unrelated node move does not change a still-clear manual route. This applies to editing transactions, not raw Spec replacement with `chart.update()`. A repair that would violate port directions, intersect a node, or self-intersect is not saved; the renderer can fall back with a diagnostic as described below.

Orthogonal corner dragging couples adjacent bends instead of introducing diagonals. For `routing: 'auto' | 'orthogonal'`, invalid manual geometry is rejected by pointer editing and Chart `previewEdit()` / `applyEdit()` with `EDGE_MANUAL_ROUTE_INVALID`; the committed Spec and history are unchanged. Reasons include `ORTHOGONAL_REQUIRED`, `PORT_DIRECTION`, `NODE_INTERSECTION`, `SELF_INTERSECTION`, and `EMPTY_WAYPOINTS`. Retracing or crossing the same connector is invalid. The standalone schema/command validators do not perform rendered-layout validation: use the Chart edit APIs when proposing waypoint changes. An imported route, or one invalidated by node movement, can display an automatic fallback with the same diagnostic. Inspect `chart.getState().edgeRoutes` or `chart.explain().edgeRoutes` for `requestedRoutingMode`, `effectiveRoutingMode`, `visible`, and `reason`; a requested manual mode does not prove that its geometry was rendered.

The [Diagram Editor](../../playground/diagram-editor.html) demonstrates Restore automatic routing, Save Spec JSON, Reload Spec, and Export SVG for both renderers. Save `chart.getSpec()` (rebind/remove `container` in the receiving host), or load `JSON.parse(chart.export({ type: 'json' })).spec`. Runtime history is not persistent. SVG export excludes editing handles, ports, and selection-only styling without mutating the chart. File/storage ownership remains with the host, not the library.

Mindmap defaults to curved parent-child edges. Set `diagram.curveTension` from `0.2` to `0.8`, use `routing: 'auto'` for orthogonal-first obstacle-aware routing, override `routing` or `curveTension` on one explicit edge, or set `routingMode: 'manual'` with `waypoints` for a persistent manual polyline. Bezier control points are not directly editable. Manual edits that cross a visible node shape are rejected; imported or layout-invalidated routes fall back automatically with an explicit warning.

Automatic routes use a direct segment only when connection points are horizontally or vertically aligned, ports face outward, and the segment is clear. Other automatic connections use orthogonal segments with a penalty for unnecessary bends. Backward routes also avoid the source and destination interiors. If no safe orthogonal route exists, the connector is omitted with `EDGE_ROUTE_BLOCKED` in `getState().warnings` and `explain().warnings`; adjust the node positions or ports. Valid manual routes obey their requested path shape: `auto`/`orthogonal` require orthogonal segments; explicit `straight`/`curved` requests are not converted solely to eliminate diagonals.

Automatic bent routes keep sufficient straight clearance at both ports and reject retraced or self-crossing candidates, including when node edges nearly align. Connector bodies render to the arrowhead base center, while logical endpoints remain attached to target ports. Curves retain their shape when trimmed; short explicit segments scale their arrowheads to fit. This rendering-only distinction does not modify saved waypoints or edit handles.

Current limitations:

- Groups are flat; nested groups are not supported.
- Expanded group bounds include member nodes, internal connector paths, arrowheads, and connector labels, plus configurable `group.padding`. Cross-group connectors do not enlarge the frame. Collapsed groups retain node-based bounds and external connectors attach to the group boundary. `resizeGroup` scales member positions and sizes rather than persisting a second group rectangle.
- `deleteGroup` defaults to `ungroup`; use `delete-members` only after explicit host confirmation.
- Canvas keeps basic accessibility text, while SVG exposes richer diagram semantics.
- Cross-browser matrix and physical-device validation remain acceptance work, not runtime guarantees.
- Mixed manual and automatic Architecture positions can overlap; explicit positions are preserved rather than silently moved.

## Agent Workflow

### Incremental Flow building

This is the Flow specialization of [Agent-driven Incremental Construction](conversational-workflow.md#agent-driven-incremental-construction). Read that guide for host prerequisites, complete semantic turns, confirmation UI and final task acceptance.

The host Agent interprets natural-language requests; the runtime does not parse prose. Discover `getChartContract('flow').incrementalBuilding` or `getCapabilities().diagram.incrementalBuilding`, read the current Spec, and preserve stable IDs.

Import this editing workflow from the complete `@taylorwong/ichartjs` root entry. The lightweight `/diagram` Profile supports rendering and Spec updates, but does not expose the root runtime's preview/commit/history APIs.

- `addNode` takes `node: { id, label, kind?, size?, position?, ports? }`. IDs and labels must be non-empty; fields and references must satisfy the schema. Initial ports/group membership are allowed, but later changes obey schema editability.
- `removeNode` takes `nodeId` and optional `policy: 'reject' | 'cascade'`. The default rejects incident edges (`NODE_CONNECTED`); cascade removes only explicit incident edges, not other nodes or parent relationships. Alternatively remove incident edges earlier in the transaction.
- `updateField` / `updateRecord` with `nodeId` edit existing labels, kinds, sizes, and declared editable fields. Use `edgeId` for existing edge records, or dedicated edge commands. Unknown/read-only fields are rejected.
- Combine additions, edge replacements, and field changes in one command. References are validated against the final graph; failure leaves the Spec, revision, and history unchanged. Structural edits require `editing.enabled`, `editing.allowStructuralChanges`, a chart-issued preview, and host confirmation even with `requireConfirmation: false`.

Set `diagram: { layout: 'layered', routing: 'auto' }` and omit positions for automatic building. Each transaction deterministically recomputes the graph; loop back-edges do not increase forward ranks. Sizes determine spacing; explicit positions and saved manual waypoints are not erased. `FLOW_NODE_OVERLAP` / `FLOW_LAYOUT_OVERFLOW` expose space limits instead of shrinking nodes or changing zoom/pan. Larger graphs may need a larger container or explicit positions. This is not an animated or minimum-displacement layout engine.

```js
const command = {
  type: 'layout-edit',
  reason: 'Add a review step after Start',
  operations: [
    { op: 'addNode', node: { id: 'review', kind: 'process', label: 'Review request' } },
    { op: 'addEdge', id: 'start-review', from: 'start', to: 'review' }
  ]
};
const preview = chart.previewEdit(command);
if (!preview.valid) throw new Error(JSON.stringify(preview.errors));
console.log(preview.layout, preview.warnings);
if (approvedByHost) {
  const result = chart.applyEdit(preview.command, { preview, confirmed: true, source: 'host-agent' });
  if (!result.valid) throw new Error(JSON.stringify(result.errors));
}
```

`approvedByHost` is a host decision, not an Agent-created flag. `preview.layout` and `getState().layout.diagram` expose diagram-space node boxes, effective edge routes, and layout warnings. Mount `preview.after` as a separate non-editable chart for visual review; re-preview after a revision or container-size change. Each turn occupies one Undo/Redo entry. Save `getSpec()` for continuation; reload recomputes positions but does not restore history. Avoid `update({ nodes, edges })` for each turn because replacement clears history.

The [incremental recipe](../../agent-recipes/diagrams/incremental-flow.json) is a starting Spec and ordered command templates, not a task executor. It covers processing, decisions, branches, a connector loop, rename, and cascade removal. Intermediate `FLOW_MISSING_END` / `FLOW_DECISION_BRANCHES` warnings are expected while building; report them and resolve them when the intended graph is completed. Do not hide layout or routing warnings.

Preview: `http://localhost:3000/playground/diagram-editor.html` starts empty. Click **Next** four times to build Start → Submit request → Approved? → Yes/No outcomes; **Previous step** undoes one turn and **Restart** clears the example. Clicking Next explicitly authorizes the displayed preset step; the host still validates, previews and confirms before committing. These are preset instructions, not a built-in chat or LLM service, and example completion is not business-task acceptance. Intermediate diagnostics remain available in the collapsed **Developer tools**.

Use `?scenario=advanced` for editable templates, separate previews, explicit Confirm and apply, cancellation, history, Save/Reload and export; `?scenario=editor` opens the manual node/route editor. The default and `?scenario=incremental` use the simple example. Add `renderer=canvas` or `lang=zh-CN`/`lang=en` as query parameters; otherwise UI language follows the browser, with English fallback. Changes made in Developer tools invalidate the simple sequence until Restart.

1. Assign stable IDs to nodes and edges.
2. Use `validateDiagram(spec)` to check endpoints, ports, groups, lanes, and layout options.
3. Create the chart with `createChart(spec)`.
4. Use typed commands such as `moveNodes`, `alignNodes`, `snapNodes`, `addEdge`, `updateEdge`, `removeEdge`, `toggleGroupCollapse`, `duplicateSelection`, and `pasteSelection` for edits.
5. Follow the preview/confirm/commit flow for all business-data changes.

## Implementation Map

- Diagram model, validation, layout, and routing: `src/diagram.mjs`
- Interaction: `src/diagram-interaction.mjs`
- Diagram Scene: `src/project.mjs`
- Commands and transactions: `src/command.mjs`, `src/edit-controller.mjs`
- Editor demo: `playground/diagram-editor.html`
- Full gallery: `playground/project-gallery.html`
- Keyboard port connection: Tab focuses nodes/groups/ports, Enter starts or completes a port connection, and Escape cancels it.

## Development Checklist

- Update Diagram data rules and `validateDiagram()`.
- Update command validation and preview/commit/history tests.
- Ensure edge arrows, labels, and ports are recomputed after node movement.
- Verify collapsed groups hide member nodes from the rendered Scene while preserving normalized Spec data.
- Check Canvas and SVG Scene structures together.
- Update `diagram-editor.html` and the Gallery.

## Acceptance

- Edges, arrows, and labels follow nodes after movement.
- Multi-selection alignment and snapping are visible in state output.
- Keyboard edits create undoable history entries.
- Copy/paste preserves internal edges and produces deterministic new IDs.
- Group collapse hides member nodes and keeps group-level state visible.
- Groups, ports, and invalid references produce structured validation results.
- Architecture nodes without explicit positions are arranged horizontally within their declared layer; explicit positions survive rendering and editing.
- Canvas and SVG produce equivalent edge selection, handle dragging, persisted waypoints, keyboard behavior, and exports.
