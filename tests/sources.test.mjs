import assert from 'node:assert/strict';
import {
  appendFile,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { completeSourceLock } from '../scripts/lib/locking.mjs';
import { inspectSkillTree } from '../scripts/lib/skill-tree.mjs';
import {
  inspectCanonicalSkills,
  parseSyncArguments,
  verifyCanonicalSkillSnapshots
} from '../scripts/lib/sources.mjs';

async function createDistributionFixture() {
  const temporaryRoot = await realpath(os.tmpdir());
  const repositoryRoot = await mkdtemp(path.join(temporaryRoot, 'primeui-source-test-'));
  const skillPath = 'skills/primevue';
  const skillRoot = path.join(repositoryRoot, ...skillPath.split('/'));
  await mkdir(path.join(skillRoot, 'references'), { recursive: true });
  await writeFile(path.join(skillRoot, 'SKILL.md'), '---\nname: primevue\n---\n');
  await writeFile(path.join(skillRoot, 'references', 'setup.md'), '# Setup\n');
  const inspection = await inspectSkillTree(skillRoot);
  return { inspection, repositoryRoot, skillPath, skillRoot };
}

function fixtureConfiguration(skillPath, skillHash) {
  const skill = {
    directory: 'primevue', id: 'primevue', name: 'primevue', order: 0,
    owner: 'primevue', sourcePath: skillPath
  };
  return {
    lockConfig: {
      sources: [
        {
          lockState: 'locked',
          name: 'primevue',
          pluginVersion: '1.0.0',
          skills: [{
            directory: skill.directory, id: skill.id, name: skill.name,
            order: skill.order, owner: skill.owner,
            source: {
              path: skillPath,
              repository: 'https://github.com/primefaces/primeui-plugins',
              treeHash: skillHash
            }
          }]
        }
      ]
    },
    pluginsConfig: {
      plugins: [{ name: 'primevue', skills: [skill] }]
    }
  };
}

test('sync argument parsing accepts only the optional check flag', () => {
  assert.deepEqual(parseSyncArguments([]), { check: false });
  assert.deepEqual(parseSyncArguments(['--check'], { allowCheck: true }), { check: true });
  assert.throws(
    () => parseSyncArguments(['--check', '--check'], { allowCheck: true }),
    /Duplicate --check/
  );
  assert.throws(() => parseSyncArguments(['--source', 'primevue=/tmp/source']), /Unknown argument/);
  assert.throws(() => parseSyncArguments(['--check']), /Unknown argument/);
});

test('canonical skill verification rejects missing, duplicate, drifted, and changed sources', async (context) => {
  const fixture = await createDistributionFixture();
  context.after(() => rm(fixture.repositoryRoot, { force: true, recursive: true }));
  const { lockConfig, pluginsConfig } = fixtureConfiguration(
    fixture.skillPath,
    fixture.inspection.hash
  );

  const snapshots = await inspectCanonicalSkills(
    fixture.repositoryRoot,
    pluginsConfig,
    lockConfig,
    { requireLocked: true, verifyHash: true }
  );
  assert.equal(snapshots.get('primevue').skills[0].skillRoot, fixture.skillRoot);

  const duplicatePlugins = {
    plugins: [
      ...pluginsConfig.plugins,
      { name: 'primeng', skills: [{ ...pluginsConfig.plugins[0].skills[0], owner: 'primeng' }] }
    ]
  };
  const duplicateLocks = structuredClone(lockConfig);
  duplicateLocks.sources.push({
    ...structuredClone(lockConfig.sources[0]),
    name: 'primeng'
  });
  await assert.rejects(
    inspectCanonicalSkills(fixture.repositoryRoot, duplicatePlugins, duplicateLocks),
    /resolve to the same path/
  );

  const missingPlugins = structuredClone(pluginsConfig);
  missingPlugins.plugins[0].skills[0].sourcePath = 'skills/missing';
  const missingLocks = structuredClone(lockConfig);
  missingLocks.sources[0].skills[0].source.path = 'skills/missing';
  await assert.rejects(
    inspectCanonicalSkills(fixture.repositoryRoot, missingPlugins, missingLocks),
    /does not exist/
  );

  const linkedPlugins = structuredClone(pluginsConfig);
  linkedPlugins.plugins[0].skills[0].sourcePath = 'skills/linked';
  const linkedLocks = structuredClone(lockConfig);
  linkedLocks.sources[0].skills[0].source.path = 'skills/linked';
  await symlink(fixture.skillRoot, path.join(fixture.repositoryRoot, 'skills', 'linked'));
  await assert.rejects(
    inspectCanonicalSkills(fixture.repositoryRoot, linkedPlugins, linkedLocks),
    /must be a physical directory/
  );

  const wrongHash = structuredClone(lockConfig);
  wrongHash.sources[0].skills[0].source.treeHash = `sha256:${'0'.repeat(64)}`;
  await assert.rejects(
    inspectCanonicalSkills(fixture.repositoryRoot, pluginsConfig, wrongHash, {
      verifyHash: true
    }),
    /Skill hash mismatch/
  );

  const skillFile = path.join(fixture.skillRoot, 'SKILL.md');
  const originalSkill = await readFile(skillFile);
  await appendFile(skillFile, 'changed\n');
  await assert.rejects(
    verifyCanonicalSkillSnapshots(
      fixture.repositoryRoot,
      pluginsConfig,
      lockConfig,
      snapshots
    ),
    /Canonical skill source changed during generation/
  );
  await writeFile(skillFile, originalSkill);
});

test('source-lock generation records canonical skill hashes without external Git provenance', async (context) => {
  const fixture = await createDistributionFixture();
  context.after(() => rm(fixture.repositoryRoot, { force: true, recursive: true }));
  const { lockConfig } = fixtureConfiguration(fixture.skillPath, null);
  lockConfig.sources[0].lockState = 'unresolved';
  lockConfig.sources[0].unresolvedReason = 'Hash pending.';
  const snapshots = new Map([['primevue', { skills: [{ id: 'primevue', inspection: fixture.inspection }] }]]);
  const completed = completeSourceLock(lockConfig, snapshots);

  assert.equal(completed.sources[0].lockState, 'locked');
  assert.equal(completed.sources[0].skills[0].source.treeHash, fixture.inspection.hash);
  assert.equal(completed.sources[0].skills[0].source.path, 'skills/primevue');
  assert.equal(
    completed.sources[0].skills[0].source.repository,
    'https://github.com/primefaces/primeui-plugins'
  );
  assert.equal(Object.hasOwn(completed.sources[0].skills[0].source, 'commit'), false);
  assert.equal(Object.hasOwn(completed.sources[0], 'unresolvedReason'), false);
  assert.equal(lockConfig.sources[0].lockState, 'unresolved');
});
