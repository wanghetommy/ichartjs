# Runtime Contract

Shared iChart.js 2.0 Runtime rules used by all three scenarios.

## Standard Flow

```text
getCapabilities → inspectData → planChart → create Spec → validateSpec → createChart → explain and inspect state
```

Agents should use `getCapabilities()` first instead of hard-coding undeclared types or operations.

Iteration 8 adds per-chart profiles through `getChartCapability(type)`. Each profile declares required data roles, supported interactions, renderers, feature status, exports, and practical limits. Unsupported behavior must be handled from this profile or from validation diagnostics rather than guessed.

`planChart(data, { intent, renderer })` returns a versioned planning result with a primary chart, alternatives, confidence, reasons, required fields, suggested encodings, assumptions, warnings, unsupported requests, safe next actions, and the selected capability profile. Planning never invents business meaning, units, dates, or missing fields.

## Spec Rules

- Specs must be JSON-serializable.
- Call `validateSpec()` before rendering.
- Chart layout and data semantics are renderer-independent.
- `flow` and `swimlane` use `nodes/edges/lanes`; generic charts use `data.values`.

## Renderer

- Use `svg` for DOM-level interaction, accessibility, and Diagram editing.
- Use `canvas` for many marks and lower DOM overhead.

## Branding (Signature)

iChart.js ships with a low-contrast brand signature (`Powered by iChart.js`) in the bottom-right corner of every chart by default.

### Configuration

Control via the `branding` field on Spec or Theme:
- `branding: true` (default): signature enabled.
- `branding: false`: signature disabled.
- `branding: { enabled: true }`: explicit object form for fine-grained control.

### Consistency Guarantee

The on/off decision is resolved once inside `buildScene()` via a single gate, so these four surfaces are always synchronized:
1. Browser Canvas / SVG live rendering.
2. `chart.export({ type:'png|jpeg' })` raster output.
3. `chart.export({ type:'svg' })` vector output.
4. `chart.export({ type:'json' })` persisted `spec.branding` + `state`.

When `branding:false`, no signature text appears on the chart or any exported artifact, and the extra bottom padding is not reserved.

## Exports and Downloads

iChart.js exports use a **dual-engine single-source architecture**. Every artifact shares the same Scene Graph produced by `buildScene()`, and the on-screen renderer is fully decoupled from the export backend:
1. **PNG / JPEG (raster)**: always drawn by a `CanvasRenderer` replaying the shared Scene Graph. Browser export is synchronous; Node headless export uses `exportAsync()` with the optional `canvas` npm package.
2. **SVG (vector)**: serialized from an `SVGRenderer` DOM tree (browser) or assembled as a pure string with zero dependencies (headless). Includes XML 1.0 header, expanded font properties, and accessibility attributes.
3. **JSON (reconstructable)**: serializes the current `spec` plus `getState()`, used for persistence, agent self-check, and cross-environment rebuild.

### Branding Consistency

The signature gate inside `buildScene()` guarantees that live rendering, SVG export, PNG export, and JSON state are 100% aligned.

### Headless Support Matrix

| Type        | Browser (any renderer) | Node headless, zero deps | Node headless + `canvas` dep |
|-------------|------------------------|--------------------------|------------------------------|
| JSON        | ✅                      | ✅                        | ✅                            |
| SVG         | ✅                      | ✅                        | ✅                            |
| PNG / JPEG  | ✅ true raster, sync    | ❌ structured `HEADLESS_EXPORT_UNSUPPORTED` | ✅ via `exportAsync()` |

### Public Export APIs

- `chart.toDataURL(type='image/png')` → data URL string or structured ExportError.
- `chart.toBlob(type='image/png')` → Blob or ExportError (headless returns `BLOB_HEADLESS`).
- `chart.export({ type, as })` → sync string / JSON object / Blob / ExportError. `as` accepts `string`, `dataurl`, `blob`, `object` (JSON only).
- `chart.exportAsync({ type, as })` → Promise export path; enables optional Node `canvas` raster output.
- `chart.download({ type })` / `downloadPNG()` / `downloadSVG()` / `downloadJSON()` → triggers a browser save-as. In headless, falls back to returning the raw string or structured error.

### Structured Error Shape

All export/download methods return a stable `{ valid:false, code, message?, suggestion?, rasterCode? }` object on failure for reliable agent automation. Common `code` values:
- `HEADLESS_EXPORT_UNSUPPORTED`: synchronous raster export in headless, or raster export without a usable canvas adapter.
- `BLOB_HEADLESS`: synchronous `toBlob` or headless SVG `as=blob` has no mounted/browser serialization surface; use `exportAsync()` for Node raster or `as=dataurl`/`as=string`.
- `DOWNLOAD_HEADLESS`: `chart.download*()` in headless; use `chart.export()` instead.
- `EXPORT_TYPE_UNSUPPORTED`: unrecognized export type.

## Common APIs

```text
inspectData(data)
normalizeData(data)
recommend(data, options)
planChart(data, options)
validateSpec(spec)
createChart(spec)
getCapabilities()
getChartCapability(type)
chart.describe()
chart.explain()
chart.getState()
chart.getSelectedData()
chart.export(options)
chart.exportAsync(options)
chart.toDataURL(type)
chart.toBlob(type)
chart.download(options)
chart.downloadPNG()
chart.downloadSVG()
chart.downloadJSON()
```

Validation results contain separate `errors`, `warnings`, and `normalizations`. Diagnostics use stable codes, JSON-oriented paths, expected values where useful, and actionable suggestions. `chart.explain()` returns encodings, transforms, interactions, assumptions, warnings, stable record lineage, and an accessibility summary.

## Interaction

Common interactions include Tooltip, Hover, Click, Selection, Zoom, Pan, Drag, Touch, and Keyboard; each chart's enabled interactions are controlled by its Spec and capability declaration.

## Implementation Map

- Public runtime: `src/index.mjs`
- Spec: `src/spec.mjs`
- Scene: `src/scene.mjs`
- Renderers: `src/renderer.mjs`
- Charts: `src/charts.mjs`
- Capabilities: `src/capabilities.mjs`
- Plugins: `src/plugin.mjs`
- Scales: `src/scale.mjs`

## Acceptance

- The Gallery covers every `getCapabilities().chartTypes` entry.
- Canvas and SVG use the same Scene data structure.
- Invalid Specs return structured errors with `code`, `path`, `message`, and `suggestion`.
- Branding visibility is 100% synchronized between on-screen rendering and every export format (PNG/SVG/JSON).
