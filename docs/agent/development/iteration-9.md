# Iteration 9 — Visual Style System and Adaptive Theming

Iteration 9 remains part of the `2.0.0` source line. It adds no public chart type and no external runtime dependency.

## Goal

Provide a small, consistent built-in visual language that Agents can select by semantic intent, users can override, and both SVG and Canvas can render without separate theme implementations.

## 9A — Tokens and Presets

- Add shared color, typography, layout, mark, focus, selection, missing-value, and status tokens.
- Add `analysis`, `dashboard`, `report`, `presentation`, `project`, and `diagram` presets.
- Add categorical, sequential, diverging, and status palettes.
- Preserve custom `colors`, `background`, and `padding` overrides.

## 9B — Adaptive Resolution

- Resolve `auto`, `light`, `dark`, and `contrast` modes.
- Select presets by chart family and host context.
- Select palettes from data semantics.
- Expose deterministic reasons and warnings through planning and explanation APIs.
- Follow host color-scheme changes when mode is automatic.

## 9C — Runtime and Renderer Integration

- Add `planStyle()`, `resolveTheme()`, `validateThemeContrast()`, `Chart#setTheme()`, and `Chart#getTheme()`.
- Apply tokens to generic charts, Heatmap, Radar, project views, diagrams, tooltips, axes, labels, legends, and empty states.
- Keep SVG and Canvas on the same resolved Spec and Scene Graph.

## 9D — Agent Guidance and Acceptance

- Add English and Chinese theme guides.
- Extend README, quickstarts, Skill guidance, capabilities, and TypeScript declarations.
- Add the Theme Gallery and controls to the Complete Gallery.
- Add unit, contract, contrast, and switching regression tests.

## Acceptance

- `npm run agent:check` passes without changing package version `2.0.0`.
- Built-in modes pass the declared contrast checks.
- Automatic style recommendations are deterministic and explainable.
- User overrides win and live switching does not recreate charts.
- Theme behavior is visually inspectable at `http://localhost:3000/playground/theme-gallery.html`.

