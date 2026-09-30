# Iteration 17 — 生产可信度与 Agent 可靠性

Iteration 17 面向生产环境强化现有 Runtime 的 Agent 使用体验。不新增图表类型，也不新增 CLI、MCP 或 HTTP 服务。

## 17A — 契约可靠性

- 对未知顶层 Spec 配置提供诊断，不再静默忽略。
- 保持 `validateSpec()`、规范化、`createChart()`、Capabilities、TypeScript 和 Manifest 一致。
- 保留稳定诊断编码、JSON 路径、期望值和可执行建议。

## 17B — Agent 自检

- 通过 `chart.explain()` 暴露实际生效的渲染选项和规范化结果。
- `planChart()` 遇到不支持的 Renderer 时直接报告风险，而不是只返回隐式 fallback。
- 在 `getCapabilities()` 和 `capabilities.json` 中发布 `agentReliability`。
- 保持导航、编辑和动效默认安全关闭。

## 17C — 包与集成可信度

- 增加 npm 包 dry-run 检查，确认 Runtime、TypeScript、Skill、recipes 和能力清单均存在。
- 禁止 `.trae`、`.github`、测试和 Playground 开发文件进入发布包。
- 将 TypeScript consumer fixture 与 ESM/headless 示例纳入发布检查。

## 17D — 渲染与无障碍验收

- 持续验证 SVG/Canvas 在标签、图表、导出和响应式布局上的一致性。
- 将浏览器验收与 headless 检查分开，并保留明确的本地服务证据。
- 在测试显式开启导航和编辑的同时，保持默认静态安全行为。

## 验收标准

```text
检查数据
→ 规划图表
→ 校验 Spec
→ 创建图表
→ 检查生效配置和健康状态
→ 预览或导出
```

- 无效或被忽略的配置都可诊断。
- Agent 无需阅读 Renderer 内部代码即可确认实际渲染结果。
- npm 包只包含支持用户使用的产物。
- `npm run agent:check`、浏览器验收和 `git diff --check` 通过。

## 不纳入本轮

- 新图表类型。
- Runtime 内置 NLP。
- CLI、MCP、HTTP、Python 或 1.x 兼容层。
