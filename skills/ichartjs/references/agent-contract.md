# Agent Contract

## Task-specific sequence

```text
New chart: capabilities/contract → optional tabular inspect/plan → Spec → validate → create → inspect → visual acceptance → deliver
Existing chart: inspect current state → supported change/preview → commit as authorized → inspect affected output
Board: board contract → validateBoardSpec → createBoard → ready → inspect → deliver
```

Plan only when selecting a type. Follow scenario confirmation rules for incremental construction; keep delivered live instances mounted.

## Public APIs

- Discovery: `getCapabilities()`, `getChartContract(type)`, `getChartCapability(type)`.
- Selection: `inspectData(input)`, `planChart(input, options)`; inspect `requiredFields`, `intentKnown`, `intentSuggestions`, `fallbackUsed`, warnings and suggested encodings.
- Creation: `validateSpec(spec)` returns errors, warnings, normalizations and Spec; `createChart(spec)` mounts or renders headlessly.
- Inspection: `chart.explain()` / `getState()` expose health, semantics, lineage, layout and diagnostics; `chart.export({ type: 'json' })` preserves Spec/state.

## Stop conditions

Stop for missing required fields, invalid Spec/encodings, missing Gauge domain, unsupported requested capabilities, or invalid dates, endpoints, ports, lanes and business structure.

## Self-check

Verify declared type, valid Spec, preserved source IDs, renderable health/status, actual output URL/path and lifecycle cleanup. Report warnings/assumptions, including `VALUE_CLAMPED`, `LABELS_SUPPRESSED`, `NEGATIVE_VALUE_DROPPED` and `ZERO_TOTAL`.

## Acceptance and diagnostics

Invalid inputs/non-renderable output block delivery. Resolve fallback, ignored options and distortion; alternatives need agreement. Review fitting/contrast; disclose accepted decoration/normalization effects. Follow [readability acceptance](readability.md), reporting runtime versus visual checks and unavailable tools. Consumer projects use their own URL, not Playground.

Color-cardinality warnings concern color-coded groups/series, not X-axis point count; they are advisory, not failed validation. For Diagram overflow, inspect `currentSize`, estimated `recommendedSize` and `nodeIds`; host-authorized resizing must be followed by another check, not automatic zoom or node shrinking. For hidden node text, inspect `nodeSize`/`fontSize`: wider charts do not repair fixed node dimensions.

Repair invalid node fields from each diagnostic's `nodeId`, `path`, `expected` and `suggestion`; retain distinct node errors rather than discarding them as duplicates. Use `size: { width, height }`, `position: { x, y }`, array `ports`, or omit optional fields. Read `diagram.layoutModes`; do not invent a `vertical` alias or coerce scalar dimensions.
