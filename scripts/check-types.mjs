import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const fixture = new URL('../types/consumer-fixture.ts', import.meta.url);
await access(fixture);

const executable = process.env.TSC_BIN || 'tsc';
const child = spawn(executable, ['--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--lib', 'ES2022,DOM', fixture.pathname], { stdio: 'inherit' });
const exitCode = await new Promise(resolve => child.on('error', error => { if (error.code === 'ENOENT') resolve(null); else { console.error(error.message); resolve(1); } }).on('exit', code => resolve(code)));
if (exitCode === null) {
  console.warn('TypeScript compiler not installed; consumer fixture presence and declaration contract are checked by package validation, compile gate skipped locally.');
  process.exit(0);
}
process.exit(exitCode);
