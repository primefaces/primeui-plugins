import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  access,
  appendFile,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  unlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stableStringify } from '../scripts/lib/contracts.mjs';
import { syncDistribution } from '../scripts/lib/generator.mjs';
import { repositoryRoot } from '../scripts/lib/repository.mjs';
import { inspectSkillTree } from '../scripts/lib/skill-tree.mjs';

function git(repositoryPath, argumentsList) {
  const result = spawnSync('git', argumentsList, {
    cwd: repositoryPath,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_EMAIL: 'tests@example.invalid',
      GIT_AUTHOR_NAME: 'PrimeUI Tests',
      GIT_COMMITTER_EMAIL: 'tests@example.invalid',
      GIT_COMMITTER_NAME: 'PrimeUI Tests'
    }
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
}

async function createFrameworkSource(parentRoot, plugin) {
  const repositoryPath = path.join(parentRoot, `source-${plugin.name}`);
  const skillRoot = path.join(repositoryPath, ...plugin.skillSourcePath.split('/'));
  await mkdir(path.join(skillRoot, 'references'), { recursive: true });
  await writeFile(
    path.join(skillRoot, 'SKILL.md'),
    `---\nname: ${plugin.name}\n---\n\n# ${plugin.displayName}\n\nRead [setup](references/setup.md).\n`
  );
  await writeFile(path.join(skillRoot, 'references', 'setup.md'), `# ${plugin.displayName} Setup\n`);
  git(repositoryPath, ['init', '--quiet']);
  git(repositoryPath, ['add', '.']);
  git(repositoryPath, ['commit', '--quiet', '-m', `${plugin.name} fixture`]);
  const commit = git(repositoryPath, ['rev-parse', 'HEAD']);
  const inspection = await inspectSkillTree(skillRoot);
  return { commit, inspection, repositoryPath, skillRoot };
}

async function listSnapshotFiles(rootPath, prefix = '') {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const snapshot = new Map();
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = prefix === '' ? entry.name : path.posix.join(prefix, entry.name);
    const absolutePath = path.join(rootPath, entry.name);
    const stats = await lstat(absolutePath);
    if (stats.isDirectory()) {
      const nested = await listSnapshotFiles(absolutePath, relativePath);
      for (const [file, content] of nested) {
        snapshot.set(file, content);
      }
    } else if (stats.isFile()) {
      snapshot.set(relativePath, await readFile(absolutePath));
    }
  }
  return snapshot;
}

function assertSnapshotsEqual(left, right) {
  assert.deepEqual([...left.keys()], [...right.keys()]);
  for (const [relativePath, content] of left) {
    assert.equal(content.equals(right.get(relativePath)), true, relativePath);
  }
}

function failRenameAt(callNumber) {
  let calls = 0;
  return async (sourcePath, destinationPath) => {
    calls += 1;
    if (calls === callNumber) {
      throw new Error(`Injected rename failure at call ${callNumber}.`);
    }
    await rename(sourcePath, destinationPath);
  };
}

async function assertNoStagingDirectories(distributionRoot) {
  const entries = await readdir(distributionRoot);
  assert.equal(entries.some((entry) => entry.startsWith('.primeui-plugins-sync-')), false);
}

async function createGeneratorFixture(context) {
  const temporaryRoot = await realpath(os.tmpdir());
  const root = await mkdtemp(path.join(temporaryRoot, 'primeui-generator-test-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const distributionRoot = path.join(root, 'distribution');
  await mkdir(path.join(distributionRoot, 'config'), { recursive: true });

  const pluginsConfig = await readJson('config/plugins.json');
  const lockConfig = await readJson('config/sources.lock.json');
  const sourcePaths = new Map();

  for (const plugin of pluginsConfig.plugins) {
    const fixture = await createFrameworkSource(root, plugin);
    sourcePaths.set(plugin.name, fixture.repositoryPath);
    const lock = lockConfig.sources.find((candidate) => candidate.name === plugin.name);
    lock.source.commit = fixture.commit;
    lock.source.skillHash = fixture.inspection.hash;
  }

  await writeFile(
    path.join(distributionRoot, 'config', 'plugins.json'),
    stableStringify(pluginsConfig)
  );
  await writeFile(
    path.join(distributionRoot, 'config', 'sources.lock.json'),
    stableStringify(lockConfig)
  );

  return { distributionRoot, pluginsConfig, sourcePaths };
}

test('generation is deterministic, atomic before replacement, and cleans stale output', async (context) => {
  const fixture = await createGeneratorFixture(context);
  const beforeInjectedFirstInstall = await listSnapshotFiles(fixture.distributionRoot);
  await assert.rejects(
    syncDistribution({
      check: false,
      replacementOptions: { renameEntry: failRenameAt(2) },
      repositoryRoot: fixture.distributionRoot,
      sourcePaths: fixture.sourcePaths
    }),
    /Injected rename failure/
  );
  assertSnapshotsEqual(
    beforeInjectedFirstInstall,
    await listSnapshotFiles(fixture.distributionRoot)
  );
  await assert.rejects(access(path.join(fixture.distributionRoot, '.agents')));
  await assertNoStagingDirectories(fixture.distributionRoot);

  const first = await syncDistribution({
    check: false,
    repositoryRoot: fixture.distributionRoot,
    sourcePaths: fixture.sourcePaths
  });
  assert.equal(first.stale, true);
  assert.equal(first.added.length, 32);

  const afterFirst = await listSnapshotFiles(fixture.distributionRoot);
  const second = await syncDistribution({
    check: false,
    repositoryRoot: fixture.distributionRoot,
    sourcePaths: fixture.sourcePaths
  });
  assert.deepEqual(second, { added: [], changed: [], removed: [], stale: false });
  const afterSecond = await listSnapshotFiles(fixture.distributionRoot);
  assertSnapshotsEqual(afterFirst, afterSecond);

  const checkBefore = await listSnapshotFiles(fixture.distributionRoot);
  const freshCheck = await syncDistribution({
    check: true,
    repositoryRoot: fixture.distributionRoot,
    sourcePaths: fixture.sourcePaths
  });
  assert.equal(freshCheck.stale, false);
  assertSnapshotsEqual(checkBefore, await listSnapshotFiles(fixture.distributionRoot));

  const changedPath = path.join(fixture.distributionRoot, 'plugins', 'primevue', '.mcp.json');
  const missingPath = path.join(fixture.distributionRoot, 'plugins', 'primeng', 'provenance.json');
  const stalePath = path.join(fixture.distributionRoot, 'gemini', 'primereact', 'stale.txt');
  await appendFile(changedPath, 'stale\n');
  await unlink(missingPath);
  await writeFile(stalePath, 'stale\n');

  const staleBefore = await listSnapshotFiles(fixture.distributionRoot);
  const sourceSkillPath = path.join(
    fixture.sourcePaths.get('primevue'),
    'packages',
    'skills',
    'primevue',
    'SKILL.md'
  );
  const sourceSkillBeforePreflightMutation = await readFile(sourceSkillPath);
  await assert.rejects(
    syncDistribution({
      check: false,
      replacementOptions: {
        beforeMutation: () => appendFile(sourceSkillPath, 'changed during preflight\n')
      },
      repositoryRoot: fixture.distributionRoot,
      sourcePaths: fixture.sourcePaths
    }),
    /repository for primevue is dirty/
  );
  assertSnapshotsEqual(staleBefore, await listSnapshotFiles(fixture.distributionRoot));
  await assertNoStagingDirectories(fixture.distributionRoot);
  await writeFile(sourceSkillPath, sourceSkillBeforePreflightMutation);

  await assert.rejects(
    syncDistribution({
      check: false,
      replacementOptions: { renameEntry: failRenameAt(2) },
      repositoryRoot: fixture.distributionRoot,
      sourcePaths: fixture.sourcePaths
    }),
    /Injected rename failure/
  );
  assertSnapshotsEqual(staleBefore, await listSnapshotFiles(fixture.distributionRoot));
  await assertNoStagingDirectories(fixture.distributionRoot);

  await assert.rejects(
    syncDistribution({
      check: false,
      replacementOptions: { renameEntry: failRenameAt(6) },
      repositoryRoot: fixture.distributionRoot,
      sourcePaths: fixture.sourcePaths
    }),
    /Injected rename failure/
  );
  assertSnapshotsEqual(staleBefore, await listSnapshotFiles(fixture.distributionRoot));
  await assertNoStagingDirectories(fixture.distributionRoot);

  const staleCheck = await syncDistribution({
    check: true,
    repositoryRoot: fixture.distributionRoot,
    sourcePaths: fixture.sourcePaths
  });
  assert.deepEqual(staleCheck.added, ['plugins/primeng/provenance.json']);
  assert.deepEqual(staleCheck.changed, ['plugins/primevue/.mcp.json']);
  assert.deepEqual(staleCheck.removed, ['gemini/primereact/stale.txt']);
  assertSnapshotsEqual(staleBefore, await listSnapshotFiles(fixture.distributionRoot));

  const repaired = await syncDistribution({
    check: false,
    repositoryRoot: fixture.distributionRoot,
    sourcePaths: fixture.sourcePaths
  });
  assert.equal(repaired.stale, true);
  await assert.rejects(access(stalePath));

  const mcp = JSON.parse(await readFile(changedPath, 'utf8'));
  assert.deepEqual(mcp.mcpServers.primevue, {
    args: ['-y', '@primevue/mcp@5.0.0-rc.2'],
    command: 'npx'
  });
  const provenance = JSON.parse(
    await readFile(path.join(fixture.distributionRoot, 'plugins', 'primevue', 'provenance.json'), 'utf8')
  );
  assert.equal(provenance.name, 'primevue');
  assert.equal(provenance.mcp.package, '@primevue/mcp');
  assert.equal(provenance.pluginVersion, '0.1.0-alpha.0');

  const primeVueSource = fixture.sourcePaths.get('primevue');
  await appendFile(
    path.join(primeVueSource, 'packages', 'skills', 'primevue', 'SKILL.md'),
    'dirty\n'
  );
  const beforeRejectedGeneration = await listSnapshotFiles(fixture.distributionRoot);
  await assert.rejects(
    syncDistribution({
      check: false,
      repositoryRoot: fixture.distributionRoot,
      sourcePaths: fixture.sourcePaths
    }),
    /repository for primevue is dirty/
  );
  assertSnapshotsEqual(beforeRejectedGeneration, await listSnapshotFiles(fixture.distributionRoot));
});
