# Agent Task Validation

Use task validation when the Agent must deliver a result, not merely produce a Spec.

## Required result

Every task should return:

```js
{
  ok: true,
  chartType: 'line',
  warnings: [],
  assumptions: [],
  health: { renderable: true },
  lineage: { recordIds: ['row-1'], sourcePreserved: true },
  output: { kind: 'svg', value: '<svg ...>' }
}
```

The host Agent supplies `chartType`, `warnings`, and `output` from the runtime. Do not report success only because `validateSpec().valid` is true.

## Safe task loop

```js
const report = inspectData(rows);
const plan = planChart(rows, { intent: 'trend' });
if (plan.requiredFields.length || plan.warnings.some(item => item.severity === 'error')) return plan;

const checked = validateSpec(spec);
if (!checked.valid) return checked;

const chart = createChart(checked.spec);
try {
  const state = chart.getState();
  const explanation = chart.explain();
  if (!state.health.renderable) return { ok: false, health: state.health, warnings: state.warnings };
  return {
    ok: true,
    chartType: explanation.type,
    warnings: state.warnings,
    assumptions: state.assumptions,
    health: state.health,
    lineage: explanation.lineage,
    output: { kind: 'svg', value: chart.export({ type: 'svg' }) }
  };
} finally {
  chart.destroy();
}
```

## Repair policy

- `UNKNOWN_INTENT`, missing required fields, invalid encodings, or invalid diagram structure stop the task before rendering.
- `NEGATIVE_VALUE_DROPPED`, `ZERO_TOTAL`, `VALUE_CLAMPED`, `LABEL_TRUNCATED`, and `LABELS_SUPPRESSED` remain visible in the result.
- A warning may be accepted only when the host explains the impact and the requested output remains fit for purpose.
- Preserve `recordIds` across transforms and edits; do not silently replace missing or duplicate IDs.

## Output choice

| Need | Output |
| --- | --- |
| Browser preview | mounted SVG or Canvas chart |
| Vector delivery | `chart.export({ type: 'svg' })` |
| Machine checkpoint | `chart.export({ type: 'json', as: 'object' })` |
| Browser bitmap | `chart.export({ type: 'png' })` |
| Node/headless | SVG or JSON; PNG requires the optional Canvas adapter |

The executable fixtures in `tests/iteration-21.test.mjs` are the canonical examples for this contract.
