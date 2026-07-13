---
name: primereact-setup-installation
description: Install and configure PrimeReact using only current mode- and environment-scoped setup metadata and routed guides. Use for supported React, Vite, Next.js, providers, aliases, local UI roots, packages, and CSS setup.
---

# PrimeReact Setup And Installation

Inspect package metadata, lockfile, React host, SSR/client boundaries, aliases, `components.json`, provider/theme setup, Tailwind/global CSS, local UI roots, and existing imports. Select exactly one mode before retrieval; if mode or environment remains ambiguous, ask or return structured ambiguity without calling MCP.

Call `get_setup` with the selected `mode` and documented environment or source-backed alias. Use at most one same-mode `get_guide`, only when `get_setup` returns or current metadata proves a relevant routed installation/configuration guide. Preserve returned package-versus-local imports, provider placement, aliases, CSS entrypoints, and project conventions. Unsupported mode/environment combinations receive the structured unsupported result with no invented alias, URL, package, provider, or fallback setup.

Do not call `version` routinely. Validate only when final component code exists: call `validate_usage` once in the selected mode after setup, repeating only after a reported issue and repair. Otherwise use appropriate local type/build/runtime checks.

## Scenario Contracts

- `setup`: `get_setup -> get_guide -> validate_usage`; maximum 3.
- `setup-without-code`: `get_setup -> get_guide`; maximum 2.
- `unsupported-setup`: `get_setup`; maximum 1.
- `ambiguous-setup-mode`: `none`; maximum 0.

Report the selected mode/environment, returned setup candidate and citations, validation if any, and unverified runtime boundaries.
