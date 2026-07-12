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

async function resolvePhysicalSkillRoot(repositoryRoot, plugin, skill) {
  const canonicalRepositoryRoot = await realpath(repositoryRoot);
  const normalizedRepositoryRoot = path.resolve(repositoryRoot);
  if (canonicalRepositoryRoot !== normalizedRepositoryRoot) {
    throw new Error('Distribution repository root must be canonical and must not traverse symlinks.');
  }

  const segments = skill.sourcePath.split('/');
  let currentPath = canonicalRepositoryRoot;
  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    const stats = await lstat(currentPath).catch((error) => {
      throw new Error(`Canonical skill source for ${plugin.name}/${skill.id} does not exist: ${error.message}`);
    });
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`Canonical skill source for ${plugin.name}/${skill.id} must be a physical directory.`);
    }
  }

  const canonicalSkillRoot = await realpath(currentPath);
  const relativePath = path.relative(canonicalRepositoryRoot, canonicalSkillRoot);
  if (
    relativePath !== skill.sourcePath.split('/').join(path.sep) ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Canonical skill source for ${plugin.name}/${skill.id} escapes its configured path.`);
  }

  return canonicalSkillRoot;
}

async function inspectOneSkillSource(repositoryRoot, plugin, skill, lockedSkill, options) {
  if (lockedSkill.source.path !== skill.sourcePath) {
    throw new Error(`Skill path mismatch between configuration and lock for ${plugin.name}/${skill.id}.`);
  }

  const skillRoot = await resolvePhysicalSkillRoot(repositoryRoot, plugin, skill);
  const inspection = await inspectSkillTree(skillRoot);

  if (options.verifyHash && inspection.hash !== lockedSkill.source.treeHash) {
    throw new Error(
      `Skill hash mismatch for ${plugin.name}/${skill.id}: expected ${lockedSkill.source.treeHash}, received ${inspection.hash}.`
    );
  }

  return {
    inspection,
    ...skill,
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
    if (requireLocked && lock.lockState !== 'locked') {
      throw new Error(`Source lock for ${plugin.name} is not locked.`);
    }
    const lockedSkills = new Map(lock.skills.map((skill) => [skill.id, skill]));
    const skillSnapshots = [];
    for (const skill of plugin.skills) {
      const lockedSkill = lockedSkills.get(skill.id);
      if (!lockedSkill) {
        throw new Error(`Missing source lock for ${plugin.name}/${skill.id}.`);
      }
      const snapshot = await inspectOneSkillSource(repositoryRoot, plugin, skill, lockedSkill, {
        verifyHash
      });
      const duplicateName = canonicalPaths.get(snapshot.skillRoot);
      if (duplicateName !== undefined) {
        throw new Error(
          `Canonical skill sources for ${duplicateName} and ${plugin.name}/${skill.id} resolve to the same path.`
        );
      }
      canonicalPaths.set(snapshot.skillRoot, `${plugin.name}/${skill.id}`);
      skillSnapshots.push(snapshot);
    }
    snapshots.set(plugin.name, { name: plugin.name, skills: skillSnapshots });
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
    for (const [index, originalSkill] of original.skills.entries()) {
      const currentSkill = current.skills[index];
      if (
        currentSkill?.id !== originalSkill.id ||
        currentSkill.inspection.hash !== originalSkill.inspection.hash ||
        currentSkill.skillRoot !== originalSkill.skillRoot
      ) {
        throw new Error(`Canonical skill source changed during generation: ${name}/${originalSkill.id}.`);
      }
    }
  }
}
