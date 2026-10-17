# Runtime Footprint and Loading

## Current release

The supported public runtime entry is:

```js
import { createChart } from '@taylorwong/ichartjs';
```

The root entry is the complete Agent runtime. It includes chart planning, validation, all public chart families, project and diagram views, Freeform Board, SVG/Canvas renderers, editing, preferences, exports, and capability discovery.

The package is ESM and declares `sideEffects: false`, so a bundler may remove unused exports. The complete root entry remains the compatibility entry, while the supported profile entries provide real capability boundaries:

| Entry | Intended use | Excludes from its local graph |
| --- | --- | --- |
| `@taylorwong/ichartjs/standard` | Line, Area, Bar, Column, Pie, Scatter, Funnel, Gauge, Heatmap, Radar | project scenes, diagrams, board, complete root |
| `@taylorwong/ichartjs/project` | Gantt, Timeline, Milestone, Burndown | complete root, generic chart dispatcher, board |
| `@taylorwong/ichartjs/diagram` | Flow, Swimlane, Architecture, Mindmap | complete root, generic chart dispatcher, board |
| `@taylorwong/ichartjs/board` | Freeform Board | complete root and generic chart dispatcher |

Use only documented profile entries; do not use undocumented deep imports from `src/` as a mobile optimization strategy.

Profiles expose reduced capabilities, not root planning/discovery (`planChart`, `getChartContract`). Chart rendering Profiles omit root Chart editing/preferences APIs; `/board` retains its separate Board editing contract. Run planning in the Agent's Node environment, or read packaged manifests/recipes, then ship only the rendering Profile to the browser. This does not require bundling root into the application.

The npm tarball keeps consumer guides, Skill references, recipes, manifests and declarations. Maintenance/iteration records and TypeScript test fixtures remain in Git, not npm; maintained contribution links use GitHub URLs. Package checks resolve local documentation/image links against the actual packed inventory. Removing these resources reduces installation size, not browser JavaScript bytes or the runtime source budgets.

## What is measured

Run:

```bash
npm run footprint:check
```

`npm run footprint:check` reports the root ESM module graph, gzip size, npm tarball size, unpacked package size, and grouped packaged resources. `npm run footprint:generate` refreshes the checked-in `playground/footprint.json` used by the Playground home page. CI compares the generated report with the current repository state, so stale size data fails the check instead of silently drifting.

On 2026-10-17, the user approved these fixed ceilings:

| Metric | Limit in bytes | Limit in KiB |
| --- | ---: | ---: |
| Root source module graph | 655,360 | 640 |
| Root source graph gzip | 163,840 | 160 |
| npm tarball | 405,935 | 396.42 (unchanged) |
| npm unpacked package | 1,440,743 | 1,406.98 (unchanged) |

One KiB is 1,024 bytes. The root figures measure the source graph, not a minified production bundle or actual browser transfer. The generated report's `budget.history` retains the original baseline × 1.15, Iteration 33 feature allowance and measured Iteration 34 group-clearance increment (1,432 raw / 493 gzip bytes). They are historical records, not additional allowances on top of the fixed limits. Limits do not increase automatically with releases; report each change's measured delta, and explain its value and obtain explicit approval before raising a ceiling. Do not remove necessary validation or compromise maintainability to save a few bytes.

The Playground home page at `playground/index.html` displays the same report in a collapsed “Footprint and on-demand integration” panel. Runtime entries are shown separately from documentation, Skill, Recipes, manifests, and TypeScript declarations because Agent resources do not enter the browser runtime automatically.

`npm run profiles:check` verifies the profile graphs and renders one representative artifact per entry. A consumer bundler should build from the profile entry it actually uses rather than from the complete root.

Documentation, Skill files, Recipes, and capability manifests are package resources for Agents; they are not browser runtime modules unless the host imports or requests them.

## Production bundle measurement

`npm run bundle:measure -- --output=playground/bundle-footprint.json` builds each public factory from the installed local npm tarball using pinned esbuild `0.28.2`, ESM/browser/ES2022, minification and level-9 gzip. `npm run bundle:measure -- --published=2.0.30 --output=/tmp/ichart-baseline.json` measures a registry release with identical settings. The tool installs the bundler in a temporary directory; network access is required, but no runtime/development dependency is added to the package and this is not a mandatory network-dependent CI gate.

The factory workload exports only `createChart` (or Board `createBoard`); applications importing more APIs, multiple profiles or additional assets have different results. The optional Node `canvas` adapter is external. Included modules are reported, and Profile builds are checked not to pull in root or Agent resources. Source-graph estimates, production bundle gzip and npm package sizes are three different measurements; neither gzip figure proves actual server transfer size.

Profile Loading displays the checked-in production report separately from source estimates. `npm run consumer:browser` runs the existing browser host fixture against these installed-package minified bundles; it requires Chrome and downloads the pinned bundler into a temporary directory. It does not fetch a moving package release.

## Mobile guidance today

- Use a production bundler rather than loading `src/index.mjs` directly from a page.
- Keep `renderer: 'svg'` for small accessible charts and `renderer: 'auto'` for measured larger datasets.
- Load only the runtime in the application path; load Recipes, Skill, and documentation through Agent/tooling paths.
- Do not add a second custom copy of chart rendering code to obtain a smaller bundle.

Profile entries are additive and should be selected when the host knows its capability family. Use the root entry when the complete runtime API, embedded cross-family charts, or full discovery surface is required.

Chart Profiles provide render-focused `update()`, `resize()`, `setTheme()`, state and export APIs; they do not implement root's editing/history or settings-menu runtime. Explicit renderer updates and auto threshold changes use the same current Spec and scene; rejected updates do not affect later theme changes. Use `getState().rendererSelection` to verify selection. Accept the lifecycle at `http://localhost:3000/playground/profile-loading.html`; use Performance Lab for mounted update, resize and theme timings. Timings are synchronous API durations, not total frame-paint latency or a mobile-device guarantee.

Iteration 26 incremental Flow preview/commit/history uses the root entry, not the render-focused `/diagram` Profile. Its node commands, layout algorithm, and discovery metadata enter the runtime graph; its recipe, Skill, and guides remain Agent resources. That iteration refreshed the package-resource baseline for the added documentation and recipe while retaining the browser module raw/gzip baselines and 15% growth allowance. Current fixed limits are listed above; `playground/footprint.json` reports actual sizes rather than treating the npm package as the browser download size.
