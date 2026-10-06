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

导航和编辑能力默认关闭。普通图表保持静态，缩放、平移、框选、节点拖动、线段拖动、Port 连线和结构编辑必须由宿主显式开启：

```js
interaction: { zoom: true, pan: true, drag: true, edgeDrag: true, portConnect: true },
editing: { enabled: true, allowDelete: true, allowStructuralChanges: true }
```

Canvas 与 SVG 共用 Scene Graph 命中、`waypoints`、命令、历史和交互行为，不提供渲染器专属编辑能力。

拖动折点或线段手柄会自动设置 `routingMode: 'manual'`，并以图表坐标保存 `waypoints`，避免重新渲染、缩放/平移或连续拖动时位置回退。Undo/Redo 同时恢复路由模式和折点。通过 `updateEdge` 设置 `routingMode: 'auto'` 可恢复自动路由，此时忽略已有折点；未指定模式但已有 `waypoints` 时保留人工路径。

Mindmap 默认使用曲线父子连线。`diagram.curveTension` 支持 `0.2` 到 `0.8`；显式边可以覆盖 `routing` 或 `curveTension`。需要自动避障时使用 `routing: 'auto'`；需要持久化人工折线时使用 `routingMode: 'manual'` 和 `waypoints`。人工路径穿过任意可见节点形状时不会提交。`lineStyle` 支持 `solid`、`dashed`、`dotted`，当前不支持直接拖动贝塞尔控制点。

自动路由优先正交折线：只有连接点同轴（水平或垂直）、端口朝向正确且无遮挡时才直连；其他情况仅使用水平和垂直线段，同时兼顾路径长度和较少转折。反向连接也避开源节点与目标节点内部。找不到安全正交路径时不退化为斜线，而是隐藏该连线，在 `getState().warnings` 和 `explain().warnings` 中返回 `EDGE_ROUTE_BLOCKED`，提示调整节点位置或端口。显式 `straight`、`curved` 及人工路径保持用户意图，不因消除斜线而自动改写。

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
