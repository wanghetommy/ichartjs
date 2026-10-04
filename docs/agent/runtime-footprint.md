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

`npm run footprint:check` reports the root ESM module graph, gzip size, npm tarball size, and unpacked package size. `npm run profiles:check` verifies the profile graphs and renders one representative artifact per entry. A consumer bundler should build from the profile entry it actually uses rather than from the complete root.

Documentation, Skill files, Recipes, and capability manifests are package resources for Agents; they are not browser runtime modules unless the host imports or requests them.

## Mobile guidance today

- Use a production bundler rather than loading `src/index.mjs` directly from a page.
- Keep `renderer: 'svg'` for small accessible charts and `renderer: 'auto'` for measured larger datasets.
- Load only the runtime in the application path; load Recipes, Skill, and documentation through Agent/tooling paths.
- Do not add a second custom copy of chart rendering code to obtain a smaller bundle.

Profile entries are additive and should be selected when the host knows its capability family. Use the root entry when the complete runtime API, embedded cross-family charts, or full discovery surface is required.
