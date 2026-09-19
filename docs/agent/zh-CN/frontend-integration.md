# 前端项目集成

iChart.js 应作为普通 JavaScript UI 组件运行在浏览器应用中。数据加载、登录、持久化、路由以及自然语言交互都由宿主应用负责。

```bash
npm install @taylorwong/ichartjs@^2
```

无法访问 npm Registry 的环境请用 GitHub 源作为后备：`npm install github:wanghetommy/ichartjs#v2.0.7`。

```js
import { createChart } from '@taylorwong/ichartjs';

const chart = createChart({
  container: '#chart',
  type: 'bar',
  data: { values: rows },
  encoding: {
    x: { field: 'category' },
    y: { field: 'value' }
  }
});
```

容器创建后再实例化图表；数据变化使用 `setData()`；配置变化使用 `update()`；组件卸载前调用 `destroy()`。

如果宿主页面提供“展示销售趋势”之类的 Agent 功能，仍然在 JavaScript 中调用 `inspectData()`、`planChart()`、`validateSpec()` 和 `createChart()`，并在 UI 中展示原因、假设和警告。

不能执行或生成 JavaScript 的日常助手无法直接使用任何 JS UI 组件，其宿主应用应负责集成。iChart.js 核心不提供 CLI、MCP、HTTP 服务、Python Runtime、上传、认证、存储或分享系统。

本仓库可运行 `npm run playground`，然后访问 `http://localhost:3000/playground/project-gallery.html` 验收全部图表。
