import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

const ignoredDirectories = new Set(['.git', 'node_modules']);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export async function listRepositoryFiles(directory = repositoryRoot, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => compareStrings(left.name, right.name))) {
    if (entry.isSymbolicLink()) {
      const relativePath = path.posix.join(prefix, entry.name);
      throw new Error(`Symlinks are forbidden in this repository: ${relativePath}`);
    }

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      files.push(
        ...(await listRepositoryFiles(
          path.join(directory, entry.name),
          path.posix.join(prefix, entry.name)
        ))
      );
      continue;
    }

    if (entry.isFile()) {
      files.push(path.posix.join(prefix, entry.name));
      continue;
    }

    throw new Error(`Unsupported filesystem entry: ${path.posix.join(prefix, entry.name)}`);
  }

  return files;
}
