import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fileHashPattern = /^[0-9a-f]{64}$/;

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function assertNormalizedRelativePath(relativePath) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    relativePath.includes('\\') ||
    relativePath.includes('\0') ||
    /[\u0000-\u001f\u007f]/.test(relativePath) ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath.normalize('NFC') !== relativePath ||
    relativePath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`Unsafe or non-normalized skill-tree path: ${JSON.stringify(relativePath)}`);
  }
}

function registerPath(relativePath, exactPaths, caseFoldedPaths, { allowExisting = false } = {}) {
  assertNormalizedRelativePath(relativePath);

  if (exactPaths.has(relativePath)) {
    if (allowExisting) {
      return;
    }
    throw new Error(`Duplicate normalized skill-tree path: ${relativePath}`);
  }
  exactPaths.add(relativePath);

  const caseFolded = relativePath.toLowerCase();
  const existing = caseFoldedPaths.get(caseFolded);
  if (existing !== undefined && existing !== relativePath) {
    throw new Error(`Case-colliding skill-tree paths: ${existing} and ${relativePath}`);
  }
  caseFoldedPaths.set(caseFolded, relativePath);
}

async function readPhysicalFile(filePath, relativePath) {
  let handle;
  try {
    handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    throw new Error(`Unable to open regular skill file ${relativePath}: ${error.message}`);
  }

  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw new Error(`Unsupported skill-tree entry: ${relativePath}`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export function normalizeSkillTreeRecords(records) {
  if (!Array.isArray(records)) {
    throw new Error('Skill-tree records must be an array.');
  }

  const exactPaths = new Set();
  const caseFoldedPaths = new Map();
  const filePaths = new Set();
  const normalized = records.map((record, index) => {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`Skill-tree record ${index} must be an object.`);
    }

    const keys = Object.keys(record).sort();
    if (keys.join(',') !== 'path,sha256,size') {
      throw new Error(`Skill-tree record ${index} must contain only path, size, and sha256.`);
    }

    const segments = record.path.split('/');
    for (let segmentIndex = 1; segmentIndex < segments.length; segmentIndex += 1) {
      registerPath(
        segments.slice(0, segmentIndex).join('/'),
        exactPaths,
        caseFoldedPaths,
        { allowExisting: true }
      );
    }
    registerPath(record.path, exactPaths, caseFoldedPaths);
    filePaths.add(record.path);
    if (!Number.isSafeInteger(record.size) || record.size < 0) {
      throw new Error(`Skill-tree record ${record.path} has an invalid byte size.`);
    }
    if (typeof record.sha256 !== 'string' || !fileHashPattern.test(record.sha256)) {
      throw new Error(`Skill-tree record ${record.path} has an invalid SHA-256 digest.`);
    }

    return { path: record.path, size: record.size, sha256: record.sha256 };
  });

  for (const filePath of filePaths) {
    const segments = filePath.split('/');
    for (let segmentIndex = 1; segmentIndex < segments.length; segmentIndex += 1) {
      const parentPath = segments.slice(0, segmentIndex).join('/');
      if (filePaths.has(parentPath)) {
        throw new Error(`Skill-tree path is both a file and a directory: ${parentPath}`);
      }
    }
  }

  return normalized.sort((left, right) => compareUtf8(left.path, right.path));
}

export function serializeSkillTreeRecords(records) {
  return JSON.stringify(normalizeSkillTreeRecords(records));
}

export function computeSkillTreeHash(records) {
  const serialized = serializeSkillTreeRecords(records);
  return `sha256:${createHash('sha256').update(serialized, 'utf8').digest('hex')}`;
}

export async function inspectSkillTree(rootPath) {
  const rootStats = await lstat(rootPath).catch((error) => {
    throw new Error(`Skill tree does not exist at ${rootPath}: ${error.message}`);
  });
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error(`Skill tree must be a physical directory: ${rootPath}`);
  }

  const records = [];
  const exactPaths = new Set();
  const caseFoldedPaths = new Map();

  async function visit(directoryPath, prefix) {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    entries.sort((left, right) => compareUtf8(left.name, right.name));

    for (const entry of entries) {
      const relativePath = prefix === '' ? entry.name : path.posix.join(prefix, entry.name);
      registerPath(relativePath, exactPaths, caseFoldedPaths);

      const absolutePath = path.join(directoryPath, entry.name);
      const stats = await lstat(absolutePath);
      if (stats.isSymbolicLink()) {
        throw new Error(`Symlinks are forbidden in skill trees: ${relativePath}`);
      }
      if (stats.isDirectory()) {
        await visit(absolutePath, relativePath);
        continue;
      }
      if (!stats.isFile()) {
        throw new Error(`Unsupported skill-tree entry: ${relativePath}`);
      }

      const content = await readPhysicalFile(absolutePath, relativePath);
      records.push({
        path: relativePath,
        sha256: createHash('sha256').update(content).digest('hex'),
        size: content.byteLength
      });
    }
  }

  await visit(rootPath, '');
  const normalizedRecords = normalizeSkillTreeRecords(records);
  return {
    hash: computeSkillTreeHash(normalizedRecords),
    records: normalizedRecords
  };
}

export async function copySkillTree(sourceRoot, destinationRoot, expectedInspection) {
  const inspection = expectedInspection ?? (await inspectSkillTree(sourceRoot));
  await mkdir(destinationRoot, { recursive: true });

  for (const record of inspection.records) {
    const sourcePath = path.join(sourceRoot, ...record.path.split('/'));
    const content = await readPhysicalFile(sourcePath, record.path);
    const actualDigest = createHash('sha256').update(content).digest('hex');
    if (content.byteLength !== record.size || actualDigest !== record.sha256) {
      throw new Error(`Skill source changed while copying: ${record.path}`);
    }

    const destinationPath = path.join(destinationRoot, ...record.path.split('/'));
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, content, { flag: 'wx' });
  }

  const copiedInspection = await inspectSkillTree(destinationRoot);
  if (copiedInspection.hash !== inspection.hash) {
    throw new Error(
      `Copied skill tree hash mismatch: expected ${inspection.hash}, received ${copiedInspection.hash}`
    );
  }
  return copiedInspection;
}
