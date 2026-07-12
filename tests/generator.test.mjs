import assert from 'node:assert/strict';
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
import { assertPhysicalSkillInventory, configuredSkillContracts } from '../scripts/lib/smoke-contracts.mjs';

const syntheticSkillKinds = [
  'router',
  'component-implementation',
  'setup-installation',
  'theming-customization',
  'accessibility-icons',
  'migration',
  'audit-troubleshooting'
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
}

async function createCanonicalSkill(distributionRoot, plugin, skill) {
  const skillRoot = path.join(distributionRoot, ...skill.sourcePath.split('/'));
  await mkdir(path.join(skillRoot, 'references'), { recursive: true });
  await writeFile(
    path.join(skillRoot, 'SKILL.md'),
    `---\nname: ${skill.name}\n---\n\n# ${plugin.displayName}\n\nRead [setup](references/setup.md).\n`
  );
  await writeFile(path.join(skillRoot, 'references', 'setup.md'), `# ${plugin.displayName} Setup\n`);
  const inspection = await inspectSkillTree(skillRoot);
  return { inspection, skillRoot };
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

function configureSyntheticSevenSkills(pluginsConfig, lockConfig) {
  for (const plugin of pluginsConfig.plugins) {
    plugin.skills = syntheticSkillKinds.map((kind, order) => ({
      directory: `${plugin.name}-${kind}`,
      id: `${plugin.name}-${kind}`,
      name: `${plugin.name}-${kind}`,
      order,
      owner: plugin.name,
      sourcePath: `skills/${plugin.name}/${kind}`
    }));
    const lock = lockConfig.sources.find((candidate) => candidate.name === plugin.name);
    lock.skills = plugin.skills.map((skill) => ({
      directory: skill.directory,
      id: skill.id,
      name: skill.name,
      order: skill.order,
      owner: skill.owner,
      source: {
        path: skill.sourcePath,
        repository: 'https://github.com/primefaces/primeui-plugins',
        treeHash: null
      }
    }));
  }
}

function configureSingleSkills(pluginsConfig, lockConfig) {
  for (const plugin of pluginsConfig.plugins) {
    plugin.skills = [{
      directory: plugin.name,
      id: plugin.name,
      name: plugin.name,
      order: 0,
      owner: plugin.name,
      sourcePath: `skills/${plugin.name}`
    }];
    const lock = lockConfig.sources.find((candidate) => candidate.name === plugin.name);
    lock.skills = plugin.skills.map((skill) => ({
      directory: skill.directory,
      id: skill.id,
      name: skill.name,
      order: skill.order,
      owner: skill.owner,
      source: {
        path: skill.sourcePath,
        repository: 'https://github.com/primefaces/primeui-plugins',
        treeHash: null
      }
    }));
  }
}

async function createGeneratorFixture(context, { oneSkill = false, sevenSkills = false } = {}) {
  const temporaryRoot = await realpath(os.tmpdir());
  const root = await mkdtemp(path.join(temporaryRoot, 'primeui-generator-test-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const distributionRoot = path.join(root, 'distribution');
  await mkdir(path.join(distributionRoot, 'config'), { recursive: true });

  const pluginsConfig = await readJson('config/plugins.json');
  const lockConfig = await readJson('config/sources.lock.json');
  if (sevenSkills) {
    configureSyntheticSevenSkills(pluginsConfig, lockConfig);
  } else if (oneSkill) {
    configureSingleSkills(pluginsConfig, lockConfig);
  }
  for (const plugin of pluginsConfig.plugins) {
    const lock = lockConfig.sources.find((candidate) => candidate.name === plugin.name);
    for (const skill of plugin.skills) {
      const fixture = await createCanonicalSkill(distributionRoot, plugin, skill);
      lock.skills.find((candidate) => candidate.id === skill.id).source.treeHash = fixture.inspection.hash;
    }
  }

  await writeFile(
    path.join(distributionRoot, 'config', 'plugins.json'),
    stableStringify(pluginsConfig)
  );
  await writeFile(
    path.join(distributionRoot, 'config', 'sources.lock.json'),
    stableStringify(lockConfig)
  );

  return { distributionRoot, lockConfig, pluginsConfig };
}

test('generation is deterministic, atomic before replacement, and cleans stale output', async (context) => {
  const fixture = await createGeneratorFixture(context);
  const beforeInjectedFirstInstall = await listSnapshotFiles(fixture.distributionRoot);
  await assert.rejects(
    syncDistribution({
      check: false,
      replacementOptions: { renameEntry: failRenameAt(2) },
      repositoryRoot: fixture.distributionRoot
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
    repositoryRoot: fixture.distributionRoot
  });
  assert.equal(first.stale, true);
  assert.equal(first.added.length, 39);

  const afterFirst = await listSnapshotFiles(fixture.distributionRoot);
  const second = await syncDistribution({
    check: false,
    repositoryRoot: fixture.distributionRoot
  });
  assert.deepEqual(second, { added: [], changed: [], removed: [], stale: false });
  const afterSecond = await listSnapshotFiles(fixture.distributionRoot);
  assertSnapshotsEqual(afterFirst, afterSecond);

  const checkBefore = await listSnapshotFiles(fixture.distributionRoot);
  const freshCheck = await syncDistribution({
    check: true,
    repositoryRoot: fixture.distributionRoot
  });
  assert.equal(freshCheck.stale, false);
  assertSnapshotsEqual(checkBefore, await listSnapshotFiles(fixture.distributionRoot));

  const changedPath = path.join(fixture.distributionRoot, 'plugins', 'primevue', '.mcp.json');
  const missingPath = path.join(fixture.distributionRoot, 'plugins', 'primeng', 'provenance.json');
  const stalePath = path.join(fixture.distributionRoot, 'plugins', 'primereact', 'stale.txt');
  await appendFile(changedPath, 'stale\n');
  await unlink(missingPath);
  await writeFile(stalePath, 'stale\n');

  const staleBefore = await listSnapshotFiles(fixture.distributionRoot);
  const sourceSkillPath = path.join(
    fixture.distributionRoot,
    ...fixture.pluginsConfig.plugins[0].skills[0].sourcePath.split('/'),
    'SKILL.md'
  );
  const sourceSkillBeforePreflightMutation = await readFile(sourceSkillPath);
  await assert.rejects(
    syncDistribution({
      check: false,
      replacementOptions: {
        beforeMutation: () => appendFile(sourceSkillPath, 'changed during preflight\n')
      },
      repositoryRoot: fixture.distributionRoot
    }),
    /Canonical skill source changed during generation/
  );
  await writeFile(sourceSkillPath, sourceSkillBeforePreflightMutation);
  assertSnapshotsEqual(staleBefore, await listSnapshotFiles(fixture.distributionRoot));
  await assertNoStagingDirectories(fixture.distributionRoot);

  await assert.rejects(
    syncDistribution({
      check: false,
      replacementOptions: { renameEntry: failRenameAt(2) },
      repositoryRoot: fixture.distributionRoot
    }),
    /Injected rename failure/
  );
  assertSnapshotsEqual(staleBefore, await listSnapshotFiles(fixture.distributionRoot));
  await assertNoStagingDirectories(fixture.distributionRoot);

  await assert.rejects(
    syncDistribution({
      check: false,
      replacementOptions: { renameEntry: failRenameAt(6) },
      repositoryRoot: fixture.distributionRoot
    }),
    /Injected rename failure/
  );
  assertSnapshotsEqual(staleBefore, await listSnapshotFiles(fixture.distributionRoot));
  await assertNoStagingDirectories(fixture.distributionRoot);

  const staleCheck = await syncDistribution({
    check: true,
    repositoryRoot: fixture.distributionRoot
  });
  assert.deepEqual(staleCheck.added, ['plugins/primeng/provenance.json']);
  assert.deepEqual(staleCheck.changed, ['plugins/primevue/.mcp.json']);
  assert.deepEqual(staleCheck.removed, ['plugins/primereact/stale.txt']);
  assertSnapshotsEqual(staleBefore, await listSnapshotFiles(fixture.distributionRoot));

  const repaired = await syncDistribution({
    check: false,
    repositoryRoot: fixture.distributionRoot
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

  const cursorMarketplace = JSON.parse(
    await readFile(path.join(fixture.distributionRoot, '.cursor-plugin', 'marketplace.json'), 'utf8')
  );
  assert.deepEqual(
    cursorMarketplace.plugins.map((plugin) => plugin.source),
    ['./plugins/primevue', './plugins/primeng', './plugins/primereact']
  );
  const cursorManifest = JSON.parse(
    await readFile(
      path.join(fixture.distributionRoot, 'plugins', 'primevue', '.cursor-plugin', 'plugin.json'),
      'utf8'
    )
  );
  assert.equal(cursorManifest.skills, './skills/');
  assert.equal(cursorManifest.mcpServers, './.mcp.json');

  await appendFile(sourceSkillPath, 'dirty\n');
  const beforeRejectedGeneration = await listSnapshotFiles(fixture.distributionRoot);
  await assert.rejects(
    syncDistribution({
      check: false,
      repositoryRoot: fixture.distributionRoot
    }),
    /Skill hash mismatch for primevue/
  );
  assertSnapshotsEqual(beforeRejectedGeneration, await listSnapshotFiles(fixture.distributionRoot));
});

test('synthetic seven-skill libraries generate exact ordered discovery for all four hosts', async (context) => {
  const fixture = await createGeneratorFixture(context, { sevenSkills: true });
  const first = await syncDistribution({ check: false, repositoryRoot: fixture.distributionRoot });
  assert.equal(first.stale, true);
  const firstSnapshot = await listSnapshotFiles(fixture.distributionRoot);
  const second = await syncDistribution({ check: false, repositoryRoot: fixture.distributionRoot });
  assert.deepEqual(second, { added: [], changed: [], removed: [], stale: false });
  assertSnapshotsEqual(firstSnapshot, await listSnapshotFiles(fixture.distributionRoot));

  for (const plugin of fixture.pluginsConfig.plugins) {
    const lock = fixture.lockConfig.sources.find((candidate) => candidate.name === plugin.name);
    const expected = configuredSkillContracts(plugin, lock);
    const pluginRoot = path.join(fixture.distributionRoot, plugin.outputs.plugin);
    const skillsRoot = path.join(pluginRoot, 'skills');
    for (const host of ['Claude', 'Codex', 'Gemini', 'Cursor']) {
      assert.deepEqual(
        await assertPhysicalSkillInventory(skillsRoot, expected, `${plugin.name}/${host}`),
        expected.map((skill) => skill.directory)
      );
    }
    const mcp = JSON.parse(await readFile(path.join(pluginRoot, '.mcp.json'), 'utf8'));
    const gemini = JSON.parse(await readFile(path.join(pluginRoot, 'gemini-extension.json'), 'utf8'));
    for (const servers of [mcp.mcpServers, gemini.mcpServers]) {
      assert.deepEqual(Object.keys(servers), [plugin.name]);
      assert.deepEqual(servers[plugin.name], {
        args: ['-y', `${lock.mcp.package}@${lock.mcp.version}`],
        command: 'npx'
      });
    }
    const provenance = JSON.parse(await readFile(path.join(pluginRoot, 'provenance.json'), 'utf8'));
    assert.deepEqual(provenance.skills, lock.skills);
    assert.deepEqual(provenance.skills.map((skill) => skill.order), [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(provenance.skills.every((skill) => skill.owner === plugin.name), true);
    for (const foreign of ['primevue', 'primeng', 'primereact'].filter((name) => name !== plugin.name)) {
      assert.equal(provenance.skills.some((skill) => skill.owner === foreign), false);
    }
  }

  const hashesBeforeReorder = new Map(
    fixture.lockConfig.sources.flatMap((lock) =>
      lock.skills.map((skill) => [`${lock.name}/${skill.id}`, skill.source.treeHash])
    )
  );
  for (const plugin of fixture.pluginsConfig.plugins) {
    plugin.skills.reverse().forEach((skill, order) => { skill.order = order; });
    const lock = fixture.lockConfig.sources.find((candidate) => candidate.name === plugin.name);
    lock.skills.reverse().forEach((skill, order) => { skill.order = order; });
  }
  await writeFile(path.join(fixture.distributionRoot, 'config', 'plugins.json'), stableStringify(fixture.pluginsConfig));
  await writeFile(path.join(fixture.distributionRoot, 'config', 'sources.lock.json'), stableStringify(fixture.lockConfig));
  const reordered = await syncDistribution({ check: false, repositoryRoot: fixture.distributionRoot });
  assert.equal(reordered.stale, true);
  assert.deepEqual(reordered.changed, [
    'plugins/primeng/provenance.json',
    'plugins/primereact/provenance.json',
    'plugins/primevue/provenance.json'
  ]);
  for (const lock of fixture.lockConfig.sources) {
    const provenance = JSON.parse(
      await readFile(path.join(fixture.distributionRoot, 'plugins', lock.name, 'provenance.json'), 'utf8')
    );
    assert.deepEqual(provenance.skills.map((skill) => skill.id), lock.skills.map((skill) => skill.id));
    for (const skill of lock.skills) {
      assert.equal(skill.source.treeHash, hashesBeforeReorder.get(`${lock.name}/${skill.id}`));
    }
  }
});

test('one-skill compatibility layout migrates without fallback copies and rolls back atomically', async (context) => {
  const fixture = await createGeneratorFixture(context, { oneSkill: true });
  await syncDistribution({ check: false, repositoryRoot: fixture.distributionRoot });
  const oldGenerated = path.join(fixture.distributionRoot, 'plugins', 'primevue', 'skills', 'primevue');
  await access(oldGenerated);

  configureSyntheticSevenSkills(fixture.pluginsConfig, fixture.lockConfig);
  for (const plugin of fixture.pluginsConfig.plugins) {
    const lock = fixture.lockConfig.sources.find((candidate) => candidate.name === plugin.name);
    for (const skill of plugin.skills) {
      const created = await createCanonicalSkill(fixture.distributionRoot, plugin, skill);
      lock.skills.find((candidate) => candidate.id === skill.id).source.treeHash = created.inspection.hash;
    }
  }
  await writeFile(path.join(fixture.distributionRoot, 'config', 'plugins.json'), stableStringify(fixture.pluginsConfig));
  await writeFile(path.join(fixture.distributionRoot, 'config', 'sources.lock.json'), stableStringify(fixture.lockConfig));

  const beforeMigration = await listSnapshotFiles(fixture.distributionRoot);
  await assert.rejects(
    syncDistribution({
      check: false,
      replacementOptions: { renameEntry: failRenameAt(6) },
      repositoryRoot: fixture.distributionRoot
    }),
    /Injected rename failure/
  );
  assertSnapshotsEqual(beforeMigration, await listSnapshotFiles(fixture.distributionRoot));
  await access(oldGenerated);

  await syncDistribution({ check: false, repositoryRoot: fixture.distributionRoot });
  await assert.rejects(access(oldGenerated));
  await assertPhysicalSkillInventory(
    path.join(fixture.distributionRoot, 'plugins', 'primevue', 'skills'),
    configuredSkillContracts(fixture.pluginsConfig.plugins[0], fixture.lockConfig.sources[0]),
    'primevue migrated payload'
  );
});
