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

const result = chart.applyEdit(preview.command, {
  preview,
  confirmed: true,
  source: 'agent'
});
```

这样可以保留校验、revision、ChangeSet、历史记录和撤销/重做。存在对应编辑命令时，不要直接修改业务数据对象。

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
