import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const cache = mkdtempSync(join(tmpdir(), 'ichartjs-package-check-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const required = ['package.json', 'src/index.mjs', 'src/standard.mjs', 'src/project-profile.mjs', 'src/diagram-profile.mjs', 'src/board-profile.mjs', 'types/index.d.ts', 'types/standard.d.ts', 'types/project.d.ts', 'types/diagram.d.ts', 'types/board.d.ts', 'docs/manifests/capabilities.json', 'skills/ichartjs/SKILL.md', 'agent-recipes/minimal-specs.json'];
const forbiddenPrefixes = ['.trae/', '.github/', 'tests/', 'playground/'];
try {
  const output = execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8', env: { ...process.env, npm_config_cache: cache } });
  const report = JSON.parse(output.trim()).at(-1);
  const files = new Set((report?.files || []).map(file => file.path));
  const failures = [];
  if (report?.name !== packageJson.name || report?.version !== packageJson.version) failures.push('package metadata does not match package.json');
  required.forEach(file => { if (!files.has(file)) failures.push(`published package is missing ${file}`); });
  forbiddenPrefixes.forEach(prefix => { if ([...files].some(file => file.startsWith(prefix))) failures.push(`published package contains development path ${prefix}`); });
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log(`Package check passed: ${report.entryCount} files, ${packageJson.name}@${packageJson.version}.`);
} finally {
  rmSync(cache, { recursive: true, force: true });
}
