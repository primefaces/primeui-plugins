---
name: primevue-migration
description: Migrate PrimeVue code using only current routed PrimeVue migration guidance and current component/setup metadata. Use for supported version boundaries and source-backed deprecated-API cleanup.
---

# PrimeVue Migration

Read the installed PrimeVue version and target from package metadata and the lockfile. Record Vue/Nuxt/Vite context, plugin/theme configuration, and affected components. Do not call `version` merely to replace this project evidence.

Call `get_guide` only for a current routed migration guide that covers the requested boundary. If no such guide is returned, state that the migration path is unsupported and do not synthesize renames or replacements. Call `get_component` for each materially affected component's current contract; use `get_setup` only when returned migration guidance requires a supported setup change.

Separate confirmed required changes from optional cleanup. Preserve unrelated code and local conventions. Never infer deprecations, removals, imports, tokens, pass-through keys, or compatibility from history or another PrimeUI library. Call `validate_usage` once on final migrated component code, repeating only after a reported issue, then run focused project checks.

## Scenario Contracts

- `migration`: `get_guide -> get_component -> validate_usage`; maximum 3.

Report source and target evidence, migration/component citations, validation results, and unsupported gaps.
