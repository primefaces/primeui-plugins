import { validateEvaluationRepository } from './lib/evaluation-contracts.mjs';

const errors = await validateEvaluationRepository();
if (errors.length > 0) {
  console.error('Behavioral evaluation contracts failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Behavioral evaluation contracts passed for PrimeVue, PrimeNG, and PrimeReact.');
