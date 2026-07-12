import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  exportGeminiDistributions,
  readGeminiDistributionManifest
} from '../scripts/lib/gemini-distribution.mjs';
import { listRepositoryFiles, repositoryRoot } from '../scripts/lib/repository.mjs';
import { inspectSkillTree } from '../scripts/lib/skill-tree.mjs';

async function snapshot(root) {
  const files = await listRepositoryFiles(root);
  return new Map(
    await Promise.all(
      files.map(async (file) => [file, await readFile(path.join(root, ...file.split('/')))])
    )
  );
}

function assertSnapshotsEqual(left, right) {
  assert.deepEqual([...left.keys()], [...right.keys()]);
  for (const [file, content] of left) {
    assert.equal(content.equals(right.get(file)), true, file);
  }
}

test('Gemini distribution export creates isolated deterministic extension roots', async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'primeui-gemini-export-test-'));
  context.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const firstRoot = path.join(temporaryRoot, 'first');
  const secondRoot = path.join(temporaryRoot, 'second');

  const firstOutputs = await exportGeminiDistributions({
    destinationRoot: firstRoot,
    libraries: ['primevue', 'primeng', 'primereact'],
    repositoryRoot
  });
  const secondOutputs = await exportGeminiDistributions({
    destinationRoot: secondRoot,
    libraries: ['primevue', 'primeng', 'primereact'],
    repositoryRoot
  });
  assert.equal(firstOutputs.length, 3);
  assert.equal(secondOutputs.length, 3);

  for (const library of ['primevue', 'primeng', 'primereact']) {
    const extensionRoot = path.join(firstRoot, library);
    const manifest = await readGeminiDistributionManifest(extensionRoot);
    assert.equal(manifest.name, library);
    assert.deepEqual(Object.keys(manifest.mcpServers), [library]);
    assert.equal(manifest.mcpServers[library].command, 'npx');
    const provenance = JSON.parse(await readFile(path.join(extensionRoot, 'provenance.json'), 'utf8'));
    for (const skill of provenance.skills) {
      const inspection = await inspectSkillTree(path.join(extensionRoot, 'skills', skill.directory));
      assert.equal(inspection.records.length > 0, true);
      assert.equal(inspection.hash, skill.source.treeHash);
    }
    await assert.rejects(access(path.join(extensionRoot, '.claude-plugin')));
    await assert.rejects(access(path.join(extensionRoot, '.codex-plugin')));
    await assert.rejects(access(path.join(extensionRoot, '.cursor-plugin')));
    await assert.rejects(access(path.join(extensionRoot, '.mcp.json')));
  }

  assertSnapshotsEqual(await snapshot(firstRoot), await snapshot(secondRoot));
});

test('Gemini distribution export refuses repository and existing destinations', async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'primeui-gemini-export-guard-'));
  context.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const existing = path.join(temporaryRoot, 'existing');
  await mkdir(existing);

  await assert.rejects(
    exportGeminiDistributions({
      destinationRoot: path.join(repositoryRoot, 'generated-gemini'),
      libraries: ['primevue'],
      repositoryRoot
    }),
    /outside the source repository/
  );
  await assert.rejects(
    exportGeminiDistributions({
      destinationRoot: existing,
      libraries: ['primevue'],
      repositoryRoot
    }),
    /destination already exists/
  );
});
