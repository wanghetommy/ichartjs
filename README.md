# iChart.js 2.0

iChart.js 2.0 is an Agent-friendly, renderer-independent visualization runtime.

## Current scope

- `Chart Spec` with JSON-friendly configuration.
- Data normalization and `inspectData()`.
- Canvas and SVG renderers.
- `line`, `area`, `bar`, `column`, and `pie` charts.
- Basic `hover`, `click`, HTML tooltip, resize, PNG/SVG export.
- Agent discovery with `getCapabilities()`, `inspectData()`, and `recommend()`.
- Beta APIs for data transforms, selection state, zoom/pan, and scale primitives.
- Themes, accessibility foundations, plugins, responsive behavior, scatter, funnel, and gauge charts.
- Project-management views (`gantt`, `timeline`, `milestone`, `burndown`) and process diagrams (`flow`, `swimlane`).
- Geographic charts and 3D rendering are explicitly deferred.
- No external runtime dependency.

## Example

```js
import { createChart } from './src/index.mjs';

const chart = createChart({
  container: '#chart',
  type: 'line',
  renderer: 'svg',
  data: { values: [
    { month: 'Jan', sales: 120 },
    { month: 'Feb', sales: 180 }
  ] },
  encoding: {
    x: { field: 'month', type: 'category' },
    y: { field: 'sales', type: 'quantitative' }
  },
  title: { text: 'Monthly Sales' }
});

chart.on('click', event => console.log(event.datum));
```

## Development

```bash
npm test
npm run check
```

Agent documentation lives in `docs/agent/`; machine-readable recipes live in `agent-recipes/`; active browser demos live in `playground/`. Start with `docs/agent/README.md` and use `playground/project-gallery.html` to browse all supported chart types.
