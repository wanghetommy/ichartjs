import test from 'node:test';
import assert from 'node:assert/strict';
import { runDocumentSnippets } from '../scripts/check-doc-snippets.mjs';

test('executes README, Quickstart and bilingual construction snippets from their Markdown source', () => {
  assert.deepEqual(runDocumentSnippets(), { nodeScenarios: 9, snippets: 15, browserScenarios: 2 });
});
