# Runtime 契约

三个开发场景共用的 Runtime 规则。

[图表文本与标注](text-annotations.md) 定义文字拟合、换行、参考线和稳定 ID 标注。从 root 的 `getCapabilities().text` / `.annotations` 发现契约，数据标注保存在 `ChartSpec.annotations`，不要当作临时像素线插件。

## 标准流程

```text
getCapabilities → inspectData → planChart → 创建 Spec → validateSpec → createChart → 解释并检查状态
```

Agent 应优先使用 `getCapabilities()`，不要硬编码未声明的图表类型或操作。

图表创建后的视觉设置使用 `getPreferenceCapabilities(chartType, { locale }) → chart.getPreferences() → validatePreferences(patch) → chart.setPreferences(patch, { source: 'agent' }) → chart.getState().preferences`。这样 Agent 与内置设置菜单始终使用同一份白名单契约。

有效偏好优先级为 `defaults → chart Spec → global PreferencesStore → chart PreferencesStore`。使用 `chart.getState().preferenceResolution` 查看当前作用域、存储方式和来源。Runtime 不解析自然语言，请使用[自然语言修改工作流](conversational-workflow.md)把自然语言分流到正确的修改 API。

Iteration 8 通过 `getChartCapability(type)` 提供逐图表能力档案，包括必需数据角色、支持的交互、Renderer、功能状态、导出和建议限制。Agent 不应猜测未声明能力。

`planChart(data, { intent, renderer })` 返回版本化规划结果：主选图表、备选项、置信度、原因、缺失字段、建议编码、假设、警告、不支持请求和安全下一步。规划不会虚构业务含义、单位、日期或缺失字段。

未知 intent 还会返回 `intentKnown`、`intentSuggestions` 和 `fallbackUsed`。Spec 的通道按图表类型约束：笛卡尔图表是 `x`/`y`，Pie/Funnel 是 `category`/`value`，Gauge 只使用 `value`，Heatmap 是 `x`/`y`/`color`，Radar 字段位于 `indicators`。`validateSpec()` 会拒绝不支持的通道和缺失字段。Gauge 必须显式声明 `domain`，超出范围时会报告 `VALUE_CLAMPED`；Pie 的负值报告 `NEGATIVE_VALUE_DROPPED`，没有正数占比时 `ZERO_TOTAL` 会使校验失败。

`validateSpec()` 分开返回 `errors`、`warnings` 和 `normalizations`；诊断包含稳定代码、JSON 路径、期望值和修复建议。未知顶层选项会返回 `UNKNOWN_SPEC_OPTION`，不会静默当作有效配置。`chart.explain()` 返回编码、转换、交互、实际生效选项、规范化结果、假设、警告、稳定记录血缘和无障碍摘要。

## 关键规则

增量 Flow 复用 `previewEdit()` / `applyEdit()`，新增 `addNode` / `removeNode` 并组合既有节点和连线命令。通过 `getChartContract('flow').incrementalBuilding` 发现完整契约；布局预览为 `preview.layout`，实际布局为 `getState().layout.diagram` / `explain().layout.diagram`，坐标不包含 view 变换。结构编辑始终需要宿主确认，删除策略及保存重载边界见 [Diagram 指南](diagram-scenario.md)。

- Spec 必须是 JSON-serializable。
- 渲染前调用 `validateSpec()`。
- 布局和数据语义不依赖 Renderer。
- Diagram 结构字段必须位于 Spec 顶层：通用图表使用 `data.values`；Flow/Swimlane 使用 `nodes/edges/lanes`，Architecture 使用 `nodes/edges/layers/boundaries`，Mindmap 使用带 `parentId` 的 `nodes` 和可选 `edges`。不要将这些字段放在 `data` 内。
- `svg` 适合 DOM 交互和可访问性；`canvas` 适合大量图元和绘制性能。
- 使用 `renderer: "auto"` 时，iChart.js 会在创建时进行一次确定性选择：小型或文字/结构密集场景使用 SVG，大量图元场景使用 Canvas。仅仅开启连续交互不会强制使用 Canvas；如果大场景同时存在连续交互，交互只作为附加选择原因返回。数据后续变化时不会自动替换 Renderer；Agent 可通过 `chart.getState().rendererSelection` 和 `chart.explain().renderer` 检查实际 Renderer 及原因。显式指定 `svg` 或 `canvas` 时始终优先。
- 数值纵轴默认使用易读域（`yAxis.nice: true`、`yAxis.ticks: "auto"`）；使用 `yAxis.domain: [min, max]` 固定范围，或使用 `yAxis.nice: false` 保留原始边界。Agent 可通过 `chart.getState().axes` 或 `chart.explain().axes` 自检原始域、计算域、刻度、步长和策略。分类/时间横轴的 `min/max` 和 `domain` 不支持，范围由数据确定。
- Timeline 和 Milestone 的 `chart.getState().timeAxis` 与 `chart.explain().timeAxis` 会返回 `orientation: "horizontal"`、`field: "date"`、`coordinate: "x"`、`rowCoordinate: "y"`、数值 `domain` 和 ISO `domainISO`。验收事件日期时应比较 `x`/`cx`；y/`cy` 只是事件行布局坐标。
- `chart.getState().health` 和 `chart.explain().health` 提供 `ready`、`degraded` 或 `empty`，以及可渲染性、问题代码、警告数、隐藏标签数、限制值数和已渲染标记数。`locale` 默认 `en-US`，可设置 `zh-CN` 影响输出格式；输入日期应使用 ISO-8601 字符串。

## 品牌署名（Branding）

iChart.js 默认在所有图表右下角显示低对比度的品牌署名（`Powered by iChart.js`），用于提升项目可见性。

### 配置项

- 在 Spec 或 Theme 中通过 `branding` 字段控制：
  - `branding: true`（默认）：开启署名。
  - `branding: false`：关闭署名。
  - `branding: { enabled: true }`：细粒度配置形式。

### 一致性保证

署名开关由 `buildScene()` 内统一总闸判定，以下四个面必然同步：
1. 浏览器 Canvas/SVG 画面渲染。
2. `chart.export({ type:'png|jpeg' })` 光栅导出。
3. `chart.export({ type:'svg' })` 矢量导出。
4. `chart.export({ type:'json' })` 中 `spec.branding` + `state` 持久化状态。

关闭 `branding:false` 时，画面和所有导出产物都不会出现署名文字，同时不会再额外预留底部 padding。

## 导出与下载

iChart.js 导出采用**双底层单源架构**，所有产物共享 `buildScene()` 生成的同一份 Scene Graph，**画面显示用的 renderer 和导出底层完全解耦**：
1. **PNG/JPEG（光栅）**：底层用 `CanvasRenderer` 重绘 Scene Graph；浏览器同步输出真光栅文件，无头环境通过 `exportAsync()` 加载可选的 `canvas` npm 包。
2. **SVG（矢量）**：底层用 `SVGRenderer` DOM 序列化（浏览器）或纯字符串拼装（无头零依赖），支持 XML 1.0 头部、字体拆分、无障碍属性。
3. **JSON（可重建）**：序列化当前 `spec` + `getState()` 结果，用于持久化、Agent 自检和跨端重建。

### Branding 一致性

开关由 `buildScene()` 内统一总闸判定，画面渲染 / SVG 导出 / PNG 导出 / JSON state 必然同步。

### Headless 支持矩阵

| 类型       | 浏览器环境（任意 renderer） | Node 无头零依赖 | Node 无头 + `canvas` 依赖 |
|------------|----------------------------|----------------|--------------------------|
| JSON       | ✅                          | ✅              | ✅                        |
| SVG        | ✅                          | ✅              | ✅                        |
| PNG / JPEG | ✅ 同步真光栅               | ❌ 返回结构化 `HEADLESS_EXPORT_UNSUPPORTED` | ✅ 通过 `exportAsync()` |

### Freeform Board 事务

根入口与 `/board` 提供 `validateBoardCommand()`，Board 实例提供 `previewEdit(command)` / `applyEdit(command, {preview, confirmed:true, expectedRevision?})`；命令使用 `type: board-edit`。成功批次增加一次 revision 与一条历史记录；无效、过期或未经确认的命令不提交。预览返回 `spec`、画布坐标 `layout`、受影响元素/资源 ID 和诊断。Agent 操作受显式编辑/结构权限及锁定项约束，旧的直接 Board API 仍是可信宿主接口。

状态提供 `revision`、`lastChange`、`layout.items/text`、`assetsReady` 和资源状态。`subscribe(listener)` 返回取消订阅函数，通知 `edit`、`history`、`assets`；资源事件不增加 revision。图片修改后调用 `ready()`，JSON 保存 BoardSpec 而非历史/已解码图片。Board 不自动重排已有坐标；位图输出仍需已挂载 Canvas。详见 [Freeform Board 场景](canvas-scenario.md)。

### 公共导出 API

- `chart.toDataURL(type='image/png')` → data URL 字符串或结构化 ExportError。
- `chart.toBlob(type='image/png')` → Blob 或 ExportError（无头同步路径不提供光栅 Blob）。
- `chart.export({ type, as })` → 同步返回字符串 / JSON 对象 / Blob / ExportError，`as` 支持 `string`、`dataurl`、`blob`、`object`（仅 JSON）。
- `chart.exportAsync({ type, as })` → Promise 导出路径；Node 无头环境可通过可选 `canvas` 依赖生成 PNG/JPEG。
- `chart.download({ type })` / `downloadPNG()` / `downloadSVG()` / `downloadJSON()` → 触发浏览器保存（无头回落到返回字符串或结构化错误）。

### 错误结构

所有导出/下载方法失败时统一返回 `{ valid:false, code, message?, suggestion?, rasterCode? }` 稳定结构，便于 Agent 自动化判断，常见 `code`：
- `HEADLESS_EXPORT_UNSUPPORTED`：当前无头环境缺少光栅所需依赖（`canvas`）。
- `BLOB_HEADLESS`：同步 `toBlob` 无法在当前无头 renderer 上生成光栅 Blob；Node 光栅场景改用 `exportAsync()`。
- `DOWNLOAD_HEADLESS`：`chart.download*()` 仅在浏览器有 DOM 时可用，无头用 `export`。
- `EXPORT_TYPE_UNSUPPORTED`：不支持的导出类型。

所有状态变更都经过同一校验边界。成功的 `update()` 和 `setData()` 返回当前 Chart；无效输入抛出 `ChartValidationError`，包含稳定的 `code`、`details`、`path`、`expected`、`received` 和 `suggestion`。拒绝变更后，原 Spec、Scene、选择状态、revision 和历史记录保持不变。`applyPatch()` 是高级 JSON Pointer 接口，也会在提交前校验。

`chart.applyPatch(patches)` 只支持 `add`、`replace`、`remove`，不是完整 JSON Patch 引擎。路径父项必须是已有自有属性；`~1`、`~0` 分别转义 `/`、`~`。值须为有限、无环的 JSON，add/replace 必须提供 `value`。对象 add 设置属性，replace/remove 要求目标已存在。数组 add 在 0 至 length 的索引处插入，`-` 仅用于追加；replace/remove 必须命中已有索引，删除后后续项前移。非法索引、转义、继承/不安全路径或不存在的目标会明确拒绝，不静默忽略。每步读取前一步的候选结果，最终统一校验 Spec，整批提交或回滚。空批次不改变状态。

Patch 与 `update()` 一样是可信宿主变更，成功后清空编辑历史并使待提交预览失效，不提供 Agent 授权或 Undo 事务。Agent 增量构建优先使用稳定 ID 的 `previewEdit()` / `applyEdit()`；不要通过 Patch 或直接写入 `chart.spec` 绕过权限与确认。

公共 API：`inspectData`、`normalizeData`、`planChart`、`recommend`、`validateSpec`、`createChart`、`getCapabilities`、`getChartCapability`、`getPreferenceCapabilities`、`validatePreferences`、`chart.describe`、`chart.explain`、`chart.getState`、`chart.getState().health`、`chart.explain().health`、`chart.getPreferences`、`chart.setPreferences`、`chart.resetPreferences`、`chart.selectEdges`、`chart.getSelectedEdgeIds`、`chart.deleteSelectedEdges`、`chart.export`、`chart.exportAsync`、`chart.toDataURL`、`chart.toBlob`、`chart.download`、`chart.downloadPNG`、`chart.downloadSVG`、`chart.downloadJSON`。

实现位置：`src/index.mjs`、`src/spec.mjs`、`src/scene.mjs`、`src/renderer.mjs`、`src/plugin.mjs`、`src/scale.mjs`、`src/charts.mjs`、`src/capabilities.mjs`。
