# Contributing to iChart.js

iChart.js 2.0 is an Agent-first JavaScript charting and project-visualization runtime. Contributions should preserve deterministic behavior, renderer independence, capability discovery, and safe Agent-facing diagnostics.

## Development

Use Node.js 18 or newer.

```bash
npm install
npm run agent:check
npm run example:agent
npm run playground
```

Preview the maintained entry point at `http://localhost:3000/playground/index.html`.

## Pull Requests

1. Keep changes focused and compatible with the public ESM and TypeScript contracts.
2. Add or update tests for runtime behavior.
3. Update Agent documentation and capability manifests when public behavior changes.
4. Preserve stable record IDs, warnings, assumptions, and validation diagnostics.
5. Run `npm run agent:check`, `npm run example:agent`, and `git diff --check` before opening a pull request.
6. Include an exact Playground URL for changes that require visual acceptance.

## Scope

Geographic charts, 3D rendering, and 1.x compatibility are outside the 2.0 release scope unless the roadmap explicitly adds them.

Report security issues according to `SECURITY.md`, not through public issues.
