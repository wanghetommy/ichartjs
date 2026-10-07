import fs from 'node:fs';
import path from 'node:path';
import { validateCommand } from '../src/command.mjs';
import { createBoard, createChart, validateBoardCommand, validateBoardSpec, validateSpec } from '../src/index.mjs';

const root = 'agent-recipes';
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

function recipeFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return recipeFiles(full);
    return entry.name.endsWith('.json') && entry.name !== 'manifest.json' ? [full] : [];
  });
}

function checkSpec(value, source, label) {
  const specs = value.spec ? [[`${label}.spec`, value.spec]]
    : value.examples && typeof value.examples === 'object'
      ? Object.entries(value.examples).map(([key, spec]) => [`${label}.examples.${key}`, spec])
      : [[label, value]];
  specs.forEach(([specLabel, spec]) => {
    const result = validateSpec(spec);
    if (!result.valid) failures.push(`${source}: ${specLabel}: ${result.errors.map(error => error.message).join('; ')}`);
  });
}

function checkBoard(value, source) {
  const result = validateBoardSpec(value);
  if (!result.valid) failures.push(`${source}: ${result.errors.map(error => error.message).join('; ')}`);
}

const files = recipeFiles(root).sort();
const entries = new Map(manifest.entries.map(entry => [entry.source, entry]));
if (entries.size !== manifest.entries.length) failures.push('agent-recipes/manifest.json: duplicate entry source.');
files.forEach(source => {
  const entry = entries.get(source);
  if (!entry) {
    failures.push(`${source}: missing manifest entry.`);
    return;
  }
  const value = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (entry.validator === 'validateSpec') checkSpec(value, source, entry.id);
  else if (entry.validator === 'validateBoardSpec') checkBoard(value.spec || value, source);
  else failures.push(`${source}: unsupported manifest validator ${entry.validator}.`);
  if (entry.commandValidator === 'validateCommand' || entry.commandValidator === 'validateBoardCommand') {
    if (!Array.isArray(value.commands) || !value.commands.length) failures.push(`${source}: command template must declare commands[].`);
    else value.commands.forEach((command, index) => {
      const result = entry.commandValidator === 'validateBoardCommand' ? validateBoardCommand(command) : validateCommand(command);
      if (!result.valid) failures.push(`${source}: commands[${index}]: ${result.errors.map(error => error.message).join('; ')}`);
    });
  }
  if (entry.kind === 'diagram-building-template' || entry.kind === 'board-building-template') {
    const chart = entry.kind === 'board-building-template' ? createBoard(value.spec) : createChart(value.spec);
    try {
      for (const command of value.commands) {
        const preview = chart.previewEdit(command);
        if (!preview.valid) { failures.push(`${source}: building preview: ${preview.errors.map(error => error.message).join('; ')}`); break; }
        const result = chart.applyEdit(preview.command, { preview, confirmed: true, source: 'recipe-check' });
        if (!result.valid) { failures.push(`${source}: building commit: ${result.errors.map(error => error.message).join('; ')}`); break; }
      }
    } finally { chart.destroy(); }
  }
  if (!Array.isArray(entry.output) || !entry.output.length) failures.push(`${source}: manifest output must be a non-empty array.`);
  if (entry.kind === 'diagram-edit-template' && entry.renderable !== false) failures.push(`${source}: edit templates must set renderable=false.`);
});
manifest.entries.forEach(entry => {
  if (!fs.existsSync(entry.source)) failures.push(`${entry.id}: manifest source does not exist: ${entry.source}.`);
  if (typeof entry.path !== 'string' || !entry.path.startsWith('@taylorwong/ichartjs/recipes/')) failures.push(`${entry.id}: manifest path must use the public recipes export.`);
  if (typeof entry.usage !== 'string' || !entry.usage.trim()) failures.push(`${entry.id}: manifest usage is missing.`);
});

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Agent recipe check passed: ${files.length} recipes, ${manifest.entries.length} manifest entries.`);
