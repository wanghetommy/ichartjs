# Development Guide

Unified workflow for Coding Agents developing iChart.js 2.0.

## Select a Scenario

| Requirement | Guide | Main source |
| --- | --- | --- |
| Generic metrics and data charts | `charting-scenario.md` | `src/charts.mjs` |
| Schedules, milestones, and progress | `project-scenario.md` | `src/project.mjs` |
| Processes, swimlanes, and Diagram editing | `diagram-scenario.md` | `src/diagram.mjs`, `src/diagram-interaction.mjs` |

## Standard Change Flow

1. Read `README.md`, this guide, and the relevant scenario guide.
2. Read the current `development/iteration-X.md` to confirm scope and boundaries.
3. Check module comments under `src/` and identify the smallest change surface.
4. Add or adjust tests before implementing; avoid unrelated fixes.
5. Synchronize the Manifest, scenario guide, Recipe, and Gallery.
6. Run `npm test`, `npm run check`, and `git diff --check`.
7. Provide the HTTP Demo URL and acceptance steps as soon as a viewable result exists.

Run `npm run agent:check` after changes. It checks the declared chart and command lists, schema model coverage, document presence, Chinese text in English core documents, and Gallery type coverage, then runs syntax checks and tests. It does not verify prose equivalence or browser behavior.

## Change Map

### Add a Generic Chart

- Update `src/spec.mjs` and `src/charts.mjs`.
- Add data and Scene tests.
- Update `charting-scenario.md`, `capabilities.json`, and the Gallery.

### Add a Project Feature

- Update `src/project.mjs` and, when needed, `src/schema.mjs`.
- Add tests for analytics, tooltips, and boundary conditions.
- Update `project-scenario.md`, `schemas.json`, and the Gallery.

### Add a Diagram Feature

- Update `src/diagram.mjs` or `src/diagram-interaction.mjs`.
- Update command validation and edit history tests.
- Update `diagram-scenario.md`, `commands.json`, and the Diagram Demo.

## Documentation Rules

- Every active `src/*.mjs` module must have a short file-level comment.
- Add focused JSDoc for public APIs and complex algorithms; avoid line-by-line noise comments.
- Documentation describes behavior and contracts; code executes and validates them.
- Core documents directly under `docs/agent/` use English. Chinese companions belong in `docs/agent/zh-CN/`. Update both when technical contracts change.
- Development records live in `docs/agent/development/` and are not part of the default Agent context. Their existing language may be retained.

## Completion Checklist

- Code implementation is complete.
- Unit tests are complete.
- The Manifest is synchronized.
- The scenario guide is synchronized.
- The Gallery or a focused Demo is reviewable.
- `npm run rc:check` passes.
