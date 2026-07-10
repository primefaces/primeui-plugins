import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectSkillTree } from './skill-tree.mjs';

const commitPattern = /^[0-9a-f]{40}$/;

function runGit(repositoryPath, argumentsList, { encoding = 'utf8' } = {}) {
  const result = spawnSync('git', argumentsList, {
    cwd: repositoryPath,
    encoding,
    env: {
      ...process.env,
      GIT_OPTIONAL_LOCKS: '0'
    },
    maxBuffer: 16 * 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8').trim()
      : result.stderr.trim();
    throw new Error(`Git command failed in ${repositoryPath}: ${stderr || argumentsList.join(' ')}`);
  }
  return result.stdout;
}

function splitSourceValue(value) {
  const equalsIndex = value.indexOf('=');
  if (equalsIndex <= 0 || equalsIndex === value.length - 1) {
    throw new Error(`Invalid --source value ${JSON.stringify(value)}; expected name=/absolute/path.`);
  }
  return [value.slice(0, equalsIndex), value.slice(equalsIndex + 1)];
}

export function parseSourceArguments(argumentsList, configuredNames, { allowCheck = false } = {}) {
  const allowedNames = new Set(configuredNames);
  const sources = new Map();
  let check = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--check' && allowCheck) {
      if (check) {
        throw new Error('Duplicate --check argument.');
      }
      check = true;
      continue;
    }

    let value;
    if (argument === '--source') {
      index += 1;
      if (index >= argumentsList.length) {
        throw new Error('--source requires name=/absolute/path.');
      }
      value = argumentsList[index];
    } else if (argument.startsWith('--source=')) {
      value = argument.slice('--source='.length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const [name, sourcePath] = splitSourceValue(value);
    if (!allowedNames.has(name)) {
      throw new Error(`Unknown source name: ${name}`);
    }
    if (sources.has(name)) {
      throw new Error(`Duplicate source path for ${name}.`);
    }
    sources.set(name, sourcePath);
  }

  const missing = configuredNames.filter((name) => !sources.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing source path${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);
  }
  if (sources.size !== configuredNames.length) {
    throw new Error('Exactly one source path is required for every configured library.');
  }

  return { check, sources };
}

async function validateSourcePath(name, providedPath) {
  if (
    typeof providedPath !== 'string' ||
    providedPath.length === 0 ||
    providedPath.includes('\0') ||
    /[\u0000-\u001f\u007f]/.test(providedPath) ||
    !path.isAbsolute(providedPath) ||
    path.normalize(providedPath) !== providedPath ||
    path.parse(providedPath).root === providedPath
  ) {
    throw new Error(`Source path for ${name} must be a safe normalized absolute path.`);
  }

  const stats = await lstat(providedPath).catch((error) => {
    throw new Error(`Source path for ${name} does not exist: ${error.message}`);
  });
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`Source path for ${name} must be a physical directory.`);
  }

  const canonicalPath = await realpath(providedPath);
  if (canonicalPath !== providedPath) {
    throw new Error(`Source path for ${name} must be canonical and must not traverse symlinks.`);
  }

  const gitRootOutput = runGit(canonicalPath, ['rev-parse', '--show-toplevel']).trim();
  const gitRoot = await realpath(gitRootOutput);
  if (gitRoot !== canonicalPath) {
    throw new Error(`Source path for ${name} must point to the Git repository root.`);
  }

  return canonicalPath;
}

function trackedSkillFiles(repositoryPath, skillPath, acceptedCommit) {
  const output = runGit(
    repositoryPath,
    ['ls-tree', '-rz', '--full-tree', acceptedCommit, '--', skillPath],
    { encoding: 'buffer' }
  );
  const prefix = `${skillPath}/`;
  const tracked = [];

  for (const entry of output.toString('utf8').split('\0').filter(Boolean)) {
    const tabIndex = entry.indexOf('\t');
    if (tabIndex < 0) {
      throw new Error(`Unable to parse tracked skill entry in ${repositoryPath}.`);
    }
    const metadata = entry.slice(0, tabIndex).split(' ');
    const repositoryRelativePath = entry.slice(tabIndex + 1);
    const [mode, type] = metadata;

    if (type !== 'blob' || !['100644', '100755'].includes(mode)) {
      throw new Error(`Tracked skill entry is not a regular file: ${repositoryRelativePath}`);
    }
    if (!repositoryRelativePath.startsWith(prefix)) {
      throw new Error(`Tracked skill entry escapes the configured tree: ${repositoryRelativePath}`);
    }
    tracked.push(repositoryRelativePath.slice(prefix.length));
  }

  return tracked.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function assertPhysicalTreeMatchesGit(
  name,
  repositoryPath,
  skillPath,
  acceptedCommit,
  inspection
) {
  const tracked = trackedSkillFiles(repositoryPath, skillPath, acceptedCommit);
  const physical = inspection.records.map((record) => record.path);
  if (tracked.length !== physical.length || tracked.some((file, index) => file !== physical[index])) {
    const trackedSet = new Set(tracked);
    const physicalSet = new Set(physical);
    const untrackedPhysical = physical.filter((file) => !trackedSet.has(file));
    const missingPhysical = tracked.filter((file) => !physicalSet.has(file));
    const details = [
      untrackedPhysical.length > 0 ? `untracked physical files: ${untrackedPhysical.join(', ')}` : '',
      missingPhysical.length > 0 ? `missing tracked files: ${missingPhysical.join(', ')}` : ''
    ].filter(Boolean);
    throw new Error(`Physical skill tree for ${name} does not match Git (${details.join('; ')}).`);
  }
}

async function inspectOneSource(plugin, lock, providedPath, options) {
  const repositoryPath = await validateSourcePath(plugin.name, providedPath);
  const status = runGit(repositoryPath, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status.length > 0) {
    throw new Error(`Source repository for ${plugin.name} is dirty.`);
  }

  const head = runGit(repositoryPath, ['rev-parse', 'HEAD']).trim();
  if (!commitPattern.test(lock.source.commit ?? '')) {
    throw new Error(`Source lock for ${plugin.name} must author an accepted full commit before locking.`);
  }
  if (head !== lock.source.commit) {
    throw new Error(
      `Source HEAD mismatch for ${plugin.name}: expected ${lock.source.commit}, received ${head}.`
    );
  }
  if (lock.source.skillPath !== plugin.skillSourcePath) {
    throw new Error(`Skill path mismatch between configuration and lock for ${plugin.name}.`);
  }

  const skillRoot = path.join(repositoryPath, ...lock.source.skillPath.split('/'));
  const inspection = await inspectSkillTree(skillRoot);
  assertPhysicalTreeMatchesGit(
    plugin.name,
    repositoryPath,
    lock.source.skillPath,
    lock.source.commit,
    inspection
  );

  if (options.requireLocked && lock.lockState !== 'locked') {
    throw new Error(`Source lock for ${plugin.name} is not locked.`);
  }
  if (options.verifyHash && inspection.hash !== lock.source.skillHash) {
    throw new Error(
      `Skill hash mismatch for ${plugin.name}: expected ${lock.source.skillHash}, received ${inspection.hash}.`
    );
  }

  return {
    commit: head,
    inspection,
    name: plugin.name,
    repositoryPath,
    skillRoot
  };
}

export async function inspectSourceRepositories(
  pluginsConfig,
  lockConfig,
  sourcePaths,
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
    const snapshot = await inspectOneSource(plugin, lock, sourcePaths.get(plugin.name), {
      requireLocked,
      verifyHash
    });
    const duplicateName = canonicalPaths.get(snapshot.repositoryPath);
    if (duplicateName !== undefined) {
      throw new Error(
        `Source repositories for ${duplicateName} and ${plugin.name} resolve to the same path.`
      );
    }
    canonicalPaths.set(snapshot.repositoryPath, plugin.name);
    snapshots.set(plugin.name, snapshot);
  }

  return snapshots;
}

export async function verifySourceSnapshots(pluginsConfig, lockConfig, sourcePaths, snapshots) {
  const verified = await inspectSourceRepositories(pluginsConfig, lockConfig, sourcePaths, {
    requireLocked: false,
    verifyHash: false
  });

  for (const [name, original] of snapshots) {
    const current = verified.get(name);
    if (
      current.commit !== original.commit ||
      current.inspection.hash !== original.inspection.hash ||
      current.repositoryPath !== original.repositoryPath
    ) {
      throw new Error(`Accepted source changed during generation: ${name}.`);
    }
  }
}
