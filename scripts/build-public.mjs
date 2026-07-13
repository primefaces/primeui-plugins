import path from 'node:path';
import { buildPublicDistribution } from './lib/public-distribution.mjs';
import { repositoryRoot } from './lib/repository.mjs';

function parseArguments(argumentsList) {
  let destinationRoot;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--out') {
      destinationRoot = argumentsList[++index];
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!destinationRoot) {
    throw new Error('--out <path> is required.');
  }

  return path.resolve(destinationRoot);
}

const destinationRoot = parseArguments(process.argv.slice(2));
const result = await buildPublicDistribution({ destinationRoot, repositoryRoot });

console.log(`Built public distribution with ${result.files.length} files: ${result.destinationRoot}`);
