---
name: primereact-migration
description: Migrate PrimeReact code using current mode-scoped migration, setup, and component metadata. Use for supported version boundaries, source-backed deprecated API cleanup, or an explicitly requested mode migration.
---

# PrimeReact Migration

Read installed and target versions from package metadata and the lockfile. Record host environment, current imports, aliases, local UI roots, provider/theme setup, CSS strategy, and source mode. Select the target mode before target MCP calls. A mode migration must be explicit; retrieve source and target evidence independently and never validate source-mode code as target-mode code.

Use same-mode `get_guide` for a matching routed migration guide and `get_component` or `get_setup` only for affected current contracts. If no matching guide exists, state the gap and limit changes to current setup/API evidence. Never infer removals, renames, deprecations, replacements, packages, imports, tokens, hooks, or compatibility from another mode, Prime library, history, or memory.

Call same-mode `validate_usage` once on final migrated component code, repeating only after a reported issue and repair. Do not call `version` routinely.

## Scenario Contracts

- `migration`: `get_guide -> get_component -> validate_usage`; maximum 3.

Separate confirmed required changes from optional cleanup and report selected-mode citations plus unverified project checks.
