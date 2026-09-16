# 编码 Agent 集成

本指南适用于 Codex 等能够读取仓库、编辑 JavaScript、运行测试并打开本地预览的编码 Agent。

## 边界

iChart.js 是 JavaScript UI 图表组件库。编码 Agent 负责修改宿主前端，并调用统一的 `ichartjs` ESM API。Skill 只提供工作流指导，不是第二套 Runtime，也不是服务接口。

普通图表开发不需要 CLI、MCP、HTTP API 或 Python 适配层。

## 使用方式

```bash
npm install github:wanghetommy/ichartjs#v2.0.0
```

npm Registry 中无作用域的 `ichartjs` 当前是安全占位包，并非本项目。正式 npm scope 确认前请从 GitHub 安装。

可选安装 Codex Skill：

```bash
cp -R skills/ichartjs "${CODEX_HOME:-$HOME/.codex}/skills/"
```

推荐请求：

```text
使用 iChart.js 检查这份数据，选择并校验合适图表，加入当前页面，
运行相关测试，并返回准确预览地址。保留所有假设和数据质量警告。
```

Agent 应依次完成：读取项目约束、引用 `ichartjs`、发现能力、检查数据、规划图表、校验 Spec、挂载图表、自检 explanation/state、运行测试并返回预览地址。

验收时确认没有引用 `src/` 内部文件，校验在渲染前通过，稳定 record ID 被保留，警告可见，并且替换页面时调用了 `destroy()`。
