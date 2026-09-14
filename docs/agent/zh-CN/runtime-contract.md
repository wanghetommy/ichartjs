# Runtime 契约

三个开发场景共用的 Runtime 规则。

## 标准流程

```text
inspectData → recommend → 创建 Spec → validateSpec → createChart → 检查状态
```

Agent 应优先使用 `getCapabilities()`，不要硬编码未声明的图表类型或操作。

## 关键规则

- Spec 必须是 JSON-serializable。
- 渲染前调用 `validateSpec()`。
- 布局和数据语义不依赖 Renderer。
- 通用图表使用 `data.values`；Flow/Swimlane 使用 `nodes/edges/lanes`。
- `svg` 适合 DOM 交互和可访问性；`canvas` 适合大量图元和绘制性能。
- Headless 支持 JSON；PNG/SVG 导出需要挂载 Renderer。

公共 API：`inspectData`、`normalizeData`、`recommend`、`validateSpec`、`createChart`、`getCapabilities`、`chart.describe`、`chart.getState`、`chart.export`。

实现位置：`src/index.mjs`、`src/spec.mjs`、`src/scene.mjs`、`src/renderer.mjs`、`src/plugin.mjs`、`src/scale.mjs`。
