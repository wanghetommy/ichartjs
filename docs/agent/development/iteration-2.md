# Iteration 2 Capabilities

The beta runtime adds category, time, and log scale primitives; data transforms; selection and zoom state APIs; themes; accessibility metadata; plugins; responsive resize; and scatter, funnel, and gauge chart types.

Multi-series encodings may use `encoding.y` as an array. The second encoding is mapped to the right axis, for example `{ field: 'margin', axis: 'right' }`. Temporal x encodings use `type: 'temporal'` and generate adaptive year, month, or day labels.

Use `getCapabilities()` before generating a Spec. Use `inspectData()` before choosing fields. Use `chart.describe()` and `chart.getState()` after rendering to verify the result.

The browser validation page is `playground/iteration-2.html`. It must be served over HTTP because it imports the ESM runtime.
