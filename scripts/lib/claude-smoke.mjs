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
const exactSemverPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

export function parseClaudeSmokeArguments(argumentsList) {
  const options = {
    claudeVersion: 'installed',
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
    if (argument === '--claude-version') {
      const value = argumentsList[++index];
      if (value !== 'installed' && !exactSemverPattern.test(value ?? '')) {
        fail('--claude-version must be installed or an exact SemVer.');
      }
      options.claudeVersion = value;
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

function scenarioEnvironment(root) {
  const home = path.join(root, 'home');
  const config = path.join(root, 'claude-config');
  const cache = path.join(root, 'cache');
  const npmCache = path.join(root, 'npm-cache');
  const npmUserConfig = path.join(root, 'npmrc');
  const xdgConfig = path.join(root, 'xdg-config');
  return {
    cache,
    config,
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: config,
      HOME: home,
      npm_config_cache: npmCache,
      NPM_CONFIG_USERCONFIG: npmUserConfig,
      npm_config_userconfig: npmUserConfig,
      XDG_CACHE_HOME: cache,
      XDG_CONFIG_HOME: xdgConfig
    },
    home,
    npmCache,
    npmUserConfig,
    xdgConfig
  };
}

async function createScenarioRoot(prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const directories = scenarioEnvironment(root);
  await Promise.all(
    [
      directories.home,
      directories.config,
      directories.cache,
      directories.npmCache,
      directories.xdgConfig
    ].map((directory) => mkdir(directory, { recursive: true }))
  );
  await writeFile(directories.npmUserConfig, '');
  return { ...directories, root };
}

function claudeInvocation(claudeVersion, npmCache, argumentsList) {
  if (claudeVersion === 'installed') {
    return { argumentsList, command: 'claude' };
  }
  return {
    argumentsList: [
      '--cache',
      npmCache,
      'exec',
      '--yes',
      `--package=@anthropic-ai/claude-code@${claudeVersion}`,
      '--',
      'claude',
      ...argumentsList
    ],
    command: 'npm'
  };
}

async function runClaude(claudeVersion, scenario, argumentsList, options = {}) {
  const invocation = claudeInvocation(claudeVersion, scenario.npmCache, argumentsList);
  return runCommand(invocation.command, invocation.argumentsList, {
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

export async function assertInstalledPayload({ configRoot, contract, installPath, library }) {
  assert(contract !== undefined, `Unknown library payload: ${library}.`);
  const [canonicalConfigRoot, canonicalInstallPath] = await Promise.all([
    realpath(configRoot),
    realpath(installPath)
  ]);
  const relativeInstallPath = path.relative(canonicalConfigRoot, canonicalInstallPath);
  assert(
    relativeInstallPath !== '' && !relativeInstallPath.startsWith('..') && !path.isAbsolute(relativeInstallPath),
    `${library}: install path escaped the isolated Claude config root.`
  );

  const skillsRoot = path.join(canonicalInstallPath, 'skills');
  const manifestPath = path.join(canonicalInstallPath, '.claude-plugin', 'plugin.json');
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
  await assertPhysicalSkillInventory(skillsRoot, contract.skills, `${library}: installed Claude payload`);

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

  return { mcp, mcpPath, skillsRoot };
}

async function installedPlugin(claudeVersion, scenario, cwd, library) {
  const result = await runClaude(claudeVersion, scenario, ['plugin', 'list', '--json'], { cwd });
  const plugins = parseJsonOutput(result, 'claude plugin list --json');
  assert(Array.isArray(plugins), 'claude plugin list --json must return an array.');
  const selected = plugins.filter((plugin) => plugin.id === `${library}@primeui`);
  assert(selected.length === 1, `${library}: expected exactly one installed selected plugin.`);
  assert(plugins.length === 1, `${library}: isolated scenario contains an unexpected plugin.`);
  return selected[0];
}

async function assertNoInstalledPlugins(claudeVersion, scenario, cwd) {
  const result = await runClaude(claudeVersion, scenario, ['plugin', 'list', '--json'], { cwd });
  const plugins = parseJsonOutput(result, 'claude plugin list --json');
  assert(Array.isArray(plugins) && plugins.length === 0, 'Plugin uninstall left installed plugins behind.');
}

export async function validateClaudeManifests({ claudeVersion, repositoryRoot, keepTemp = false }) {
  const scenario = await createScenarioRoot('primeui-claude-validation-');
  try {
    const versionResult = await runClaude(claudeVersion, scenario, ['--version'], {
      cwd: repositoryRoot
    });
    const help = await runClaude(claudeVersion, scenario, ['plugin', 'validate', '--help'], {
      cwd: repositoryRoot
    });
    const strict = /--strict\b/.test(`${help.stdout}\n${help.stderr}`);
    for (const target of ['.', ...libraryNames.map((library) => `plugins/${library}`)]) {
      await runClaude(
        claudeVersion,
        scenario,
        ['plugin', 'validate', target, ...(strict ? ['--strict'] : [])],
        { cwd: repositoryRoot }
      );
    }
    return { strict, temporaryRoot: keepTemp ? scenario.root : undefined, version: versionResult.stdout };
  } finally {
    if (!keepTemp) {
      await rm(scenario.root, { force: true, recursive: true });
    }
  }
}

export async function runClaudeInstallScenario({
  claudeVersion,
  keepTemp = false,
  library,
  repositoryRoot,
  source
}) {
  const { lockConfig, pluginsConfig } = await readDistributionConfiguration(repositoryRoot, {
    release: true
  });
  const lock = lockConfig.sources.find((candidate) => candidate.name === library);
  const pluginConfig = pluginsConfig.plugins.find((candidate) => candidate.name === library);
  const contract = {
    ...usageContracts[library],
    mcpPackage: lock?.mcp.package,
    mcpVersion: lock?.mcp.version,
    pluginVersion: lock?.pluginVersion,
    serverName: pluginConfig?.mcp.serverName,
    skills: configuredSkillContracts(pluginConfig, lock)
  };
  assert(lock !== undefined && pluginConfig !== undefined, `${library}: release contract is missing.`);
  assert(contract.serverName === library, `${library}: Claude MCP server name must match the plugin.`);
  const scenario = await createScenarioRoot(`primeui-claude-${source}-${library}-`);
  const marketplaceSource =
    source === 'github' ? 'primefaces/primeui-plugins' : repositoryRoot;
  try {
    await runClaude(claudeVersion, scenario, ['plugin', 'marketplace', 'add', marketplaceSource], {
      cwd: repositoryRoot,
      timeoutMs: 180_000
    });
    const marketplaceResult = await runClaude(
      claudeVersion,
      scenario,
      ['plugin', 'marketplace', 'list', '--json'],
      { cwd: repositoryRoot }
    );
    const marketplaces = parseJsonOutput(marketplaceResult, 'claude plugin marketplace list --json');
    assert(
      Array.isArray(marketplaces) && marketplaces.length === 1 && marketplaces[0].name === 'primeui',
      `${library}: isolated marketplace registration was not discoverable.`
    );

    const pluginId = `${library}@primeui`;
    await runClaude(claudeVersion, scenario, ['plugin', 'install', pluginId], {
      cwd: repositoryRoot,
      timeoutMs: 180_000
    });
    let plugin = await installedPlugin(claudeVersion, scenario, repositoryRoot, library);
    assert(plugin.enabled === true, `${library}: installed plugin must be enabled.`);
    assert(
      plugin.version === contract.pluginVersion,
      `${library}: installed plugin version does not match the release lock.`
    );
    let payload = await assertInstalledPayload({
      configRoot: scenario.config,
      contract,
      installPath: plugin.installPath,
      library
    });

    const pluginHelp = await runClaude(claudeVersion, scenario, ['plugin', '--help'], {
      cwd: repositoryRoot
    });
    if (/\bdetails\b/.test(pluginHelp.stdout)) {
      const details = await runClaude(claudeVersion, scenario, ['plugin', 'details', pluginId], {
        cwd: repositoryRoot
      });
      assert(
        new RegExp(`Skills \\(${contract.skills.length}\\)`).test(details.stdout),
        `${library}: Claude details did not discover ${contract.skills.length} skills.`
      );
      assert(
        new RegExp(`MCP servers \\(1\\).*${library}`, 's').test(details.stdout),
        `${library}: Claude details did not discover the matching MCP server.`
      );
    }

    await runClaude(claudeVersion, scenario, ['plugin', 'disable', pluginId], { cwd: repositoryRoot });
    plugin = await installedPlugin(claudeVersion, scenario, repositoryRoot, library);
    assert(plugin.enabled === false, `${library}: disable did not change enabled state.`);
    await runClaude(claudeVersion, scenario, ['plugin', 'enable', pluginId], { cwd: repositoryRoot });
    plugin = await installedPlugin(claudeVersion, scenario, repositoryRoot, library);
    assert(plugin.enabled === true, `${library}: enable did not restore enabled state.`);

    await runClaude(claudeVersion, scenario, ['plugin', 'marketplace', 'update', 'primeui'], {
      cwd: repositoryRoot,
      timeoutMs: 180_000
    });
    await runClaude(claudeVersion, scenario, ['plugin', 'update', pluginId], {
      cwd: repositoryRoot,
      timeoutMs: 180_000
    });
    plugin = await installedPlugin(claudeVersion, scenario, repositoryRoot, library);
    assert(plugin.enabled === true, `${library}: update changed the enabled state.`);
    assert(plugin.version === contract.pluginVersion, `${library}: update changed the locked version.`);
    payload = await assertInstalledPayload({
      configRoot: scenario.config,
      contract,
      installPath: plugin.installPath,
      library
    });

    await runClaude(claudeVersion, scenario, ['plugin', 'uninstall', pluginId], {
      cwd: repositoryRoot
    });
    await assertNoInstalledPlugins(claudeVersion, scenario, repositoryRoot);
    await runClaude(claudeVersion, scenario, ['plugin', 'install', pluginId], {
      cwd: repositoryRoot,
      timeoutMs: 180_000
    });
    plugin = await installedPlugin(claudeVersion, scenario, repositoryRoot, library);
    payload = await assertInstalledPayload({
      configRoot: scenario.config,
      contract,
      installPath: plugin.installPath,
      library
    });
    const runtime = await smokeInstalledMcp({
      contract,
      env: scenario.env,
      installPath: plugin.installPath,
      library,
      mcp: payload.mcp
    });

    return {
      installPath: plugin.installPath,
      library,
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
