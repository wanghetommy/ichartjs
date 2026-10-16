# Agent 任务验收

当 Agent 需要交付结果，而不只是生成 Spec 时，使用任务验收流程。

最终结果至少应包含：图表类型、警告、假设、`health.renderable`、数据 lineage，以及 SVG、PNG 或 JSON checkpoint 等输出。

用户指定受支持类型时直接读取该类型契约；只有选图时才需规划。修改已有图表先读取当前状态，按修改范围验收，不重新执行整套选图流程。

```text
检查数据 → 规划 → 构建 Spec → 校验 → 渲染 → explain/getState
→ 验证输出 → destroy
```

`UNKNOWN_INTENT`、缺少必需字段、错误通道或无效 Diagram 结构应在渲染前停止。`NEGATIVE_VALUE_DROPPED`、`ZERO_TOTAL`、`VALUE_CLAMPED`、`LABEL_TRUNCATED` 和 `LABELS_SUPPRESSED` 必须返回给用户，不能静默吞掉。

数据失真、请求选项失效应解决后再声称可用；替代方案须同意。文字、对比度问题按目标尺寸判断；无害归一化、装饰降级可说明影响后接受。不盲目重试或缩短业务标签来消除 warning；保留源数据稳定 ID。

## 视觉与宿主验收

健康状态不是视觉验收。按交付尺寸执行 Skill 的[可读性清单](../../../skills/ichartjs/references/readability.md)：语义 → 结构 → 文字 → 紧凑 → 装饰。Runtime 和视觉检查分别报告，说明缺少的工具或未验证尺寸。

消费项目沿用自身服务和 URL，`npm run playground` 仅用于本仓库；文件交付返回产物路径。在线实例保持挂载，仅销毁临时或被替换实例。

输出选择：

- 浏览器预览：挂载 SVG 或 Canvas。
- 矢量交付：`chart.export({ type: 'svg' })`。
- 机器 checkpoint：`chart.export({ type: 'json', as: 'object' })`。
- 浏览器位图：`chart.export({ type: 'png' })`。
- Node 无头环境：优先 SVG/JSON；PNG 需要可选 Canvas 适配器。

可执行任务夹具位于 `tests/iteration-21.test.mjs`，对应运行命令为 `npm run tasks:check`。
