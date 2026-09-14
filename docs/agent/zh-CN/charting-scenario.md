# 场景：数据分析图表

用于通用指标分析和数据展示的 Agent 使用与开发指南。

## 图表选择

| 类型 | 适用场景 | 推荐 Renderer |
| --- | --- | --- |
| `line` | 趋势、时间变化 | `svg` |
| `area` | 趋势和累计量 | `svg` |
| `bar` | 分类对比、长标签 | `svg` |
| `column` | 紧凑分类对比 | `canvas` 或 `svg` |
| `pie` | 少量类别占比 | `svg` |
| `scatter` | 两个数值变量关系 | `canvas` |
| `funnel` | 转化阶段 | `svg` |
| `gauge` | 单指标完成度 | `canvas` |

## Agent 流程

1. 使用 `inspectData(data)` 检查字段和缺失值。
2. 根据意图选择图表，可使用 `recommend(data, { intent })`。
3. 生成 JSON-serializable Chart Spec。
4. 先调用 `validateSpec(spec)`，再调用 `createChart(spec)`。
5. 使用 `chart.describe()` 和 `chart.getState()` 检查结果。

## 最小 Spec

```js
{
  type: 'line',
  renderer: 'svg',
  data: { values: [{ month: 'Jan', sales: 120 }] },
  encoding: {
    x: { field: 'month', type: 'category' },
    y: { field: 'sales', type: 'quantitative' }
  }
}
```

## 开发位置与验收

- Spec：`src/spec.mjs`
- 数据：`src/data.mjs`
- Scene：`src/charts.mjs`
- Scale：`src/scale.mjs`
- Renderer：`src/renderer.mjs`
- 测试：`tests/core.test.mjs`
- 验收：`playground/project-gallery.html`

新增图表必须同步更新代码、测试、Gallery、`docs/manifests/capabilities.json` 和本文件。
