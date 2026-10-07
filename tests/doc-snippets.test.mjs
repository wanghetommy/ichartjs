import test from 'node:test';
import assert from 'node:assert/strict';
import { runDocumentSnippets } from '../scripts/check-doc-snippets.mjs';

test('executes README and Quickstart snippets from their Markdown source', () => {
  assert.deepEqual(runDocumentSnippets(), { nodeScenarios: 5, snippets: 11, browserScenarios: 2 });
});
