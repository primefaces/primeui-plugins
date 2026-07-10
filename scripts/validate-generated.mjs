import { validateGeneratedPayload } from './lib/generated-validation.mjs';
import { readDistributionConfiguration } from './lib/generator.mjs';
import { repositoryRoot } from './lib/repository.mjs';

const { lockConfig, pluginsConfig } = await readDistributionConfiguration(repositoryRoot, {
  release: true
});
const errors = await validateGeneratedPayload(repositoryRoot, pluginsConfig, lockConfig);

if (errors.length > 0) {
  console.error('Generated payload validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Generated payload validation passed.');
