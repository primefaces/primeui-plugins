import assert from 'node:assert/strict';
import { appendFile, cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  generatedRoots,
  validateGeneratedPayload
} from '../scripts/lib/generated-validation.mjs';
import { repositoryRoot } from '../scripts/lib/repository.mjs';

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
}

const [pluginsConfig, lockConfig] = await Promise.all([
  readJson('config/plugins.json'),
  readJson('config/sources.lock.json')
]);

async function copyGeneratedPayload(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'primeui-generated-validation-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  for (const generatedRoot of generatedRoots) {
    const destination = path.join(root, ...generatedRoot.split('/'));
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(repositoryRoot, ...generatedRoot.split('/')), destination, { recursive: true });
  }
  return root;
}

test('committed generated payload has exact structure, provenance, pins, and isolation', async () => {
  assert.deepEqual(await validateGeneratedPayload(repositoryRoot, pluginsConfig, lockConfig), []);

  for (const lock of lockConfig.sources) {
    const mcp = JSON.parse(
      await readFile(path.join(repositoryRoot, 'plugins', lock.name, '.mcp.json'), 'utf8')
    );
    assert.deepEqual(Object.keys(mcp.mcpServers), [lock.name]);
    assert.deepEqual(mcp.mcpServers[lock.name], {
      args: ['-y', `${lock.mcp.package}@${lock.mcp.version}`],
      command: 'npx'
    });

    const provenance = JSON.parse(
      await readFile(path.join(repositoryRoot, 'plugins', lock.name, 'provenance.json'), 'utf8')
    );
    assert.deepEqual(provenance.skills, lock.skills);
    assert.equal(
      provenance.skills.every((skill) => !Object.hasOwn(skill.source, 'commit')),
      true
    );
    assert.equal(
      provenance.skills.every((skill) => skill.source.repository === 'https://github.com/primefaces/primeui-plugins'),
      true
    );
    assert.equal(provenance.mcp.package, lock.mcp.package);
    assert.equal(provenance.mcp.version, lock.mcp.version);

    const cursorManifest = JSON.parse(
      await readFile(
        path.join(repositoryRoot, 'plugins', lock.name, '.cursor-plugin', 'plugin.json'),
        'utf8'
      )
    );
    assert.equal(cursorManifest.name, lock.name);
    assert.equal(cursorManifest.skills, './skills/');
    assert.equal(cursorManifest.mcpServers, './.mcp.json');
  }
});

test('generated validation rejects stale files and public-boundary violations', async (context) => {
  const root = await copyGeneratedPayload(context);
  const tamperedSkill = path.join(
    root,
    'plugins',
    'primevue',
    'skills',
    'primevue-component-implementation',
    'SKILL.md'
  );
  const internalLookingWorkItem = 'TASK-999';
  const localPath = ['/Us', 'ers/example/private'].join('');
  await appendFile(
    tamperedSkill,
    `\n[broken](missing.md) primeng/button ${localPath} ${internalLookingWorkItem} npm_${'a'.repeat(40)}\n`
  );
  await writeFile(path.join(root, 'plugins', 'primevue', 'stale.json'), '{}\n');

  const errors = (await validateGeneratedPayload(root, pluginsConfig, lockConfig)).join('\n');
  assert.match(errors, /foreign library package guidance/);
  assert.match(errors, /broken or escaping relative link/);
  assert.match(errors, /internal-looking work item identifier/);
  assert.match(errors, /local absolute path/);
  assert.match(errors, /possible npm access token/);
  assert.match(errors, /stale\.json: unexpected generated payload file/);
});
