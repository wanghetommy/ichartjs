# 开发指南

指导 Coding Agent 开发 iChart.js 2.0。

## 标准流程

1. 判断功能属于数据分析、项目管理还是 Diagram 场景。
2. 阅读本目录对应场景文档和当前 `development/iteration-X.md`。
3. 定位最小源码范围，遵守文件级模块注释规则。
4. 增加测试并实现功能，不修改无关问题。
5. 同步 Manifest、场景文档、Recipe 和 Gallery。
6. 运行 `npm run agent:check`。
7. 有可查看 Demo 时，立即提供 HTTP 地址和验收步骤。

## 修改映射

- 通用图表：`src/spec.mjs`、`src/charts.mjs`、`src/data.mjs`。
- 项目能力：`src/project.mjs`，必要时更新 `src/schema.mjs`。
- Diagram 能力：`src/diagram.mjs`、`src/diagram-interaction.mjs`。
- 公共编辑：`src/command.mjs`、`src/edit.mjs`、`src/edit-controller.mjs`。

## 文档规则

- 活动 `src/*.mjs` 必须有简短文件级注释。
- 公共 API 和复杂算法增加必要 JSDoc。
- 代码注释使用英文；中文文档是辅助版本。
- Manifest 和 API 标识符保持英文且稳定。
- `docs/agent/` 顶层核心文档统一使用英文，中文辅助版放在 `docs/agent/zh-CN/`；技术契约变更时同步更新两种语言。
- 开发历史放在 `docs/agent/development/`，不作为普通 Agent 默认上下文。

`npm run agent:check` 检查图表和命令清单、Schema 模型覆盖、双语文件存在性、英文核心文档中的中文残留以及 Gallery 类型覆盖，再运行语法检查和测试。它不证明翻译语义一致或浏览器交互正确；开发历史不受英文检查限制。
