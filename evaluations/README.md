# Public prompt library and behavioral evaluations

The three JSON files in this directory are the public, provider-neutral PrimeUI prompt library and the deterministic evaluation fixtures:

- `primevue.json`
- `primeng.json`
- `primereact.json`

Every `prompt` is ready to paste into an assistant that has the matching library plugin. Prompts describe useful work but do not embed expected prose, APIs, imports, examples, or product claims. Current component docs, API tables, examples, setup candidates, citations, modes, Angular API metadata, and hooks remain owned by the selected MCP server.

Each scenario declares a stable library-prefixed ID, release-critical coverage tags, the smallest focused skill, the allowed and forbidden MCP calls, a call ceiling, required evidence, the expected validation outcome, and a deterministic reference trace. Setup, environment, doctor, or PrimeReact mode and ambiguity expectations appear only where applicable.

## Inspect prompts

Open the JSON file for the selected library and use the `prompt` field from any scenario. The library currently contains 13 PrimeVue scenarios, 14 PrimeNG scenarios, and 17 PrimeReact scenarios. PrimeNG includes current standalone setup and explicit unsupported NgModule handling. PrimeReact includes styled, Tailwind, primitive, headless, advertised hooks, and unresolved-mode behavior.

## Default acceptance

Run the dependency-free, no-model evaluator:

```bash
node scripts/evaluate-contracts.mjs
```

It runs offline without network access, credentials, assistant profiles, or model calls. It validates schema shape, release-critical coverage, exact seven-skill routing, allowed and forbidden calls, the 2/3/4/3 component and setup ceilings, final-validation and repair policy, routine-version prohibition, exact doctor commands, library and PrimeReact mode isolation, generated skill hashes and provenance, one selected-library MCP server, its exact package pin, and the eight-tool inventory.

`npm test`, `npm run check`, and `npm run check:clean` also exercise the evaluator and its negative cases. The normal gate never invokes an authenticated host session.

## Optional external adapters

Authenticated model or host adapters are intentionally not included in AIT-021. A future adapter must be a separate explicit opt-in command, remain disabled by default, report a skipped result when credentials are absent, never run from normal checks, never mutate a real profile, and never commit credentials or model output. The isolated Claude, Codex, Gemini, and Cursor payload matrices remain the automated host-distribution acceptance surface.
