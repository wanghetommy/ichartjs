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
- `validateEdit(command)`
- `previewEdit(command)`
- `applyEdit(command, options)`
- `getChangeSet()`
- `undo()` / `redo()`

## Command Rules

- The command version is currently `1.0`.
- Targets use stable `id` values; array positions are not business identities.
- Command validation does not mutate the input command or source data.
- Host confirmation is required by default; `confirmed: true` is not an authorization system.
- External persistence, permissions, and authentication belong to the host application.
- Pointer navigation and editing are disabled by default. `editing.enabled` authorizes edit transactions; `interaction.drag`, `interaction.edgeDrag`, and `interaction.portConnect` separately expose direct-manipulation UI.
- Diagram edge routes use JSON-safe `waypoints` and update through `updateEdge`; edge deletion uses `removeEdge` and requires structural-edit permission.

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
- `mindmap-node`

## History and Revision

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
