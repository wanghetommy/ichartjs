# Iteration 18 — Freeform Board

## Goal

Add a small composition layer for Agent-generated visual surfaces without turning iChart.js into a general-purpose whiteboard product.

## Delivered scope

- `BoardSpec` and `validateBoardSpec()` for bounded compositions.
- Image assets separated from board items, with MIME, size, source-safety, and alt-text diagnostics.
- `image`, `text`, `shape`, `connector`, and embedded `chart` items.
- Shared Scene Graph output through SVG and Canvas renderers.
- `renderer: 'auto'`: SVG for small/structured boards, Canvas for scenes above 400 items.
- Grid, snap, bounds, locked items, connector endpoint validation, selection, move, resize, and bounded undo/redo.
- `planCanvas()` for deterministic initial placement.
- `board.getState()` and `board.explain()` for Agent self-checks.
- JSON and headless SVG export; browser Canvas PNG/JPEG export when mounted.
- English and Chinese Agent guidance plus `playground/canvas-board.html`.

## Explicit non-goals

No collaboration, OCR, video, arbitrary embeds, server, CLI, MCP service, or second persistence format. The host owns asset loading, persistence, authentication, and application routing.

## Acceptance

```bash
npm run contracts:generate
npm run agent:check
npm run test:browser
npm run playground
```

Preview: `http://localhost:3000/playground/canvas-board.html`.
