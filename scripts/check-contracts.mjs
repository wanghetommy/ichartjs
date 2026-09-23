import { readFile } from 'node:fs/promises';
import { getBusinessSchema, getCapabilities as runtimeCapabilities, iChart } from '../src/index.mjs';
import { operationTypes } from '../src/command.mjs';

const readJSON = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);
const [packageJson, manifest, commands, schemas] = await Promise.all([
  readJSON('../package.json'),
  readJSON('../docs/manifests/capabilities.json'),
  readJSON('../docs/manifests/commands.json'),
  readJSON('../docs/manifests/schemas.json')
]);
const capabilities = runtimeCapabilities();
const failures = [];
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const check = (label, actual, expected) => { if (!equal(actual, expected)) failures.push(label); };
const checkSet = (label, actual, expected) => { if (!equal([...actual].sort(), [...expected].sort())) failures.push(label); };
const schemaProjection = Object.fromEntries(capabilities.businessModels.map(name => { const schema = getBusinessSchema(name), fields = schema.fields || {}; return [name, { key: schema.key, required: Object.entries(fields).filter(([, field]) => field.required).map(([field]) => field), editable: Object.entries(fields).filter(([, field]) => field.editable !== false).map(([field]) => field) }]; }));

check('contractVersion', manifest.contractVersion, capabilities.contractVersion);
check('packageVersion', manifest.packageVersion, packageJson.version);
check('runtimeVersion', manifest.runtimeVersion, iChart.version);
check('chartTypes', manifest.chartTypes, capabilities.chartTypes);
check('chartProfiles', manifest.chartProfiles, capabilities.charts);
check('renderers', manifest.renderers, capabilities.renderers);
check('interactionDefaults', manifest.interactionDefaults, capabilities.interactionDefaults);
check('commands', manifest.commands, capabilities.commands);
check('diagramOperations', manifest.diagramOperations, capabilities.diagramOperations);
check('businessModels', manifest.businessModels, capabilities.businessModels);
check('diagramEdgeModels', manifest.diagramEdgeModels, capabilities.diagramEdgeModels);
check('schemas', schemas.models, schemaProjection);
check('exports', manifest.exports, capabilities.exports);
check('export', manifest.export, capabilities.export);
check('commands', manifest.commands, operationTypes);
checkSet('command manifest', Object.keys(commands.commands), operationTypes);
if (failures.length) {
  console.error(`Contract check failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`Contract check passed: ${capabilities.chartTypes.length} chart profiles, contract ${capabilities.contractVersion}.`);
}
