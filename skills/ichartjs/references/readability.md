# Readability Acceptance

Use for visual delivery or layout/text/style edits, not unrelated data changes. These are acceptance checks, not new runtime options or guarantees.

## Review at Delivery Size

Inspect health/warnings, `getState().layout.labels`, Diagram `.layout.diagram` or Board `.layout.text`. With visual tools, review the browser/export at delivery size, including requested mobile layouts. Diagnostics and SVG strings cannot establish visual quality; disclose unavailable checks.

Check labels, whitespace, connectors, branches and contrast. Preserve grouping, routing space and time distances; whitespace is not inherently wrong.

## Family Checks

| Family | Acceptance focus |
| --- | --- |
| Flow / Architecture / Mindmap / Swimlane | Clear reading direction, groups and branch labels; moderate spacing; routes avoid shapes. Prefer automatic Flow `layered` without positions for new compositions, not for replacing user layouts. Keep node text inside shapes; edge text remains inline when space permits and offsets for collisions. Inspect `.layout.labels.diagram`. |
| Line / Area / Bar / Column / Scatter / Heatmap | Legible ticks, units and comparisons; important labels clear of marks/lines. Not every mark needs a value label; preserve user-requested labels and explain physical limits. |
| Pie / Gauge / Radar / Funnel | Main shape remains prominent, with room for meaningful labels/legend. No ordinary-label background plates. Preserve Funnel stage names even when narrow stages need a supported placement change or more space. |
| Gantt / Timeline / Milestone / Burndown | Dates, dependencies, progress and forecasts remain distinguishable; correct temporal geometry takes priority over compactness. |
| Board | Clear reading order and intended grouping; no accidental overlaps/clipping. Respect locked items and manual composition. |

## Repair Without Losing Meaning

Start from runtime defaults: omit unnecessary node sizes/positions and style overrides for new automatic diagrams. Content-sized nodes, bounded strokes, foreground selection and final-geometry edge-text protection belong to the runtime, not a large Agent-authored styling recipe. Keep explicit user geometry, colors and the viewport. Inspect `INSUFFICIENT_TEXT_CONTRAST`, label fitting and Diagram overflow/overlap warnings. Transparent output needs a known host background to guarantee contrast; it must not gain white label patches. Ordinary chart labels stay plate-free. Do not treat `onLine: false`, `valid: true` or renderable health as proof of readable output.

Prefer runtime stroke sizing; arrows/dashes follow it, grid/borders stay subordinate. Explicit `theme.tokens.marks.lineWidth` fixes the main width, not a preference field. Check delivery-size legibility; never multiply by DPR or zoom again.

Trace excessive gaps to Agent coordinates, auto layout, host dimensions or saved preferences/view. Adjust supported layout/sizing/label placement; do not invent gap controls, fixed occupancy ratios or a universal aspect ratio.

Preserve text; prefer fitting/wrapping over truncation. Never hide important labels, force tiny fonts or alter data to clear warnings. Recheck targeted fixes; disclose remaining space limits or runtime defects instead of blind retries or false completion.
