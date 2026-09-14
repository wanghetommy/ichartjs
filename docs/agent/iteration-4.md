# Iteration 4 — Agent Data Contract and Business Editing

## Delivery status

4A, 4B, 4C, 4D, and 4E are implemented in the local runtime. The viewable acceptance demo is available at `http://localhost:3000/playground/editing`.

- 4C: guarded local commit, exact preview/revision checks, change set, audit metadata, and edit events.
- 4D: undo/redo history, recipe validation, capability discovery, and TypeScript declarations.
- 4E: unit coverage and a browser-facing preview/commit/undo/redo flow. External persistence and authorization remain host responsibilities.

## Goal

Upgrade iChart.js 2.0 from an Agent-capable visualization runtime into a safe, explainable, and production-ready business-data editing runtime.

An Agent must be able to inspect a business data contract, generate a typed edit command, preview its impact, validate the change, request confirmation when required, commit the change, and undo it. Direct arbitrary mutation is not the primary Agent interface.

Geographic charts and 3D rendering remain outside this iteration.

Status: 4A–4E implemented for the local runtime. External persistence, authorization, true-device touch testing, and host application release controls remain outside the runtime.

## Core Concepts

```text
Chart Spec
  → describes how data is displayed
Business Data Schema
  → describes fields, types, permissions, and business rules
Edit Command
  → describes the intended business operation
Validation and Diff
  → explains whether and how data will change
Data Store / JSON Patch
  → applies the normalized mutation
Scene Graph
  → re-renders the result
```

## Task List

### A. Business Data Schema

1. Add a versioned `BusinessDataSchema` contract.
2. Define field types: `string`, `number`, `boolean`, `date`, `enum`, `array`, and `object`.
3. Support `required`, `default`, `nullable`, `min`, `max`, `pattern`, and enum values.
4. Define primary keys, foreign keys, and references between records.
5. Define field edit permissions: editable, read-only, Agent-editable, and user-only.
6. Define data-to-chart encoding mappings for project and diagram views.
7. Define cross-field business rules with stable rule IDs and messages.
8. Validate dates, intervals, dependencies, node IDs, lane IDs, and status transitions.
9. Return structured errors with `code`, `path`, `rule`, `message`, and `suggestion`.
10. Add schema version compatibility and migration hooks.

### B. Business Data Models

11. Add the `project-task` model for Gantt and schedule data.
12. Add the `timeline-event` and `milestone` models.
13. Add the `burndown-sample` model, including scope changes and forecast fields.
14. Add the `flow-node`, `flow-edge`, and `swimlane` models.
15. Normalize dates, IDs, statuses, percentages, and dependency arrays.
16. Preserve original source values and normalized values where conversion occurs.
17. Add data-quality warnings for missing, ambiguous, or inferred values.

### C. Typed Edit Commands

18. Define a versioned `EditCommand` envelope.
19. Add `updateField` for a single field change.
20. Add `updateRecord` for validated multi-field changes.
21. Add `addRecord` and `removeRecord`, disabled by default.
22. Add `updateTask` for project-task changes.
23. Add `shiftTask` for date movement with dependency policies.
24. Add `updateProgress` for progress and status changes.
25. Add `addDependency` and `removeDependency` with cycle checks.
26. Add `updateMilestone` for event date and status changes.
27. Add `moveNode` for diagram layout changes.
28. Add `moveNodeToLane` for responsibility changes.
29. Add `updateEdge` for controlled process relationship changes.
30. Keep layout edits separate from business-data edits.

### D. Validation and Preview

31. Implement `inspectDataSchema()`.
32. Implement `validateData()`.
33. Implement `validateEdit(command)` without mutating the source.
34. Implement `previewEdit(command)` with before/after values.
35. Calculate affected records and dependent tasks.
36. Report warnings for critical-path, completed-task, and destructive changes.
37. Report dependency shifts and schedule conflicts.
38. Support policies for shifting dependents, allowing negative slack, and requiring confirmation.
39. Produce normalized JSON Patch only after command validation.
40. Make preview output deterministic and JSON serializable.

### E. Commit, History, and Audit

41. Implement `applyEdit(command)`.
42. Require confirmation by default for destructive or structural changes.
43. Implement `getChangeSet()`.
44. Implement `undo()` and `redo()`.
45. Store operation IDs, actor, timestamp, reason, source, and affected records.
46. Support optimistic version checks to prevent stale updates.
47. Emit `beforeedit`, `edit`, `editerror`, and `undoredo` events.
48. Ensure failed edits leave the original data unchanged.
49. Ensure chart re-rendering occurs only after a successful commit.
50. Keep an audit record separate from user-visible chart data.

### F. Agent Contract and Capability Discovery

51. Extend `getCapabilities()` with schema and editing capabilities.
52. Add `getEditCapabilities(schema)` for field and operation permissions.
53. Add Agent response fields for selected model, assumptions, warnings, diff, and confirmation requirement.
54. Add Recipe examples for schedule changes, progress updates, dependency changes, and workflow ownership.
55. Add a Recipe validator for both Chart Spec and Business Data Schema.
56. Document that arbitrary `applyPatch()` is a low-level API, not the preferred Agent API.
57. Add safe defaults: confirmation required, delete disabled, structural edits disabled.

### G. TypeScript, Runtime, and Demos

58. Add TypeScript declarations for schemas, commands, policies, diffs, and audit records.
59. Add framework-neutral data-store adapters.
60. Add headless preview and export of change sets.
61. Add a browser demo for preview → confirm → commit → undo.
62. Add a Gantt demo for shifting a task and optionally shifting dependents.
63. Add a Flow demo for moving a node and persisting layout only.
64. Add invalid-command and rollback demonstrations.
65. Add mobile-safe confirmation and edit controls.

### H. Production Release Gates

66. Stabilize public APIs and document RC compatibility rules; release `2.0.0-rc.1` only after all gates pass.
67. Establish core/renderer/plugin/recipe module boundaries without duplicating implementations; assess package splitting separately from introducing mandatory dependencies.
68. Add renderer/export capability negotiation, explicit unsupported results, and deterministic SVG/PNG/JSON export tests, including headless output.
69. Complete keyboard focus, ARIA relationships, and reduced-motion behavior in editing and viewing modes.
70. Define reproducible small/medium/large data benchmarks with documented dataset sizes, hardware, and acceptance budgets before measuring.
71. Test event, observer, tooltip, plugin, resize, and destroy lifecycles for leaks and stale state.
72. Re-audit Iteration 2/3 feature claims and record actual functional/browser acceptance gaps; passing unit tests or matching node IDs alone does not establish mobile or renderer interaction parity.

## Execution Order and Checkpoints

| Phase | Tasks | Dependency | Viewable or inspectable result |
| --- | --- | --- | --- |
| 4A — Contracts | 1–17, 66 | Audit existing data conventions | Schema, normalized fixtures, structured validation reports |
| 4B — Command preview | 18–40 | 4A | Gantt change preview with before/after values and affected tasks |
| 4C — Safe commit | 41–50, 57 | 4B | Trusted confirmation, atomic commit, conflict rejection, undo/redo |
| 4D — Agent integration | 51–56, 58–65 | 4C | Agent recipes plus Gantt/Flow editing demo |
| 4E — Release acceptance | 67–72 | 4A–4D | Reproducible acceptance report; RC only if all gates pass |

Notify the user whenever an HTTP-served demo reaches an acceptance checkpoint. Report untested physical-device gestures separately from synthetic event tests and desktop mobile-viewport tests.

## Authority and Data Boundaries

- Editing is opt-in. Viewing/panning must not silently mutate business values. Keep `view-edit`, `layout-edit`, `data-edit`, and `structure-edit` distinct.
- The chart library previews and edits local normalized data. Writing to an external business system requires a separately configured host adapter; this plan does not grant database access or promise built-in integrations.
- The host/server enforces authentication, authorization, and confirmation. Schema field flags and Agent-supplied actor/confirmation fields are not security boundaries.
- Confirmation must bind to the exact preview, data revision, and affected records. Revalidate permissions and revision at commit; reject a changed command or stale preview. Do not automatically apply a preview merely because it requires confirmation.
- Use declarative rule objects and registered trusted validators. Do not evaluate arbitrary rule strings from data or Agent output using `eval` or `Function`.
- Resolve records by stable IDs, not mutable array offsets. Commit batches atomically; external persistence must succeed before reporting persisted success. Undo against a changed revision must fail or require a new preview.
- Task progress is canonical `0–100`; converting legacy `0–1` values requires an explicit source-unit setting. Define date-only values, timestamps, timezone, and exclusive interval ends separately. `shiftTask.days` uses explicit calendar-day rules; work calendars, holidays, and lead/lag remain Iteration 6 scope.
- Derived critical-path and forecast values are read-only and recomputed. Business actor identity comes from the host; audit records in local memory are not durable or tamper-proof server audit logs.
- Reuse the Iteration 4 history/command engine in Iteration 5 instead of creating another undo/redo implementation.

## Recommended Public API

```js
const chart = createChart({
  type: 'gantt',
  data: { values: tasks, schema: taskSchema },
  editing: {
    enabled: true,
    mode: 'command',
    requireConfirmation: true,
    allowDelete: false,
    allowStructuralChanges: false
  }
});

chart.inspectDataSchema();
chart.validateData();
const preview = chart.previewEdit({
  type: 'edit',
  target: 'project-task',
  operations: [{
    op: 'shiftTask',
    taskId: 'development',
    days: 2,
    shiftDependents: true
  }]
});

if (preview.valid) {
  const approval = await host.requestEditApproval(preview);
  if (approval.approved) {
    await chart.applyEdit(preview.command, {
      previewId: preview.id,
      expectedRevision: preview.revision,
      approval: approval.receipt
    });
  }
}
```

`host.requestEditApproval()` is an application-owned integration point, not an existing iChart API. Its receipt must be checked by the host commit adapter, not trusted merely because an Agent supplied it.

## Acceptance Criteria

### Functional

- A schema describes fields, types, editability, relationships, and business rules.
- Invalid data and invalid commands return structured errors without partial mutation.
- Typed commands support task updates, schedule shifts, progress changes, dependency changes, node movement, and lane movement.
- `previewEdit()` returns deterministic before/after values, warnings, affected records, and confirmation requirements.
- Successful commits update data and re-render the chart.
- Undo and redo restore both data and layout edits.

### Safety and Explainability

- Deletes and structural changes require explicit confirmation.
- Read-only fields cannot be changed by Agent commands.
- Critical-path and completed-task changes produce warnings.
- Every committed edit includes audit metadata.
- Stale-version edits are rejected instead of overwriting newer data.
- `applyPatch()` remains available only as a low-level escape hatch.

### Rendering and Interaction

- Gantt date edits update task bars and dependencies.
- Flow node movement updates connected arrows and persists `node.position`.
- SVG and Canvas reflect the same normalized data after an edit.
- Mobile editing controls remain usable and do not conflict with pan/zoom.
- Preview and confirmation UI is available in a viewable HTTP-served demo.

### Quality Gate

- `npm test` passes.
- `npm run check` passes.
- `git diff --check` passes.
- Schema, command, validation, history, and audit tests pass.
- Agent Recipes validate against the declared capabilities.
- Browser acceptance covers preview, confirmation, commit, rollback, undo, SVG, Canvas, and mobile behavior.

## Deliverables

- `src/schema.mjs`
- `src/validation.mjs`
- `src/command.mjs`
- `src/edit.mjs`
- `src/history.mjs`
- `types/`
- `agent-recipes/editing/`
- `playground/editing.html`
- `docs/agent/editing-guide.md`
- `2.0.0-rc.1`

## Current Implementation Checkpoint

- Available modules: `src/schema.mjs`, `src/validation.mjs`, `src/command.mjs`, and `src/edit.mjs`.
- Available APIs: `getBusinessSchema()`, `inspectDataSchema()`, `validateData()`, `getEditCapabilities()`, `validateEdit()`, `previewEdit()`, `applyEdit()`, `getChangeSet()`, `undo()`, and `redo()`.
- Viewable demo route: `http://localhost:3000/playground/editing` (source page: `playground/editing.html`) shows a Gantt change preview and confirms that source data remains unchanged.
- The preview result is local and deterministic; it is not an authorization receipt and does not persist to an external system.

## Completion Definition

Iteration 4 is complete when an Agent can safely modify a validated business dataset through typed commands, preview a deterministic diff, obtain required confirmation, commit or roll back the change, and observe the result consistently in SVG and Canvas views.
