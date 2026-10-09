# Editing Contract

Safe editing contract for business and Diagram data used by Agents.

## Required Flow

```text
Read Schema → Build Command → Validate → Preview → Confirm → Commit → ChangeSet
```

Do not mutate business data objects directly; use the Chart editing API so the Runtime performs validation and history management.

## APIs

```js
const preview = chart.previewEdit(command);
if (!preview.valid) return preview.errors;

const result = chart.applyEdit(command, {
  preview,
  confirmed: true,
  source: 'agent'
});
```

Core APIs:

- `getBusinessSchema(name)`
- `inspectDataSchema(schema)`
- `chart.validateEdit(command)`
- `chart.previewEdit(command)`
- `chart.applyEdit(command, options)`
- `chart.getChangeSet()`
- `chart.undo()` / `chart.redo()`

### Instance APIs versus standalone validators

Prefer the Chart instance workflow for Agent edits: it supplies the current diagram, schemas, host permissions and layout context. `chart.validateEdit(command)` checks the same context as preview without issuing a committable preview or mutating state/history. Commit still needs an instance-issued preview and host confirmation.

The exported `validateEdit(command, options)` and `previewEdit(command, options)` are lower-level helpers; their second argument is an explicit editing context, **not a ChartSpec**. Diagram contexts supply `type`, `nodes`, `edges`, relevant schemas/lanes/groups, and host-controlled `allowStructuralChanges`. They do not read `options.editing.allowStructuralChanges`. Standalone `commitPreview(preview, options)` consumes a helper preview; it does not commit to a Chart or manage its revision/history. Do not substitute these helpers for the instance transaction boundary.

For Board commands, use `validateBoardCommand(command)` with one argument, then `board.previewEdit(command)` / `board.applyEdit(command, options)`. Operations use `op`, not `type`; `boardCapabilities` is an object, not a function. See the executable [Flow example](diagram-scenario.md#incremental-flow-building) and [Board example](canvas-scenario.md#incremental-agent-construction).

Structural permission belongs to the host: explicitly set `editing.enabled` and `editing.allowStructuralChanges` in the instance Spec, re-preview and confirm. Never place authorization flags in generated commands or automatically enable permissions in response to a diagnostic.

## Command Rules

- The command version is currently `1.0`.
- Targets use stable `id` values; array positions are not business identities.
- Command validation does not mutate the input command or source data.
- Host confirmation is required by default; `confirmed: true` is not an authorization system.
- External persistence, permissions, and authentication belong to the host application.
- Pointer navigation and editing are disabled by default. `editing.enabled` authorizes edit transactions; `interaction.drag`, `interaction.edgeDrag`, and `interaction.portConnect` separately expose direct-manipulation UI.
- Diagram edge routes use JSON-safe `routing`, `routingMode`, `waypoints`, and `lineStyle` fields and update through `updateEdge`; invalid waypoints that cross any visible node shape are not committed and fall back to automatic routing. Edge deletion uses `removeEdge` and requires structural-edit permission.

## Supported Models

- `project-task`
- `timeline-event`
- `milestone`
- `burndown-sample`
- `flow-node`
- `flow-edge`
- `swimlane`
- `architecture-node`
- `architecture-edge`
- `mindmap-edge`
- `mindmap-node`

## History and Revision

Spec/data mutations use the same atomic boundary as edits. Catch `ChartValidationError` for invalid `update()`, `setData()`, `setTheme()`, or preference input; the failed call emits no committed change and does not advance the revision.

Successful commits produce a ChangeSet, audit information, a revision, and an undo history entry. A preview based on an old revision must fail on commit with `STALE_PREVIEW`.

## Implementation Map

- Schema: `src/schema.mjs`
- Commands: `src/command.mjs`
- Preview/commit: `src/edit.mjs`
- Transaction lifecycle: `src/edit-controller.mjs`
- History: `src/history.mjs`
- Tests: `tests/core.test.mjs`

## Acceptance

- Invalid commands do not modify data.
- Preview and commit commands must match.
- Confirmation, revisions, audit records, and undo/redo are verifiable.
