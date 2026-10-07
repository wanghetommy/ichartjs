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

## Mobile guidance today

- Use a production bundler rather than loading `src/index.mjs` directly from a page.
- Keep `renderer: 'svg'` for small accessible charts and `renderer: 'auto'` for measured larger datasets.
- Load only the runtime in the application path; load Recipes, Skill, and documentation through Agent/tooling paths.
- Do not add a second custom copy of chart rendering code to obtain a smaller bundle.

Profile entries are additive and should be selected when the host knows its capability family. Use the root entry when the complete runtime API, embedded cross-family charts, or full discovery surface is required.

Iteration 26 incremental Flow preview/commit/history uses the root entry, not the render-focused `/diagram` Profile. Its node commands, layout algorithm, and discovery metadata enter the runtime graph; its recipe, Skill, and guides remain Agent resources. The package-resource baseline is refreshed for the added Iteration 25–26 documentation and recipe. The browser module raw/gzip baselines and the 15% growth allowance remain unchanged; `playground/footprint.json` reports the actual current sizes rather than treating the npm package as the browser download size.
