# Conversational Workflow

iChart.js does not parse natural-language requests inside the runtime. The host Agent, such as Codex or WorkBuddy, maps the user's request to the public JavaScript contract. The runtime then validates, applies, renders, explains, and exports the result.

## Safe Request Loop

Use this loop for every conversational change:

```text
read current state
  -> classify the request
  -> build a structured change
  -> validate or preview
  -> confirm destructive changes
  -> commit
  -> explain and inspect state
  -> return preview or export artifacts
```

Read `getCapabilities()`, `chart.getSpec()`, `chart.getState()`, and `chart.getPreferences()` before changing an existing chart. Preserve the user's original wording separately from the structured change. Do not pass natural-language prose directly as `planChart().intent`; map it to a registered intent token first.

## Request Routing

| User request | Runtime operation | Confirmation |
| --- | --- | --- |
| Change theme, palette, font size, legend, labels, or grid | `setTheme()` or `setPreferences()` | No, unless the host policy requires it |
| Replace all rows | `setData()` | Usually no; host decides |
| Change a task, milestone, node, edge, or project record | `previewEdit()` then `applyEdit()` | Yes for bulk, delete, or structural changes |
| Change chart type, field mapping, axes, title, labels, or layout | `update()` | No, unless it changes the product contract |
| Change one exact JSON path | `applyPatch()` | Prefer `update()` first |
| Export a result | `export()`, `downloadSVG()`, or `downloadPNG()` | No |

## Visual Change

Use the allowlisted preference contract instead of inventing CSS or theme tokens:

```js
const capabilities = getPreferenceCapabilities(chart.getSpec().type, { locale: 'en' });
const patch = {
  theme: { mode: 'dark', palette: 'status' },
  typography: { scale: 1.15 },
  components: { grid: false }
};
const checked = validatePreferences(patch, { partial: true });
if (!checked.valid) throw new Error(JSON.stringify(checked.errors));
chart.setPreferences(checked.value, { source: 'agent' });

const state = chart.getState();
console.log(state.preferences, state.preferenceResolution, state.style);
```

Use `scope: 'global'` when the request applies to every chart sharing a `PreferencesStore`. Use the default chart scope for one chart.

## Data and Business Change

Use `setData()` only when replacing the chart's complete row set:

```js
chart.setData(nextRows);
```

For a semantic business change, preview a typed edit and commit the exact preview:

```js
const preview = chart.previewEdit({
  type: 'data-edit',
  operations: [{ op: 'updateProgress', taskId: 'task-2', progress: 80 }]
});
if (!preview.valid) return preview.errors;

const approvedByHost = await requestHostApproval(preview);
if (!approvedByHost) return { cancelled: true };

const result = chart.applyEdit(preview.command, {
  preview,
  confirmed: approvedByHost,
  source: 'agent'
});
```

This preserves validation, revision checks, ChangeSet information, history, and undo/redo. Never mutate business rows directly when a typed edit operation exists.
`requestHostApproval()` is supplied by the host, not an iChart.js API. A declined or stale preview must not be committed.

## Spec Change

Use `update()` for normal configuration changes:

```js
chart.update({
  title: { text: 'Monthly revenue' },
  yAxis: { title: 'Revenue', nice: true },
  labels: { enabled: true }
});
```

Use `applyPatch()` only when the Agent must address a known JSON path. Validate the result and inspect diagnostics after either operation.

## Required Self-check

After a committed change, inspect:

```js
const explanation = chart.explain();
const state = chart.getState();

return {
  revision: state.revision,
  health: state.health,
  warnings: state.warnings,
  assumptions: state.assumptions,
  style: state.style,
  preferenceResolution: state.preferenceResolution,
  lineage: explanation.lineage
};
```

Report `UNKNOWN_INTENT`, `LABELS_SUPPRESSED`, `LABEL_TRUNCATED`, `FUNNEL_LABEL_TRUNCATED`, `VALUE_CLAMPED`, `NEGATIVE_VALUE_DROPPED`, `ZERO_TOTAL`, and unsupported-request diagnostics rather than hiding them.

## Agent-driven Incremental Construction

This is visible, multi-turn construction using **complete semantic batches**, not token streaming, live-data feeds, incomplete JSON rendering, or incremental-rendering optimization. Use it when the user wants to review a process as it grows, compose a Board in phases, or safely adjust an existing work. Prefer one validated render for a simple one-off chart or unattended report.

### Host prerequisites and responsibilities

Keep one mounted JavaScript instance and an accessible preview URL. The Agent needs a host-provided channel to read its current Spec/state and submit structured commands to that same instance. A Skill, final HTML file, or PNG alone does not provide live construction. If no live host exists, explain that limitation and deliver code, JSON and final artifacts instead; do not claim the user saw intermediate steps.

The host supplies natural-language understanding, step titles/status, command transport, permissions, confirmation UI and persistence. iChart.js supplies validation, layout, rendering, revision guards, atomic commits and undo/redo. Use the host's existing integration; no new CLI, MCP or HTTP service is required by the component. A proposed preview is separate from the committed surface; never silently replace the latter.

### Shared turn contract

1. Read the current Spec, state/revision and matching capability contract; retain stable IDs and user edits.
2. Plan one meaningful step with an explicit change summary. Compile a complete typed batch, not individual model tokens.
3. Validate and call `previewEdit()`. Display the separate visual preview, affected IDs, layout and all errors/warnings. Invalid batches stop here without changing history.
4. Obtain explicit host approval for that exact preview. **Cancel** discards it without committing. Never treat the Agent's generated `confirmed: true` as user authorization.
5. Call `applyEdit(preview.command, { preview, confirmed: true })` only after approval. If revision changed, discard the stale preview and preview again; do not silently retry against new state.
6. Inspect `getState()` and `explain()`; report revision, diagnostics and the committed step. Keep one successful batch as one Undo entry. Repeat from current state for another turn.
7. Review the final task separately: requested steps, labels, relationships, layout, assets and warnings. `health.renderable` is not proof of task completion. Save JSON and export SVG/PNG with exact paths/preview URL; history is not persisted in the Spec.

| Construction | Discovery and commands | Layout and readiness |
| --- | --- | --- |
| Flow | Root entry; `getChartContract('flow').incrementalBuilding`, `validateCommand()`, node/edge edits | Explicit `layered` mode recomputes unpositioned nodes; preserve manual positions and waypoints. Inspect `preview.layout` and `getState().layout.diagram`. |
| Freeform Board | Root or `/board`; `canvasComposition.incrementalBuilding` or `boardCapabilities.incrementalBuilding`, `validateBoardCommand()`, `type: 'board-edit'` | Preserve composition and locked items; move/resize only when requested. Await `ready()` and inspect image status/health; settled assets are not necessarily successful loads. |

Use the [Flow contract and recipe](diagram-scenario.md#incremental-flow-building) or [Board contract and recipe](canvas-scenario.md#incremental-agent-construction); the command schemas are not interchangeable. Repeated full `update()` replacements are not a construction history. Keep zoom, pan, drag and animations opt-in; building does not require enabling them.

The existing Playground pages demonstrate a **manual host**, not an embedded language model:

- Flow: `http://localhost:3000/playground/diagram-editor.html?scenario=incremental`
- Board: `http://localhost:3000/playground/canvas-board.html?scenario=incremental`
- These URLs and the bare pages open a four-step example with Next, Previous step and Restart. Next authorizes the displayed preset instruction and runs validated preview/confirmed commit internally; no prompt parser is included. Developer tools are collapsed by default. Use `?scenario=advanced` instead for Start → Preview command → Confirm and apply, Cancel preview, Undo/Redo and Review delivery before Save/Reload/export. Add `&renderer=canvas` for Canvas. The advanced Flow removal template deliberately leaves a branch warning; example/template completion does not complete a business task.

Construction prompt:

```text
Use iChart.js Agent-driven Incremental Construction to build <Flow or Board task>.
Keep the preview page visible and reuse the same runtime instance. First show a short
step plan. For each complete step, read current state, preview a typed batch and show
changes/warnings; wait for host approval before committing. Preserve manual positions
and locked content. Support cancellation and undo. At the end, check my requirements,
report unresolved issues, and return the preview URL, JSON and SVG/PNG artifacts.
If the host cannot update a live preview, explain this before offering final artifacts.
```

## Prompt Template

The following prompt is suitable for Codex or WorkBuddy:

```text
Use the iChart.js Skill. Read the current Spec, state, preferences, and capabilities first.
Classify my request as visual style, complete data replacement, business record edit,
Spec configuration, diagram edit, or export.

Use setPreferences/setTheme for visual changes, setData for complete replacement,
previewEdit/applyEdit for business or diagram edits, update for normal Spec changes,
and applyPatch only for a precise JSON path. Validate or preview before committing.
Ask for confirmation before deletion, bulk edits, or structural changes. After applying,
run chart.explain() and chart.getState(), then return the changed values, warnings,
assumptions, lineage, preview URL, and artifact paths.

Request: <describe the desired change>
```

The host remains responsible for authentication, permissions, persistence, confirmation UI, and the natural-language model. iChart.js remains the validated JavaScript runtime and does not require a CLI, MCP server, or HTTP service for this workflow.
