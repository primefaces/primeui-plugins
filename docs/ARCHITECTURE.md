# Repository architecture

This repository is the single authored source for PrimeUI workflow skills and the generated plugin payloads that distribute them. PrimeVue, PrimeNG, and PrimeReact remain independently installable.

## Branch ownership

- `dev` owns all authored inputs, generated outputs, tests, validation, and release automation.
- `main` is generated from an explicit allowlist and is never a merge target for development commits.
- `.github/workflows/promote-main.yml` checks out one fixed `dev` commit, runs the complete repository and client gates, builds the public tree outside the checkout, verifies that `dev` did not advance, and replaces `main` only when the output changed.

The public tree contains `README.md`, the Claude/Codex/Copilot/Cursor marketplace catalogs, the three self-contained `plugins/<library>/` roots, and the promotion workflow required for the next release. Development-only paths such as `config/`, canonical `skills/`, `scripts/`, `tests/`, `evaluations/`, and package metadata must never appear on `main`.

## Ownership

```text
primeui-plugins/
├── .agents/plugins/marketplace.json       # generated Codex catalog
├── .claude-plugin/marketplace.json         # generated Claude catalog
├── .github/plugin/marketplace.json         # generated GitHub Copilot catalog
├── .cursor-plugin/marketplace.json         # generated Cursor catalog
├── config/                                 # authored product and release contracts
├── skills/                                 # authored canonical skill trees
├── plugins/                                # generated universal library payloads
│   └── <library>/
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── .github/plugin/plugin.json
│       ├── .cursor-plugin/plugin.json
│       ├── gemini-extension.json
│       ├── .mcp.json
│       ├── provenance.json
│       └── skills/<declared-skill-directory>/
├── scripts/                                # generator, validators, and smoke tooling
└── tests/                                  # deterministic contract coverage
```

The root marketplace paths are required discovery locations for their respective clients. Each `plugins/<library>` directory is self-contained because installed clients may copy or cache only that directory. The same ordered physical skill set and provenance record are shared by Claude, Codex, GitHub Copilot, Cursor, and Gemini inside that universal payload. Gemini's current runtime listing is set-exact but order-neutral because the host does not expose declared skill order; generated provenance remains authoritative for order and independent hashes. Every payload still contains exactly one selected-library MCP server.

## Authored inputs

- `config/plugins.json` owns marketplace identity, install-surface metadata, supported hosts, MCP package identity, generated plugin paths, and each library's ordered skill identities, directories, canonical roots, order, and ownership.
- `config/sources.lock.json` owns exact plugin versions, exact MCP package versions, ordered skill metadata, and one deterministic tree hash per canonical skill.
- Declared paths below `skills/<library>/` are the only editable skill sources.
- Schemas, tests, and release rules define the accepted public contract.

## Generated outputs

The generator exclusively owns `.agents/plugins/`, `.claude-plugin/`, `.github/plugin/`, `.cursor-plugin/`, and `plugins/`. Generated manifests, skill copies, MCP configuration, and provenance must never be edited directly.

`npm run sync` builds a complete staged tree, validates it, and atomically replaces only those roots. `npm run sync:check` compares a temporary generated tree with the committed output without modifying the repository.

The ordered-set model is the compatibility boundary for the previous single-skill layout. A library may currently declare one entry, but generation always treats it as a set. Moving to several entries replaces the entire generated `skills/` root transactionally, removes the old single-skill copy, and rolls back the prior root on failure. No fallback or duplicate compatibility copy is retained.

PrimeVue, PrimeNG, and PrimeReact use that model for one router plus six focused workflow skills. Each router selects exactly one smallest workflow, and the focused skills contain procedure and call budgets only; component documentation, API tables, examples, setup candidates, and citations remain owned by the matching MCP artifacts. PrimeNG's setup skill accepts only current routed standalone setup metadata and returns unsupported for undocumented NgModule setup without synthesizing guidance or URLs. PrimeReact selects a source-backed mode before retrieval and keeps imports, APIs, examples, setup, validation, and citations mode-scoped; Gemini runtime discovery validates exact membership without imposing host order, while generated roots and provenance remain order-strict.

## Gemini distribution

Gemini requires `gemini-extension.json` at the root of an installable extension repository or release archive. The universal plugin root satisfies the extension contract for local validation, while `npm run export:gemini -- --out <path>` creates one minimal, self-contained extension root per library for future publication through dedicated distribution repositories.

The export command never writes inside this source repository and refuses to replace an existing destination. Distribution repositories are generated release targets, not additional authored sources.
