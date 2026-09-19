# iChart.js 2.0 Agent 指南（中文）

这是 iChart.js 2.0 面向用户 Agent 的中文使用入口。默认先读取本文件，再按任务读取一份场景文档。

## 选择场景

- [使用场景与输出](usage-scenarios.md)
- [Agent 快速上手](quickstart.md)
- [编码 Agent 集成](coding-agent-integration.md)
- [前端项目集成](frontend-integration.md)
- [视觉样式与主题](theme-guide.md)
- [数据分析图表](charting-scenario.md)
- [项目管理图表](project-scenario.md)
- [交互式 Diagram](diagram-scenario.md)：Flow、Swimlane、Architecture、Mindmap 与编辑。
- [Runtime 契约](runtime-contract.md)
- [编辑契约](editing-contract.md)
- 机器可读能力清单位于 `docs/manifests/`，供 Agent 按需读取。

## 标准流程

```text
getCapabilities → inspectData → planChart → 生成 Spec → validateSpec → createChart → explain/getState
```

API 名称、字段名、命令名、错误码和 JSON Manifest 统一使用英文标识符；其语义以英文技术契约为标准，本文提供中文辅助说明。

全部已支持图表的浏览入口：`playground/project-gallery.html`；主题样式验收入口：`playground/theme-gallery.html`。
