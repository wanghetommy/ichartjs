# 前端项目集成

iChart.js 应作为普通 JavaScript UI 组件运行在浏览器应用中。数据加载、登录、持久化、路由以及自然语言交互都由宿主应用负责。

```bash
npm install @taylorwong/ichartjs@^2
```

需要可复现构建时，请显式固定版本：`npm install @taylorwong/ichartjs@2.0.33`。

无法访问 npm Registry 的环境请用 GitHub 源作为后备：`npm install github:wanghetommy/ichartjs#v2.0.33`。

<!-- docs-check: frontend-chart -->
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

容器创建后再实例化图表；根入口仅数据变化时使用 `setData()`，图表 Profile 使用 `update({ data: rows })`；配置变化使用 `update()`；组件卸载前调用 `destroy()`。

## 入口与尺寸归属

已知图表族时，独立使用 `/standard`、`/project`、`/diagram` 或 `/board`，不需要先引入 root。根入口提供完整发现、交互、编辑和设置；图表 Profile 侧重渲染，不提供根入口的 DOM 交互或设置菜单 Runtime。

- 根入口在可用时通过 `ResizeObserver` 观察容器**宽度**，保留显式高度。Profile 和 Board 需要宿主观察尺寸或显式更新。
- 容器必须先存在。`container` 接受选择器或 Element；明确请求但找不到的选择器会抛错，不再静默生成未挂载图表。不传容器才表示有意生成未挂载 SVG。
- 宿主应有可测量宽度和显式图表高度，flex/grid 子项使用 `min-width: 0`。隐藏容器可能测得零宽度，应保留原尺寸，在重新显示时调整；不要因此改变数据或视口。
- Flow 保留节点尺寸，并对布局溢出给出诊断。窄屏宿主可保留内容最小宽度，使用 `overflow-x: auto`；这是宿主滚动，不是图表隐式缩放/平移。消费示例的三节点流程使用 560 px。
- Element 是宿主绑定，会在 JSON 克隆之前从规范化/导出 Spec 中排除。校验后创建或 JSON 重建时重新传入目标容器，不把 DOM 引用持久化到 Spec。
- `destroy()` 移除 Runtime 创建的表面、解绑根入口事件/观察器，保留调用方传入的 SVG/Canvas 元素。Board 更换挂载容器时也会移除旧的 Runtime 自建表面。宿主自己的观察器、请求和订阅仍需单独释放。
- 根入口构造时的 `plugins` 使用宿主原始回调。JSON 不保存函数，重建时需重新安装；Profile 不提供完整插件 Runtime。

## 异步数据与卸载

以下示例使用已有的 `#chart` 元素，由宿主管理 320 px 高度，不依赖网络。用 `refreshRows(() => fetchRows())` 接入应用的数据加载器；加载异常与取消由宿主处理。序号阻止旧响应覆盖新数据或更新已销毁实例。

<!-- docs-check: host-lifecycle -->
```js
import { createChart } from '@taylorwong/ichartjs/standard';

const container = document.querySelector('#chart');
if (!container) throw new Error('Create #chart before mounting.');
let disposed = false, requestVersion = 0;
const chart = createChart({
  container, type: 'line', renderer: 'svg', width: container.clientWidth || 640,
  height: 320, data: [], encoding: { x: { field: 'month' }, y: { field: 'revenue' } }
});
const observer = new ResizeObserver(entries => {
  const width = Math.round(entries[0]?.contentRect.width || 0);
  if (!disposed && width > 0 && width !== chart.getSpec().width) chart.resize(width, 320);
});
observer.observe(container);

async function refreshRows(loadRows) {
  const token = ++requestVersion;
  const rows = await loadRows();
  if (!disposed && token === requestVersion) chart.update({ data: rows });
}

function dispose() {
  disposed = true;
  requestVersion += 1;
  observer.disconnect();
  chart.destroy();
}
```

Board 使用 `board.update({ width, height })`，而不是图表的 `resize()` / `setData()`。普通数据/配置更新由可信宿主执行；Agent 结构编辑仍遵守已有预览与确认流程。

## 输出与响应速度

所有入口支持 SVG/JSON，浏览器 PNG/JPEG 不再受显示 renderer 或挂载限制。使用 `chart.export({type:'png', as:'blob'})`，检查结果后再保存，无需切换显示。含图片时先 `await board.ready()`；详见[格式矩阵与诊断](runtime-contract.md#导出与下载)。

同步 API 耗时和浏览器呈现机会应分开测量。Performance Lab 在更新后等待两次动画帧，但这不是精确 GPU 绘制延迟、FPS 或真机认证。DOM 零残留也不等于 JavaScript 内存完全无泄漏。

已有[浏览器消费示例](../../../examples/consumer-browser.html)支持 `?entry=root|standard|project|diagram|board&renderer=svg|canvas`。按 Load data、Race old/new、Resize parent、Hide/show、Unmount/remount、Export 验收；Profile Loading 提供入口。`npm run consumer:browser` 将示例的仓库 import map 替换为实际安装包的生产 bundle，需要 Chrome 和固定 bundler 的临时下载权限。

如果宿主页面提供“展示销售趋势”之类的 Agent 功能，仍然在 JavaScript 中调用 `inspectData()`、`planChart()`、`validateSpec()` 和 `createChart()`，并在 UI 中展示原因、假设和警告。

不能执行或生成 JavaScript 的日常助手无法直接使用任何 JS UI 组件，其宿主应用应负责集成。iChart.js 核心不提供 CLI、MCP、HTTP 服务、Python Runtime、上传、认证、存储或分享系统。

本仓库可运行 `npm run playground`，然后访问 `http://localhost:3000/playground/project-gallery.html` 验收全部图表。
