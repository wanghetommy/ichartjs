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

const result = chart.applyEdit(preview.command, {
  preview,
  confirmed: true,
  source: 'agent'
});
```

This preserves validation, revision checks, ChangeSet information, history, and undo/redo. Never mutate business rows directly when a typed edit operation exists.

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
