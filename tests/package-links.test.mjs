import test from 'node:test';
import assert from 'node:assert/strict';
import { packageLinkFailures } from '../scripts/package-links.mjs';

test('package links are checked against packed files, not repository existence', () => {
  const files = new Set(['README.md', 'docs/guide.md']);
  const content = { 'README.md': '[Guide](docs/guide.md#usage) [History](docs/development/history.md)', 'docs/guide.md': '[Home](../README.md)' };
  const failures = packageLinkFailures(files, file => content[file]);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /docs\/development\/history.md/);
});

test('package link checks cover README images, directories and encoded paths', () => {
  const files = new Set(['README.md', 'docs/guide.md', 'assets/a file.svg']);
  const content = { 'README.md': '<img src="assets/a%20file.svg"> [Docs](docs/) <img src="missing.gif">', 'docs/guide.md': '' };
  assert.deepEqual(packageLinkFailures(files, file => content[file]), ['README.md: unpacked package is missing link target missing.gif']);
});

test('remote resources and same-document anchors do not become local package requirements', () => {
  const files = new Set(['README.md']);
  assert.deepEqual(packageLinkFailures(files, () => '[Web](https://example.com) [Mail](mailto:maintainer@example.com) [Section](#usage) <img src="https://example.com/a.gif">'), []);
});
