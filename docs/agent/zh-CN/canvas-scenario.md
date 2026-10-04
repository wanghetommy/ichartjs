# Freeform Board 场景

当页面需要在一个有边界的白板中组合图片、文字、简笔画、连接线和多个 iChart.js 图表时，使用 Freeform Board。简笔画是白板的能力，不是新的图表类型。它有意不做成完整的 Illustrator 或 Figma 替代品。

## 最小工作流

```js
import { createBoard } from '@taylorwong/ichartjs';

const board = createBoard({
  width: 1280,
  height: 720,
  renderer: 'auto',
  grid: { visible: true, size: 16, variant: 'dots' },
  assets: [{ id: 'logo', type: 'image', src: logoDataUrl, alt: '公司标志' }],
  items: [
    { id: 'logo-item', kind: 'image', assetId: 'logo', position: { x: 48, y: 40 }, size: { width: 160, height: 80 } },
    { id: 'title', kind: 'text', text: '交付概览', position: { x: 240, y: 48 }, size: { width: 360, height: 40 }, fontSize: 28 },
    { id: 'chart', kind: 'chart', position: { x: 48, y: 160 }, size: { width: 720, height: 440 }, spec: chartSpec }
  ]
});

board.mount('#board');
await board.ready();
console.log(board.explain(), board.getState());
```

## 渲染器和交互原则

- `renderer: 'svg'` 适合小型、文字较多、需要无障碍的组合内容。
- `renderer: 'canvas'` 适合大型场景或主要输出位图的场景。
- `renderer: 'auto'` 对小型或结构化场景使用 SVG，超过 400 个元素时使用 Canvas。仅仅开启交互，不会让小画布静默切换到 Canvas。
- 画布默认是静态的。需要编辑、拖动、缩放或平移时，宿主必须显式开启对应选项。

## 图片和约束

图片放在 `assets` 中，再通过 `assetId` 被画布元素引用，这样 BoardSpec 保持可持久化，资源加载、存储和权限由宿主负责。使用 PNG/JPEG/WebP URL 或 data URL，并提供 `alt` 文本。首批约束包括网格、吸附、边界、锁定元素和连接点；`planCanvas()` 可以为初始元素安排位置，同时保留元素语义。

## 支持的元素

| 元素 | 必需字段 | 说明 |
| --- | --- | --- |
| `image` | `assetId`、`position`、`size` | 支持 PNG/JPEG/WebP URL 或 data URL；`fit` 可用 `contain`、`cover`、`stretch`。 |
| `text` | `text`、`position`、`size` | 支持换行、缩放、对齐和可预测截断；使用 `fontSize`、`lineHeight`、`maxLines`、`padding`、`textAlign` 和 `verticalAlign`。 |
| `shape` | `shape`、`position`、`size` | 支持矩形、椭圆、菱形、六边形、归一化点位多边形、开放 `arc` 和填充 `sector`；弧度使用角度值。 |
| `path` | `points`、`position`、`size` | 支持归一化点位的 `linear` 路径或四点 `cubic` 贝塞尔路径；不接受任意 SVG path 数据。 |
| `connector` | `from`、`to` | 引用元素 ID，支持 `straight` 和 `orthogonal`。 |
| `chart` | 嵌入式 `spec`、`position`、`size` | 复用普通图表 Spec 和 Scene Graph。 |

`position` 和 `size` 使用画布像素，元素尺寸至少为 16px。`polygon` 和 `path` 的点位归一化到元素盒子的 `0..1` 范围。元素 ID 必须唯一，并使用字符串 ID，便于 Agent 解释、选择、移动和审计。

## 输出和自检

- `board.export({ type: 'json' })` 输出可复现的 BoardSpec。
- `board.export({ type: 'svg' })` 输出无头 SVG 字符串，不依赖 DOM。
- 浏览器中挂载的 Canvas 画布可以导出 PNG/JPEG。
- 交付前检查 `board.getState().health`、`board.getState().rendererSelection` 和 `board.explain()`。

## 文本与简笔画

文字是白板的一等元素。布局顺序是：先在元素框内适配，按 `maxLines` 换行，再缩小到 `minFontSize`，最后才使用省略号截断。`board.getState().layout.text` 会逐项报告换行、缩放和截断状态。文字表达语义内容时，应优先增大元素尺寸，而不是依赖截断。

使用 `shape: 'arc'` 表示开放弧线，使用 `shape: 'sector'` 表示填充扇形；使用 `kind: 'path', curve: 'cubic'` 表示四个归一化点位的简单贝塞尔线：起点、两个控制点和终点。它们在 SVG 和 Canvas 中保持一致。简笔画应由多个有语义的元素组合而成，不要直接传任意 SVG path 数据，这样便于 Agent 检查和修改。

仓库提供了完整的 [猫咪简笔画 Recipe](../../../agent-recipes/drawings/cat.json)。可将其作为 JSON 加载，先调用 `validateBoardSpec()`，再传给 `createBoard()` 作为简笔画起点。

启动 `npm run playground` 后，可在 `http://localhost:3000/playground/canvas-board.html` 预览；这是唯一的 Freeform Board 入口，“白板”只是对组合场景的说明，不是第二种产品模式。

品牌 Logo 提供为可复用的 [`agent-recipes/logo-spec.json`](../../../agent-recipes/logo-spec.json) BoardSpec。它由三个全等菱形（也是平行四边形）拼成正六边形；修改画布和元素尺寸即可等比缩放，归一化坐标保持不变。

## 边界

Iteration 19 暂不增加协作、OCR、视频、富文本编辑、任意 SVG path 数据、服务端或第二套持久化格式。领域数据和图表 Spec 仍由宿主管理；需要重建白板时保存 BoardSpec 和资源引用即可。
