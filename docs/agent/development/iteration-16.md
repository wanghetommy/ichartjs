# Iteration 16 — Agent-ready Presentation and Acceptance Hardening

Iteration 16 consolidates the runtime after the chart, diagram, preference, and readability work. It adds no chart type. The goal is to make page-level configuration, Agent changes, browser rendering, lifecycle behavior, and conversational workflows explicit and testable.

## 16A — Gallery and Preference Precedence

- Make page, chart, Spec, and automatic style sources observable.
- Keep page-level Gallery controls authoritative for the charts they target.
- Keep chart-menu changes isolated to one chart.
- Allow `auto` to clear an override.
- Version persisted preferences and keep storage failures non-fatal.
- Test `project-gallery.html` and `preferences-lab.html` in a real browser.

The runtime precedence is:

```text
defaults → chart Spec → global PreferencesStore → chart PreferencesStore
```

`chart.getState().preferenceResolution` reports the precedence, storage mode, and source of each active scope.

## 16B — Agent State and Discoverability

- Expose preference resolution beside effective preferences.
- Publish the conversational routing contract through `getCapabilities()` and `capabilities.json`.
- Keep diagnostics for hidden, truncated, clamped, or unsupported content machine-readable.
- Document minimal executable examples for visual, data, Spec, project, and Diagram changes.
- Keep the Skill and English/Chinese Agent guides aligned.

## 16C — Renderer, Responsive, and Accessibility Acceptance

- Check SVG/Canvas parity for themes, labels, diagrams, and edge-label plates.
- Test narrow containers, long CJK labels, multiple legends, Funnel stages, and polar labels.
- Test settings-menu focus, keyboard operation, Escape closing, and ARIA labels.
- Use browser screenshots for visual acceptance in addition to SVG text assertions.

## 16D — Lifecycle and Performance Stability

- Repeated theme, preference, update, resize, and destroy operations must not duplicate listeners or menus.
- Recreate Gallery charts without stale observers or subscriptions.
- Record a baseline for the 18-chart Gallery and representative larger datasets.
- Keep package, export, Skill, docs, and manifest checks in the release gate.

## 16E — Conversational Workflow

- Define natural-language request classification without adding an NLP parser to the library.
- Route visual changes to `setPreferences()`/`setTheme()`.
- Route complete data replacement to `setData()`.
- Route business and Diagram edits through `previewEdit()`/`applyEdit()`.
- Route normal Spec changes to `update()` and precise JSON changes to `applyPatch()`.
- Require preview, validation, confirmation for destructive changes, and post-commit `explain()`/`getState()` checks.
- Add `docs/agent/conversational-workflow.md` and its Chinese companion.

## Acceptance

- Gallery top-level theme controls change the targeted charts and remain visible in `getState()`.
- A preference change reports its source and effective precedence.
- An Agent can follow one documented workflow to modify style, data, Spec, or Diagram content.
- Invalid changes remain atomic and produce structured diagnostics.
- SVG and Canvas remain behaviorally aligned for supported features.
- Repeated create/update/destroy cycles leave no stale runtime resources.
- `npm test`, browser tests, `npm run agent:check`, and `git diff --check` pass.

## Out of Scope

- New chart types.
- CLI, MCP, or HTTP services.
- A built-in natural-language model or parser.
- Collaborative editing.
- Arbitrary CSS injection or a large theme designer.
