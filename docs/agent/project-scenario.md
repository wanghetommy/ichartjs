# Scenario: Project Management

Agent usage and development guide for project planning, delivery tracking, and project status reporting.

## Chart Selection

| Type | Typical use | Core data |
| --- | --- | --- |
| `gantt` | Task schedules, dependencies, critical paths | `id/name/start/end` |
| `timeline` | Event timelines | `id/title/date` |
| `milestone` | Key delivery points | `id/title/date` |
| `burndown` | Remaining Sprint work | `date/remaining` |

## Project Intelligence

- Prefer existing primitives for analytics views:
  - `gantt` for schedule variance, baseline vs actual, slack, and critical path
  - `column` for capacity and velocity
  - `area` for cumulative flow
  - `burndown` for release forecasting
  - `scatter` for risk matrix
  - `bar` for issue aging
- Declare calendar assumptions explicitly with timezone, working weekdays, holidays, and non-working-day policy. Iteration 6 calculations support deterministic `UTC`; other timezone values warn and fall back to `UTC`.
- Keep derived values separate from source rows. State and tooltips may expose variance, float, warnings, and assumptions, but transforms must not mutate source data.
- Linked filters and linked selection must use stable record IDs, not array positions.
- Forecasts, risk scores, and aging buckets are inspectable heuristics. They are not commitments, causal claims, or hidden inference.
- Project chart date axes are derived from `date`, `start`, and `end` records in the current contract; generic `xAxis.title/format` and `xAxis.min/max` settings do not customize them.

## Agent Workflow

1. Confirm the task, event, or Sprint data model.
2. Check dates, progress, dependencies, and missing values.
3. Select a project chart and create its Spec.
4. Validate Gantt dependencies; missing and cyclic dependencies are invalid.
5. For intelligence views, surface assumptions, warnings, and linked-filter state in the delivery output.
6. Use project tooltips, critical paths, scope changes, forecasts, and variance to explain results.

## Data Rules

- Gantt `start` and `end` must be valid dates, and `end` cannot precede `start`.
- `progress` uses the `0–100` percentage convention.
- `dependencies` use stable task IDs, either as strings or `{ id, type, lag, lead }` objects, and must form an acyclic graph.
- Dependency objects support `finish-to-start`, `start-to-start`, `finish-to-finish`, and `start-to-finish`. Rendering uses the matching task endpoints; a clear forward finish-to-start relationship uses a compact three-segment route, while overlapping or reverse relationships use a safe outer route.
- Issue aging requires an explicit ISO `today` reference; missing or invalid dates produce warnings instead of guessed buckets.
- Calendar-aware scheduling may also use dependency objects with explicit `type`, `lag`, and `lead`.
- `baselineStart`/`baselineEnd` and `actualStart`/`actualEnd` should be treated as explicit source inputs, not inferred values.
- Burndown `scopeChange` represents scope movement, not completed work.
- A forecast is an estimate derived from current samples, not a commitment or fact.
- Capacity warnings, risk quadrants, and aging buckets should stay explainable from source fields.
- Gantt, Timeline, and Milestone reserve their left label column from Unicode-aware text widths. Labels wider than the bounded column are truncated by rendered width rather than character count.

## Editing

Project data edits follow `editing-contract.md`:

```text
Schema → Command → Validate → Preview → Confirm → Commit → ChangeSet
```

Typical operations:

- `updateProgress`
- `shiftTask`
- `addDependency`
- `removeDependency`
- `updateMilestone`

## Implementation Map

- Project Scenes and tooltips: `src/project.mjs`
- Project analytics and adapters: `src/project-analytics.mjs`
- Linked filters and selection helpers: `src/project-linking.mjs`
- Project schemas: `src/schema.mjs`
- Commands and editing: `src/command.mjs`, `src/edit.mjs`
- Tests: `tests/core.test.mjs`
- Full gallery: `playground/project-gallery.html`
- Project intelligence demo: `playground/project-intelligence.html`

## Development Checklist

- Update project data rules and the Manifest before adding a capability.
- Add tests for analytics and tooltip content.
- Cover missing dates, cyclic dependencies, weekends/holidays, lag/lead, scope changes, and insufficient forecast data.
- Synchronize the Gallery and this guide's limitations.

## Acceptance

- All four project chart types initialize in the Gallery.
- Gantt dependencies, critical-path results, and variance overlays are explainable.
- Dependency paths connect the endpoints declared by their dependency type; an unobstructed forward finish-to-start path has at most three segments.
- Burndown scope changes and forecasts have dedicated tests.
- Capacity, risk, and aging analytics preserve stable record IDs.
- Editing commands support preview, commit, undo, and redo.
