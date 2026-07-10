import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  isExactSemver,
  isSafeRelativePath,
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

test('release validation accepts the complete source locks', () => {
  assert.deepEqual(validateSourcesLock(sourcesLock, pluginsConfig, { release: true }), []);
  assert.equal(sourcesLock.sources.every((lock) => lock.lockState === 'locked'), true);
});

test('release validation rejects every unresolved source lock', () => {
  const unresolved = structuredClone(sourcesLock);
  for (const lock of unresolved.sources) {
    lock.lockState = 'unresolved';
    lock.source.skillHash = null;
    lock.unresolvedReason = 'Hash pending.';
  }
  const errors = validateSourcesLock(unresolved, pluginsConfig, { release: true });
  assert.equal(errors.filter((error) => error.includes('is not release-ready')).length, 3);
  assert.match(errors.join('\n'), /primevue.*source\.skillHash/);
  assert.match(errors.join('\n'), /primeng.*source\.skillHash/);
  assert.match(errors.join('\n'), /primereact.*source\.skillHash/);
});

test('exact SemVer accepts releases and prereleases but rejects moving selectors', () => {
  for (const value of ['0.1.0', '5.0.0-rc.2', '1.2.3-alpha.0+build.7']) {
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

test('relative path validation rejects traversal and platform escapes', () => {
  for (const value of ['skills/primevue', 'plugins/primevue', 'gemini/primevue']) {
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
  unsafe.plugins[0].skillSourcePath = '../primevue';
  unsafe.plugins[0].hosts = ['codex', 'claude', 'gemini'];
  unsafe.plugins[0].token = 'not-allowed';

  const errors = validatePluginsConfig(unsafe).join('\n');
  assert.match(errors, /forbidden secret-bearing field/);
  assert.match(errors, /token is not allowed/);
  assert.match(errors, /hosts must equal/);
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
  lockedButIncomplete.sources[1].source.skillHash = null;
  assert.match(validateSourcesLock(lockedButIncomplete, pluginsConfig).join('\n'), /locked but missing/);

  const unresolvedButComplete = structuredClone(sourcesLock);
  unresolvedButComplete.sources[0].lockState = 'unresolved';
  unresolvedButComplete.sources[0].unresolvedReason = 'Pending review.';
  assert.match(
    validateSourcesLock(unresolvedButComplete, pluginsConfig).join('\n'),
    /unresolved but contains a complete source lock/
  );
});

test('source locks reject non-exact versions, malformed provenance, and unsafe repositories', () => {
  const invalid = structuredClone(sourcesLock);
  invalid.sources[0].pluginVersion = '^0.1.0';
  invalid.sources[0].mcp.version = 'rc';
  invalid.sources[0].source.commit = 'F'.repeat(40);
  invalid.sources[0].source.skillHash = `sha256:${'G'.repeat(64)}`;
  invalid.sources[0].source.repository = 'https://user:pass@github.com/primefaces/primeui-plugins';

  const errors = validateSourcesLock(invalid, pluginsConfig).join('\n');
  assert.match(errors, /pluginVersion must be an exact SemVer/);
  assert.match(errors, /mcp\.version must be an exact SemVer/);
  assert.match(errors, /source\.commit is not allowed/);
  assert.match(errors, /sha256:<64 lowercase hex>/);
  assert.match(errors, /without credentials/);
});

test('cross-file contract rejects MCP and skill path drift', () => {
  const drifted = structuredClone(sourcesLock);
  drifted.sources[0].mcp.package = '@primeng/mcp';
  drifted.sources[0].source.skillPath = 'skills/other';

  const errors = validateSourcesLock(drifted, pluginsConfig).join('\n');
  assert.match(errors, /mcp\.package must equal @primevue\/mcp/);
  assert.match(errors, /mcp\.package must match config\/plugins\.json/);
  assert.match(errors, /source\.skillPath must equal skills\/primevue/);
  assert.match(errors, /source\.skillPath must match config\/plugins\.json/);
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

test('schema library definitions pin the same package, repository, and path mappings as code', () => {
  assert.equal(
    pluginsSchema.$defs.marketplace.properties.repository.const,
    'https://github.com/primefaces/primeui-plugins'
  );
  assert.equal(pluginsSchema.$defs.plugin.properties.category.const, 'Developer Tools');

  const expectations = [
    {
      lockDefinition: 'primevueLock',
      mcpPackage: '@primevue/mcp',
      name: 'primevue',
      pluginDefinition: 'primevuePlugin',
      repository: 'https://github.com/primefaces/primeui-plugins',
      skillPath: 'skills/primevue'
    },
    {
      lockDefinition: 'primengLock',
      mcpPackage: '@primeng/mcp',
      name: 'primeng',
      pluginDefinition: 'primengPlugin',
      repository: 'https://github.com/primefaces/primeui-plugins',
      skillPath: 'skills/primeng'
    },
    {
      lockDefinition: 'primereactLock',
      mcpPackage: '@primereact/mcp',
      name: 'primereact',
      pluginDefinition: 'primereactPlugin',
      repository: 'https://github.com/primefaces/primeui-plugins',
      skillPath: 'skills/primereact'
    }
  ];

  for (const expectation of expectations) {
    const pluginProperties = pluginsSchema.$defs[expectation.pluginDefinition].allOf[1].properties;
    const lockProperties = sourcesLockSchema.$defs[expectation.lockDefinition].allOf[1].properties;
    assert.equal(pluginProperties.name.const, expectation.name);
    assert.equal(pluginProperties.mcp.properties.package.const, expectation.mcpPackage);
    assert.equal(pluginProperties.skillSourcePath.const, expectation.skillPath);
    assert.equal(lockProperties.name.const, expectation.name);
    assert.equal(lockProperties.mcp.properties.package.const, expectation.mcpPackage);
    assert.equal(lockProperties.source.properties.repository.const, expectation.repository);
    assert.equal(lockProperties.source.properties.skillPath.const, expectation.skillPath);
  }
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
