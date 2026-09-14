# Runtime Contract

Shared iChart.js 2.0 Runtime rules used by all three scenarios.

## Standard Flow

```text
inspectData → recommend → create Spec → validateSpec → createChart → inspect state
```

Agents should use `getCapabilities()` first instead of hard-coding undeclared types or operations.

## Spec Rules

- Specs must be JSON-serializable.
- Call `validateSpec()` before rendering.
- Chart layout and data semantics are renderer-independent.
- `flow` and `swimlane` use `nodes/edges/lanes`; generic charts use `data.values`.

## Renderer

- Use `svg` for DOM-level interaction, accessibility, and Diagram editing.
- Use `canvas` for many marks and lower DOM overhead.
- Headless mode supports JSON export; PNG/SVG string export requires a mounted renderer.

## Common APIs

```text
inspectData(data)
normalizeData(data)
recommend(data, options)
validateSpec(spec)
createChart(spec)
getCapabilities()
chart.describe()
chart.getState()
chart.getSelectedData()
chart.export(options)
```

## Interaction

Common interactions include Tooltip, Hover, Click, Selection, Zoom, Pan, Drag, Touch, and Keyboard; each chart's enabled interactions are controlled by its Spec and capability declaration.

## Implementation Map

- Public runtime: `src/index.mjs`
- Spec: `src/spec.mjs`
- Scene: `src/scene.mjs`
- Renderers: `src/renderer.mjs`
- Plugins: `src/plugin.mjs`
- Scales: `src/scale.mjs`

## Acceptance

- The Gallery covers every `getCapabilities().chartTypes` entry.
- Canvas and SVG use the same Scene data structure.
- Invalid Specs return structured errors with `code`, `path`, `message`, and `suggestion`.
