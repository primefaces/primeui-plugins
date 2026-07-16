import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertCursorPayload,
  cursorScenarioEnvironment,
  parseCursorSmokeArguments,
  sanitizeCursorProcessEnvironment,
  validateCursorPluginManifest
} from '../scripts/lib/cursor-smoke.mjs';
import { inspectSkillTree } from '../scripts/lib/skill-tree.mjs';
import { configuredPluginFixture, installedPayloadContract } from './helpers/plugin-contract-fixtures.mjs';

test('Cursor smoke arguments use direct-payload and marketplace selectors', () => {
  assert.deepEqual(parseCursorSmokeArguments([]), {
    keepTemp: false,
    libraries: ['primevue', 'primeng', 'primereact'],
    sources: ['payload']
  });
  assert.deepEqual(
    parseCursorSmokeArguments([
      '--library',
      'primereact',
      '--source',
      'all',
      '--keep-temp'
    ]),
    {
      keepTemp: true,
      libraries: ['primereact'],
      sources: ['payload', 'marketplace']
    }
  );
  assert.throws(() => parseCursorSmokeArguments(['--library', 'primeui']), /must be all or one/);
  assert.throws(() => parseCursorSmokeArguments(['--source', 'github']), /payload, marketplace/);
  assert.throws(() => parseCursorSmokeArguments(['--unknown']), /Unknown argument/);
});

test('Cursor scenario environment isolates all modeled local, npm, Git, and XDG state', () => {
  const root = path.join(os.tmpdir(), 'primeui-cursor-environment-test');
  const scenario = cursorScenarioEnvironment(root);

  assert.equal(scenario.cursorHome, path.join(root, 'home', '.cursor'));
  assert.equal(scenario.localPluginsRoot, path.join(root, 'home', '.cursor', 'plugins', 'local'));
  assert.equal(scenario.env.HOME, path.join(root, 'home'));
  assert.equal(scenario.env.GIT_CONFIG_GLOBAL, path.join(root, 'gitconfig'));
  assert.equal(scenario.env.GIT_CONFIG_NOSYSTEM, '1');
  assert.equal(scenario.env.NPM_CONFIG_GLOBALCONFIG, path.join(root, 'npm-globalrc'));
  assert.equal(scenario.env.NPM_CONFIG_USERCONFIG, path.join(root, 'npmrc'));
  assert.equal(scenario.env.npm_config_cache, path.join(root, 'npm-cache'));
  assert.equal(scenario.env.TEMP, path.join(root, 'tmp'));
  assert.equal(scenario.env.TMP, path.join(root, 'tmp'));
  assert.equal(scenario.env.TMPDIR, path.join(root, 'tmp'));
  assert.equal(scenario.env.XDG_CONFIG_HOME, path.join(root, 'xdg-config'));
  assert.equal(scenario.env.XDG_CACHE_HOME, path.join(root, 'xdg-cache'));
});

test('Cursor scenario environment excludes credentials and every proxy value', () => {
  const sanitized = sanitizeCursorProcessEnvironment({
    ALL_PROXY: 'socks5://proxy.example',
    CURSOR_API_KEY: 'cursor-secret',
    DATABASE_URL: 'postgres://secret',
    GIT_ASKPASS: '/tmp/askpass',
    HTTP_PROXY: 'http://proxy.example',
    HTTPS_PROXY: 'https://proxy-user:proxy-password@proxy.example',
    NO_PROXY: 'localhost',
    NPM_TOKEN: 'npm-secret',
    npm_config_authToken: 'npm-config-secret',
    PATH: '/usr/bin',
    SSH_AUTH_SOCK: '/tmp/agent.sock'
  });

  assert.deepEqual(sanitized, { PATH: '/usr/bin' });
});

test('Cursor manifest validation follows the closed current official schema subset', () => {
  const manifest = {
    author: { name: 'PrimeFaces' },
    category: 'Developer Tools',
    description: 'PrimeVue workflow guidance.',
    displayName: 'PrimeVue',
    mcpServers: './.mcp.json',
    name: 'primevue',
    repository: 'https://github.com/primefaces/primeui-plugins',
    skills: './skills/',
    version: '1.0.0'
  };
  assert.equal(validateCursorPluginManifest(manifest, 'primevue'), manifest);
  assert.throws(
    () => validateCursorPluginManifest({ ...manifest, $schema: 'https://example.test' }, 'primevue'),
    /\$schema is not allowed/
  );
  assert.throws(
    () => validateCursorPluginManifest({ ...manifest, skills: '../skills' }, 'primevue'),
    /must point skills/
  );
});

test('Cursor payload inspection enforces exact manifest pointers, skill hash, MCP range, and isolation', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'primeui-cursor-payload-test-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(path.join(root, '.cursor-plugin'), { recursive: true });
  await mkdir(path.join(root, 'skills', 'primevue'), { recursive: true });
  await writeFile(
    path.join(root, '.cursor-plugin', 'plugin.json'),
    JSON.stringify({
      author: { name: 'PrimeFaces' },
      category: 'Developer Tools',
      description: 'PrimeVue workflow guidance.',
      displayName: 'PrimeVue',
      mcpServers: './.mcp.json',
      name: 'primevue',
      repository: 'https://github.com/primefaces/primeui-plugins',
      skills: './skills/',
      version: '1.0.0'
    })
  );
  await writeFile(
    path.join(root, '.mcp.json'),
    JSON.stringify(configuredPluginFixture().mcpDocument)
  );
  await writeFile(
    path.join(root, 'skills', 'primevue', 'SKILL.md'),
    '---\nname: primevue\ndescription: Test\n---\n'
  );
  const skillHash = (await inspectSkillTree(path.join(root, 'skills', 'primevue'))).hash;
  const lockedSkills = [{
    directory: 'primevue', id: 'primevue', name: 'primevue', order: 0, owner: 'primevue',
    source: { path: 'skills/primevue', repository: 'https://github.com/primefaces/primeui-plugins', treeHash: skillHash }
  }];
  const configured = configuredPluginFixture();
  await writeFile(
    path.join(root, 'provenance.json'),
    JSON.stringify({
      mcp: configured.provenanceMcp,
      name: 'primevue',
      pluginVersion: '1.0.0',
      skills: lockedSkills
    })
  );

  const contract = {
    description: 'PrimeVue workflow guidance.',
    displayName: 'PrimeVue',
    ...installedPayloadContract({
      lockedSkills,
      skills: [{ directory: 'primevue', id: 'primevue', name: 'primevue', order: 0, owner: 'primevue', treeHash: skillHash }]
    }),
    publisherName: 'PrimeFaces',
    repository: 'https://github.com/primefaces/primeui-plugins',
  };
  await assert.doesNotReject(
    assertCursorPayload({ contract, installPath: root, library: 'primevue' })
  );

  await mkdir(path.join(root, 'skills', 'primeng'), { recursive: true });
  await assert.rejects(
    assertCursorPayload({ contract, installPath: root, library: 'primevue' }),
    /skill inventory differs/
  );
});
