import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { auditProductVersionLiterals } from './lib/version-literals.mjs';
import { listRepositoryFiles, repositoryRoot } from './lib/repository.mjs';

const files = await listRepositoryFiles();
const evidence = await Promise.all(
  files.map(async (relativePath) => ({
    content: await readFile(path.join(repositoryRoot, relativePath), 'utf8'),
    relativePath
  }))
);
const errors = auditProductVersionLiterals(evidence);

if (errors.length > 0) {
  console.error('MCP product-version literal audit failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`MCP product-version literal audit passed for ${files.length} repository files.`);
