# 开发指南

适用于维护者和 Coding Agent 修改 iChart.js 本身。使用组件先读 [Agent 指南](README.md)；规划和历史证据见[开发文档索引](../development/README.md)。

## 开发前必读

按根目录 `AGENTS.md` 的要求，阅读并遵守[七条开发原则](../development/development-principles.md)，然后读取相关场景及迭代计划。原则只在该英文文件维护，不在这里重复。

## 选择修改范围

| 需求 | 契约指南 | 主要源码 |
| --- | --- | --- |
| 数据图表 | [数据图表](charting-scenario.md) | `src/spec.mjs`、`src/charts.mjs`、`src/data.mjs` |
| 排期和项目分析 | [项目管理](project-scenario.md) | `src/project.mjs`、`src/project-analytics.mjs`、`src/schema.mjs` |
| Flow、Swimlane、Architecture、Mindmap | [Diagram](diagram-scenario.md) | `src/diagram.mjs`、`src/diagram-interaction.mjs` |
| Freeform Board | [Board](canvas-scenario.md) | `src/board.mjs`、`src/board-edit.mjs` |
| 类型化图表编辑 | [编辑契约](editing-contract.md) | `src/command.mjs`、`src/edit.mjs`、`src/edit-controller.mjs` |

## 修改与验收流程

1. 确认任务和迭代范围，必要时复现问题，定位最小的共同修改层。
2. 补充针对性回归测试并实现，不修改无关问题。
3. 同步受影响的 API/类型、Manifest、双语指南、Recipe 和维护中的 Demo；通过 [Playground 策略](../development/playground-plan.md)选择负责该场景的页面。
4. 先运行针对性测试，再运行 `npm run agent:check` 和 `git diff --check`。Agent 检查覆盖契约、类型、依赖、配方、文档、安装包消费者、体积、Profile、语法和单测，不证明翻译语义或浏览器行为正确。
5. 布局或交互变更运行 `npm run test:browser` 并检查 SVG/Canvas 实际预览；README/Quickstart 示例运行 `npm run docs:snippets`；性能相关变更运行 `npm run performance:check`。包内容或源码体积变化时运行 `npm run footprint:generate` 和 `npm run footprint:check`，不能提高预算掩盖回归。
6. 交付实际变更、测试结果、剩余限制、准确 HTTP 预览地址和验收步骤。提交或发布需明确授权；发布遵循[作者专用 SOP](../development/release-sop.md)。

## 文档与源码规则

- 活动 `src/*.mjs` 文件以简短英文模块职责/约束注释开头，职责改变时同步更新；公共 API 和复杂算法使用必要 JSDoc，不写逐行噪声注释。
- 文档说明行为和契约，不重复实现。生成图表的 Agent 指引维护在[快速上手](quickstart.md)、[Runtime 契约](runtime-contract.md)及[对话工作流](conversational-workflow.md)，不另建开发者 Prompt Contract。
- 现行开发规则和 Agent 主指南使用英文；中文辅助版放在 `docs/agent/zh-CN/`，技术变更同步双语。历史开发记录可保留原有语言。
- 迭代和验收记录只描述当时范围及日期，不作为当前 API 或发布指引；通过开发索引发现，不纳入普通 Agent 默认阅读。
