# Configuration contracts

Both configuration files are authored inputs. Unknown properties are rejected so generation cannot silently depend on undeclared data.

## `plugins.json`

Defines the `primeui` marketplace, its public description, publisher identity, default Codex availability policy, and the exact three logical plugin entries. Each entry records its display metadata, authored install-surface copy, supported hosts (Claude Code, Codex, GitHub Copilot, Cursor, and Gemini CLI), ordered canonical skill set, MCP package/binary/server identity, universal plugin output root, and variant capabilities.

Every skill entry explicitly owns an immutable identity, frontmatter name, generated directory, canonical repository-local source path, zero-based order, and selected-library owner. Sets must be non-empty. Paths, identities, directories, ownership, order, and host-normalized names are validated before filesystem access. A source must remain below `skills/<selected-library>` and cannot be shared by another skill or library.

The install-surface block is host-neutral authored product input. The generator maps it to client metadata instead of inventing short/long descriptions, capability labels, or starter prompts. PrimeReact variants remain a separate framework capability contract.

The `outputs` paths declare where generated distribution payloads belong.

## `sources.lock.json`

Defines the release tuple for each plugin:

- `pluginVersion`: independent exact plugin SemVer
- `mcp.package` and `mcp.version`: exact MCP package target
- `skills[]`: the exact ordered identity, name, directory, owner, and order metadata
- `skills[].source.repository`: this repository's canonical HTTPS URL
- `skills[].source.path`: canonical relative skill path
- `skills[].source.treeHash`: deterministic `sha256:` value or `null`
- `lockState`: `locked` only when every skill tree hash is complete; otherwise `unresolved`

The base validator accepts an honest unresolved development state. The release validator rejects it. Empty strings and guessed hashes are never valid substitutes.

The repository generator defines and tests the deterministic skill-tree hashing algorithm used to fill each `skills[].source.treeHash`.

Generated provenance closes over the payload by listing every generated JSON document and every ordered hashed skill root. Exact generated-payload validation rejects any missing, stale, or extra file beneath generator-owned roots.

`npm run lock:sources` inspects every declared physical tree under `skills/`, computes each `source.treeHash`, sets `lockState` to `locked`, and removes `unresolvedReason`. Repository URLs, identity/order metadata, skill paths, plugin versions, MCP packages, and MCP versions are preserved.

The hash input is a compact JSON array sorted by UTF-8 path bytes. Each record has `path`, byte `size`, and the lowercase hexadecimal SHA-256 of the exact file bytes. The outer digest is stored with the `sha256:` prefix. See [the release rules](../RELEASE.md#deterministic-skill-tree-hash) for the full rejection and normalization contract.
