---
name: ichartjs
description: Create, explain, and safely edit iChart.js charts, diagrams, and Freeform Boards from user data. Use for chart selection, Specs, browser integration, exported artifacts, incremental construction, and visualization diagnostics or readability review.
---

# iChart.js

Use public capabilities and contracts, not renderer internals or invented options. Prioritize semantic correctness, clear structure, readable text, compact composition, then decoration. Validation and `health.renderable` alone do not prove a usable result.

## Setup and Output

The Skill guides an Agent; it is not the JavaScript runtime or a live update channel. It supports Codex, WorkBuddy, and other Agent Skills-compatible hosts.

```bash
npx skills add wanghetommy/ichartjs --skill ichartjs
```

For global non-interactive Codex installation add `--agent codex --global --yes`. For reproducibility use `https://github.com/wanghetommy/ichartjs/tree/v2.0.34/skills/ichartjs`. WorkBuddy can import that directory; do not assume a CLI adapter unless declared by the installed CLI.

Reuse the host's package manager and installed runtime. If missing, install `@taylorwong/ichartjs@^2`, not unscoped `ichartjs`. Installed capabilities override online examples; do not silently upgrade.

Use independent `/standard`, `/project`, `/diagram`, or `/board` for known families; root supplies cross-family discovery and Chart preview/commit/history absent from rendering Profiles. Setup: [Quickstart](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/quickstart.md).

`planChart()`, `getChartContract()` and preference discovery are root APIs, not Profile exports. Run planning/discovery in the Agent's Node workspace or read the packaged manifest/recipes; browser code can still import only its rendering Profile. Profile `getCapabilities()` lacks root `intents`/`charts`. Chart rendering Profiles (`/standard`, `/project`, `/diagram`) use validated `update()`, `resize()`, `setTheme()`, state and exports; do not assume root `setData()`, `setPreferences()`, `getTheme()` or Chart editing methods exist. `/board` uses its own Board capabilities and editing APIs.

| Deliverable | Host and output |
| --- | --- |
| Existing product | Reuse its framework, lifecycle and dev server; return changed files and its actual preview URL. |
| One-off chart/report | Return the requested SVG, PNG/JPEG, JSON or HTML artifact path; no server required for file delivery. |
| iChart.js repository demo | Only here use `npm run playground` and a maintained Playground URL. |
| Visible construction | Requires a persistent mounted host, preview URL and command update channel, not merely a final file. |

For unclear delivery modes read [usage scenarios](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/usage-scenarios.md); ask only consequential questions.

## Choose the Workflow

### New chart or Board

1. Discover `getCapabilities()` and `getChartContract(type)` or Board `canvasComposition`. Honor supported user-selected types. Only for tabular selection use `inspectData()` / `planChart()` with a registered intent; review required fields, fallback, warnings and style recommendation. Missing required fields stop creation. See [chart selection](references/chart-selection.md).
2. Build a JSON-safe Spec. Templates from `@taylorwong/ichartjs/recipes/manifest` require data and validation, not execution; populate `diagrams/workflow` nodes/edges before rendering.
3. Use `validateSpec()` before `createChart()`, or `validateBoardSpec()` before `createBoard()`. Stop on invalid structure or missing required inputs. Inspect normalizations and preflight diagnostics; after rendering inspect `getState()`, `explain()`, health, lineage and layout diagnostics. Await Board `ready()` for images.
4. Apply the diagnostic and visual acceptance rules below, then deliver. Keep mounted instances alive; destroy replaced or temporary instances after export.

### Change an existing visualization

Inspect current Spec, preferences, IDs, locks and revision; preserve meaning, manual layout and unrelated settings.

- Visual changes: discover `getPreferenceCapabilities(type, { locale })`, use `validatePreferences()` and `setPreferences(patch, { source: 'agent' })`; use `setTheme()` for theme switching.
- Complete data replacement: `setData()`; ordinary Spec changes: `update()`; exact JSON paths: `applyPatch()`.
- Business/Diagram edits: instance `validateEdit()` / `previewEdit()` / `applyEdit()`. Exported `validateEdit(command, options)` needs editing context, not a Spec.

Follow the [conversational workflow](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/conversational-workflow.md) for host interpretation, permissions, preview/confirmation and revisions. Verify effective `preferences`, `preferenceResolution`, diagnostics and changed output; do not restart selection.

### Agent-driven Incremental Construction

When requested, follow the conversational turn contract and [Diagram](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/diagram-scenario.md) or [Board](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/canvas-scenario.md) scenario. Without a persistent host/update channel, offer artifacts or integration code, not live progress.

- Flow: discover `getChartContract('flow').incrementalBuilding`; batch node/edge commands into one preview/commit transaction per semantic turn. Repeated `update()` replacements are not a substitute for history. Node removal defaults to rejecting incident edges; explicit `policy: 'cascade'` removes only incident edges.
- Board: discover `boardCapabilities.incrementalBuilding`; `boardCapabilities` is an object. Use `validateBoardCommand(command)` with `type: 'board-edit'` and `operations: [{ op, ... }]`, not Chart commands. Root and `/board` support Board transactions; `/board` embeds standard charts only.
- Explicitly enable required editing permissions in the host Spec, never in commands. Show each exact preview, obtain host approval and commit atomically; preserve revision/history, locks, positions and manual waypoints. Await changed assets and self-check. Agent-generated `confirmed: true`, a step counter or healthy state is not user approval or task completion.

## Type-Specific Contracts

| Type | Important placement |
| --- | --- |
| Cartesian / Scatter | `encoding.x` / `y`; Scatter requires quantitative fields. Axis titles/formats belong under `xAxis` / `yAxis`, not encoding. |
| Pie / Funnel | `encoding.category` / `value`; Funnel category supplies stage text, `labels.enabled` additionally enables values. Preserve stage names when fitting fails. |
| Gauge / Heatmap / Radar | Gauge: `value` and meaningful `domain`; Heatmap: `x` / `y` / `color`; Radar: `indicators[].field` with explicit domains when units differ. |
| Gantt | Row `dependencies`, not top-level or `dependsOn`; preserve stable IDs and calendar assumptions. |
| Diagrams | Top-level `nodes` / `edges` and applicable `lanes` / `layers` / `boundaries`; display text is `label`, endpoints `from` / `to`. Discover Flow node kinds; label decision branches. |
| Freeform Board | Item `position` / `size` are pixels; polygon/path points are normalized within the item box. |

Use chart `width` / `height`, not `size`; `title: { text, subtitle }`, top-level `labels` and `legend`. For text or annotations read [Chart Text and Annotations](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/text-annotations.md); discover `getCapabilities().text` / `.annotations` and preserve annotation IDs.

Board `canvasComposition` declares images, text, shapes, paths, connectors and charts. Use declared geometry, not arbitrary SVG paths. Images reference `assets` by `assetId`; include alt text and inspect asset health / `.layout.text`.

## Style and Readability

Preserve user choices. Discover `styleSystem` or preference capabilities; prefer `theme: { mode: 'auto', preset, palette }`. Palettes follow data semantics, not inferred status; never rely on color alone.

`diagram.appearance: 'soft'` is independent of palette `soft`; discover icons/tones through `getCapabilities().diagram.visuals`. Report `ICON_SUPPRESSED` or `UNKNOWN_ICON`. Prefer bounded runtime line widths and coordinated arrows; verify proportions at delivery size.

Read [readability acceptance](references/readability.md) when creating a visual deliverable or changing layout, text or style. Prefer compact automatic Flow `layered` layout without unnecessary manual positions; do not stretch nodes to fill a canvas or erase existing manual layouts. Inspect label fitting and diagram geometry, then review the actual delivery size when visual tools are available. Do not shorten business text, hide diagnostics, shrink fonts or enable navigation to disguise space limits.

## Diagnostics and Safety

Read [Agent contract](references/agent-contract.md) for self-checks and stop conditions. Invalid structure, missing required inputs and non-renderable results block usable delivery. Resolve unknown intents/fallbacks, ignored requested options and data distortion before claiming success; an alternative needs explicit agreement. Review fitting/contrast issues in context. Decorative degradation may be accepted with its impact disclosed; warnings and harmless normalizations do not all require blocking or repeated retries.

- Preserve stable IDs, units, dates, dependencies and source labels; never invent missing data. Distinguish missing Heatmap cells from zero and require a positive Pie total.
- Set `locale` explicitly when localization is requested; default is `en-US`. Input dates use ISO-8601.
- Remain static by default: zoom, pan, drag and editing require explicit host enablement. Prefer SVG for accessible DOM interaction/diagram editing, Canvas for larger supported mark counts.
- Do not invent unsupported chart types, APIs, layout knobs or exports. Release actions are author-only and require an explicit request; see the [release SOP](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/development/release-sop.md).

## Delivery

Return the actual preview URL/artifact path, relevant chart choice, changed files, assumptions and unresolved diagnostics/impact. Separate runtime from visual checks, disclosing unverified sizes/environments. Keep Spec/JSON checkpoints without dumping diagnostics into the summary.

All entries support browser PNG/JPEG export regardless of SVG/Canvas display. Discover `export.delivery` type/as options; Node raster uses root `exportAsync()` with optional `canvas`, not rendering Profiles/Board. Do not claim unavailable bitmap output. For task-result checks read the [task validation guide](https://github.com/wanghetommy/ichartjs/blob/master/docs/agent/task-validation.md).
