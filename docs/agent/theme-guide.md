# Visual Style and Theme Guide

iChart.js 2.0 includes a lightweight renderer-neutral style system. Agents should request semantic style intent and let the runtime resolve concrete tokens instead of inventing colors, font sizes, or spacing per chart.

## Style Model

The system composes three independent choices:

- `mode`: `auto`, `light`, `dark`, or `contrast`.
- `preset`: `auto`, `analysis`, `dashboard`, `report`, `presentation`, `project`, or `diagram`.
- `palette`: `auto`, `categorical`, `sequential`, `diverging`, or `status`.

`auto` is the recommended default. It uses chart family, intent, data semantics, and the host color scheme. Resolution is deterministic and exposed through `planStyle()`, `planChart().styleRecommendation`, `chart.getTheme()`, `chart.getState().style`, and `chart.explain().style`.

## Agent Workflow

```js
import { createChart, planChart, planStyle, validateSpec } from 'ichartjs';

const plan = planChart(rows, { intent: 'comparison', context: 'dashboard' });
const style = planStyle({ type: plan.primary, data: rows }, { context: 'dashboard' });
const spec = {
  type: plan.primary,
  data: { values: rows },
  theme: { mode: 'auto', preset: style.preset, palette: style.palette }
};

const validation = validateSpec(spec);
if (!validation.valid) throw new Error(JSON.stringify(validation.errors));
const chart = createChart(validation.spec);
```

Use explicit values only when the user requests a mode, presentation context, or semantic palette. A user override always wins over automatic matching.

## Runtime Switching

Switch styles without recreating the chart:

```js
chart.setTheme({ mode: 'dark', preset: 'dashboard', palette: 'categorical' });
const resolved = chart.getTheme();
```

When `mode` is `auto`, mounted charts follow `prefers-color-scheme` changes. Explicit `colors`, `background`, and `padding` on the chart Spec remain preserved across theme changes.

## Palette Rules

- Use `categorical` for distinct series or groups; prefer six or fewer simultaneous comparison colors.
- Use `sequential` for ordered magnitude such as Heatmap intensity.
- Use `diverging` when values have a meaningful midpoint and extend in both directions.
- Use `status` for named business states such as success, warning, danger, and information.
- Do not use color as the only carrier of meaning. Keep labels, shapes, line patterns, or text status where applicable.

## Accessibility

Built-in modes expose text, muted text, axis, grid, focus, selection, missing-value, and status tokens. Call `validateThemeContrast(theme)` for custom token overrides. Do not suppress contrast warnings in Agent output.

Preview and acceptance: `http://localhost:3000/playground/theme-gallery.html`.

