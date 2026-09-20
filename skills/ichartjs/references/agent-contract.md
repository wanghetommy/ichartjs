# Agent Contract

## Required sequence

```text
getCapabilities → inspectData → planChart → build Spec → validateSpec → createChart → explain/getState/export → destroy
```

## Public APIs

- `getCapabilities()`: global and per-chart discoverability.
- `getChartCapability(type)`: required roles, interactions, renderers, features, exports, and limits.
- `inspectData(input)`: field roles, identifiers, cardinality, missingness, temporal coverage, and warnings.
- `planChart(input, options)`: primary type, alternatives, confidence, reasons, required fields, suggested encodings, assumptions, warnings, unsupported requests, next actions, and `intentKnown`/`intentSuggestions`/`fallbackUsed` metadata.
- `validateSpec(spec)`: errors, warnings, normalizations, and normalized Spec.
- `createChart(spec)`: headless or mounted chart lifecycle.
- `chart.explain()`: semantics, encodings, interactions, lineage, warnings, and accessibility summary.
- `chart.getState()`: renderer, dimensions, warnings, assumptions, selection, view, project analytics, linked state, and `health`.
- `chart.export({ type: 'json' })`: JSON-safe Spec and state.

## Stop conditions

Do not render when:

- `plan.requiredFields` is non-empty;
- `validateSpec().valid` is false;
- chart-specific encoding channels are unsupported or reference missing fields;
- a Gauge has no explicit `domain`;
- the requested chart, renderer, interaction, or export is not declared;
- required project dates, diagram endpoints, ports, lanes, or business schema rules are invalid.

## Self-check

Verify that:

- the chosen type exists in `getCapabilities().chartTypes`;
- validation passed without ignored errors;
- explanation lineage preserves stable source IDs;
- warnings and assumptions are visible in the response;
- `health.renderable` is true and `health.status` is reported; `VALUE_CLAMPED`, `LABELS_SUPPRESSED`, and `ZERO_TOTAL` are not hidden;
- the preview uses a maintained URL;
- replaced charts are destroyed.
