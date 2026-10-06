import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { getCapabilities, inspectData, validateSpec } from '../src/index.mjs';

const packageFile = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const [readme, quickstart, usage, browserExample] = await Promise.all([
  read('README.md'),
  read('docs/agent/quickstart.md'),
  read('docs/agent/usage-scenarios.md'),
  read('examples/consumer-browser.html')
]);

const expectedExports = ['.', './standard', './project', './diagram', './board'];
assert.deepEqual(Object.keys(packageFile.exports).filter(key => expectedExports.includes(key)), expectedExports);
assert.match(readme, /public runtime entries are independent/);
assert.match(quickstart, /do not require importing the root entry first/);
assert.match(usage, /root entry is not a prerequisite/);
assert.match(browserExample, /type="importmap"/);

const output = execFileSync(process.execPath, ['examples/consumer-quickstart.mjs'], { cwd: process.cwd(), encoding: 'utf8' });
const report = JSON.parse(output);
assert.equal(report.rootEntry.chartTypes, getCapabilities().chartTypes.length);
assert.equal(report.rootEntry.renderable, true);
assert.equal(report.rootEntry.svg, true);
assert.equal(report.independentProfiles.standard.renderable, true);
assert.equal(report.independentProfiles.project.type, 'gantt');
assert.equal(report.independentProfiles.diagram.type, 'flow');
assert.equal(report.independentProfiles.board.svg, true);

const malformed = validateSpec({ type: 'line', data: { values: { month: 'Jan' } }, encoding: { x: { field: 'month' }, y: { field: 'value' } } });
assert.equal(malformed.valid, false);
assert.equal(malformed.errors[0].code, 'INVALID_DATA');
assert.ok(malformed.errors[0].suggestion);
const duplicate = inspectData([{ id: 'same', month: 'Jan', value: 1 }, { id: 'same', month: 'Feb', value: 2 }]);
assert.ok(duplicate.warnings.some(item => item.code === 'DUPLICATE_RECORD_ID'));

console.log(`First-run consumer check passed: ${report.rootEntry.chartTypes} chart types, ${expectedExports.length} public entries, data diagnostics verified.`);
