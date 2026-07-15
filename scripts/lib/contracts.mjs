import path from 'node:path';

export const libraryOrder = ['primevue', 'primeng', 'primereact'];
export const supportedHosts = ['claude', 'codex', 'copilot', 'cursor', 'gemini'];

export const libraryContracts = {
  primevue: {
    binary: 'primevue-mcp',
    displayName: 'PrimeVue',
    repository: 'https://github.com/primefaces/primeui-plugins',
    serverName: 'primevue',
    skillRoot: 'skills/primevue',
    variants: []
  },
  primeng: {
    binary: 'primeng-mcp',
    displayName: 'PrimeNG',
    repository: 'https://github.com/primefaces/primeui-plugins',
    serverName: 'primeng',
    skillRoot: 'skills/primeng',
    variants: []
  },
  primereact: {
    binary: 'primereact-mcp',
    displayName: 'PrimeReact',
    repository: 'https://github.com/primefaces/primeui-plugins',
    serverName: 'primereact',
    skillRoot: 'skills/primereact',
    variants: ['styled', 'tailwind', 'primitive', 'headless']
  }
};

const exactSemverPattern =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const supportedMcpRangePattern =
  /^>=(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))? <(0|[1-9][0-9]*)\.0\.0$/;
const maximumSafeSemverNumber = BigInt(Number.MAX_SAFE_INTEGER);
const skillHashPattern = /^sha256:[0-9a-f]{64}$/;
const sensitiveKeyPattern = /^(?:api[_-]?key|access[_-]?token|client[_-]?secret|credentials?|password|private[_-]?key|secret|token)$/i;
const skillIdentityPattern = /^[a-z][a-z0-9-]*$/;

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateObject(value, location, requiredKeys, errors, optionalKeys = []) {
  if (!isPlainObject(value)) {
    errors.push(`${location} must be an object.`);
    return false;
  }

  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`${location}.${key} is not allowed.`);
    }
  }

  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${location}.${key} is required.`);
    }
  }

  return true;
}

function validateNonEmptyString(value, location, errors, maximumLength = Number.POSITIVE_INFINITY) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximumLength) {
    const suffix = Number.isFinite(maximumLength) ? ` and at most ${maximumLength} characters` : '';
    errors.push(`${location} must be a non-empty string${suffix}.`);
  }
}

function validateExactArray(value, expected, location, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${location} must be an array.`);
    return;
  }

  if (value.length !== expected.length || value.some((item, index) => item !== expected[index])) {
    errors.push(`${location} must equal [${expected.join(', ')}] in that order.`);
  }
}

function validateStringList(
  value,
  location,
  errors,
  { maximumItems, maximumLength, minimumItems = 1 }
) {
  if (!Array.isArray(value) || value.length < minimumItems || value.length > maximumItems) {
    errors.push(`${location} must contain between ${minimumItems} and ${maximumItems} strings.`);
    return;
  }

  value.forEach((item, index) =>
    validateNonEmptyString(item, `${location}[${index}]`, errors, maximumLength)
  );
  if (new Set(value).size !== value.length) {
    errors.push(`${location} must not contain duplicate values.`);
  }
}

function validateKnownLibraryOrder(entries, location, errors) {
  if (!Array.isArray(entries)) {
    errors.push(`${location} must be an array.`);
    return false;
  }

  const names = entries.map((entry) => (isPlainObject(entry) ? entry.name : undefined));
  validateExactArray(names, libraryOrder, `${location} names`, errors);

  if (new Set(names).size !== names.length) {
    errors.push(`${location} must not contain duplicate plugin names.`);
  }

  return true;
}

function validateSafeHttpsUrl(value, location, errors, expectedValue) {
  if (typeof value !== 'string' || value.includes('%')) {
    errors.push(`${location} must be an unencoded HTTPS URL.`);
    return;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push(`${location} must be a valid HTTPS URL.`);
    return;
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    errors.push(`${location} must use HTTPS without credentials, query, or fragment.`);
  }

  if (expectedValue !== undefined && value !== expectedValue) {
    errors.push(`${location} must equal ${expectedValue}.`);
  }
}

function validateSensitiveKeys(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateSensitiveKeys(item, `${location}[${index}]`, errors));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (sensitiveKeyPattern.test(key)) {
      errors.push(`${location}.${key} is a forbidden secret-bearing field.`);
    }
    validateSensitiveKeys(child, `${location}.${key}`, errors);
  }
}

export function isExactSemver(value) {
  return typeof value === 'string' && exactSemverPattern.test(value);
}

function safeSemverNumber(value) {
  const parsed = BigInt(value);
  return parsed <= maximumSafeSemverNumber ? parsed : undefined;
}

function parsePrerelease(value) {
  if (value === undefined) {
    return [];
  }
  const identifiers = value.split('.');
  for (const identifier of identifiers) {
    if (/^[0-9]+$/.test(identifier) && safeSemverNumber(identifier) === undefined) {
      return undefined;
    }
  }
  return identifiers;
}

export function parseExactSemver(value) {
  if (!isExactSemver(value)) {
    return undefined;
  }
  const withoutBuild = value.split('+', 1)[0];
  const prereleaseSeparator = withoutBuild.indexOf('-');
  const core = prereleaseSeparator === -1
    ? withoutBuild
    : withoutBuild.slice(0, prereleaseSeparator);
  const prereleaseValue = prereleaseSeparator === -1
    ? undefined
    : withoutBuild.slice(prereleaseSeparator + 1);
  const [majorValue, minorValue, patchValue] = core.split('.');
  const major = safeSemverNumber(majorValue);
  const minor = safeSemverNumber(minorValue);
  const patch = safeSemverNumber(patchValue);
  const prerelease = parsePrerelease(prereleaseValue);
  if (major === undefined || minor === undefined || patch === undefined || prerelease === undefined) {
    return undefined;
  }
  return { major, minor, patch, prerelease };
}

export function parseSupportedMcpVersionRange(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const match = supportedMcpRangePattern.exec(value);
  if (match === null) {
    return undefined;
  }
  const lowerMajor = safeSemverNumber(match[1]);
  const lowerMinor = safeSemverNumber(match[2]);
  const lowerPatch = safeSemverNumber(match[3]);
  const lowerPrerelease = parsePrerelease(match[4]);
  const upperMajor = safeSemverNumber(match[5]);
  if (
    lowerMajor === undefined ||
    lowerMinor === undefined ||
    lowerPatch === undefined ||
    lowerPrerelease === undefined ||
    upperMajor === undefined ||
    upperMajor !== lowerMajor + 1n
  ) {
    return undefined;
  }
  return {
    lower: {
      major: lowerMajor,
      minor: lowerMinor,
      patch: lowerPatch,
      prerelease: lowerPrerelease
    },
    upper: { major: upperMajor, minor: 0n, patch: 0n, prerelease: [] }
  };
}

export function isSupportedMcpVersionRange(value) {
  return parseSupportedMcpVersionRange(value) !== undefined;
}

function compareSemver(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] < right[key]) return -1;
    if (left[key] > right[key]) return 1;
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return left.prerelease.length === right.prerelease.length
      ? 0
      : left.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      return leftIdentifier === rightIdentifier ? 0 : leftIdentifier === undefined ? -1 : 1;
    }
    const leftNumeric = /^[0-9]+$/.test(leftIdentifier);
    const rightNumeric = /^[0-9]+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) {
      const leftNumber = BigInt(leftIdentifier);
      const rightNumber = BigInt(rightIdentifier);
      if (leftNumber < rightNumber) return -1;
      if (leftNumber > rightNumber) return 1;
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    } else if (leftIdentifier !== rightIdentifier) {
      return leftIdentifier < rightIdentifier ? -1 : 1;
    }
  }
  return 0;
}

export function satisfiesMcpVersionRange(version, versionRange) {
  const parsedVersion = parseExactSemver(version);
  const parsedRange = parseSupportedMcpVersionRange(versionRange);
  return parsedVersion !== undefined && parsedRange !== undefined &&
    compareSemver(parsedVersion, parsedRange.lower) >= 0 &&
    compareSemver(parsedVersion, parsedRange.upper) < 0;
}

export function mcpPackageSpec(mcp) {
  return `${mcp.package}@${mcp.versionRange}`;
}

export function isSafeRelativePath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    value.includes('%') ||
    value.includes('\0') ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    /^[A-Za-z]:/.test(value) ||
    path.posix.isAbsolute(value) ||
    value.startsWith('-') ||
    value.includes('//') ||
    path.posix.normalize(value) !== value
  ) {
    return false;
  }

  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export function stableStringify(value) {
  function sortRecursively(current) {
    if (Array.isArray(current)) {
      return current.map(sortRecursively);
    }

    if (!isPlainObject(current)) {
      return current;
    }

    return Object.fromEntries(
      Object.keys(current)
        .sort(compareStrings)
        .map((key) => [key, sortRecursively(current[key])])
    );
  }

  return `${JSON.stringify(sortRecursively(value), null, 2)}\n`;
}

export function normalizeHostSkillName(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function validateSkillSet(skills, pluginName, expected, location, errors, { locked = false } = {}) {
  if (!Array.isArray(skills) || skills.length === 0) {
    errors.push(`${location} must be a non-empty ordered array.`);
    return;
  }

  const ids = new Set();
  const names = new Set();
  const directories = new Set();
  const sourcePaths = new Set();
  const normalizedNames = new Map();
  const normalizedDirectories = new Map();
  for (const [index, skill] of skills.entries()) {
    const skillLocation = `${location}[${index}]`;
    const required = locked
      ? ['directory', 'id', 'name', 'order', 'owner', 'source']
      : ['directory', 'id', 'name', 'order', 'owner', 'sourcePath'];
    if (!validateObject(skill, skillLocation, required, errors)) {
      continue;
    }

    for (const field of ['id', 'name', 'directory']) {
      if (typeof skill[field] !== 'string' || !skillIdentityPattern.test(skill[field])) {
        errors.push(`${skillLocation}.${field} must be a lowercase skill identifier.`);
      }
    }
    if (skill.order !== index) {
      errors.push(`${skillLocation}.order must equal its declared array index ${index}.`);
    }
    if (skill.owner !== pluginName) {
      errors.push(`${skillLocation}.owner must equal selected library ${pluginName}.`);
    }

    const source = locked ? skill.source : undefined;
    const sourcePath = locked ? source?.path : skill.sourcePath;
    if (locked) {
      if (validateObject(source, `${skillLocation}.source`, ['path', 'repository', 'treeHash'], errors)) {
        validateSafeHttpsUrl(source.repository, `${skillLocation}.source.repository`, errors, expected.repository);
        if (source.treeHash !== null && !skillHashPattern.test(source.treeHash)) {
          errors.push(`${skillLocation}.source.treeHash must be null or sha256:<64 lowercase hex>.`);
        }
      }
    }
    if (!isSafeRelativePath(sourcePath)) {
      errors.push(`${skillLocation}.${locked ? 'source.path' : 'sourcePath'} must be a safe normalized relative POSIX path.`);
    } else if (sourcePath !== expected.skillRoot && !sourcePath.startsWith(`${expected.skillRoot}/`)) {
      errors.push(`${skillLocation}.${locked ? 'source.path' : 'sourcePath'} must be owned by ${expected.skillRoot}.`);
    }

    for (const [set, value, label] of [
      [ids, skill.id, 'id'],
      [names, skill.name, 'name'],
      [directories, skill.directory, 'directory'],
      [sourcePaths, sourcePath, locked ? 'source.path' : 'sourcePath']
    ]) {
      if (set.has(value)) {
        errors.push(`${location} contains duplicate ${label} ${value}.`);
      }
      set.add(value);
    }
    if (typeof skill.name === 'string') {
      const normalized = normalizeHostSkillName(skill.name);
      const prior = normalizedNames.get(normalized);
      if (prior !== undefined) {
        errors.push(`${location} skill names ${prior} and ${skill.name} collide after host normalization (${normalized}).`);
      }
      normalizedNames.set(normalized, skill.name);
    }
    if (typeof skill.directory === 'string') {
      const normalized = normalizeHostSkillName(skill.directory);
      const prior = normalizedDirectories.get(normalized);
      if (prior !== undefined) {
        errors.push(`${location} directories ${prior} and ${skill.directory} collide after host normalization (${normalized}).`);
      }
      normalizedDirectories.set(normalized, skill.directory);
    }
  }
}

export function validatePluginsConfig(config) {
  const errors = [];
  validateSensitiveKeys(config, 'plugins', errors);

  if (!validateObject(config, 'plugins', ['$schema', 'marketplace', 'plugins', 'schemaVersion'], errors)) {
    return errors;
  }

  if (config.$schema !== './schemas/plugins.schema.json') {
    errors.push('plugins.$schema must equal ./schemas/plugins.schema.json.');
  }
  if (config.schemaVersion !== 3) {
    errors.push('plugins.schemaVersion must equal 3.');
  }

  const marketplace = config.marketplace;
  if (
    validateObject(
      marketplace,
      'plugins.marketplace',
      ['codexPolicy', 'description', 'displayName', 'name', 'publisher', 'repository'],
      errors
    )
  ) {
    if (marketplace.name !== 'primeui') {
      errors.push('plugins.marketplace.name must equal primeui.');
    }
    validateNonEmptyString(marketplace.description, 'plugins.marketplace.description', errors, 160);
    validateNonEmptyString(marketplace.displayName, 'plugins.marketplace.displayName', errors);
    validateSafeHttpsUrl(
      marketplace.repository,
      'plugins.marketplace.repository',
      errors,
      'https://github.com/primefaces/primeui-plugins'
    );

    if (validateObject(marketplace.publisher, 'plugins.marketplace.publisher', ['name', 'url'], errors)) {
      validateNonEmptyString(marketplace.publisher.name, 'plugins.marketplace.publisher.name', errors);
      validateSafeHttpsUrl(marketplace.publisher.url, 'plugins.marketplace.publisher.url', errors);
    }

    if (
      validateObject(
        marketplace.codexPolicy,
        'plugins.marketplace.codexPolicy',
        ['authentication', 'installation'],
        errors
      )
    ) {
      if (!['ON_INSTALL', 'ON_USE'].includes(marketplace.codexPolicy.authentication)) {
        errors.push('plugins.marketplace.codexPolicy.authentication is invalid.');
      }
      if (!['NOT_AVAILABLE', 'AVAILABLE', 'INSTALLED_BY_DEFAULT'].includes(marketplace.codexPolicy.installation)) {
        errors.push('plugins.marketplace.codexPolicy.installation is invalid.');
      }
    }
  }

  if (!validateKnownLibraryOrder(config.plugins, 'plugins.plugins', errors)) {
    return errors;
  }

  config.plugins.forEach((plugin, index) => {
    const location = `plugins.plugins[${index}]`;
    if (
      !validateObject(
        plugin,
        location,
        [
          'category',
          'description',
          'displayName',
          'hosts',
          'installSurface',
          'mcp',
          'name',
          'outputs',
          'skills',
          'variants'
        ],
        errors
      )
    ) {
      return;
    }

    const expected = libraryContracts[plugin.name];
    if (!expected) {
      errors.push(`${location}.name is not a supported library.`);
      return;
    }

    if (plugin.displayName !== expected.displayName) {
      errors.push(`${location}.displayName must equal ${expected.displayName}.`);
    }
    validateNonEmptyString(plugin.description, `${location}.description`, errors, 160);
    if (plugin.category !== 'Developer Tools') {
      errors.push(`${location}.category must equal Developer Tools.`);
    }
    validateExactArray(plugin.hosts, supportedHosts, `${location}.hosts`, errors);

    validateExactArray(plugin.variants, expected.variants, `${location}.variants`, errors);

    if (
      validateObject(
        plugin.installSurface,
        `${location}.installSurface`,
        ['capabilities', 'defaultPrompt', 'longDescription', 'shortDescription'],
        errors
      )
    ) {
      validateNonEmptyString(
        plugin.installSurface.shortDescription,
        `${location}.installSurface.shortDescription`,
        errors,
        80
      );
      validateNonEmptyString(
        plugin.installSurface.longDescription,
        `${location}.installSurface.longDescription`,
        errors,
        240
      );
      validateStringList(
        plugin.installSurface.capabilities,
        `${location}.installSurface.capabilities`,
        errors,
        { maximumItems: 6, maximumLength: 40 }
      );
      validateStringList(
        plugin.installSurface.defaultPrompt,
        `${location}.installSurface.defaultPrompt`,
        errors,
        { maximumItems: 3, maximumLength: 128 }
      );
    }

    if (validateObject(plugin.mcp, `${location}.mcp`, ['binary', 'package', 'serverName', 'versionRange'], errors)) {
      const expectedPackage = `@${plugin.name}/mcp`;
      if (plugin.mcp.binary !== expected.binary) {
        errors.push(`${location}.mcp.binary must equal ${expected.binary}.`);
      }
      if (plugin.mcp.package !== expectedPackage) {
        errors.push(`${location}.mcp.package must equal ${expectedPackage}.`);
      }
      if (plugin.mcp.serverName !== expected.serverName) {
        errors.push(`${location}.mcp.serverName must equal ${expected.serverName}.`);
      }
      if (!isSupportedMcpVersionRange(plugin.mcp.versionRange)) {
        errors.push(`${location}.mcp.versionRange must be one inclusive lower bound and one exclusive adjacent next-major upper bound.`);
      }
    }

    validateSkillSet(plugin.skills, plugin.name, expected, `${location}.skills`, errors);

    if (validateObject(plugin.outputs, `${location}.outputs`, ['plugin'], errors)) {
      const expectedPluginPath = `plugins/${plugin.name}`;
      if (!isSafeRelativePath(plugin.outputs.plugin)) {
        errors.push(`${location}.outputs.plugin must be a safe normalized relative POSIX path.`);
      }
      if (plugin.outputs.plugin !== expectedPluginPath) {
        errors.push(`${location}.outputs.plugin must equal ${expectedPluginPath}.`);
      }
    }
  });

  return errors;
}

export function validateSourcesLock(lockConfig, pluginsConfig, { release = false } = {}) {
  const errors = [];
  validateSensitiveKeys(lockConfig, 'sourcesLock', errors);

  if (!validateObject(lockConfig, 'sourcesLock', ['$schema', 'schemaVersion', 'sources'], errors)) {
    return errors;
  }

  if (lockConfig.$schema !== './schemas/sources-lock.schema.json') {
    errors.push('sourcesLock.$schema must equal ./schemas/sources-lock.schema.json.');
  }
  if (lockConfig.schemaVersion !== 4) {
    errors.push('sourcesLock.schemaVersion must equal 4.');
  }
  if (!validateKnownLibraryOrder(lockConfig.sources, 'sourcesLock.sources', errors)) {
    return errors;
  }

  lockConfig.sources.forEach((lock, index) => {
    const location = `sourcesLock.sources[${index}]`;
    if (
      !validateObject(
        lock,
        location,
        ['lockState', 'name', 'pluginVersion', 'skills'],
        errors,
        ['unresolvedReason']
      )
    ) {
      return;
    }

    const expected = libraryContracts[lock.name];
    const plugin = Array.isArray(pluginsConfig?.plugins)
      ? pluginsConfig.plugins.find((candidate) => candidate.name === lock.name)
      : undefined;
    if (!expected) {
      errors.push(`${location}.name is not a supported library.`);
      return;
    }

    if (!['locked', 'unresolved'].includes(lock.lockState)) {
      errors.push(`${location}.lockState must be locked or unresolved.`);
    }
    if (!isExactSemver(lock.pluginVersion)) {
      errors.push(`${location}.pluginVersion must be an exact SemVer.`);
    }

    validateSkillSet(lock.skills, lock.name, expected, `${location}.skills`, errors, { locked: true });
    const missingReleaseFields = Array.isArray(lock.skills)
      ? lock.skills.flatMap((skill, skillIndex) => skill?.source?.treeHash === null ? [`skills[${skillIndex}].source.treeHash`] : [])
      : ['skills'];
    if (plugin && Array.isArray(plugin.skills) && Array.isArray(lock.skills)) {
      const pluginShape = plugin.skills.map(({ directory, id, name, order, owner, sourcePath }) => ({ directory, id, name, order, owner, sourcePath }));
      const lockShape = lock.skills.map(({ directory, id, name, order, owner, source }) => ({ directory, id, name, order, owner, sourcePath: source?.path }));
      if (JSON.stringify(pluginShape) !== JSON.stringify(lockShape)) {
        errors.push(`${location}.skills must match config/plugins.json identity, order, ownership, directory, and source paths.`);
      }
    }

    if (lock.lockState === 'locked') {
      if (Object.hasOwn(lock, 'unresolvedReason')) {
        errors.push(`${location}.unresolvedReason is forbidden for a locked source.`);
      }
      if (missingReleaseFields.length > 0) {
        errors.push(`${location} is locked but missing ${missingReleaseFields.join(', ')}.`);
      }
    }

    if (lock.lockState === 'unresolved') {
      validateNonEmptyString(lock.unresolvedReason, `${location}.unresolvedReason`, errors);
      if (missingReleaseFields.length === 0) {
        errors.push(`${location} is unresolved but contains a complete source lock.`);
      }
    }

    if (release && lock.lockState !== 'locked') {
      const suffix = missingReleaseFields.length > 0 ? `; missing ${missingReleaseFields.join(', ')}` : '';
      errors.push(`${location} (${lock.name}) is not release-ready${suffix}.`);
    }
  });

  return errors;
}

export function validatePackageManifest(packageManifest) {
  const errors = [];
  const requiredKeys = ['description', 'engines', 'license', 'name', 'private', 'scripts', 'type', 'version'];
  const forbiddenKeys = [
    'dependencies',
    'devDependencies',
    'files',
    'optionalDependencies',
    'peerDependencies',
    'publishConfig',
    'workspaces'
  ];

  if (!validateObject(packageManifest, 'package', requiredKeys, errors)) {
    return errors;
  }
  for (const key of forbiddenKeys) {
    if (Object.hasOwn(packageManifest, key)) {
      errors.push(`package.${key} is forbidden in the non-publishable dependency-free package.`);
    }
  }
  if (packageManifest.private !== true) {
    errors.push('package.private must be true.');
  }
  if (packageManifest.license !== 'UNLICENSED') {
    errors.push('package.license must equal UNLICENSED.');
  }
  if (packageManifest.type !== 'module') {
    errors.push('package.type must equal module.');
  }
  if (packageManifest.version !== '0.0.0-private') {
    errors.push('package.version must equal 0.0.0-private.');
  }
  if (!isPlainObject(packageManifest.engines) || packageManifest.engines.node !== '>=22') {
    errors.push('package.engines.node must equal >=22.');
  }

  const requiredScripts = [
    'build:public',
    'check',
    'check:boundaries',
    'check:clean',
    'check:security',
    'export:gemini',
    'format:check',
    'lock:sources',
    'prepublishOnly',
    'sync',
    'sync:check',
    'test',
    'validate:claude',
    'validate:codex',
    'validate:config',
    'validate:cursor',
    'validate:gemini',
    'validate:release'
  ];
  if (!isPlainObject(packageManifest.scripts)) {
    errors.push('package.scripts must be an object.');
  } else {
    validateExactArray(Object.keys(packageManifest.scripts), requiredScripts, 'package.scripts keys', errors);
    if (packageManifest.scripts.prepublishOnly !== 'node scripts/deny-publish.mjs') {
      errors.push('package.scripts.prepublishOnly must run the publish denial script.');
    }
  }

  return errors;
}

function validateLocalSchemaReferences(schema) {
  const errors = [];

  function resolvePointer(reference) {
    if (!reference.startsWith('#/')) {
      return undefined;
    }

    return reference
      .slice(2)
      .split('/')
      .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
      .reduce(
        (current, segment) =>
          isPlainObject(current) || Array.isArray(current) ? current[segment] : undefined,
        schema
      );
  }

  function visit(value, location) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${location}[${index}]`));
      return;
    }
    if (!isPlainObject(value)) {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const childLocation = `${location}.${key}`;
      if (key === '$ref') {
        if (typeof child !== 'string' || !child.startsWith('#/')) {
          errors.push(`${childLocation} must be a local JSON Pointer reference.`);
        } else if (resolvePointer(child) === undefined) {
          errors.push(`${childLocation} does not resolve: ${child}.`);
        }
      } else {
        visit(child, childLocation);
      }
    }
  }

  visit(schema, 'schema');
  return errors;
}

export function validateSchemaDocument(
  schema,
  { collectionProperty, expectedId, expectedItemRefs, requiredProperties }
) {
  const errors = [];
  if (!isPlainObject(schema)) {
    return ['Schema must be an object.'];
  }
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    errors.push('Schema must declare JSON Schema draft 2020-12.');
  }
  if (schema.$id !== expectedId) {
    errors.push(`Schema $id must equal ${expectedId}.`);
  }
  if (schema.type !== 'object' || schema.additionalProperties !== false) {
    errors.push('Schema root must be a closed object.');
  }
  if (!isPlainObject(schema.properties)) {
    errors.push('Schema root must declare properties.');
  }
  if (!Array.isArray(schema.required)) {
    errors.push('Schema root must declare required properties.');
  } else {
    for (const property of requiredProperties) {
      if (!schema.required.includes(property)) {
        errors.push(`Schema root must require ${property}.`);
      }
    }
  }
  errors.push(...validateLocalSchemaReferences(schema));

  if (collectionProperty !== undefined && expectedItemRefs !== undefined) {
    const collection = schema.properties?.[collectionProperty];
    if (!isPlainObject(collection) || collection.items !== false) {
      errors.push(`Schema ${collectionProperty} must close tuple items with items: false.`);
    }
    const actualReferences = Array.isArray(collection?.prefixItems)
      ? collection.prefixItems.map((item) => item?.$ref)
      : [];
    if (
      actualReferences.length !== expectedItemRefs.length ||
      actualReferences.some((reference, index) => reference !== expectedItemRefs[index])
    ) {
      errors.push(`Schema ${collectionProperty} must use the exact ordered library definitions.`);
    }
  }
  return errors;
}
