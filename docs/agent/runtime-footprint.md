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

## What is measured

Run:

```bash
npm run footprint:check
```

`npm run footprint:check` reports the root ESM module graph, gzip size, npm tarball size, unpacked package size, and grouped packaged resources. `npm run footprint:generate` refreshes the checked-in `playground/footprint.json` used by the Playground home page. CI compares the generated report with the current repository state, so stale size data fails the check instead of silently drifting.

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

Iteration 26 incremental Flow preview/commit/history uses the root entry, not the render-focused `/diagram` Profile. Its node commands, layout algorithm, and discovery metadata enter the runtime graph; its recipe, Skill, and guides remain Agent resources. The package-resource baseline is refreshed for the added Iteration 25–26 documentation and recipe. The browser module raw/gzip baselines and the 15% growth allowance remain unchanged; `playground/footprint.json` reports the actual current sizes rather than treating the npm package as the browser download size.
