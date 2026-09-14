# Scenario: Interactive Diagrams

Agent usage and development guide for process modeling, responsibility mapping, and editable diagrams.

## Supported Types

- `flow`: a process graph made of nodes and edges.
- `swimlane`: a process graph organized by responsibility lanes.

## Data Model

```js
{
  type: 'flow',
  nodes: [{
    id: 'review',
    label: 'Review',
    position: { x: 240, y: 100 },
    size: { width: 140, height: 44 },
    ports: [{ id: 'in', side: 'left', offset: 0.5 }],
    groupId: 'delivery'
  }],
  edges: [{ from: 'start', to: 'review', toPort: 'in' }],
  groups: [{ id: 'delivery', label: 'Delivery' }]
}
```

## Current Capabilities

Supported:

- Nodes, edges, lanes, groups, and ports.
- `manual`, `layered`, `tree`, and `radial` layouts.
- `straight`, `orthogonal`, and `curved` routing declarations.
- Node dragging, multi-selection, alignment, and grid snapping.
- Keyboard movement, undo/redo, and a shared Canvas/SVG Scene.

Current limitations:

- Groups are flat; nested groups are not supported.
- Port visualization and port routing are supported, but drag-to-connect is not complete.
- Copy/paste and group collapse/expand are not complete.

## Agent Workflow

1. Assign stable IDs to nodes and edges.
2. Use `validateDiagram(spec)` to check endpoints, ports, groups, lanes, and layout options.
3. Create the chart with `createChart(spec)`.
4. Use typed commands such as `moveNodes`, `alignNodes`, and `snapNodes` for edits.
5. Follow the preview/confirm/commit flow for all business-data changes.

## Implementation Map

- Diagram model, validation, layout, and routing: `src/diagram.mjs`
- Interaction: `src/diagram-interaction.mjs`
- Diagram Scene: `src/project.mjs`
- Commands and transactions: `src/command.mjs`, `src/edit-controller.mjs`
- Editor demo: `playground/diagram-editor.html`
- Full gallery: `playground/project-gallery.html`

## Development Checklist

- Update Diagram data rules and `validateDiagram()`.
- Update command validation and preview/commit/history tests.
- Ensure edge arrows, labels, and ports are recomputed after node movement.
- Check Canvas and SVG Scene structures together.
- Update `diagram-editor.html` and the Gallery.

## Acceptance

- Edges, arrows, and labels follow nodes after movement.
- Multi-selection alignment and snapping are visible in state output.
- Keyboard edits create undoable history entries.
- Groups, ports, and invalid references produce structured validation results.
