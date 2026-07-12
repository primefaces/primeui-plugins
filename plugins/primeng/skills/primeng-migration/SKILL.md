---
name: primeng-migration
description: Migrate PrimeNG code using only current routed PrimeNG migration guidance and current component/setup metadata. Use for supported version boundaries and source-backed deprecated-API cleanup.
---

# PrimeNG Migration

Read installed PrimeNG and Angular versions and the target from package metadata and the lockfile. Record the standalone application configuration, `providePrimeNG`, theme configuration, forms approach, and affected components. Do not call `version` merely to replace this project evidence.

Call `get_guide` only for a current routed PrimeNG migration guide that covers the requested boundary. If no such guide is returned, state that the migration path is unsupported and do not synthesize renames or replacements. Call `get_component` for each materially affected component's current selector, import, inputs, outputs, templates, directives, forms, and API contract; use `get_setup` only when returned migration guidance requires a supported standalone setup change.

Separate confirmed required changes from optional cleanup. Preserve unrelated code and local conventions. Never infer deprecations, removals, imports, theme tokens, pass-through keys, Angular compatibility, NgModule setup, or another PrimeUI library's behavior. Call `validate_usage` once on final migrated component code, repeating only after a reported issue, then run focused Angular checks.

## Scenario Contracts

- `migration`: `get_guide -> get_component -> validate_usage`; maximum 3.

Report source and target evidence, migration/component resource and public citations, validation results, and unsupported gaps.
