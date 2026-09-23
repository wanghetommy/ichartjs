import { readFile, writeFile } from 'node:fs/promises';
import { getBusinessSchema, getCapabilities as runtimeCapabilities, iChart } from '../src/index.mjs';
import { operationTypes } from '../src/command.mjs';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const manifestUrl = new URL('../docs/manifests/capabilities.json', import.meta.url);
const schemasUrl = new URL('../docs/manifests/schemas.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const capabilities = runtimeCapabilities();

const next = {
  ...manifest,
  version: capabilities.version,
  packageVersion: packageJson.version,
  runtimeVersion: iChart.version,
  contractVersion: capabilities.contractVersion,
  chartTypes: capabilities.chartTypes,
  chartProfiles: capabilities.charts,
  renderers: capabilities.renderers,
  interactionDefaults: capabilities.interactionDefaults,
  commands: capabilities.commands,
  diagramOperations: capabilities.diagramOperations,
  businessModels: capabilities.businessModels,
  diagramEdgeModels: capabilities.diagramEdgeModels,
  exports: capabilities.exports,
  export: capabilities.export,
  commands: operationTypes
};

await writeFile(manifestUrl, `${JSON.stringify(next, null, 2)}\n`);
const schemaProjection = Object.fromEntries(capabilities.businessModels.map(name => {
  const schema = getBusinessSchema(name);
  const fields = schema.fields || {};
  return [name, { key: schema.key, required: Object.entries(fields).filter(([, field]) => field.required).map(([field]) => field), editable: Object.entries(fields).filter(([, field]) => field.editable !== false).map(([field]) => field) }];
}));
await writeFile(schemasUrl, `${JSON.stringify({ version: '1.0', source: 'src/schema.mjs#getBusinessSchema', models: schemaProjection }, null, 2)}\n`);
