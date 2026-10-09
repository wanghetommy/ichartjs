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

## Agent 分步构建

这是 [Agent-driven Incremental Construction](conversational-workflow.md#agent-driven-incremental-construction) 的 Board 实现；宿主前提、完整语义步骤、确认界面和最终任务验收见统一指南。

在同一个 Board 实例上提交完整的语义步骤，用户即可看到逐步构建过程。自然语言由宿主 Agent 理解，iChart.js 只接收结构化命令。通过 `boardCapabilities.incrementalBuilding` 或 `getCapabilities().canvasComposition.incrementalBuilding` 发现能力；`boardCapabilities` 是对象，不是函数。根入口与 `/board` 都支持，后者仅嵌入基础分析类图表，根入口支持全部图表族。

<!-- docs-check: incremental-board -->
```js
import { createBoard, validateBoardCommand } from '@taylorwong/ichartjs/board';
const board = createBoard({ width: 1280, height: 720,
  editing: { enabled: true, allowStructuralChanges: true } });
const command = { type: 'board-edit', operations: [
  { op: 'addItem', item: { id: 'note', kind: 'text', text: '第一条洞察',
    position: { x: 48, y: 48 }, size: { width: 320, height: 64 } } }
] };
if (!validateBoardCommand(command).valid) throw new Error('命令无效');
const preview = board.previewEdit(command);
if (!preview.valid) throw new Error(JSON.stringify(preview.errors));
const result = board.applyEdit(preview.command, { preview, confirmed: true });
if (!result.valid) throw new Error(JSON.stringify(result.errors));
await board.ready();
console.log(board.getState());
```

`validateBoardCommand(command)` 只接收命令，不是 `(boardSpec, command)`；校验语法，实例 `board.previewEdit(command)` 再校验权限、引用、锁定项和最终布局。操作判别字段为 `op`，不是 `type`；不要混用 Chart 编辑函数。示例中的 `confirmed: true` 以宿主已检查预览并取得授权为前提，不可自动确认不可信 Agent 命令。

| 操作 | 字段 | 含义 |
| --- | --- | --- |
| `addItem` | `item` | 新增包含稳定 ID 的完整元素。 |
| `updateItem` | `itemId`, `changes` | 浅层替换指定字段；用 `position`/`size` 显式移动或缩放，用 `spec` 替换完整内嵌 ChartSpec。 |
| `removeItem` | `itemId`, `policy?` | 默认拒绝删除有连接引用的元素；显式 `cascade` 同时删除相关连接。 |
| `addAsset` | `asset` | 新增完整图片资源，可以和图片元素放在同一个事务。 |
| `updateAsset` | `assetId`, `changes` | 更新来源、描述或元数据；来源变化会清除旧图片缓存。 |
| `removeAsset` | `assetId`, `policy?` | 默认拒绝有图片引用的资源；显式级联删除相关图片及其连接。 |

示例中的 `confirmed: true` 以前置的宿主检查、静态预览和确认流程为前提；不要自动批准不可信 Agent 命令。

- 命令使用 `type: 'board-edit'`，每批 1–200 个操作；`validateBoardCommand()` 检查语法，Board 的 `previewEdit()` 检查权限、锁定项、最终引用、Spec 和可渲染性。不要用图表的 `validateCommand()` 校验 Board 命令。
- 通过 `incrementalBuilding.editableFields.common/itemTypes/asset` 查询可编辑字段；不适用于当前类型的字段会被拒绝，不会静默忽略。连接线的位置和尺寸来自端点，移动引用的元素或更新 `from`/`to`，不要直接修改连接线位置。
- `editing.enabled` 必须开启；增删还要求 `allowStructuralChanges`。每次提交必须使用当前 Board 签发的预览且由宿主确认。过期、跨实例或更改命令的预览不能提交。
- 一个成功事务只增加一次 revision 和一条撤销记录；预览不修改主画布、不加载图片。更新命令不能改 ID、kind、资源 type 或 locked；锁定项及其资源受到保护，级联删除也不能绕过。
- **默认保留已有坐标，不照搬 Flow 自动分层重排**。图表框、图片和简笔画位置都有意义。仅在宿主明确要求排版时计算目标坐标，预览指定的 `updateItem`；`planCanvas()` 可辅助规划，但不是自动重排开关。
- 挂载一次即可观察每轮构建；`subscribe()` 报告提交、历史与资源状态，不显示半条命令或逐 token 动画。资源状态事件不增加布局 revision。图片修改后等待 `ready()`，检查 `assets`、`assetsReady` 和 `health`；`assetsReady` 表示加载已结束，不代表全部成功。无 DOM 的 `linked` 仅表示外链，不代表图片已解码。
- 原有 `update()`、`addItem()`、移动和历史方法是可信宿主接口，不是 Agent 权限闸门，不要直接暴露给不可信生成命令。宿主保存 `export({type:'json'})`；重新加载 Spec 创建新实例，不恢复历史。

使用[增量 Board 配方](../../../agent-recipes/boards/incremental-board.json)作为起始 Spec 和分步模板，不是自动执行任务。默认预览 `http://localhost:3000/playground/canvas-board.html` 从空画布开始；点击四次**下一步**依次添加原来的三图表组合、iChart.js Logo、小猫简笔画和弧线/扇形/贝塞尔曲线示例。保留左侧图表、右上 Logo、右侧简笔画的位置、尺寸、配色和图层顺序，与完整组合共用一份示例数据。**上一步**撤销一轮，**重新开始**清空示例；已有内容不自动重排。下一步授权当前显示的预设步骤，内部仍执行校验、预览和确认提交。页面不解析自然语言，示例完成不等于业务任务验收通过。

默认折叠的**开发者工具**保留命令编辑、预览确认、取消、历史、保存重载和导出。`?scenario=advanced` 直接打开这些工具，`?scenario=composition` 打开完整图表/自由图形组合。默认及 `?scenario=incremental` 均为简单示例。可添加 `renderer=canvas`、`lang=zh-CN` 或 `lang=en` 查询参数；否则跟随浏览器语言，未识别语言回退英文。开发者工具更改画布后，需要重新开始才能继续简单示例。

## 渲染器和交互原则

- `renderer: 'svg'` 适合小型、文字较多、需要无障碍的组合内容。
- `renderer: 'canvas'` 适合大型场景或主要输出位图的场景。
- `renderer: 'auto'` 对小型或结构化场景使用 SVG，超过 400 个元素时使用 Canvas。仅仅开启交互，不会让小画布静默切换到 Canvas。
- 画布默认是静态的。需要编辑、拖动、缩放或平移时，宿主必须显式开启对应选项。

## 图片和约束

图片放在 `assets` 中，再通过 `assetId` 被画布元素引用，这样 BoardSpec 保持可持久化，资源加载、存储和权限由宿主负责。使用 PNG/JPEG/WebP URL 或 data URL，并提供 `alt` 文本。首批约束包括网格、吸附、边界、锁定元素和连接点；`planCanvas()` 可以为初始元素安排位置，同时保留元素语义。

## 支持的元素

英文文字优先按单词换行，不拆开字母；过长单词先缩小，达到最小字号后才截断。连接线默认 `zIndex: -1`，位于内容后方，有背景的文本卡片可保护文字；需要其他层级时显式设置。

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
