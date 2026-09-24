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

## 当前能力

已支持节点、边、泳道、Group、Port、四种布局、三种路由、Mindmap 三次贝塞尔曲线、节点拖动、多选、对齐、网格吸附、键盘移动、Copy/Paste、Group 折叠展开、Port 键盘连线、边选择、折点/正交线段手柄、持久化 `waypoints`、边删除和 Undo/Redo。

导航和编辑能力默认关闭。普通图表保持静态，缩放、平移、框选、节点拖动、线段拖动、Port 连线和结构编辑必须由宿主显式开启：

```js
interaction: { zoom: true, pan: true, drag: true, edgeDrag: true, portConnect: true },
editing: { enabled: true, allowDelete: true, allowStructuralChanges: true }
```

Canvas 与 SVG 共用 Scene Graph 命中、`waypoints`、命令、历史和交互行为，不提供渲染器专属编辑能力。

Mindmap 默认使用曲线父子连线。`diagram.curveTension` 支持 `0.2` 到 `0.8`；显式边可以覆盖 `routing` 或 `curveTension`。存在 `waypoints` 时优先使用人工折线，当前不支持直接拖动贝塞尔控制点。

当前限制：

- Group 只支持平级 Group，不支持嵌套。
- Group bounds 由成员几何和 `group.padding` 推导；`resizeGroup` 会缩放成员位置和尺寸，不持久化第二个 Group 矩形。
- Canvas 提供基础无障碍文本，SVG 提供更丰富的 Diagram 语义。
- Architecture 混用手工坐标与自动坐标时可能发生重叠；运行时会保留手工坐标，不会静默搬动节点。

## Agent 流程

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
