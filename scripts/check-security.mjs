import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { listRepositoryFiles, repositoryRoot } from './lib/repository.mjs';
import { detectSecretKinds } from './lib/security.mjs';

const files = await listRepositoryFiles();
const errors = [];
const forbiddenNames = new Set(['.env', '.npmrc', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'id_rsa']);
const forbiddenExtensions = new Set(['.key', '.p12', '.pem', '.pfx']);

for (const relativePath of files) {
  const basename = path.posix.basename(relativePath);
  const extension = path.posix.extname(relativePath);
  if (forbiddenNames.has(basename) || forbiddenExtensions.has(extension)) {
    errors.push(`${relativePath}: secret-bearing file type is forbidden.`);
    continue;
  }

  const content = await readFile(path.join(repositoryRoot, relativePath), 'utf8');
  for (const label of detectSecretKinds(content)) {
    errors.push(`${relativePath}: possible ${label}.`);
  }
}

if (errors.length > 0) {
  console.error('Security checks failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Security checks passed for ${files.length} repository files.`);
