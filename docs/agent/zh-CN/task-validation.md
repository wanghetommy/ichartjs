# Agent 任务验收

当 Agent 需要交付结果，而不只是生成 Spec 时，使用任务验收流程。

最终结果至少应包含：图表类型、警告、假设、`health.renderable`、数据 lineage，以及 SVG、PNG 或 JSON checkpoint 等输出。

```text
检查数据 → 规划 → 构建 Spec → 校验 → 渲染 → explain/getState
→ 验证输出 → destroy
```

`UNKNOWN_INTENT`、缺少必需字段、错误通道或无效 Diagram 结构应在渲染前停止。`NEGATIVE_VALUE_DROPPED`、`ZERO_TOTAL`、`VALUE_CLAMPED`、`LABEL_TRUNCATED` 和 `LABELS_SUPPRESSED` 必须返回给用户，不能静默吞掉。

输出选择：

- 浏览器预览：挂载 SVG 或 Canvas。
- 矢量交付：`chart.export({ type: 'svg' })`。
- 机器 checkpoint：`chart.export({ type: 'json', as: 'object' })`。
- 浏览器位图：`chart.export({ type: 'png' })`。
- Node 无头环境：优先 SVG/JSON；PNG 需要可选 Canvas 适配器。

可执行任务夹具位于 `tests/iteration-21.test.mjs`，对应运行命令为 `npm run tasks:check`。
