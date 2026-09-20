# iChart.js 使用场景

iChart.js 可以分成三层：

1. **Runtime**：`@taylorwong/ichartjs`，负责规划、校验、渲染、交互、编辑和导出。
2. **Skill**：`skills/ichartjs/SKILL.md`，负责指导 Agent 选择图表、保留数据 lineage、校验 Spec 和交付结果。
3. **宿主项目**：用户自己的 Web 项目、Node 脚本、CI 任务或 Agent 工作区，负责数据、生命周期、路由、存储和交付。

Skill 不是第二套渲染器，也不是服务端。使用 Skill 的 Agent 仍然需要 JavaScript 宿主，才能生成交互页面或文件。

## 场景选择

| 需求 | 使用方式 | 运行位置 | 常见输出 |
| --- | --- | --- | --- |
| 在产品中增加图表 | 前端项目集成 | 用户自己的浏览器应用 | 交互式 SVG 或 Canvas 图表 |
| 让 Codex 修改已有项目 | Coding Agent + Runtime | 代码仓库和项目开发服务器 | 代码、Spec、测试结果、预览地址 |
| 让多个 Agent 复用图表能力 | Skill + Runtime | Agent 工作区和目标项目 | 校验后的代码、文件、解释结果 |
| 一次性生成可视化 | Node 脚本或独立 HTML | Node.js 或浏览器 | SVG、PNG/JPEG、JSON、HTML |
| 项目进度和交付分析 | 项目场景 + Runtime | 项目看板 | Gantt、Burndown、Timeline、分析结果 |
| 流程或架构图 | Diagram 场景 + Runtime | Web 应用或文档流程 | Flow/Swimlane 页面、SVG、JSON |
| 定时生成报告 | Node 脚本 + Runtime | CI 或报表任务 | SVG/PNG 文件和 JSON 快照 |

## 输出契约

| 输出 | 适用场景 | API 或交付方式 |
| --- | --- | --- |
| 交互式页面 | 产品看板、编辑器、分析页面 | `createChart()` 挂载到 DOM |
| SVG DOM | 无障碍、键盘交互、Diagram、打印 | `renderer: 'svg'` |
| SVG 文件/字符串 | 文档、邮件、矢量交付、无头环境 | `chart.export({ type: 'svg' })` |
| PNG/JPEG | 汇报、聊天附件、图片报告 | 浏览器 `toDataURL()`，或 Node `exportAsync()` + 可选 `canvas` |
| JSON Spec/state | 持久化、Agent 快照、跨环境重建 | `chart.export({ type: 'json' })` |
| Data URL/Blob | 页面嵌入或浏览器下载 | `as: 'dataurl'` 或浏览器下载 API |
| 代码片段 | 开发者集成或生成页面 | `createChart()` 集成代码 |
| 解释和状态 | Agent 自检和用户审计 | `chart.explain()`、`chart.getState()` |

JSON 是机器可读的事实来源；SVG 和 PNG/JPEG 是视觉交付物；代码是集成交付物；交互页面是产品交付物。

## 视觉偏好：界面与 Agent

图表创建后需要调整视觉样式时，可让页面图表共享 `createPreferencesStore()`。浏览器中只有在宿主希望刷新后保留配置时，才显式使用 `storage: 'localStorage'`。`mountChartSettings(chart)` 会在导出区域之外增加可访问的快捷设置按钮；完整的页面级设置中心应作为宿主的独立路由。

宿主交互和 Agent 对话使用同一个 patch 合约：

```js
chart.setPreferences({
  theme: { preset: 'dashboard', palette: 'status' },
  typography: { scale: 1.15 },
  components: { grid: false }
}, { source: 'agent' });
```

快捷菜单只保留主题、配色、字号和当前图表支持的显示开关。使用 `scope: 'global'` 修改页面全部图表；默认只修改当前图表；使用 `chart.getState().preferences` 获取可审计的最终配置。两层体验可在 `http://localhost:3000/playground/project-gallery.html` 和 `http://localhost:3000/playground/preferences-lab.html` 验收。

## 场景一：集成到 Web 项目

在宿主项目中安装 Runtime：

```bash
npm install @taylorwong/ichartjs@^2
```

```js
import { createChart } from '@taylorwong/ichartjs';

const chart = createChart({
  container: '#chart',
  type: 'line',
  renderer: 'svg',
  data: { values: rows },
  encoding: {
    x: { field: 'month', type: 'category' },
    y: { field: 'sales', type: 'quantitative' }
  },
  accessibility: { enabled: true }
});
```

宿主项目负责数据加载、认证、路由、持久化和状态管理。数据变化使用 `setData()`，Spec 变化使用 `update()`，替换组件前调用 `destroy()`。

适用于管理后台、数据看板、项目管理、流程编辑和嵌入式分析页面。

## 场景二：让 Coding Agent 修改项目

可以这样向 Codex 提需求：

```text
在当前项目中使用 @taylorwong/ichartjs。检查订单数据，选择并校验月度销售图表，
把它加入现有分析页面，运行相关测试，并返回准确的预览地址。保留假设、警告、
record lineage 和不支持请求。
```

Agent 应返回：

- 修改文件和已校验的 Spec；
- 字段映射和选图原因；
- 假设、警告和不支持请求；
- 测试结果和运行时自检；
- 宿主项目的准确预览地址和人工验收步骤。

仓库内的 Playground 只用于 iChart.js 示例：`npm run playground` → `http://localhost:3000/playground/project-gallery.html`。如果修改的是其他项目，应返回其他项目自己的开发地址。

## 场景三：作为官方 Skill 使用

使用标准 Agent Skills CLI 安装最新版：

```bash
npx skills add wanghetommy/ichartjs --skill ichartjs
```

无交互地全局安装到 Codex：

```bash
npx skills add wanghetommy/ichartjs --skill ichartjs --agent codex --global --yes
```

需要固定发布版本时，直接安装已发布的 Skill 目录：

```bash
npx skills add https://github.com/wanghetommy/ichartjs/tree/v2.0.8/skills/ichartjs \
  --agent codex --global --yes
```

WorkBuddy 用户可以通过宿主的 Skill 界面导入同一个带 Tag 的 GitHub 目录。在当前 Skills CLI 没有明确声明适配器时，不要假设存在 `--agent workbuddy`。具有自定义 Skill 目录的宿主仍可从 `node_modules/@taylorwong/ichartjs/skills/ichartjs` 手动复制。

安装或选择 `ichartjs` 后可以这样提问：

```text
使用 iChart.js Skill。读取这份数据，生成项目 Burndown，校验 Spec，
生成浏览器预览，并额外导出 SVG 和 JSON。返回预览地址、文件路径、
警告、假设和 lineage。
```

Skill 会把任务路由到公开 Runtime API 和场景文档。它不会替代 npm 包、增加服务端点，也不会维护第二套选图逻辑。

如果宿主可以编辑并运行 JavaScript 项目，输出可以是交互页面；如果不能运行 JavaScript，应要求输出 SVG、JSON 或代码文件。

## 场景四：一次性生成文件

Agent 可以创建一个 ESM 脚本或独立 HTML 页面，输出：

- `chart.svg`：矢量文档和零额外依赖的无头输出；
- `chart.json`：可复现的 Spec 和运行时快照；
- `chart.png` 或 `chart.jpeg`：汇报和图片分享；
- `index.html` 加 JavaScript：需要交互时使用。

无头 SVG 和 JSON 不需要额外生产依赖；无头 PNG/JPEG 使用 `chart.exportAsync()`，并安装可选 `canvas`。一次性制图不应额外引入 Python、MCP、HTTP 服务或 CLI。

## 场景五：项目和 Diagram

- `gantt`、`timeline`、`milestone`、`burndown`：项目进度和交付计划；
- 项目分析：capacity、velocity、release forecast、risk、issue aging；
- `flow`、`swimlane`：流程、责任、分组、Port 和受控编辑。
- `architecture`：业务、数据或技术架构，使用明确的层、边界和关系。
- `mindmap`：想法层级，以 `parentId` 为事实来源，支持树形或放射布局。

保留稳定的 record、node、edge、lane、group、port ID。业务编辑先返回 preview，确认后再 commit，并返回审计结果。

## 场景六：CI 和定时报表

在 Node ESM 脚本中生成：

```js
const svg = chart.export({ type: 'svg' });
const json = chart.export({ type: 'json' });
const png = await chart.exportAsync({ type: 'png' });
```

建议把 JSON 作为可复现快照，把 SVG/PNG 作为视觉交付物。导出失败时返回结构化错误，不要静默替换格式。

## 边界

- iChart.js 是 JavaScript UI/Runtime，不是数据服务。
- Skill 只提供 Agent 工作流指导；没有 JavaScript 宿主时不能直接渲染。
- 宿主项目负责认证、存储、分享和应用路由。
- 普通使用不需要核心 CLI、MCP、HTTP 服务或 Python API。
- 如果数据在 Python 中准备，输出 JSON/CSV，再由 JavaScript 进程渲染。
- 除非 `getCapabilities()` 明确声明，否则不要生成地图或 3D 图表。

## Agent 交付清单

每次 Agent 返回结果都应包含：

1. 选择的图表/视图及原因；
2. 输入字段、转换和稳定 ID；
3. 已校验 Spec 或结构化修复请求；
4. 假设、警告、不支持请求和无障碍选择；
5. `explain/state` 自检结果；
6. 准确预览地址、代码文件或产物路径；
7. 导出格式和可选依赖。

相关文档：[快速上手](quickstart.md)、[前端集成](frontend-integration.md)、[Coding Agent 集成](coding-agent-integration.md)、[Runtime 契约](runtime-contract.md)、[项目场景](project-scenario.md)、[Diagram 场景](diagram-scenario.md)。
