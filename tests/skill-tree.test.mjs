import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  computeSkillTreeHash,
  inspectSkillTree,
  normalizeSkillTreeRecords,
  serializeSkillTreeRecords
} from '../scripts/lib/skill-tree.mjs';

const abcDigest = createHash('sha256').update('abc').digest('hex');

test('skill-tree hashing has stable known vectors', () => {
  assert.equal(
    computeSkillTreeHash([]),
    'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
  );
  assert.equal(
    computeSkillTreeHash([{ path: 'SKILL.md', size: 3, sha256: abcDigest }]),
    'sha256:62e37381dc38a63bfb410532528e84c2bec61906254d462c6943b21ce63d15ae'
  );
  assert.equal(
    serializeSkillTreeRecords([{ path: 'SKILL.md', size: 3, sha256: abcDigest }]),
    `[{"path":"SKILL.md","size":3,"sha256":"${abcDigest}"}]`
  );
});

test('skill-tree record order does not affect the hash', () => {
  const records = [
    { path: 'references/setup.md', size: 1, sha256: 'b'.repeat(64) },
    { path: 'SKILL.md', size: 2, sha256: 'a'.repeat(64) }
  ];
  assert.equal(computeSkillTreeHash(records), computeSkillTreeHash([...records].reverse()));
  assert.deepEqual(
    normalizeSkillTreeRecords(records).map((record) => record.path),
    ['SKILL.md', 'references/setup.md']
  );
});

test('content, filename, and path changes alter the skill-tree hash', () => {
  const baseline = [{ path: 'SKILL.md', size: 3, sha256: abcDigest }];
  const contentChange = [{ path: 'SKILL.md', size: 3, sha256: 'a'.repeat(64) }];
  const filenameChange = [{ path: 'skill.md', size: 3, sha256: abcDigest }];
  const pathChange = [{ path: 'references/SKILL.md', size: 3, sha256: abcDigest }];

  const hashes = [baseline, contentChange, filenameChange, pathChange].map(computeSkillTreeHash);
  assert.equal(new Set(hashes).size, hashes.length);
});

test('duplicate, unsafe, and case-colliding records are rejected', () => {
  assert.throws(
    () =>
      computeSkillTreeHash([
        { path: 'SKILL.md', size: 1, sha256: 'a'.repeat(64) },
        { path: 'SKILL.md', size: 1, sha256: 'a'.repeat(64) }
      ]),
    /Duplicate normalized/
  );
  assert.throws(
    () =>
      computeSkillTreeHash([
        { path: 'References/setup.md', size: 1, sha256: 'a'.repeat(64) },
        { path: 'references/setup.md', size: 1, sha256: 'b'.repeat(64) }
      ]),
    /Case-colliding/
  );
  assert.throws(
    () =>
      computeSkillTreeHash([
        { path: 'References/one.md', size: 1, sha256: 'a'.repeat(64) },
        { path: 'references/two.md', size: 1, sha256: 'b'.repeat(64) }
      ]),
    /Case-colliding/
  );
  assert.throws(
    () =>
      computeSkillTreeHash([
        { path: 'references', size: 1, sha256: 'a'.repeat(64) },
        { path: 'references/setup.md', size: 1, sha256: 'b'.repeat(64) }
      ]),
    /both a file and a directory/
  );
  assert.throws(
    () => computeSkillTreeHash([{ path: '../SKILL.md', size: 1, sha256: 'a'.repeat(64) }]),
    /Unsafe or non-normalized/
  );
  assert.throws(
    () =>
      computeSkillTreeHash([
        { path: `references/re\u0301sume\u0301.md`, size: 1, sha256: 'a'.repeat(64) }
      ]),
    /Unsafe or non-normalized/
  );
});

test('physical skill-tree inspection rejects symlinks', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'primeui-skill-tree-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(path.join(root, 'references'));
  await writeFile(path.join(root, 'SKILL.md'), '---\nname: fixture\n---\n');
  await symlink('../SKILL.md', path.join(root, 'references', 'linked.md'));

  await assert.rejects(inspectSkillTree(root), /Symlinks are forbidden/);
});
