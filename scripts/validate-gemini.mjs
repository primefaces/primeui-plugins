import { repositoryRoot } from './lib/repository.mjs';
import {
  parseGeminiSmokeArguments,
  runGeminiInstallScenario,
  validateGeminiRuntime
} from './lib/gemini-smoke.mjs';

async function main() {
  const options = parseGeminiSmokeArguments(process.argv.slice(2));
  const runtime = await validateGeminiRuntime({
    keepTemp: options.keepTemp,
    repositoryRoot
  });
  console.log(
    `Gemini CLI ${runtime.version} exposes native validate, install, list, enable, disable, update, uninstall, and local-source commands.`
  );
  console.log(
    'Every scenario uses external-auth mode only to bypass model authentication; no credentials or real Gemini state are inherited.'
  );
  if (runtime.temporaryRoot) {
    console.log(`Runtime validation temp root: ${runtime.temporaryRoot}`);
  }

  for (const source of options.sources) {
    for (const library of options.libraries) {
      const result = await runGeminiInstallScenario({
        keepTemp: options.keepTemp,
        library,
        repositoryRoot,
        source
      });
      console.log(
        `${source}/${library}: validate, selected-only install, skill/MCP discovery, enable/disable, ${result.refreshMode}, uninstall, reinstall, cleanup, and installed-payload MCP smoke passed (${result.toolNames.join(', ')}).`
      );
      if (result.temporaryRoot) {
        console.log(`Scenario temp root: ${result.temporaryRoot}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(`Gemini validation failed: ${error.message}`);
  process.exitCode = 1;
});
