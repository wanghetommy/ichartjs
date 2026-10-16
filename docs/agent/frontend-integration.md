# Frontend Integration

Use iChart.js as an ordinary JavaScript UI component inside a browser application. The host application owns data loading, authentication, persistence, routing, and any assistant or natural-language interface.

This is the production component path. For one-off files or Agent-led repository changes, use [Usage Scenarios](usage-scenarios.md) and the [Coding Agent Integration](coding-agent-integration.md) guide instead.

## Install

```bash
npm install @taylorwong/ichartjs@^2
```

For reproducible builds, pin the release explicitly: `npm install @taylorwong/ichartjs@2.0.32`.

For environments without npm registry access, install from GitHub as a fallback: `npm install github:wanghetommy/ichartjs#v2.0.32`.

Use the package through a bundler or another environment that resolves npm ESM imports:

<!-- docs-check: frontend-chart -->
```js
import { createChart } from '@taylorwong/ichartjs';

const chart = createChart({
  container: '#chart',
  type: 'bar',
  renderer: 'svg',
  data: { values: rows },
  encoding: {
    x: { field: 'category' },
    y: { field: 'value' }
  },
  interaction: { tooltip: true, keyboard: true },
  accessibility: { enabled: true }
});
```

## Component Lifecycle

- Create the chart after the container exists.
- Use root `setData()` when only rows change; Chart Profiles use `update({ data: rows })`.
- Call `update()` when Spec options change.
- Call `resize()` when the host controls dimensions.
- Call `destroy()` before replacing the component or removing its container.

### Entry and sizing ownership

Use `/standard`, `/project`, `/diagram` or `/board` when the family is known; they do not require importing root first. Root is the full discovery, interaction, editing and preference runtime. Chart Profiles are render-focused and do not supply root's DOM interaction or settings runtime.

- Root observes container **width** with `ResizeObserver` when available. It retains the configured height. Profiles and Board require a host observer or explicit dimension updates.
- Mount after the element exists. `container` accepts a selector or Element; a missing requested selector throws instead of silently producing an unmounted chart. Omit the container intentionally for unmounted SVG output.
- Give the host a measurable width and an explicit chart height; use `min-width: 0` on flex/grid children. Hidden hosts may have zero width: retain the previous size and resize after revealing them. Do not turn zero layout measurements into data changes or viewport navigation.
- Flow preserves node sizes and diagnoses layout overflow. For narrow screens, a host can retain a minimum content width and use `overflow-x: auto`; this is host scrolling, not implicit chart zoom/pan. The consumer demo uses 560 px for its three-node Flow.
- An Element is a live host binding, excluded from normalized/exported Specs before JSON cloning. Supply the destination container again after validation or JSON reconstruction; do not store DOM references in a Spec.
- `destroy()` removes runtime-created surfaces, detaches root events/observers and preserves a caller-supplied SVG/Canvas element. Moving a Board mount also removes the old runtime-owned surface. Dispose the host's own observers, requests and subscriptions separately.
- Root constructor `plugins` are live callbacks from the host. JSON export does not preserve functions; reinstall plugins on reconstruction. Profiles do not provide the full plugin runtime.

### Late data and unmounting

The following Profile example uses an existing `#chart` element, host-controlled 320 px height and no network dependency. Call `refreshRows(() => fetchRows())` with your application's loader; handle loader errors/cancellation in the host. A sequence token prevents old results from replacing newer data or updating a destroyed instance.

<!-- docs-check: host-lifecycle -->
```js
import { createChart } from '@taylorwong/ichartjs/standard';

const container = document.querySelector('#chart');
if (!container) throw new Error('Create #chart before mounting.');
let disposed = false, requestVersion = 0;
const chart = createChart({
  container, type: 'line', renderer: 'svg', width: container.clientWidth || 640,
  height: 320, data: [], encoding: { x: { field: 'month' }, y: { field: 'revenue' } }
});
const observer = new ResizeObserver(entries => {
  const width = Math.round(entries[0]?.contentRect.width || 0);
  if (!disposed && width > 0 && width !== chart.getSpec().width) chart.resize(width, 320);
});
observer.observe(container);

async function refreshRows(loadRows) {
  const token = ++requestVersion;
  const rows = await loadRows();
  if (!disposed && token === requestVersion) chart.update({ data: rows });
}

function dispose() {
  disposed = true;
  requestVersion += 1;
  observer.disconnect();
  chart.destroy();
}
```

For Board, use `board.update({ width, height })` instead of chart `resize()` / `setData()`. Normal data/config updates are trusted-host mutations; Agent structural changes retain the existing preview/confirmation workflow.

### Output and responsiveness

All entries export SVG/JSON and browser PNG/JPEG regardless of display renderer. Use `chart.export({type:'png', as:'blob'})`; validate the result before saving. No display switch or mounting is required. Await `board.ready()` for images. See the [format matrix and diagnostics](runtime-contract.md#exports-and-downloads).

Measure synchronous API time separately from browser presentation opportunities. Performance Lab waits for two animation frames after updates, but this is not exact GPU paint latency, FPS or physical-device certification. Never use a zero-DOM-residue check as proof of no JavaScript memory leaks.

## Optional Agent-Assisted UI

A host web application may let a user enter an intent such as “show the sales trend.” Keep the integration in JavaScript:

1. Convert application data to JSON-friendly rows.
2. Call `inspectData()` and `planChart()` in the browser or Node.js host.
3. Build and validate a candidate Spec.
4. Render with `createChart()`.
5. Show reasons, assumptions, warnings, and unsupported requests in the host UI.

If a daily-use assistant cannot execute or generate JavaScript, it cannot directly consume a JavaScript UI component. Its host application must perform the integration; iChart.js does not need a separate service protocol.

## Out of Scope

The core package does not provide:

- an HTTP service;
- an MCP server;
- a command-line application;
- a Python runtime;
- file upload, authentication, storage, or sharing infrastructure.

Add these only in an application that has a demonstrated requirement. Do not duplicate chart planning or rendering outside the JavaScript runtime.

## Preview

Within this repository, run `npm run playground` and open `http://localhost:3000/playground/project-gallery.html` to inspect every public chart type.

In a consumer application, use that application's own development server and return its URL. The Playground is an example and acceptance surface, not a required production dependency.

The existing [browser consumer fixture](../../examples/consumer-browser.html) supports `?entry=root|standard|project|diagram|board&renderer=svg|canvas`. Use Load data, Race old/new, Resize parent, Hide/show, Unmount/remount and Export for acceptance. It is linked from Profile Loading; its repository import map is replaced with installed-package production bundles by `npm run consumer:browser` (requires Chrome and temporary access to the pinned bundler).
