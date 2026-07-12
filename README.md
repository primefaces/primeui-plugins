# PrimeUI Plugins

Official AI assistant integrations for PrimeVue, PrimeNG, and PrimeReact.

The `primeui` marketplace provides one independently installable plugin per library. Installing a library plugin adds its ordered workflow skill set and connects the matching MCP server without loading guidance or tools from the other libraries.

## Plugins

| Plugin | MCP package | Supported clients |
| --- | --- | --- |
| `primevue` | `@primevue/mcp` | Claude Code, Codex, Cursor, Gemini CLI |
| `primeng` | `@primeng/mcp` | Claude Code, Codex, Cursor, Gemini CLI |
| `primereact` | `@primereact/mcp` | Claude Code, Codex, Cursor, Gemini CLI |

Each plugin combines:

- A library-specific ordered skill set for progressive workflow disclosure.
- An exact-version MCP configuration for current component documentation, API metadata, examples, guides, and usage validation.
- Client-specific manifests generated from the same locked source inputs.

## Claude Code

Add the public marketplace, then install the one library plugin you need:

```bash
claude plugin marketplace add primefaces/primeui-plugins
claude plugin install primevue@primeui
```

Use `primeng@primeui` or `primereact@primeui` instead for the other libraries. Confirm the selected plugin and its enabled state with:

```bash
claude plugin list --json
```

Each plugin installs its own library skill set and exact-version MCP server. Updates remain library-specific:

```bash
claude plugin marketplace update primeui
claude plugin update primevue@primeui
```

## Codex

Register the public marketplace, inspect its catalog, and install only the library plugin you need:

```bash
codex plugin marketplace add primefaces/primeui-plugins
codex plugin list --available
codex plugin add primevue@primeui
codex plugin list
```

Use `primeng@primeui` or `primereact@primeui` instead for the other libraries. Codex installs the selected plugin into its versioned plugin cache with one ordered library skill set and one exact-version MCP server. Use the interactive `/plugins` browser or the ChatGPT desktop Plugins screen to enable or disable a plugin. The CLI's generic `--enable` and `--disable` options control Codex feature flags, not plugin state.

Refresh a Git-backed marketplace, remove the installed plugin, and reinstall it to pick up a new plugin version:

```bash
codex plugin marketplace upgrade primeui
codex plugin remove primevue@primeui
codex plugin add primevue@primeui
```

To remove the marketplace completely, remove its installed plugins first, then run `codex plugin marketplace remove primeui`. Removing the marketplace first can leave installed plugin state and cache behind.

For local development, pass the repository root to `codex plugin marketplace add`. Local marketplaces are live paths and do not support the Git-only `marketplace upgrade` command; remove and reinstall the selected plugin after changing generated payloads.

## Cursor

Cursor plugins bundle skills and MCP servers into one installation. After the PrimeUI plugins complete Cursor Marketplace review, find the selected PrimeVue, PrimeNG, or PrimeReact plugin in the Marketplace or open Cursor's supported `/add-plugin` flow. Cursor's public documentation does not define arguments for `/add-plugin`, so this repository does not publish a repository URL or path form for that command.

Cursor can install Marketplace plugins at user or workspace scope. Manage installed plugins and their components from **Customize**. A plugin skill appears in **Agent Decides** and can be invoked as `/primevue`, `/primeng`, or `/primereact`; its MCP server can be enabled or disabled from the same surface. Public Marketplace updates are reviewed by Cursor and require the publisher to request a re-index after changing the repository.

For local development, copy or symlink exactly one generated library root into Cursor's documented local-plugin directory, then restart Cursor or run **Developer: Reload Window**:

```bash
ln -s <persistent-checkout>/plugins/primevue ~/.cursor/plugins/local/primevue
```

Use `primeng` or `primereact` instead for the other libraries. The repository validator never writes to `~/.cursor`; it stages payloads only under a fresh temporary home. Client-native installation, discovery, component disable/remove, update, and reinstall remain manual acceptance checks until a safely isolated Cursor runtime is available.

## Gemini CLI

Gemini installs one extension from one extension root. The public repository contains three extension roots, so install the selected library from an existing persistent checkout instead of the repository root:

```bash
gemini extensions validate <persistent-checkout>/plugins/primevue
gemini extensions install <persistent-checkout>/plugins/primevue --consent
gemini extensions list --output-format json
```

Use `primeng` or `primereact` in the path for the other libraries. Gemini CLI 0.29.3 requires extension management to be enabled with `experimental.extensionManagement` in its settings. The extension uses native `skills/<library>/SKILL.md` discovery and embeds the exact matching MCP server; it does not generate `GEMINI.md`.

The installed extension retains its local source path. After refreshing that persistent checkout, update a versioned payload with:

```bash
gemini extensions update primevue
```

Gemini 0.29.3 detects local updates by comparing the source and installed manifest versions. If refreshed content keeps the same version, use the supported uninstall and reinstall path:

```bash
gemini extensions uninstall primevue
gemini extensions install <persistent-checkout>/plugins/primevue --consent
```

Extension installation has no Git-subdirectory `--path` option. Until dedicated generated distribution repositories are available, Gemini installation therefore requires a persistent checkout of this source repository.

## Repository model

This repository owns the canonical skills and the generated client payloads. Framework repositories own only their MCP packages. Keeping the skill source beside its distribution tooling makes skill review, plugin generation, and release versioning one atomic repository change.

Authored inputs include:

- `config/plugins.json`: marketplace identity, plugin metadata, MCP identities, client support, output declarations, and ordered skill identity/ownership/source contracts.
- Declared paths below `skills/<library>/`: canonical PrimeVue, PrimeNG, and PrimeReact workflow skills.
- `config/sources.lock.json`: ordered per-skill tree hashes, plugin versions, and exact MCP versions.
- JSON Schemas, validation tooling, tests, and release rules.

Generated outputs include marketplace catalogs, client manifests, copied physical skill trees, MCP launch configurations, Gemini extensions, and provenance records. Generated payloads are never edited manually.

All four clients share one generated payload under `plugins/<library>`. See [Repository architecture](docs/ARCHITECTURE.md) for the complete authored and generated ownership model.

## Validation

The repository uses Node.js built-ins only. Do not install dependencies.

```bash
npm run validate:config
npm run validate:claude
npm run validate:codex
npm run validate:cursor -- --source all
npm run validate:gemini -- --source all
npm test
npm run format:check
npm run check:boundaries
npm run check:security
npm run check
npm run check:clean
```

`npm run validate:release` requires every source lock to contain a complete canonical skill hash and exact release versions. See [Testing](docs/TESTING.md) for client-matrix behavior, isolation guarantees, CI, and Gemini distribution export.

## Source locking and generation

```bash
npm run lock:sources
npm run sync
npm run sync:check
```

`lock:sources` records deterministic hashes for the canonical trees under `skills/`. `sync` refuses to change the source lock, builds and validates a staged payload, and replaces only the generator-owned roots. Claude, Codex, Cursor, and Gemini reuse the same generated skill and provenance in each `plugins/<library>` root. `sync:check` generates outside the repository, reports added, removed, and changed files, and does not modify committed output.

Normal `npm run check` validates canonical skill trees, committed payload structure, hashes, provenance, MCP pins, security, links, and library isolation without requiring framework checkouts.

## Client contracts

Distribution output follows the official client contracts:

- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code marketplace reference](https://code.claude.com/docs/en/plugin-marketplaces)
- [Codex plugin documentation](https://learn.chatgpt.com/docs/build-plugins)
- [Cursor plugin documentation](https://cursor.com/docs/plugins)
- [Cursor plugin reference](https://cursor.com/docs/reference/plugins)
- [Cursor Marketplace Publisher Terms](https://cursor.com/marketplace-publisher-terms)
- [Gemini CLI extension reference](https://geminicli.com/docs/extensions/reference/)
- [Gemini CLI Agent Skills](https://geminicli.com/docs/cli/skills/)

See [RELEASE.md](RELEASE.md) for release integrity requirements.

## License

This public repository contains PrimeUI assistant plugin and skill source. Using these plugins with PrimeUI libraries is subject to the [PrimeUI License](https://primeui.dev/licenses).
