# Iteration 5 — Advanced Diagram Runtime

## Current delivery

The initial runtime increment is available for review:

- Diagram normalization for nodes, edges, lanes, groups, and diagram options.
- Deterministic `manual`, `layered`, `tree`, and `radial` layout modes.
- `straight`, `orthogonal`, and `curved` edge routing declarations.
- Node size in scene layout and the typed `resizeNode` edit command.
- Diagram validation for duplicate IDs, endpoints, lanes, groups, ports, cycles, and unreachable nodes.
- Shared Iteration 4 preview, confirmation, commit, audit, undo, and redo behavior.
- Workflow Agent Recipe at `agent-recipes/diagrams/workflow.json`.
- Iteration 5B group/port visualization, multi-selection, alignment, grid snapping, keyboard movement, and typed layout commands.
- Viewable HTTP demo at `http://localhost:3000/playground/diagram-editor`.

## Acceptance

- `npm test` and `npm run check` pass.
- Layout output is deterministic for the same DiagramSpec and bounds.
- Invalid endpoints, duplicate entity IDs, invalid ports, and illegal group relationships return structured errors.
- Diagram node resize commits through the shared edit history and can be undone.
- Demo loads over HTTP and exposes resize, undo, redo, reset, and normalized state output.
- Demo exposes multi-select, alignment, snapping, keyboard movement, Group/Port visuals, and selection state.

## Remaining increments

- Group expand/collapse and group-level editing.
- Port-aware drag-to-connect interaction.
- Copy/paste and richer group-level editing.
- Port-aware drag-to-connect interaction and complete keyboard-only editing.
- Complete obstacle-aware routing for all supported routing modes.
- Diagram-specific SVG ARIA relationships and cross-browser/mobile acceptance.
