import { readDistributionConfiguration } from './lib/generator.mjs';
import { repositoryRoot } from './lib/repository.mjs';
import { validateSkillDoctorCommands } from './lib/skill-command-validation.mjs';

const { pluginsConfig } = await readDistributionConfiguration(repositoryRoot, { release: true });
const errors = await validateSkillDoctorCommands(repositoryRoot, pluginsConfig);

if (errors.length > 0) {
  console.error('Skill command checks failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Skill command checks passed for canonical and generated skill surfaces.');
