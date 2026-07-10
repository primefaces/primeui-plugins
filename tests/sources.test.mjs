import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { completeSourceLock } from '../scripts/lib/locking.mjs';
import { inspectSkillTree } from '../scripts/lib/skill-tree.mjs';
import { inspectSourceRepositories, parseSourceArguments } from '../scripts/lib/sources.mjs';

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

async function createSourceRepository() {
  const temporaryRoot = await realpath(os.tmpdir());
  const repositoryPath = await mkdtemp(path.join(temporaryRoot, 'primeui-source-test-'));
  const skillPath = 'packages/skills/primevue';
  const skillRoot = path.join(repositoryPath, ...skillPath.split('/'));
  await mkdir(path.join(skillRoot, 'references'), { recursive: true });
  await writeFile(path.join(repositoryPath, '.gitignore'), '*.ignored\n');
  await writeFile(path.join(skillRoot, 'SKILL.md'), '---\nname: primevue\n---\n');
  await writeFile(path.join(skillRoot, 'references', 'setup.md'), '# Setup\n');
  git(repositoryPath, ['init', '--quiet']);
  git(repositoryPath, ['add', '.']);
  git(repositoryPath, ['commit', '--quiet', '-m', 'fixture']);
  const commit = git(repositoryPath, ['rev-parse', 'HEAD']);
  return { commit, repositoryPath, skillPath, skillRoot };
}

function fixtureConfiguration(commit, skillPath) {
  return {
    lockConfig: {
      sources: [
        {
          lockState: 'unresolved',
          mcp: { package: '@primevue/mcp', version: '5.0.0-rc.2' },
          name: 'primevue',
          pluginVersion: '0.1.0-alpha.0',
          source: {
            commit,
            repository: 'https://github.com/primefaces/primevue-nextchapter.git',
            skillHash: null,
            skillPath
          },
          unresolvedReason: 'Hash pending.'
        }
      ]
    },
    pluginsConfig: {
      plugins: [{ name: 'primevue', skillSourcePath: skillPath }]
    }
  };
}

test('source argument parsing rejects missing, duplicate, and unknown sources', () => {
  assert.throws(() => parseSourceArguments([], ['primevue']), /Missing source path/);
  assert.throws(
    () =>
      parseSourceArguments(
        ['--source', 'primevue=/tmp/one', '--source', 'primevue=/tmp/two'],
        ['primevue']
      ),
    /Duplicate source path/
  );
  assert.throws(
    () => parseSourceArguments(['--source', 'unknown=/tmp/one'], ['primevue']),
    /Unknown source name/
  );
});

test('source verification rejects unsafe, missing, wrong-HEAD, dirty, and ignored extra files', async (context) => {
  const fixture = await createSourceRepository();
  context.after(() => rm(fixture.repositoryPath, { force: true, recursive: true }));
  const { lockConfig, pluginsConfig } = fixtureConfiguration(fixture.commit, fixture.skillPath);
  const sourcePaths = new Map([['primevue', fixture.repositoryPath]]);

  const indexPath = path.join(fixture.repositoryPath, '.git', 'index');
  const [indexBefore, indexStatsBefore] = await Promise.all([readFile(indexPath), stat(indexPath)]);
  const snapshots = await inspectSourceRepositories(pluginsConfig, lockConfig, sourcePaths);
  assert.equal(snapshots.get('primevue').commit, fixture.commit);
  const [indexAfter, indexStatsAfter] = await Promise.all([readFile(indexPath), stat(indexPath)]);
  assert.equal(indexBefore.equals(indexAfter), true);
  assert.equal(indexStatsBefore.mtimeMs, indexStatsAfter.mtimeMs);
  assert.equal(indexStatsBefore.ctimeMs, indexStatsAfter.ctimeMs);

  const duplicatePlugins = {
    plugins: [
      ...pluginsConfig.plugins,
      { name: 'primeng', skillSourcePath: fixture.skillPath }
    ]
  };
  const duplicateLocks = structuredClone(lockConfig);
  duplicateLocks.sources.push({
    ...structuredClone(lockConfig.sources[0]),
    name: 'primeng'
  });
  await assert.rejects(
    inspectSourceRepositories(
      duplicatePlugins,
      duplicateLocks,
      new Map([
        ['primevue', fixture.repositoryPath],
        ['primeng', fixture.repositoryPath]
      ])
    ),
    /resolve to the same path/
  );

  await assert.rejects(
    inspectSourceRepositories(
      pluginsConfig,
      lockConfig,
      new Map([['primevue', 'relative/repository']])
    ),
    /safe normalized absolute path/
  );
  await assert.rejects(
    inspectSourceRepositories(
      pluginsConfig,
      lockConfig,
      new Map([['primevue', path.join(fixture.repositoryPath, 'missing')]])
    ),
    /does not exist/
  );

  const wrongHead = structuredClone(lockConfig);
  wrongHead.sources[0].source.commit = '0'.repeat(40);
  await assert.rejects(
    inspectSourceRepositories(pluginsConfig, wrongHead, sourcePaths),
    /Source HEAD mismatch/
  );

  const skillFile = path.join(fixture.skillRoot, 'SKILL.md');
  const originalSkill = '---\nname: primevue\n---\n';
  await writeFile(skillFile, `${originalSkill}dirty\n`);
  await assert.rejects(
    inspectSourceRepositories(pluginsConfig, lockConfig, sourcePaths),
    /repository for primevue is dirty/
  );
  await writeFile(skillFile, originalSkill);

  const ignoredExtra = path.join(fixture.skillRoot, 'extra.ignored');
  await writeFile(ignoredExtra, 'not tracked\n');
  assert.equal(git(fixture.repositoryPath, ['status', '--porcelain=v1']), '');
  await assert.rejects(
    inspectSourceRepositories(pluginsConfig, lockConfig, sourcePaths),
    /does not match Git.*untracked physical files/
  );
  await unlink(ignoredExtra);
});

test('complete source-lock generation preserves authored fields and records verified hashes', async (context) => {
  const fixture = await createSourceRepository();
  context.after(() => rm(fixture.repositoryPath, { force: true, recursive: true }));
  const { lockConfig } = fixtureConfiguration(fixture.commit, fixture.skillPath);
  const inspection = await inspectSkillTree(fixture.skillRoot);
  const snapshots = new Map([['primevue', { inspection }]]);
  const completed = completeSourceLock(lockConfig, snapshots);

  assert.equal(completed.sources[0].lockState, 'locked');
  assert.equal(completed.sources[0].source.skillHash, inspection.hash);
  assert.equal(Object.hasOwn(completed.sources[0], 'unresolvedReason'), false);
  assert.equal(completed.sources[0].source.commit, fixture.commit);
  assert.equal(completed.sources[0].mcp.version, '5.0.0-rc.2');
  assert.equal(lockConfig.sources[0].lockState, 'unresolved');
});
