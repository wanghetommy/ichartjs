# iChart.js Iteration 6 开发计划

## Summary

本阶段按 [`docs/agent/development/iteration-6.md`](file:///Users/wanghe/project/ichartjs/docs/agent/development/iteration-6.md) 推进 `Project Intelligence and Business Views`，目标不是新增一批公开图表类型，而是在现有 `gantt`、`burndown`、`bar`、`column`、`area`、`scatter` 之上补齐可复现、可解释、可被 Agent 调用的项目分析能力。

建议将 Iteration 6 拆成 5 个连续波次，对应文档中的 6A–6E：

1. 先补 `schedule intelligence`，在现有 Gantt / Milestone / Burndown 基础上扩展导出与状态。
2. 再引入显式 `calendar + dependency rules`，避免后续 capacity / forecast 反复改算子。
3. 然后补 `capacity / cumulative flow / velocity / release forecast` 的 analytics adapter。
4. 之后补 `risk / aging / linked filters`，把跨视图联动与稳定 record ID 打通。
5. 最后统一收口 `recipes / typings / docs / demos / acceptance`。

整个 Iteration 6 仍然遵守 chart type policy：默认不新增 public chart type，只新增 project analytics 的适配层、模式与文档能力。

## Current State Analysis

### 已有实现

基于当前仓库，Iteration 6 的起点已经具备一部分可复用能力：

- 项目视图与绘制主干集中在 [`src/project.mjs`](file:///Users/wanghe/project/ichartjs/src/project.mjs)
  - 已有 `criticalSchedule(rows)`，可计算 earliest/latest/float/critical。
  - 已有 `analyzeBurndown(rows)`，可输出 scope、completed、forecast。
  - 已有 `gantt` / `timeline` / `milestone` / `burndown` 的 Scene 构建逻辑。
- 项目场景文档已存在于 [`docs/agent/project-scenario.md`](file:///Users/wanghe/project/ichartjs/docs/agent/project-scenario.md)。
- Gallery 已覆盖现有 project chart types，见 [`playground/project-gallery.html`](file:///Users/wanghe/project/ichartjs/playground/project-gallery.html)。
- 类型声明入口存在于 [`types/index.d.ts`](file:///Users/wanghe/project/ichartjs/types/index.d.ts)。
- project recipe 当前只有基础映射，见 [`agent-recipes/project-management.json`](file:///Users/wanghe/project/ichartjs/agent-recipes/project-management.json)。
- manifest 能力声明当前只到现有 chart scenarios，见 [`docs/manifests/capabilities.json`](file:///Users/wanghe/project/ichartjs/docs/manifests/capabilities.json)。

### 当前缺口

结合 Iteration 6 文档和现有代码，主要缺口如下：

1. 没有独立的 project analytics / adapter 模块，分析逻辑仍散落在 `src/project.mjs`。
2. Gantt 虽已有 critical path / float 计算，但没有 baseline vs actual、milestone variance、显式 assumptions / warnings 输出。
3. 还没有 timezone、working calendar、holidays、dependency type、lag / lead 的数据合同和计算入口。
4. 还没有 resource load / capacity、cumulative flow、velocity、risk matrix、issue aging 的分析函数或 view adapter。
5. 没有 framework-neutral linked filter / linked selection 状态层。
6. 还没有 [`playground/project-intelligence.html`](file:///Users/wanghe/project/ichartjs/playground/project-intelligence.html)。
7. recipe、TypeScript、docs、acceptance report 还没有对应 Iteration 6 的交付物。

### 约束与已知边界

- `iteration-6.md` 明确要求优先复用现有图元和 chart types，不默认提升为新 public type。
- `docs/agent/development/iteration-4.md` 已经把 calendar、holidays、lead/lag 明确标记为 Iteration 6 范围，因此本次需要把这些能力放进正式合同。
- 当前 `npm run agent:check` 已作为验收命令存在于 `package.json`，所以最终计划必须覆盖 docs、tests、syntax 一起通过。

## Assumptions & Decisions

### 范围决策

- Iteration 6 默认不新增 `heatmap` / `treemap` / `radar` 等 chart type。
- 资源负载优先作为 `gantt` 相关 project view 或 adapter 输出，不单独升级为新 type。
- release forecast 继续作为 `burndown` mode，而不是新 chart family。
- risk matrix 与 issue aging 基于 `scatter` / `bar` 或 `scatter` adapter 输出。

### 架构决策

- 将 analytics 计算与 Scene 渲染分层：
  - `src/project.mjs` 保留项目视图 Scene builder 角色。
  - 新增 project analytics / adapter 模块承接计算、派生字段、warnings、filter linking。
- Agent 暴露优先通过现有公开入口扩展：
  - `getCapabilities()`
  - `Chart.getState()`
  - `inspectData()` / `recommend()` 的 project-intent 路径
  - 新增 analytics helper exports
- 所有 derived values 必须和 source fields 分离，避免修改原始输入行。

### 数据兼容决策

- 继续兼容现有 `dependencies: string[]`。
- 在不破坏 legacy data 的前提下扩展 dependency object / calendar config：
  - 旧格式继续有效。
  - 新格式通过显式字段启用，不做隐式猜测。
- 所有 transforms 和 adapters 都保持 stable record IDs，联动基于 ID 而不是数组索引。

## Proposed Changes

### Wave 1：6A Schedule Intelligence

目标：把现有 `criticalSchedule()` 和项目视图提升为“可解释的 schedule analytics”。

#### 1. [`src/project.mjs`](file:///Users/wanghe/project/ichartjs/src/project.mjs)

- 将 `criticalSchedule()` 从“渲染辅助”升级为可复用 analytics 输出：
  - 保留 `criticalIds` / `criticalEdges`
  - 增加 deterministic `slack/float`、duration、derived assumptions
  - 增加 warnings：missing date、inverted range、missing dependency、status/progress inconsistency
- 为 `gantt` 增加 `baseline` / `actual` overlay 支持：
  - baseline bars
  - actual bars
  - variance markers
- 为 `milestone` 增加 variance indicator 逻辑。
- 将 derived analytics 写入 `state.schedule` / `state.projectAnalytics`，而不是混在原始 row 上。

#### 2. [`src/schema.mjs`](file:///Users/wanghe/project/ichartjs/src/schema.mjs)

- 扩展 `project-task` schema：
  - `baselineStart`
  - `baselineEnd`
  - `actualStart`
  - `actualEnd`
  - `owner`
  - `resource`
- 对 milestone / burndown 相关数据补必要字段的只读/派生约束说明。

#### 3. [`tests/core.test.mjs`](file:///Users/wanghe/project/ichartjs/tests/core.test.mjs)

- 新增 schedule intelligence 测试：
  - baseline / actual / variance deterministic
  - milestone variance
  - missing/inverted/inconsistent warnings
  - source rows immutability

### Wave 2：6B Calendar and Dependency Rules

目标：把“日期运算”升级成“基于显式 calendar contract 的可复现调度计算”。

#### 4. 新增 [`src/project-analytics.mjs`](file:///Users/wanghe/project/ichartjs/src/project-analytics.mjs)

- 抽离 project analytics 主入口，至少包含：
  - `normalizeProjectCalendar()`
  - `analyzeSchedule()`
  - `applyWorkingCalendar()`
  - `normalizeDependencies()`
- 支持配置：
  - timezone
  - working weekdays
  - holidays
  - non-working-day adjustment policy
  - dependency type
  - lag / lead

#### 5. [`src/project.mjs`](file:///Users/wanghe/project/ichartjs/src/project.mjs)

- 改为调用 `project-analytics.mjs`，避免继续在渲染模块里堆积调度逻辑。
- 使用新的 schedule analysis 输出重建 Gantt 关键路径和 slack。

#### 6. [`types/index.d.ts`](file:///Users/wanghe/project/ichartjs/types/index.d.ts)

- 增加 project analytics options / results 类型：
  - calendar config
  - schedule analysis result
  - dependency rule result
  - warnings / assumptions

#### 7. [`tests/core.test.mjs`](file:///Users/wanghe/project/ichartjs/tests/core.test.mjs)

- 新增 focused unit coverage：
  - weekends / holidays
  - lag / lead
  - legacy dependency array compatibility
  - ambiguous calendar input warnings

### Wave 3：6C Capacity and Delivery Views

目标：补齐 Iteration 6 的主要 business views，但继续复用既有 chart primitives。

#### 8. [`src/project-analytics.mjs`](file:///Users/wanghe/project/ichartjs/src/project-analytics.mjs)

- 新增 analytics functions：
  - `analyzeCapacity()`
  - `buildCapacityView()`
  - `buildCumulativeFlowSeries()`
  - `buildVelocitySeries()`
  - `buildReleaseForecast()`
- 每个函数都输出：
  - normalized rows
  - assumptions
  - warnings
  - stable record references

#### 9. [`src/index.mjs`](file:///Users/wanghe/project/ichartjs/src/index.mjs)

- 扩展 public capability / export surface：
  - project analytics capabilities
  - available project intents: variance / capacity / risk / release
  - 导出 analytics helpers
- 更新 `recommend()` 的 project intent 路由，但仍映射到已有 chart types。

#### 10. [`playground/project-intelligence.html`](file:///Users/wanghe/project/ichartjs/playground/project-intelligence.html)

- 新建 Iteration 6 demo，至少包含：
  - schedule overlays
  - capacity view
  - cumulative flow
  - velocity
  - release forecast
- Demo 需直接展示：
  - selected source records
  - assumptions
  - warnings
  - normalized output rows

#### 11. [`playground/project-gallery.html`](file:///Users/wanghe/project/ichartjs/playground/project-gallery.html)

- 增加到新 demo 的入口链接。
- 为现有 project cards 同步展示新模式或 analytics state 入口。

### Wave 4：6D Risk, Aging, and Linked Analysis

目标：把单个 view 扩展成“跨视图联动的 project intelligence runtime”。

#### 12. 新增 [`src/project-linking.mjs`](file:///Users/wanghe/project/ichartjs/src/project-linking.mjs)

- 实现 framework-neutral linked state：
  - linked filter
  - linked selection
  - stable ID mapping
- 状态仅引用 source record IDs，不引用 array positions。

#### 13. [`src/project-analytics.mjs`](file:///Users/wanghe/project/ichartjs/src/project-analytics.mjs)

- 新增：
  - `buildRiskMatrixSeries()`
  - `buildIssueAgingSeries()`
  - configurable age buckets
  - owner/status/priority/sprint/label filters

#### 14. [`src/index.mjs`](file:///Users/wanghe/project/ichartjs/src/index.mjs)

- 暴露 linked filters / selections 的 state 获取与应用入口。
- 确保 rerender 后 selection/filter 仍按 stable IDs 恢复。

#### 15. [`tests/core.test.mjs`](file:///Users/wanghe/project/ichartjs/tests/core.test.mjs)

- 新增：
  - risk matrix deterministic outputs
  - issue aging bucket reconciliation
  - linked filter consistency across rerenders
  - stable record ID propagation

### Wave 5：6E Agent and Release Closure

目标：把 runtime 能力转成可被 Agent、类型系统、demo 和文档同时消费的正式交付。

#### 16. [`agent-recipes/`](file:///Users/wanghe/project/ichartjs/agent-recipes)

- 新增或拆分 project intelligence recipes：
  - schedule variance
  - capacity overload
  - release forecast
  - risk matrix
  - issue aging
- 更新 [`agent-recipes/project-management.json`](file:///Users/wanghe/project/ichartjs/agent-recipes/project-management.json) 的 intent mappings 和 examples。

#### 17. [`docs/agent/project-scenario.md`](file:///Users/wanghe/project/ichartjs/docs/agent/project-scenario.md)

- 扩展 project analytics 章节：
  - data quality
  - assumptions
  - confidence limits
  - unsupported inference

#### 18. [`docs/agent/development/iteration-6.md`](file:///Users/wanghe/project/ichartjs/docs/agent/development/iteration-6.md)

- 在每个 checkpoint 完成后回写 current delivery / acceptance evidence。
- 明确 desktop / mobile viewport acceptance 和 physical-device / host integration 的分界。

#### 19. [`docs/manifests/capabilities.json`](file:///Users/wanghe/project/ichartjs/docs/manifests/capabilities.json)

- 同步 project intelligence capabilities 和新 demo 链接。

#### 20. [`types/index.d.ts`](file:///Users/wanghe/project/ichartjs/types/index.d.ts)

- 补全 project analytics helper、结果对象、linked state API 的声明。

## Implementation Order

建议执行顺序：

1. 抽 `src/project-analytics.mjs`，先完成 6A / 6B 的 schedule + calendar 主线。
2. 让 `src/project.mjs` 改为消费 analytics output，而不是继续自带计算。
3. 扩 `schema.mjs`、`index.mjs`、`types/index.d.ts`，把公共合同定稳。
4. 完成 6C 的 capacity / cumulative flow / velocity / release adapters。
5. 完成 6D 的 risk / aging / linked state。
6. 新建 `playground/project-intelligence.html` 并回挂到 gallery。
7. 补 tests、recipes、docs、manifests，并以 `npm run agent:check` 为最终闭环。

## Verification

### 命令校验

- `npm test`
- `npm run check`
- `npm run docs:check`
- `npm run agent:check`
- `git diff --check`

### 功能验收

- Gantt 可切换 critical path、slack、baseline、actual overlay。
- milestone variance 与 gantt variance 对同一输入稳定可复现。
- calendar / timezone / lag / lead / holidays 在同一输入下输出稳定。
- resource load / cumulative flow / velocity / release forecast 均通过既有 chart primitives 生成。
- risk / aging 输出 deterministic，并可反查 source record IDs。
- linked filters / selections 在 rerender 后仍稳定。
- source rows 不会被 analytics transforms 或 demos 直接修改。

### Demo 验收

- [`playground/project-intelligence.html`](file:///Users/wanghe/project/ichartjs/playground/project-intelligence.html) 可通过本地 HTTP 打开。
- demo 页面能够显式展示 assumptions、warnings、normalized output、linked selection state。
- [`playground/project-gallery.html`](file:///Users/wanghe/project/ichartjs/playground/project-gallery.html) 有可见入口，并能覆盖至少一个 Iteration 6 视图样例。

## Out of Scope

- 新 public chart type 审批与引入。
- Radar / Heatmap / Treemap 等基础新图形。
- 真正的多人协同 linked state 后端。
- 物理设备、宿主应用持久化、权限与审批集成。
- 将所有 project intelligence 都做成独立 scene builder；本阶段优先 adapter + analytics 复用。
