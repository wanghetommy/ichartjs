import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildFootprintReport, root } from './footprint-lib.mjs';

const output = resolve(root, 'playground/footprint.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(await buildFootprintReport(), null, 2)}\n`);
console.log(`Generated ${output}`);
