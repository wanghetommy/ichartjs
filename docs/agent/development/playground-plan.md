# Playground Maintenance Policy

The Playground is the browser-visible demonstration and acceptance surface, not a collection of iteration snapshots. This document owns page boundaries and maintenance requirements; implementation steps and quality commands belong in the [Development Guide](../development-guide.md). The original phased delivery is recorded in [Iteration 8](iteration-8.md).

## Single Page Catalog

[`playground/playground.mjs`](../../../playground/playground.mjs) defines maintained pages, labels, home groups and navigation. The Home page, shared navigation, readiness checks and server 404 hints consume that catalog. Do not maintain a second page inventory or navigation tree here.

- `index.html` presents recommended demos first, with acceptance/publishing pages in a collapsible section.
- `project-gallery.html` is the stable smoke-test URL for all 18 public chart types: one representative case per type, with renderer controls, Spec/state inspection and visible failures. Feature variants belong in focused pages rather than duplicate Gallery cards.
- `github-promo.html` remains in the Home catalog but outside operational navigation because it is a screenshot/GIF composition.

## Page Ownership

| Responsibility | Owning page(s) |
| --- | --- |
| Shared foundational features | `foundational-gallery.html`: Stack, Donut, Combo, Bin, Heatmap and Radar |
| Styles and preferences | `theme-gallery.html`: themes/contrast; `preferences-lab.html`: page/chart settings, persistence and Agent patches |
| Agent planning and explanation | `agent-workbench.html`: inspect, plan, validate, render, explain and export |
| Project analytics and linking | `project-intelligence.html` |
| Typed business editing | `editing.html`: preview, approval, commit, audit and history |
| Diagram authoring and incremental Flow | `diagram-editor.html` |
| Mixed composition and incremental Board | `canvas-board.html` |
| Independent profile imports | `profile-loading.html` |
| Cross-cutting acceptance | `interaction-lab.html`, `accessibility-lab.html`, `performance-lab.html` |

Link to the owning page instead of copying its dataset and controls. Keep release-critical behavior on maintained pages, not historical iteration pages. New features normally extend an existing page; a new page needs a distinct user task or acceptance responsibility.

## Shared Page Requirements

1. Load directly over HTTP and use shared navigation; promotional compositions may omit it for capture. Expose page purpose, runtime version and a Home link where applicable.
2. Use public APIs through `playground/runtime.mjs`; profile verification intentionally imports independent public profile entries. Serve with `npm run playground` and `Cache-Control: no-store`, not ad hoc cache-busting query keys.
3. Show initialization, ready, warning and error states; expose relevant Spec/state/diagnostics/events or measurements rather than relying only on the console.
4. Keep fixtures deterministic with stable IDs and no required external network. Keep stress datasets and lifecycle loops in the performance lab, not the full Gallery.
5. Explicitly enable editing/navigation only in demos that need them. Provide reset and acceptance actions for mutable examples; destroy replaced charts/listeners.
6. Verify keyboard focus, reduced motion and relevant 390 px, 768 px and desktop layouts. Document supported query parameters such as `renderer` or `scenario`; do not imply every page supports every parameter.

## Preview and Acceptance

Start `npm run playground`, then open `http://localhost:3000/playground/index.html` for the current catalog and exact URLs. The full Gallery is `http://localhost:3000/playground/project-gallery.html`.

For visible Agent-driven construction, use the existing workbenches:

- Flow: `http://localhost:3000/playground/diagram-editor.html?scenario=incremental`
- Board: `http://localhost:3000/playground/canvas-board.html?scenario=incremental`
- Both URLs and bare pages default to an empty four-step example with Next, Previous step and Restart. Next authorizes the displayed preset step, executing preview/confirmed commit internally; Developer tools are collapsed. Use `?scenario=advanced` for editable command templates, explicit preview/confirmation, cancellation/history and delivery review; `?scenario=editor` opens the manual Flow editor, `?scenario=composition` opens the full Board composition. Append `&renderer=canvas` for Canvas; `lang=zh-CN` or `lang=en` overrides browser language. Developer mutations invalidate the simple sequence until Restart. These are structured-command host demos, not built-in language models; see the [shared workflow](../conversational-workflow.md#agent-driven-incremental-construction).

Delivery reports name the owning page, exact URL, reproducible actions, actual checks and remaining environment limits. An entry in the catalog is not itself evidence that browser acceptance passed.

## GitHub Promo GIF

`docs/assets/github-promo.gif` is generated from `playground/github-promo.html`. Refresh it when composition, fixtures, workflow labels or theme states change:

1. Start the preview server and open `http://localhost:3000/playground/github-promo.html`.
2. Capture `[data-step="0"]` through `[data-step="4"]` at one consistent 16:9 viewport, after each state has settled.
3. Use `ffmpeg` to generate a compact looping GIF with a generated palette and a short hold per frame.
4. Replace the existing asset, inspect all five states and retain its README placement. Check whitespace with `git diff --check`; never treat successful conversion as visual acceptance.
