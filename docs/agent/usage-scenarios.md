# iChart.js Usage Scenarios

iChart.js has three layers:

1. **Runtime** — `@taylorwong/ichartjs` executes planning, validation, rendering, interaction, editing, and export.
2. **Skill** — `skills/ichartjs/SKILL.md` teaches an Agent how to choose a chart, preserve data lineage, validate a Spec, and report the result.
3. **Host project** — the user's web app, Node script, CI job, or Agent workspace provides data, lifecycle, routing, storage, and delivery.

The Skill is not a second renderer or service. A Skill-enabled Agent still needs a JavaScript host to render an interactive chart or create a file.

## Choose a Scenario

| Need | Use | Runtime location | Typical output |
| --- | --- | --- | --- |
| Add a chart to a product | Frontend integration | User's browser app | Interactive SVG or Canvas chart |
| Ask Codex to change an existing app | Coding Agent + Runtime | Repository and app dev server | Code changes, Spec, tests, preview URL |
| Reuse charting guidance across Agents | Skill + Runtime | Agent workspace and target project | Validated code, artifacts, explanation |
| Create a one-off visualization | Node script or standalone HTML | Node.js or browser | SVG, PNG/JPEG, JSON, or HTML |
| Build project or delivery views | Project scenario + Runtime | Project dashboard | Gantt, Burndown, Timeline, analytics |
| Build a process or architecture view | Diagram scenario + Runtime | Web app or document workflow | Flow/Swimlane UI, SVG, JSON |
| Generate scheduled reports | Node script + Runtime | CI or report job | SVG/PNG files and JSON checkpoints |

## Output Contract

| Output | Best for | API or delivery |
| --- | --- | --- |
| Interactive page | Product dashboards, editors, analysis screens | `createChart()` mounted into a DOM container |
| SVG DOM | Accessibility, keyboard interaction, diagrams, printing | `renderer: 'svg'` |
| SVG file/string | Documents, email, vector handoff, zero-dependency headless output | `chart.export({ type: 'svg' })` |
| PNG/JPEG | Presentations, chat attachments, image reports | Browser `toDataURL()` or Node `exportAsync()` with optional `canvas` |
| JSON Spec/state | Persistence, Agent checkpoints, cross-environment rebuild | `chart.export({ type: 'json' })` |
| Data URL or Blob | Embedding or browser download | `as: 'dataurl'` or browser download APIs |
| Code snippet | Developer handoff or generated page | `createChart()` integration code |
| Explanation/state | Agent self-check and user-facing audit | `chart.explain()` and `chart.getState()` |

JSON is the machine-readable source of truth. SVG and PNG/JPEG are presentation artifacts. Code is the integration artifact. An interactive page is the product artifact.

## Visual Preferences: UI and Agent

For post-creation visual adjustments, share a `createPreferencesStore()` with the page's charts. Use `storage: 'localStorage'` only in a browser when the host wants preferences to survive refreshes. `mountChartSettings(chart)` adds an optional accessible quick-settings button outside the export surface; keep the full page-level settings surface as a separate host route.

The host or Agent can use the same patch contract:

```js
chart.setPreferences({
  theme: { preset: 'dashboard', palette: 'status' },
  typography: { scale: 1.15 },
  components: { grid: false }
}, { source: 'agent' });
```

Keep the quick menu limited to theme, palette, font scale, and capability-supported visibility toggles. Use `scope: 'global'` for a page-wide update, the default chart scope for a single chart, and `chart.getState().preferences` for an auditable effective result. Preview both layers at `http://localhost:3000/playground/project-gallery.html` and `http://localhost:3000/playground/preferences-lab.html`.

## Scenario 1: Integrate into a Web Project

Install the runtime in the host application:

```bash
npm install @taylorwong/ichartjs@^2
```

Use the normal component lifecycle:

```js
import { createChart } from '@taylorwong/ichartjs';

const chart = createChart({
  container: '#chart',
  type: 'line',
  renderer: 'svg',
  data: { values: rows },
  encoding: {
    x: { field: 'month', type: 'category' },
    y: { field: 'sales', type: 'quantitative' }
  },
  accessibility: { enabled: true }
});
```

The host application owns data loading, authentication, routing, persistence, and state management. Call `setData()` for row changes, `update()` for Spec changes, and `destroy()` before replacing the component.

Use this scenario for dashboards, admin pages, project management products, editors, and embedded analytics.

## Scenario 2: Ask a Coding Agent to Modify a Project

Give the Agent the intent, data source, desired output, and acceptance requirement:

```text
Use @taylorwong/ichartjs in the current project. Inspect the order data,
choose and validate a monthly sales chart, add it to the existing analysis
page, run focused tests, and return the exact preview URL. Keep assumptions,
warnings, record lineage, and unsupported requests visible.
```

The Agent should return:

- changed files and the validated Spec;
- field mappings and chart-selection reasons;
- assumptions, warnings, and unsupported requests;
- focused test results and self-check state;
- the host project's exact preview URL and manual acceptance steps.

The repository Playground is only for iChart.js examples:
`npm run playground` → `http://localhost:3000/playground/project-gallery.html`.
For a consumer project, return that project's own development URL.

## Scenario 3: Use the Official Skill

Install the latest Skill with the standard Agent Skills CLI:

```bash
npx skills add wanghetommy/ichartjs --skill ichartjs
```

Install globally for Codex without prompts:

```bash
npx skills add wanghetommy/ichartjs --skill ichartjs --agent codex --global --yes
```

For reproducible installation, pin the released Skill directory:

```bash
npx skills add https://github.com/wanghetommy/ichartjs/tree/v2.0.9/skills/ichartjs \
  --agent codex --global --yes
```

WorkBuddy users can import the same tagged GitHub directory through the host's Skill interface. Do not assume that `--agent workbuddy` exists unless the installed Skills CLI lists that adapter. A manual copy from `node_modules/@taylorwong/ichartjs/skills/ichartjs` remains a fallback for hosts with custom Skill directories.

After installation or selection, ask:

```text
Use the iChart.js Skill. Read this dataset, create a project Burndown,
validate the Spec, generate a browser preview, and also export SVG and JSON.
Return the preview URL, artifact paths, warnings, assumptions, and lineage.
```

The Skill routes the task to the public Runtime API and scenario guides. It does not replace the package, add a service endpoint, or create a second chart-selection implementation.

If the host can edit and run a JavaScript project, the output can be an interactive page. If it cannot run JavaScript, request an SVG, JSON, or code artifact instead.

## Scenario 4: Create a One-Off Artifact

For a single chart, an Agent can create a small ESM script or standalone HTML page.

Recommended outputs:

- `chart.svg` for vector documents and zero-dependency headless generation;
- `chart.json` for a reproducible Spec and runtime checkpoint;
- `chart.png` or `chart.jpeg` for presentations and image sharing;
- `index.html` plus JavaScript when the recipient needs interaction.

Headless SVG and JSON work without an extra production dependency. Headless PNG/JPEG uses `chart.exportAsync()` and the optional `canvas` package. Do not add Python, MCP, HTTP, or a CLI merely to create one chart.

## Scenario 5: Project and Diagram Workflows

Use the project and diagram contracts when the data has project semantics rather than generic numeric series:

- `gantt`, `timeline`, `milestone`, and `burndown` for delivery schedules;
- project analytics for capacity, velocity, release forecast, risk, and issue aging;
- `flow` and `swimlane` for process, ownership, responsibility, groups, ports, and controlled editing.
- `architecture` for business, data, or technical architecture with explicit layers, boundaries, and relationships.
- `mindmap` for idea hierarchies where `parentId` is the source of truth and a tree or radial layout is preferred.

Preserve stable record, node, edge, lane, group, and port IDs. For business edits, return a preview before commit and include the audit result.

## Scenario 6: CI and Scheduled Reports

Use a Node ESM script in the report job:

```js
const svg = chart.export({ type: 'svg' });
const json = chart.export({ type: 'json' });
const png = await chart.exportAsync({ type: 'png' });
```

Store JSON as the reproducible checkpoint and SVG/PNG as presentation artifacts. Report export errors as structured results instead of silently substituting another format.

## Boundaries

- iChart.js is a JavaScript UI/runtime package, not a data service.
- A Skill gives Agents workflow instructions; it does not render without a JavaScript host.
- The host application owns authentication, storage, sharing, and application routing.
- There is no need for a core CLI, MCP server, HTTP service, or Python API for ordinary usage.
- If data is prepared in Python, export JSON/CSV and let a JavaScript process render the chart.
- Do not generate maps or 3D charts unless `getCapabilities()` explicitly declares them.

## Agent Delivery Checklist

Every Agent response should state:

1. selected chart/view and the reason;
2. input fields, transforms, and stable IDs;
3. validated Spec or structured repair request;
4. assumptions, warnings, unsupported requests, and accessibility choices;
5. explanation/state self-check results;
6. exact preview URL, code files, or artifact paths;
7. export format and any optional dependency required.

Related guides: [Quickstart](quickstart.md), [Frontend Integration](frontend-integration.md), [Coding Agent Integration](coding-agent-integration.md), [Runtime Contract](runtime-contract.md), [Project Scenario](project-scenario.md), and [Diagram Scenario](diagram-scenario.md).
