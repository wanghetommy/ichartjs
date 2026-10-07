# 图表文本与标注

图表文本负责标题、坐标、图例和数值说明；标注解释具体数据；页面说明使用 [Freeform Board](canvas-scenario.md) 文本。内容是纯文本，不是 HTML / 富文本。SVG / Canvas 使用相同的拟合后 Scene 节点。

## 发现与选择

从 root 的 `getCapabilities().text`、`.annotations` 和 `getChartContract(type).annotations.supported` 获取契约。`/standard` 也提供 `text` / `annotations`，可独立使用，无需先导入 root。

| 需求 | 配置 |
| --- | --- |
| 标题 / 副标题 | `title.text` / `title.subtitle`；支持 `\n`，各最多两行，先适配字号，仍放不下时报告 `TITLE_TRUNCATED`。 |
| 轴标题 / 刻度格式 | `xAxis.title`、`yAxis.title` 与轴 `format`；按图表类型判断适用性。 |
| 数值标签 | `labels.enabled` / `format` / `font` / `color`；CSS 像素字体，如 `500 14px system-ui`。 |
| 标签位置 | 仅 Bar / Column 支持 `labels.position: 'inside' | 'outside'`，其他类型的显式位置配置会诊断。 |
| 图类文字 | `nodes[].label` / `edges[].label`；显式换行、有界换行 / 缩小 / 截断，线上连线文字保留背景。 |
| 独立说明 | Board `kind: 'text'`、盒子、字体、对齐、内边距、换行和最小字号。 |
| 目标 / 阈值 | `annotations[]` 的 `reference-line`。 |
| 特定记录说明 | `annotations[]` 的 `callout`，稳定 `recordId`；多系列可用 `field` 选度量。 |

普通数值标签，包括 Pie / Gauge，**不增加背景**。Bar / Column 内部标签使用对比色，空间不足时抑制；点标签按有效字体检测碰撞，放不下时报告 `LABELS_SUPPRESSED`。小扇区仍可能出现 `POLAR_LABEL_OVERFLOW`。

标签和 Board 字体范围为 8–160px。浏览器在提供字体时使用 Canvas 度量；无浏览器时估算，可能略有差别。网络字体应在创建 / 重绘前等待 `document.fonts.ready`。截断保留完整字素，不拆开组合 emoji / 附加符号。

## 示例与边界

可执行完整示例见[英文指南](../text-annotations.md)；配方 `@taylorwong/ichartjs/recipes/text-annotations` 是起始模板，通过宿主支持的 JSON 导入或文件读取方式加载，不是可执行任务。浏览器集成添加 `container: '#chart'`。

```js
const annotations = [
  { id: 'target', type: 'reference-line', axis: 'y', value: 40, text: '目标 40' },
  { id: 'peak', type: 'callout', recordId: 'feb', text: '二月峰值', offset: { x: 20, y: 28 } }
];
chart.update({ annotations });
```

- 仅 Line / Area / Bar / Column / Scatter，最多 100 条，ID 唯一且非空。
- 参考线需要有限数值和数值轴。Bar 用 x，其余通常用 y；x 需定量编码或 Scatter。不支持分类 / 时间参考线。
- Callout 引用字符串 `data.values[].id`，按转换后、当前可见数据找标记；`field` 选择系列，省略时选择首个匹配标记。排序不改变指向。
- `offset.x/y` 是相对标记的首选图表像素偏移。文本盒子适配绘图区，最多三行；Callout 有引导线和专用背景。尝试附近的垂直位置避开数值 / 标注标签，无解时报告 `ANNOTATION_LABEL_OVERLAP`，需检查密集图预览。
- 不扩展坐标轴。越界参考线省略并报告 `ANNOTATION_OUT_OF_VIEW`；记录不存在、被过滤或度量不可用报告 `ANNOTATION_TARGET_MISSING`；文字空间不足报告 `ANNOTATION_TEXT_TRUNCATED`。
- `ChartSpec.annotations` 可通过 `getSpec()` / JSON 保存重建，SVG / Canvas 导出一致；`/standard` PNG 需挂载 Canvas，root 按[导出契约](runtime-contract.md)执行。
- 不新增色带、富文本、独立标注编辑器或自然语言解析器。

## Agent 调整与验收

收到“添加 40 的目标线，解释二月峰值”时，先发现契约和稳定 ID，提出数组，校验完整 Spec，获宿主批准后 `chart.update({ annotations })`。数组整体替换，非用户要求不要删已有标注；空数组清除。

数据、尺寸、主题、视图变化后检查 `getState().layout.annotations`、warnings 和预览，导出 JSON 并重建验证。标注是普通 Spec 调整，不是业务编辑命令；批准、存储和所需历史由宿主负责，参见[对话工作流](conversational-workflow.md)。

`annotationPlugin()` 仍是临时像素线插件，仅接受 `type: 'line'` 和有限的 `geometry.x1/y1/x2/y2`，其他输入报告 `INVALID_PLUGIN_ANNOTATION`；安装的插件不会序列化为 Spec 标注，Agent 交付优先使用声明式配置。

## Board 文本

`wrap: false` 只关闭自动换行，显式换行保留；拟合仍检查宽、高、`maxLines` 和 `minFontSize`。`style.font` 优先，否则用 `fontSize` / `fontWeight` / `fontFamily`，绘制使用拟合后字号。

宿主 CSS 应保留 Board 宽高比。SVG / Canvas 按容器宽度缩放时用 `width: 100%; height: auto`，不要独立拉伸宽高，否则布局正确的文字也会变形。

检查 `board.getState().layout.text` 与 `board.explain().warnings`：`TEXT_TRUNCATED` 表示截断；`TEXT_OVERFLOW` 表示最小字号仍超出高度。增加盒子或降低内边距 / 最小字号。

预览：`http://localhost:3000/playground/accessibility-lab.html` → **Text & Annotation**。切换 SVG / Canvas、主题与宽度，更新 April 数据、JSON 重建，确认标注跟随记录。
