import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { listRepositoryFiles, repositoryRoot } from '../scripts/lib/repository.mjs';
import {
  auditProductVersionLiterals,
  findProductVersionLiterals
} from '../scripts/lib/version-literals.mjs';

test('repository contains no unauthorized PrimeUI MCP product-version literals', async () => {
  const files = await listRepositoryFiles();
  const evidence = await Promise.all(
    files.map(async (relativePath) => ({
      content: await readFile(path.join(repositoryRoot, relativePath), 'utf8'),
      relativePath
    }))
  );
  assert.deepEqual(auditProductVersionLiterals(evidence), []);
});

test('literal audit rejects exact runtime pins and keeps its allowlist path-based and narrow', () => {
  const exactVersion = ['5', '0', '0-rc', '9'].join('.');
  const exactPin = `@primevue/mcp@${exactVersion}`;
  assert.deepEqual(findProductVersionLiterals('tests/fixture.mjs', exactPin), [exactVersion, exactPin]);
  assert.deepEqual(findProductVersionLiterals('scripts/rehearse.mjs', exactVersion), [exactVersion]);
  assert.deepEqual(findProductVersionLiterals('config/plugins.json', exactPin), []);
  assert.deepEqual(findProductVersionLiterals('plugins/primevue/.mcp.json', exactPin), []);
  assert.notDeepEqual(findProductVersionLiterals('tests/fixtures/release-ledger.json', exactPin), []);
});
