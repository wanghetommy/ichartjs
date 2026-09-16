# Runtime 契约

三个开发场景共用的 Runtime 规则。

## 标准流程

```text
getCapabilities → inspectData → planChart → 创建 Spec → validateSpec → createChart → 解释并检查状态
```

Agent 应优先使用 `getCapabilities()`，不要硬编码未声明的图表类型或操作。

Iteration 8 通过 `getChartCapability(type)` 提供逐图表能力档案，包括必需数据角色、支持的交互、Renderer、功能状态、导出和建议限制。Agent 不应猜测未声明能力。

`planChart(data, { intent, renderer })` 返回版本化规划结果：主选图表、备选项、置信度、原因、缺失字段、建议编码、假设、警告、不支持请求和安全下一步。规划不会虚构业务含义、单位、日期或缺失字段。

`validateSpec()` 分开返回 `errors`、`warnings` 和 `normalizations`；诊断包含稳定代码、JSON 路径、期望值和修复建议。`chart.explain()` 返回编码、转换、交互、假设、警告、稳定记录血缘和无障碍摘要。

## 关键规则

- Spec 必须是 JSON-serializable。
- 渲染前调用 `validateSpec()`。
- 布局和数据语义不依赖 Renderer。
- 通用图表使用 `data.values`；Flow/Swimlane 使用 `nodes/edges/lanes`。
- `svg` 适合 DOM 交互和可访问性；`canvas` 适合大量图元和绘制性能。
- Headless 支持 JSON；PNG/SVG 导出需要挂载 Renderer。

公共 API：`inspectData`、`normalizeData`、`planChart`、`recommend`、`validateSpec`、`createChart`、`getCapabilities`、`getChartCapability`、`chart.describe`、`chart.explain`、`chart.getState`、`chart.export`。

实现位置：`src/index.mjs`、`src/spec.mjs`、`src/scene.mjs`、`src/renderer.mjs`、`src/plugin.mjs`、`src/scale.mjs`。
