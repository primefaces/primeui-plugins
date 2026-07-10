import { repositoryRoot } from './lib/repository.mjs';
import {
  parseClaudeSmokeArguments,
  runClaudeInstallScenario,
  validateClaudeManifests
} from './lib/claude-smoke.mjs';

async function main() {
  const options = parseClaudeSmokeArguments(process.argv.slice(2));
  const validation = await validateClaudeManifests({
    claudeVersion: options.claudeVersion,
    keepTemp: options.keepTemp,
    repositoryRoot
  });
  console.log(
    `Claude ${validation.version} validated the marketplace and all plugins${
      validation.strict ? ' with strict warnings-as-errors' : ' without strict support'
    }.`
  );
  if (validation.temporaryRoot) {
    console.log(`Validation temp root: ${validation.temporaryRoot}`);
  }

  for (const source of options.sources) {
    for (const library of options.libraries) {
      const result = await runClaudeInstallScenario({
        claudeVersion: options.claudeVersion,
        keepTemp: options.keepTemp,
        library,
        repositoryRoot,
        source
      });
      console.log(
        `${source}/${library}: install, discovery, isolation, lifecycle, reinstall, and installed-payload MCP smoke passed (${result.toolNames.join(', ')}).`
      );
      if (result.temporaryRoot) {
        console.log(`Scenario temp root: ${result.temporaryRoot}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(`Claude validation failed: ${error.message}`);
  process.exitCode = 1;
});
