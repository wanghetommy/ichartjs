# Iteration 12：结构化图——架构图与思维导图

Iteration 12 在 Flow/Swimlane 现有 Diagram Runtime 上增加两种结构化图模式。架构图和思维导图共用节点、边、布局、交互、导出和 Agent 契约，不新增第二套渲染器。

## 12A：共享结构化图模型

- 复用稳定节点 ID、边、Group、Port、位置、尺寸、路由、选择、键盘导航、历史、Canvas/SVG 渲染以及 JSON/SVG/PNG 导出。
- 将 `diagram.mode` 归一化为 `process`、`architecture` 或 `mindmap`。
- 思维导图可以从 `node.parentId` 推导父子边，同时保留显式边。
- 校验缺失父节点、自引用、重复 ID、无效层引用和思维导图循环。
- Agent 统一使用 `validateDiagram()` 作为校验入口。

## 12B：架构图模式

- 使用 `type: 'architecture'` 表达业务架构、数据架构和技术架构。
- 使用 `layers` 表达稳定的架构分层。
- 使用 `boundaries` 表达领域、系统、平台或上下文边界，并支持 `nodeIds`、标签、边距和颜色。
- 普通边表达依赖、实现、持久化、发布等关系；Runtime 不擅自推断业务语义。
- 有明确位置时保留手工布局，否则使用确定性的分层布局。

## 12C：思维导图模式

- 使用 `type: 'mindmap'` 和 `parentId` 表达简洁的 Agent 友好层级。
- 支持确定性的 `tree` 和 `radial` 布局。
- 使用现有 Diagram 模型表达根节点和分支强调，不新增独立编辑模型。
- 保留稳定 ID 和父引用，Agent 可以只更新一个分支。

## 12D：Agent 契约与 Schema

- 在 `getCapabilities()`、`planChart()`、图表能力、TypeScript 声明和 manifest 中暴露 `architecture`、`mindmap`。
- 增加 `architecture-node`、`architecture-edge`、`mindmap-node` Schema。
- 对层、边界和父节点语义返回 assumptions 与结构化诊断，不静默猜测。
- 两者都归入 `diagram` 家族，仅在 architecture、hierarchy、brainstorm 等意图下推荐。

## 12E：Playground 与文档

- 在 `playground/project-gallery.html` 增加 Architecture 和 Mindmap 示例。
- 要区分：架构图表达领域/系统结构，思维导图表达想法层级；思维导图不默认等同于架构图。
- 执行 `npm run playground`，打开 `http://localhost:3000/playground/project-gallery.html`，搜索 `Architecture` 或 `Mindmap`。

## 12F：Canvas/SVG 一致的线段编辑

线段直接编辑必须是与渲染器无关的 Diagram 能力。可以先用 SVG 验证交互体验，但 Canvas 与 SVG 必须提供相同的公共操作、编辑语义、持久化数据、键盘行为和最终验收状态。只要任一渲染器仍为只读或能力缩水，12F 就不算完成。

Runtime 默认状态必须静态、安全，不产生意外的视图或结构变化。缩放、平移、框选、节点拖动、线段拖动、端口连线和结构命令默认全部关闭，必须由宿主显式开启。Agent 编辑继续使用经过校验的预览/提交契约，不得隐式开启页面中的指针编辑能力。

### 第一阶段：边命中与选择

- 增加基于几何距离的边命中算法和宽容的交互容差，不再依赖 Scene Node 的矩形 `bounds`。
- Flow、Swimlane、Architecture、Mindmap 中的边都可选择，但不影响普通 Line 等数据图表的折线交互。
- Canvas 与 SVG 一致支持选中、Hover、焦点、删除、Escape 和键盘遍历状态。
- 命中检测放在共享 Scene Graph 中；SVG 可以使用透明粗描边优化 DOM 交互，但不能以 SVG DOM 作为唯一事实来源。
- 通过 `getCapabilities()` 明确暴露边选择和边编辑能力。
- 默认图表 Spec 必须关闭导航与编辑；Gallery 和只读嵌入页面不能隐式开启这些能力。

### 第二阶段：折点与线段手柄

- 仅在编辑模式选中边后显示折点手柄和线段中点手柄。
- 拖动折点只更新一个 waypoint；拖动正交线段中点只移动对应的水平或垂直线段。
- 使用不可见的扩大命中区域和最小触控尺寸，让细线易于操作，同时不改变可见线宽。
- 复用共享编辑控制器的预览、确认、提交、撤销、重做和审计能力。
- 可以先在 SVG 中验证交互，但不能发布渲染器特有的公共行为。

### 第三阶段：人工路由持久化

- 在边契约中增加 JSON-safe 的 `waypoints`，继续使用稳定 edge ID。
- Canvas、SVG、JSON 导出、SVG/PNG 导出、复制粘贴、复制和 Agent 编辑均使用同一 waypoint 模型。
- 路由优先级定义为：存在显式 waypoints 时优先使用，否则执行自动避障路由。
- 节点移动后尽量保留有效人工线段，修复无效的端点线段；人工路径不可用时回退到确定性的自动路由。
- Agent 通过经过校验的 `updateEdge` 操作更新路径，不增加渲染器专属命令。

### 12F 验收

- Canvas 与 SVG 通过同一套边命中、选择、手柄拖动、持久化、撤销/重做、键盘和导出测试。
- Flow、Swimlane、Architecture、Mindmap 共用同一套边编辑契约和交互实现。
- 细线在不改变可见宽度的情况下仍容易选择。
- 人工 waypoints 在重绘、切换渲染器、序列化、导出和重新创建图表后保持不变。
- 节点移动后边不能穿过节点；无效人工路径必须被修复或确定性地重新路由。
- 在双渲染器一致性全部通过前，Capabilities 应报告线段拖动不可用，而不是只声明 SVG 支持。
- 默认图表保持静态：缩放、平移、框选、节点拖动、线段拖动、端口连线和结构编辑只有在宿主显式配置后才启用。

## 12G：Mindmap 贝塞尔曲线

- Mindmap 父子连线默认使用 `routing: 'curved'`；Flow、Swimlane、Architecture 继续默认使用正交路由。
- `curved` 在 Canvas 与 SVG 中都渲染为一段真实三次贝塞尔曲线，不再是四点折线。
- `diagram.curveTension` 和单边 `curveTension` 支持 `0.2` 到 `0.8`，默认值为 `0.4`。
- 标签位于贝塞尔中点，箭头根据终点切线定向；共享 Scene Graph 通过曲线采样保持 Canvas/SVG 命中一致。
- 曲线穿过其他节点时，确定性回退到具备避障能力的正交路由。
- 显式 `waypoints` 优先并继续使用人工折线。暂不提供贝塞尔控制点拖动；节点移动后自动重新计算曲线。

## 验收

- `npm run agent:check` 通过，公开图表类型为 18 个，业务 Schema 为 10 个。
- Architecture 在 SVG 和 Canvas 下均能显示层、边界、节点和依赖边。
- Mindmap 能校验父引用与循环，生成稳定父子边，并确定性渲染 tree/radial 布局。
- 既有 Flow、Swimlane 测试和预览不回归。
- Iteration 12F 只有在 Canvas 与 SVG 具备一致的线段编辑能力后才通过验收。
- Iteration 12G 只有在 Canvas、浏览器 SVG 与 Headless SVG 都输出真实三次贝塞尔路径，并保持默认静态交互时才通过验收。
