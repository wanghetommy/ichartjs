# Iteration 11 — Chart Preferences and Agent Adjustments

Iteration 11A–11D adds a small, allowlisted preference layer for visual configuration. It does not add chart types or change data encoding behavior. The same contract powers per-chart settings, page-wide defaults, browser persistence, and Agent conversational adjustments.

## 11A — Preferences Contract

- Add `createPreferencesStore()`, `normalizePreferences()`, `mergePreferences()`, and `validatePreferences()`.
- Keep the public fields limited to theme mode/preset/palette, typography scale, density, legend/labels/grid visibility, branding, and motion.
- Resolve precedence as defaults → global page preferences → chart preferences → temporary Agent patch.
- Keep preference state separate from business data and provide structured change events with `source`, `scope`, and persistence status.
- Fall back to memory in Node/SSR and support browser `localStorage` or a host storage adapter explicitly.

## 11B — Per-Chart Settings

- Add `Chart#getPreferences()`, `Chart#setPreferences()`, and `Chart#resetPreferences()`.
- Add the optional `mountChartSettings()` browser UI with an accessible settings button in the chart container's top-right corner.
- Limit the per-chart menu to high-frequency theme, palette, font-scale, and capability-supported visibility controls; keep advanced and global controls on a dedicated page outside the chart popover.
- Keep the settings DOM outside SVG/Canvas so it is not included in PNG/SVG exports.
- Apply changes without recreating the Chart instance and preserve explicit chart colors/background/padding overrides.

## 11C — Global Page Configuration

- Allow one `PreferencesStore` to be shared by all charts on a page.
- Support global and chart scopes with chart-specific inheritance and reset behavior.
- Persist only the versioned preference document, never business rows or credentials.
- Expose the effective preferences in `chart.getState()` and the capabilities manifest.

## 11D — Agent and Playground Integration

- Let an Agent apply a validated visual patch with `chart.setPreferences(patch, { source: 'agent' })`.
- Keep Agent updates and UI updates on the same `preferenceschange` event path.
- Add `preferences-lab.html` and settings controls to the Complete Gallery for browser acceptance.
- Document conversational examples such as “use dashboard style, status colors, larger labels, and hide the grid.”

## Acceptance

- `npm run agent:check` passes.
- Preferences work in headless memory mode and browser `localStorage` mode.
- Global updates reach all charts sharing a store; chart updates remain isolated.
- Invalid preference patches return structured validation details and do not mutate state.
- Preview pages:
  - `http://localhost:3000/playground/preferences-lab.html`
  - `http://localhost:3000/playground/project-gallery.html`
- No new chart type, data transform, or export format is introduced.
