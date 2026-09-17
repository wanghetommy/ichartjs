import { createReadStream } from 'node:fs';
import { access, stat, unlink } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';

const root = normalize(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const types = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf']
]);

function isMacOS() {
  return process.platform === 'darwin';
}

function findListeningPid(targetPort) {
  if (!isMacOS()) return null;
  try {
    const args = ['-n', '-P', `-iTCP:${targetPort}`, '-sTCP:LISTEN', '-t'];
    const result = spawnSync('lsof', args, { encoding: 'utf8' });
    if (result.status !== 0) return null;
    const lines = (result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (!parts[1]) continue;
      const pid = Number(parts[1]);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      return pid;
    }
    return null;
  } catch {
    return null;
  }
}

function processCommand(pid) {
  try {
    const result = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
    return (result.stdout || '').trim();
  } catch {
    return '';
  }
}

function isLikelySimpleHttpServer(command) {
  if (!command) return false;
  return /(python|python3).*http\.server|python3?\s+-m\s+http\.server/.test(command);
}

async function killPid(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 80));
      try {
        process.kill(pid, 0);
      } catch {
        return true;
      }
    }
    try { process.kill(pid, 'SIGKILL'); } catch {}
    await new Promise(resolve => setTimeout(resolve, 120));
    return true;
  } catch {
    return false;
  }
}

async function ensurePortReady(targetPort) {
  const existing = findListeningPid(targetPort);
  if (existing == null) return;
  const command = processCommand(existing);
  const sameProcess = Number(process.env.PLAYGROUND_PID || '') === existing;
  if (sameProcess) return;
  if (!isLikelySimpleHttpServer(command)) {
    console.warn(`[warn] 端口 ${targetPort} 已被 PID ${existing} 占用：${command || 'unknown'}`);
    console.warn(`  如果这是之前的本地服务，请先手动关闭后再运行 npm run playground，或改用 PORT=xxxx npm run playground。`);
    return;
  }
  console.warn(`[playground] 端口 ${targetPort} 上运行的是简单静态服务（PID ${existing}：${command}），已为你自动回收。`);
  await killPid(existing);
}

async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname).replace(/^\/+/, '');
  const relative = decoded || 'playground/index.html';
  const candidates = extname(relative) ? [relative] : [`${relative}.html`, join(relative, 'index.html')];
  for (const candidate of candidates) {
    const file = normalize(join(root, candidate));
    if (!file.startsWith(root)) continue;
    try {
      await access(file);
      if ((await stat(file)).isFile()) return file;
    } catch {}
  }
  return null;
}

const targetPortPlaceholder = String(port);

function fallbackFile(response, message) {
  const entries = [
    ['首页', 'playground/index.html'],
    ['完整 Gallery', 'playground/project-gallery.html'],
    ['项目分析', 'playground/project-intelligence.html'],
    ['业务编辑/编辑页', 'playground/editing.html'],
    ['流程图编辑器', 'playground/diagram-editor.html'],
    ['基础能力 Gallery', 'playground/foundational-gallery.html'],
    ['主题样式', 'playground/theme-gallery.html'],
    ['Agent 工作台', 'playground/agent-workbench.html']
  ];
  const urls = entries.map(([label, path]) => `- ${label.padEnd(18)} http://${host}:${targetPortPlaceholder}/${path}`).join('\n');
  response.writeHead(404, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>404 Not Found</title><style>body{margin:0;padding:32px;font:14px system-ui,sans-serif;background:#f8fafc;color:#0f172a}pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;max-width:920px;white-space:pre-wrap}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}</style></head><body><h1>iChart.js Playground — 404</h1><p>${message}</p><h3>请用正确的 URL 访问（root = 仓库根目录）：</h3><pre>${urls}</pre><h3>启动方式：</h3><pre><code>cd /Users/wanghe/project/ichartjs\nnpm run playground\n# 或指定端口：PORT=3001 npm run playground</code></pre><p>如果浏览器报“模块加载失败 / 404 / MIME 不允许”，请确保：</p><pre>1) 不是直接双击 HTML 打开（那样会走 file://，模块 import 通常被拒绝或二级路径 404）\n2) 不要在 playground 子目录中执行 "python3 -m http.server 3000"（那样 root 错了，会让 /playground/xxx.html /src/xxx.mjs 全部变成 404）\n3) 推荐直接在仓库根执行：npm run playground</pre></body></html>`;
  response.end(html);
}

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method Not Allowed');
    return;
  }
  let pathname;
  try {
    pathname = new URL(request.url || '/', `http://${host}:${port}`).pathname;
  } catch {
    fallbackFile(response, '无法解析请求 URL。');
    return;
  }
  const file = await resolveFile(pathname);
  if (!file) {
    const hint = [];
    if (pathname.startsWith('/playground/')) {
      const rel = pathname.slice('/playground/'.length);
      if (!rel.includes('/') && rel && !rel.endsWith('.html')) hint.push('可能缺少 .html 后缀，例如 /playground/project-gallery.html');
    } else if (!pathname.startsWith('/src/') && !pathname.startsWith('/playground/') && !pathname.startsWith('/docs/') && !pathname.startsWith('/tests/') && !pathname.startsWith('/examples/')) {
      hint.push('Playground 入口页面均位于 /playground/ 子路径，直接访问根目录不会跳转到 playground');
    }
    fallbackFile(response, `找不到文件：<code>${pathname}</code>。${hint.join('；')}`);
    return;
  }
  response.writeHead(200, {
    'Content-Type': types.get(extname(file)) || 'application/octet-stream',
    'Cache-Control': 'no-store, max-age=0',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).pipe(response);
});

function printReady() {
  console.log(`iChart.js Playground 已启动： http://${host}:${port}/playground/index.html`);
  console.log(` - 完整 Gallery：        http://${host}:${port}/playground/project-gallery.html`);
  console.log(` - 项目分析：            http://${host}:${port}/playground/project-intelligence.html`);
  console.log(` - 业务编辑（Editing）： http://${host}:${port}/playground/editing.html`);
  console.log(` - Diagram 编辑器：      http://${host}:${port}/playground/diagram-editor.html`);
  console.log(`说明：root = ${root}。若此前有 python3 -m http.server 占 3000 端口，本脚本会自动回收；遇到模块 404/MIME 报错请务必回到仓库根执行 npm run playground，不要在 playground/ 子目录单独起 python http.server。`);
}

process.env.PLAYGROUND_PID = String(process.pid);
try {
  await unlink(join(root, '.playground-pid')).catch(() => {});
} catch {}

server.on('error', async error => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`[error] 端口 ${host}:${port} 仍被占用，请先手动关闭占用进程或使用 PORT=xxxx npm run playground。`);
    process.exit(1);
    return;
  }
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});

await ensurePortReady(port);
server.listen(port, host, () => printReady());
