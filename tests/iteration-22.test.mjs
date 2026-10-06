import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runAgentAdoptionChecks } from '../scripts/check-agent-adoption.mjs';

test('completes the Iteration 22 Agent adoption and production benchmark matrix', async () => {
  const report = await runAgentAdoptionChecks();
  assert.equal(report.scenarios.trend.render.health.renderable, true);
  assert.equal(report.scenarios.composition.render.health.renderable, true);
  assert.equal(report.scenarios.project.health.renderable, true);
  assert.equal(report.scenarios.flow.health.renderable, true);
  assert.equal(report.scenarios.board.health.renderable, true);
  assert.deepEqual(report.profiles.map(profile => profile.name), ['standard', 'project', 'diagram', 'board']);
  assert.equal(report.profiles.every(profile => profile.renderable && profile.svg), true);
  assert.equal(report.diagnostics.invalid[0].code, 'MISSING_ENCODING_FIELD');
  assert.equal(Object.keys(report.accessibilityLocale).length, 6);
  assert.equal(report.documentationRecipes.recipeCount, 10);
});

test('publishes generated footprint data for the Playground', async () => {
  const [page, footprint, packageFile] = await Promise.all([
    readFile(new URL('../playground/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../playground/footprint.json', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8')
  ]);
  const report = JSON.parse(footprint);
  assert.match(page, /footprint\.json/);
  assert.equal(report.packageVersion, JSON.parse(packageFile).version);
  assert.ok(report.resources.groups['English guides']);
  assert.ok(report.resources.groups['runtime source']);
  assert.ok(report.profiles.standard.gzipBytes < report.moduleGzipBytes);
});
