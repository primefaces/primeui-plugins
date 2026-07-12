import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  stableStringify,
  validatePluginsConfig,
  validateSourcesLock
} from './contracts.mjs';
import { generatedRoots, validateGeneratedPayload } from './generated-validation.mjs';
import { buildPayloadDocuments } from './payloads.mjs';
import { copySkillTree } from './skill-tree.mjs';
import { inspectCanonicalSkills, verifyCanonicalSkillSnapshots } from './sources.mjs';

function comparePaths(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

async function readJson(repositoryRoot, relativePath) {
  const content = await readFile(path.join(repositoryRoot, ...relativePath.split('/')), 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

export async function readDistributionConfiguration(repositoryRoot, { release = true } = {}) {
  const [pluginsConfig, lockConfig] = await Promise.all([
    readJson(repositoryRoot, 'config/plugins.json'),
    readJson(repositoryRoot, 'config/sources.lock.json')
  ]);
  const errors = [
    ...validatePluginsConfig(pluginsConfig),
    ...validateSourcesLock(lockConfig, pluginsConfig, { release })
  ];
  if (errors.length > 0) {
    throw new Error(`Configuration is invalid:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
  return { lockConfig, pluginsConfig };
}

async function listFiles(rootPath, prefix = '') {
  const entries = await readdir(rootPath, { withFileTypes: true });
  entries.sort((left, right) => comparePaths(left.name, right.name));
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix === '' ? entry.name : path.posix.join(prefix, entry.name);
    const absolutePath = path.join(rootPath, entry.name);
    const stats = await lstat(absolutePath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Symlink encountered in generator-owned root: ${relativePath}`);
    }
    if (stats.isDirectory()) {
      files.push(...(await listFiles(absolutePath, relativePath)));
      continue;
    }
    if (!stats.isFile()) {
      throw new Error(`Unsupported entry in generator-owned root: ${relativePath}`);
    }
    files.push(relativePath);
  }
  return files;
}

async function readOwnedFiles(payloadRoot) {
  const files = new Map();
  for (const generatedRoot of generatedRoots) {
    const rootPath = path.join(payloadRoot, ...generatedRoot.split('/'));
    let stats;
    try {
      stats = await lstat(rootPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`Generator-owned root must be a physical directory: ${generatedRoot}`);
    }
    const rootFiles = await listFiles(rootPath);
    for (const relativePath of rootFiles) {
      const repositoryRelativePath = `${generatedRoot}/${relativePath}`;
      files.set(
        repositoryRelativePath,
        await readFile(path.join(rootPath, ...relativePath.split('/')))
      );
    }
  }
  return files;
}

export async function compareGeneratedPayloads(expectedRoot, actualRoot) {
  const [expectedFiles, actualFiles] = await Promise.all([
    readOwnedFiles(expectedRoot),
    readOwnedFiles(actualRoot)
  ]);
  const added = [];
  const changed = [];
  const removed = [];

  for (const [relativePath, expectedContent] of expectedFiles) {
    const actualContent = actualFiles.get(relativePath);
    if (actualContent === undefined) {
      added.push(relativePath);
    } else if (!expectedContent.equals(actualContent)) {
      changed.push(relativePath);
    }
  }
  for (const relativePath of actualFiles.keys()) {
    if (!expectedFiles.has(relativePath)) {
      removed.push(relativePath);
    }
  }

  added.sort(comparePaths);
  changed.sort(comparePaths);
  removed.sort(comparePaths);
  return { added, changed, removed };
}

function hasDifferences(diagnostics) {
  return diagnostics.added.length + diagnostics.changed.length + diagnostics.removed.length > 0;
}

async function createStagedPayload(
  repositoryRoot,
  pluginsConfig,
  lockConfig,
  sourceSnapshots,
  { check }
) {
  const stagePrefix = check
    ? path.join(os.tmpdir(), 'primeui-plugins-sync-check-')
    : path.join(repositoryRoot, '.primeui-plugins-sync-');
  const stageRoot = await mkdtemp(stagePrefix);
  const payloadRoot = path.join(stageRoot, 'generated');
  await mkdir(payloadRoot, { recursive: true });

  try {
    const documents = buildPayloadDocuments(pluginsConfig, lockConfig);
    for (const [relativePath, document] of [...documents].sort(([left], [right]) => comparePaths(left, right))) {
      const destination = path.join(payloadRoot, ...relativePath.split('/'));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, stableStringify(document), { flag: 'wx' });
    }

    for (const plugin of pluginsConfig.plugins) {
      const snapshot = sourceSnapshots.get(plugin.name);
      for (const skill of snapshot.skills) {
        await copySkillTree(
          skill.skillRoot,
          path.join(payloadRoot, plugin.outputs.plugin, 'skills', skill.directory),
          skill.inspection
        );
      }
    }

    const validationErrors = await validateGeneratedPayload(payloadRoot, pluginsConfig, lockConfig);
    if (validationErrors.length > 0) {
      throw new Error(
        `Staged generated payload is invalid:\n${validationErrors.map((error) => `- ${error}`).join('\n')}`
      );
    }
    return { payloadRoot, stageRoot };
  } catch (error) {
    await rm(stageRoot, { force: true, recursive: true });
    throw error;
  }
}

async function preflightReplacement(repositoryRoot, payloadRoot) {
  for (const generatedRoot of generatedRoots) {
    const stagedPath = path.join(payloadRoot, ...generatedRoot.split('/'));
    const stagedStats = await lstat(stagedPath);
    if (stagedStats.isSymbolicLink() || !stagedStats.isDirectory()) {
      throw new Error(`Staged generator-owned root is unsafe: ${generatedRoot}`);
    }

    const segments = generatedRoot.split('/');
    let currentPath = repositoryRoot;
    for (let index = 0; index < segments.length; index += 1) {
      currentPath = path.join(currentPath, segments[index]);
      let stats;
      try {
        stats = await lstat(currentPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          break;
        }
        throw error;
      }
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(`Generator-owned path is not a physical directory: ${generatedRoot}`);
      }
    }

    const targetPath = path.join(repositoryRoot, ...segments);
    try {
      await listFiles(targetPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

async function ensureDirectory(directoryPath, repositoryRoot, createdDirectories) {
  const relativePath = path.relative(repositoryRoot, directoryPath);
  if (relativePath === '') {
    return;
  }
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Generated payload parent escapes the repository: ${directoryPath}`);
  }

  let currentPath = repositoryRoot;
  for (const segment of relativePath.split(path.sep)) {
    currentPath = path.join(currentPath, segment);
    try {
      const stats = await lstat(currentPath);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(`Generated payload parent is not a physical directory: ${currentPath}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      await mkdir(currentPath);
      createdDirectories.push(currentPath);
    }
  }
}

export async function replaceGeneratedRoots(
  repositoryRoot,
  payloadRoot,
  stageRoot,
  { beforeMutation = async () => {}, renameEntry = rename } = {}
) {
  await preflightReplacement(repositoryRoot, payloadRoot);
  await beforeMutation();
  const backupRoot = path.join(stageRoot, 'backup');
  const backedUp = [];
  const createdDirectories = [];
  const installed = [];

  try {
    for (const generatedRoot of generatedRoots) {
      const targetPath = path.join(repositoryRoot, ...generatedRoot.split('/'));
      const backupPath = path.join(backupRoot, ...generatedRoot.split('/'));
      try {
        await lstat(targetPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          continue;
        }
        throw error;
      }
      await mkdir(path.dirname(backupPath), { recursive: true });
      await renameEntry(targetPath, backupPath);
      backedUp.push({ backupPath, targetPath });
    }

    for (const generatedRoot of generatedRoots) {
      const targetPath = path.join(repositoryRoot, ...generatedRoot.split('/'));
      const stagedPath = path.join(payloadRoot, ...generatedRoot.split('/'));
      await ensureDirectory(path.dirname(targetPath), repositoryRoot, createdDirectories);
      await renameEntry(stagedPath, targetPath);
      installed.push(targetPath);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const targetPath of installed.reverse()) {
      try {
        await rm(targetPath, { force: true, recursive: true });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const { backupPath, targetPath } of backedUp.reverse()) {
      try {
        await ensureDirectory(path.dirname(targetPath), repositoryRoot, createdDirectories);
        await renameEntry(backupPath, targetPath);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const directoryPath of createdDirectories.reverse()) {
      try {
        await rmdir(directoryPath);
      } catch (rollbackError) {
        if (!['ENOENT', 'ENOTEMPTY'].includes(rollbackError.code)) {
          rollbackErrors.push(rollbackError);
        }
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], 'Generated-root replacement and rollback failed.');
    }
    throw error;
  }
}

export async function syncDistribution({
  check,
  replacementOptions,
  repositoryRoot
}) {
  const { lockConfig, pluginsConfig } = await readDistributionConfiguration(repositoryRoot, {
    release: true
  });
  const sourceSnapshots = await inspectCanonicalSkills(repositoryRoot, pluginsConfig, lockConfig, {
    requireLocked: true,
    verifyHash: true
  });
  const { payloadRoot, stageRoot } = await createStagedPayload(
    repositoryRoot,
    pluginsConfig,
    lockConfig,
    sourceSnapshots,
    { check }
  );

  try {
    await verifyCanonicalSkillSnapshots(repositoryRoot, pluginsConfig, lockConfig, sourceSnapshots);
    const diagnostics = await compareGeneratedPayloads(payloadRoot, repositoryRoot);
    const stale = hasDifferences(diagnostics);
    await verifyCanonicalSkillSnapshots(repositoryRoot, pluginsConfig, lockConfig, sourceSnapshots);
    if (!check && stale) {
      const configuredBeforeMutation = replacementOptions?.beforeMutation;
      await replaceGeneratedRoots(
        repositoryRoot,
        payloadRoot,
        stageRoot,
        {
          ...replacementOptions,
          beforeMutation: async () => {
            if (configuredBeforeMutation !== undefined) {
              await configuredBeforeMutation();
            }
            await verifyCanonicalSkillSnapshots(
              repositoryRoot,
              pluginsConfig,
              lockConfig,
              sourceSnapshots
            );
          }
        }
      );
    }
    return { ...diagnostics, stale };
  } finally {
    await rm(stageRoot, { force: true, recursive: true });
  }
}
