import { spawn } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { readDistributionConfiguration } from './generator.mjs';

export const expectedClaudeTools = [
  'get_component',
  'get_example',
  'get_guide',
  'get_setup',
  'list',
  'search',
  'validate_usage',
  'version'
];

const claudeUsageContracts = {
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

function commandError(command, argumentsList, result) {
  const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return new Error(
    `${command} ${argumentsList.join(' ')} failed with exit ${result.code}${
      details === '' ? '' : `:\n${details}`
    }`
  );
}

export function runCommand(command, argumentsList, { cwd, env, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      if (!settled) {
        settled = true;
        reject(new Error(`${command} ${argumentsList.join(' ')} timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      settled = true;
      const result = {
        code: code ?? (signal === null ? 1 : 128),
        stderr: Buffer.concat(stderr).toString('utf8').trim(),
        stdout: Buffer.concat(stdout).toString('utf8').trim()
      };
      if (result.code !== 0) {
        reject(commandError(command, argumentsList, result));
        return;
      }
      resolve(result);
    });
  });
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
  const skillPath = path.join(skillsRoot, library, 'SKILL.md');
  for (const requiredPath of [manifestPath, mcpPath, skillPath]) {
    assert(await pathExists(requiredPath), `${library}: installed payload is missing ${requiredPath}.`);
  }

  const [manifest, mcp, skill] = await Promise.all([
    readJson(manifestPath),
    readJson(mcpPath),
    readFile(skillPath, 'utf8')
  ]);
  assert(manifest.name === library, `${library}: installed manifest name does not match.`);
  assert(manifest.version === contract.pluginVersion, `${library}: installed plugin version does not match.`);
  assert(new RegExp(`^name: ${library}$`, 'm').test(skill), `${library}: installed skill name does not match.`);

  const skillEntries = await readdir(skillsRoot, { withFileTypes: true });
  assert(
    skillEntries.length === 1 &&
      skillEntries[0].name === library &&
      skillEntries[0].isDirectory() &&
      !skillEntries[0].isSymbolicLink(),
    `${library}: installed payload must contain exactly one physical matching skill directory.`
  );

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

  return { mcp, mcpPath, skillPath };
}

class JsonRpcStdioClient {
  constructor(command, argumentsList, options) {
    this.child = spawn(command, argumentsList, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.nextId = 1;
    this.pending = new Map();
    this.stderr = [];
    this.closed = false;
    this.child.stderr.on('data', (chunk) => this.stderr.push(chunk));
    this.child.on('error', (error) => this.rejectAll(error));
    this.child.on('close', (code, signal) => {
      this.closed = true;
      this.rejectAll(
        new Error(
          `MCP process closed before the request completed (code=${code}, signal=${signal}).\n${this.stderrText()}`
        )
      );
    });
    this.lines = readline.createInterface({ input: this.child.stdout });
    this.lines.on('line', (line) => this.handleLine(line));
  }

  stderrText() {
    return Buffer.concat(this.stderr).toString('utf8').trim();
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.rejectAll(new Error(`MCP process emitted non-JSON stdout: ${line}`));
      return;
    }
    if (message.id === undefined) {
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(`MCP request failed: ${JSON.stringify(message.error)}`));
    } else {
      pending.resolve(message.result);
    }
  }

  send(message) {
    assert(!this.closed, 'Cannot write to a closed MCP process.');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params = {}, timeoutMs = 120_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP ${method} request timed out.\n${this.stderrText()}`));
      }, timeoutMs);
      this.pending.set(id, { reject, resolve, timer });
      this.send({ id, jsonrpc: '2.0', method, params });
    });
  }

  notify(method, params = {}) {
    this.send({ jsonrpc: '2.0', method, params });
  }

  async close() {
    this.lines.close();
    this.child.stdin.end();
    if (!this.closed) {
      this.child.kill('SIGTERM');
    }
  }
}

function toolResultText(result) {
  return (result.content ?? [])
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

function assertToolSuccess(result, label) {
  assert(result && result.isError !== true, `${label} returned an MCP tool error: ${toolResultText(result)}`);
}

function assertValidation(result, expectedValid, label) {
  if (expectedValid) {
    assertToolSuccess(result, label);
  }
  const valid = result.structuredContent?.valid;
  assert(valid === expectedValid, `${label} expected valid=${expectedValid}, received ${valid}.`);
  return result.structuredContent;
}

export async function smokeInstalledMcp({ contract, env, installPath, library, mcp }) {
  const server = mcp.mcpServers[library];
  const client = new JsonRpcStdioClient(server.command, server.args, {
    cwd: installPath,
    env
  });

  try {
    await client.request('initialize', {
      capabilities: {},
      clientInfo: { name: 'primeui-plugins-claude-smoke', version: '1.0.0' },
      protocolVersion: '2025-06-18'
    });
    client.notify('notifications/initialized');

    const toolList = await client.request('tools/list');
    const toolNames = (toolList.tools ?? []).map((tool) => tool.name).sort();
    assert(
      JSON.stringify(toolNames) === JSON.stringify(expectedClaudeTools),
      `${library}: MCP tool surface differs: ${toolNames.join(', ')}.`
    );

    const documentation = await client.request('tools/call', {
      arguments: { component: 'button', includeExamples: true, ...(library === 'primereact' ? { mode: 'styled' } : {}) },
      name: 'get_component'
    });
    assertToolSuccess(documentation, `${library} Button documentation`);
    assert(/button/i.test(toolResultText(documentation)), `${library}: Button documentation was empty.`);

    const valid = await client.request('tools/call', {
      arguments: {
        code: contract.validCode,
        component: 'button',
        ...(library === 'primereact' ? { mode: 'styled' } : {})
      },
      name: 'validate_usage'
    });
    assertValidation(valid, true, `${library} valid Button usage`);

    const invalid = await client.request('tools/call', {
      arguments: {
        code: contract.invalidCode,
        component: 'button',
        ...(library === 'primereact' ? { mode: 'styled' } : {})
      },
      name: 'validate_usage'
    });
    const invalidResult = assertValidation(invalid, false, `${library} invalid Button usage`);
    assert(
      invalidResult.issues?.some((issue) => issue.kind === 'unknown-prop' && issue.name === 'madeUp'),
      `${library}: invalid property was not rejected as unknown-prop.`
    );

    if (library === 'primereact') {
      const tailwindCode = [
        "import { Button as UiButton } from '@/components/ui/button';",
        '',
        'export function SaveAction() {',
        '  return <UiButton variant="default">Save</UiButton>;',
        '}'
      ].join('\n');
      const tailwind = await client.request('tools/call', {
        arguments: { code: tailwindCode, component: 'button', mode: 'tailwind' },
        name: 'validate_usage'
      });
      assertValidation(tailwind, true, 'PrimeReact tailwind Button usage');

      const tailwindDocumentation = await client.request('tools/call', {
        arguments: { component: 'button', includeExamples: true, mode: 'tailwind' },
        name: 'get_component'
      });
      assertToolSuccess(tailwindDocumentation, 'PrimeReact tailwind Button documentation');
      const styledRouting = JSON.stringify(documentation);
      const tailwindRouting = JSON.stringify(tailwindDocumentation);
      assert(
        styledRouting !== tailwindRouting && /styled/i.test(styledRouting) && /tailwind/i.test(tailwindRouting),
        'PrimeReact styled and tailwind documentation did not route to distinct mode-specific results.'
      );
    }

    return { toolNames };
  } finally {
    await client.close();
  }
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
    ...claudeUsageContracts[library],
    mcpPackage: lock?.mcp.package,
    mcpVersion: lock?.mcp.version,
    pluginVersion: lock?.pluginVersion,
    serverName: pluginConfig?.mcp.serverName
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
      assert(/Skills \(1\)/.test(details.stdout), `${library}: Claude details did not discover one skill.`);
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
