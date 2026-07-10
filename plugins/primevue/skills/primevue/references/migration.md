# Migration

Use this reference before changing PrimeVue across versions or replacing deprecated setup and component APIs.

## Migration Workflow

1. Identify the source and target PrimeVue versions from package metadata and the lockfile. Record the Vue/Nuxt/Vite environment and current plugin/theme setup.
2. Use `search` or `get_guide` to fetch the migration guide that covers the version boundary.
3. Use `get_component` for every affected component's current import, props, emits, slots, pass-through metadata, and related API.
4. Use `get_setup` or the relevant setup/theming guide when the migration changes packages, plugin registration, Nuxt modules, presets, design tokens, styled/unstyled behavior, or CSS.
5. Compare current code with explicit guide and API evidence. Do not infer removals, renames, deprecations, or replacements from memory.
6. Patch only source-backed migration changes and preserve unrelated application conventions.
7. Run `validate_usage` on migrated component snippets, correct failures, and run the project's focused type/build/runtime checks.

## Reporting

- Separate confirmed migration requirements from optional cleanup.
- Name the migration guide, current component metadata, setup source, and validation result used.
- If a guide or API entry is unavailable, report the gap and limit changes to what current official sources confirm.
- Do not translate the migration into PrimeNG or PrimeReact code. Cross-library conversion requires the other library's plugin and an explicit user request.
