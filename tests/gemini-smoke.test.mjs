import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCommand } from '../scripts/lib/claude-smoke.mjs';
import {
  assertInstalledGeminiPayload,
  geminiScenarioEnvironment,
  parseGeminiSmokeArguments,
  sanitizeGeminiProcessEnvironment
} from '../scripts/lib/gemini-smoke.mjs';

test('Gemini smoke arguments use safe explicit matrix selectors', () => {
  assert.deepEqual(parseGeminiSmokeArguments([]), {
    keepTemp: false,
    libraries: ['primevue', 'primeng', 'primereact'],
    sources: ['local']
  });
  assert.deepEqual(
    parseGeminiSmokeArguments([
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
  assert.throws(() => parseGeminiSmokeArguments(['--library', 'primeui']), /must be all or one/);
  assert.throws(() => parseGeminiSmokeArguments(['--source', 'url']), /all, local, or github/);
  assert.throws(() => parseGeminiSmokeArguments(['--unknown']), /Unknown argument/);
});

test('Gemini scenario environment isolates all mutable client, npm, and Git state', () => {
  const root = path.join(os.tmpdir(), 'primeui-gemini-environment-test');
  const scenario = geminiScenarioEnvironment(root);

  assert.equal(scenario.geminiHome, path.join(root, 'home', '.gemini'));
  assert.equal(scenario.env.HOME, path.join(root, 'home'));
  assert.equal(scenario.env.GIT_CONFIG_GLOBAL, path.join(root, 'gitconfig'));
  assert.equal(scenario.env.GIT_CONFIG_NOSYSTEM, '1');
  assert.equal(scenario.env.GEMINI_CLI_NO_RELAUNCH, 'true');
  assert.equal(scenario.env.GEMINI_CLI_SYSTEM_SETTINGS_PATH, path.join(root, 'system-settings.json'));
  assert.equal(scenario.env.GEMINI_CLI_SYSTEM_DEFAULTS_PATH, path.join(root, 'system-defaults.json'));
  assert.equal(scenario.env.GEMINI_CLI_TRUSTED_FOLDERS_PATH, path.join(root, 'trusted-folders.json'));
  assert.equal(scenario.env.NPM_CONFIG_GLOBALCONFIG, path.join(root, 'npm-globalrc'));
  assert.equal(scenario.env.NPM_CONFIG_USERCONFIG, path.join(root, 'npmrc'));
  assert.equal(scenario.env.npm_config_cache, path.join(root, 'npm-cache'));
  assert.equal(scenario.env.XDG_CONFIG_HOME, path.join(root, 'xdg-config'));
  assert.equal(scenario.env.XDG_CACHE_HOME, path.join(root, 'xdg-cache'));
  assert.equal(scenario.env.XDG_DATA_HOME, path.join(root, 'xdg-data'));
  assert.equal(new Set([
    scenario.env.GIT_CONFIG_GLOBAL,
    scenario.env.HOME,
    scenario.env.NPM_CONFIG_GLOBALCONFIG,
    scenario.env.NPM_CONFIG_USERCONFIG,
    scenario.env.XDG_CONFIG_HOME,
    scenario.env.XDG_CACHE_HOME,
    scenario.env.XDG_DATA_HOME
  ]).size, 7);
});

test('Gemini scenario environment does not inherit credential-bearing variables', () => {
  const sanitized = sanitizeGeminiProcessEnvironment({
    DATABASE_URL: 'postgres://secret',
    GEMINI_API_KEY: 'gemini-secret',
    GIT_ASKPASS: '/tmp/askpass',
    GOOGLE_APPLICATION_CREDENTIALS: '/real/google-credentials.json',
    HTTP_PROXY: 'http://proxy.example',
    HTTPS_PROXY: 'https://proxy-user:proxy-password@proxy.example',
    NPM_TOKEN: 'npm-secret',
    npm_config_authToken: 'npm-config-secret',
    PATH: '/usr/bin',
    SSH_AUTH_SOCK: '/tmp/agent.sock'
  });

  assert.deepEqual(sanitized, {
    HTTP_PROXY: 'http://proxy.example',
    PATH: '/usr/bin'
  });
});

test('shared command runner can provide explicit bounded stdin', async () => {
  const result = await runCommand(
    process.execPath,
    ['-e', "process.stdin.setEncoding('utf8'); let value=''; process.stdin.on('data', chunk => value += chunk); process.stdin.on('end', () => process.stdout.write(value));"],
    { input: 'yes\n', timeoutMs: 2_000 }
  );
  assert.equal(result.stdout, 'yes');
});

test('shared command runner ignores EPIPE when an input child exits immediately', async () => {
  const result = await runCommand('/usr/bin/true', [], {
    input: 'x'.repeat(1024 * 1024),
    timeoutMs: 2_000
  });
  assert.equal(result.code, 0);
});

test('installed Gemini payload inspection enforces source, skill, MCP, and extension isolation', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'primeui-gemini-payload-test-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const geminiHome = path.join(root, 'home', '.gemini');
  const sourcePath = path.join(root, 'persistent-source', 'gemini', 'primevue');
  const installPath = path.join(geminiHome, 'extensions', 'primevue');
  await mkdir(path.join(sourcePath, 'skills', 'primevue'), { recursive: true });
  await mkdir(path.join(installPath, 'skills', 'primevue'), { recursive: true });
  await writeFile(
    path.join(installPath, 'gemini-extension.json'),
    JSON.stringify({
      mcpServers: {
        primevue: { args: ['-y', '@primevue/mcp@5.0.0-rc.2'], command: 'npx' }
      },
      name: 'primevue',
      version: '0.1.0-alpha.0'
    })
  );
  await writeFile(
    path.join(installPath, '.gemini-extension-install.json'),
    JSON.stringify({ source: sourcePath, type: 'local' })
  );
  await writeFile(
    path.join(installPath, 'provenance.json'),
    JSON.stringify({
      mcp: { package: '@primevue/mcp', version: '5.0.0-rc.2' },
      name: 'primevue'
    })
  );
  await writeFile(
    path.join(installPath, 'skills', 'primevue', 'SKILL.md'),
    '---\nname: primevue\ndescription: Test\n---\n'
  );

  const contract = {
    mcpPackage: '@primevue/mcp',
    mcpVersion: '5.0.0-rc.2',
    pluginVersion: '0.1.0-alpha.0'
  };
  await assert.doesNotReject(
    assertInstalledGeminiPayload({ contract, geminiHome, installPath, library: 'primevue', sourcePath })
  );

  await mkdir(path.join(geminiHome, 'extensions', 'primeng'), { recursive: true });
  await assert.rejects(
    assertInstalledGeminiPayload({ contract, geminiHome, installPath, library: 'primevue', sourcePath }),
    /must contain only the selected library/
  );
});
