import assert from 'node:assert/strict';
import { access, lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildPublicDistribution,
  expectedPublicDistributionFiles,
  publicDistributionEntries
} from '../scripts/lib/public-distribution.mjs';
import { listRepositoryFiles, repositoryRoot } from '../scripts/lib/repository.mjs';

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

test('public distribution is exact, minimal, and deterministic', async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'primeui-public-test-'));
  context.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const firstRoot = path.join(temporaryRoot, 'first');
  const secondRoot = path.join(temporaryRoot, 'second');

  const first = await buildPublicDistribution({ destinationRoot: firstRoot, repositoryRoot });
  const second = await buildPublicDistribution({ destinationRoot: secondRoot, repositoryRoot });

  assert.deepEqual(first.files, await expectedPublicDistributionFiles(repositoryRoot));
  assert.deepEqual(second.files, first.files);
  assertSnapshotsEqual(await snapshot(firstRoot), await snapshot(secondRoot));
  assert.deepEqual(
    [...new Set(first.files.map((file) => file.split('/')[0]))].sort(),
    ['.agents', '.claude-plugin', '.cursor-plugin', '.github', 'README.md', 'plugins']
  );

  for (const forbidden of [
    '.gitignore',
    'RELEASE.md',
    'config',
    'docs',
    'evaluations',
    'package.json',
    'public',
    'scripts',
    'skills',
    'tests'
  ]) {
    await assert.rejects(access(path.join(firstRoot, forbidden)));
  }

  for (const entry of publicDistributionEntries.filter(({ source }) => source !== 'public/README.md')) {
    const source = path.join(repositoryRoot, ...entry.source.split('/'));
    const destination = path.join(firstRoot, ...entry.destination.split('/'));
    const sourceStat = await lstat(source);

    if (sourceStat.isFile()) {
      assert.equal((await readFile(source)).equals(await readFile(destination)), true, entry.destination);
      continue;
    }

    const sourceFiles = (await listRepositoryFiles(source)).map((file) => [
      file,
      path.join(source, ...file.split('/'))
    ]);

    for (const [relativePath, sourceFile] of sourceFiles) {
      assert.equal(
        (await readFile(sourceFile)).equals(
          await readFile(path.join(destination, ...relativePath.split('/')))
        ),
        true,
        entry.destination
      );
    }
  }
});

test('public distribution refuses repository and existing destinations', async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'primeui-public-guard-'));
  context.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const existing = path.join(temporaryRoot, 'existing');
  await mkdir(existing);

  await assert.rejects(
    buildPublicDistribution({
      destinationRoot: path.join(repositoryRoot, 'generated-public'),
      repositoryRoot
    }),
    /outside the development repository/
  );
  await assert.rejects(
    buildPublicDistribution({ destinationRoot: existing, repositoryRoot }),
    /destination already exists/
  );
});

test('promotion validates and promotes the same fixed dev commit', async () => {
  const promotion = await readFile(
    path.join(repositoryRoot, '.github/workflows/promote-main.yml'),
    'utf8'
  );
  const clientSmoke = await readFile(
    path.join(repositoryRoot, '.github/workflows/public-smoke.yml'),
    'utf8'
  );

  assert.match(promotion, /source-sha: \$\{\{ needs\.repository\.outputs\.source-sha \}\}/);
  assert.match(promotion, /ref: \$\{\{ env\.SOURCE_SHA \}\}/);
  assert.match(promotion, /git rev-parse origin\/dev/);
  assert.match(promotion, /git rm -r --ignore-unmatch \./);
  assert.match(promotion, /git push origin main/);
  assert.match(clientSmoke, /ref: \$\{\{ inputs\.source-sha \}\}/);
});
