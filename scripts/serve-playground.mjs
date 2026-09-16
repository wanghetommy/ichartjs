import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const root = normalize(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const types = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml']
]);

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

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const file = await resolveFile(new URL(request.url || '/', 'http://localhost').pathname);
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('Not found');
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

server.listen(port, '127.0.0.1', () => {
  console.log(`ichartjs Playground: http://localhost:${port}/playground/`);
});
