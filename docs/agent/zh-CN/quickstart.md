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

- `ichartjs`：统一的 Agent 规划与 Runtime API。
- `ichartjs/capabilities.json`：机器可读能力清单，包含逐图表导出、署名和交互声明。
- `ichartjs/recipes/*`：基础分析、项目管理和 Diagram Recipes。
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

// 3. PNG / JPEG：同步真光栅
//    浏览器：任意 renderer 均可
//    无头：需安装 npm i canvas，否则返回结构化错误 code=HEADLESS_EXPORT_UNSUPPORTED
const png = typeof document !== 'undefined' ? chart.toDataURL('image/png') : null;
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

## 完整示例

```bash
npm run example:agent
```

完整代码位于 [`../../../examples/agent-workflow.mjs`](../../../examples/agent-workflow.mjs)，包含 inspect→plan→validate→create→explain→export→destroy 的完整链路。交互验收可运行 `npm run playground`，然后打开 `http://localhost:3000/playground/agent-workbench.html`。在所有 Gallery 页面点击右上角导出按钮可验证 PNG / SVG / JSON 下载行为。

样式自动匹配与用户切换见[视觉样式与主题](theme-guide.md)，可在 `http://localhost:3000/playground/theme-gallery.html` 验收。
