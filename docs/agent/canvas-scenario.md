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

## Incremental Agent construction

This is the Board specialization of [Agent-driven Incremental Construction](conversational-workflow.md#agent-driven-incremental-construction). Read that guide for host prerequisites, complete semantic turns, confirmation UI and final task acceptance.

Reuse the same Board instance for visible, complete construction turns. Natural language belongs to the host Agent; the runtime accepts structured commands, not prompts. Discover `boardCapabilities.incrementalBuilding` (also `getCapabilities().canvasComposition.incrementalBuilding`). `boardCapabilities` is an object, not a function. Both the root and standalone `/board` entry support this workflow; `/board` embeds standard-family charts, while the root supports all chart families.

<!-- docs-check: incremental-board -->
```js
import { createBoard, validateBoardCommand } from '@taylorwong/ichartjs/board';

const board = createBoard({
  width: 1280, height: 720,
  editing: { enabled: true, allowStructuralChanges: true }
});
const command = { type: 'board-edit', operations: [
  { op: 'addItem', item: { id: 'note', kind: 'text', text: 'First insight',
    position: { x: 48, y: 48 }, size: { width: 320, height: 64 } } }
] };
const unsubscribe = board.subscribe(event => console.log(event.type, event.state));
if (!validateBoardCommand(command).valid) throw new Error('Invalid Board command');
const preview = board.previewEdit(command);
if (!preview.valid) throw new Error(JSON.stringify(preview.errors));
const result = board.applyEdit(preview.command, { preview, confirmed: true });
if (!result.valid) throw new Error(JSON.stringify(result.errors));
await board.ready();
console.log(board.getState().assetsReady, board.getState().health);
unsubscribe();
```

| Operation | Fields | Meaning |
| --- | --- | --- |
| `addItem` | `item` | Complete Board item with a stable ID. |
| `updateItem` | `itemId`, `changes` | Replace supplied fields; use `position`/`size` to explicitly move/resize, `spec` to replace an embedded ChartSpec. |
| `removeItem` | `itemId`, `policy?` | Default `reject` protects referencing connectors; explicit `cascade` also removes those connectors. |
| `addAsset` | `asset` | Complete image asset; may be added with its image item in the same turn. |
| `updateAsset` | `assetId`, `changes` | Replace source, alt text, or metadata. A changed source invalidates the image cache. |
| `removeAsset` | `assetId`, `policy?` | Default rejects image references; explicit cascade removes dependent images and their connectors. |

The `confirmed: true` example assumes the host has inspected `preview.spec/layout/warnings`, presented a non-editable preview and obtained approval. Do not automatically confirm untrusted Agent turns.

- `validateBoardCommand(command)` takes only the command, not `(boardSpec, command)`. It checks syntax; `board.previewEdit(command)` checks permissions, references, locked items, the final BoardSpec and renderability. Operation discriminators are `op`, not `type`. This is separate from chart `validateCommand()`.
- Commands must have `type: 'board-edit'` and 1–200 operations. Changes are shallow field replacements, not recursive patches. IDs, item kinds, asset types and locks cannot be changed through update commands; trusted hosts manage locks.
- Discover allowed changes in `incrementalBuilding.editableFields.common/itemTypes/asset`. Type-inapplicable fields are rejected, not ignored. Connector positions/sizes come from endpoints; update `from`/`to` or move the referenced items instead.
- Agent edits require `editing.enabled`; add/remove operations additionally require `allowStructuralChanges`. Every commit requires a current preview issued by this Board and explicit host confirmation. Changed commands, cross-instance previews and intervening changes are rejected without partial state.
- Each successful batch advances `getState().revision` once and adds one Undo entry. Preview does not render into the committed surface, load images, change history, or move any existing item. Locked items and their image assets are protected, including cascades.
- Board composition is **not Flow layering**. Coordinates are preserved, including embedded-chart boxes, manual drawings and the viewport policy. There is no automatic reflow/zoom/pan. For layout requests, inspect `getSpec()`, compute explicit positions (optionally with `planCanvas()`), then preview only the intended `updateItem` operations.
- Mount once to watch turns appear. `subscribe()` reports committed edits, history and asset readiness, not partial commands or streamed tokens. Asset events do not advance the composition revision. Await `ready()` after image edits; inspect each asset's `pending`/`loaded`/`failed` status. Headless `linked` means URL references only, not decoded raster images. Failed images remain diagnosed; `assetsReady` means loading has settled, not that all loads succeeded.
- Existing `update()`, `addItem()`, movement and history methods remain trusted-host APIs, not Agent authorization gates. Do not expose them directly to untrusted generated commands. Save `export({type:'json'})` in host storage; reloading a Spec starts a new instance with empty history.

Use the [incremental Board recipe](../../agent-recipes/boards/incremental-board.json) as starting Spec plus ordered templates, not an automatically executed task. The simpler default preview at `http://localhost:3000/playground/canvas-board.html` starts empty: **Next** adds the original three-chart composition, the iChart.js logo, the cat drawing, and arc/sector/Bezier examples in four turns. The left charts, upper-right logo and right drawing retain the full composition's positions, sizes, colors and layering; both modes reuse one fixture. **Previous step** undoes one turn; **Restart** clears the example. Existing items retain their positions. Next authorizes the displayed preset step; validation, preview and confirmed commit still run internally. No natural-language parser is included; finishing the example is not business-task acceptance.

The collapsed **Developer tools** retain editable commands, preview/confirmation, cancellation, history, Save/Reload and export. Use `?scenario=advanced` to open these tools, or `?scenario=composition` for the full chart/drawing composition. The default and `?scenario=incremental` use the simple example. Add `renderer=canvas` or `lang=zh-CN`/`lang=en` as query parameters; otherwise UI language follows the browser, with English fallback. Developer changes invalidate the simple sequence until Restart.

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

`position` and `size` are measured in board pixels and item sizes must be at least 16px. Shape polygon points and path points are normalized to `0..1` inside the item box. Keep item IDs unique and use string IDs so an Agent can explain, select, move, and audit items.

## Outputs and self-check

- `board.export({ type: 'json' })` returns the reproducible BoardSpec.
- `board.export({ type: 'svg' })` returns a headless SVG string and works without a DOM.
- Mounted Canvas boards can export PNG/JPEG in a browser.
- Always inspect `board.getState().health`, `board.getState().rendererSelection`, and `board.explain()` before delivery.

## Text and simple drawings

Text is a first-class whiteboard item. The layout order is: fit within the box, wrap to the configured `maxLines`, reduce to `minFontSize`, then truncate with an ellipsis as a last resort. `board.getState().layout.text` reports wrapping, scaling, and truncation per text item. Use a larger item box when the text is semantic content rather than decoration.

Latin text wraps at word boundaries; long unbreakable words scale and finally truncate instead of splitting letters. Connectors default to `zIndex: -1`, behind content, so a note's background can protect its text. Override stacking explicitly when required.

Use `shape: 'arc'` for an open curved stroke and `shape: 'sector'` for a filled fan. Use `kind: 'path', curve: 'cubic'` for a simple Bezier stroke with four normalized points: start, two controls, and end. These primitives render consistently in SVG and Canvas. Build simple drawings from several semantic items instead of sending arbitrary SVG path data; this keeps them inspectable and safe for Agents.

The repository includes a complete [cat drawing recipe](../../agent-recipes/drawings/cat.json). Load it as JSON, validate it with `validateBoardSpec()`, and pass it to `createBoard()` as a starting point for a simple drawing.

The repository preview is `http://localhost:3000/playground/canvas-board.html` after `npm run playground`. This is the single Freeform Board entry point; “whiteboard” describes the composition use case, not a second product mode.

The brand mark is available as the reusable [`agent-recipes/logo-spec.json`](../../agent-recipes/logo-spec.json) BoardSpec. It contains three congruent rhombi (parallelograms) tiling a regular hexagon and can be scaled by changing the board and item dimensions while preserving the normalized points.

## Boundaries

Iteration 19 intentionally does not add collaboration, OCR, video, rich-text editing, arbitrary SVG path data, a server, or a second persistence format. Keep domain data and chart Specs in the host application; persist the BoardSpec and asset references when the whiteboard must be rebuilt.
