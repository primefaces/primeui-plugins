import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stableStringify, validateSourcesLock } from './lib/contracts.mjs';
import { readDistributionConfiguration } from './lib/generator.mjs';
import { completeSourceLock } from './lib/locking.mjs';
import { repositoryRoot } from './lib/repository.mjs';
import {
  inspectCanonicalSkills,
  parseSyncArguments,
  verifyCanonicalSkillSnapshots
} from './lib/sources.mjs';

async function main() {
  const { lockConfig, pluginsConfig } = await readDistributionConfiguration(repositoryRoot, {
    release: false
  });
  parseSyncArguments(process.argv.slice(2));
  const snapshots = await inspectCanonicalSkills(repositoryRoot, pluginsConfig, lockConfig, {
    requireLocked: false,
    verifyHash: false
  });

  const updatedLock = completeSourceLock(lockConfig, snapshots);

  const validationErrors = validateSourcesLock(updatedLock, pluginsConfig, { release: true });
  if (validationErrors.length > 0) {
    throw new Error(
      `Completed source lock is invalid:\n${validationErrors.map((error) => `- ${error}`).join('\n')}`
    );
  }

  await verifyCanonicalSkillSnapshots(repositoryRoot, pluginsConfig, lockConfig, snapshots);

  const lockPath = path.join(repositoryRoot, 'config', 'sources.lock.json');
  const temporaryPath = path.join(
    repositoryRoot,
    'config',
    `.sources.lock.json.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await writeFile(temporaryPath, stableStringify(updatedLock), { flag: 'wx' });
    await verifyCanonicalSkillSnapshots(repositoryRoot, pluginsConfig, lockConfig, snapshots);
    await rename(temporaryPath, lockPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }

  console.log('Source locks recorded:');
  for (const lock of updatedLock.sources) {
    for (const skill of lock.skills) {
      console.log(`- ${lock.name}/${skill.id}: ${skill.source.path} ${skill.source.treeHash}`);
    }
  }
}

main().catch((error) => {
  console.error(`Source locking failed: ${error.message}`);
  process.exitCode = 1;
});
