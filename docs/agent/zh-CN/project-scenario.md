# 场景：项目管理图表

用于项目排期、交付进度和项目状态报告。

## 图表选择

| 类型 | 适用场景 | 核心数据 |
| --- | --- | --- |
| `gantt` | 任务排期、依赖、关键路径 | `id/name/start/end` |
| `timeline` | 事件时间线 | `id/title/date` |
| `milestone` | 关键节点 | `id/title/date` |
| `burndown` | Sprint 剩余工作量 | `date/remaining` |

## 业务规则

- 日期必须有效，Gantt 的 `end` 不得早于 `start`。
- `progress` 使用 `0–100` 百分比。
- `dependencies` 使用稳定任务 ID，依赖图不能有环。
- `scopeChange` 表示范围变化，不等于已完成工作量。
- Forecast 是估计结果，不能描述为承诺或事实。

## 编辑流程

项目编辑统一遵循：

```text
Schema → Command → Validate → Preview → Confirm → Commit → ChangeSet
```

常用命令包括 `updateProgress`、`shiftTask`、`addDependency`、`removeDependency` 和 `updateMilestone`。

## 开发位置与验收

- 项目 Scene 和 Tooltip：`src/project.mjs`
- Schema：`src/schema.mjs`
- 命令和编辑：`src/command.mjs`、`src/edit.mjs`
- 测试：`tests/core.test.mjs`
- 验收：`playground/project-gallery.html`

需要覆盖日期错误、循环依赖、Scope Change、Forecast 和编辑历史。
