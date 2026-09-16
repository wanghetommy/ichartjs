# Iteration 8 Acceptance Record

Date: 2026-09-16

## Result

Iteration 8A–8D is locally implemented and accepted for the repository runtime, public Agent contracts, maintained Playground pages, responsive browser viewport, lifecycle checks, and repeatable performance fixtures. Chromium, Firefox 144, and WebKit 26 checks pass; native Safari automation and physical iOS/Android checks remain external release gates.

## Automated Evidence

- `npm run agent:check`: passed.
- `git diff --check`: passed.
- Core tests: 51 passed, 0 failed.
- Agent documentation check: 16 charts, 24 commands, and 7 schemas.
- Syntax check: every `src/*.mjs` file passed `node --check`.
- Node.js 18.20.8, 20.20.2, and 22.22.2: Agent checks and the executable Agent workflow passed.
- Package-consumer coverage: public ESM imports, capability discovery, planning, validation, explanation, chart creation, lifecycle, and active Playground entry files are covered by the core suite.

## Browser Evidence

- Environments: Codex in-app Chromium, Playwright Firefox 144, and Playwright WebKit 26 against `npm run playground` on `127.0.0.1:3000`.
- Full Gallery: all 16 public chart types rendered; 0 error cards and no uncaught page errors.
- Renderer switch: all Gallery cases rendered with SVG when forced; default mixed SVG/Canvas cases also passed.
- Responsive checks: desktop and a true 390 x 844 viewport completed without body overflow.
- Agent Workbench: `id` remained a stable identifier, `month` was selected as the dimension, validation passed, record IDs were preserved, and the expected missing-value warning remained visible.
- Interaction Lab: zoom in, zoom out to the full window, pan, reset, selection clearing, keyboard behavior, and Canvas switching passed.
- Accessibility Lab: Line, Pie, Heatmap, Radar, Gantt, and Flow exposed role, accessible label, focusability, and family-specific semantic output.
- Regression pages: Foundational Gallery, Project Intelligence, Business Editing, and Diagram Editor loaded with ready states and no uncaught page errors.
- Lifecycle fixture: 25 create/destroy cycles left 0 chart children and 0 tooltips.
- Firefox/WebKit matrix: 22/22 desktop and 390 x 844 touch-viewport page scenarios passed after fixing Project Intelligence grid shrink behavior and redundant ResizeObserver rendering.

## Performance Sample

These are local acceptance samples, not universal device budgets.

| Scenario | Renderer | Create | Resize | JSON export |
| --- | --- | ---: | ---: | ---: |
| Line, 100 rows | Canvas | 1.7 ms | 0.6 ms | 0.1 ms |
| Line, 1,000 rows | Canvas | 6.3 ms | 4.9 ms | 0.3 ms |
| Line, 5,000 rows, Firefox | Canvas | 110 ms | 96 ms | 3 ms |
| Line, 5,000 rows, WebKit | Canvas | 81 ms | 75 ms | 2 ms |
| Heatmap, 5,000 rows, Firefox | Canvas | 19 ms | 15 ms | 2 ms |
| Heatmap, 5,000 rows, WebKit | Canvas | 15 ms | 10 ms | 2 ms |

The Performance Lab also includes repeatable 5,000-row Line, Heatmap, Gantt, and Diagram scenarios for release-host measurements.

## Preview

Start the no-cache static server from the repository root:

```bash
npm run playground
```

- Home: `http://localhost:3000/playground/index.html`
- Full Gallery: `http://localhost:3000/playground/project-gallery.html`
- Agent Workbench: `http://localhost:3000/playground/agent-workbench.html`
- Interaction Lab: `http://localhost:3000/playground/interaction-lab.html`
- Accessibility Lab: `http://localhost:3000/playground/accessibility-lab.html`
- Performance Lab: `http://localhost:3000/playground/performance-lab.html`

## Deferred Release Gates

- Native Safari acceptance; Safari 26.6.2 is installed, but its Allow Remote Automation setting is not enabled.
- Physical-device touch acceptance on iOS and Android.
- Release-host performance budgets across representative low-end and high-end devices.

These deferred checks do not block local Iteration 8 development completion, but they must be recorded before the final 2.0 production release decision.
