# Runtime Contract

Shared iChart.js 2.0 Runtime rules used by all three scenarios.

[Chart Text and Annotations](text-annotations.md) defines fitting, line breaks, reference lines and record-ID callouts. Discover root `getCapabilities().text` / `.annotations`; persist data-linked annotations in `ChartSpec.annotations`, not installed pixel-line plugins.

## Standard Flow

Mounting/lifecycle rules are in [Frontend Integration](frontend-integration.md#component-lifecycle). An Element container is a non-serializable host binding, not persisted chart data; selector strings remain portable. Missing requested targets throw. Destroy removes runtime-owned surfaces but keeps caller-owned SVG/Canvas elements. Root plugins are installed from host callbacks, not JSON-normalized function copies.

```text
getCapabilities → inspectData → planChart → create Spec → validateSpec → createChart → explain and inspect state
```

Agents should use `getCapabilities()` first instead of hard-coding undeclared types or operations.

For post-creation visual settings, use `getPreferenceCapabilities(chartType, { locale }) → chart.getPreferences() → validatePreferences(patch) → chart.setPreferences(patch, { source: 'agent' }) → chart.getState().preferences`. This keeps Agent changes on the same allowlisted contract as the built-in settings menu.

The effective preference precedence is `defaults → chart Spec → global PreferencesStore → chart PreferencesStore`. Use `chart.getState().preferenceResolution` to inspect the active scopes, storage mode, and source metadata. The runtime does not parse natural-language prose; use the [Conversational Workflow](conversational-workflow.md) to route prose to the correct mutation API.

Iteration 8 adds per-chart profiles through `getChartCapability(type)`. Iteration 20 adds `getChartContract(type)`, which packages the same profile with the field-channel contract, semantic notes, safe defaults, and discovery links needed to construct a Spec without reading source code. Each contract declares required data roles, supported interactions, renderers, feature status, exports, and practical limits. Unsupported behavior must be handled from this contract or from validation diagnostics rather than guessed.

The focused `/standard`, `/project`, and `/diagram` chart entries keep their declared chart families on both creation and update. A profile update that names a chart outside that family is rejected with `PROFILE_TYPE_UNSUPPORTED`; use the matching entry instead. The `/board` entry uses BoardSpec, not ChartSpec. Theme-derived chart colors, background, and padding refresh unless the host explicitly supplied them. Failed Profile validation, scene construction or rendering preserves the previous Spec, diagnostics and style overrides; subsequent theme changes remain usable. Mounted failures restore the previous surface where the host DOM remains available.

`planChart(data, { intent, renderer })` returns a versioned planning result with a primary chart, alternatives, confidence, reasons, required fields, suggested encodings, assumptions, warnings, unsupported requests, safe next actions, and the selected capability profile. `intent` must be one exact token from `getCapabilities().intents`; natural-language prose must be mapped before planning. An unknown token returns `UNKNOWN_INTENT` and a fallback plan, so Agents must inspect warnings before accepting `primary`. Planning never invents business meaning, units, dates, or missing fields.

Unknown intent results also include `intentKnown`, `intentSuggestions`, and `fallbackUsed`. A chart Spec is chart-specific: Cartesian channels are `x`/`y`, Pie/Funnel channels are `category`/`value`, Gauge uses `value`, Heatmap channels are `x`/`y`/`color`, and Radar fields live in `indicators`. `validateSpec()` rejects unsupported channels and missing fields. Gauge requires an explicit `domain` and reports `VALUE_CLAMPED` when the rendered value exceeds it. Pie reports `NEGATIVE_VALUE_DROPPED` for negative input values; `ZERO_TOTAL` is a validation error because no positive share can render.

## Spec Rules

Incremental Flow edits reuse `previewEdit()` / `applyEdit()` with `addNode`, `removeNode`, and existing node/edge commands. Discover `getChartContract('flow').incrementalBuilding`; preview layout is `preview.layout`, committed layout is `getState().layout.diagram` / `explain().layout.diagram`. Layout coordinates exclude view transforms. Structural confirmation remains mandatory; see the [Diagram Scenario](diagram-scenario.md#incremental-flow-building) for removal policy, automatic reflow, and save/reload boundaries.

- Specs must be JSON-serializable.
- Call `validateSpec()` before rendering.
- Use quantitative fields for both Scatter coordinates; Gantt dependencies belong on `data.values[].dependencies` and chart dimensions use top-level `width`/`height`.
- Chart layout and data semantics are renderer-independent.
- Keep axis titles/formats on `xAxis`/`yAxis`, labels on `labels`, and legend settings on `legend`; misplaced options return structured warnings.
- Numeric y-axes use readable domains by default (`yAxis.nice: true`, `yAxis.ticks: "auto"`). Use `yAxis.domain: [min, max]` for an explicit range, `yAxis.nice: false` to retain the raw boundary, and `yAxis.right` for a secondary numeric axis. `chart.getState().axes` and `chart.explain().axes` expose the raw domain, resolved domain, ticks, step, and policy for Agent verification. `xAxis.min/max` and `xAxis.domain` remain unsupported for categorical/time layouts. Chart-specific domains remain available through `gauge.domain`, `heatmap.colorScale.domain`, and `radar.indicators[].min/max`.
- Timeline and Milestone expose `chart.getState().timeAxis` and `chart.explain().timeAxis` with `orientation: "horizontal"`, `field: "date"`, `coordinate: "x"`, `rowCoordinate: "y"`, numeric `domain`, and ISO `domainISO`. Validate event dates against `x`/`cx`; y/`cy` is the row layout coordinate.
- Diagram structure is always top-level: `flow` and `swimlane` use `nodes/edges/lanes`; `architecture` uses `nodes/edges/layers/boundaries`; `mindmap` uses `nodes` with `parentId` and optional `edges`. Do not put these fields under `data`; generic charts use `data.values`.
- `chart.getState().health` and `chart.explain().health` expose `ready`, `degraded`, or `empty`, with renderability and warning, suppressed-label, clamped-value, and rendered-mark metrics. `locale` defaults to `en-US`; set `locale: "zh-CN"` for output formatting and keep input dates as ISO-8601 strings.

## Renderer

- Use `svg` for DOM-level interaction, accessibility, and Diagram editing.
- Use `canvas` for many marks and lower DOM overhead.
- With `renderer: "auto"`, root charts choose at creation: SVG for small or text/structure-heavy scenes, Canvas for large scenes. Ordinary root data updates retain this choice. Host-requested `chart.update({ renderer: "svg" | "canvas" | "auto" })` switches or re-evaluates it atomically. Focused chart Profiles re-evaluate `auto` on updates using current data and accessibility; Board already re-evaluates its item-based policy. Explicit `svg` or `canvas` always wins; continuous interaction alone does not force Canvas. Inspect `getState().rendererSelection` for requested/effective renderer and reasons. Successful switching disposes the previous renderer and event bindings; failure preserves the previous state and mounted surface. Switching does not change viewport or navigation/editing permissions.

## Branding (Signature)

iChart.js ships with a low-contrast brand signature (`Powered by iChart.js`) in the bottom-right corner of every chart by default.

### Configuration

Control via the `branding` field on Spec or Theme:
- `branding: true` (default): signature enabled.
- `branding: false`: signature disabled.
- `branding: { enabled: true }`: explicit object form for fine-grained control.

### Consistency Guarantee

The shared scene applies branding once to display, SVG, raster and JSON state. `branding:false` removes the signature and its extra bottom padding.

## Freeform Board transactions

Both root and `/board` expose `validateBoardCommand()` and Board `previewEdit(command)` / `applyEdit(command, {preview, confirmed:true, expectedRevision?})` for `type: board-edit`. Successful semantic batches produce one revision/history entry; stale, invalid or unconfirmed commands do not publish. Preview results include `spec`, board-space `layout`, affected item/asset IDs, errors and warnings. Agent commands honor opt-in editing/structural permissions and locked items; existing direct Board APIs are trusted host operations.

Board `getState()` exposes `revision`, `lastChange`, `layout.items/text`, `assetsReady` and per-asset status. `subscribe(listener)` returns an unsubscribe function and emits `edit`, `history` and `assets`; asset readiness does not advance revision. `ready()` loads current images, and JSON stores the BoardSpec, not history or decoded images. Existing Board positions are not automatically rearranged. See [Freeform Board Scenario](canvas-scenario.md).

## Exports and Downloads

All entries provide `export({type,as})`. Exact types: `svg`, `json`, `png`, `jpeg`/`jpg` or corresponding MIME (case-insensitive). Unknown formats return `EXPORT_TYPE_UNSUPPORTED`, never a substitute. Discover `getCapabilities().export.delivery` or `boardCapabilities.export.delivery`.

| Type | Supported as | Default |
| --- | --- | --- |
| SVG | string, dataurl, blob | string |
| JSON | string, object, dataurl, blob | Chart string; Board object |
| PNG/JPEG | dataurl, string, blob | dataurl; string is an alias |

Root defaults to PNG for Canvas display, SVG otherwise; Profiles/Board default SVG. JSON shapes remain root `{version,spec,state}`, Profile `{spec,state}`, Board bare Spec. Objects are detached JSON-safe copies. Reconstruct Charts from `payload.spec`, Board from the whole payload.

### Browser and Headless

SVG/JSON are zero-dependency. Browser PNG/JPEG replays the scene on detached Canvas, independent of display renderer or mounting. Pixels equal Spec width/height, not screen DPR. PNG preserves transparency; JPEG uses white matte. Display, selection/history and branding are preserved; diagram editing handles are excluded.

For visible Board images, `await board.ready()` and inspect asset health; pending/failed images reject raster export. Hidden/unused assets do not block it. SVG links images rather than embedding them. The host must prepare fonts/resources; export does not package them.

Node raster is root Chart `exportAsync()` only, with optional `canvas`. Profiles/Board use SVG/JSON. Sync raster without a browser returns `HEADLESS_EXPORT_UNSUPPORTED`. SVG Blob requires a browser; JSON Blob uses the runtime Blob implementation.

### Public Export APIs

Root Chart additionally provides `toDataURL(type='image/png')`, browser `toBlob(type)`, `download({type})`, `downloadPNG()`, `downloadSVG()`, `downloadJSON()`. Headless downloads return SVG/JSON strings or `DOWNLOAD_HEADLESS`. Profiles/Board only provide `export()`.

### Structured Error Shape

Check `{valid:false,code,message,suggestion}` before saving. Codes include `EXPORT_TYPE_UNSUPPORTED`, `HEADLESS_EXPORT_UNSUPPORTED`, `BLOB_HEADLESS`, `EXPORT_CONTEXT_UNAVAILABLE`, `EXPORT_ASSET_UNAVAILABLE`, `EXPORT_TAINTED_CANVAS`, `EXPORT_DESTROYED`, `EXPORT_FAILED`. Failures preserve live state; repair context/assets and retry or explicitly deliver SVG. The library cannot bypass browser origin policy.

## Common APIs

State-changing calls use one validation boundary. `update()` and `setData()` return the chart when committed; invalid input throws `ChartValidationError` with stable `code`, `details`, `path`, `expected`, `received`, and `suggestion` fields. The previous Spec, Scene, selection, revision, and history remain unchanged after a rejected mutation. `applyPatch()` is an advanced JSON-pointer API and is validated before commit.

`chart.applyPatch(patches)` supports only `add`, `replace` and `remove`, not a complete JSON Patch engine. Paths address existing own-property parents; `~1` and `~0` escape `/` and `~`. Values must be finite, acyclic JSON; add/replace require `value`. Object add sets a property; replace/remove require an existing property. For arrays, add inserts at an index from 0 through length, or appends with `-`; replace/remove require an existing index. Removal shifts subsequent entries. Non-canonical indices, invalid escapes, inherited/unsafe paths and missing targets are rejected, never silently ignored. Each operation sees the preceding operation's candidate result; the final Spec is validated once and the entire batch commits or rolls back. Empty batches are no-ops.

Like `update()`, Patch is a trusted-host mutation and successful changes invalidate edit history/pending previews; it does not provide Agent authorization or an Undo transaction. Prefer stable-ID `previewEdit()` / `applyEdit()` for Agent incremental construction. Do not use Patch or direct `chart.spec` writes to bypass edit permissions or confirmation.

```text
inspectData(data)
normalizeData(data)
recommend(data, options)
planChart(data, options)
validateSpec(spec)
createChart(spec)
getCapabilities()
getChartCapability(type)
getChartContract(type)
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

Validation results contain separate `errors`, `warnings`, and `normalizations`. Diagnostics use stable codes, JSON-oriented paths, expected values where useful, and actionable suggestions. Unknown top-level options return `UNKNOWN_SPEC_OPTION` instead of being silently treated as valid configuration. `chart.explain()` returns encodings, transforms, interactions, effective options, normalizations, assumptions, warnings, stable record lineage, and an accessibility summary.

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
