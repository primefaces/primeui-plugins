# Repository architecture

This repository is the single authored source for PrimeUI workflow skills and the generated plugin payloads that distribute them. PrimeVue, PrimeNG, and PrimeReact remain independently installable.

## Ownership

```text
primeui-plugins/
├── .agents/plugins/marketplace.json       # generated Codex catalog
├── .claude-plugin/marketplace.json         # generated Claude catalog
├── .cursor-plugin/marketplace.json         # generated Cursor catalog
├── config/                                 # authored product and release contracts
├── skills/                                 # authored canonical skill trees
├── plugins/                                # generated universal library payloads
│   └── <library>/
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── .cursor-plugin/plugin.json
│       ├── gemini-extension.json
│       ├── .mcp.json
│       ├── provenance.json
│       └── skills/<library>/
├── scripts/                                # generator, validators, and smoke tooling
└── tests/                                  # deterministic contract coverage
```

The root marketplace paths are required discovery locations for their respective clients. Each `plugins/<library>` directory is self-contained because installed clients may copy or cache only that directory. The same physical skill tree and provenance record are shared by Claude, Codex, Cursor, and Gemini inside that universal payload.

## Authored inputs

- `config/plugins.json` owns marketplace identity, install-surface metadata, supported hosts, MCP package identity, and generated plugin paths.
- `config/sources.lock.json` owns exact plugin versions, exact MCP package versions, and canonical skill hashes.
- `skills/<library>/` is the only editable skill source.
- Schemas, tests, and release rules define the accepted public contract.

## Generated outputs

The generator exclusively owns `.agents/plugins/`, `.claude-plugin/`, `.cursor-plugin/`, and `plugins/`. Generated manifests, skill copies, MCP configuration, and provenance must never be edited directly.

`npm run sync` builds a complete staged tree, validates it, and atomically replaces only those roots. `npm run sync:check` compares a temporary generated tree with the committed output without modifying the repository.

## Gemini distribution

Gemini requires `gemini-extension.json` at the root of an installable extension repository or release archive. The universal plugin root satisfies the extension contract for local validation, while `npm run export:gemini -- --out <path>` creates one minimal, self-contained extension root per library for future publication through dedicated distribution repositories.

The export command never writes inside this source repository and refuses to replace an existing destination. Distribution repositories are generated release targets, not additional authored sources.
