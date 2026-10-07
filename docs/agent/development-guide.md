# Development Guide

Execution workflow for maintainers and Coding Agents changing iChart.js itself. For using the library, start with the [Agent Guide](README.md); for plans and historical evidence, use the [development index](development/README.md).

## Required Reading

Read and follow the [Seven Development Principles](development/development-principles.md), as required by the root `AGENTS.md`, then the relevant scenario and iteration plan. The principles are maintained there, not repeated here.

## Select the Change Surface

| Requirement | Contract guide | Main source |
| --- | --- | --- |
| Data charts | [Charting](charting-scenario.md) | `src/spec.mjs`, `src/charts.mjs`, `src/data.mjs` |
| Schedules and project analytics | [Project](project-scenario.md) | `src/project.mjs`, `src/project-analytics.mjs`, `src/schema.mjs` |
| Flow, Swimlane, Architecture and Mindmap | [Diagram](diagram-scenario.md) | `src/diagram.mjs`, `src/diagram-interaction.mjs` |
| Freeform Board | [Board](canvas-scenario.md) | `src/board.mjs`, `src/board-edit.mjs` |
| Typed chart edits | [Editing](editing-contract.md) | `src/command.mjs`, `src/edit.mjs`, `src/edit-controller.mjs` |

## Change and Acceptance Workflow

1. Confirm the task and iteration scope, reproduce the problem if applicable, and identify the smallest shared change surface.
2. Add focused regression coverage and implement the change without unrelated fixes.
3. Synchronize affected API/types, manifests, bilingual guides, recipes and maintained demos. Use the [Playground policy](development/playground-plan.md) to choose the owning page.
4. Run focused tests first, then `npm run agent:check` and `git diff --check`. The Agent gate covers contracts, types, dependencies, recipes, docs, package consumers, footprint, profiles, syntax and unit tests; it does not prove translation equivalence or browser correctness.
5. For layout or interaction changes, run `npm run test:browser` and inspect the affected SVG/Canvas previews. For README/Quickstart examples, run `npm run docs:snippets`; use `npm run performance:check` when the change affects performance. If package contents or source sizes change, refresh `npm run footprint:generate` and verify `npm run footprint:check` without increasing budgets to hide regressions.
6. Return changed behavior, actual test results, remaining limits, exact HTTP preview URLs and manual acceptance actions. Commit or release only when explicitly authorized; releases follow the [author-only SOP](development/release-sop.md).

## Documentation and Source Rules

- Active `src/*.mjs` modules begin with a short English responsibility/constraint comment; update it when that responsibility changes. Use focused JSDoc for public APIs and complex algorithms, not line-by-line noise.
- Documentation describes behavior and contracts rather than duplicating implementation. Generated chart guidance belongs in the [Quickstart](quickstart.md), [Runtime Contract](runtime-contract.md) and [conversational workflow](conversational-workflow.md), not a second maintainer prompt contract.
- Current development policies and canonical Agent guides use English. Chinese companions belong in `docs/agent/zh-CN/`; synchronize technical changes across both languages. Historical development records may retain their original language.
- Iteration and acceptance records describe their own scope/date, not current API or release instructions. Keep them discoverable through the development index, outside ordinary Agent default reading.
