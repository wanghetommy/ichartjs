# 编辑契约

Agent 对业务数据和 Diagram 数据的安全编辑协议。

## 必须遵循的流程

```text
读取 Schema → 构造 Command → Validate → Preview → Confirm → Commit → ChangeSet
```

不要直接修改业务数据对象，使用 Chart 编辑 API。

```js
const preview = chart.previewEdit(command);
if (!preview.valid) return preview.errors;
const result = chart.applyEdit(command, { preview, confirmed: true, source: 'agent' });
```

## 规则

优先使用实例的 `chart.validateEdit(command)`、`chart.previewEdit(command)`、`chart.applyEdit(command, options)`。实例自动提供当前图、Schema、宿主权限和布局上下文；校验与预览使用相同上下文，但校验不会签发可提交预览，也不修改状态或历史。

导出的 `validateEdit(command, options)`、`previewEdit(command, options)` 是底层函数，第二个参数是显式编辑上下文，**不是 ChartSpec**。Diagram 上下文提供 `type`、`nodes`、`edges`、相关 Schema/泳道/组及宿主控制的 `allowStructuralChanges`；不会读取 `options.editing.allowStructuralChanges`。底层 `commitPreview(preview, options)` 不提交到 Chart，也不管理实例 revision/历史，不可替代实例事务边界。

Board 使用单参数 `validateBoardCommand(command)`，再调用 `board.previewEdit(command)` / `board.applyEdit(command, options)`；操作字段为 `op`，不是 `type`；`boardCapabilities` 是对象，不是函数。可运行结构见 [Flow 示例](diagram-scenario.md#对话式增量构建-flow) 和 [Board 示例](canvas-scenario.md#agent-分步构建)。

结构权限由宿主在实例 Spec 中显式开启 `editing.enabled`、`editing.allowStructuralChanges`，再重新预览并确认。不要在生成命令中加入授权开关，也不要因收到诊断自动开启权限。

- 命令版本为 `1.0`，目标使用稳定 ID。
- Preview 和 Commit 的命令必须一致。
- 默认需要 Host 确认；确认不等同于授权。
- 成功提交产生 ChangeSet、审计信息、revision 和 Undo 历史。
- 外部持久化、权限和认证由 Host 应用负责。
- 指针导航和编辑默认关闭。`editing.enabled` 授权编辑事务；`interaction.drag`、`interaction.edgeDrag`、`interaction.portConnect` 分别控制直接操作 UI。
- Diagram 边通过 JSON-safe 的 `waypoints` 持久化；路径更新使用 `updateEdge`，删除使用 `removeEdge`，并要求结构编辑权限。
- Mindmap 边使用独立的 `mindmap-edge` 契约，但与 Flow、Architecture 共享相同的边编辑语义。
- `update()`、`setData()`、`setTheme()` 和偏好设置输入失败时抛出结构化 `ChartValidationError`，失败不会推进 revision 或破坏历史。

Schema、命令、Preview/Commit、事务和历史的实现分别位于 `src/schema.mjs`、`src/command.mjs`、`src/edit.mjs`、`src/edit-controller.mjs` 和 `src/history.mjs`。
