import test from 'node:test';
import assert from 'node:assert/strict';
import { runDocumentSnippets } from '../scripts/check-doc-snippets.mjs';

test('tracks frontend snippets and executes README, Quickstart and bilingual construction from Markdown', () => {
  assert.deepEqual(runDocumentSnippets(), { nodeScenarios: 9, snippets: 19, browserScenarios: 6 });
});
