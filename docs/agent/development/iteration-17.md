# Iteration 17 — Production Trust and Agent Reliability

Iteration 17 hardens the existing chart runtime for production Agent use. It adds no chart type, no CLI, no MCP server, and no HTTP service.

## 17A — Contract Reliability

- Diagnose unknown top-level Spec options instead of silently ignoring them.
- Keep `validateSpec()`, normalization, `createChart()`, capabilities, TypeScript, and manifests aligned.
- Preserve stable diagnostic codes, JSON paths, expected values, and actionable suggestions.

## 17B — Agent Self-check

- Expose effective rendering options and normalization results through `chart.explain()`.
- Report unsupported renderer requests during `planChart()` instead of returning only a fallback.
- Publish `agentReliability` in `getCapabilities()` and `capabilities.json`.
- Keep navigation, editing, and motion safe by default.

## 17C — Package and Integration Confidence

- Add a package dry-run gate for required runtime, TypeScript, Skill, recipes, and capability files.
- Reject accidental publication of `.trae`, `.github`, tests, and Playground development paths.
- Keep the consumer TypeScript fixture and ESM/headless examples in the release gate.

## 17D — Rendering and Accessibility Acceptance

- Continue SVG/Canvas parity checks for labels, diagrams, exports, and responsive layouts.
- Keep browser acceptance separate from headless checks and require explicit local-server evidence.
- Preserve static, safe defaults while testing opt-in navigation and editing.

## 17E — Open Source Maintenance

- Keep `CONTRIBUTING.md`, `SECURITY.md`, CI, release SOP, Skill, and Agent guides aligned.
- Record package and contract checks as mandatory contribution and release gates.

## Acceptance

```text
inspect data
→ plan chart
→ validate Spec
→ create chart
→ inspect effective options and health
→ preview/export
```

- Invalid or ignored configuration is diagnosable.
- An Agent can verify what actually rendered without reading renderer internals.
- The npm tarball contains only supported consumer artifacts.
- `npm run agent:check`, browser acceptance, and `git diff --check` pass.

## Out of Scope

- New chart types.
- NLP parsing inside the runtime.
- CLI, MCP, HTTP, Python, or 1.x compatibility layers.
