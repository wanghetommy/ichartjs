# Freeform Board Scenario

Use the Freeform Board when a page needs a bounded whiteboard surface that composes images, text, simple drawings, connectors, and embedded iChart.js charts. Simple drawing is a capability of the whiteboard, not a separate chart type. It is intentionally not a full Illustrator or Figma replacement.

## Minimal workflow

```js
import { createBoard } from '@taylorwong/ichartjs';

const board = createBoard({
  width: 1280,
  height: 720,
  renderer: 'auto',
  grid: { visible: true, size: 16, variant: 'dots' },
  assets: [{ id: 'logo', type: 'image', src: logoDataUrl, alt: 'Company logo' }],
  items: [
    { id: 'logo-item', kind: 'image', assetId: 'logo', position: { x: 48, y: 40 }, size: { width: 160, height: 80 } },
    { id: 'title', kind: 'text', text: 'Delivery overview', position: { x: 240, y: 48 }, size: { width: 360, height: 40 }, fontSize: 28 },
    { id: 'chart', kind: 'chart', position: { x: 48, y: 160 }, size: { width: 720, height: 440 }, spec: chartSpec }
  ]
});

board.mount('#board');
await board.ready();
console.log(board.explain(), board.getState());
```

## Renderer and interaction policy

- `renderer: 'svg'` is the default choice for small, text-heavy, accessible compositions.
- `renderer: 'canvas'` is appropriate for large scenes or raster-oriented delivery.
- `renderer: 'auto'` uses SVG for small/structured scenes and Canvas for more than 400 items. Interaction alone does not silently switch a small board to Canvas.
- Boards are static by default. Enable `editing`, `interaction.drag`, `interaction.zoom`, or `interaction.pan` explicitly.

## Images and constraints

Images are declared in `assets` and referenced by `assetId`; this keeps the BoardSpec JSON portable and lets the host own loading, persistence, and permissions. Use PNG/JPEG/WebP URLs or data URLs and provide `alt` text. `grid`, `snap`, `bounds`, locked items, and connector endpoints are the first constraints. `planCanvas()` can place an initial set of items without changing their semantic kinds.

## Supported items

| Item | Required fields | Notes |
| --- | --- | --- |
| `image` | `assetId`, `position`, `size` | PNG/JPEG/WebP URL or data URL; use `fit: contain`, `cover`, or `stretch`. |
| `text` | `text`, `position`, `size` | Wraps, scales, aligns, and truncates predictably; use `fontSize`, `lineHeight`, `maxLines`, `padding`, `textAlign`, and `verticalAlign`. |
| `shape` | `shape`, `position`, `size` | `rectangle`, `ellipse`, `diamond`, `hexagon`, normalized-point `polygon`, open `arc`, or filled `sector`. Arc angles use degrees. |
| `path` | `points`, `position`, `size` | Normalized-point `linear` paths or four-point `cubic` paths; arbitrary SVG path data is not accepted. |
| `connector` | `from`, `to` | References item IDs; supports `straight` and `orthogonal` routing. |
| `chart` | embedded `spec`, `position`, `size` | Reuses the normal chart Spec and Scene Graph. |

`position` and `size` are measured in board pixels. Shape polygon points are normalized to `0..1` inside the item box. Keep item IDs unique and use string IDs so an Agent can explain, select, move, and audit items.

## Outputs and self-check

- `board.export({ type: 'json' })` returns the reproducible BoardSpec.
- `board.export({ type: 'svg' })` returns a headless SVG string and works without a DOM.
- Mounted Canvas boards can export PNG/JPEG in a browser.
- Always inspect `board.getState().health`, `board.getState().rendererSelection`, and `board.explain()` before delivery.

## Text and simple drawings

Text is a first-class whiteboard item. The layout order is: fit within the box, wrap to the configured `maxLines`, reduce to `minFontSize`, then truncate with an ellipsis as a last resort. `board.getState().layout.text` reports wrapping, scaling, and truncation per text item. Use a larger item box when the text is semantic content rather than decoration.

Use `shape: 'arc'` for an open curved stroke and `shape: 'sector'` for a filled fan. Use `kind: 'path', curve: 'cubic'` for a simple Bezier stroke with four normalized points: start, two controls, and end. These primitives render consistently in SVG and Canvas. Build simple drawings from several semantic items instead of sending arbitrary SVG path data; this keeps them inspectable and safe for Agents.

The repository includes a complete [cat drawing recipe](../../agent-recipes/drawings/cat.json). Load it as JSON, validate it with `validateBoardSpec()`, and pass it to `createBoard()` as a starting point for a simple drawing.

The repository preview is `http://localhost:3000/playground/canvas-board.html` after `npm run playground`. This is the single Freeform Board entry point; “whiteboard” describes the composition use case, not a second product mode.

The brand mark is available as the reusable [`agent-recipes/logo-spec.json`](../../agent-recipes/logo-spec.json) BoardSpec. It contains three congruent rhombi (parallelograms) tiling a regular hexagon and can be scaled by changing the board and item dimensions while preserving the normalized points.

## Boundaries

Iteration 19 intentionally does not add collaboration, OCR, video, rich-text editing, arbitrary SVG path data, a server, or a second persistence format. Keep domain data and chart Specs in the host application; persist the BoardSpec and asset references when the whiteboard must be rebuilt.
