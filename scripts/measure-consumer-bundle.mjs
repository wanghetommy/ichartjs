import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildConsumerBundles } from './consumer-bundle-lib.mjs';

const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = argument.match(/^--(published|output)=(.+)$/);
  if (!match) throw new Error(`Unknown argument: ${argument}. Use --published=2.0.30 or --output=path.json.`);
  return [match[1], match[2]];
}));
if (options.published && !/^\d+\.\d+\.\d+$/.test(options.published)) throw new Error('Published version must be an explicit stable semver.');
const report = await buildConsumerBundles({ publishedVersion: options.published });
if (options.output) {
  const path = resolve(options.output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
