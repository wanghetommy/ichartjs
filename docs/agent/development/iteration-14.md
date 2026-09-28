# Iteration 14 — Lightweight Flow Semantics

Iteration 14 enhances the existing `flow` chart instead of adding a new chart type. The goal is a small, readable process notation that an Agent can generate from a compact JSON Spec without introducing BPMN-level complexity.

## Scope

### 14A — Semantic nodes

Flow nodes support the following `kind` values:

| Kind | Shape | Meaning |
| --- | --- | --- |
| `start` | ellipse | Process start |
| `end` | ellipse | Process end |
| `process` | rectangle | Operation or step |
| `decision` | diamond | Condition with branches |
| `io` | parallelogram | Input or output |
| `connector` | circle | Explicit hand-off point for a disconnected flow |

Nodes without `kind` use `process` as the minimal default. Non-Flow diagrams continue to use their existing node visual language.

### 14B — Process structures

- Sequential execution uses ordinary `from` → `to` edges.
- Decision branches use `edge.label`, normally `yes` / `no` or localized equivalents.
- Loops are ordinary edges that point to an earlier node; cycles are allowed for Flow.
- Connectors never use implicit matching. Every connection is explicit in `edges`.

The capability contract exposes these rules through `getCapabilities().diagram.flowNodeKinds`, `flowBranchEdges`, `flowLoops`, and `flowConnectors`.

### 14C — Layout and rendering

- Existing layered, manual, and orthogonal layout/routing remain the source of truth.
- Semantic shapes share the existing Scene Graph, hit testing, selection, edge routing, export, and accessibility surfaces.
- SVG and Canvas use the same node geometry and edge path data.
- Process-only Flow remains concise when `kind` is omitted; this is a convenience default, not a migration compatibility promise. Non-process semantics should use an explicit `kind`.

### 14D — Validation and Agent guidance

- Unknown `nodes[].kind` values are validation errors.
- A semantic `decision` with fewer than two outgoing edges produces `FLOW_DECISION_BRANCHES`.
- Semantic Flows without `start` or `end` produce actionable warnings.
- Unlabeled connectors produce `FLOW_CONNECTOR_LABEL` as a readability warning.
- Flow schemas, TypeScript declarations, recipes, bilingual guides, manifests, and focused tests stay synchronized.

## Acceptance

- All six node kinds render in both SVG and Canvas.
- Sequential, branch, and loop structures validate and render.
- Connector paths remain explicit and inspectable through `explain()` / JSON export.
- Old rectangle-only Flow examples remain renderable through the `process` default.
- `npm run contracts:check`, `npm run types:check`, `npm run docs:check`, `npm test`, and browser acceptance pass.

## Non-goals

- No `note` node in this iteration.
- No BPMN events, gateways, subprocesses, or implicit connector name resolution.
- No new chart type, CLI, MCP, HTTP, or Python runtime.
