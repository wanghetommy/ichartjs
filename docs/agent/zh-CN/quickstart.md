# Agent 快速上手

当 Agent 需要把业务数据、项目数据或流程数据转换为 iChart.js 可视化时，使用本指南。只依赖公开契约，不读取渲染器或图表内部实现来猜测能力。

## 引用入口

```js
import {
  createChart,
  getCapabilities,
  getChartCapability,
  inspectData,
  planChart,
  validateSpec
} from '@taylorwong/ichartjs';
```

- `@taylorwong/ichartjs`：统一的 Agent 规划与 Runtime API。
- `@taylorwong/ichartjs/capabilities.json`：机器可读能力清单，包含逐图表导出、署名和交互声明。
- `@taylorwong/ichartjs/recipes/*`：基础分析、项目管理和 Diagram Recipes。
- `skills/ichartjs/SKILL.md`：适用于 Codex、WorkBuddy 等 Agent Skills 兼容宿主的可选编排层。

Agent 与开发者使用同一个 ESM 入口。编码 Agent 的完整方式见 [编码 Agent 集成](coding-agent-integration.md)，普通应用集成见 [前端项目集成](frontend-integration.md)。

## 标准流程

```text
发现能力 → 检查数据 → 规划图表 → 构建 Spec → 校验 → 渲染 → 解释、导出和自检
```

1. 调用 `getCapabilities()`，不要自行创造图表类型或配置项。
2. 调用 `inspectData()`，检查字段角色、标识符、维度、度量、时间范围、缺失值和警告。
3. 调用 `planChart()`，同时读取主推荐、备选方案、置信度、缺失字段、假设、警告、不支持请求和 `styleRecommendation`。
4. 当 `requiredFields` 非空时停止渲染，向用户请求数据或选择有依据的备选方案。
5. 构建 JSON 可序列化的 Spec，并调用 `validateSpec()`。Spec 可通过 `branding: false` 显式关闭品牌署名；默认保留署名以提升项目可见性。
6. 仅在 `validation.valid` 为 `true` 时调用 `createChart()`。
7. 用 `chart.explain()`、`chart.getState()`、JSON/SVG/PNG export 完成自检。需要持久化或附件生成时使用 `chart.export({type:'json'|'svg'|'png'})`，在浏览器环境可调用 `chart.downloadPNG()` / `chart.downloadSVG()` / `chart.downloadJSON()` 触发保存，最后调用 `chart.destroy()`。

### 意图必须使用注册词

`intent` 是精确的机器词，不是自然语言句子。先从 `getCapabilities().intents` 获取允许值，再传入 `trend`、`time-series`、`comparison`、`ranking`、`distribution`、`relationship`、`matrix`、`multidimensional`、`schedule`、`architecture` 或 `mindmap` 等值。不要直接传入 `trend over time` 或 `展示销售趋势`。未知词会返回 `UNKNOWN_INTENT` 警告并安全降级；如果忽略警告，可能选错图表。

如果用户输入的是自然语言，先映射为注册词，再调用 `planChart()`，同时保留原始用户意图用于展示。

### 配置项放在 Spec 正确层级

`encoding` 只描述字段角色和 Series 语义，标题、格式和显示组件放在 Spec 顶层：

| 需求 | 正确位置 | 常见错误 |
| --- | --- | --- |
| 坐标轴标题 | `xAxis.title`、`yAxis.title` | `encoding.x.title`、`encoding.y.title` |
| 坐标轴格式 | `xAxis.format`、`yAxis.format` | `encoding.x.format`、`encoding.y.format` |
| 数据标签 | `labels.enabled`、`labels.format` | `encoding.labels` |
| 图例 | `legend.visible` | `encoding.legend` |
| 主题和配色 | `theme.mode`、`theme.preset`、`theme.palette` | 随意猜测 Series 颜色 |

`validateSpec()` 会把这些错误位置报告为结构化警告，应先修复再展示。单系列笛卡尔图默认会把字段名作为图例；不需要时使用 `legend: { visible: false }`。

### 当前坐标域限制

数值型笛卡尔图表默认使用易读的纵轴域：`yAxis.nice` 默认为 `true`，`yAxis.ticks` 默认为 `"auto"`。需要固定范围时使用 `yAxis.domain: [min, max]`，例如 `{ domain: [0, 2000], ticks: 5 }` 可稳定生成五个标签；使用 `yAxis.nice: false` 可保留原始数据边界。`yAxis.format` 只负责格式化刻度显示，`yAxis.right` 支持同样的配置。Agent 可通过 `chart.getState().axes` 或 `chart.explain().axes` 获取原始域、计算域、刻度、步长和策略进行自检。分类/时间横轴的范围仍由数据记录推导，因此 `xAxis.min/max` 和 `xAxis.domain` 不支持。图表专用域配置仍包括：`gauge.domain`、`heatmap.colorScale.domain`、`radar.indicators[].min/max`；项目图表的日期范围当前由数据记录自动计算。

图表通道是严格按类型定义的：笛卡尔图表使用 `x`/`y`，Pie/Funnel 使用 `category`/`value`，Gauge 只使用 `value`，Heatmap 使用 `x`/`y`/`color`，Radar 使用 `indicators[].field`。缺失字段或不支持的通道会校验失败；Gauge 必须声明 `domain`。Pie 遇到负数会报告 `NEGATIVE_VALUE_DROPPED`，没有正数占比时会报告 `ZERO_TOTAL`。新建图表可直接使用 `@taylorwong/ichartjs/recipes/minimal-specs` 中的最小目录：

```js
import catalog from '@taylorwong/ichartjs/recipes/minimal-specs' with { type: 'json' };

const spec = structuredClone(catalog.examples.radar);
```

Agent 自检使用 `chart.getState().health` 和 `chart.explain().health`，其中包含 `ready`、`degraded`、`empty`、警告数、隐藏标签数、限制值数和已渲染标记数。`locale` 默认 `en-US`，需要中文输出时设置 `locale: "zh-CN"`，输入日期仍使用 ISO-8601。

## 品牌署名（Branding）默认行为

- 默认 `branding: true`：在画面与所有导出产物（PNG/SVG/JSON）右下角同步出现 `Powered by iChart.js` 低对比度署名。
- 关闭：在 Spec 或 Theme 中显式设置 `branding: false`，此时画面和所有导出产物都不会出现署名，同时不再额外预留底部 padding。
- 一致性：署名开关由 Scene Graph 总闸统一判定，画面渲染与导出 100% 同步。

## 导出用例速览

```js
// 1. JSON：可跨端重建 + agent 自检（全环境零依赖）
const json = chart.export({ type: 'json' });
const obj = chart.export({ type: 'json', as: 'object' });

// 2. SVG：矢量保真，浏览器 + 无头零依赖
const svg = chart.export({ type: 'svg' });
const svgDataUrl = chart.export({ type: 'svg', as: 'dataurl' });

// 3. PNG / JPEG：浏览器同步真光栅；Node 无头使用异步导出
//    Node 无头：安装 npm i canvas 后，exportAsync() 可生成真光栅
const png = typeof document !== 'undefined' ? chart.toDataURL('image/png') : null;
const headlessPng = await chart.exportAsync({ type: 'png' });
```

## Agent 输出要求

最终结果应包含：

- 选择的图表及原因；
- 使用的字段和转换；
- 假设、警告和不支持能力；
- 校验结果；
- 稳定 record ID 的 lineage；
- 品牌署名（Branding）开关状态，避免可见与导出不一致；
- 可访问的预览 URL 或导出产物（JSON/SVG/PNG/JPEG）路径。

不要虚构字段、单位、日期、依赖关系、日历规则或预测置信度。Radar 使用混合单位时必须提供显式 domain；Heatmap 必须区分缺失值和零；高基数占比数据优先使用 Bar 而不是 Pie。

为了让 lineage 自检和联动更新稳定，建议每条输入记录提供稳定字符串 `id`。没有 `id` 时 Runtime 会使用 `record-0` 这类位置后备值，只适合本地展示，不应当视为持久业务身份。

## 完整示例

```bash
npm run example:agent
```

完整代码位于 [`../../../examples/agent-workflow.mjs`](../../../examples/agent-workflow.mjs)，包含 inspect→plan→validate→create→explain→export→destroy 的完整链路。交互验收可运行 `npm run playground`，然后打开 `http://localhost:3000/playground/agent-workbench.html`。在所有 Gallery 页面点击右上角导出按钮可验证 PNG / SVG / JSON 下载行为。

样式自动匹配与用户切换见[视觉样式与主题](theme-guide.md)，可在 `http://localhost:3000/playground/theme-gallery.html` 验收。
