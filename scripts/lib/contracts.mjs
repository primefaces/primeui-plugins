import path from 'node:path';

export const libraryOrder = ['primevue', 'primeng', 'primereact'];
export const supportedHosts = ['claude', 'codex', 'cursor', 'gemini'];

export const libraryContracts = {
  primevue: {
    binary: 'primevue-mcp',
    displayName: 'PrimeVue',
    mcpPackage: '@primevue/mcp',
    repository: 'https://github.com/primefaces/primeui-plugins',
    serverName: 'primevue',
    skillPath: 'skills/primevue',
    variants: []
  },
  primeng: {
    binary: 'primeng-mcp',
    displayName: 'PrimeNG',
    mcpPackage: '@primeng/mcp',
    repository: 'https://github.com/primefaces/primeui-plugins',
    serverName: 'primeng',
    skillPath: 'skills/primeng',
    variants: []
  },
  primereact: {
    binary: 'primereact-mcp',
    displayName: 'PrimeReact',
    mcpPackage: '@primereact/mcp',
    repository: 'https://github.com/primefaces/primeui-plugins',
    serverName: 'primereact',
    skillPath: 'skills/primereact',
    variants: ['styled', 'tailwind', 'primitive', 'headless']
  }
};

const exactSemverPattern =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const skillHashPattern = /^sha256:[0-9a-f]{64}$/;
const sensitiveKeyPattern = /^(?:api[_-]?key|access[_-]?token|client[_-]?secret|credentials?|password|private[_-]?key|secret|token)$/i;

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

export function validatePluginsConfig(config) {
  const errors = [];
  validateSensitiveKeys(config, 'plugins', errors);

  if (!validateObject(config, 'plugins', ['$schema', 'marketplace', 'plugins', 'schemaVersion'], errors)) {
    return errors;
  }

  if (config.$schema !== './schemas/plugins.schema.json') {
    errors.push('plugins.$schema must equal ./schemas/plugins.schema.json.');
  }
  if (config.schemaVersion !== 1) {
    errors.push('plugins.schemaVersion must equal 1.');
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
          'skillSourcePath',
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

    if (validateObject(plugin.mcp, `${location}.mcp`, ['binary', 'package', 'serverName'], errors)) {
      if (plugin.mcp.binary !== expected.binary) {
        errors.push(`${location}.mcp.binary must equal ${expected.binary}.`);
      }
      if (plugin.mcp.package !== expected.mcpPackage) {
        errors.push(`${location}.mcp.package must equal ${expected.mcpPackage}.`);
      }
      if (plugin.mcp.serverName !== expected.serverName) {
        errors.push(`${location}.mcp.serverName must equal ${expected.serverName}.`);
      }
    }

    if (!isSafeRelativePath(plugin.skillSourcePath)) {
      errors.push(`${location}.skillSourcePath must be a safe normalized relative POSIX path.`);
    }
    if (plugin.skillSourcePath !== expected.skillPath) {
      errors.push(`${location}.skillSourcePath must equal ${expected.skillPath}.`);
    }

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
  if (lockConfig.schemaVersion !== 2) {
    errors.push('sourcesLock.schemaVersion must equal 2.');
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
        ['lockState', 'mcp', 'name', 'pluginVersion', 'source'],
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

    if (validateObject(lock.mcp, `${location}.mcp`, ['package', 'version'], errors)) {
      if (lock.mcp.package !== expected.mcpPackage) {
        errors.push(`${location}.mcp.package must equal ${expected.mcpPackage}.`);
      }
      if (!isExactSemver(lock.mcp.version)) {
        errors.push(`${location}.mcp.version must be an exact SemVer.`);
      }
      if (plugin && lock.mcp.package !== plugin.mcp.package) {
        errors.push(`${location}.mcp.package must match config/plugins.json.`);
      }
    }

    let missingReleaseFields = [];
    if (validateObject(lock.source, `${location}.source`, ['repository', 'skillHash', 'skillPath'], errors)) {
      validateSafeHttpsUrl(lock.source.repository, `${location}.source.repository`, errors, expected.repository);
      if (!isSafeRelativePath(lock.source.skillPath)) {
        errors.push(`${location}.source.skillPath must be a safe normalized relative POSIX path.`);
      }
      if (lock.source.skillPath !== expected.skillPath) {
        errors.push(`${location}.source.skillPath must equal ${expected.skillPath}.`);
      }
      if (plugin && lock.source.skillPath !== plugin.skillSourcePath) {
        errors.push(`${location}.source.skillPath must match config/plugins.json.`);
      }

      if (lock.source.skillHash === null) {
        missingReleaseFields.push('source.skillHash');
      } else if (typeof lock.source.skillHash !== 'string' || !skillHashPattern.test(lock.source.skillHash)) {
        errors.push(`${location}.source.skillHash must be null or sha256:<64 lowercase hex>.`);
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
