import { repositoryRoot } from './lib/repository.mjs';
import {
  inspectCursorRuntime,
  parseCursorSmokeArguments,
  runCursorPayloadScenario
} from './lib/cursor-smoke.mjs';

async function main() {
  const options = parseCursorSmokeArguments(process.argv.slice(2));
  const detectedRuntime = await inspectCursorRuntime();
  if (detectedRuntime.available) {
    console.log(
      `Cursor was detected at ${detectedRuntime.path}, but no documented isolated profile contract is available; the validator did not execute or mutate it.`
    );
  } else {
    console.log('No Cursor CLI or application was detected; no client was downloaded or executed.');
  }
  console.log(
    'Cursor install, native discovery, component disable/remove, Marketplace update, and reinstall remain manual client acceptance gates.'
  );

  for (const source of options.sources) {
    for (const library of options.libraries) {
      const result = await runCursorPayloadScenario({
        keepTemp: options.keepTemp,
        library,
        repositoryRoot,
        source
      });
      console.log(
        `${source}/${library}: schema, path, selected-only skill/MCP isolation, compatible range, temporary staging/refresh/remove/reinstall cleanup, and MCP smoke passed (${result.toolNames.join(', ')}).`
      );
      if (result.temporaryRoot) {
        console.log(`Scenario temp root: ${result.temporaryRoot}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(`Cursor validation failed: ${error.message}`);
  process.exitCode = 1;
});
