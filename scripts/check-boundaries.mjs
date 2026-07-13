import { validateGeneratedPayload } from './lib/generated-validation.mjs';
import { readDistributionConfiguration } from './lib/generator.mjs';
import { listRepositoryFiles } from './lib/repository.mjs';
import { repositoryRoot } from './lib/repository.mjs';
import { inspectCanonicalSkills } from './lib/sources.mjs';

const files = await listRepositoryFiles();
const errors = [];
const allowedTopLevel = new Set([
  '.gitignore',
  '.agents',
  '.claude-plugin',
  '.cursor-plugin',
  '.github',
  'README.md',
  'RELEASE.md',
  'config',
  'docs',
  'evaluations',
  'package.json',
  'plugins',
  'public',
  'scripts',
  'skills',
  'tests'
]);

for (const relativePath of files) {
  const topLevel = relativePath.split('/')[0];
  if (!allowedTopLevel.has(topLevel)) {
    errors.push(`${relativePath}: top-level path is outside the repository boundary policy.`);
  }
  if (relativePath.startsWith('.agents/') && !relativePath.startsWith('.agents/plugins/')) {
    errors.push(`${relativePath}: only .agents/plugins is generator-owned.`);
  }
  if (relativePath.startsWith('.github/') && !relativePath.startsWith('.github/workflows/')) {
    errors.push(`${relativePath}: only .github/workflows is allowed under .github.`);
  }
}

const { lockConfig, pluginsConfig } = await readDistributionConfiguration(repositoryRoot, {
  release: true
});
await inspectCanonicalSkills(repositoryRoot, pluginsConfig, lockConfig, {
  requireLocked: true,
  verifyHash: true
});
errors.push(...(await validateGeneratedPayload(repositoryRoot, pluginsConfig, lockConfig)));

if (errors.length > 0) {
  console.error('Repository boundary checks failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Repository boundary checks passed with canonical-skill and generated-root validation.');
