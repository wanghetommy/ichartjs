# Iteration 5 — Advanced Diagram Runtime

## Current delivery

The current runtime increment is available for review:

- Diagram normalization for nodes, edges, lanes, groups, and diagram options.
- Deterministic `manual`, `layered`, `tree`, and `radial` layout modes.
- `straight`, `orthogonal`, and `curved` edge routing declarations.
- Node size in scene layout and the typed `resizeNode` edit command.
- Diagram validation for duplicate IDs, endpoints, lanes, groups, ports, cycles, and unreachable nodes.
- Shared Iteration 4 preview, confirmation, commit, audit, undo, and redo behavior.
- Workflow Agent Recipe at `agent-recipes/diagrams/workflow.json`.
- Iteration 5B group/port visualization, multi-selection, alignment, grid snapping, keyboard movement, and typed layout commands.
- Iteration 5C group collapse / expand, clipboard-style copy/paste, duplicate selection, and typed edge creation.
- Iteration 5D typed group movement and batch group membership assignment/removal through shared history.
- Iteration 5E deterministic group duplication, explicit safe/recursive deletion policies, and keyboard-only port connection flow.
- Port-aware drag-to-connect interaction and SVG diagram accessibility labels.
- Lightweight obstacle-aware orthogonal routing for common node-overlap cases.
- Iteration 5F member-derived group resizing, deterministic multi-obstacle routing channels, visible keyboard focus, and connection-state accessibility descriptions.
- Viewable HTTP demo at `http://localhost:3000/playground/diagram-editor`.

## Acceptance

- `npm test` and `npm run check` pass.
- Layout output is deterministic for the same DiagramSpec and bounds.
- Invalid endpoints, duplicate entity IDs, invalid ports, and illegal group relationships return structured errors.
- Diagram node resize commits through the shared edit history and can be undone.
- Demo loads over HTTP and exposes resize, copy/paste, group collapse, typed connection, undo, redo, reset, and normalized state output.
- Demo exposes multi-select, alignment, snapping, keyboard movement, Group/Port visuals, clipboard state, and collapsed-group state.
- Copy/paste preserves internal edges and deterministic copied IDs.
- Collapsed groups hide member nodes from the Scene while keeping normalized Spec state intact.
- Orthogonal routing avoids common node-body overlaps in deterministic output.
- Group movement and membership changes commit and restore through shared undo/redo history.
- Group duplication preserves internal edges; deletion defaults to ungrouping and requires an explicit policy to delete members.
- Keyboard users can focus ports with Tab, connect with Enter, and cancel with Escape.
- Group resize scales member geometry and remains undoable without introducing a conflicting persisted group rectangle.
- Dense orthogonal routes evaluate deterministic horizontal and vertical channels around multiple node obstacles.
- Workflow, approval process, Agent orchestration, and responsibility mapping recipes are included.

## Local runtime closure

Iteration 5 local runtime scope is complete. The final 2.0 browser matrix passed; physical-device mobile acceptance remains host integration evidence and is not claimed by unit or synthetic interaction tests.
