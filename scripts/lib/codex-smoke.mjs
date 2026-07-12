import { access, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readDistributionConfiguration } from './generator.mjs';
import { smokeInstalledMcp } from './mcp-smoke.mjs';
import { runCommand } from './process.mjs';
import {
  assertPhysicalSkillInventory,
  configuredSkillContracts,
  libraryNames,
  usageContracts
} from './smoke-contracts.mjs';
const safeEnvironmentKeys = new Set([
  'ALL_PROXY',
  'CI',
  'CODEX_CI',
  'COLORTERM',
  'COMSPEC',
  'CURL_CA_BUNDLE',
  'HTTPS_PROXY',
  'HTTP_PROXY',
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

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

export function parseCodexSmokeArguments(argumentsList) {
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

export function sanitizeCodexProcessEnvironment(environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => safeEnvironmentKeys.has(key.toUpperCase()))
  );
}

export function codexScenarioEnvironment(root, environment = process.env) {
  const codexHome = path.join(root, 'codex-home');
  const gitGlobalConfig = path.join(root, 'gitconfig');
  const home = path.join(root, 'home');
  const npmCache = path.join(root, 'npm-cache');
  const npmGlobalConfig = path.join(root, 'npm-globalrc');
  const npmUserConfig = path.join(root, 'npmrc');
  const xdgCache = path.join(root, 'xdg-cache');
  const xdgConfig = path.join(root, 'xdg-config');
  return {
    codexHome,
    env: {
      ...sanitizeCodexProcessEnvironment(environment),
      CODEX_HOME: codexHome,
      GIT_CONFIG_GLOBAL: gitGlobalConfig,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      HOME: home,
      npm_config_cache: npmCache,
      NPM_CONFIG_GLOBALCONFIG: npmGlobalConfig,
      NPM_CONFIG_USERCONFIG: npmUserConfig,
      npm_config_globalconfig: npmGlobalConfig,
      npm_config_userconfig: npmUserConfig,
      USERPROFILE: home,
      XDG_CACHE_HOME: xdgCache,
      XDG_CONFIG_HOME: xdgConfig
    },
    gitGlobalConfig,
    home,
    npmCache,
    npmGlobalConfig,
    npmUserConfig,
    xdgCache,
    xdgConfig
  };
}

async function createScenarioRoot(prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const directories = codexScenarioEnvironment(root);
  await Promise.all(
    [
      directories.codexHome,
      directories.home,
      directories.npmCache,
      directories.xdgCache,
      directories.xdgConfig
    ].map((directory) => mkdir(directory, { recursive: true }))
  );
  await Promise.all([
    writeFile(directories.gitGlobalConfig, ''),
    writeFile(directories.npmGlobalConfig, ''),
    writeFile(directories.npmUserConfig, '')
  ]);
  return { ...directories, root };
}

async function runCodex(scenario, argumentsList, options = {}) {
  return runCommand('codex', argumentsList, {
    cwd: options.cwd,
    env: scenario.env,
    timeoutMs: options.timeoutMs
  });
}

function parseJsonOutput(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} did not return valid JSON: ${error.message}\n${result.stdout}`);
  }
}

export function parseCodexPluginListJson(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    fail(`Codex plugin list output is not valid JSON: ${error.message}`);
  }
  assert(
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
    'Codex plugin list must return an object.'
  );
  assert(Array.isArray(parsed.installed), 'Codex plugin list must return installed as an array.');
  assert(Array.isArray(parsed.available), 'Codex plugin list must return available as an array.');
  return parsed;
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

export async function assertInstalledCodexPayload({ codexHome, contract, installPath, library }) {
  assert(contract !== undefined, `Unknown library payload: ${library}.`);
  const [canonicalCodexHome, canonicalInstallPath] = await Promise.all([
    realpath(codexHome),
    realpath(installPath)
  ]);
  const relativeInstallPath = path.relative(canonicalCodexHome, canonicalInstallPath);
  assert(
    relativeInstallPath !== '' &&
      !relativeInstallPath.startsWith('..') &&
      !path.isAbsolute(relativeInstallPath),
    `${library}: install path escaped the isolated Codex home.`
  );

  const expectedRelativePath = path.join(
    'plugins',
    'cache',
    'primeui',
    library,
    contract.pluginVersion
  );
  assert(
    relativeInstallPath === expectedRelativePath,
    `${library}: installed cache path differs from the Codex plugin cache contract.`
  );

  const skillsRoot = path.join(canonicalInstallPath, 'skills');
  const manifestPath = path.join(canonicalInstallPath, '.codex-plugin', 'plugin.json');
  const mcpPath = path.join(canonicalInstallPath, '.mcp.json');
  for (const requiredPath of [manifestPath, mcpPath, skillsRoot]) {
    assert(await pathExists(requiredPath), `${library}: installed payload is missing ${requiredPath}.`);
  }

  const [manifest, mcp] = await Promise.all([
    readJson(manifestPath),
    readJson(mcpPath)
  ]);
  assert(manifest.name === library, `${library}: installed manifest name does not match.`);
  assert(manifest.version === contract.pluginVersion, `${library}: installed plugin version does not match.`);
  assert(manifest.skills === './skills/', `${library}: installed manifest skill pointer does not match.`);
  assert(manifest.mcpServers === './.mcp.json', `${library}: installed manifest MCP pointer does not match.`);
  await assertPhysicalSkillInventory(skillsRoot, contract.skills, `${library}: installed Codex payload`);

  const serverNames = Object.keys(mcp.mcpServers ?? {});
  assert(
    serverNames.length === 1 && serverNames[0] === library,
    `${library}: installed MCP configuration must contain only the matching server.`
  );
  assert(mcp.mcpServers[library].command === 'npx', `${library}: installed MCP command must be npx.`);
  assert(
    JSON.stringify(mcp.mcpServers[library].args) ===
      JSON.stringify(['-y', `${contract.mcpPackage}@${contract.mcpVersion}`]),
    `${library}: installed MCP package pin does not match.`
  );

  for (const foreignLibrary of libraryNames.filter((name) => name !== library)) {
    assert(
      !(await pathExists(path.join(skillsRoot, foreignLibrary))),
      `${library}: installed payload contains foreign skill ${foreignLibrary}.`
    );
    assert(
      !Object.hasOwn(mcp.mcpServers, foreignLibrary),
      `${library}: installed payload contains foreign MCP server ${foreignLibrary}.`
    );
  }

  const marketplaceCacheRoot = path.join(canonicalCodexHome, 'plugins', 'cache', 'primeui');
  const cachedLibraries = await readdir(marketplaceCacheRoot, { withFileTypes: true });
  assert(
    cachedLibraries.length === 1 &&
      cachedLibraries[0].name === library &&
      cachedLibraries[0].isDirectory() &&
      !cachedLibraries[0].isSymbolicLink(),
    `${library}: isolated Codex install cache must contain only the selected library.`
  );
  const versionEntries = await readdir(path.join(marketplaceCacheRoot, library), {
    withFileTypes: true
  });
  assert(
    versionEntries.length === 1 &&
      versionEntries[0].name === contract.pluginVersion &&
      versionEntries[0].isDirectory() &&
      !versionEntries[0].isSymbolicLink(),
    `${library}: isolated Codex install cache must contain only the locked plugin version.`
  );

  return { manifest, mcp, mcpPath, skillsRoot };
}

function assertPluginListShape(value, label) {
  assert(value !== null && typeof value === 'object', `${label} must return an object.`);
  assert(Array.isArray(value.installed), `${label} must return installed as an array.`);
  assert(Array.isArray(value.available), `${label} must return available as an array.`);
}

async function readPluginList(scenario, cwd, { available = false } = {}) {
  const result = await runCodex(
    scenario,
    ['plugin', 'list', ...(available ? ['--available'] : []), '--json'],
    { cwd }
  );
  const list = parseJsonOutput(result, 'codex plugin list --json');
  assertPluginListShape(list, 'codex plugin list --json');
  return list;
}

function assertAvailableCatalog(list, contracts) {
  assert(list.installed.length === 0, 'Fresh Codex scenario unexpectedly contains installed plugins.');
  const expectedIds = libraryNames.map((library) => `${library}@primeui`).sort();
  const actualIds = list.available.map((plugin) => plugin.pluginId).sort();
  assert(
    JSON.stringify(actualIds) === JSON.stringify(expectedIds),
    `Codex marketplace catalog differs: ${actualIds.join(', ')}.`
  );
  for (const plugin of list.available) {
    const contract = contracts[plugin.name];
    assert(contract !== undefined, `Codex catalog returned unknown plugin ${plugin.name}.`);
    assert(plugin.version === contract.pluginVersion, `${plugin.name}: available version does not match.`);
    assert(plugin.installed === false, `${plugin.name}: fresh catalog entry is unexpectedly installed.`);
    assert(plugin.enabled === false, `${plugin.name}: fresh catalog entry is unexpectedly enabled.`);
    assert(plugin.installPolicy === 'AVAILABLE', `${plugin.name}: install policy does not match.`);
    assert(plugin.authPolicy === 'ON_INSTALL', `${plugin.name}: auth policy does not match.`);
  }
}

async function assertInstalledPlugin(scenario, cwd, contract, library, expectedEnabled = true) {
  const list = await readPluginList(scenario, cwd);
  assert(list.installed.length === 1, `${library}: expected exactly one installed plugin.`);
  assert(list.available.length === 0, `${library}: installed-only listing returned available plugins.`);
  const plugin = list.installed[0];
  assert(plugin.pluginId === `${library}@primeui`, `${library}: installed plugin id does not match.`);
  assert(plugin.name === library, `${library}: installed plugin name does not match.`);
  assert(plugin.marketplaceName === 'primeui', `${library}: installed marketplace does not match.`);
  assert(plugin.version === contract.pluginVersion, `${library}: installed version does not match.`);
  assert(plugin.installed === true, `${library}: installed state does not match.`);
  assert(plugin.enabled === expectedEnabled, `${library}: enabled state does not match.`);
  return plugin;
}

async function assertNoInstalledPlugins(scenario, cwd) {
  const list = await readPluginList(scenario, cwd);
  assert(list.installed.length === 0, 'Codex plugin removal left installed plugins behind.');
}

async function assertSelectedCacheRemoved(codexHome, library) {
  const selectedCache = path.join(codexHome, 'plugins', 'cache', 'primeui', library);
  assert(!(await pathExists(selectedCache)), `${library}: plugin removal left its install cache behind.`);
}

async function assertPluginConfigState(codexHome, library, enabled) {
  const config = await readFile(path.join(codexHome, 'config.toml'), 'utf8');
  const escapedId = `${library}@primeui`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\[plugins\\."${escapedId}"\\]\\nenabled = ${enabled}`);
  assert(pattern.test(config), `${library}: isolated Codex config does not record enabled=${enabled}.`);
}

async function assertDiscoveredMcp(scenario, cwd, contract, library) {
  const result = await runCodex(scenario, ['mcp', 'list', '--json'], { cwd });
  const servers = parseJsonOutput(result, 'codex mcp list --json');
  assert(Array.isArray(servers), 'codex mcp list --json must return an array.');
  assert(servers.length === 1, `${library}: Codex must discover exactly one installed MCP server.`);
  const server = servers[0];
  assert(server.name === library, `${library}: discovered MCP server name does not match.`);
  assert(server.enabled === true, `${library}: discovered MCP server is not enabled.`);
  assert(server.transport?.type === 'stdio', `${library}: discovered MCP transport must be stdio.`);
  assert(server.transport.command === 'npx', `${library}: discovered MCP command must be npx.`);
  assert(
    JSON.stringify(server.transport.args) ===
      JSON.stringify(['-y', `${contract.mcpPackage}@${contract.mcpVersion}`]),
    `${library}: Codex-discovered MCP package pin does not match.`
  );
}

async function assertNoDiscoveredMcp(scenario, cwd) {
  const result = await runCodex(scenario, ['mcp', 'list', '--json'], { cwd });
  const servers = parseJsonOutput(result, 'codex mcp list --json');
  assert(Array.isArray(servers) && servers.length === 0, 'Plugin removal left an MCP server active.');
}

export async function validateCodexRuntime({ keepTemp = false, repositoryRoot }) {
  const scenario = await createScenarioRoot('primeui-codex-runtime-');
  try {
    const version = await runCodex(scenario, ['--version'], { cwd: repositoryRoot });
    const pluginHelp = await runCodex(scenario, ['plugin', '--help'], { cwd: repositoryRoot });
    const marketplaceHelp = await runCodex(scenario, ['plugin', 'marketplace', '--help'], {
      cwd: repositoryRoot
    });
    for (const command of ['add', 'list', 'remove']) {
      const help = await runCodex(scenario, ['plugin', command, '--help'], { cwd: repositoryRoot });
      assert(/--json\b/.test(`${help.stdout}\n${help.stderr}`), `codex plugin ${command} lacks --json.`);
    }
    const listHelp = await runCodex(scenario, ['plugin', 'list', '--help'], { cwd: repositoryRoot });
    assert(/--available\b/.test(listHelp.stdout), 'codex plugin list lacks --available.');
    for (const command of ['add', 'list', 'upgrade', 'remove']) {
      const help = await runCodex(scenario, ['plugin', 'marketplace', command, '--help'], {
        cwd: repositoryRoot
      });
      assert(
        /--json\b/.test(`${help.stdout}\n${help.stderr}`),
        `codex plugin marketplace ${command} lacks --json.`
      );
    }
    for (const command of ['add', 'list', 'marketplace', 'remove']) {
      assert(
        new RegExp(`^  ${command}\\s`, 'm').test(pluginHelp.stdout),
        `codex plugin help lacks ${command}.`
      );
    }
    for (const command of ['add', 'list', 'upgrade', 'remove']) {
      assert(
        new RegExp(`^  ${command}\\s`, 'm').test(marketplaceHelp.stdout),
        `codex plugin marketplace help lacks ${command}.`
      );
    }
    assert(
      !/^  (?:enable|disable|update|upgrade)\s/m.test(pluginHelp.stdout),
      'Codex plugin lifecycle command surface changed; review enable, disable, or update handling.'
    );
    return {
      temporaryRoot: keepTemp ? scenario.root : undefined,
      version: version.stdout
    };
  } finally {
    if (!keepTemp) {
      await rm(scenario.root, { force: true, recursive: true });
    }
  }
}

export async function runCodexInstallScenario({ keepTemp = false, library, repositoryRoot, source }) {
  const { lockConfig, pluginsConfig } = await readDistributionConfiguration(repositoryRoot, {
    release: true
  });
  const locks = Object.fromEntries(lockConfig.sources.map((lock) => [lock.name, lock]));
  const contracts = Object.fromEntries(
    pluginsConfig.plugins.map((plugin) => {
      const lock = locks[plugin.name];
      return [
        plugin.name,
        {
          ...usageContracts[plugin.name],
          mcpPackage: lock.mcp.package,
          mcpVersion: lock.mcp.version,
          pluginVersion: lock.pluginVersion,
          serverName: plugin.mcp.serverName,
          skills: configuredSkillContracts(plugin, lock)
        }
      ];
    })
  );
  const contract = contracts[library];
  assert(contract !== undefined, `${library}: release contract is missing.`);
  assert(contract.serverName === library, `${library}: Codex MCP server name must match the plugin.`);

  const scenario = await createScenarioRoot(`primeui-codex-${source}-${library}-`);
  const marketplaceSource = source === 'github' ? 'primefaces/primeui-plugins' : repositoryRoot;
  const pluginId = `${library}@primeui`;
  try {
    const addMarketplace = await runCodex(
      scenario,
      ['plugin', 'marketplace', 'add', marketplaceSource, '--json'],
      { cwd: repositoryRoot, timeoutMs: 180_000 }
    );
    const addedMarketplace = parseJsonOutput(
      addMarketplace,
      'codex plugin marketplace add --json'
    );
    assert(addedMarketplace.marketplaceName === 'primeui', 'Codex marketplace name does not match.');
    const [canonicalCodexHome, canonicalMarketplaceRoot, canonicalRepositoryRoot] = await Promise.all([
      realpath(scenario.codexHome),
      realpath(addedMarketplace.installedRoot),
      realpath(repositoryRoot)
    ]);
    if (source === 'local') {
      assert(
        canonicalMarketplaceRoot === canonicalRepositoryRoot,
        'Local Codex marketplace did not resolve to the repository root.'
      );
    } else {
      const relativeMarketplaceRoot = path.relative(canonicalCodexHome, canonicalMarketplaceRoot);
      assert(
        relativeMarketplaceRoot !== '' &&
          !relativeMarketplaceRoot.startsWith('..') &&
          !path.isAbsolute(relativeMarketplaceRoot),
        'Git Codex marketplace snapshot escaped the isolated Codex home.'
      );
    }

    const marketplaceList = await runCodex(
      scenario,
      ['plugin', 'marketplace', 'list', '--json'],
      { cwd: repositoryRoot }
    );
    const marketplaces = parseJsonOutput(
      marketplaceList,
      'codex plugin marketplace list --json'
    ).marketplaces;
    assert(
      Array.isArray(marketplaces) &&
        marketplaces.length === 1 &&
        marketplaces[0].name === 'primeui',
      `${library}: isolated marketplace registration was not discoverable.`
    );

    assertAvailableCatalog(await readPluginList(scenario, repositoryRoot, { available: true }), contracts);

    const installResult = await runCodex(scenario, ['plugin', 'add', pluginId, '--json'], {
      cwd: repositoryRoot,
      timeoutMs: 180_000
    });
    let installation = parseJsonOutput(installResult, 'codex plugin add --json');
    assert(installation.pluginId === pluginId, `${library}: install result plugin id does not match.`);
    assert(installation.version === contract.pluginVersion, `${library}: install result version does not match.`);
    await assertInstalledPlugin(scenario, repositoryRoot, contract, library);
    await assertPluginConfigState(scenario.codexHome, library, true);
    await assertDiscoveredMcp(scenario, repositoryRoot, contract, library);
    let payload = await assertInstalledCodexPayload({
      codexHome: scenario.codexHome,
      contract,
      installPath: installation.installedPath,
      library
    });

    let refreshMode = 'live local marketplace path';
    if (source === 'github') {
      await runCodex(
        scenario,
        ['plugin', 'marketplace', 'upgrade', 'primeui', '--json'],
        { cwd: repositoryRoot, timeoutMs: 180_000 }
      );
      refreshMode = 'Git marketplace upgrade';
      await assertInstalledPlugin(scenario, repositoryRoot, contract, library);
      await assertDiscoveredMcp(scenario, repositoryRoot, contract, library);
      payload = await assertInstalledCodexPayload({
        codexHome: scenario.codexHome,
        contract,
        installPath: installation.installedPath,
        library
      });
    }

    await runCodex(scenario, ['plugin', 'remove', pluginId, '--json'], {
      cwd: repositoryRoot
    });
    await assertNoInstalledPlugins(scenario, repositoryRoot);
    await assertSelectedCacheRemoved(scenario.codexHome, library);
    await assertNoDiscoveredMcp(scenario, repositoryRoot);

    const reinstallResult = await runCodex(scenario, ['plugin', 'add', pluginId, '--json'], {
      cwd: repositoryRoot,
      timeoutMs: 180_000
    });
    installation = parseJsonOutput(reinstallResult, 'codex plugin add --json');
    await assertInstalledPlugin(scenario, repositoryRoot, contract, library);
    await assertPluginConfigState(scenario.codexHome, library, true);
    await assertDiscoveredMcp(scenario, repositoryRoot, contract, library);
    payload = await assertInstalledCodexPayload({
      codexHome: scenario.codexHome,
      contract,
      installPath: installation.installedPath,
      library
    });
    const runtime = await smokeInstalledMcp({
      clientName: 'primeui-plugins-codex-smoke',
      contract,
      env: scenario.env,
      installPath: installation.installedPath,
      library,
      mcp: payload.mcp
    });

    await runCodex(scenario, ['plugin', 'remove', pluginId, '--json'], {
      cwd: repositoryRoot
    });
    await assertNoInstalledPlugins(scenario, repositoryRoot);
    await assertSelectedCacheRemoved(scenario.codexHome, library);
    await assertNoDiscoveredMcp(scenario, repositoryRoot);
    await runCodex(
      scenario,
      ['plugin', 'marketplace', 'remove', 'primeui', '--json'],
      { cwd: repositoryRoot }
    );
    const removedMarketplaceList = await runCodex(
      scenario,
      ['plugin', 'marketplace', 'list', '--json'],
      { cwd: repositoryRoot }
    );
    const remainingMarketplaces = parseJsonOutput(
      removedMarketplaceList,
      'codex plugin marketplace list --json'
    ).marketplaces;
    assert(
      Array.isArray(remainingMarketplaces) &&
        remainingMarketplaces.every((marketplace) => marketplace.name !== 'primeui'),
      `${library}: marketplace removal left primeui configured.`
    );

    return {
      installPath: installation.installedPath,
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
