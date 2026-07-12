import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectSkillTree } from '../scripts/lib/skill-tree.mjs';
import {
  assertInstalledCodexPayload,
  codexScenarioEnvironment,
  parseCodexPluginListJson,
  parseCodexSmokeArguments,
  sanitizeCodexProcessEnvironment
} from '../scripts/lib/codex-smoke.mjs';

test('Codex smoke arguments use safe explicit matrix selectors', () => {
  assert.deepEqual(parseCodexSmokeArguments([]), {
    keepTemp: false,
    libraries: ['primevue', 'primeng', 'primereact'],
    sources: ['local']
  });
  assert.deepEqual(
    parseCodexSmokeArguments([
      '--library',
      'primereact',
      '--source',
      'all',
      '--keep-temp'
    ]),
    {
      keepTemp: true,
      libraries: ['primereact'],
      sources: ['local', 'github']
    }
  );
  assert.throws(() => parseCodexSmokeArguments(['--library', 'primeui']), /must be all or one/);
  assert.throws(() => parseCodexSmokeArguments(['--source', 'url']), /all, local, or github/);
  assert.throws(() => parseCodexSmokeArguments(['--unknown']), /Unknown argument/);
});

test('Codex scenario environment isolates every mutable client and npm location', () => {
  const root = path.join(os.tmpdir(), 'primeui-codex-environment-test');
  const scenario = codexScenarioEnvironment(root);

  assert.equal(scenario.codexHome, path.join(root, 'codex-home'));
  assert.equal(scenario.env.CODEX_HOME, scenario.codexHome);
  assert.equal(scenario.env.GIT_CONFIG_GLOBAL, path.join(root, 'gitconfig'));
  assert.equal(scenario.env.GIT_CONFIG_NOSYSTEM, '1');
  assert.equal(scenario.env.HOME, path.join(root, 'home'));
  assert.equal(scenario.env.XDG_CONFIG_HOME, path.join(root, 'xdg-config'));
  assert.equal(scenario.env.XDG_CACHE_HOME, path.join(root, 'xdg-cache'));
  assert.equal(scenario.env.npm_config_cache, path.join(root, 'npm-cache'));
  assert.equal(scenario.env.NPM_CONFIG_GLOBALCONFIG, path.join(root, 'npm-globalrc'));
  assert.equal(scenario.env.NPM_CONFIG_USERCONFIG, path.join(root, 'npmrc'));
  assert.equal(scenario.env.npm_config_globalconfig, path.join(root, 'npm-globalrc'));
  assert.equal(scenario.env.npm_config_userconfig, path.join(root, 'npmrc'));
  assert.equal(scenario.env.USERPROFILE, path.join(root, 'home'));
  assert.equal(new Set([
    scenario.codexHome,
    scenario.env.GIT_CONFIG_GLOBAL,
    scenario.env.HOME,
    scenario.env.XDG_CONFIG_HOME,
    scenario.env.XDG_CACHE_HOME,
    scenario.env.npm_config_cache,
    scenario.env.NPM_CONFIG_GLOBALCONFIG,
    scenario.env.NPM_CONFIG_USERCONFIG
  ]).size, 8);
});

test('Codex scenario environment does not inherit credential-bearing variables', () => {
  const sanitized = sanitizeCodexProcessEnvironment({
    DATABASE_URL: 'postgres://secret',
    GIT_ASKPASS: '/tmp/askpass',
    GIT_CONFIG_GLOBAL: '/real/gitconfig',
    HTTP_PROXY: 'http://proxy.example',
    NPM_CONFIG_GLOBALCONFIG: '/real/npmrc',
    NPM_TOKEN: 'npm-secret',
    npm_config_authToken: 'npm-config-secret',
    OPENAI_API_KEY: 'openai-secret',
    PATH: '/usr/bin',
    SSH_AUTH_SOCK: '/tmp/agent.sock'
  });

  assert.deepEqual(sanitized, {
    HTTP_PROXY: 'http://proxy.example',
    PATH: '/usr/bin'
  });
});

test('Codex plugin-list parser requires installed and available arrays', () => {
  assert.deepEqual(parseCodexPluginListJson('{"installed":[],"available":[]}'), {
    installed: [],
    available: []
  });
  assert.throws(() => parseCodexPluginListJson('[]'), /must return an object/);
  assert.throws(
    () => parseCodexPluginListJson('{"installed":[]}'),
    /available as an array/
  );
  assert.throws(() => parseCodexPluginListJson('not-json'), /not valid JSON/);
});

test('installed Codex payload inspection enforces manifest pointers, pin, and cache isolation', async (context) => {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'primeui-codex-payload-test-'));
  context.after(() => rm(codexHome, { force: true, recursive: true }));
  const installPath = path.join(
    codexHome,
    'plugins',
    'cache',
    'primeui',
    'primevue',
    '0.1.0-alpha.0'
  );
  await mkdir(path.join(installPath, '.codex-plugin'), { recursive: true });
  await mkdir(path.join(installPath, 'skills', 'primevue'), { recursive: true });
  await writeFile(
    path.join(installPath, '.codex-plugin', 'plugin.json'),
    JSON.stringify({
      mcpServers: './.mcp.json',
      name: 'primevue',
      skills: './skills/',
      version: '0.1.0-alpha.0'
    })
  );
  await writeFile(
    path.join(installPath, '.mcp.json'),
    JSON.stringify({
      mcpServers: {
        primevue: { args: ['-y', '@primevue/mcp@5.0.0-rc.2'], command: 'npx' }
      }
    })
  );
  await writeFile(
    path.join(installPath, 'skills', 'primevue', 'SKILL.md'),
    '---\nname: primevue\ndescription: Test\n---\n'
  );
  const treeHash = (await inspectSkillTree(path.join(installPath, 'skills', 'primevue'))).hash;

  const contract = {
    mcpPackage: '@primevue/mcp',
    mcpVersion: '5.0.0-rc.2',
    pluginVersion: '0.1.0-alpha.0',
    skills: [{ directory: 'primevue', id: 'primevue', name: 'primevue', order: 0, owner: 'primevue', treeHash }]
  };
  await assert.doesNotReject(
    assertInstalledCodexPayload({ codexHome, contract, installPath, library: 'primevue' })
  );

  await mkdir(path.join(codexHome, 'plugins', 'cache', 'primeui', 'primeng'), {
    recursive: true
  });
  await assert.rejects(
    assertInstalledCodexPayload({ codexHome, contract, installPath, library: 'primevue' }),
    /cache must contain only the selected library/
  );
});
