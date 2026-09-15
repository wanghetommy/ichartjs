# iChart.js 下一阶段开发计划（Iteration 5 补齐）

## Summary

本阶段以补齐 `docs/agent/development/iteration-5.md` 中尚未完成的 Diagram Runtime 能力为主，不提前切主线到 Iteration 6。开发目标不是再铺新图表类型，而是把 `flow` / `swimlane` 的编辑链路补成一条完整、可验证、可演示、可验收的主线：

1. 补齐组与端口相关的结构化编辑能力。
2. 完成复制粘贴、拖拽连线和完整键盘编辑闭环。
3. 把正交路由从“声明支持”补到“可避障使用”。
4. 完成 SVG 无障碍关系、Demo、文档和跨端验收收口。

建议按 4 个开发波次推进，每一波都以“源代码 + Demo + 测试 + 文档”一起闭环，而不是只补单点实现。

## Current State Analysis

### 仓库与版本现状

* 仓库当前版本为 `2.0.0-rc.1`，见 `package.json`。

* `docs/agent/development/roadmap.md` 明确写明：Iteration 4 已完成，本地运行时已到 `rc.1` 评审阶段。

* 下一条主线是 Iteration 5，目标是把 Flow / Swimlane 变成可复用、可编辑、对协作友好的图运行时。

### 已有能力

结合 `docs/agent/development/iteration-5.md`、`docs/agent/diagram-scenario.md` 和当前代码，仓库已经具备：

* 图模型规范化、校验、布局与基础路由：`src/diagram.mjs`

* Flow / Swimlane 场景渲染：`src/project.mjs`

* 共享编辑预览、提交、撤销、重做：`src/edit.mjs`、`src/edit-controller.mjs`、`src/history.mjs`

* 节点拖拽、多选、对齐、吸附、键盘移动：`src/diagram-interaction.mjs`、`src/index.mjs`

* Group / Port 的基础展示：`src/project.mjs`

* Diagram 编辑 Demo：`playground/diagram-editor.html`

* 单测已覆盖 deterministic layout、resize、multi-select、align、snap、undo：`tests/core.test.mjs`

### 明确未完成项

文档与代码共同指向的缺口主要有：

1. Group 只有平面展示，没有 collapse / expand 与组级编辑。
2. Port 只支持展示与路由声明，没有完整 drag-to-connect 交互。
3. 复制粘贴尚未打通结构化命令、ID 重写、内部边复制与偏移粘贴。
4. `orthogonal` 路由目前仍是简单折线，不做节点避障，见 `src/diagram.mjs` 的 `routeEdge()`。
5. 图编辑的键盘支持还不完整，当前主要覆盖 selection / movement / undo-redo。
6. SVG 的 diagram-specific ARIA 关系尚未建立。
7. 浏览器 / 移动端验收、文档收口和 acceptance 证据仍缺。

## Assumptions & Decisions

### 范围决策

* 本阶段只补齐 Iteration 5，不启动 Iteration 6 的项目分析视图开发。

* 继续复用当前共享编辑引擎，不新增第二套 diagram 专用历史栈；这与 `roadmap.md`、`iteration-4.md` 的约束一致。

* 仍然维持“受控结构化编辑”，不开放任意 `applyPatch()` 作为 Agent 主接口。

### 设计决策

* Group 本阶段只支持“平面 group 的展开/收起”，不引入 nested groups；这与 `docs/agent/diagram-scenario.md` 当前限制保持一致。

* 复制粘贴只覆盖“已选节点 + 这些节点之间的内部边 + 相关组归属”，不做跨图粘贴协议。

* 拖拽连线以 Port 为优先锚点；无 Port 时退回节点左右默认锚点。

* 避障优先补 `orthogonal`，`straight` 与 `curved` 保持现有语义，不在本阶段做复杂避障。

* 所有新增结构型操作都走 preview/confirm/commit，并受 `editing.allowStructuralChanges` 控制。

## Proposed Changes

### Wave 1：补齐图结构编辑命令层

目标：先把“能表达什么编辑”补完整，再让交互层去调用。

#### 1. `src/command.mjs`

* 扩展 diagram operation 白名单，新增：

  * `toggleGroupCollapse`

  * `addEdge`

  * `duplicateSelection`

  * `pasteSelection`

* 为新增操作补参数校验、目标校验和 capability 暴露。

* 将结构型操作显式标记为需要 `allowStructuralChanges === true`。

#### 2. `src/edit.mjs`

* 为新增 diagram 操作补 preview 逻辑、变更集、patch 产物和 `affectedRecords`。

* `duplicateSelection` 的执行规则固定为：

  * 复制当前选中节点；

  * 仅复制选中节点之间的内部边；

  * 新节点生成确定性后缀 ID；

  * 位置默认按 `grid * 2` 偏移；

  * 保留 `laneId`、`groupId`、`size`、`ports`、`label` 等可复制字段。

* `addEdge` 需校验：

  * source / target 节点存在；

  * Port 存在且属于对应节点；

  * 不允许 self-edge；

  * 重复边策略采用“默认拒绝完全同向同端口重复边”。

* `toggleGroupCollapse` 只修改 group view state，不直接改写成员节点业务字段。

#### 3. `src/edit-controller.mjs`

* 保持 preview / confirm / commit 协议不变。

* 对结构型 diagram edit 统一要求 exact preview 校验，避免拖拽/复制过程中的陈旧提交。

### Wave 2：补齐交互链路与键盘闭环

目标：把“命令存在”升级成“用户能自然地完成编辑”。

#### 4. `src/diagram-interaction.mjs`

* 增加 Port hover / hit / connect 手势状态机：

  * pointer down 于 port

  * pointer move 预览临时连线

  * pointer up 于目标 port / node

  * 调用 `previewEdit({ op: 'addEdge' })`

* 增加 group 头部点击展开 / 收起。

* 增加复制、粘贴、duplicate 的 selection-aware 行为。

* 增加键盘操作：

  * `Cmd/Ctrl+C` 复制当前选择

  * `Cmd/Ctrl+V` 粘贴偏移副本

  * `Cmd/Ctrl+D` duplicate

  * `Enter` / `Space` 对聚焦 group 执行展开或收起

#### 5. `src/index.mjs`

* 统一事件绑定入口，避免 diagram 与非-diagram 交互逻辑继续分叉。

* 增加 diagram 结构编辑相关事件：

  * `connectionpreview`

  * `connectioncancel`

  * `groupcollapsechange`

* 完善键盘-only 场景：

  * 焦点可在 node / group / port 间移动

  * 选中后可仅靠键盘完成移动、对齐、吸附、复制粘贴、展开收起

#### 6. `playground/diagram-editor.html`

* 增加 Port 连线、Group 折叠、复制粘贴、duplicate 的可视化控制。

* 增加当前 selection、clipboard、collapsed groups、normalized spec 输出。

* 将 Demo 明确拆成 3 个操作区：

  * Layout edits

  * Structure edits

  * Accessibility / state inspection

### Wave 3：补齐路由、渲染与可访问性

目标：让高级图编辑不是“能改”，而是“改完能看、能读、能解释”。

#### 7. `src/diagram.mjs`

* 为 `orthogonal` 路由加入轻量避障：

  * 先按源/目标方向生成候选折线；

  * 检测是否穿过节点包围盒；

  * 若冲突，尝试沿网格行/列绕行；

  * 输出仍保持 deterministic。

* 端口路由优先使用 port side / offset，未声明时回退默认锚点。

* 补 group collapse 对 layout / validation / route 的影响：

  * 被折叠 group 的成员不参与交互层 hit target；

  * 折叠时跨组边路由锚定到 group 轮廓，而不是隐藏成员节点。

#### 8. `src/project.mjs`

* 渲染 collapsed group 的摘要节点或容器态，而不是仅隐藏边框。

* 为 edge / group / port / node 输出更明确的 `dataRef` 和可访问性锚点。

* 在 label、arrow、port、group 边界重绘时复用统一几何来源，避免拖动后部分元素不同步。

#### 9. `src/index.mjs`

* 为 SVG 渲染补 diagram-specific ARIA：

  * 图根节点说明

  * group 与其成员的关系

  * edge 对 source/target 的关系描述

  * 选中、折叠、可编辑状态的可读文本

* Canvas 保持基础可访问性文案，不在本阶段追求与 SVG 一样细粒度的结构关系。

### Wave 4：测试、文档与验收收口

目标：把“实现了”升级成“可发布、可回归、可说明”。

#### 10. `tests/core.test.mjs`

* 新增以下测试分组：

  * group collapse / expand 的 preview、commit、undo/redo

  * `addEdge` 的端口校验、重复边校验、自环拒绝

  * `duplicateSelection` / `pasteSelection` 的 ID 稳定性与边复制规则

  * orthogonal routing 避障的 deterministic 输出

  * keyboard-only diagram 编辑回归

  * collapsed state 下 selection / hit testing / export 的正确性

#### 11. `docs/agent/diagram-scenario.md`

* 更新 Diagram 当前能力与限制。

* 明确新增命令、复制粘贴规则、group collapse 行为和 port-aware connect 流程。

#### 12. `docs/agent/development/iteration-5.md`

* 将“Current delivery”与“Remaining increments”更新为实际已交付状态。

* 补本阶段 acceptance 证据与未覆盖项。

#### 13. `docs/agent/development/roadmap.md`

* 在 Iteration 5 current status 中同步新的完成度描述。

* 若本阶段完成后仍有缺口，只保留浏览器矩阵 / 真机类 release gate，不保留实现项描述。

## Implementation Order

建议按以下顺序实施，避免后返工：

1. 命令层与 preview 层扩展：`src/command.mjs`、`src/edit.mjs`、`src/edit-controller.mjs`
2. Group / Port / Copy-Paste 交互：`src/diagram-interaction.mjs`、`src/index.mjs`
3. 路由与渲染同步：`src/diagram.mjs`、`src/project.mjs`
4. Demo 收口：`playground/diagram-editor.html`
5. 测试补齐：`tests/core.test.mjs`
6. 文档与路线图更新：`docs/agent/diagram-scenario.md`、`docs/agent/development/iteration-5.md`、`docs/agent/development/roadmap.md`

## Verification

### 本地校验

* `npm test`

* `npm run check`

* `git diff --check`

### 功能验收

* Demo 中可通过 Port 拖拽建立新边，并能进入 preview / commit / undo / redo。

* Group 可展开 / 收起，折叠后 selection、hit testing、edge 路由和 state 输出正确。

* 复制粘贴会复制内部边，生成稳定新 ID，并保持可撤销。

* 键盘-only 可完成选择、移动、对齐、吸附、复制粘贴、展开收起。

* `orthogonal` 路由在常见节点遮挡情况下能绕开节点包围盒，且输出稳定。

* SVG 中 group / edge / node 的语义关系可被读取，至少可通过 DOM 属性直接验证。

### 发布门槛

* 不改动 Iteration 4 的共享编辑协议和历史语义。

* 不引入第二套 diagram history / transaction 模型。

* Demo、测试、文档三者对外能力描述一致。

* 若浏览器矩阵或真机验证未做，本阶段结束时必须在文档中显式列为 deferred acceptance，而不是默认视为完成。

## Out of Scope

* Iteration 6 的项目分析视图与算法。

* Nested groups。

* 完整多人协同编辑。

* Canvas 与 SVG 的完全等价 ARIA 结构。

* 全量自动布局重写；本阶段只增强现有 deterministic layout 与 orthogonal routing。

