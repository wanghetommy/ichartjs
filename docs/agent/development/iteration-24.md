# Iteration 24 — Adaptive Edge Routing

Iteration 24 hardens Diagram connectors without changing the default interaction policy. Charts remain static until the host explicitly enables dragging, editing, zoom, or pan.

## 24A — Unified obstacle contract

- Treat every visible node shape as an obstacle, not only rectangles: rectangles, ellipses, circles, diamonds, parallelograms, polygons, and closed paths.
- Keep obstacle geometry renderer-independent and share it between SVG and Canvas.
- Use `bounds` only as a conservative fallback for an unknown closed shape, and expose a routing warning instead of silently claiming exact collision detection.
- Lanes, architecture layers, and decorative boundaries are not obstacles by default. A host may opt a boundary into routing with `obstacle: true`.

## 24B — Automatic routing

- Add `edge.routing: 'auto'`.
- Prefer orthogonal routes. A direct segment is allowed only when connection points share the same x or y coordinate, face outward through their ports, and have no obstacles. Never automatically draw a diagonal.
- Balance path length with a bend penalty, remove redundant collinear points, and preserve deterministic routes. Check source and destination interiors as well as other nodes; backward connections must go around their endpoints rather than through them.
- Keep explicit `straight`, `orthogonal`, and `curved` requests, but do not allow a selected path to pass through another node shape. A blocked straight/curved path falls back to a safe orthogonal route.
- For `auto`, return `EDGE_ROUTE_BLOCKED` and omit the connector when no safe orthogonal route is available. Do not silently fall back to a diagonal or a path through a node. Explicit straight/curved requests retain their existing fallback policy.

## 24C — Dynamic rerouting

- Recompute connected edges when a node is moved or resized.
- Preserve explicit ports and connection-side intent while rerouting.
- Keep node positions as the only layout edit; generated routes are derived state unless a host explicitly persists `waypoints`.

## 24D — Manual edge editing

- Add `routingMode: 'auto' | 'manual'`.
- Manual `waypoints` are accepted only when endpoints, connection direction, and all segments pass obstacle validation; otherwise the route falls back to automatic routing.
- Existing waypoint and orthogonal segment handles remain available only when `editing.enabled` and `interaction.edgeDrag` are explicitly enabled.
- Keep Canvas and SVG interaction and persistence equivalent.
- Dragging an edge handle switches the edge to `routingMode: 'manual'` in both preview and commit. Store `waypoints` in diagram coordinates, independent of zoom and pan, and keep handles usable across successive drags and Undo/Redo.
- An omitted `routingMode` preserves existing waypoint intent; schema normalization must not inject `auto` and discard a manual path during another edit. Explicit `auto` still ignores saved waypoints.

## 24E — Path and line styles

- Keep path shape in `routing`: `auto`, `straight`, `orthogonal`, or `curved`.
- Add `lineStyle: 'solid' | 'dashed' | 'dotted'` without changing route geometry.
- Defer a separate arc router until a real cross-region use case requires it; curved routing already covers the lightweight case.

## 24F — Agent contract and acceptance

- Publish routing modes, supported obstacle shapes, line styles, and blocked-route diagnostics through `getCapabilities()`.
- Document `from`/`to`, `routing`, `routingMode`, `waypoints`, and `lineStyle` together with a minimal example.
- Test direct, orthogonal, curved fallback, manual rejection, node-shape collision, node movement, SVG, and Canvas paths.

## Acceptance

- No supported connector path crosses another visible node shape.
- A clear aligned connection remains a simple horizontal/vertical segment; other automatic connections use readable orthogonal polylines, including after node movement. Explicit straight, curved, and manual routes retain their intent.
- Moving a node reroutes connected edges without recreating the chart.
- Manual handles cannot commit an invalid route and valid waypoints survive rerender and export.
- SVG and Canvas expose the same route, line style, selection, and edit behavior.
- A machine-readable warning is emitted when no obstacle-free route can be found.

## User-facing Verification

- Diagram editor: `http://localhost:3000/playground/diagram-editor.html`
- Full Gallery: `http://localhost:3000/playground/project-gallery.html`
- Agent scenario guide: `docs/agent/diagram-scenario.md`
