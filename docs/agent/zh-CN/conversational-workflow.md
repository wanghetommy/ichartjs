# 自然语言修改工作流

iChart.js Runtime 不在内部解析自然语言。Codex、WorkBuddy 等宿主 Agent 负责理解用户请求，并将请求转换成公开的 JavaScript API；Runtime 负责校验、提交、渲染、解释和导出。

## 安全执行流程

所有对话式修改都遵循：

```text
读取当前状态
  → 判断请求类型
  → 生成结构化变更
  → 校验或预览
  → 破坏性操作请求确认
  → 提交
  → explain 和 getState 自检
  → 返回预览或导出结果
```

修改已有图表前，先读取 `getCapabilities()`、`chart.getSpec()`、`chart.getState()` 和 `chart.getPreferences()`。原始自然语言应单独保留，不能直接把自然语言句子传给 `planChart().intent`，应先映射为已注册的 intent token。

## 请求分流

| 用户请求 | Runtime 操作 | 是否确认 |
| --- | --- | --- |
| 修改主题、配色、字号、图例、标签、网格 | `setTheme()` 或 `setPreferences()` | 通常不需要 |
| 替换全部数据行 | `setData()` | 由宿主策略决定 |
| 修改任务、里程碑、节点、连线或项目记录 | `previewEdit()` → `applyEdit()` | 批量、删除、结构调整需要 |
| 修改图表类型、字段、坐标轴、标题、标签或布局 | `update()` | 通常不需要 |
| 修改一个明确的 JSON 路径 | `applyPatch()` | 优先使用 `update()` |
| 导出结果 | `export()`、`downloadSVG()` 或 `downloadPNG()` | 不需要 |

## 修改样式

使用白名单偏好接口，不要让 Agent 自行发明 CSS 或颜色 Token：

```js
const capabilities = getPreferenceCapabilities(chart.getSpec().type, { locale: 'zh-CN' });
const patch = {
  theme: { mode: 'dark', palette: 'status' },
  typography: { scale: 1.15 },
  components: { grid: false }
};
const checked = validatePreferences(patch, { partial: true });
if (!checked.valid) throw new Error(JSON.stringify(checked.errors));
chart.setPreferences(checked.value, { source: 'agent' });

const state = chart.getState();
console.log(state.preferences, state.preferenceResolution, state.style);
```

使用共享 `PreferencesStore` 时，`scope: 'global'` 表示修改页面全部图表；默认作用于当前图表。

## 修改数据和业务记录

只有在替换整批数据时使用 `setData()`：

```js
chart.setData(nextRows);
```

修改任务、里程碑、节点、边等业务记录时，使用带预览的编辑命令：

```js
const preview = chart.previewEdit({
  type: 'data-edit',
  operations: [{ op: 'updateProgress', taskId: 'task-2', progress: 80 }]
});
if (!preview.valid) return preview.errors;

const approvedByHost = await requestHostApproval(preview);
if (!approvedByHost) return { cancelled: true };

const result = chart.applyEdit(preview.command, {
  preview,
  confirmed: approvedByHost,
  source: 'agent'
});
```

这样可以保留校验、revision、ChangeSet、历史记录和撤销/重做。存在对应编辑命令时，不要直接修改业务数据对象。
`requestHostApproval()` 由宿主提供，不是 iChart.js API；拒绝或过期的预览不能提交。

## 修改 Spec 配置

普通配置修改使用 `update()`：

```js
chart.update({
  title: { text: '月度收入' },
  yAxis: { title: '收入', nice: true },
  labels: { enabled: true }
});
```

只有在必须修改明确 JSON 路径时才使用 `applyPatch()`。两种修改后都要检查校验结果和诊断信息。

## 提交后的自检

```js
const explanation = chart.explain();
const state = chart.getState();

return {
  revision: state.revision,
  health: state.health,
  warnings: state.warnings,
  assumptions: state.assumptions,
  style: state.style,
  preferenceResolution: state.preferenceResolution,
  lineage: explanation.lineage
};
```

`UNKNOWN_INTENT`、`LABELS_SUPPRESSED`、`LABEL_TRUNCATED`、`FUNNEL_LABEL_TRUNCATED`、`VALUE_CLAMPED`、`NEGATIVE_VALUE_DROPPED`、`ZERO_TOTAL` 和不支持的配置都必须报告，不能静默忽略。

## Agent-driven Incremental Construction

中文称 **Agent 驱动的增量构建**，面向用户可称“可视化分步构建”。它按**完整语义批次**展示构建过程，不是模型 Token 流式输出、实时数据刷新、半截 JSON 渲染或局部渲染性能优化。适用于边对话边构建流程、分阶段组合 Board、受控修改已有作品；简单一次性图表和无人值守报表优先一次校验后渲染。

### 宿主前提与职责

需要保持同一个已挂载的 JavaScript 实例和可访问的预览地址，Agent 通过宿主提供的通道读取当前 Spec/状态，并向该实例提交结构化命令。仅安装 Skill、返回最终 HTML 或 PNG，不会自动展示实时构建过程。没有可更新的预览宿主时，应明确限制，改为交付代码、JSON 和最终文件，不声称用户看到了中间步骤。

宿主负责自然语言理解、步骤标题/状态、命令传输、权限、确认界面和持久化；iChart.js 负责校验、布局、渲染、revision 防护、原子提交及撤销/重做。复用宿主现有集成，不要求组件新增 CLI、MCP 或 HTTP 服务。待确认的可视化预览与已提交主体分离，不能偷偷替换主体。

### 统一单轮契约

1. 读取当前 Spec、状态/revision 和对应能力契约，保留稳定 ID 及人工编辑。
2. 规划一个有意义的步骤和变更摘要，生成完整的类型化批次，不逐 Token 提交。
3. 校验并调用 `previewEdit()`，展示独立预览、受影响 ID、布局及全部错误/警告。无效批次停止，不改变历史。
4. 对这份预览获取明确宿主批准；**取消**仅丢弃预览。Agent 自己写出 `confirmed: true` 不等于用户授权。
5. 批准后才调用 `applyEdit(preview.command, { preview, confirmed: true })`。revision 变化时丢弃过期预览并重新预览，不能静默重试覆盖新状态。
6. 用 `getState()` 和 `explain()` 自检，报告 revision、诊断和已提交步骤；一轮成功批次对应一个撤销项。下一轮从最新状态开始。
7. 最后独立验收任务要求：步骤、文案、关系、布局、资源及警告。`health.renderable` 不代表任务完成。保存 JSON 并导出 SVG/PNG，返回准确地址/路径；Spec 不保存历史。

| 构建对象 | 能力发现与命令 | 布局及就绪 |
| --- | --- | --- |
| Flow | 根入口；`getChartContract('flow').incrementalBuilding`、`validateCommand()`、节点/边编辑 | 显式 `layered` 重排未指定位置的节点；保留人工位置和折点。检查 `preview.layout`、`getState().layout.diagram`。 |
| Freeform Board | 根入口或 `/board`；`canvasComposition.incrementalBuilding` 或 `boardCapabilities.incrementalBuilding`、`validateBoardCommand()`、`type: 'board-edit'` | 保留构图和锁定项，只在明确要求时移动/调整尺寸。等待 `ready()` 并检查图片状态/health；资源结束等待不等于加载成功。 |

具体字段、操作和配方见 [Flow 指南](diagram-scenario.md)及 [Board 指南](canvas-scenario.md)，两类命令不能混用。反复全量 `update()` 不是构建历史。缩放、平移、拖动和动画仍需显式开启，构建过程不依赖它们。

既有 Playground 演示的是**手动宿主**，不内置自然语言模型：

- Flow：`http://localhost:3000/playground/diagram-editor.html?scenario=incremental`
- Board：`http://localhost:3000/playground/canvas-board.html?scenario=incremental`
- 这些地址及不带参数的页面均默认展示四步示例，只需下一步、上一步、重新开始。下一步授权当前显示的预设指令，内部执行校验、预览及确认提交，不内置自然语言解析。开发者工具默认折叠；改用 `?scenario=advanced` 可操作 Start → Preview command → Confirm and apply、取消预览、撤销/重做及交付检查，再保存/重载/导出。追加 `&renderer=canvas` 验收 Canvas。高级 Flow 删除模板仍故意保留分支警告；完成示例或模板不等于业务任务验收通过。

推荐构建提示词：

```text
使用 iChart.js Agent-driven Incremental Construction 构建 <Flow 或 Board 任务>。
保持预览页可见，复用同一个实例。先给出简短步骤计划；每个完整步骤读取最新状态，
生成类型化命令并预览，展示变更和警告，等待宿主批准后提交。
保留人工位置和锁定内容，支持取消及撤销。最后验收我的任务要求，报告未解决问题，
返回预览地址、JSON 和 SVG/PNG。如果宿主无法更新实时预览，先说明再提供最终文件。
```

## 推荐提示词

```text
使用 iChart.js Skill。先读取当前 Spec、状态、偏好和能力清单。
判断我的请求属于视觉样式、整批数据替换、业务记录编辑、Spec 配置、Diagram 编辑还是导出。

视觉调整使用 setPreferences/setTheme；整批替换使用 setData；
业务和 Diagram 编辑使用 previewEdit/applyEdit；普通 Spec 配置使用 update；
只有精确 JSON 路径修改才使用 applyPatch。提交前先校验或预览。
删除、批量修改和结构调整先请求确认。提交后调用 chart.explain() 和 chart.getState()，
返回变更内容、警告、假设、lineage、预览地址和文件路径。

请求：<描述需要的修改>
```

宿主负责权限、确认界面、持久化和自然语言模型；iChart.js 负责可校验的 JavaScript Runtime，不需要为了这个工作流增加 CLI、MCP 或 HTTP 服务。
