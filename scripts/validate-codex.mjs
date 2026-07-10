import { repositoryRoot } from './lib/repository.mjs';
import {
  parseCodexSmokeArguments,
  runCodexInstallScenario,
  validateCodexRuntime
} from './lib/codex-smoke.mjs';

async function main() {
  const options = parseCodexSmokeArguments(process.argv.slice(2));
  const runtime = await validateCodexRuntime({
    keepTemp: options.keepTemp,
    repositoryRoot
  });
  console.log(
    `Codex ${runtime.version} exposes native marketplace add/list/upgrade/remove and plugin add/list/remove commands.`
  );
  console.log(
    'Plugin enable/disable remains an interactive /plugins or ChatGPT desktop surface; no non-interactive plugin state command was invented.'
  );
  if (runtime.temporaryRoot) {
    console.log(`Runtime validation temp root: ${runtime.temporaryRoot}`);
  }

  for (const source of options.sources) {
    for (const library of options.libraries) {
      const result = await runCodexInstallScenario({
        keepTemp: options.keepTemp,
        library,
        repositoryRoot,
        source
      });
      console.log(
        `${source}/${library}: registration, catalog, selected-only cache, install, ${result.refreshMode}, remove, reinstall, and installed-payload MCP smoke passed (${result.toolNames.join(', ')}).`
      );
      if (result.temporaryRoot) {
        console.log(`Scenario temp root: ${result.temporaryRoot}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(`Codex validation failed: ${error.message}`);
  process.exitCode = 1;
});
