import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { inspectSkillTree } from './skill-tree.mjs';

export function parseSyncArguments(argumentsList, { allowCheck = false } = {}) {
  let check = false;

  for (const argument of argumentsList) {
    if (argument === '--check' && allowCheck) {
      if (check) {
        throw new Error('Duplicate --check argument.');
      }
      check = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return { check };
}

async function resolvePhysicalSkillRoot(repositoryRoot, plugin) {
  const canonicalRepositoryRoot = await realpath(repositoryRoot);
  const normalizedRepositoryRoot = path.resolve(repositoryRoot);
  if (canonicalRepositoryRoot !== normalizedRepositoryRoot) {
    throw new Error('Distribution repository root must be canonical and must not traverse symlinks.');
  }

  const segments = plugin.skillSourcePath.split('/');
  let currentPath = canonicalRepositoryRoot;
  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    const stats = await lstat(currentPath).catch((error) => {
      throw new Error(`Canonical skill source for ${plugin.name} does not exist: ${error.message}`);
    });
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`Canonical skill source for ${plugin.name} must be a physical directory.`);
    }
  }

  const canonicalSkillRoot = await realpath(currentPath);
  const relativePath = path.relative(canonicalRepositoryRoot, canonicalSkillRoot);
  if (
    relativePath !== plugin.skillSourcePath.split('/').join(path.sep) ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Canonical skill source for ${plugin.name} escapes its configured path.`);
  }

  return canonicalSkillRoot;
}

async function inspectOneSkillSource(repositoryRoot, plugin, lock, options) {
  if (lock.source.skillPath !== plugin.skillSourcePath) {
    throw new Error(`Skill path mismatch between configuration and lock for ${plugin.name}.`);
  }

  const skillRoot = await resolvePhysicalSkillRoot(repositoryRoot, plugin);
  const inspection = await inspectSkillTree(skillRoot);

  if (options.requireLocked && lock.lockState !== 'locked') {
    throw new Error(`Source lock for ${plugin.name} is not locked.`);
  }
  if (options.verifyHash && inspection.hash !== lock.source.skillHash) {
    throw new Error(
      `Skill hash mismatch for ${plugin.name}: expected ${lock.source.skillHash}, received ${inspection.hash}.`
    );
  }

  return {
    inspection,
    name: plugin.name,
    skillRoot
  };
}

export async function inspectCanonicalSkills(
  repositoryRoot,
  pluginsConfig,
  lockConfig,
  { requireLocked = false, verifyHash = false } = {}
) {
  const locks = new Map(lockConfig.sources.map((lock) => [lock.name, lock]));
  const snapshots = new Map();
  const canonicalPaths = new Map();

  for (const plugin of pluginsConfig.plugins) {
    const lock = locks.get(plugin.name);
    if (!lock) {
      throw new Error(`Missing source lock for ${plugin.name}.`);
    }
    const snapshot = await inspectOneSkillSource(repositoryRoot, plugin, lock, {
      requireLocked,
      verifyHash
    });
    const duplicateName = canonicalPaths.get(snapshot.skillRoot);
    if (duplicateName !== undefined) {
      throw new Error(
        `Canonical skill sources for ${duplicateName} and ${plugin.name} resolve to the same path.`
      );
    }
    canonicalPaths.set(snapshot.skillRoot, plugin.name);
    snapshots.set(plugin.name, snapshot);
  }

  return snapshots;
}

export async function verifyCanonicalSkillSnapshots(
  repositoryRoot,
  pluginsConfig,
  lockConfig,
  snapshots
) {
  const verified = await inspectCanonicalSkills(repositoryRoot, pluginsConfig, lockConfig, {
    requireLocked: false,
    verifyHash: false
  });

  for (const [name, original] of snapshots) {
    const current = verified.get(name);
    if (
      current.inspection.hash !== original.inspection.hash ||
      current.skillRoot !== original.skillRoot
    ) {
      throw new Error(`Canonical skill source changed during generation: ${name}.`);
    }
  }
}
