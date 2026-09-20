# Chart Selection

| Intent | Preferred type | Important guardrail |
| --- | --- | --- |
| Trend or time series | Line | Require an ordered or temporal dimension. |
| Cumulative trend | Area | Use stacking only for meaningful additive measures. |
| Category comparison or ranking | Bar | Prefer for long labels and negative values. |
| Compact comparison or histogram | Column | Use the bin transform for histogram workflows. |
| Part-to-whole | Pie with optional `innerRadius` | Keep category count low and require a positive total. |
| Relationship | Scatter | Require two quantitative measures. |
| Conversion stages | Funnel | Preserve stage order. |
| Single bounded KPI | Gauge | Declare the domain. |
| Matrix | Heatmap | Distinguish missing cells from zero. |
| Multidimensional profile | Radar | Require at least three explicit indicator domains. |
| Schedule and dependency analysis | Gantt | Require stable IDs, dates, and explicit calendar assumptions. |
| Events | Timeline | Require valid dates and labels. |
| Delivery checkpoints | Milestone | Keep baseline and actual dates distinct. |
| Remaining work | Burndown | Surface scope changes and forecast assumptions. |
| Process | Flow | Preserve node and edge IDs; validate endpoints and ports. |
| Responsibility | Swimlane | Require valid lane membership. |

Always prefer `planChart()` over this table when runtime capability output is available. Treat alternatives as tradeoffs, not automatic fallbacks.

`planChart()` accepts the exact registered intent token, not the user's full sentence. For example, map “show the sales trend over time” to `trend`; if an unknown token is passed, inspect and surface the returned `UNKNOWN_INTENT` warning instead of accepting the fallback silently.
