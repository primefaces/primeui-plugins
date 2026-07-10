import {
  access,
  cp,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isExactSemver } from './contracts.mjs';
import { readDistributionConfiguration } from './generator.mjs';
import { smokeInstalledMcp } from './mcp-smoke.mjs';
import { hasProcessTreeInspection } from './process.mjs';
import { inspectSkillTree } from './skill-tree.mjs';
import { libraryNames, usageContracts } from './smoke-contracts.mjs';
const sourceNames = ['payload', 'marketplace'];
const pluginNamePattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const pluginManifestKeys = new Set([
  'agents',
  'author',
  'category',
  'commands',
  'description',
  'displayName',
  'homepage',
  'hooks',
  'keywords',
  'license',
  'logo',
  'mcpServers',
  'name',
  'publisher',
  'repository',
  'rules',
  'skills',
  'tags',
  'version'
]);
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
  'TERM',
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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertAllowedKeys(value, allowedKeys, label) {
  assert(isPlainObject(value), `${label} must be an object.`);
  for (const key of Object.keys(value)) {
    assert(allowedKeys.has(key), `${label}.${key} is not allowed by the current Cursor schema.`);
  }
}

function normalizedCursorRelativePath(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string.`);
  assert(!value.includes('\\') && !value.includes('%') && !value.includes('\0'), `${label} is unsafe.`);
  assert(!path.posix.isAbsolute(value) && !/^[A-Za-z]:/.test(value), `${label} must be relative.`);
  const withoutPrefix = value.startsWith('./') ? value.slice(2) : value;
  const withoutTrailingSlash = withoutPrefix.endsWith('/')
    ? withoutPrefix.slice(0, -1)
    : withoutPrefix;
  assert(withoutTrailingSlash.length > 0, `${label} must reference a path.`);
  assert(
    withoutTrailingSlash.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
    `${label} must not contain empty, dot, or parent segments.`
  );
  assert(path.posix.normalize(withoutTrailingSlash) === withoutTrailingSlash, `${label} must be normalized.`);
  return withoutTrailingSlash;
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

async function readJson(filePath, label) {
  let content;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    fail(`${label} is missing: ${error.message}`);
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    fail(`${label} is invalid JSON: ${error.message}`);
  }
}

async function resolvePhysicalPath(root, relativePath, label) {
  const normalized = normalizedCursorRelativePath(relativePath, label);
  const candidate = path.join(root, ...normalized.split('/'));
  const stats = await lstat(candidate);
  assert(!stats.isSymbolicLink(), `${label} must not reference a symlink.`);
  const [canonicalRoot, canonicalCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
  const relative = path.relative(canonicalRoot, canonicalCandidate);
  assert(
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative),
    `${label} escaped the plugin root.`
  );
  return canonicalCandidate;
}

export function parseCursorSmokeArguments(argumentsList) {
  const options = {
    keepTemp: false,
    libraries: [...libraryNames],
    sources: ['payload']
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
        options.sources = [...sourceNames];
      } else if (sourceNames.includes(value)) {
        options.sources = [value];
      } else {
        fail(`--source must be all or one of ${sourceNames.join(', ')}.`);
      }
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }

  return options;
}

export function sanitizeCursorProcessEnvironment(environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => safeEnvironmentKeys.has(key.toUpperCase()))
  );
}

export function cursorScenarioEnvironment(root, environment = process.env) {
  const home = path.join(root, 'home');
  const cursorHome = path.join(home, '.cursor');
  const gitGlobalConfig = path.join(root, 'gitconfig');
  const npmCache = path.join(root, 'npm-cache');
  const npmGlobalConfig = path.join(root, 'npm-globalrc');
  const npmUserConfig = path.join(root, 'npmrc');
  const temporaryDirectory = path.join(root, 'tmp');
  const xdgCache = path.join(root, 'xdg-cache');
  const xdgConfig = path.join(root, 'xdg-config');
  return {
    cursorHome,
    env: {
      ...sanitizeCursorProcessEnvironment(environment),
      GIT_CONFIG_GLOBAL: gitGlobalConfig,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      HOME: home,
      NPM_CONFIG_GLOBALCONFIG: npmGlobalConfig,
      NPM_CONFIG_USERCONFIG: npmUserConfig,
      TEMP: temporaryDirectory,
      TMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      USERPROFILE: home,
      XDG_CACHE_HOME: xdgCache,
      XDG_CONFIG_HOME: xdgConfig,
      npm_config_cache: npmCache,
      npm_config_globalconfig: npmGlobalConfig,
      npm_config_userconfig: npmUserConfig
    },
    gitGlobalConfig,
    home,
    localPluginsRoot: path.join(cursorHome, 'plugins', 'local'),
    npmCache,
    npmGlobalConfig,
    npmUserConfig,
    temporaryDirectory,
    xdgCache,
    xdgConfig
  };
}

async function createScenarioRoot(prefix) {
  assert(
    hasProcessTreeInspection(),
    'Cursor MCP validation requires process-tree inspection so timed-out descendants cannot escape cleanup.'
  );
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  const scenario = cursorScenarioEnvironment(root);
  const unrelatedRoot = path.join(scenario.localPluginsRoot, 'unrelated-plugin');
  await Promise.all(
    [
      scenario.localPluginsRoot,
      scenario.npmCache,
      scenario.temporaryDirectory,
      scenario.xdgCache,
      scenario.xdgConfig,
      unrelatedRoot
    ].map((directory) => mkdir(directory, { recursive: true }))
  );
  await Promise.all([
    writeFile(scenario.gitGlobalConfig, ''),
    writeFile(scenario.npmGlobalConfig, ''),
    writeFile(scenario.npmUserConfig, ''),
    writeFile(path.join(scenario.cursorHome, 'sentinel.txt'), 'preserve\n'),
    writeFile(path.join(unrelatedRoot, 'sentinel.txt'), 'preserve unrelated\n')
  ]);
  return { ...scenario, root, unrelatedRoot };
}

export function validateCursorPluginManifest(manifest, library) {
  assertAllowedKeys(manifest, pluginManifestKeys, `${library} Cursor manifest`);
  assert(typeof manifest.name === 'string' && pluginNamePattern.test(manifest.name), `${library}: invalid Cursor plugin name.`);
  assert(manifest.name === library, `${library}: Cursor manifest name does not match.`);
  if (manifest.version !== undefined) {
    assert(isExactSemver(manifest.version), `${library}: Cursor manifest version must be exact SemVer.`);
  }
  if (manifest.author !== undefined) {
    assertAllowedKeys(manifest.author, new Set(['email', 'name']), `${library} Cursor manifest author`);
    assert(typeof manifest.author.name === 'string' && manifest.author.name.length > 0, `${library}: Cursor manifest author.name is required.`);
  }
  for (const key of [
    'category',
    'description',
    'displayName',
    'homepage',
    'license',
    'logo',
    'publisher',
    'repository'
  ]) {
    if (manifest[key] !== undefined) {
      assert(typeof manifest[key] === 'string' && manifest[key].length > 0, `${library}: Cursor manifest ${key} must be a non-empty string.`);
    }
  }
  assert(manifest.skills === './skills/', `${library}: Cursor manifest must point skills to ./skills/.`);
  assert(manifest.mcpServers === './.mcp.json', `${library}: Cursor manifest must point MCP to ./.mcp.json.`);
  return manifest;
}

export async function assertCursorPayload({ contract, installPath, library }) {
  const canonicalInstallPath = await realpath(installPath);
  const manifestPath = path.join(canonicalInstallPath, '.cursor-plugin', 'plugin.json');
  const manifest = validateCursorPluginManifest(
    await readJson(manifestPath, `${library} Cursor manifest`),
    library
  );
  assert(manifest.version === contract.pluginVersion, `${library}: Cursor plugin version does not match.`);
  assert(manifest.description === contract.description, `${library}: Cursor description does not match.`);
  assert(manifest.displayName === contract.displayName, `${library}: Cursor display name does not match.`);
  assert(manifest.author?.name === contract.publisherName, `${library}: Cursor author does not match.`);
  assert(manifest.repository === contract.repository, `${library}: Cursor repository does not match.`);

  const [skillsRoot, mcpPath] = await Promise.all([
    resolvePhysicalPath(canonicalInstallPath, manifest.skills, `${library} Cursor skills path`),
    resolvePhysicalPath(canonicalInstallPath, manifest.mcpServers, `${library} Cursor MCP path`)
  ]);
  const skillEntries = await readdir(skillsRoot, { withFileTypes: true });
  assert(
    skillEntries.length === 1 &&
      skillEntries[0].name === library &&
      skillEntries[0].isDirectory() &&
      !skillEntries[0].isSymbolicLink(),
    `${library}: Cursor payload must contain exactly one physical matching skill directory.`
  );
  const skillRoot = path.join(skillsRoot, library);
  const skillInspection = await inspectSkillTree(skillRoot);
  assert(skillInspection.hash === contract.skillHash, `${library}: Cursor skill hash does not match.`);
  const skill = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
  assert(new RegExp(`^name: ${library}$`, 'm').test(skill), `${library}: Cursor skill name does not match.`);

  const mcp = await readJson(mcpPath, `${library} Cursor MCP configuration`);
  const serverNames = Object.keys(mcp.mcpServers ?? {});
  assert(
    serverNames.length === 1 && serverNames[0] === library,
    `${library}: Cursor payload must contain exactly one matching MCP server.`
  );
  assert(mcp.mcpServers[library].command === 'npx', `${library}: Cursor MCP command must be npx.`);
  assert(
    JSON.stringify(mcp.mcpServers[library].args) ===
      JSON.stringify(['-y', `${contract.mcpPackage}@${contract.mcpVersion}`]),
    `${library}: Cursor MCP package pin does not match.`
  );

  const provenance = await readJson(
    path.join(canonicalInstallPath, 'provenance.json'),
    `${library} Cursor provenance`
  );
  assert(provenance.name === library, `${library}: Cursor provenance name does not match.`);
  assert(provenance.pluginVersion === contract.pluginVersion, `${library}: Cursor provenance version does not match.`);
  assert(
    provenance.mcp?.package === contract.mcpPackage &&
      provenance.mcp?.version === contract.mcpVersion,
    `${library}: Cursor provenance MCP pin does not match.`
  );
  assert(provenance.source?.skillHash === contract.skillHash, `${library}: Cursor provenance skill hash does not match.`);

  for (const foreignLibrary of libraryNames.filter((name) => name !== library)) {
    assert(
      !(await pathExists(path.join(skillsRoot, foreignLibrary))),
      `${library}: Cursor payload contains foreign skill ${foreignLibrary}.`
    );
    assert(
      !Object.hasOwn(mcp.mcpServers, foreignLibrary),
      `${library}: Cursor payload contains foreign MCP server ${foreignLibrary}.`
    );
  }

  return { manifest, mcp, mcpPath, skillRoot };
}

export async function resolveCursorMarketplace(repositoryRoot, pluginsConfig) {
  const marketplacePath = path.join(repositoryRoot, '.cursor-plugin', 'marketplace.json');
  const marketplace = await readJson(marketplacePath, 'Cursor marketplace manifest');
  assertAllowedKeys(
    marketplace,
    new Set(['metadata', 'name', 'owner', 'plugins']),
    'Cursor marketplace manifest'
  );
  assert(marketplace.name === pluginsConfig.marketplace.name, 'Cursor marketplace name does not match.');
  if (marketplace.owner !== undefined) {
    assertAllowedKeys(marketplace.owner, new Set(['email', 'name']), 'Cursor marketplace owner');
    assert(
      marketplace.owner.name === pluginsConfig.marketplace.publisher.name,
      'Cursor marketplace owner does not match.'
    );
  }
  if (marketplace.metadata !== undefined) {
    assert(isPlainObject(marketplace.metadata), 'Cursor marketplace metadata must be an object.');
    assert(
      marketplace.metadata.description === pluginsConfig.marketplace.description,
      'Cursor marketplace description does not match.'
    );
  }
  assert(Array.isArray(marketplace.plugins), 'Cursor marketplace plugins must be an array.');
  assert(marketplace.plugins.length === libraryNames.length, 'Cursor marketplace must contain exactly three plugins.');

  const resolved = new Map();
  for (const [index, plugin] of pluginsConfig.plugins.entries()) {
    const entry = marketplace.plugins[index];
    assertAllowedKeys(entry, new Set(['description', 'name', 'source']), `Cursor marketplace plugins[${index}]`);
    assert(entry.name === plugin.name, `Cursor marketplace entry ${index} name does not match.`);
    assert(entry.description === plugin.description, `${plugin.name}: Cursor marketplace description does not match.`);
    assert(entry.source === `./plugins/${plugin.name}`, `${plugin.name}: Cursor marketplace source does not match.`);
    const pluginRoot = await resolvePhysicalPath(
      repositoryRoot,
      entry.source,
      `${plugin.name} Cursor marketplace source`
    );
    const manifest = await readJson(
      path.join(pluginRoot, '.cursor-plugin', 'plugin.json'),
      `${plugin.name} Cursor plugin manifest`
    );
    assert(manifest.name === entry.name, `${plugin.name}: marketplace and plugin manifest names differ.`);
    resolved.set(plugin.name, pluginRoot);
  }
  return resolved;
}

async function assertUnrelatedState(scenario) {
  assert(
    (await readFile(path.join(scenario.cursorHome, 'sentinel.txt'), 'utf8')) === 'preserve\n',
    'Cursor staging changed unrelated temporary Cursor state.'
  );
  assert(
    (await readFile(path.join(scenario.unrelatedRoot, 'sentinel.txt'), 'utf8')) ===
      'preserve unrelated\n',
    'Cursor staging changed an unrelated temporary local plugin.'
  );
}

async function installPayload(sourceRoot, installPath) {
  await cp(sourceRoot, installPath, {
    errorOnExist: true,
    force: false,
    recursive: true,
    verbatimSymlinks: true
  });
  const stats = await lstat(installPath);
  assert(stats.isDirectory() && !stats.isSymbolicLink(), 'Cursor staged payload must be a physical directory.');
}

export async function inspectCursorRuntime(environment = process.env) {
  const candidates = [];
  for (const directory of (environment.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(directory, process.platform === 'win32' ? 'cursor.exe' : 'cursor'));
  }
  if (process.platform === 'darwin') {
    candidates.push('/Applications/Cursor.app');
    if (environment.HOME) {
      candidates.push(path.join(environment.HOME, 'Applications', 'Cursor.app'));
    }
  }
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return { available: true, path: candidate };
    }
  }
  return { available: false };
}

export async function runCursorPayloadScenario({
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
    ...usageContracts[library],
    description: plugin.description,
    displayName: plugin.displayName,
    mcpPackage: lock.mcp.package,
    mcpVersion: lock.mcp.version,
    pluginVersion: lock.pluginVersion,
    publisherName: pluginsConfig.marketplace.publisher.name,
    repository: pluginsConfig.marketplace.repository,
    skillHash: lock.source.skillHash
  };

  let sourceRoot;
  if (source === 'marketplace') {
    sourceRoot = (await resolveCursorMarketplace(repositoryRoot, pluginsConfig)).get(library);
  } else {
    sourceRoot = await realpath(path.join(repositoryRoot, plugin.outputs.plugin));
  }
  await assertCursorPayload({ contract, installPath: sourceRoot, library });

  const scenario = await createScenarioRoot(`primeui-cursor-${source}-${library}-`);
  const installPath = path.join(scenario.localPluginsRoot, library);
  const refreshPath = path.join(scenario.root, 'refresh', library);
  try {
    await installPayload(sourceRoot, installPath);
    let payload = await assertCursorPayload({ contract, installPath, library });
    const runtime = await smokeInstalledMcp({
      clientName: 'primeui-plugins-cursor-payload-smoke',
      contract,
      env: scenario.env,
      installPath,
      library,
      mcp: payload.mcp
    });

    await mkdir(path.dirname(refreshPath), { recursive: true });
    await installPayload(sourceRoot, refreshPath);
    await rm(installPath, { force: true, recursive: true });
    await rename(refreshPath, installPath);
    payload = await assertCursorPayload({ contract, installPath, library });
    await assertUnrelatedState(scenario);

    await rm(installPath, { force: true, recursive: true });
    assert(!(await pathExists(installPath)), `${library}: staged Cursor removal left the selected payload behind.`);
    await assertUnrelatedState(scenario);

    await installPayload(sourceRoot, installPath);
    payload = await assertCursorPayload({ contract, installPath, library });
    await rm(installPath, { force: true, recursive: true });
    assert(!(await pathExists(installPath)), `${library}: final staged Cursor cleanup left the selected payload behind.`);
    await assertUnrelatedState(scenario);

    return {
      installPath,
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
