# Configuration contracts

Both configuration files are authored inputs. Unknown properties are rejected so generation cannot silently depend on undeclared data.

## `plugins.json`

Defines the `primeui` marketplace, publisher identity, default Codex availability policy, and the exact three logical plugin entries. Each entry records its display metadata, authored install-surface copy, supported hosts, canonical skill source path, MCP package/binary/server identity, future output roots, and variant capabilities.

The install-surface block is host-neutral authored product input. The generator maps it to client metadata instead of inventing short/long descriptions, capability labels, or starter prompts. PrimeReact variants remain a separate framework capability contract.

The `outputs` paths declare where generated distribution payloads belong.

## `sources.lock.json`

Defines the release tuple for each plugin:

- `pluginVersion`: independent exact plugin SemVer
- `mcp.package` and `mcp.version`: exact MCP package target
- `source.repository`: canonical HTTPS Git repository
- `source.commit`: accepted full source SHA or `null`
- `source.skillPath`: canonical relative skill path
- `source.skillHash`: deterministic `sha256:` value or `null`
- `lockState`: `locked` only when commit and hash are complete; otherwise `unresolved`

The base validator accepts an honest unresolved development state. The release validator rejects it. Empty strings, placeholder SHAs, guessed hashes, tags, and moving refs are never valid substitutes.

The repository generator defines and tests the deterministic skill-tree hashing algorithm used to fill `source.skillHash`.
