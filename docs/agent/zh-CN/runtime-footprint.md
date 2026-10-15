# Runtime 体积与加载

当前公开且完整的 Runtime 入口是：

```js
import { createChart } from '@taylorwong/ichartjs';
```

根入口包含 Agent 规划、校验、全部图表、项目和 Diagram、Freeform Board、SVG/Canvas、编辑、偏好、导出和能力发现。

Iteration 26 增量 Flow 的预览、提交及历史使用根入口，轻量 `/diagram` Profile 仅侧重渲染和 Spec 更新。新增命令、布局算法、发现元数据进入 Runtime；Recipe、Skill、文档仍是 Agent 资源，不会自动进入浏览器。新增 Iteration 25–26 指南和配方后更新包资源基线，浏览器模块 raw/gzip 基线及 15% 增长门槛不变，实际体积见 `playground/footprint.json`。

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

## 实际生产 bundle 测量

`npm run bundle:measure -- --output=playground/bundle-footprint.json` 从实际安装的本地 npm tarball 构建各公开工厂入口，固定 esbuild `0.28.2`、ESM/browser/ES2022、minify、level-9 gzip。使用 `npm run bundle:measure -- --published=2.0.30 --output=/tmp/ichart-baseline.json` 可按相同配置测量 Registry 发布包。工具在临时目录安装 bundler，需要网络；不增加包的运行时/开发依赖，也不新增必须联网的 CI 门禁。

测量只导出 `createChart`（Board 为 `createBoard`）；实际应用引入更多 API、多个 Profile 或资源时结果会变化。可选 Node `canvas` 适配器保持 external。报告列出实际纳入模块，检查 Profile 不引入 root 或 Agent 资源。源码图估算、生产 bundle gzip、npm 包大小是三种不同指标，都不能直接证明服务器实际传输字节。

Profile Loading 将生产构建报告与源码估算分开展示。`npm run consumer:browser` 使用安装包的压缩 bundle 运行现有宿主浏览器示例，需要 Chrome 和固定 bundler 的临时下载权限，不依赖不断变化的 npm 最新版本。

## 能力入口

完整入口保持兼容，同时提供按能力拆分的公共入口：

```js
import { createChart } from '@taylorwong/ichartjs/standard';
import { createChart } from '@taylorwong/ichartjs/project';
import { createChart } from '@taylorwong/ichartjs/diagram';
import { createBoard } from '@taylorwong/ichartjs/board';
```

`standard` 用于基础与分析图表，`project` 用于项目管理图表，`diagram` 用于流程和架构图，`board` 用于 Freeform Board。不要引用未公开的 `src/*` 深层路径。

图表 Profile 提供侧重渲染的 `update()`、`resize()`、`setTheme()`、状态和导出 API，不包含 root 的编辑/历史或设置菜单 Runtime。显式 Renderer 更新及 auto 阈值变化使用当前 Spec 和场景；被拒绝的更新不影响后续主题变化。通过 `getState().rendererSelection` 自检，在 `http://localhost:3000/playground/profile-loading.html` 验收连续操作，Performance Lab 查看更新、resize 和主题耗时。测量的是同步 API 耗时，不是完整帧绘制延迟，也不保证所有移动设备表现。
