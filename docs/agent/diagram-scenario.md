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

Mindmap defaults to curved parent-child edges. Set `diagram.curveTension` from `0.2` to `0.8`, use `routing: 'auto'` for orthogonal-first obstacle-aware routing, override `routing` or `curveTension` on one explicit edge, or set `routingMode: 'manual'` with `waypoints` for a persistent manual polyline. Bezier control points are not directly editable. Manual routes that cross a visible node shape are rejected and recalculated automatically.

Automatic routes use a direct segment only when connection points are horizontally or vertically aligned, ports face outward, and the segment is clear. Other automatic connections use orthogonal segments with a penalty for unnecessary bends. Backward routes also avoid the source and destination interiors. If no safe orthogonal route exists, the connector is omitted with `EDGE_ROUTE_BLOCKED` in `getState().warnings` and `explain().warnings`; adjust the node positions or ports. Explicit `straight`/`curved` requests and manual routes are not converted solely to eliminate diagonals.

Current limitations:

- Groups are flat; nested groups are not supported.
- Group bounds are derived from member geometry and configurable `group.padding`; `resizeGroup` scales member positions and sizes rather than persisting a second group rectangle.
- `deleteGroup` defaults to `ungroup`; use `delete-members` only after explicit host confirmation.
- Canvas keeps basic accessibility text, while SVG exposes richer diagram semantics.
- Cross-browser matrix and physical-device validation remain acceptance work, not runtime guarantees.
- Mixed manual and automatic Architecture positions can overlap; explicit positions are preserved rather than silently moved.

## Agent Workflow

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
