# Iteration 34 — Consumer Acceptance and Delivery Simplification

Release: `v2.0.34` (2026-10-17). The earlier candidate/published comparisons below record acceptance against the previous `v2.0.33` release.

## Scope

Use the published `@taylorwong/ichartjs@2.0.33` and tagged Skill in an isolated workspace, then repeat relevant checks against the candidate tarball. Reuse consumer, browser and package gates; add no chart types, runtime options, service or new Playground page. Do not change runtime behavior without a reproduced defect.

1. Follow the installed Skill for tabular trend delivery, multi-turn branching/looping Flow, and an existing browser host's resize/export lifecycle.
2. Check stable IDs, public validation/preview/commit APIs, SVG/PNG/JSON artifacts, warnings, intended-size readability and narrow-host limits. Fixed host approval in fixtures is not an autonomous Agent or human approval test.
3. Audit npm documentation links and resource boundaries. Keep consumer guides, Skill references, recipes, manifests and runtime/types; retain maintenance history in Git rather than the npm tarball. Validate links against the actual packed inventory and keep footprint budgets unchanged.

## Evidence and Limits

- Published runtime installation and `npx skills add` with the `v2.0.33` Skill directory succeeded in temporary storage, without changing global Skills.
- The installed package has six broken local Markdown/image links: README contribution/security/promo assets, a maintenance Playground link and both Diagram guides' editor links. Correct delivery references rather than shipping demos or large media.
- The original sparse Flow report is excluded from this scope at the user's request; it is not an acceptance blocker.

## Implemented

- Fix the six installed-package documentation/image links without shipping large promo assets or Playground pages. Resolve relative Markdown and README image links against the packed inventory in `package:check`, with three regression tests.
- Keep development records, historical iteration translations and TypeScript consumer fixtures out of npm. Required consumer guides, recipes, manifests, Skill resources and declarations remain included.
- Correct Profile capabilities and Board exports in declarations. Rendering Profiles do not export root planning/discovery or Chart editing APIs; Board no longer advertises nonexistent Chart exports. Declare the existing `FreeformBoard` constructor. Synchronize this distinction in the Skill and bilingual Quickstart/footprint guides. A real external task reproduced the erroneous Profile import before correction.
- Reuse public browser acceptance helpers for published and candidate installs. `consumer:browser -- --published=2.0.33 --artifacts=/absolute/output/path` tests the registry package; omit `--published` to test a local tarball. Outputs include SVG, PNG, JSON and physical-space limits. The strengthened return-route check now reproduces the published 2.0.33 defect; use the candidate to accept its fix. No version or footprint-budget changes.

## Initial Delivery Acceptance — 2026-10-17

- Published npm installation and pinned official Skill installation succeeded; installed Skill content matched the package. External Node planning, validation and SVG/JSON delivery passed.
- Published and candidate npm browser checks each passed 10 mounted-host lifecycle cases, 20 renderer/DPR export cases and four task cases (trend and incremental Flow, each SVG/Canvas). Flow previews were non-mutating; commit/history/reconstruction preserved stable nodes, edges and automatic layout. These checks establish API/data/export correctness, not unrestricted visual routing correctness.
- Focused source browser task regression passed. `npm run agent:check` passed, including 466 unit tests and package/types/contracts/consumer/profile/footprint checks. The complete browser suite was not rerun: this iteration changes no renderer/layout source.
- Trend PNG and Flow PNG were visually inspected. The CJK trend title, units and numeric labels were readable. Flow labels were intact at 768/1280px, with 16–48px automatic gaps; the 390px case correctly reported `FLOW_LAYOUT_OVERFLOW` without shrinking nodes or changing the viewport.

## Confirmed Reciprocal-Route Fix

The initial published-package task revealed that `submit-review` and `no` chose one path in reverse. The user authorized a focused fix after excluding the unrelated sparse-layout report.

- Shared scene construction detects reciprocal pairs. The shared router retains ordinary routing in one direction and requires an exterior return channel in the other, chosen by node geometry rather than edge-array order. It rejects the reversed forward route, including when an obstacle forces the forward edge to detour. No new option or layout engine is introduced.
- Both `auto` and `orthogonal` use node-shape avoidance and prefer return candidates inside the available plot near its boundaries. Explicit ports, valid manual routes and requested straight/curved geometry are preserved. Short terminal stubs may be shared; this does not promise global non-overlapping edges. A blocked return reports `EDGE_ROUTE_BLOCKED` instead of silently using the same path.
- Attachment points remain unchanged so an automatic return can become a persistent manual route. Tests cover horizontal/vertical placement, edge reordering, shaped obstacles, blocked paths, SVG/Canvas parity, consecutive edits, node movement, Undo/Redo and Spec reconstruction. Existing side-access checks were shared rather than duplicated to stay within the unchanged footprint limits.
- The Diagram Editor reuses its existing fixture and controls with `?scenario=editor&loop=1`; no new Playground page. SVG visual inspection confirms a separate return channel and a group frame enclosing it.

### Routing Acceptance

- `npm run agent:check` passed, including 471 unit tests; the focused routing/drag/readability/group/arrow suite passed 68 tests. Root and Diagram Profile output matched, including reordered edges and SVG/Canvas; the boundary regression checks both top and bottom plot edges.
- Three focused browser cases passed: the incremental delivery task and real SVG/Canvas return-channel dragging twice, moving QA, Undo/Redo and Save/Reload.
- `npm run performance:check` passed. Existing footprint limits remain unchanged; the routing fix adds 443 raw / 205 gzip bytes to the root source graph versus published 2.0.33. The 48px-gap delivery fixture additionally requires a return-channel horizontal leg of at least 24px, preventing a formally distinct but unreadable tiny U-turn.
- The complete browser regression passed 56 cases. All three affected-path browser cases passed again after the final narrow-gap and plot-boundary refinements, including Reset. The final candidate tarball passed 10 host lifecycle cases, 20 export cases and four task cases; both renderers passed separate/readable return-channel checks with no routing limitations. Exported PNGs and the source Diagram Editor were visually inspected. `git diff --check` passed.

Fixtures simulate a host confirming edits; they do not constitute an end-to-end Codex/WorkBuddy natural-language evaluation.

## Group-Boundary Clearance Follow-up — 2026-10-17

- Reproduced the user's existing edited Diagram Editor state without resetting it: the automatic `release` channel was only four diagram units from the final group frame, roughly 2.56 displayed pixels at its 0.6395 zoom. Node avoidance alone did not reserve group-boundary clearance.
- Build same-group routes and labels before external routes, then route against the final internal-content frame. Automatic `auto`/`orthogonal` routes prefer 12 diagram units beyond the source/destination group frame before turning. Necessary perpendicular frame crossings remain allowed; cross-group edges do not enlarge the group. Original edge indices and state ordering are preserved.
- Only after preferred safe candidates fail may a safe reduced-gap candidate be used, with `EDGE_GROUP_CLEARANCE_REDUCED`. Hard node avoidance, explicit ports, valid manual waypoints and requested straight/curved geometry remain unchanged. This is a bounded routing search, not a global optimality guarantee.
- Connector labels avoid the frame where space permits, and measure actual display-font geometry consistently with diagram zoom. This does not shrink fonts, move nodes or change the viewport. SVG and Canvas share the implementation.
- The focused source suite passed 78 cases, including 18 group tests for all four sides, entering/leaving groups, reordered edges, root/Profile parity, zoom, constrained fallback and manual-route history/reconstruction. Five focused browser cases passed, including actual SVG text bounds at 0.64 zoom and Canvas export, constrained fallback/recovery and repeated return-channel editing. `npm run agent:check` passed with 481 unit tests; `npm run performance:check` passed.
- The user explicitly approved retaining the complete fix with a separately reviewed measured budget increment. `fixAllowance` records exactly 1,432 raw / 493 gzip bytes against the preceding candidate (615,162 raw / 153,062 gzip). Original baselines, 15% growth, the Iteration 33 allowance and npm package/unpacked limits remain unchanged. Earlier unchanged-budget statements above describe the prior acceptance stage.
- Final full browser regression passed 58 cases. The installed candidate tarball passed 10 host-lifecycle, 20 renderer/DPR export and four Agent-task cases. The user's original edited layout was reconstructed in a separate Canvas preview tab and visually inspected without resetting the original tab. Bilingual guides, package links, refreshed footprint and `git diff --check` passed. Evidence is in `/tmp/ichart-iteration-34/group-clearance-*.log`; the preview screenshot is `group-clearance-preview.jpg` in that directory.

## Fixed Budget Consolidation — 2026-10-17

After reviewing the remaining 30-byte root gzip headroom, the user approved replacing the additive limit formula with fixed ceilings: 655,360 raw bytes (640 KiB), 163,840 gzip bytes (160 KiB), 405,935 tarball bytes and 1,440,743 unpacked bytes. The npm ceilings are unchanged. Original baselines, the 15% growth rule and reviewed Iteration 33/34 increments remain in the generated report's `budget.history` as audit evidence, not active allowances. Limits do not roll forward with releases. Earlier budget statements describe their respective acceptance stages; this is the current policy. No runtime behavior or version changes are included.

Acceptance: the focused suite passed 10 tests, including exact ceilings, one-byte-over rejection, below-limit acceptance and unchanged npm limits. The refreshed footprint and `npm run agent:check` passed with 481 unit tests, as did `git diff --check`. Root measurements remain 616,594 raw / 153,555 gzip bytes, leaving 38,766 raw / 10,285 gzip bytes of headroom. Bilingual guides and the generated Playground report are synchronized. No browser rerun was needed for this budget-only follow-up; the preceding layout acceptance remains recorded above.

## Package Measurements

| Metric | Published 2.0.33 | Reciprocal-route candidate | Final group-clearance candidate |
| --- | ---: | ---: | ---: |
| Packed files | 160 | 120 | 120 |
| Tarball bytes | 405,645 | 327,855 | 329,685 |
| Unpacked bytes | 1,437,027 | 1,213,107 | 1,217,670 |
| Root source graph, raw bytes | 614,719 | 615,162 | 616,594 |
| Root source graph, gzip bytes | 152,857 | 153,062 | 153,555 |

The table separates the reciprocal-route acceptance stage from the group-clearance follow-up before the release-version and Changelog update. Package figures come from the installed release and candidate pack report; `playground/footprint.json` remains the generated source of truth for release bytes. The reduction is npm delivery size, not browser-code savings. The follow-up's separately reviewed source increment and subsequent fixed-limit approval are recorded above.

## Preview

Current source previews: `http://localhost:3000/playground/diagram-editor.html?scenario=editor&loop=1` and the same URL with `&renderer=canvas`. Drag the return channel twice, move QA, and verify Undo/Redo and Save/Reload. The temporary v2.0.33 published-package host on port 3001 remains a baseline, not a preview of this fix. Temporary artifacts live outside the repository in `/tmp/ichart-iteration-34/`.

## v2.0.34 Release Acceptance — 2026-10-17

- Synchronized package/lockfile, runtime and Playground version displays, release-pinned npm/GitHub/Skill guidance, capability manifests, Changelog and release indexes.
- `npm run agent:check` passed with 481 unit tests; the complete browser suite passed 58 cases. Documentation snippets passed nine Node scenarios with 19 tracked blocks; their mounted cases run in the browser suite. Performance and `git diff --check` passed.
- Regenerated the production bundle report for the local v2.0.34 tarball. Installed-package browser acceptance passed 10 host lifecycle cases, 20 renderer/DPR export cases and four Agent-task cases.
- The publish dry run contains 120 files, 329,986 tarball bytes and 1,218,630 unpacked bytes. Root source remains 616,594 raw / 153,556 gzip bytes, below the approved fixed ceilings. Maintenance records and test fixtures are excluded from npm.
- Evidence: `/tmp/ichart-release-2.0.34-{agent,browser,snippets,performance,bundle,consumer-browser}.log`, the publish dry-run JSON and `/tmp/ichart-release-2.0.34-delivery/` artifacts. npm identity and registry were verified before publication.
