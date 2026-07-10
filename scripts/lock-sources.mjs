import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stableStringify, validateSourcesLock } from './lib/contracts.mjs';
import { readDistributionConfiguration } from './lib/generator.mjs';
import { completeSourceLock } from './lib/locking.mjs';
import { repositoryRoot } from './lib/repository.mjs';
import {
  inspectSourceRepositories,
  parseSourceArguments,
  verifySourceSnapshots
} from './lib/sources.mjs';

async function main() {
  const { lockConfig, pluginsConfig } = await readDistributionConfiguration(repositoryRoot, {
    release: false
  });
  const names = pluginsConfig.plugins.map((plugin) => plugin.name);
  const { sources } = parseSourceArguments(process.argv.slice(2), names);
  const snapshots = await inspectSourceRepositories(pluginsConfig, lockConfig, sources, {
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

  await verifySourceSnapshots(pluginsConfig, lockConfig, sources, snapshots);

  const lockPath = path.join(repositoryRoot, 'config', 'sources.lock.json');
  const temporaryPath = path.join(
    repositoryRoot,
    'config',
    `.sources.lock.json.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await writeFile(temporaryPath, stableStringify(updatedLock), { flag: 'wx' });
    await verifySourceSnapshots(pluginsConfig, lockConfig, sources, snapshots);
    await rename(temporaryPath, lockPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }

  console.log('Source locks recorded:');
  for (const lock of updatedLock.sources) {
    console.log(`- ${lock.name}: ${lock.source.commit} ${lock.source.skillHash}`);
  }
}

main().catch((error) => {
  console.error(`Source locking failed: ${error.message}`);
  process.exitCode = 1;
});
