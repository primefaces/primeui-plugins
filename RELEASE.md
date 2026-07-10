# Release rules

## Source-lock gate

Every library must have one complete lock containing:

- an HTTPS canonical source repository URL without credentials, query, or fragment
- the canonical relative skill source path
- the accepted full lowercase 40-character source commit SHA
- the deterministic `sha256:<64 lowercase hex>` skill hash produced by the repository generator
- an independent exact plugin SemVer
- the exact published MCP package and SemVer

Known values may be retained while a lock is `unresolved`, but at least one release-critical source field must remain `null` and `unresolvedReason` must explain why. A complete lock still marked unresolved is invalid. Release validation rejects every unresolved lock and names its missing fields.

## Generated payloads

The repository generator must produce rather than hand-author:

- Claude and Codex marketplace catalogs
- library-local Claude and Codex manifests
- exact-version MCP launch configurations
- copied physical skill trees
- provenance records
- Gemini extension payloads

Identical configuration and source inputs must produce byte-identical JSON and files. Generation must reject symlinks, stale output, path escape, unpinned MCP versions, secrets, and incomplete locks. Source repositories are checked out separately from deterministic generation.

## Release sequence

1. Verify that every exact MCP package version is published and starts cleanly.
2. Accept and record every framework skill commit.
3. Complete `config/sources.lock.json` with deterministic skill hashes.
4. Require `npm run validate:release` to pass.
5. Generate twice and require a clean diff.
6. Run schema, security, path-safety, provenance, host-manifest, and isolation checks.
7. Run clean Claude, Codex, and Gemini installation smokes.
8. Tag only after review approval. Do not publish this package to npm.
