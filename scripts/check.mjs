import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { repositoryRoot } from './lib/repository.mjs';

const checks = [
  ['configuration validation', ['scripts/validate-config.mjs']],
  ['tests', ['--test']],
  ['formatting', ['scripts/check-format.mjs']],
  ['repository boundaries', ['scripts/check-boundaries.mjs']],
  ['skill commands', ['scripts/check-skill-commands.mjs']],
  ['security', ['scripts/check-security.mjs']]
];

for (const [label, argumentsList] of checks) {
  console.log(`\n> ${label}`);
  const result = spawnSync(process.execPath, argumentsList, {
    cwd: path.resolve(repositoryRoot),
    stdio: 'inherit'
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nAll repository checks passed.');
