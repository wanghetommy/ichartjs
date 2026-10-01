# Iteration 19 — Whiteboard Foundation

## Goal

将 Freeform Board 明确为轻量白板组合层。简笔画不是新的图表类型，而是由白板基础几何能力和可复用 Recipe 组合出来的应用能力。

## Delivered scope

### 19A — Whiteboard text

- 文本支持 `fontSize`、`fontFamily`、`fontWeight`、`lineHeight`、`padding`。
- 支持 `textAlign` 和 `verticalAlign`。
- 默认按“适配 → 换行 → 缩小 → 最后截断”处理，不静默溢出。
- `board.getState().layout.text` 暴露每个文本元素的换行、缩放和截断状态。
- 截断会在 `validateBoardSpec()` / `board.explain()` 中报告 `TEXT_TRUNCATED`。

### 19B — Drawing geometry

- `shape: 'arc'`：开放弧线。
- `shape: 'sector'`：填充扇形，可选 `innerRadius` 形成环形扇区。
- `kind: 'path', curve: 'linear'`：归一化点位路径。
- `kind: 'path', curve: 'cubic'`：四点三次贝塞尔路径。
- 角度统一使用 degrees；点位使用元素内部 `0..1` 归一化坐标。
- 不接受任意 SVG `path d`，避免不可审计和不可控输入。

### 19C — Renderer parity

- SVG、Canvas、headless SVG 保持 `arc`、`sector`、linear path、cubic path 语义一致。
- 文本布局通过多个 Scene Graph 文本节点输出，保持导出可读性。

### 19D — Drawing Recipes

- 新增 `agent-recipes/drawings/cat.json`。
- Recipe 由椭圆、多边形、弧线和贝塞尔路径组成，可被 Agent 校验、组合、缩放和修改。

### 19E — Agent discovery and preview

- `getCapabilities().canvasComposition` 暴露 geometry 和 text contract。
- 更新英文、中文白板场景指南和官方 Skill。
- 合并到唯一预览：`http://localhost:3000/playground/canvas-board.html`。

## Explicit non-goals

本轮不增加富文本编辑器、Markdown、任意 SVG path、协作、OCR、视频、服务端或第二套持久化格式。

## Acceptance

```bash
npm run contracts:generate
npm run agent:check
npm run test:browser
npm run playground
```

预览：`http://localhost:3000/playground/canvas-board.html`。
