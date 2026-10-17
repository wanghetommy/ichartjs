import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const bundlerVersion = '0.28.2';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const factories = { root: 'createChart', standard: 'createChart', project: 'createChart', diagram: 'createChart', board: 'createBoard' };

export async function buildConsumerBundles({ publishedVersion, outputDirectory, extraExports = {} } = {}) {
  const work = mkdtempSync(join(tmpdir(), 'ichartjs-browser-consumer-'));
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const env = { ...process.env, npm_config_cache: join(work, 'cache') };
  try {
    let source = `@taylorwong/ichartjs@${publishedVersion}`;
    if (!publishedVersion) {
      const packed = execFileSync(npm, ['pack', '--silent', '--ignore-scripts', '--pack-destination', work], { cwd: root, env, encoding: 'utf8' }).trim().split(/\r?\n/).at(-1);
      source = join(work, packed);
    }
    execFileSync(npm, ['install', '--prefix', work, '--ignore-scripts', '--no-audit', '--no-fund', `esbuild@${bundlerVersion}`, source], { env, stdio: 'pipe' });
    const { build } = await import(pathToFileURL(join(work, 'node_modules/esbuild/lib/main.js')));
    const packageRoot = join(work, 'node_modules/@taylorwong/ichartjs');
    const packageInfo = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    const entries = {};
    if (outputDirectory) await mkdir(outputDirectory, { recursive: true });
    for (const [name, factory] of Object.entries(factories)) {
      const packageEntry = `@taylorwong/ichartjs${name === 'root' ? '' : `/${name}`}`;
      const result = await build({
        stdin: { contents: `export { ${[factory, ...(extraExports[name] || [])].join(', ')} } from '${packageEntry}';`, resolveDir: work, sourcefile: `${name}-consumer.mjs` },
        bundle: true, minify: true, treeShaking: true, platform: 'browser', format: 'esm', target: 'es2022',
        external: ['canvas'], metafile: true, write: false, logLevel: 'silent'
      });
      const content = result.outputFiles[0].contents;
      const modules = Object.keys(result.metafile.inputs).filter(path => path.includes('node_modules/@taylorwong/ichartjs/')).map(path => path.split('node_modules/@taylorwong/ichartjs/')[1]).sort();
      if (modules.some(path => !path.startsWith('src/'))) throw new Error(`${name} unexpectedly bundles Agent resources.`);
      if (name !== 'root' && modules.includes('src/index.mjs')) throw new Error(`${name} unexpectedly bundles the root runtime.`);
      entries[name] = { import: packageEntry, factory, minifiedBytes: content.length, gzipBytes: gzipSync(content, { level: 9 }).length, modules };
      if (outputDirectory) await writeFile(join(outputDirectory, `${name}.mjs`), content);
    }
    return { version: '1.0', packageVersion: packageInfo.version, source: publishedVersion ? 'npm-registry' : 'local-tarball', bundler: { name: 'esbuild', version: bundlerVersion, platform: 'browser', format: 'esm', target: 'es2022', minify: true, gzipLevel: 9, external: ['canvas'] }, entries };
  } finally { rmSync(work, { recursive: true, force: true }); }
}
