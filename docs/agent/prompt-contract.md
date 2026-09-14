# Agent Prompt Contract

When generating a chart, an Agent must:

1. Inspect the input data.
2. Identify dimensions and measures.
3. Match the chart type to the user intent.
4. Generate a JSON-serializable Chart Spec.
5. Validate the Spec before rendering.
6. Report missing or invalid values.
7. Use `describe()` after rendering.
8. Treat derived insights as calculations, not source facts.
9. Preserve the user's data and avoid mutating input rows.
10. Prefer an accessible renderer and non-color encodings when requested.
