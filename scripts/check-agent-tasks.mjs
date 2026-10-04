import { runAgentTasks } from './run-agent-tasks.mjs';

const tasks = runAgentTasks();
if (tasks.length !== 5 || tasks.some(task => task.ok !== true)) throw new Error('Agent task acceptance did not complete all five fixtures.');
console.log(`Agent task check passed: ${tasks.length} executable fixtures.`);
