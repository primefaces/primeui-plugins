import path from 'node:path';
import { exportGeminiDistributions } from './lib/gemini-distribution.mjs';
import { repositoryRoot } from './lib/repository.mjs';
import { libraryNames } from './lib/smoke-contracts.mjs';

function parseArguments(argumentsList) {
  let destinationRoot;
  let libraries = [...libraryNames];

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--out') {
      destinationRoot = argumentsList[++index];
      continue;
    }
    if (argument === '--library') {
      const value = argumentsList[++index];
      libraries = value === 'all' ? [...libraryNames] : [value];
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!destinationRoot) {
    throw new Error('--out <path> is required.');
  }
  return { destinationRoot: path.resolve(destinationRoot), libraries };
}

const options = parseArguments(process.argv.slice(2));
const outputs = await exportGeminiDistributions({ ...options, repositoryRoot });
console.log(`Exported ${outputs.length} Gemini distribution root(s):`);
outputs.forEach((output) => console.log(`- ${output}`));
