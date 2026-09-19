# Scenario: Interactive Diagrams

Agent usage and development guide for process modeling, responsibility mapping, and editable diagrams.

## Supported Types

- `flow`: a process graph made of nodes and edges.
- `swimlane`: a process graph organized by responsibility lanes.
- `architecture`: a layered business, data, or technical architecture graph with optional boundaries.
- `mindmap`: a parent-child hierarchy of ideas rendered as a tree or radial diagram.

Architecture and mindmap are both structured diagrams, but they are not interchangeable: architecture describes declared domain or system relationships, while a mindmap describes an idea hierarchy.

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

## Current Capabilities

Supported:

- Nodes, edges, lanes, groups, and ports.
- `manual`, `layered`, `tree`, and `radial` layouts.
- Architecture layers and boundaries, plus mindmap parent-child derivation.
- `straight`, `orthogonal`, and true cubic-Bezier `curved` routing, with adjustable `curveTension` and obstacle-aware orthogonal fallback.
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

Mindmap defaults to curved parent-child edges. Set `diagram.curveTension` from `0.2` to `0.8`, override `routing` or `curveTension` on one explicit edge, or use `waypoints` when a persistent manual polyline is required. Bezier control points are not directly editable.

Current limitations:

- Groups are flat; nested groups are not supported.
- Group bounds are derived from member geometry and configurable `group.padding`; `resizeGroup` scales member positions and sizes rather than persisting a second group rectangle.
- `deleteGroup` defaults to `ungroup`; use `delete-members` only after explicit host confirmation.
- Canvas keeps basic accessibility text, while SVG exposes richer diagram semantics.
- Cross-browser matrix and physical-device validation remain acceptance work, not runtime guarantees.

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
- Canvas and SVG produce equivalent edge selection, handle dragging, persisted waypoints, keyboard behavior, and exports.
