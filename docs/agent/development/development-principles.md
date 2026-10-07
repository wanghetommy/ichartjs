# Seven Development Principles

Required reading for contributors and Coding Agents changing iChart.js source, tests, contracts, documentation or demos. Use these principles for review and acceptance, not as prerequisites for ordinary Skill use or component integration.

Reliability here means correctness, stability, usability and recoverability of the component, not a server-side high-availability architecture. This is the single source of development principles, required by the root `AGENTS.md`; other guides link here rather than copy the rules.

## 1. Reliable and Minimal

Keep code as small as practical without sacrificing correctness, stability, usability or maintainability.

- Choose the simplest sufficient solution; reuse existing capabilities instead of duplicating implementations or building speculative frameworks.
- Dependencies, abstractions and configuration need a clear benefit. Do not remove necessary validation, diagnostics or tests, or compress code at the expense of readability.

## 2. Start from User Tasks

Prioritize unusable, misleading or confusing behavior over feature expansion.

- Define the task, inputs, outputs and acceptance criteria first. Independently reproduce feedback rather than adopting the reporter's proposed fix uncritically.
- Prefer existing types, configuration, adapters and recipes. New types, entries or services must solve an identified user need.

## 3. Fix Root Causes

Fix shared validation, layout or rendering rather than patching only a demo; check related chart families.

- Distinguish incorrect examples from runtime defects. Do not hide defects by shortening labels, changing data or enlarging an example.
- Cover the cause and related boundaries with regressions. Where physical space is insufficient, preserve semantics and diagnose the limit instead of promising collision-free output at every size.

## 4. Make Agent Contracts Explicit

Inputs must be validatable, capabilities discoverable, state inspectable and diagnostics actionable; never silently ignore requests or change data meaning.

- Keep APIs, fields, defaults, types, manifests and documentation consistent. Explain normalization, fallback and unsupported requests in machine-readable diagnostics.
- Preserve stable IDs and reproducible Specs. Natural-language interpretation, authorization and persistence belong to the host, not a duplicate Agent service inside the component.

## 5. Stay Static and Safe by Default

Hosts explicitly enable navigation, editing and structural changes. Previews do not mutate committed state; failures do not partially publish.

- Do not enable zoom, pan, drag or editing implicitly, or unexpectedly change the viewport or manual composition.
- Follow the applicable preview, host-confirmation, revision and atomic-commit contract. Respect locks and deletion policies; stale previews must not overwrite new state.

## 6. Share One Source of Truth

SVG and Canvas share semantics and layout; avoid separate business implementations and explicitly diagnose unsupported capabilities.

- Data, layout and the Scene Graph are authoritative. Renderers draw them rather than interpret data or define editing behavior independently.
- Keep rendering, state, history and export consistent. Disclose browser, headless and profile limitations instead of promising unavailable capabilities.

## 7. Require Completion Evidence

Synchronize interfaces, types, documents and examples; verify the affected behavior, footprint and performance, and provide exact previews.

- Start with focused tests, then cover related capabilities, SVG/Canvas, history/reload and failures. User-visible layout and interaction changes require real-browser verification.
- Follow the existing quality gates without relaxing size or performance budgets. Synchronize bilingual guides, manifests, TypeScript and relevant recipes when contracts change.
- Report actual results, unverified checks or limits, exact preview URLs and acceptance actions. Never claim an unexecuted check passed.

For execution and checks, use the [Development Guide](../development-guide.md). Find plans and evidence in the [development index](README.md).
