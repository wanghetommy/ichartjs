# 视觉样式与主题指南

iChart.js 2.0 内置轻量、与 Renderer 无关的样式系统。Agent 应表达场景和数据语义，由 Runtime 解析颜色、字号、间距和标记样式，不应为每张图随意生成一套视觉配置。

## 三层样式模型

- `mode`：`auto`、`light`、`dark`、`contrast`。
- `preset`：`auto`、`analysis`、`dashboard`、`report`、`presentation`、`project`、`diagram`。
- `palette`：`auto`、`categorical`、`sequential`、`diverging`、`status`。

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
