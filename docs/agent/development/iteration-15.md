# Iteration 15 — Text Readability Hardening

Iteration 15 improves text readability without adding a new chart type or a new runtime dependency. The policy is semantic: node labels stay inside nodes, while edge labels remain inline when there is enough space and move only when they collide.

## 15A — Adaptive node labels

Flow, Architecture, Mindmap, and Swimlane node labels use one shared layout policy:

1. Keep the configured theme size when a single line fits.
2. Wrap to at most two lines when the node can support it.
3. Reduce the font size to a bounded minimum of `10px`.
4. Truncate only the final visible line when the label still cannot fit.
5. Suppress labels in physically tiny nodes such as compact connectors.

The raw label remains available through node data, tooltips, accessibility output, and the Agent state. Nodes use shape-specific inner padding so labels do not touch decision or I/O edges.

## 15B — Semantic edge-label placement

Edge labels use this priority:

1. Place the label inline near the edge midpoint.
2. Add a small background plate when the edge passes behind the label.
3. Move the label to one side when it collides with a node or another label.
4. Suppress only non-core labels when no readable placement exists.

Node labels never move onto edges. Edge routing remains responsible for stopping at node boundaries. The same scene graph is used by SVG and Canvas.

Radar indicator labels use collision-aware placement without background plates. Background plates are reserved for diagram edge labels in Flow, Architecture, Mindmap, and Swimlane; ordinary chart labels retain direct, contrast-aware rendering.

## 15C — Unified label diagnostics

`Chart#getState().layout.labels` exposes family-specific label results, including visible, wrapped, scaled, truncated, suppressed, collision, edge-inline, edge-offset, and backgrounded counts where applicable.

Warnings are emitted for information loss or suppression, including `LABEL_TRUNCATED` and `LABELS_SUPPRESSED`. Agent workflows should inspect `getState()` or `explain()` before assuming that a visible chart contains every original label.

## 15D — Documentation and acceptance

- Shared measurement and fitting helpers live in `src/layout.mjs`.
- Diagram behavior is implemented in `src/project.mjs`.
- Generic mark and Radar labels use plate-free collision-aware placement in `src/charts.mjs`.
- SVG and Canvas use the same scene nodes and label geometry.
- Acceptance covers CJK and Latin labels, compact nodes, inline edge labels, plate-free Pie/line/Radar labels, and Architecture/Mindmap/Swimlane parity.

Preview pages:

- `playground/project-gallery.html?case=flow`
- `playground/project-gallery.html?case=architecture`
- `playground/project-gallery.html?case=radar`
