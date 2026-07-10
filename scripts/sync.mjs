import { readDistributionConfiguration, syncDistribution } from './lib/generator.mjs';
import { repositoryRoot } from './lib/repository.mjs';
import { parseSourceArguments } from './lib/sources.mjs';

function printDiagnostics(diagnostics) {
  for (const [label, marker, files] of [
    ['Added', '+', diagnostics.added],
    ['Removed', '-', diagnostics.removed],
    ['Changed', '~', diagnostics.changed]
  ]) {
    if (files.length === 0) {
      continue;
    }
    console.error(`${label}:`);
    for (const file of files) {
      console.error(`${marker} ${file}`);
    }
  }
}

async function main() {
  const { pluginsConfig } = await readDistributionConfiguration(repositoryRoot, { release: true });
  const names = pluginsConfig.plugins.map((plugin) => plugin.name);
  const { check, sources } = parseSourceArguments(process.argv.slice(2), names, {
    allowCheck: true
  });
  const result = await syncDistribution({ check, repositoryRoot, sourcePaths: sources });

  if (check && result.stale) {
    console.error('Generated payloads are stale.');
    printDiagnostics(result);
    process.exitCode = 1;
    return;
  }
  if (check) {
    console.log('Generated payload freshness check passed.');
    return;
  }
  if (result.stale) {
    console.log(
      `Generated payloads synchronized (${result.added.length} added, ${result.removed.length} removed, ${result.changed.length} changed).`
    );
  } else {
    console.log('Generated payloads are current; no files changed.');
  }
}

main().catch((error) => {
  console.error(`Generation failed: ${error.message}`);
  process.exitCode = 1;
});
