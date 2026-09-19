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

- 命令版本为 `1.0`，目标使用稳定 ID。
- Preview 和 Commit 的命令必须一致。
- 默认需要 Host 确认；确认不等同于授权。
- 成功提交产生 ChangeSet、审计信息、revision 和 Undo 历史。
- 外部持久化、权限和认证由 Host 应用负责。
- 指针导航和编辑默认关闭。`editing.enabled` 授权编辑事务；`interaction.drag`、`interaction.edgeDrag`、`interaction.portConnect` 分别控制直接操作 UI。
- Diagram 边通过 JSON-safe 的 `waypoints` 持久化；路径更新使用 `updateEdge`，删除使用 `removeEdge`，并要求结构编辑权限。

Schema、命令、Preview/Commit、事务和历史的实现分别位于 `src/schema.mjs`、`src/command.mjs`、`src/edit.mjs`、`src/edit-controller.mjs` 和 `src/history.mjs`。
