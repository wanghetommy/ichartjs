import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgentTasks } from '../scripts/run-agent-tasks.mjs';

test('completes the executable Agent task fixtures with delivery evidence', () => {
  const tasks = runAgentTasks();
  assert.equal(tasks.length, 5);
  assert.ok(tasks.every(task => task.ok));
  assert.ok(tasks.every(task => task.output.bytes > 0));
  assert.ok(tasks.every(task => task.lineage?.sourcePreserved || task.health?.renderable));
  assert.ok(tasks.find(task => task.name === 'part-to-whole').warnings.some(item => item.code === 'NEGATIVE_VALUE_DROPPED'));
});

test('keeps the public capability profiles independently usable', async () => {
  const standard = await import('../src/standard.mjs');
  const project = await import('../src/project-profile.mjs');
  const diagram = await import('../src/diagram-profile.mjs');
  const board = await import('../src/board-profile.mjs');
  const chart = standard.createChart({ type: 'line', renderer: 'svg', data: { values: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] } });
  assert.equal(chart.getState().health.renderable, true);
  assert.match(chart.export({ type: 'svg' }), /<svg/);
  assert.equal(project.getCapabilities().chartTypes.includes('gantt'), true);
  assert.equal(diagram.getCapabilities().chartTypes.includes('flow'), true);
  const freeform = board.createBoard({ width: 160, height: 120, renderer: 'svg', items: [] });
  assert.match(freeform.export({ type: 'svg' }), /<svg/);
  chart.destroy();
  freeform.destroy();
});
