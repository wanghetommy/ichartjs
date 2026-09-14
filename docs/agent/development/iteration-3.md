# Iteration 3 — Project and Business Visualization

## Goal

Extend iChart.js 2.0 from a statistical chart runtime into an Agent-first visualization runtime that can represent project plans, delivery progress, milestones, and business processes.

This iteration explicitly **does not include geographic charts or 3D rendering**. The architecture may be upgraded when needed; compatibility with the legacy 1.x implementation is not a constraint.

## Scope

### P0 — Project management charts

1. **Gantt chart (`gantt`)**
   - Tasks with `id`, `name`, `start`, `end`, `duration`, `progress`, and `status`.
   - Task dependencies and dependency validation.
   - Milestone tasks with zero duration.
   - Today marker, working-area layout, task labels, and status styling.
   - Time-axis zoom, horizontal pan, task selection, and tooltip details.
   - SVG and Canvas rendering where the interaction model is shared.

2. **Timeline / milestone chart (`timeline`, `milestone`)**
   - Chronological events with dates, titles, descriptions, categories, and status.
   - Milestone emphasis, event grouping, and compact/mobile layouts.
   - Click, hover, keyboard navigation, and accessible event descriptions.
   - ISO-8601 dates are validated before rendering.

3. **Burndown chart (`burndown`)**
   - Ideal line, actual remaining work, completed work, and scope-change markers.
   - Sprint or release date range.
   - Support for story points, task count, or another quantitative measure.
   - Highlight overdue work and projected completion when data is sufficient.
   - Scope-change rows may provide `scopeChange`; the runtime renders change markers and keeps actual remaining work separate.

### P1 — Process visualization

4. **Flow chart (`flow`)**
   - Nodes, directed edges, labels, node kinds, and status.
   - Automatic layout with deterministic output for the same Spec.
   - Node/edge hit testing, selection, focus navigation, and viewport pan/zoom.
   - SVG-first output for semantic DOM interaction, with Canvas fallback for large graphs.
   - Nodes may be dragged when `interaction.drag` is enabled; `drag` and `dragend` events expose the active node.

5. **Swimlane chart (`swimlane`)**
   - Lanes representing people, teams, systems, or Agents.
   - Flow nodes positioned within lanes and cross-lane transitions.
   - Lane labels, grouping, selection, and accessible relationships.

### P2 — Deferred extensions

The following remain outside the Iteration 3 delivery target:

- Geographic and map charts.
- 3D and perspective chart variants.
- Fishbone / Ishikawa diagrams.
- Organization charts.
- Dependency networks and resource-load views.
- Kanban boards.

These can be evaluated after the Diagram Runtime and editing model have stabilized.

## Technical work items

1. Define a common `ProjectSpec` and `DiagramSpec` contract.
2. Add `gantt`, `timeline`, `milestone`, `burndown`, `flow`, and `swimlane` to capability discovery.
3. Add validation schemas and actionable validation suggestions for each type.
4. Add temporal interval, dependency, node, edge, and lane data models.
5. Add reusable project timeline layout primitives.
6. Add reusable graph layout and routing primitives.
7. Render project and diagram scene graphs through the existing renderer abstraction.
8. Add shared interaction state for selection, focus, pan, zoom, and tooltip.
9. Add plugin hooks for annotations, labels, data zoom, and accessibility.
10. Add Agent recommendations based on intents such as `schedule`, `progress`, `milestone`, `workflow`, and `responsibility`.
11. Add JSON Recipes for every Iteration 3 chart type.
12. Add a dedicated project-management and process gallery.
13. Add mobile interaction coverage and responsive layout rules.
14. Add export and serialization checks for SVG, PNG, and normalized Spec output.
15. Preserve Flow node positions after drag by writing them to `node.position`.

## Agent API expectations

Capability discovery should expose separate groups:

```json
{
  "charts": ["line", "area", "bar", "column", "pie", "donut", "scatter", "bubble", "heatmap", "funnel", "gauge", "waterfall"],
  "projectManagement": ["gantt", "timeline", "milestone", "burndown"],
  "diagrams": ["flow", "swimlane"],
  "excluded": ["map", "3d"]
}
```

The Agent guide must include one minimal Spec and one data-shape example for each supported type. The Agent should be able to discover the appropriate type without relying on legacy class names such as `Column2D` or `Column3D`.

## Demo deliverables

The following viewable demos are required before Iteration 3 is considered complete:

- `playground/project-gallery.html` with Gantt, timeline, milestone, burndown, flow, and swimlane examples.
- At least one SVG and one Canvas scenario where each renderer is appropriate.
- A responsive/mobile scenario showing timeline or Gantt pan and zoom.
- A workflow scenario showing lane ownership and cross-lane transitions.
- Inline links to the corresponding Agent Recipes and normalized Specs.

When a demo is available for acceptance, report the exact HTTP URL and the command used to serve it. These demos must not depend on opening ESM files directly through `file://`.

## Verification criteria

### Functional

- Each P0 and P1 type validates, normalizes, renders, and exposes `describe()` and `getState()`.
- Invalid dates, intervals, dependencies, node references, and lane references produce structured validation errors.
- Gantt dependencies render in the correct direction and report missing or cyclic dependencies.
- Burndown calculations remain correct when scope changes are present.
- Flow and swimlane layouts are deterministic and do not lose nodes or edges.

### Interaction

- Hover, click, selection, keyboard focus, tooltip, pan, and zoom work consistently across supported types.
- Project tooltips show task dates/progress, milestone dates, and burndown remaining/scope changes.
- Dependency arrows use arrowheads; entries on `criticalPath` use emphasized styling.
- Touch drag and pinch zoom work on timeline-based charts.
- Single-finger touch drag moves Flow nodes when `interaction.drag` is enabled; two-finger touch remains reserved for pinch zoom.
- Keyboard users can traverse tasks, milestones, nodes, and lanes with visible focus state.

### Rendering and accessibility

- SVG output exposes meaningful labels and relationships where possible.
- Canvas output retains equivalent hit testing and accessible chart metadata.
- Responsive layouts remain usable at desktop and mobile widths.
- SVG, PNG, and normalized JSON exports are available or explicitly reported unsupported per chart type.

### Quality gate

- `npm test` passes.
- `npm run check` passes.
- `git diff --check` passes.
- Browser acceptance covers every Iteration 3 demo panel through an HTTP-served page.
- Agent Recipes parse successfully and match capability discovery.

## Completion definition

Iteration 3 is complete when all P0 and P1 types are implemented, tested, documented, discoverable by an Agent, and demonstrated in `playground/project-gallery.html`. P2 items are not blockers for the iteration.
