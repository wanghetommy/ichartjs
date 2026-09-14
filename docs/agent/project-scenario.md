# Scenario: Project Management

Agent usage and development guide for project planning, delivery tracking, and project status reporting.

## Chart Selection

| Type | Typical use | Core data |
| --- | --- | --- |
| `gantt` | Task schedules, dependencies, critical paths | `id/name/start/end` |
| `timeline` | Event timelines | `id/title/date` |
| `milestone` | Key delivery points | `id/title/date` |
| `burndown` | Remaining Sprint work | `date/remaining` |

## Agent Workflow

1. Confirm the task, event, or Sprint data model.
2. Check dates, progress, dependencies, and missing values.
3. Select a project chart and create its Spec.
4. Validate Gantt dependencies; missing and cyclic dependencies are invalid.
5. Use project tooltips, critical paths, scope changes, and forecasts to explain results.

## Data Rules

- Gantt `start` and `end` must be valid dates, and `end` cannot precede `start`.
- `progress` uses the `0–100` percentage convention.
- `dependencies` use stable task IDs and must form an acyclic graph.
- Burndown `scopeChange` represents scope movement, not completed work.
- A forecast is an estimate derived from current samples, not a commitment or fact.

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
- Project schemas: `src/schema.mjs`
- Commands and editing: `src/command.mjs`, `src/edit.mjs`
- Tests: `tests/core.test.mjs`
- Full gallery: `playground/project-gallery.html`

## Development Checklist

- Update project data rules and the Manifest before adding a capability.
- Add tests for analytics and tooltip content.
- Cover missing dates, cyclic dependencies, scope changes, and insufficient forecast data.
- Synchronize the Gallery and this guide's limitations.

## Acceptance

- All four project chart types initialize in the Gallery.
- Gantt dependencies and critical-path results are explainable.
- Burndown scope changes and forecasts have dedicated tests.
- Editing commands support preview, commit, undo, and redo.
