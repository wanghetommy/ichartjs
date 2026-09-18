# 编码 Agent 集成

本指南适用于 Codex、WorkBuddy 等能够读取仓库、编辑 JavaScript、运行测试并打开本地预览的编码 Agent。

## 边界

iChart.js 是 JavaScript UI 图表组件库。编码 Agent 负责修改宿主前端，并调用统一的 `ichartjs` ESM API。Skill 只提供工作流指导，不是第二套 Runtime，也不是服务接口。

普通图表开发不需要 CLI、MCP、HTTP API 或 Python 适配层。

## 使用方式

```bash
npm install @taylorwong/ichartjs@^2
```

npm Registry 中无作用域的 `ichartjs` 是安全占位包，并非本项目。正式包名是 `@taylorwong/ichartjs`，优先从 npm 安装。

Codex、WorkBuddy 和其他兼容 Agent Skills 的宿主可共同使用 `skills/ichartjs`。从仓库检出目录安装到 Codex：

```bash
cp -R skills/ichartjs "${CODEX_HOME:-$HOME/.codex}/skills/"
```

推荐请求：

```text
使用 $ichartjs 检查这份数据，选择并校验合适图表，加入当前页面，
运行相关测试，并返回准确预览地址。保留所有假设和数据质量警告。
```

如果宿主不使用 `$skill-name` 语法，则在其 Skill 界面中选择或指定 `ichartjs`。

Agent 应依次完成：读取项目约束、引用 `ichartjs`、发现能力、检查数据、规划图表、校验 Spec、挂载图表、自检 explanation/state、运行测试并返回预览地址。

验收时确认没有引用 `src/` 内部文件，校验在渲染前通过，稳定 record ID 被保留，警告可见，并且替换页面时调用了 `destroy()`。
