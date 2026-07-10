# PrimeUI Plugins

Official AI assistant integrations for PrimeVue, PrimeNG, and PrimeReact.

The `primeui` marketplace provides one independently installable plugin per library. Installing a library plugin adds its workflow skill and connects the matching MCP server without loading guidance or tools from the other libraries.

## Plugins

| Plugin | MCP package | Supported clients |
| --- | --- | --- |
| `primevue` | `@primevue/mcp` | Claude Code, Codex, Gemini CLI |
| `primeng` | `@primeng/mcp` | Claude Code, Codex, Gemini CLI |
| `primereact` | `@primereact/mcp` | Claude Code, Codex, Gemini CLI |

Each plugin combines:

- A library-specific skill for setup, implementation, customization, migration, troubleshooting, and validation workflows.
- An exact-version MCP configuration for current component documentation, API metadata, examples, guides, and usage validation.
- Client-specific manifests generated from the same locked source inputs.

Installation instructions are published with installable plugin releases.

## Repository model

Framework repositories own the canonical skills and MCP packages. This repository locks accepted source commits and produces self-contained distribution snapshots.

Authored inputs include:

- `config/plugins.json`: marketplace identity, plugin metadata, MCP identities, client support, and output declarations.
- `config/sources.lock.json`: exact skill source commits, content hashes, plugin versions, and MCP versions.
- JSON Schemas, validation tooling, tests, and release rules.

Generated outputs include marketplace catalogs, client manifests, copied physical skill trees, MCP launch configurations, Gemini extensions, and provenance records. Generated payloads are never edited manually.

## Validation

The repository uses Node.js built-ins only. Do not install dependencies.

```bash
npm run validate:config
npm test
npm run format:check
npm run check:boundaries
npm run check:security
npm run check
npm run check:clean
```

`npm run validate:release` requires every source lock to contain complete, immutable release provenance.

`npm run check:clean` snapshots the exact Git state, runs the validation suite, and fails if a check modifies the worktree or index.

## Client contracts

Distribution output follows the official client contracts:

- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code marketplace reference](https://code.claude.com/docs/en/plugin-marketplaces)
- [Codex plugin documentation](https://learn.chatgpt.com/docs/build-plugins)
- [Gemini CLI extension reference](https://geminicli.com/docs/extensions/reference/)
- [Gemini CLI Agent Skills](https://geminicli.com/docs/cli/skills/)

See [RELEASE.md](RELEASE.md) for release integrity requirements.
