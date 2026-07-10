import path from 'node:path';
import { listRepositoryFiles } from './lib/repository.mjs';

const files = await listRepositoryFiles();
const errors = [];
const allowedTopLevel = new Set([
  '.gitignore',
  'README.md',
  'RELEASE.md',
  'config',
  'package.json',
  'scripts',
  'tests'
]);
const forbiddenPrefixes = ['.agents/', '.claude-plugin/', 'gemini/', 'plugins/'];
const forbiddenBasenames = new Set([
  '.mcp.json',
  'SKILL.md',
  'gemini-extension.json',
  'plugin.json',
  'provenance.json'
]);

for (const relativePath of files) {
  const topLevel = relativePath.split('/')[0];
  if (!allowedTopLevel.has(topLevel)) {
    errors.push(`${relativePath}: top-level path is outside the repository boundary policy.`);
  }
  if (forbiddenPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
    errors.push(`${relativePath}: distribution payloads must be generated, not hand-authored.`);
  }
  if (forbiddenBasenames.has(path.posix.basename(relativePath))) {
    errors.push(`${relativePath}: plugin payload files must be produced by the repository generator.`);
  }
  if (/^scripts\/(?:sync|generate)(?:[.-]|$)/.test(relativePath)) {
    errors.push(`${relativePath}: generator implementation requires its generation contract and tests.`);
  }
}

if (errors.length > 0) {
  console.error('Repository boundary checks failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Repository boundary checks passed; no generated payload was hand-authored.');
