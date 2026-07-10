import { access, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readDistributionConfiguration } from './generator.mjs';
import { hasProcessTreeInspection, runCommand, smokeInstalledMcp } from './claude-smoke.mjs';

const geminiUsageContracts = {
  primeng: {
    validCode: '<p-button label="Save" severity="success" [disabled]="saving" />',
    invalidCode: '<p-button label="Save" [madeUp]="true" />'
  },
  primereact: {
    validCode: [
      "import { Button } from 'primereact/button';",
      '',
      'export function SaveAction() {',
      '  return <Button severity="success">Save</Button>;',
      '}'
    ].join('\n'),
    invalidCode: '<Button severity="success" madeUp>Save</Button>'
  },
  primevue: {
    validCode: '<Button label="Save" severity="success" :disabled="saving" />',
    invalidCode: '<Button label="Save" madeUp />'
  }
};

const libraryNames = ['primevue', 'primeng', 'primereact'];
const safeEnvironmentKeys = new Set([
  'CI',
  'COLORTERM',
  'COMSPEC',
  'CURL_CA_BUNDLE',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LOGNAME',
  'NODE_EXTRA_CA_CERTS',
  'NO_COLOR',
  'NO_PROXY',
  'NUMBER_OF_PROCESSORS',
  'OS',
  'PATH',
  'PATHEXT',
  'PROCESSOR_ARCHITECTURE',
  'REQUESTS_CA_BUNDLE',
  'SHELL',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'SYSTEMROOT',
  'TEMP',
  'TERM',
  'TMP',
  'TMPDIR',
  'USER',
  'WINDIR'
]);
const proxyEnvironmentKeys = new Set(['ALL_PROXY', 'HTTPS_PROXY', 'HTTP_PROXY']);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

export function parseGeminiSmokeArguments(argumentsList) {
  const options = {
    keepTemp: false,
    libraries: [...libraryNames],
    sources: ['local']
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--keep-temp') {
      options.keepTemp = true;
      continue;
    }
    if (argument === '--library') {
      const value = argumentsList[++index];
      if (value === 'all') {
        options.libraries = [...libraryNames];
      } else if (libraryNames.includes(value)) {
        options.libraries = [value];
      } else {
        fail(`--library must be all or one of ${libraryNames.join(', ')}.`);
      }
      continue;
    }
    if (argument === '--source') {
      const value = argumentsList[++index];
      if (value === 'all') {
        options.sources = ['local', 'github'];
      } else if (value === 'local' || value === 'github') {
        options.sources = [value];
      } else {
        fail('--source must be all, local, or github.');
      }
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }

  return options;
}

export function sanitizeGeminiProcessEnvironment(environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key, value]) => {
      const normalizedKey = key.toUpperCase();
      if (safeEnvironmentKeys.has(normalizedKey)) {
        return true;
      }
      if (!proxyEnvironmentKeys.has(normalizedKey) || typeof value !== 'string') {
        return false;
      }
      try {
        const proxy = new URL(value);
        return proxy.username === '' && proxy.password === '';
      } catch {
        return false;
      }
    })
  );
}

export function geminiScenarioEnvironment(root, environment = process.env) {
  const gitGlobalConfig = path.join(root, 'gitconfig');
  const geminiHome = path.join(root, 'home', '.gemini');
  const home = path.join(root, 'home');
  const npmCache = path.join(root, 'npm-cache');
  const npmGlobalConfig = path.join(root, 'npm-globalrc');
  const npmUserConfig = path.join(root, 'npmrc');
  const systemDefaults = path.join(root, 'system-defaults.json');
  const systemSettings = path.join(root, 'system-settings.json');
  const trustedFolders = path.join(root, 'trusted-folders.json');
  const workspace = path.join(home, 'workspace');
  const xdgCache = path.join(root, 'xdg-cache');
  const xdgConfig = path.join(root, 'xdg-config');
  const xdgData = path.join(root, 'xdg-data');
  return {
    env: {
      ...sanitizeGeminiProcessEnvironment(environment),
      GEMINI_CLI_NO_RELAUNCH: 'true',
      GEMINI_CLI_SYSTEM_DEFAULTS_PATH: systemDefaults,
      GEMINI_CLI_SYSTEM_SETTINGS_PATH: systemSettings,
      GEMINI_CLI_TRUSTED_FOLDERS_PATH: trustedFolders,
      GIT_CONFIG_GLOBAL: gitGlobalConfig,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      HOME: home,
      NPM_CONFIG_GLOBALCONFIG: npmGlobalConfig,
      NPM_CONFIG_USERCONFIG: npmUserConfig,
      USERPROFILE: home,
      XDG_CACHE_HOME: xdgCache,
      XDG_CONFIG_HOME: xdgConfig,
      XDG_DATA_HOME: xdgData,
      npm_config_cache: npmCache,
      npm_config_globalconfig: npmGlobalConfig,
      npm_config_userconfig: npmUserConfig
    },
    geminiHome,
    gitGlobalConfig,
    home,
    npmCache,
    npmGlobalConfig,
    npmUserConfig,
    systemDefaults,
    systemSettings,
    trustedFolders,
    workspace,
    xdgCache,
    xdgConfig,
    xdgData
  };
}

async function createScenarioRoot(prefix) {
  assert(
    hasProcessTreeInspection(),
    'Gemini validation requires process-tree inspection so timed-out descendants cannot escape cleanup.'
  );
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  const directories = geminiScenarioEnvironment(root);
  await Promise.all(
    [
      directories.geminiHome,
      directories.npmCache,
      directories.workspace,
      directories.xdgCache,
      directories.xdgConfig,
      directories.xdgData
    ].map((directory) => mkdir(directory, { recursive: true }))
  );
  await Promise.all([
    writeFile(directories.gitGlobalConfig, ''),
    writeFile(directories.npmGlobalConfig, ''),
    writeFile(directories.npmUserConfig, ''),
    writeFile(directories.systemDefaults, '{}\n'),
    writeFile(directories.systemSettings, '{}\n'),
    writeFile(directories.trustedFolders, '{}\n'),
    writeFile(path.join(directories.geminiHome, 'sentinel.txt'), 'preserve\n'),
    writeFile(
      path.join(directories.geminiHome, 'settings.json'),
      `${JSON.stringify(
        {
          experimental: { extensionManagement: true },
          security: {
            auth: { useExternal: true },
            folderTrust: { enabled: false }
          },
          telemetry: { enabled: false }
        },
        null,
        2
      )}\n`
    )
  ]);
  return { ...directories, root };
}

async function runGemini(scenario, argumentsList, options = {}) {
  return runCommand('gemini', argumentsList, {
    cwd: options.cwd ?? scenario.workspace,
    env: scenario.env,
    input: options.input,
    timeoutMs: options.timeoutMs
  });
}

function combinedOutput(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

function parseJsonOutput(result, label) {
  const output = combinedOutput(result);
  try {
    return JSON.parse(output);
  } catch (error) {
    fail(`${label} did not return valid JSON: ${error.message}\n${output}`);
  }
}

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function installedExtensions(scenario) {
  const result = await runGemini(scenario, ['extensions', 'list', '--output-format', 'json']);
  const extensions = parseJsonOutput(result, 'gemini extensions list --output-format json');
  assert(Array.isArray(extensions), 'Gemini extension list must return an array.');
  return extensions;
}

async function assertOneExtension(scenario, contract, library, expectedActive) {
  const extensions = await installedExtensions(scenario);
  assert(extensions.length === 1, `${library}: expected exactly one installed Gemini extension.`);
  const extension = extensions[0];
  assert(extension.name === library, `${library}: installed Gemini extension name does not match.`);
  assert(extension.version === contract.pluginVersion, `${library}: installed Gemini version does not match.`);
  assert(extension.isActive === expectedActive, `${library}: Gemini enabled state does not match.`);
  assert(
    Array.isArray(extension.skills) &&
      extension.skills.length === 1 &&
      extension.skills[0].name === library,
    `${library}: Gemini must discover exactly one matching extension skill.`
  );
  assert(
    Object.keys(extension.mcpServers ?? {}).length === 1 &&
      Object.hasOwn(extension.mcpServers, library),
    `${library}: Gemini must discover exactly one matching extension MCP server.`
  );
  return extension;
}

async function assertNoExtensions(scenario) {
  const extensions = await installedExtensions(scenario);
  assert(extensions.length === 0, 'Gemini extension removal left an extension discoverable.');
}

async function assertMcpDiscovery(scenario, contract, library, expectedPresent) {
  const result = await runGemini(scenario, ['mcp', 'list'], { timeoutMs: 180_000 });
  const output = combinedOutput(result);
  if (expectedPresent) {
    assert(
      output.includes(`${library} (from ${library})`) &&
        output.includes(`npx -y ${contract.mcpPackage}@${contract.mcpVersion}`) &&
        /Connected/.test(output),
      `${library}: Gemini MCP discovery did not connect the exact installed server:\n${output}`
    );
  } else {
    assert(
      /No MCP servers configured/.test(output),
      `${library}: Gemini cleanup left MCP discovery active:\n${output}`
    );
  }
  for (const foreignLibrary of libraryNames.filter((name) => name !== library)) {
    assert(
      !new RegExp(`\\b${foreignLibrary}\\b`).test(output),
      `${library}: Gemini MCP discovery exposed foreign server ${foreignLibrary}.`
    );
  }
}

export async function assertInstalledGeminiPayload({
  contract,
  geminiHome,
  installPath,
  library,
  sourcePath
}) {
  const [canonicalGeminiHome, canonicalInstallPath, canonicalSourcePath] = await Promise.all([
    realpath(geminiHome),
    realpath(installPath),
    realpath(sourcePath)
  ]);
  const expectedInstallPath = path.join(canonicalGeminiHome, 'extensions', library);
  assert(
    canonicalInstallPath === expectedInstallPath,
    `${library}: installed extension path differs from the Gemini user-extension contract.`
  );

  const manifestPath = path.join(canonicalInstallPath, 'gemini-extension.json');
  const metadataPath = path.join(canonicalInstallPath, '.gemini-extension-install.json');
  const provenancePath = path.join(canonicalInstallPath, 'provenance.json');
  const skillsRoot = path.join(canonicalInstallPath, 'skills');
  const skillPath = path.join(skillsRoot, library, 'SKILL.md');
  for (const requiredPath of [manifestPath, metadataPath, provenancePath, skillPath]) {
    assert(await pathExists(requiredPath), `${library}: installed Gemini payload is missing ${requiredPath}.`);
  }
  assert(
    !(await pathExists(path.join(canonicalInstallPath, 'GEMINI.md'))),
    `${library}: installed Gemini payload must use native skills without GEMINI.md.`
  );

  const [manifest, metadata, provenance, skill] = await Promise.all([
    readJson(manifestPath),
    readJson(metadataPath),
    readJson(provenancePath),
    readFile(skillPath, 'utf8')
  ]);
  assert(manifest.name === library, `${library}: installed Gemini manifest name does not match.`);
  assert(manifest.version === contract.pluginVersion, `${library}: installed Gemini manifest version does not match.`);
  assert(metadata.type === 'local', `${library}: Gemini install metadata type must be local.`);
  assert(
    (await realpath(metadata.source)) === canonicalSourcePath,
    `${library}: Gemini install metadata source path does not match.`
  );
  assert(provenance.name === library, `${library}: installed Gemini provenance name does not match.`);
  assert(
    provenance.mcp?.package === contract.mcpPackage &&
      provenance.mcp?.version === contract.mcpVersion,
    `${library}: installed Gemini provenance MCP pin does not match.`
  );
  assert(new RegExp(`^name: ${library}$`, 'm').test(skill), `${library}: installed Gemini skill name does not match.`);

  const skillEntries = await readdir(skillsRoot, { withFileTypes: true });
  assert(
    skillEntries.length === 1 &&
      skillEntries[0].name === library &&
      skillEntries[0].isDirectory() &&
      !skillEntries[0].isSymbolicLink(),
    `${library}: installed Gemini payload must contain exactly one physical matching skill directory.`
  );
  const serverNames = Object.keys(manifest.mcpServers ?? {});
  assert(
    serverNames.length === 1 && serverNames[0] === library,
    `${library}: installed Gemini manifest must contain only the matching MCP server.`
  );
  assert(manifest.mcpServers[library].command === 'npx', `${library}: Gemini MCP command must be npx.`);
  assert(
    JSON.stringify(manifest.mcpServers[library].args) ===
      JSON.stringify(['-y', `${contract.mcpPackage}@${contract.mcpVersion}`]),
    `${library}: installed Gemini MCP package pin does not match.`
  );

  for (const foreignLibrary of libraryNames.filter((name) => name !== library)) {
    assert(
      !(await pathExists(path.join(skillsRoot, foreignLibrary))),
      `${library}: installed Gemini payload contains foreign skill ${foreignLibrary}.`
    );
    assert(
      !Object.hasOwn(manifest.mcpServers, foreignLibrary),
      `${library}: installed Gemini payload contains foreign MCP server ${foreignLibrary}.`
    );
  }

  const extensionEntries = await readdir(path.join(canonicalGeminiHome, 'extensions'), {
    withFileTypes: true
  });
  const installedDirectories = extensionEntries.filter((entry) => entry.isDirectory());
  assert(
    installedDirectories.length === 1 &&
      installedDirectories[0].name === library &&
      !installedDirectories[0].isSymbolicLink(),
    `${library}: isolated Gemini extension state must contain only the selected library.`
  );

  return { manifest, manifestPath, metadata, skillPath };
}

async function clonePersistentSource(scenario) {
  const checkout = path.join(scenario.root, 'persistent-checkout');
  await runCommand(
    'git',
    [
      'clone',
      '--depth',
      '1',
      '--filter=blob:none',
      'https://github.com/primefaces/primeui-plugins',
      checkout
    ],
    { cwd: scenario.workspace, env: scenario.env, timeoutMs: 180_000 }
  );
  return checkout;
}

function refreshedVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/.exec(version);
  assert(match !== null, `Cannot build a refresh-test version from ${version}.`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}-refresh.0`;
}

async function writeManifestVersion(manifestPath, version) {
  const manifest = await readJson(manifestPath);
  manifest.version = version;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function assertCleanup(scenario, library) {
  const installPath = path.join(scenario.geminiHome, 'extensions', library);
  assert(!(await pathExists(installPath)), `${library}: uninstall left the extension directory behind.`);
  assert(
    (await readFile(path.join(scenario.geminiHome, 'sentinel.txt'), 'utf8')) === 'preserve\n',
    `${library}: Gemini cleanup modified unrelated temporary state.`
  );
  const enablementPath = path.join(scenario.geminiHome, 'extensions', 'extension-enablement.json');
  if (await pathExists(enablementPath)) {
    const enablement = await readJson(enablementPath);
    assert(!Object.hasOwn(enablement, library), `${library}: uninstall left enablement state behind.`);
  }
}

export async function validateGeminiRuntime({ keepTemp = false, repositoryRoot }) {
  const scenario = await createScenarioRoot('primeui-gemini-runtime-');
  try {
    const version = await runGemini(scenario, ['--version'], { cwd: repositoryRoot, timeoutMs: 30_000 });
    const extensionHelp = await runGemini(scenario, ['extensions', '--help'], { timeoutMs: 30_000 });
    const help = combinedOutput(extensionHelp);
    for (const command of ['disable', 'enable', 'install', 'list', 'uninstall', 'update', 'validate']) {
      assert(
        new RegExp(`gemini extensions ${command}\\b`).test(help),
        `Gemini extension help lacks ${command}.`
      );
    }
    const installHelp = combinedOutput(
      await runGemini(scenario, ['extensions', 'install', '--help'], { timeoutMs: 30_000 })
    );
    assert(/--ref\b/.test(installHelp), 'Gemini extension install lacks --ref.');
    assert(/--consent\b/.test(installHelp), 'Gemini extension install lacks --consent.');
    assert(!/--path\b/.test(installHelp), 'Gemini extension install unexpectedly exposes --path.');
    const listHelp = combinedOutput(
      await runGemini(scenario, ['extensions', 'list', '--help'], { timeoutMs: 30_000 })
    );
    assert(/--output-format\b/.test(listHelp), 'Gemini extension list lacks --output-format.');
    return {
      temporaryRoot: keepTemp ? scenario.root : undefined,
      version: combinedOutput(version)
    };
  } finally {
    if (!keepTemp) {
      await rm(scenario.root, { force: true, recursive: true });
    }
  }
}

export async function runGeminiInstallScenario({
  keepTemp = false,
  library,
  repositoryRoot,
  source
}) {
  const { lockConfig, pluginsConfig } = await readDistributionConfiguration(repositoryRoot, {
    release: true
  });
  const lock = lockConfig.sources.find((candidate) => candidate.name === library);
  const plugin = pluginsConfig.plugins.find((candidate) => candidate.name === library);
  assert(lock !== undefined && plugin !== undefined, `${library}: release contract is missing.`);
  const contract = {
    ...geminiUsageContracts[library],
    mcpPackage: lock.mcp.package,
    mcpVersion: lock.mcp.version,
    pluginVersion: lock.pluginVersion,
    serverName: plugin.mcp.serverName
  };
  assert(contract.serverName === library, `${library}: Gemini MCP server name must match the extension.`);

  const scenario = await createScenarioRoot(`primeui-gemini-${source}-${library}-`);
  try {
    const sourceRoot =
      source === 'github'
        ? path.join(await clonePersistentSource(scenario), 'gemini', library)
        : path.join(repositoryRoot, 'gemini', library);
    const canonicalSourceRoot = await realpath(sourceRoot);
    await runGemini(scenario, ['extensions', 'validate', canonicalSourceRoot], {
      timeoutMs: 60_000
    });
    await runGemini(
      scenario,
      ['extensions', 'install', canonicalSourceRoot, '--consent'],
      { timeoutMs: 120_000 }
    );

    let extension = await assertOneExtension(scenario, contract, library, true);
    let payload = await assertInstalledGeminiPayload({
      contract,
      geminiHome: scenario.geminiHome,
      installPath: extension.path,
      library,
      sourcePath: canonicalSourceRoot
    });
    const runtime = await smokeInstalledMcp({
      clientName: 'primeui-plugins-gemini-smoke',
      contract,
      env: scenario.env,
      installPath: extension.path,
      library,
      mcp: payload.manifest
    });
    await assertMcpDiscovery(scenario, contract, library, true);

    await runGemini(scenario, ['extensions', 'disable', library]);
    extension = await assertOneExtension(scenario, contract, library, false);
    await runGemini(scenario, ['extensions', 'enable', library]);
    extension = await assertOneExtension(scenario, contract, library, true);

    let refreshMode = 'local source reported up to date';
    if (source === 'github') {
      const originalVersion = contract.pluginVersion;
      const updateVersion = refreshedVersion(originalVersion);
      const sourceManifestPath = path.join(canonicalSourceRoot, 'gemini-extension.json');
      await writeManifestVersion(sourceManifestPath, updateVersion);
      const updated = await runGemini(scenario, ['extensions', 'update', library], {
        input: 'y\n',
        timeoutMs: 120_000
      });
      assert(
        /successfully updated/i.test(combinedOutput(updated)),
        `${library}: Gemini update did not run:\n${combinedOutput(updated)}`
      );
      let updatedExtensions = await installedExtensions(scenario);
      assert(
        updatedExtensions.length === 1 && updatedExtensions[0].version === updateVersion,
        `${library}: persistent-source version refresh was not installed.`
      );
      await writeManifestVersion(sourceManifestPath, originalVersion);
      await runGemini(scenario, ['extensions', 'update', library], {
        input: 'y\n',
        timeoutMs: 120_000
      });
      extension = await assertOneExtension(scenario, contract, library, true);

      const markerPath = path.join(canonicalSourceRoot, 'persistent-refresh-marker.txt');
      await writeFile(markerPath, 'same-version refresh\n');
      const sameVersion = await runGemini(scenario, ['extensions', 'update', library], {
        timeoutMs: 120_000
      });
      assert(/already up to date/i.test(combinedOutput(sameVersion)), `${library}: same-version update contract changed.`);
      assert(
        !(await pathExists(path.join(extension.path, 'persistent-refresh-marker.txt'))),
        `${library}: same-version update unexpectedly recopied the persistent source.`
      );
      refreshMode = 'persistent checkout version update plus same-version reinstall';
    } else {
      const upToDate = await runGemini(scenario, ['extensions', 'update', library], {
        timeoutMs: 120_000
      });
      assert(/already up to date/i.test(combinedOutput(upToDate)), `${library}: local update contract changed.`);
    }

    await runGemini(scenario, ['extensions', 'uninstall', library]);
    await assertNoExtensions(scenario);
    await assertMcpDiscovery(scenario, contract, library, false);
    await assertCleanup(scenario, library);
    await runGemini(
      scenario,
      ['extensions', 'install', canonicalSourceRoot, '--consent'],
      { timeoutMs: 120_000 }
    );
    extension = await assertOneExtension(scenario, contract, library, true);
    payload = await assertInstalledGeminiPayload({
      contract,
      geminiHome: scenario.geminiHome,
      installPath: extension.path,
      library,
      sourcePath: canonicalSourceRoot
    });
    if (source === 'github') {
      assert(
        await pathExists(path.join(extension.path, 'persistent-refresh-marker.txt')),
        `${library}: reinstall did not pick up the same-version persistent-source refresh.`
      );
    }

    await runGemini(scenario, ['extensions', 'uninstall', library]);
    await assertNoExtensions(scenario);
    await assertMcpDiscovery(scenario, contract, library, false);
    await assertCleanup(scenario, library);

    return {
      installPath: extension.path,
      library,
      refreshMode,
      source,
      temporaryRoot: keepTemp ? scenario.root : undefined,
      toolNames: runtime.toolNames
    };
  } finally {
    if (!keepTemp) {
      await rm(scenario.root, { force: true, recursive: true });
    }
  }
}
