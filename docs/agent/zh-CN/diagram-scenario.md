# 场景：交互式 Diagram

用于流程建模、责任分工和可编辑 Diagram。

## 类型

- `flow`：节点和边组成的流程图。
- `swimlane`：带责任泳道的流程图。

## 当前能力

已支持节点、边、泳道、Group、Port、四种布局、三种路由、节点拖动、多选、对齐、网格吸附、键盘移动和 Undo/Redo。

当前限制：

- Group 只支持平级 Group，不支持嵌套。
- Port 可显示并参与路由，但 Port 拖拽连线尚未完成。
- Copy/Paste 和 Group 折叠展开尚未完成。

## Agent 流程

1. 为节点和边分配稳定 ID。
2. 使用 `validateDiagram(spec)` 检查端点、Port、Group、Lane 和布局。
3. 使用 `createChart(spec)` 创建图表。
4. 使用 `moveNodes`、`alignNodes`、`snapNodes` 等命令编辑。
5. 编辑遵循 `editing-contract.md` 的 Preview/Confirm/Commit 流程。

## 开发位置与验收

- 模型、校验、布局、路由：`src/diagram.mjs`
- 交互：`src/diagram-interaction.mjs`
- Scene：`src/project.mjs`
- 命令事务：`src/command.mjs`、`src/edit-controller.mjs`
- 专用 Demo：`playground/diagram-editor.html`
- 全量 Gallery：`playground/project-gallery.html`

节点移动后必须验证边、箭头和标签跟随；同时检查 Canvas 与 SVG 的一致性。
