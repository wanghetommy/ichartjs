# Runtime 体积与加载

当前公开且完整的 Runtime 入口是：

```js
import { createChart } from '@taylorwong/ichartjs';
```

根入口包含 Agent 规划、校验、全部图表、项目和 Diagram、Freeform Board、SVG/Canvas、编辑、偏好、导出和能力发现。

虽然 npm 包是 ESM 并声明了 `sideEffects: false`，根入口仍然是完整 Runtime；同时提供按能力拆分的公开入口。不要直接引用未公开的 `src/` 深层路径来做移动端优化。

运行以下命令查看体积基线：

```bash
npm run footprint:check
```

它会检查根 ESM 模块图、gzip 体积、npm tarball 和解包后体积；`npm run profiles:check` 会验证四个 Profile 的模块边界和实际 SVG 输出。

移动端当前建议：

- 使用生产 bundler，不要直接从页面加载 `src/index.mjs`。
- 小型且重视无障碍的图表使用 SVG；大型数据使用 `renderer: 'auto'`，并以实际测量为准。
- Recipe、Skill、文档和能力清单只在 Agent/工具链需要时加载。
- 不要在宿主项目中复制一份图表渲染代码来规避体积。

## 能力入口

完整入口保持兼容，同时提供按能力拆分的公共入口：

```js
import { createChart } from '@taylorwong/ichartjs/standard';
import { createChart } from '@taylorwong/ichartjs/project';
import { createChart } from '@taylorwong/ichartjs/diagram';
import { createBoard } from '@taylorwong/ichartjs/board';
```

`standard` 用于基础与分析图表，`project` 用于项目管理图表，`diagram` 用于流程和架构图，`board` 用于 Freeform Board。不要引用未公开的 `src/*` 深层路径。
