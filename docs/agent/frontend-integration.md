# Frontend Integration

Use iChart.js as an ordinary JavaScript UI component inside a browser application. The host application owns data loading, authentication, persistence, routing, and any assistant or natural-language interface.

This is the production component path. For one-off files or Agent-led repository changes, use [Usage Scenarios](usage-scenarios.md) and the [Coding Agent Integration](coding-agent-integration.md) guide instead.

## Install

```bash
npm install @taylorwong/ichartjs@^2
```

For environments without npm registry access, install from GitHub as a fallback: `npm install github:wanghetommy/ichartjs#v2.0.14`.

Use the package through a bundler or another environment that resolves npm ESM imports:

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
- Call `setData()` when only rows change.
- Call `update()` when Spec options change.
- Call `resize()` when the host controls dimensions.
- Call `destroy()` before replacing the component or removing its container.

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
