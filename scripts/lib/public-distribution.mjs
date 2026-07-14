import { access, copyFile, lstat, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { listRepositoryFiles } from './repository.mjs';

export const publicDistributionEntries = Object.freeze([
  Object.freeze({ source: 'public/README.md', destination: 'README.md' }),
  Object.freeze({ source: '.agents/plugins', destination: '.agents/plugins' }),
  Object.freeze({ source: '.claude-plugin', destination: '.claude-plugin' }),
  Object.freeze({ source: '.github/plugin', destination: '.github/plugin' }),
  Object.freeze({ source: '.cursor-plugin', destination: '.cursor-plugin' }),
  Object.freeze({
    source: '.github/workflows/promote-main.yml',
    destination: '.github/workflows/promote-main.yml'
  }),
  Object.freeze({ source: 'plugins', destination: 'plugins' })
]);

const allowedTopLevelEntries = Object.freeze([
  '.agents',
  '.claude-plugin',
  '.cursor-plugin',
  '.github',
  'README.md',
  'plugins'
]);

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function assertOutsideRepository(destinationRoot, repositoryRoot) {
  const [canonicalRepository, canonicalParent] = await Promise.all([
    realpath(repositoryRoot),
    realpath(path.dirname(destinationRoot))
  ]);
  const canonicalDestination = path.join(canonicalParent, path.basename(destinationRoot));
  const relative = path.relative(canonicalRepository, canonicalDestination);

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('Public distribution output must be outside the development repository.');
  }
}

async function copyEntry(repositoryRoot, destinationRoot, entry) {
  const source = path.join(repositoryRoot, ...entry.source.split('/'));
  const destination = path.join(destinationRoot, ...entry.destination.split('/'));
  const sourceStat = await lstat(source);

  if (sourceStat.isSymbolicLink()) {
    throw new Error(`Public distribution source must not be a symlink: ${entry.source}`);
  }

  if (sourceStat.isFile()) {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    return;
  }

  if (!sourceStat.isDirectory()) {
    throw new Error(`Unsupported public distribution source: ${entry.source}`);
  }

  for (const relativePath of await listRepositoryFiles(source)) {
    const target = path.join(destination, ...relativePath.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(source, ...relativePath.split('/')), target);
  }
}

export async function expectedPublicDistributionFiles(repositoryRoot) {
  const files = [];

  for (const entry of publicDistributionEntries) {
    const source = path.join(repositoryRoot, ...entry.source.split('/'));
    const sourceStat = await lstat(source);

    if (sourceStat.isFile()) {
      files.push(entry.destination);
      continue;
    }

    if (!sourceStat.isDirectory()) {
      throw new Error(`Unsupported public distribution source: ${entry.source}`);
    }

    for (const relativePath of await listRepositoryFiles(source)) {
      files.push(path.posix.join(entry.destination, relativePath));
    }
  }

  return files.sort();
}

export async function validatePublicDistribution(destinationRoot, repositoryRoot) {
  const actualFiles = await listRepositoryFiles(destinationRoot);
  const expectedFiles = await expectedPublicDistributionFiles(repositoryRoot);

  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    const expected = new Set(expectedFiles);
    const actual = new Set(actualFiles);
    const added = actualFiles.filter((file) => !expected.has(file));
    const missing = expectedFiles.filter((file) => !actual.has(file));
    throw new Error(
      `Public distribution inventory mismatch. Added: ${added.join(', ') || 'none'}. Missing: ${missing.join(', ') || 'none'}.`
    );
  }

  const topLevelEntries = [...new Set(actualFiles.map((file) => file.split('/')[0]))].sort();
  if (JSON.stringify(topLevelEntries) !== JSON.stringify([...allowedTopLevelEntries].sort())) {
    throw new Error(`Unexpected public top-level inventory: ${topLevelEntries.join(', ')}`);
  }

  const readme = await readFile(path.join(destinationRoot, 'README.md'), 'utf8');
  for (const forbiddenReference of ['npm run', 'config/', 'evaluations/', 'scripts/', 'tests/']) {
    if (readme.includes(forbiddenReference)) {
      throw new Error(`Public README exposes development-only content: ${forbiddenReference}`);
    }
  }

  return actualFiles;
}

export async function buildPublicDistribution({ destinationRoot, repositoryRoot }) {
  await assertOutsideRepository(destinationRoot, repositoryRoot);
  if (await pathExists(destinationRoot)) {
    throw new Error(`Public distribution destination already exists: ${destinationRoot}`);
  }

  try {
    await mkdir(destinationRoot, { recursive: true });
    for (const entry of publicDistributionEntries) {
      await copyEntry(repositoryRoot, destinationRoot, entry);
    }
    const files = await validatePublicDistribution(destinationRoot, repositoryRoot);
    return { destinationRoot, files };
  } catch (error) {
    await rm(destinationRoot, { force: true, recursive: true });
    throw error;
  }
}
