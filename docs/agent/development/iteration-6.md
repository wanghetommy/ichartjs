# Iteration 6 — Project Intelligence and Business Views

## Goal

Add reproducible project analytics that Agents can generate from task and delivery data without unnecessarily expanding the public chart-type surface.

## Chart Type Policy

- Iteration 6 does not add a public chart type by default.
- Prefer existing primitives and modes: `gantt`, `timeline`, `milestone`, `burndown`, `bar`, `column`, `area`, and `scatter`.
- Resource load should first be implemented as a Gantt-related project view.
- Release burndown should be a `burndown` mode.
- Velocity should use `column` plus a project-data adapter.
- Cumulative flow should use stacked `area` plus a status-history transform.
- Risk matrix should use `scatter` plus risk encodings and quadrant guides.
- Issue aging should use `bar` or `scatter` plus an aging transform.
- Promote a view to a new public chart type only when it is high-frequency, has semantics that cannot be expressed cleanly through existing Specs, and has independent interaction, accessibility, export, and testing requirements.
- Candidate foundational chart types such as Radar, Heatmap, and Treemap remain outside Iteration 6 and require separate demand review.

## 6A — Schedule Intelligence

1. Add critical-path and slack/float visualization controls to Gantt.
2. Add baseline versus actual task bars and deterministic variance calculations.
3. Add milestone variance indicators.
4. Expose schedule assumptions, derived fields, and warnings through chart state and Agent inspection APIs.
5. Add incomplete-date, inverted-range, missing-dependency, and inconsistent completion warnings.

### Checkpoint

- Gantt can toggle critical path, slack, baseline, and actual overlays.
- The same task input produces the same variance and slack values.
- Derived values are clearly separated from source fields.

## 6B — Calendar and Dependency Rules

1. Define explicit timezone and working-calendar configuration.
2. Support working weekdays, holidays, and non-working-day adjustment policies.
3. Add dependency types and lag/lead values without breaking existing string dependency IDs.
4. Recalculate critical path and slack using the selected calendar.
5. Report unsupported or ambiguous calendar inputs instead of silently guessing.

### Checkpoint

- Schedule calculations are reproducible for a declared calendar and timezone.
- Legacy dependency arrays remain valid.
- Lag, lead, holidays, and weekends have focused unit coverage.

## 6C — Capacity and Delivery Views

1. Add owner and resource fields to the project-task contract.
2. Implement resource load and capacity as a project view backed by existing chart primitives.
3. Implement cumulative flow as stacked Area output from status-history data.
4. Implement velocity as Column output from completed work by sprint.
5. Implement release forecasting as a Burndown mode with explicit assumptions.

### Checkpoint

- Capacity overload and missing-capacity conditions produce structured warnings.
- Cumulative-flow totals reconcile with input status counts.
- Velocity and release forecasts expose their aggregation window and assumptions.

## 6D — Risk, Aging, and Linked Analysis

1. Implement risk matrix output with Scatter encodings for probability and impact.
2. Implement issue-aging output with configurable age buckets.
3. Add filters for owner, status, priority, sprint, and label.
4. Add framework-neutral linked-selection and linked-filter state across project views.
5. Preserve stable record IDs across all derived datasets.

### Checkpoint

- Filters update every linked view consistently.
- Risk and aging calculations are deterministic and inspectable.
- Selection links source records rather than array positions.

## 6E — Agent and Release Closure

1. Add natural-language intent recipes for schedule, variance, risk, capacity, and release reporting.
2. Add Agent documentation for data quality, assumptions, confidence, and unsupported inference.
3. Add TypeScript declarations for project analytics options and results.
4. Add lifecycle, performance, SVG, Canvas, and normalized JSON regression coverage.
5. Complete browser acceptance for desktop and mobile viewports.
6. Record physical-device and host integration checks separately from local runtime acceptance.

## Verification

- `npm run agent:check` and `git diff --check` pass.
- Baseline, actual, variance, slack, capacity, and forecast calculations are deterministic.
- Source rows are never mutated by transforms or analytics.
- Insufficient or contradictory data produces structured warnings.
- Existing chart types remain backward compatible.
- SVG and Canvas use equivalent normalized datasets and semantic record references.
- Linked filters and selections remain stable across rerenders.

## Preview and Acceptance

- Full gallery: `http://127.0.0.1:3000/playground/project-gallery.html`
- Project intelligence demo: `http://127.0.0.1:3000/playground/project-intelligence.html`
- Start the local server from the repository root with `python3 -m http.server 3000 --bind 127.0.0.1`.
- Every completed checkpoint must update at least one HTTP-served demo and include exact manual acceptance steps in the delivery report.

## Deliverables

- Project analytics functions and adapters under `src/`.
- `playground/project-intelligence.html`.
- Project analytics recipes under `agent-recipes/`.
- Agent data-quality and assumption documentation.
- Updated TypeScript declarations and capability manifests.
- Iteration 6 browser and runtime acceptance report.

## Completion Definition

Iteration 6 is complete when schedule, capacity, delivery, risk, and aging insights can be generated through stable existing chart primitives; calculations and assumptions are inspectable; linked filters behave consistently; and the runtime, documentation, recipes, tests, and HTTP demos pass acceptance. Any proposed new chart type requires a separate frequency and API review.

## Current Delivery

- `src/project-analytics.mjs` now hosts calendar normalization, dependency normalization, schedule analysis, capacity, velocity, release forecast, risk matrix, and issue aging adapters.
- `src/project.mjs` consumes schedule and burndown analytics outputs and exposes linked project state, assumptions, warnings, and schedule overlays through runtime state/tooltips.
- `src/project-linking.mjs` provides framework-neutral linked filters and linked selection based on stable record IDs.
- `playground/project-intelligence.html` demonstrates schedule overlays, capacity, release, risk, and aging outputs with visible linked-state diagnostics.

## Acceptance Record

- Dependency strings and `{ id, type, lag, lead }` objects share the same Spec, schema, cycle, and missing-reference validation contract.
- Finish-to-start successors begin on the next working day at zero lag; weekends and holidays continue to use the declared calendar.
- Calendar calculations are deterministic in `UTC`; unsupported timezone values emit `UNSUPPORTED_TIMEZONE` and fall back to `UTC`.
- Linked fallback record IDs retain their source index after filtering.
- Velocity, risk, and issue-aging adapters exclude invalid values and emit structured warnings; issue aging requires an explicit `today` reference.
- Automated acceptance: `npm run agent:check` and `git diff --check`.
- Browser acceptance: open `http://127.0.0.1:3000/playground/project-intelligence.html`, confirm all demo cards render and linked-state diagnostics update; then open `http://127.0.0.1:3000/playground/project-gallery.html` and confirm the project charts render without console errors.
