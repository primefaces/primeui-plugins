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

The accepted commit is an authored release decision. `lock:sources` requires every configured lock to contain that full commit, verifies the supplied checkout is exactly at it, and computes only the deterministic tree hash and lock-state transition. Updating to another source commit therefore requires an explicit lock review; ordinary generation never advances a lock.

## Deterministic skill-tree hash

The generator uses one algorithm for source locking, source verification, copied-tree verification, and provenance validation:

1. Recursively inspect physical directories and regular files. Reject symlinks, special files, unsafe relative paths, non-POSIX-normalized or non-NFC paths, duplicate normalized paths, and case-colliding files or parent directories. Case collision uses locale-independent ECMAScript lowercase after NFC validation.
2. Require the physical file inventory to equal the regular files tracked by Git at the accepted commit. Ignored or otherwise untracked physical files are rejected.
3. Normalize file paths as relative POSIX paths and sort them by their UTF-8 bytes.
4. For every file, record an object with keys in this order: `path`, byte `size`, and the lowercase hexadecimal SHA-256 of its exact bytes in `sha256`.
5. Serialize the array with compact `JSON.stringify` output: no indentation, surrounding whitespace, or trailing newline.
6. SHA-256 hash the UTF-8 serialization and store the lowercase digest as `sha256:<64 hex>`.

Timestamps, absolute paths, Git status, permissions, and filesystem directory order are not hash inputs.

## Generated payloads

The repository generator must produce rather than hand-author:

- Claude and Codex marketplace catalogs
- library-local Claude and Codex manifests
- exact-version MCP launch configurations
- copied physical skill trees
- provenance records
- Gemini extension payloads

Identical configuration and source inputs must produce byte-identical JSON and files. Generation must reject symlinks, stale output, path escape, unpinned MCP versions, secrets, and incomplete locks. Source repositories are checked out separately from deterministic generation.

The generator owns only `.claude-plugin/`, `.agents/plugins/`, `plugins/`, and `gemini/`. It validates a complete same-filesystem staging tree before swapping those roots with rollback protection. Freshness checking uses temporary output outside the repository and never replaces committed files.

## Release sequence

1. Verify that every exact MCP package version is published and starts cleanly.
2. Accept and record every framework skill commit.
3. Complete `config/sources.lock.json` with deterministic skill hashes.
4. Require `npm run validate:release` to pass.
5. Generate twice and require a clean diff.
6. Run schema, security, path-safety, provenance, host-manifest, and isolation checks.
7. Run clean Claude, Codex, and Gemini installation smokes.
8. Tag only after review approval. Do not publish this package to npm.
