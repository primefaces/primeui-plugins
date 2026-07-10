import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { stableStringify } from './lib/contracts.mjs';
import { listRepositoryFiles, repositoryRoot } from './lib/repository.mjs';

const files = await listRepositoryFiles();
const errors = [];
const textExtensions = new Set(['.json', '.md', '.mjs']);

for (const relativePath of files) {
  const extension = path.extname(relativePath);
  if (!textExtensions.has(extension) && relativePath !== '.gitignore') {
    continue;
  }

  const content = await readFile(path.join(repositoryRoot, relativePath), 'utf8');
  if (content.startsWith('\uFEFF')) {
    errors.push(`${relativePath}: UTF-8 BOM is forbidden.`);
  }
  if (content.includes('\r')) {
    errors.push(`${relativePath}: use LF line endings.`);
  }
  if (/[ \t]+$/m.test(content)) {
    errors.push(`${relativePath}: trailing whitespace is forbidden.`);
  }
  if (!content.endsWith('\n') || content.endsWith('\n\n')) {
    errors.push(`${relativePath}: require exactly one final newline.`);
  }

  if (extension === '.json') {
    try {
      const parsed = JSON.parse(content);
      if (content !== stableStringify(parsed)) {
        errors.push(`${relativePath}: JSON must use recursively sorted keys and two-space indentation.`);
      }
    } catch (error) {
      errors.push(`${relativePath}: invalid JSON (${error.message}).`);
    }
  }
}

if (errors.length > 0) {
  console.error('Formatting checks failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Formatting checks passed for ${files.length} repository files.`);
