# Migration

Use this reference before changing PrimeReact versions, deprecated APIs, setup patterns, or modes.

## Migration Workflow

1. Identify source and target PrimeReact versions from package metadata and the lockfile. Record the React/Next.js/Vite environment, current mode, imports, aliases, local UI directories, provider placement, theme or preset, and global CSS strategy.
2. Select the target mode before retrieval. Use mode-scoped `search` and `get_guide` to look for a migration guide covering the version or setup boundary.
3. Use mode-scoped `get_component` for every affected component's current import, props, callbacks, composition or hook contract, pass-through metadata, and related API.
4. Use mode-scoped `get_setup` and the relevant setup or theming guide when the migration changes packages, aliases, copied components, providers, SSR handling, presets, tokens, Tailwind, or CSS.
5. Compare current code with explicit guide and API evidence. Do not infer removals, renames, deprecations, or replacements from memory or package README snippets.
6. Patch only source-backed migration changes and preserve unrelated application conventions.
7. Run `validate_usage` with the target mode on migrated component snippets, correct failures, and run focused project checks.

## Mode Changes

- Do not silently convert between `styled`, `tailwind`, `primitive`, and `headless`.
- When the user explicitly requests a mode migration, document source and target modes, fetch both modes independently, and preserve source imports until each usage is intentionally replaced.
- Treat package-to-local and local-to-package import changes as deliberate migration work, not cleanup.
- Do not validate source-mode code under the target mode and call the mismatch a prop problem.

## Missing Migration Guidance

- If no matching migration guide is returned, state the source gap and limit changes to current setup and API metadata that can be confirmed.
- Do not invent a migration sequence from another mode, another Prime library, repository history, or memory.

## Reporting

- Separate confirmed migration requirements from optional cleanup.
- Name the selected mode, migration/setup guides, component metadata, and validation result used.
- Report any missing guide or incomplete metadata explicitly.
