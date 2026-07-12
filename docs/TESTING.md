# Testing

The repository uses Node.js built-ins only. Do not install project dependencies.

## Local gates

```bash
npm run validate:config
npm run validate:release
npm test
npm run format:check
npm run check:boundaries
npm run check:security
npm run check
npm run sync:check
npm run check:clean
```

`check:clean` snapshots the exact Git state, runs the validation suite, and fails if a check modifies the worktree or index.

## Client matrices

```bash
npm run validate:claude -- --source all
npm run validate:codex -- --source all
npm run validate:cursor -- --source all
npm run validate:gemini -- --source all
```

Every scenario uses isolated temporary client state, npm caches, and configuration. Credential-bearing environment values are removed. The validators prove exact ordered selected-library payload and provenance inventory, foreign-skill exclusion, one exact MCP pin, the expected eight-tool surface, Button documentation, valid usage, invalid-property rejection, and PrimeReact styled/Tailwind routing. Gemini runtime discovery is validated as an exact unique selected-library set without claiming runtime enumeration order; its installed provenance and physical skill hashes remain order-strict.

Deterministic synthetic generator fixtures exercise seven-skill shapes across all three libraries. Canonical PrimeVue and PrimeNG suites cover known components, source-backed behavior, discovery, setup, theming, accessibility/icons, migration, invalid-API repair, missing MCP, and duplicate direct-MCP plus plugin configuration. The PrimeNG suite additionally covers explicit unsupported NgModule setup plus routed Table, forms, templates, directives, inputs, and outputs. These suites prove router selection, allowed and forbidden calls, call ceilings, final-validation policy, and the absence of routine `version` calls without invoking a model. Generator and host suites cover all four discovery surfaces, stable independent tree hashes, one-MCP isolation, stale-copy cleanup, and injected migration rollback.

Claude validation covers marketplace installation and lifecycle. Codex validation covers marketplace snapshots, plugin cache behavior, and MCP discovery. Cursor validation covers direct payload and marketplace resolution without modifying a real Cursor profile. Gemini validation covers the universal plugin root, the minimal exported distribution, and a persistent public checkout through extension validation, install, enable/disable, update, uninstall, native skill discovery, and MCP discovery.

Authenticated model-session behavior and installed desktop UI acceptance remain manual gates because automated validation does not import user credentials or mutate real profiles.

## Gemini export

Create future publication payloads outside the repository:

```bash
npm run export:gemini -- --out /tmp/primeui-gemini
npm run export:gemini -- --out /tmp/primevue-gemini --library primevue
```

Each exported library directory contains only `gemini-extension.json`, `provenance.json`, and the exact matching ordered physical skill set. Repeating the export to different empty destinations must produce byte-identical files.

## Automation

The `Validate` workflow runs deterministic repository checks on pull requests and pushes to `main`. The scheduled and manually dispatchable `Public Client Smoke` workflow installs current client CLIs and reruns the public-source matrices without authenticated model sessions.
