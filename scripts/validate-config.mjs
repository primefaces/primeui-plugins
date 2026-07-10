import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  validatePackageManifest,
  validatePluginsConfig,
  validateSchemaDocument,
  validateSourcesLock
} from './lib/contracts.mjs';
import { repositoryRoot } from './lib/repository.mjs';

const argumentsList = process.argv.slice(2);
const release = argumentsList.includes('--release');
const unknownArguments = argumentsList.filter((argument) => argument !== '--release');

if (unknownArguments.length > 0) {
  console.error(`Unknown arguments: ${unknownArguments.join(', ')}`);
  process.exit(2);
}

async function readJson(relativePath) {
  const content = await readFile(path.join(repositoryRoot, relativePath), 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

const [plugins, sourcesLock, packageManifest, pluginsSchema, sourcesLockSchema] = await Promise.all([
  readJson('config/plugins.json'),
  readJson('config/sources.lock.json'),
  readJson('package.json'),
  readJson('config/schemas/plugins.schema.json'),
  readJson('config/schemas/sources-lock.schema.json')
]);

const errors = [
  ...validatePluginsConfig(plugins),
  ...validateSourcesLock(sourcesLock, plugins, { release }),
  ...validatePackageManifest(packageManifest),
  ...validateSchemaDocument(pluginsSchema, {
    collectionProperty: 'plugins',
    expectedId: 'https://primefaces.org/schemas/primeui-plugins/plugins.schema.json',
    expectedItemRefs: [
      '#/$defs/primevuePlugin',
      '#/$defs/primengPlugin',
      '#/$defs/primereactPlugin'
    ],
    requiredProperties: ['$schema', 'marketplace', 'plugins', 'schemaVersion']
  }).map((error) => `config/schemas/plugins.schema.json: ${error}`),
  ...validateSchemaDocument(sourcesLockSchema, {
    collectionProperty: 'sources',
    expectedId: 'https://primefaces.org/schemas/primeui-plugins/sources-lock.schema.json',
    expectedItemRefs: [
      '#/$defs/primevueLock',
      '#/$defs/primengLock',
      '#/$defs/primereactLock'
    ],
    requiredProperties: ['$schema', 'schemaVersion', 'sources']
  }).map((error) => `config/schemas/sources-lock.schema.json: ${error}`)
];

if (errors.length > 0) {
  console.error(`${release ? 'Release' : 'Configuration'} validation failed:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`${release ? 'Release' : 'Configuration'} validation passed.`);
