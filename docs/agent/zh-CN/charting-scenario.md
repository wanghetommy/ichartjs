# 场景：数据分析图表

用于通用指标分析和数据展示的 Agent 使用与开发指南。

## 图表选择

| 类型 | 适用场景 | 推荐 Renderer |
| --- | --- | --- |
| `line` | 趋势、时间变化 | `svg` |
| `area` | 趋势和累计量 | `svg` |
| `bar` | 分类对比、长标签 | `svg` |
| `column` | 紧凑分类对比 | `canvas` 或 `svg` |
| `pie` | 少量类别占比 | `svg` |
| `scatter` | 两个数值变量关系 | `canvas` |
| `funnel` | 转化阶段 | `svg` |
| `gauge` | 单指标完成度 | `canvas` |
| `heatmap` | 矩阵强度与日历模式 | `canvas` 或 `svg` |
| `radar` | 多维指标对比 | `svg` |

## 基础模式

- Bar、Column、Area 使用 `stack: "stacked"` 或 `stack: "percent"`，不新增堆叠类型。
- Donut 使用 `type: "pie"` 配合 `innerRadius`。
- Combo 使用每个系列的 `mark: "column"` 或 `mark: "line"`，并可设置 `axis: "right"`。
- Histogram 使用 `transform: { type: "bin", field, thresholds | step, extent }`。
- Heatmap 通过 `colorScale.missing` 区分缺失值和数值零。
- Radar 应为每个指标声明 `min` 和 `max`；缺失域或混合单位会产生告警。

## 配置项位置

`encoding` 只描述字段角色和 Series 语义。以下配置应放在 Spec 顶层：

| 配置 | 正确位置 | 适用范围 |
| --- | --- | --- |
| 坐标轴标题和格式 | `xAxis.title/format`、`yAxis.title/format` | Line、Area、Bar、Column、Scatter |
| 易读数值域 | `yAxis.nice`、`yAxis.ticks`、`yAxis.domain` | Line、Area、Bar、Column、Scatter |
| 数据标签 | `labels.enabled/format` | 能力清单声明支持 labels 的图表 |
| 图例 | `legend.visible/position` | 多系列笛卡尔图、Pie、Radar |
| Gauge 坐标域 | `domain: [min, max]` | Gauge |
| Heatmap 颜色域 | `colorScale.domain` | Heatmap |
| Radar 指标域 | `indicators[].min/max` | Radar |

不要把 `title`、`format`、`labels` 或 `legend` 放在 `encoding` 中；`validateSpec()` 会报告结构化警告。数值纵轴默认使用易读域（`nice: true`、`ticks: "auto"`）；需要固定范围时使用 `yAxis.domain: [min, max]`，需要保留原始边界时使用 `yAxis.nice: false`。分类/时间横轴的 `min/max` 和 `domain` 不支持。

## Encoding 契约

不同图表只接受对应的数据通道：笛卡尔图表使用 `encoding.x`/`encoding.y`；Pie、Funnel、Gauge 使用 `encoding.category`/`encoding.value`；Heatmap 使用 `encoding.x`/`encoding.y`/`encoding.color`；Radar 使用 `indicators[].field`。字段不存在或通道不支持会成为校验错误，不应静默改名。Gauge 必须提供 `domain: [min, max]`；超出范围时弧形会限制在范围内，并产生 `VALUE_CLAMPED`。全部图表的最小可执行 Spec 见 `@taylorwong/ichartjs/recipes/minimal-specs`。

## 意图注册词

传给 `planChart()` 的 `intent` 必须是 `getCapabilities().intents` 中的精确值，而不是用户原句。比如把“展示销售随时间变化”映射为 `trend`；未知词会返回 `UNKNOWN_INTENT` 和降级方案，不能忽略该警告。

未知词的规划结果还会给出 `intentKnown: false`、`fallbackUsed: true` 和 `intentSuggestions`，应据此重新映射或请求确认。

## Agent 流程

1. 使用 `inspectData(data)` 检查字段和缺失值。
2. 根据意图选择图表，可使用 `recommend(data, { intent })`。
3. 生成 JSON-serializable Chart Spec。
4. 先调用 `validateSpec(spec)`，再调用 `createChart(spec)`。
5. 使用 `chart.describe()` 和 `chart.getState()` 检查结果。
6. 如果需要 lineage、联动筛选或后续更新，为每条记录提供稳定字符串 `id`；没有 `id` 时 Runtime 会使用 `record-0` 这类确定性后备值。
7. 展示前检查 `chart.getState().health.renderable`、`health.status` 和 `warnings`。`ready` 表示没有阻止渲染的问题，`degraded` 表示带诊断继续渲染，`empty` 表示结果没有可用内容。

`locale` 默认是 `en-US`，需要中文数字/日期输出时设置 `locale: "zh-CN"`。输入日期保持 ISO-8601 字符串；运行时不负责自然语言日期解析。

## 最小 Spec

```js
{
  type: 'line',
  renderer: 'svg',
  data: { values: [{ id: 'jan', month: 'Jan', sales: 120 }] },
  encoding: {
    x: { field: 'month', type: 'category' },
    y: { field: 'sales', type: 'quantitative' }
  }
}
```

## 开发位置与验收

- Spec：`src/spec.mjs`
- 数据：`src/data.mjs`
- Scene：`src/charts.mjs`
- Scale：`src/scale.mjs`
- Renderer：`src/renderer.mjs`
- 测试：`tests/core.test.mjs`
- 验收：`playground/project-gallery.html`
- Iteration 7 验收：`playground/foundational-gallery.html`

新增图表必须同步更新代码、测试、Gallery、`docs/manifests/capabilities.json` 和本文件。
