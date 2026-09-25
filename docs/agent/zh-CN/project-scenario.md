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
- `dependencies` 使用稳定任务 ID，支持字符串或 `{ id, type, lag, lead }` 对象，依赖图不能有环。
- `dependsOn` 不是别名，会被诊断并忽略；请使用正式字段 `dependencies`。
- 依赖类型支持 `finish-to-start`、`start-to-start`、`finish-to-finish` 和 `start-to-finish`；连线使用对应任务端点。具有净空的正向 FS 关系使用三段紧凑路径，重叠或反向关系使用外侧绕行。
- `scopeChange` 表示范围变化，不等于已完成工作量。
- Forecast 是估计结果，不能描述为承诺或事实。
- Gantt、Timeline 和 Milestone 根据 Unicode-aware 文本宽度预留左侧标签列；超过列宽的标签按像素省略，不按字符数截断。
- Timeline 和 Milestone 使用横向时间轴：`date` 映射到 x/`cx`，y/`cy` 只表示用于布局的事件行。Agent 需要确认方向、字段和计算后的日期域时，应读取 `chart.getState().timeAxis` 或 `chart.explain().timeAxis`。两者会在时间域边缘保留少量视觉留白；Milestone 覆盖层使用 `baselineDate` 和 `actualDate`，显示文本正式字段为 `title`（`name` 和 `label` 仍由兼容回退逻辑接受）。相邻标记会在可能时自动错位；如果空间不足，结果会返回 `TIMELINE_COLLISION`，建议增大高度或减少事件数量。
- `locale` 同时作用于项目日期刻度、Burndown 预测文案和项目 Tooltip；需要中文运行时文案时使用 `locale: 'zh-CN'`。
- 自动验收时应比较事件的 `x`/`cx` 与横向刻度的 `x`；y/`cy` 等距是正常的事件行布局，不表示日期被忽略。

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

需要覆盖日期错误、循环依赖、四种依赖类型端点、FS 三段路径、Scope Change、Forecast、中文标签边界和编辑历史。
