import { readFile } from 'node:fs/promises';
import { buildFootprintReport, footprintFailures } from './footprint-lib.mjs';

const report = await buildFootprintReport();
const failures = footprintFailures(report);
let recorded;
try {
  recorded = JSON.parse(await readFile(new URL('../playground/footprint.json', import.meta.url), 'utf8'));
} catch (error) {
  failures.push(`missing generated playground/footprint.json: ${error.message}`);
}
if (recorded && JSON.stringify(recorded) !== JSON.stringify(report)) {
  failures.push('playground/footprint.json is stale; run npm run footprint:generate');
}
console.log(JSON.stringify(report, null, 2));
if (failures.length) throw new Error(`Runtime footprint regression: ${failures.join('; ')}`);
