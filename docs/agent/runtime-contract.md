# Runtime Contract

Shared iChart.js 2.0 Runtime rules used by all three scenarios.

## Standard Flow

```text
getCapabilities → inspectData → planChart → create Spec → validateSpec → createChart → explain and inspect state
```

Agents should use `getCapabilities()` first instead of hard-coding undeclared types or operations.

For post-creation visual settings, use `getPreferenceCapabilities(chartType, { locale }) → chart.getPreferences() → validatePreferences(patch) → chart.setPreferences(patch, { source: 'agent' }) → chart.getState().preferences`. This keeps Agent changes on the same allowlisted contract as the built-in settings menu.

Iteration 8 adds per-chart profiles through `getChartCapability(type)`. Each profile declares required data roles, supported interactions, renderers, feature status, exports, and practical limits. Unsupported behavior must be handled from this profile or from validation diagnostics rather than guessed.

`planChart(data, { intent, renderer })` returns a versioned planning result with a primary chart, alternatives, confidence, reasons, required fields, suggested encodings, assumptions, warnings, unsupported requests, safe next actions, and the selected capability profile. `intent` must be one exact token from `getCapabilities().intents`; natural-language prose must be mapped before planning. An unknown token returns `UNKNOWN_INTENT` and a fallback plan, so Agents must inspect warnings before accepting `primary`. Planning never invents business meaning, units, dates, or missing fields.

Unknown intent results also include `intentKnown`, `intentSuggestions`, and `fallbackUsed`. A chart Spec is chart-specific: Cartesian channels are `x`/`y`, Pie/Funnel channels are `category`/`value`, Gauge uses `value`, Heatmap channels are `x`/`y`/`color`, and Radar fields live in `indicators`. `validateSpec()` rejects unsupported channels and missing fields. Gauge requires an explicit `domain` and reports `VALUE_CLAMPED` when the rendered value exceeds it. Pie reports `NEGATIVE_VALUE_DROPPED` for negative input values; `ZERO_TOTAL` is a validation error because no positive share can render.

## Spec Rules

- Specs must be JSON-serializable.
- Call `validateSpec()` before rendering.
- Chart layout and data semantics are renderer-independent.
- Keep axis titles/formats on `xAxis`/`yAxis`, labels on `labels`, and legend settings on `legend`; misplaced options return structured warnings.
- Numeric y-axes use readable domains by default (`yAxis.nice: true`, `yAxis.ticks: "auto"`). Use `yAxis.domain: [min, max]` for an explicit range, `yAxis.nice: false` to retain the raw boundary, and `yAxis.right` for a secondary numeric axis. `chart.getState().axes` and `chart.explain().axes` expose the raw domain, resolved domain, ticks, step, and policy for Agent verification. `xAxis.min/max` and `xAxis.domain` remain unsupported for categorical/time layouts. Chart-specific domains remain available through `gauge.domain`, `heatmap.colorScale.domain`, and `radar.indicators[].min/max`.
- Timeline and Milestone expose `chart.getState().timeAxis` and `chart.explain().timeAxis` with `orientation: "horizontal"`, `field: "date"`, `coordinate: "x"`, `rowCoordinate: "y"`, numeric `domain`, and ISO `domainISO`. Validate event dates against `x`/`cx`; y/`cy` is the row layout coordinate.
- Diagram structure is always top-level: `flow` and `swimlane` use `nodes/edges/lanes`; `architecture` uses `nodes/edges/layers/boundaries`; `mindmap` uses `nodes` with `parentId` and optional `edges`. Do not put these fields under `data`; generic charts use `data.values`.
- `chart.getState().health` and `chart.explain().health` expose `ready`, `degraded`, or `empty`, with renderability and warning, suppressed-label, clamped-value, and rendered-mark metrics. `locale` defaults to `en-US`; set `locale: "zh-CN"` for output formatting and keep input dates as ISO-8601 strings.

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

State-changing calls use one validation boundary. `update()` and `setData()` return the chart when committed; invalid input throws `ChartValidationError` with stable `code`, `details`, `path`, `expected`, `received`, and `suggestion` fields. The previous Spec, Scene, selection, revision, and history remain unchanged after a rejected mutation. `applyPatch()` is an advanced JSON-pointer API and is validated before commit.

```text
inspectData(data)
normalizeData(data)
recommend(data, options)
planChart(data, options)
validateSpec(spec)
createChart(spec)
getCapabilities()
getChartCapability(type)
getPreferenceCapabilities(type, options)
validatePreferences(patch, options)
chart.describe()
chart.explain()
chart.getState()
chart.getState().health
chart.explain().health
chart.getPreferences()
chart.setPreferences(patch, options)
chart.resetPreferences(options)
chart.getSelectedData()
chart.selectEdges(edgeIds, options)
chart.getSelectedEdgeIds()
chart.deleteSelectedEdges(options)
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

For lineage checks and linked updates, provide stable string `id` values on input rows. Without one, the runtime uses deterministic positional IDs such as `record-0`; these are suitable for a local self-check but not for durable business identity.

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
