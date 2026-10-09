# 场景：交互式 Diagram

用于流程建模、责任分工和可编辑 Diagram。

## 类型

- `flow`：节点和边组成的流程图。
- `swimlane`：带责任泳道的流程图。
- `architecture`：带可选层和边界的业务、数据或技术架构图。
- `mindmap`：以树形或放射布局呈现想法层级的思维导图。

架构图和思维导图都属于结构化图，但不能混用：架构图表达明确的领域或系统关系，思维导图表达想法层级。

Architecture 的 `layers` 是从上到下排列的水平分层。同层自动布局节点优先保持同一 Y 坐标并从左到右排列；只有可用宽度不足时才增加下一行。显式 `node.position` 始终优先，包括编辑后的坐标；自动布局不会回写 Spec。

边端点只使用 `from` 和 `to`；`source` 与 `target` 不是别名，会返回结构化校验错误。节点、泳道、层、分组和边界的显示文本使用 `label`；误用 `name` 时运行时会给出诊断，不会静默当成显示文本。

```js
{
  type: 'architecture',
  layers: [{ id: 'access', label: '接入层' }, { id: 'service', label: '服务层' }],
  nodes: [
    { id: 'web', label: 'Web 前端', layerId: 'access' },
    { id: 'gateway', label: 'API 网关', layerId: 'access' },
    { id: 'order', label: '订单服务', layerId: 'service' }
  ],
  edges: [{ from: 'gateway', to: 'order' }]
}
```

思维导图建议使用简洁的父子数据：

```js
{
  type: 'mindmap',
  nodes: [
    { id: 'root', label: '发布计划' },
    { id: 'scope', label: '范围', parentId: 'root' },
    { id: 'risk', label: '风险', parentId: 'root' }
  ],
  diagram: { mode: 'mindmap', layout: 'tree', routing: 'curved', curveTension: 0.4 }
}
```

## 轻量级流程语义

`flow` 支持一组小而明确的节点语义。没有设置 `kind` 的节点默认使用 `process`，这是便捷默认值；其他语义应显式设置 `kind`。

```js
{
  type: 'flow',
  nodes: [
    { id: 'start', kind: 'start', label: '开始' },
    { id: 'load', kind: 'process', label: '读取数据' },
    { id: 'valid', kind: 'decision', label: '是否有效？' },
    { id: 'output', kind: 'io', label: '输出结果' },
    { id: 'loop', kind: 'connector', label: '重试' },
    { id: 'end', kind: 'end', label: '结束' }
  ],
  edges: [
    { id: 'start-load', from: 'start', to: 'load' },
    { id: 'load-valid', from: 'load', to: 'valid' },
    { id: 'valid-yes', from: 'valid', to: 'output', label: '是' },
    { id: 'valid-no', from: 'valid', to: 'loop', label: '否' },
    { id: 'loop-load', from: 'loop', to: 'load' },
    { id: 'output-end', from: 'output', to: 'end' }
  ]
}
```

支持的 `kind` 为 `start`、`end`、`process`、`decision`、`io` 和 `connector`。判断节点建议至少有两条带标签的出边；循环就是普通的显式 `from` / `to` 回边。Connector 是圆形的断开连接点，不使用隐式同名匹配，所有连接都必须明确写在 `edges` 中。

Flow 的 `start` 和 `end` 节点使用真正的椭圆图元；`process` 使用矩形，`decision` 使用菱形，`io` 使用平行四边形。

节点文字默认在节点内居中，并按自适应规则处理：优先保持字号，必要时最多换成两行，再缩小到有限的最小字号，最后才截断。尺寸过小的节点（例如小型 Connector）会隐藏内部文字，避免显示不全；完整文字仍保留在节点数据和无障碍语义中。连线文字在空间足够时优先贴近连线显示；线条影响对比度时使用高不透明度背景底板，只有与节点或其他文字冲突时才移到连线旁边。`getState().layout.labels` 和 `explain().warnings` 会暴露换行、缩放、截断和隐藏结果。

## 当前能力

已支持节点、边、泳道、Group、Port、Flow 语义图形、四种布局、`auto`/直线/折线/曲线路由、形状级避障、Mindmap 三次贝塞尔曲线、节点拖动、多选、对齐、网格吸附、键盘移动、Copy/Paste、Group 折叠展开、Port 键盘连线、边选择、折点/正交线段手柄、持久化 `waypoints`、边删除和 Undo/Redo。

自动正交路由先尝试由两个端点节点确定的局部通道，并检查所有障碍；只有局部路线被阻挡时才引入障碍物通道，避免远处节点移动带来不必要的竞争路线。真正挡住线路的节点仍会触发避障重排。连线标签按节点、其他标签和视窗之间的实际水平空间排版，不以短线段或竖线长度限制文字宽度；优先单行，其次缩小到可读字号，确实不足才按英文单词边界换行。过长单词在最小字号下截断并报告 `LABEL_TRUNCATED`，不拆成两行；中文可按字符换行。Flow、Architecture、Mindmap、Swimlane 的 SVG/Canvas 共用这些规则。

开启 `diagram.snap` 时，拖动节点优先在 6 CSS 屏幕像素范围内吸附到已连接自动正交线路的相向端口，再对其他方向进行网格吸附；缩放和 CSS 尺寸变化不改变屏幕容差。临时辅助线在释放或取消后消失。按住 Alt 或设置 `diagram.snap: false` 可关闭两种吸附。多选保持相对位置，同组选中节点间的内部连线、人工路径和曲线不参与吸附；仍保留避障和显式端口方向/偏移。`alignSelected('middle')` 将节点 Y 中心对齐到同一行，`'center'` 将 X 中心对齐到同一列，不等同于自定义偏移端口对齐。

导航和编辑能力默认关闭。普通图表保持静态，缩放、平移、框选、节点拖动、线段拖动、Port 连线和结构编辑必须由宿主显式开启：

```js
interaction: { zoom: true, pan: true, drag: true, edgeDrag: true, portConnect: true },
editing: { enabled: true, allowDelete: true, allowStructuralChanges: true }
```

Canvas 与 SVG 共用 Scene Graph 命中、`waypoints`、命令、历史和交互行为，不提供渲染器专属编辑能力。

拖动折点或线段手柄会自动设置 `routingMode: 'manual'`，并以图表坐标保存 `waypoints`，避免重新渲染、缩放/平移或连续拖动时位置回退。Undo/Redo 同时恢复路由模式和折点。通过 `updateEdge` 设置 `routingMode: 'auto'` 可恢复自动路由，此时忽略已有折点；未指定模式但已有 `waypoints` 时保留人工路径。

通过指针、键盘或 Chart 编辑接口移动、缩放端点节点时，有效的人工正交路径会更新端点附近的折点，保留用户调整的中间通道。两个端点整体平移时，整条路径同步平移。节点位置和联动折点属于同一次预览、提交及 Undo/Redo，保存、重载 Spec 后仍有效。不相关节点的移动不会改变仍然畅通的人工路径。这是编辑事务行为，不适用于 `chart.update()` 直接替换 Spec。若联动路径违反端口方向、穿过节点或发生自交，则不保存非法折点；渲染器按下述规则告警并安全回退。

正交折点拖动会联动相邻折点，避免产生斜线。`routing: 'auto' | 'orthogonal'` 下，指针编辑和 Chart 的 `previewEdit()` / `applyEdit()` 会拒绝非法人工路径，返回 `EDGE_MANUAL_ROUTE_INVALID`，不改变已提交 Spec 或历史。`reason` 包括 `ORTHOGONAL_REQUIRED`、`PORT_DIRECTION`、`NODE_INTERSECTION`、`SELF_INTERSECTION`、`EMPTY_WAYPOINTS`，同一连线原路折返或自交均属于非法路径。独立 Schema/Command 校验器不校验渲染布局，Agent 修改折点应使用 Chart 编辑接口。导入的人工路径或因节点移动而失效的路径可以安全回退自动路由，但必须告警。用 `getState().edgeRoutes` / `explain().edgeRoutes` 读取 `requestedRoutingMode`、`effectiveRoutingMode`、`visible`、`reason`，不要仅凭 Spec 中的 manual 判断实际效果。

自动折线路由在两端保留足够的直线段，拒绝原路折返或自交候选，节点边缘接近或对齐时同样适用。线身绘制到箭头底边中心，逻辑终点仍是目标端口；曲线裁剪后保留原有形状，短的显式线段会缩小箭头。这仅影响绘制，不改变保存的折点或编辑手柄。

[Diagram Editor](../../../playground/diagram-editor.html) 提供恢复自动路由、保存 Spec JSON、重新加载、导出 SVG，支持 SVG/Canvas。保存 `chart.getSpec()` 后由宿主重新绑定或移除 `container`；JSON 导出是包含 `spec` 和 `state` 的信封，重新加载只取 `payload.spec`，不恢复运行时历史。SVG 导出不包含编辑手柄、Port 和选中样式，不改变当前图表。文件或存储仍由宿主管理，不新增库内持久化层。

Mindmap 默认使用曲线父子连线。`diagram.curveTension` 支持 `0.2` 到 `0.8`；显式边可以覆盖 `routing` 或 `curveTension`。需要自动避障时使用 `routing: 'auto'`；需要持久化人工折线时使用 `routingMode: 'manual'` 和 `waypoints`。人工路径穿过任意可见节点形状时不会提交。`lineStyle` 支持 `solid`、`dashed`、`dotted`，当前不支持直接拖动贝塞尔控制点。

自动路由优先正交折线：只有连接点同轴（水平或垂直）、端口朝向正确且无遮挡时才直连；其他情况仅使用水平和垂直线段，同时兼顾路径长度和较少转折。反向连接也避开源节点与目标节点内部。找不到安全正交路径时不退化为斜线，而是隐藏该连线，在 `getState().warnings` 和 `explain().warnings` 中返回 `EDGE_ROUTE_BLOCKED`，提示调整节点位置或端口。合法人工路径遵守指定线型：`auto`/`orthogonal` 要求正交；显式 `straight`、`curved` 不因消除斜线而自动改写。

当前限制：

- Group 只支持平级 Group，不支持嵌套。
- 展开的 Group 边界包含成员节点、内部连线路径、箭头和连线标签，并应用 `group.padding`；跨组连线不撑大组框。折叠时仍按成员节点计算边界，外部连线接到组框上。`resizeGroup` 会缩放成员位置和尺寸，不持久化第二个 Group 矩形。
- Canvas 提供基础无障碍文本，SVG 提供更丰富的 Diagram 语义。
- Architecture 混用手工坐标与自动坐标时可能发生重叠；运行时会保留手工坐标，不会静默搬动节点。

## Agent 流程

### 对话式增量构建 Flow

这是 [Agent-driven Incremental Construction](conversational-workflow.md#agent-driven-incremental-construction) 的 Flow 实现；宿主前提、完整语义步骤、确认界面和最终任务验收见统一指南。

自然语言由宿主 Agent 理解，Runtime 不解析对话。先读取当前 Spec 和 `getChartContract('flow').incrementalBuilding`，也可使用 `getCapabilities().diagram.incrementalBuilding`，保留节点、连线的稳定 ID。

该编辑工作流须从完整的 `@taylorwong/ichartjs` 根入口导入。轻量 `/diagram` Profile 支持渲染及 Spec 更新，不提供根 Runtime 的预览、提交及历史接口。

- `addNode`：`node: { id, label, kind?, size?, position?, ports? }`，ID 和标签不可为空，类型、尺寸、端口和组引用须通过校验。初始端口及组成员关系可声明，后续修改仍受字段可编辑规则约束。
- `removeNode`：`nodeId`，可选 `policy: 'reject' | 'cascade'`。默认有入边/出边就拒绝（`NODE_CONNECTED`）；级联仅删除该节点及其显式关联边，不删除其他节点，也不自动修复 parentId。也可在同一事务中先移除关联边。
- 修改节点使用 `updateField` / `updateRecord` + `nodeId`，修改边使用 `edgeId` 或专用连线命令；未知字段、只读字段不可修改。
- 一轮请求的新增节点、替换连线和字段修改合并为一个命令。引用按最终图校验，失败不改变 Spec、revision、历史。结构编辑须显式开启 `editing.enabled` 和 `editing.allowStructuralChanges`，即使 `requireConfirmation: false` 仍需图表签发的预览和宿主确认。

自动构建设置 `diagram: { layout: 'layered', routing: 'auto' }`，不要提供节点 `position`。每次提交按图结构和实际节点尺寸确定性重排；循环回边不增加前向层级。显式人工位置、保存的人工折点不被清除。`FLOW_NODE_OVERLAP`、`FLOW_LAYOUT_OVERFLOW` 暴露空间限制，不通过缩小节点、自动缩放或平移掩盖问题。大图可能仍需扩大容器或人工定位；不提供布局动画或最小位移布局。

<!-- docs-check: incremental-flow -->
```js
import { createChart } from '@taylorwong/ichartjs';
const chart = createChart({
  type: 'flow', renderer: 'svg',
  nodes: [{ id: 'start', kind: 'start', label: '开始' }], edges: [],
  diagram: { layout: 'layered', routing: 'auto' },
  editing: { enabled: true, allowStructuralChanges: true }
});
const command = { type: 'layout-edit', operations: [
  { op: 'addNode', node: { id: 'review', kind: 'process', label: '审核请求' } },
  { op: 'addEdge', id: 'start-review', from: 'start', to: 'review' }
] };
const validation = chart.validateEdit(command);
if (!validation.valid) throw new Error(JSON.stringify(validation.errors));
const preview = chart.previewEdit(command);
if (!preview.valid) throw new Error(JSON.stringify(preview.errors));
console.log(preview.layout, preview.warnings);
if (approvedByHost) {
  const result = chart.applyEdit(preview.command, { preview, confirmed: true, source: 'host-agent' });
  if (!result.valid) throw new Error(JSON.stringify(result.errors));
}
```

宿主检查预览后提供 `approvedByHost`，不是 Agent 自设标记。实时 UI 将 `chart` 挂载一次以显示提交；无 DOM 时也可按此例检查/导出每轮结果。`chart.validateEdit(command)` 自动使用实例上下文；底层 `validateEdit(command, options)` 要求显式编辑上下文，不是 Spec。权限开关属于宿主 Spec，不可放在生成命令中。`preview.layout` 和 `getState().layout.diagram` 提供图表逻辑坐标中的节点矩形、实际连线模式和布局告警，可用 `preview.after` 挂载独立的非编辑预览图。revision 或容器尺寸变化后重新预览。一轮提交对应一次撤销，`getSpec()` 可保存并继续构建；重载重新计算自动位置，不恢复历史。不要每轮使用 `update({ nodes, edges })`，因为它会清空历史。

[增量 Flow 配方](../../../agent-recipes/diagrams/incremental-flow.json) 是起始 Spec 和有序命令模板，不是自动执行任务。逐步涵盖处理、判断、分支、循环、改名、级联删除。未构建完时 `FLOW_MISSING_END` / `FLOW_DECISION_BRANCHES` 是预期的语义提示，须向用户说明并在完成流程时解决；不能隐藏布局和路由告警。

预览：`http://localhost:3000/playground/diagram-editor.html` 默认从空画布开始。点击四次**下一步**，依次添加开始、提交申请、审批判断和通过/拒绝结果；**上一步**撤销一轮，**重新开始**清空示例。点击下一步即授权当前显示的预设步骤，内部仍执行校验、预览和确认提交。页面不解析自然语言，示例完成不等于业务任务验收通过；中间步骤的诊断保留在默认折叠的**开发者工具**中。

`?scenario=advanced` 打开命令编辑、独立预览、显式确认、取消、历史、保存重载和导出；`?scenario=editor` 打开手工节点/线路编辑器。默认及 `?scenario=incremental` 均为简单示例。可添加 `renderer=canvas`、`lang=zh-CN` 或 `lang=en` 查询参数；否则跟随浏览器语言，未识别语言回退英文。开发者工具更改画布后，需要重新开始才能继续简单示例。

1. 为节点和边分配稳定 ID。
2. 使用 `validateDiagram(spec)` 检查端点、Port、Group、Lane 和布局。
3. 使用 `createChart(spec)` 创建图表。
4. 使用 `moveNodes`、`alignNodes`、`snapNodes`、`updateEdge`、`removeEdge` 等命令编辑。
5. 编辑遵循 `editing-contract.md` 的 Preview/Confirm/Commit 流程。

## 开发位置与验收

- 模型、校验、布局、路由：`src/diagram.mjs`
- 交互：`src/diagram-interaction.mjs`
- Scene：`src/project.mjs`
- 命令事务：`src/command.mjs`、`src/edit-controller.mjs`
- 专用 Demo：`playground/diagram-editor.html`
- 全量 Gallery：`playground/project-gallery.html`

节点移动后必须验证边、箭头和标签跟随；Architecture 无显式坐标的同层节点应横向优先排列；同时检查 Canvas 与 SVG 的边命中、手柄拖动、waypoint 持久化、键盘和导出一致性。
