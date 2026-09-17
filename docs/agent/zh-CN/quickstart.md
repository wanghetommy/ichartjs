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
} from 'ichartjs';
```

- `ichartjs`：统一的 Agent 规划与 Runtime API。
- `ichartjs/capabilities.json`：机器可读能力清单。
- `ichartjs/recipes/*`：基础分析、项目管理和 Diagram Recipes。
- `skills/ichartjs/SKILL.md`：适用于 Codex、WorkBuddy 等 Agent Skills 兼容宿主的可选编排层。

Agent 与开发者使用同一个 ESM 入口。编码 Agent 的完整方式见 [编码 Agent 集成](coding-agent-integration.md)，普通应用集成见 [前端项目集成](frontend-integration.md)。

## 标准流程

```text
发现能力 → 检查数据 → 规划图表 → 构建 Spec → 校验 → 渲染 → 解释和自检
```

1. 调用 `getCapabilities()`，不要自行创造图表类型或配置项。
2. 调用 `inspectData()`，检查字段角色、标识符、维度、度量、时间范围、缺失值和警告。
3. 调用 `planChart()`，同时读取主推荐、备选方案、置信度、缺失字段、假设、警告、不支持请求和 `styleRecommendation`。
4. 当 `requiredFields` 非空时停止渲染，向用户请求数据或选择有依据的备选方案。
5. 构建 JSON 可序列化的 Spec，并调用 `validateSpec()`。
6. 仅在 `validation.valid` 为 `true` 时调用 `createChart()`。
7. 用 `chart.explain()`、`chart.getState()` 和 JSON export 完成自检，最后调用 `chart.destroy()`。

## Agent 输出要求

最终结果应包含：

- 选择的图表及原因；
- 使用的字段和转换；
- 假设、警告和不支持能力；
- 校验结果；
- 稳定 record ID 的 lineage；
- 可访问的预览 URL 或产物路径。

不要虚构字段、单位、日期、依赖关系、日历规则或预测置信度。Radar 使用混合单位时必须提供显式 domain；Heatmap 必须区分缺失值和零；高基数占比数据优先使用 Bar 而不是 Pie。

## 完整示例

```bash
npm run example:agent
```

完整代码位于 [`../../../examples/agent-workflow.mjs`](../../../examples/agent-workflow.mjs)。交互验收可运行 `npm run playground`，然后打开 `http://localhost:3000/playground/agent-workbench.html`。

样式自动匹配与用户切换见[视觉样式与主题](theme-guide.md)，可在 `http://localhost:3000/playground/theme-gallery.html` 验收。
