import { access, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stableStringify } from './contracts.mjs';
import { readDistributionConfiguration } from './generator.mjs';
import { geminiExtensionDocument, provenanceDocument } from './payloads.mjs';
import { copySkillTree } from './skill-tree.mjs';
import { inspectCanonicalSkills } from './sources.mjs';

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
    throw new Error('Gemini distribution output must be outside the source repository.');
  }
}

export async function exportGeminiDistributions({ destinationRoot, libraries, repositoryRoot }) {
  await assertOutsideRepository(destinationRoot, repositoryRoot);
  if (await pathExists(destinationRoot)) {
    throw new Error(`Gemini distribution destination already exists: ${destinationRoot}`);
  }

  const { lockConfig, pluginsConfig } = await readDistributionConfiguration(repositoryRoot, {
    release: true
  });
  const selected = pluginsConfig.plugins.filter((plugin) => libraries.includes(plugin.name));
  if (selected.length !== libraries.length) {
    const unknown = libraries.filter((name) => !selected.some((plugin) => plugin.name === name));
    throw new Error(`Unknown Gemini distribution library: ${unknown.join(', ')}`);
  }
  const snapshots = await inspectCanonicalSkills(repositoryRoot, pluginsConfig, lockConfig, {
    requireLocked: true,
    verifyHash: true
  });
  const locks = new Map(lockConfig.sources.map((lock) => [lock.name, lock]));

  try {
    for (const plugin of selected) {
      const lock = locks.get(plugin.name);
      const snapshot = snapshots.get(plugin.name);
      const extensionRoot = path.join(destinationRoot, plugin.name);
      await mkdir(extensionRoot, { recursive: true });
      await writeFile(
        path.join(extensionRoot, 'gemini-extension.json'),
        stableStringify(geminiExtensionDocument(plugin, lock)),
        { flag: 'wx' }
      );
      await writeFile(
        path.join(extensionRoot, 'provenance.json'),
        stableStringify(provenanceDocument(plugin, lock)),
        { flag: 'wx' }
      );
      await copySkillTree(
        snapshot.skillRoot,
        path.join(extensionRoot, 'skills', plugin.name),
        snapshot.inspection
      );
    }
  } catch (error) {
    await rm(destinationRoot, { force: true, recursive: true });
    throw error;
  }

  return selected.map((plugin) => path.join(destinationRoot, plugin.name));
}

export async function readGeminiDistributionManifest(extensionRoot) {
  return JSON.parse(await readFile(path.join(extensionRoot, 'gemini-extension.json'), 'utf8'));
}
