import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectSkillTree } from '../scripts/lib/skill-tree.mjs';
import { runCommand } from '../scripts/lib/process.mjs';
import {
  assertGeminiRuntimeSkillInventory,
  assertInstalledGeminiPayload,
  geminiScenarioEnvironment,
  parseGeminiSmokeArguments,
  sanitizeGeminiProcessEnvironment
} from '../scripts/lib/gemini-smoke.mjs';
import { configuredSkillContracts } from '../scripts/lib/smoke-contracts.mjs';
import { repositoryRoot } from '../scripts/lib/repository.mjs';
import { configuredPluginFixture, installedPayloadContract } from './helpers/plugin-contract-fixtures.mjs';

const orderedPrimeVueSkills = [
  'primevue-router',
  'primevue-component-implementation',
  'primevue-setup-installation',
  'primevue-theming-customization',
  'primevue-accessibility-icons',
  'primevue-migration',
  'primevue-audit-troubleshooting'
];

test('Gemini runtime skill discovery is exact-set and order-neutral', () => {
  const expected = orderedPrimeVueSkills.map((name) => ({ name }));
  const shuffled = [
    'primevue-theming-customization',
    'primevue-setup-installation',
    'primevue-router',
    'primevue-migration',
    'primevue-component-implementation',
    'primevue-audit-troubleshooting',
    'primevue-accessibility-icons'
  ].map((name) => ({ name }));

  assert.deepEqual(
    assertGeminiRuntimeSkillInventory(shuffled, expected, 'primevue'),
    shuffled.map((skill) => skill.name)
  );
  assert.throws(
    () => assertGeminiRuntimeSkillInventory(shuffled.slice(1), expected, 'primevue'),
    /missing skills: primevue-theming-customization/
  );
  assert.throws(
    () => assertGeminiRuntimeSkillInventory([...shuffled, shuffled[0]], expected, 'primevue'),
    /duplicate skills: primevue-theming-customization/
  );
  assert.throws(
    () => assertGeminiRuntimeSkillInventory([...shuffled, { name: 'primeng-router' }], expected, 'primevue'),
    /foreign skills: primeng-router/
  );
});

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
      sources: ['local', 'export', 'github']
    }
  );
  assert.throws(() => parseGeminiSmokeArguments(['--library', 'primeui']), /must be all or one/);
  assert.throws(() => parseGeminiSmokeArguments(['--source', 'url']), /all, local, export, or github/);
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
  const sourcePath = path.join(root, 'persistent-source', 'plugins', 'primevue');
  const installPath = path.join(geminiHome, 'extensions', 'primevue');
  await mkdir(path.join(sourcePath, 'skills', 'primevue'), { recursive: true });
  await mkdir(path.join(installPath, 'skills', 'primevue'), { recursive: true });
  await writeFile(
    path.join(installPath, 'gemini-extension.json'),
    JSON.stringify({
      mcpServers: configuredPluginFixture().mcpDocument.mcpServers,
      name: 'primevue',
      version: '1.0.0'
    })
  );
  await writeFile(
    path.join(installPath, '.gemini-extension-install.json'),
    JSON.stringify({ source: sourcePath, type: 'local' })
  );
  await writeFile(
    path.join(installPath, 'skills', 'primevue', 'SKILL.md'),
    '---\nname: primevue\ndescription: Test\n---\n'
  );
  const treeHash = (await inspectSkillTree(path.join(installPath, 'skills', 'primevue'))).hash;
  const lockedSkills = [{
    directory: 'primevue', id: 'primevue', name: 'primevue', order: 0, owner: 'primevue',
    source: { path: 'skills/primevue', repository: 'https://github.com/primefaces/primeui-plugins', treeHash }
  }];
  const configured = configuredPluginFixture();
  await writeFile(
    path.join(installPath, 'provenance.json'),
    JSON.stringify({
      mcp: configured.provenanceMcp,
      name: 'primevue',
      skills: lockedSkills
    })
  );

  const contract = installedPayloadContract({
    skills: [{ directory: 'primevue', id: 'primevue', name: 'primevue', order: 0, owner: 'primevue', treeHash }],
    lockedSkills
  });
  await assert.doesNotReject(
    assertInstalledGeminiPayload({ contract, geminiHome, installPath, library: 'primevue', sourcePath })
  );

  await mkdir(path.join(geminiHome, 'extensions', 'primeng'), { recursive: true });
  await assert.rejects(
    assertInstalledGeminiPayload({ contract, geminiHome, installPath, library: 'primevue', sourcePath }),
    /must contain only the selected library/
  );
});

test('installed Gemini payload preserves approved PrimeVue order, independent hashes, and MCP range', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'primeui-gemini-focused-payload-test-'));
  context.after(() => rm(root, { force: true, recursive: true }));
  const geminiHome = path.join(root, 'home', '.gemini');
  const sourcePath = path.join(repositoryRoot, 'plugins', 'primevue');
  const installPath = path.join(geminiHome, 'extensions', 'primevue');
  await mkdir(path.dirname(installPath), { recursive: true });
  await cp(sourcePath, installPath, { recursive: true });
  await writeFile(
    path.join(installPath, '.gemini-extension-install.json'),
    JSON.stringify({ source: sourcePath, type: 'local' })
  );

  const [pluginsConfig, lockConfig] = await Promise.all([
    readFile(path.join(repositoryRoot, 'config', 'plugins.json'), 'utf8').then(JSON.parse),
    readFile(path.join(repositoryRoot, 'config', 'sources.lock.json'), 'utf8').then(JSON.parse)
  ]);
  const plugin = pluginsConfig.plugins.find((candidate) => candidate.name === 'primevue');
  const lock = lockConfig.sources.find((candidate) => candidate.name === 'primevue');
  const contract = {
    ...installedPayloadContract({
      lockedSkills: lock.skills,
      pluginVersion: lock.pluginVersion,
      skills: configuredSkillContracts(plugin, lock)
    }),
  };
  const validate = () => assertInstalledGeminiPayload({
    contract,
    geminiHome,
    installPath,
    library: 'primevue',
    sourcePath
  });

  assert.deepEqual(contract.skills.map((skill) => skill.name), orderedPrimeVueSkills);
  assert.equal(new Set(contract.skills.map((skill) => skill.treeHash)).size, 7);
  await assert.doesNotReject(validate());

  const provenancePath = path.join(installPath, 'provenance.json');
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  provenance.skills = [provenance.skills[1], provenance.skills[0], ...provenance.skills.slice(2)];
  await writeFile(provenancePath, JSON.stringify(provenance));
  await assert.rejects(validate(), /provenance skill inventory does not match/);
  await writeFile(
    provenancePath,
    await readFile(path.join(sourcePath, 'provenance.json'), 'utf8')
  );

  const skillPath = path.join(installPath, 'skills', 'primevue-router', 'SKILL.md');
  const skillContent = await readFile(skillPath, 'utf8');
  await writeFile(skillPath, `${skillContent}\nchanged\n`);
  await assert.rejects(validate(), /skill hash does not match/);
  await writeFile(skillPath, skillContent);

  const manifestPath = path.join(installPath, 'gemini-extension.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.mcpServers.primevue.args = ['-y', '@primevue/mcp@wrong'];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(validate(), /MCP package range does not match/);
});
