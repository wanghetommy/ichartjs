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

