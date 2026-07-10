# Migration

Use this reference before changing PrimeNG across versions or replacing deprecated Angular setup, theme, template, directive, form, and component APIs.

## Migration Workflow

1. Identify source and target PrimeNG and Angular versions from package metadata and the lockfile. Record the standalone or NgModule structure, forms approach, `providePrimeNG` configuration, theme packages, preset, global styles, and build environment.
2. Use `search` or `get_guide` to fetch the migration guide that covers the exact version boundary.
3. Use `get_component` for every affected component's current selector, import, inputs, outputs, templates, directives, pass-through metadata, forms support, and related API.
4. Use `get_setup` or the relevant configuration/theming guide when the migration changes packages, application providers, themes, presets, design tokens, styled/unstyled behavior, Tailwind, CSS layers, root font assumptions, or Angular bootstrap patterns.
5. Compare current code with explicit guide and API evidence. Do not infer removals, renames, deprecations, replacements, or Angular compatibility from memory.
6. Patch only source-backed migration changes and preserve unrelated application conventions. Do not convert between standalone and NgModule architecture unless the migration source or user explicitly requires it.
7. Run `validate_usage` on migrated component snippets, correct failures, and run the project's focused Angular type/build/test/runtime checks.

## Common Inspection Boundaries

- Check removed or renamed selectors, imports, inputs, outputs, templates, directives, style classes, theme packages, and provider APIs against the exact target guide.
- Inspect Table behavior, form bindings, custom templates, pass-through keys, and CSS overrides carefully because they often span component metadata and application state.
- Keep mechanical package/setup changes separate from optional component cleanup so each conclusion remains traceable to a source.

## Reporting

- Separate confirmed migration requirements from optional cleanup.
- Name the migration guide, current component metadata, setup or theming source, and validation result used.
- If a guide or API entry is unavailable, report the gap and limit changes to what current official sources confirm.
- Do not translate the migration into another Prime library's code. Cross-library conversion requires the matching plugin and an explicit user request.
