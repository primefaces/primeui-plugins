# Configuration contracts

Both configuration files are authored inputs. Unknown properties are rejected so generation cannot silently depend on undeclared data.

## `plugins.json`

Defines the `primeui` marketplace, publisher identity, default Codex availability policy, and the exact three logical plugin entries. Each entry records its display metadata, authored install-surface copy, supported hosts, canonical repository-local skill source path, MCP package/binary/server identity, future output roots, and variant capabilities.

The install-surface block is host-neutral authored product input. The generator maps it to client metadata instead of inventing short/long descriptions, capability labels, or starter prompts. PrimeReact variants remain a separate framework capability contract.

The `outputs` paths declare where generated distribution payloads belong.

## `sources.lock.json`

Defines the release tuple for each plugin:

- `pluginVersion`: independent exact plugin SemVer
- `mcp.package` and `mcp.version`: exact MCP package target
- `source.repository`: this repository's canonical HTTPS URL
- `source.skillPath`: canonical relative skill path
- `source.skillHash`: deterministic `sha256:` value or `null`
- `lockState`: `locked` only when the skill hash is complete; otherwise `unresolved`

The base validator accepts an honest unresolved development state. The release validator rejects it. Empty strings and guessed hashes are never valid substitutes.

The repository generator defines and tests the deterministic skill-tree hashing algorithm used to fill `source.skillHash`.

`npm run lock:sources` inspects each physical tree under `skills/`, computes `source.skillHash`, sets `lockState` to `locked`, and removes `unresolvedReason`. Repository URLs, skill paths, plugin versions, MCP packages, and MCP versions are preserved.

The hash input is a compact JSON array sorted by UTF-8 path bytes. Each record has `path`, byte `size`, and the lowercase hexadecimal SHA-256 of the exact file bytes. The outer digest is stored with the `sha256:` prefix. See [the release rules](../RELEASE.md#deterministic-skill-tree-hash) for the full rejection and normalization contract.
