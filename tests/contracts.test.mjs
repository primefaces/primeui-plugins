import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  isExactSemver,
  isSupportedMcpVersionRange,
  parseSupportedMcpVersionRange,
  isSafeRelativePath,
  satisfiesMcpVersionRange,
  stableStringify,
  validatePackageManifest,
  validatePluginsConfig,
  validateSchemaDocument,
  validateSourcesLock
} from '../scripts/lib/contracts.mjs';
import { repositoryRoot } from '../scripts/lib/repository.mjs';
import { detectSecretKinds } from '../scripts/lib/security.mjs';

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
}

const [pluginsConfig, sourcesLock, packageManifest, pluginsSchema, sourcesLockSchema] = await Promise.all([
  readJson('config/plugins.json'),
  readJson('config/sources.lock.json'),
  readJson('package.json'),
  readJson('config/schemas/plugins.schema.json'),
  readJson('config/schemas/sources-lock.schema.json')
]);

test('authored configuration is valid for development', () => {
  assert.deepEqual(validatePluginsConfig(pluginsConfig), []);
  assert.deepEqual(validateSourcesLock(sourcesLock, pluginsConfig), []);
  assert.deepEqual(validatePackageManifest(packageManifest), []);
});

test('all library plugins declare the exact supported host order including Copilot and Cursor', () => {
  for (const plugin of pluginsConfig.plugins) {
    assert.deepEqual(plugin.hosts, ['claude', 'codex', 'copilot', 'cursor', 'gemini']);
  }
});

test('release validation accepts the complete source locks', () => {
  assert.deepEqual(validateSourcesLock(sourcesLock, pluginsConfig, { release: true }), []);
  assert.equal(sourcesLock.sources.every((lock) => lock.lockState === 'locked'), true);
});

test('release validation rejects every unresolved source lock', () => {
  const unresolved = structuredClone(sourcesLock);
  for (const lock of unresolved.sources) {
    lock.lockState = 'unresolved';
    for (const skill of lock.skills) {
      skill.source.treeHash = null;
    }
    lock.unresolvedReason = 'Hash pending.';
  }
  const errors = validateSourcesLock(unresolved, pluginsConfig, { release: true });
  assert.equal(errors.filter((error) => error.includes('is not release-ready')).length, 3);
  assert.match(errors.join('\n'), /primevue.*source\.treeHash/);
  assert.match(errors.join('\n'), /primeng.*source\.treeHash/);
  assert.match(errors.join('\n'), /primereact.*source\.treeHash/);
});

test('exact SemVer accepts releases and prereleases but rejects moving selectors', () => {
  for (const value of ['0.1.0', '1.2.3-rc.4', '1.2.3-alpha.0+build.7']) {
    assert.equal(isExactSemver(value), true, value);
  }

  for (const value of [
    '01.2.3',
    '1.2.3-01',
    'latest',
    'rc',
    '^1.2.3',
    '~1.2.3',
    '>=1.2.3',
    '1.2.x',
    '1.2.*',
    'v1.2.3',
    'workspace:*',
    'npm:pkg@1.2.3',
    ' 1.2.3'
  ]) {
    assert.equal(isExactSemver(value), false, value);
  }
});

test('authored MCP ranges admit the minimum RC and final while excluding prior and next-major releases', () => {
  for (const plugin of pluginsConfig.plugins) {
    const range = parseSupportedMcpVersionRange(plugin.mcp.versionRange);
    assert.notEqual(range, undefined, plugin.name);
    const major = range.lower.major.toString();
    const minor = range.lower.minor.toString();
    const patch = range.lower.patch.toString();
    const prerelease = range.lower.prerelease.join('.');
    const priorRc = `${major}.${minor}.${patch}-rc.${Number(range.lower.prerelease.at(-1)) - 1}`;
    const minimum = `${major}.${minor}.${patch}-${prerelease}`;
    const final = `${major}.${minor}.${patch}`;
    const nextMajor = `${range.upper.major}.0.0`;

    assert.equal(satisfiesMcpVersionRange(minimum, plugin.mcp.versionRange), true, plugin.name);
    assert.equal(satisfiesMcpVersionRange(final, plugin.mcp.versionRange), true, plugin.name);
    assert.equal(satisfiesMcpVersionRange(priorRc, plugin.mcp.versionRange), false, plugin.name);
    assert.equal(satisfiesMcpVersionRange(nextMajor, plugin.mcp.versionRange), false, plugin.name);
  }
});

test('MCP ranges reject malformed, unbounded, non-adjacent, and unsafe numeric selectors', () => {
  for (const value of [
    '>=1.2.3',
    '>=1.2.3 <=2.0.0',
    '>=1.2.3 <3.0.0',
    '>=1.2.3  <2.0.0',
    '>=1.2.3 <2.1.0',
    '^1.2.3',
    '~1.2.3',
    '1.x',
    '>=1.2.3 <2.0.0 || >=3.0.0 <4.0.0',
    '>=9007199254740993.0.0 <9007199254740994.0.0'
  ]) {
    assert.equal(isSupportedMcpVersionRange(value), false, value);
  }
});

test('relative path validation rejects traversal and platform escapes', () => {
  for (const value of ['skills/primevue', 'plugins/primevue']) {
    assert.equal(isSafeRelativePath(value), true, value);
  }

  for (const value of [
    '',
    '.',
    '..',
    '../primevue',
    'plugins/../primevue',
    '/plugins/primevue',
    'C:/plugins/primevue',
    '\\\\server\\share',
    'plugins\\primevue',
    'plugins//primevue',
    './plugins/primevue',
    'plugins/%2e%2e/primevue',
    '-outside'
  ]) {
    assert.equal(isSafeRelativePath(value), false, value);
  }
});

test('product config rejects unsafe paths, unknown fields, and reordered hosts', () => {
  const unsafe = structuredClone(pluginsConfig);
  unsafe.plugins[0].skills[0].sourcePath = '../primevue';
  unsafe.plugins[0].hosts = ['codex', 'claude', 'gemini'];
  unsafe.plugins[0].mcp.package = unsafe.plugins[1].mcp.package;
  unsafe.plugins[0].token = 'not-allowed';

  const errors = validatePluginsConfig(unsafe).join('\n');
  assert.match(errors, /forbidden secret-bearing field/);
  assert.match(errors, /token is not allowed/);
  assert.match(errors, /hosts must equal/);
  assert.match(errors, /mcp\.package must equal @primevue\/mcp/);
  assert.match(errors, /safe normalized relative POSIX path/);
});

test('install-surface copy is bounded and cannot be left for generation to invent', () => {
  const invalid = structuredClone(pluginsConfig);
  invalid.plugins[0].installSurface.capabilities = [];
  invalid.plugins[1].installSurface.defaultPrompt = ['x'.repeat(129)];

  const errors = validatePluginsConfig(invalid).join('\n');
  assert.match(errors, /installSurface\.capabilities must contain between 1 and 6 strings/);
  assert.match(errors, /installSurface\.defaultPrompt\[0\].*at most 128 characters/);
});

test('Claude marketplace description is authored and bounded', () => {
  const invalid = structuredClone(pluginsConfig);
  invalid.marketplace.description = '';

  assert.match(
    validatePluginsConfig(invalid).join('\n'),
    /marketplace\.description must be a non-empty string and at most 160 characters/
  );
});

test('lock states cannot disguise incomplete or complete source locks', () => {
  const lockedButIncomplete = structuredClone(sourcesLock);
  lockedButIncomplete.sources[1].skills[0].source.treeHash = null;
  assert.match(validateSourcesLock(lockedButIncomplete, pluginsConfig).join('\n'), /locked but missing/);

  const unresolvedButComplete = structuredClone(sourcesLock);
  unresolvedButComplete.sources[0].lockState = 'unresolved';
  unresolvedButComplete.sources[0].unresolvedReason = 'Pending review.';
  assert.match(
    validateSourcesLock(unresolvedButComplete, pluginsConfig).join('\n'),
    /unresolved but contains a complete source lock/
  );
});

test('source locks reject non-exact plugin versions, malformed provenance, and unsafe repositories', () => {
  const invalid = structuredClone(sourcesLock);
  invalid.sources[0].pluginVersion = '^0.1.0';
  invalid.sources[0].mcp = { package: '@fictional/mcp', version: '1.2.3-rc.4' };
  invalid.sources[0].skills[0].source.commit = 'F'.repeat(40);
  invalid.sources[0].skills[0].source.treeHash = `sha256:${'G'.repeat(64)}`;
  invalid.sources[0].skills[0].source.repository = 'https://user:pass@github.com/primefaces/primeui-plugins';

  const errors = validateSourcesLock(invalid, pluginsConfig).join('\n');
  assert.match(errors, /pluginVersion must be an exact SemVer/);
  assert.match(errors, /mcp is not allowed/);
  assert.match(errors, /source\.commit is not allowed/);
  assert.match(errors, /sha256:<64 lowercase hex>/);
  assert.match(errors, /without credentials/);
});

test('source lock cannot reintroduce MCP selection and skill paths cannot drift', () => {
  const drifted = structuredClone(sourcesLock);
  drifted.sources[0].mcp = { package: pluginsConfig.plugins[1].mcp.package, version: '1.2.3-rc.4' };
  drifted.sources[0].skills[0].source.path = 'skills/other';

  const errors = validateSourcesLock(drifted, pluginsConfig).join('\n');
  assert.match(errors, /mcp is not allowed/);
  assert.match(errors, /source\.path must be owned by skills\/primevue/);
  assert.match(errors, /skills must match config\/plugins\.json/);
});

test('package contract blocks dependencies and publication settings', () => {
  const publishable = structuredClone(packageManifest);
  publishable.private = false;
  publishable.dependencies = { ajv: '8.0.0' };
  publishable.publishConfig = { access: 'public' };

  const errors = validatePackageManifest(publishable).join('\n');
  assert.match(errors, /dependencies is forbidden/);
  assert.match(errors, /publishConfig is forbidden/);
  assert.match(errors, /private must be true/);
});

test('stable JSON serialization sorts object keys without changing array order', () => {
  assert.equal(
    stableStringify({ zebra: 1, alpha: { zulu: 2, beta: 3 }, list: ['primevue', 'primeng'] }),
    '{\n  "alpha": {\n    "beta": 3,\n    "zulu": 2\n  },\n  "list": [\n    "primevue",\n    "primeng"\n  ],\n  "zebra": 1\n}\n'
  );
});

test('schemas use ordered per-library definitions and resolve every local reference', () => {
  assert.deepEqual(
    validateSchemaDocument(pluginsSchema, {
      collectionProperty: 'plugins',
      expectedId: 'https://primefaces.org/schemas/primeui-plugins/plugins.schema.json',
      expectedItemRefs: [
        '#/$defs/primevuePlugin',
        '#/$defs/primengPlugin',
        '#/$defs/primereactPlugin'
      ],
      requiredProperties: ['$schema', 'marketplace', 'plugins', 'schemaVersion']
    }),
    []
  );
  assert.deepEqual(
    validateSchemaDocument(sourcesLockSchema, {
      collectionProperty: 'sources',
      expectedId: 'https://primefaces.org/schemas/primeui-plugins/sources-lock.schema.json',
      expectedItemRefs: [
        '#/$defs/primevueLock',
        '#/$defs/primengLock',
        '#/$defs/primereactLock'
      ],
      requiredProperties: ['$schema', 'schemaVersion', 'sources']
    }),
    []
  );

  const broken = structuredClone(pluginsSchema);
  broken.$defs.primevuePlugin.allOf[0].$ref = '#/$defs/missing';
  assert.match(
    validateSchemaDocument(broken, {
      collectionProperty: 'plugins',
      expectedId: broken.$id,
      expectedItemRefs: pluginsSchema.properties.plugins.prefixItems.map((item) => item.$ref),
      requiredProperties: broken.required
    }).join('\n'),
    /does not resolve/
  );
});

test('schema library definitions preserve identities and define closed ordered skill records', () => {
  assert.equal(
    pluginsSchema.$defs.marketplace.properties.repository.const,
    'https://github.com/primefaces/primeui-plugins'
  );
  assert.equal(pluginsSchema.$defs.plugin.properties.category.const, 'Developer Tools');

  const expectations = [
    {
      lockDefinition: 'primevueLock',
      name: 'primevue',
      pluginDefinition: 'primevuePlugin',
      pluginPath: 'plugins/primevue',
      repository: 'https://github.com/primefaces/primeui-plugins'
    },
    {
      lockDefinition: 'primengLock',
      name: 'primeng',
      pluginDefinition: 'primengPlugin',
      pluginPath: 'plugins/primeng',
      repository: 'https://github.com/primefaces/primeui-plugins'
    },
    {
      lockDefinition: 'primereactLock',
      name: 'primereact',
      pluginDefinition: 'primereactPlugin',
      pluginPath: 'plugins/primereact',
      repository: 'https://github.com/primefaces/primeui-plugins'
    }
  ];

  for (const expectation of expectations) {
    const pluginProperties = pluginsSchema.$defs[expectation.pluginDefinition].allOf[1].properties;
    const lockProperties = sourcesLockSchema.$defs[expectation.lockDefinition].allOf[1].properties;
    assert.equal(pluginProperties.name.const, expectation.name);
    assert.equal(pluginProperties.outputs.properties.plugin.const, expectation.pluginPath);
    assert.equal(lockProperties.name.const, expectation.name);
  }
  assert.equal(pluginsSchema.$defs.mcp.required.includes('versionRange'), true);
  assert.equal(Object.hasOwn(sourcesLockSchema.$defs.lock.properties, 'mcp'), false);
  assert.equal(pluginsSchema.$defs.plugin.properties.skills.minItems, 1);
  assert.equal(pluginsSchema.$defs.skill.additionalProperties, false);
  assert.equal(sourcesLockSchema.$defs.lock.properties.skills.minItems, 1);
  assert.equal(sourcesLockSchema.$defs.skillLock.additionalProperties, false);
});

test('ordered skill sets reject empty sets, unsafe paths, collisions, bad order, and foreign ownership', () => {
  const empty = structuredClone(pluginsConfig);
  empty.plugins[0].skills = [];
  assert.match(validatePluginsConfig(empty).join('\n'), /non-empty ordered array/);

  const invalid = structuredClone(pluginsConfig);
  const original = invalid.plugins[0].skills[0];
  invalid.plugins[0].skills.push({
    ...structuredClone(original),
    directory: 'primevue--router',
    id: 'primevue-router-2',
    name: 'primevue--router',
    order: 3,
    owner: 'primeng',
    sourcePath: '/tmp/primevue'
  });
  invalid.plugins[0].skills.push({
    ...structuredClone(original),
    directory: 'primevue-router',
    id: 'primevue-router-3',
    name: 'primevue-router',
    order: 2,
    sourcePath: '../primevue'
  });
  const errors = validatePluginsConfig(invalid).join('\n');
  assert.match(errors, /order must equal its declared array index/);
  assert.match(errors, /owner must equal selected library primevue/);
  assert.match(errors, /safe normalized relative POSIX path/);
  assert.match(errors, /collide after host normalization/);
});

test('secret detection covers high-confidence provider token formats', () => {
  const samples = [
    ['github_' + 'pat_' + 'A'.repeat(40), 'GitHub fine-grained access token'],
    ['npm_' + 'a'.repeat(40), 'npm access token'],
    ['sk-' + 'A'.repeat(32), 'OpenAI API key']
  ];

  for (const [sample, expectedLabel] of samples) {
    assert.deepEqual(detectSecretKinds(sample), [expectedLabel]);
  }
  assert.deepEqual(detectSecretKinds('authentication: ON_INSTALL'), []);
});
