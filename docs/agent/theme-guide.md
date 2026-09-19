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
import { createChart, planChart, planStyle, validateSpec } from '@taylorwong/ichartjs';

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

## Chart and Page Preferences

Use preferences for visual adjustments that a user or Agent may change after the chart has been created. Keep business data, encodings, and chart selection outside this surface.

```js
import { createChart, createPreferencesStore, mountChartSettings } from '@taylorwong/ichartjs';

const pagePreferences = createPreferencesStore({
  storage: 'localStorage',
  storageKey: 'my-app:chart-preferences'
});
const chart = createChart({
  chartId: 'revenue',
  container: '#revenue',
  type: 'line',
  data: { values: rows },
  preferences: pagePreferences
});
const settings = mountChartSettings(chart, {
  locale: 'en',
  placement: 'auto',
  preferredPlacements: ['right', 'top', 'bottom']
});

// The same operation can come from an Agent conversation.
chart.setPreferences({
  theme: { preset: 'dashboard', palette: 'status' },
  typography: { scale: 1.15 },
  components: { grid: false }
}, { source: 'agent' });

// Call this when the host permanently removes the chart.
settings.destroy();
```

The quick-settings panel is portaled outside the clipped chart surface. Automatic placement prefers the button's right side, then the top, then the bottom, and finally constrains the panel inside the browser viewport. On scroll it preserves the selected placement and follows the anchor without viewport snapping; it closes directly when the chart or anchor leaves the viewport. Resize and content changes may recompute placement.

### Agent Discovery and Validation

Agents should discover the allowlisted surface instead of hard-coding menu options. `getPreferenceCapabilities(chartType, { locale })` returns every preference field with its type, default value, options, scopes, chart applicability, and `menu.visible` status. Use the same contract for conversational changes and custom settings pages.

```js
import { getPreferenceCapabilities, validatePreferences } from '@taylorwong/ichartjs';

const capabilities = getPreferenceCapabilities(chart.getSpec().type, { locale: 'en' });
const menuFields = capabilities.fields.filter(field => field.menu.visible);
const current = chart.getPreferences();
const patch = {
  theme: { preset: 'dashboard', palette: 'status' },
  typography: { scale: 1.15 },
  components: { grid: false }
};
const checked = validatePreferences(patch, { partial: true });
if (!checked.valid) throw new Error(JSON.stringify(checked.errors));
chart.setPreferences(checked.value, { scope: 'chart', source: 'agent' });
const applied = chart.getState().preferences;
```

The quick menu fields are `theme.mode`, `theme.palette`, `typography.scale`, and capability-supported `components.legend`, `components.labels`, and `components.grid`. The full allowlist additionally includes `theme.preset`, `density`, `branding.enabled`, and `motion`. Unknown locales fall back to English.

The optional per-chart menu uses a compact hamburger icon and intentionally exposes only high-frequency controls: theme mode, palette, font scale, and supported legend/label/grid visibility. Capability checks hide controls that do not apply to the current chart. Changes apply immediately and the UI supports `en`, `zh-CN`, and automatic document-language detection.

Keep low-frequency and page-wide controls in a dedicated settings surface outside the chart popover. Share one store across the page, and call `store.setGlobal()` or `chart.setPreferences(patch, { scope: 'global' })`. The full surface may expose preset, density, branding, and other allowlisted preferences without overloading every chart. The store uses memory in Node/SSR unless `localStorage` or a host adapter is explicitly selected. Preview the quick menu in `http://localhost:3000/playground/project-gallery.html` and the full page at `http://localhost:3000/playground/preferences-lab.html`.
