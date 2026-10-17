# 视觉样式与主题指南

默认数据线、连接线按绘图区及非连接点节点的平均高度适配，范围为预设线宽的 0.8–1.35 倍；仅扩大空白画布不会持续加粗 Diagram 连线。边框保持次级，箭头和虚线间距随连接线宽协调，命中容差、网格线宽独立。显式 `theme: { tokens: { marks: { lineWidth: 2 } } }` 固定主线宽，不随 resize 改变。解析主题的 `automaticLineWidth` 是自动基准（显式线宽时为 null），不是偏好设置。SVG、Canvas、导出共用场景；DPR 不改变逻辑线宽，视图缩放不重复执行线宽适配。

iChart.js 2.0 内置轻量、与 Renderer 无关的样式系统。Agent 应表达场景和数据语义，由 Runtime 解析颜色、字号、间距和标记样式，不应为每张图随意生成一套视觉配置。

## 三层样式模型

- `mode`：`auto`、`light`、`dark`、`contrast`。
- `preset`：`auto`、`analysis`、`dashboard`、`report`、`presentation`、`project`、`diagram`。
- `palette`：`auto`、`categorical`、`sequential`、`diverging`、`status`、`soft`。

`soft` 是可选配色，不会改变节点或连线几何。`diagram.appearance: 'soft'` 独立控制浅色节点、圆角和开放箭头；两者可以分别使用。明暗模式使用对应颜色，`contrast` 保留高对比度颜色。详见[流程图指南](diagram-scenario.md)。

推荐默认使用 `auto`。系统根据图表家族、用户意图、数据语义和宿主明暗模式进行确定性匹配。解析结果可通过 `planStyle()`、`planChart().styleRecommendation`、`chart.getTheme()`、`chart.getState().style` 和 `chart.explain().style` 查看。

## Agent 使用方式

```js
const plan = planChart(rows, { intent: 'comparison', context: 'dashboard' });
const spec = {
  type: plan.primary,
  data: { values: rows },
  theme: {
    mode: 'auto',
    preset: plan.styleRecommendation.preset,
    palette: plan.styleRecommendation.palette
  }
};
```

仅在用户明确要求明暗模式、展示场景或语义配色时提供显式值；用户选择始终高于自动匹配。

## 实时切换

```js
chart.setTheme({ mode: 'dark', preset: 'dashboard', palette: 'categorical' });
const resolved = chart.getTheme();
```

切换不会重建图表。`mode: 'auto'` 会跟随宿主的 `prefers-color-scheme`。Spec 中显式提供的 `colors`、`background` 和 `padding` 在切换时保持不变。

## 配色原则

- `categorical`：不同系列或分组，同时比较建议不超过 6 色。
- `sequential`：有序数值强度，例如 Heatmap。
- `diverging`：存在有意义的中点，且数据向两侧变化。
- `status`：成功、警告、危险、信息等业务状态。
- 不只依赖颜色传达含义，应保留标签、形状、线型或文字状态。

自定义 token 后调用 `validateThemeContrast()`；Agent 不应隐藏对比度警告。

### 默认视觉质量

普通 Spec 不应依赖逐图表调样式才能使用。继续使用现有字体角色（通常标签/坐标轴 12px、标题 16px；演示预设更大）。Diagram 未指定的节点尺寸按文字、形状和图标测量，宽度有界、最多两行适配；显式尺寸与位置保持不变。默认 `diagram` 预设外边距为 16px，标题、副标题及泳道/层名称另按实际内容占位，不再预留日期坐标轴空间。字号、主题和尺寸变化重建共享场景，不改变视图。

自动前景色根据实际填充和背景选择，支持常见 Hex/RGB/RGBA 的透明度及数据图元 opacity 合成。显式 `labels.color` 保留，实测对比度低于 4.5:1 时报告 `INSUFFICIENT_TEXT_CONTRAST`。完全透明区域无法确定宿主底色，需要保证对比度时应明确匹配的背景和主题；这不是完整 CSS 颜色解析器，也不代表视觉质量认证。

Diagram 连线文字优先于穿过它的线，包括已偏移的标签。仅显示层的断线，以及不透明局部背景上的无边框实色底板保护最终文字范围；透明导出只保留断线，不涂白。逻辑路线、箭头、人工折点和命中几何不变。普通图表标签仍没有背景底板；Line/Area 标签优先避开所有系列线及数据点，有限候选均放不下时给出隐藏诊断。Gauge 数字根据实际已填充/未填充扇区选色，颜色分界穿过文字时在扇区内调整位置。

物理空间不足仍须诊断并按交付尺寸验收，不强制缩成小字、不设统一占用比例、不擅自缩小人工图形。自动布局的溢出/重叠，Flow 使用 `FLOW_LAYOUT_OVERFLOW` / `FLOW_NODE_OVERLAP`，其他 Diagram 使用 `DIAGRAM_LAYOUT_OVERFLOW` / `DIAGRAM_NODE_OVERLAP`。有限候选均无法满足节点、标签及边框约束而采用尽力显示的连线标签回退时，报告 `LABEL_LAYOUT_CONSTRAINED`。

默认数据线/连接线按绘图区及非 Connector 节点平均高度，在预设线宽的 0.8–1.35 倍内有界调整。单纯放大空白画布不会无限加粗；边框从属于主线，箭头与虚线间距随线宽协调，命中容差和网格线独立。显式 `theme.tokens.marks.lineWidth` 固定主线宽。SVG/Canvas/导出共用场景，不重复乘 DPR 或视图缩放。

预览与验收：`http://localhost:3000/playground/theme-gallery.html`。

## 单图表与页面级偏好

偏好用于图表创建后的视觉调整，适合用户操作和 Agent 对话调整。业务数据、编码和图表类型不应放进这个配置面。

```js
import { createChart, createPreferencesStore, mountChartSettings } from '@taylorwong/ichartjs';

const pagePreferences = createPreferencesStore({
  storage: 'localStorage',
  storageKey: 'my-app:chart-preferences'
});
const chart = createChart({
  chartId: 'revenue',
  container: '#revenue',
  type: 'line',
  data: { values: rows },
  preferences: pagePreferences
});
const settings = mountChartSettings(chart, {
  locale: 'zh-CN',
  placement: 'auto',
  preferredPlacements: ['right', 'top', 'bottom']
});

// Agent 对话也使用同一套 API。
chart.setPreferences({
  theme: { preset: 'dashboard', palette: 'status' },
  typography: { scale: 1.15 },
  components: { grid: false }
}, { source: 'agent' });

// 宿主永久移除图表时同步销毁快捷设置浮层。
settings.destroy();
```

快捷设置面板会通过 Portal 放到图表裁剪区域之外。自动定位优先使用按钮右侧，其次上侧、下侧；都无法完整容纳时限制在浏览器视口内。滚动时保持已经选定的方位并跟随按钮，不再被视口约束拉回；图表或菜单按钮离开视口时直接关闭。窗口缩放和内容变化时可以重新计算方位。

### Agent 配置发现与验证

Agent 不应硬编码菜单选项，应先调用 `getPreferenceCapabilities(chartType, { locale })`。该接口会返回每个偏好字段的类型、默认值、候选值、作用域、当前图表适用性和 `menu.visible` 状态；对话调整和宿主自定义设置页应使用同一份契约。

```js
import { getPreferenceCapabilities, validatePreferences } from '@taylorwong/ichartjs';

const capabilities = getPreferenceCapabilities(chart.getSpec().type, { locale: 'zh-CN' });
const menuFields = capabilities.fields.filter(field => field.menu.visible);
const current = chart.getPreferences();
const patch = {
  theme: { preset: 'dashboard', palette: 'status' },
  typography: { scale: 1.15 },
  components: { grid: false }
};
const checked = validatePreferences(patch, { partial: true });
if (!checked.valid) throw new Error(JSON.stringify(checked.errors));
chart.setPreferences(checked.value, { scope: 'chart', source: 'agent' });
const applied = chart.getState().preferences;
```

快捷菜单字段为 `theme.mode`、`theme.palette`、`typography.scale`，以及当前图表支持的 `components.legend`、`components.labels`、`components.grid`。完整白名单另外包含 `theme.preset`、`density`、`branding.enabled` 和 `motion`。无法识别语言时默认返回英文。

单图表快捷菜单使用紧凑的汉堡图标，只保留高频操作：主题模式、配色、字号，以及当前图表真正支持的图例、数据标签和网格线。能力检测会自动隐藏无效设置；修改即时生效，并支持 `zh-CN`、`en` 和按文档语言自动识别。

低频选项和页面级配置应放在图表弹出菜单之外的独立设置页。页面内图表共享同一个 store，并使用 `store.setGlobal()` 或 `chart.setPreferences(patch, { scope: 'global' })` 更新全局。完整设置页可提供 preset、密度、署名等白名单能力，而不挤占每张图表。Node/SSR 默认使用内存，浏览器需要显式选择 `localStorage` 或宿主存储适配器。快捷菜单验收地址：`http://localhost:3000/playground/project-gallery.html`；完整页面设置验收地址：`http://localhost:3000/playground/preferences-lab.html`。
