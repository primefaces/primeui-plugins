# Troubleshooting

Use this reference when MCP, setup, imports, plugins, themes, examples, validation, or runtime behavior fails.

## MCP Or Tool Failures

1. Use `version` to confirm the server identity, package/docs version, compact tool surface, resources, and known metadata gaps.
2. Confirm that the active server is PrimeVue and exposes `list`, `search`, `get_component`, `get_guide`, `get_example`, `get_setup`, `validate_usage`, and `version`.
3. Run or request `primeui doctor --json --tool <tool> --library primevue` for missing skill discovery, configuration, startup, tools, resources, or validation.
4. Treat failed doctor checks as setup/tooling blockers. Report check identifiers, details, and suggestions; retry after repair.
5. If official MCP access still fails, use accessible local generated PrimeVue docs or current package metadata only as an explicit fallback. Do not guess or claim MCP validation.

## Missing Components, Guides, Or Examples

- Use `search` before assuming a component or guide name.
- Search behavior terms such as pagination, filtering, sorting, selection, loading, forms, theming, pass-through, or migration when a section name is unknown.
- If `get_example` cannot locate a requested behavior, use `get_component` for its available sections and API, then report any source gap instead of fabricating an example.

## Import, Plugin, Or Theme Failures

- Compare imports and registration with current `get_setup` and `get_component` output.
- Inspect the actual Vue entry point, Nuxt module/plugin configuration, aliases, auto-import rules, theme preset, global CSS, Tailwind, styled/unstyled mode, and pass-through configuration.
- Avoid adding duplicate PrimeVue plugins, providers, modules, themes, or style imports.
- For package-resolution errors, inspect the package manager output and lockfile before suggesting version changes.

## Validation Or Runtime Failures

- Fetch current API metadata for rejected props, events, slots, directives, or pass-through sections; fix and revalidate.
- Treat incomplete metadata as a validation limitation, not proof that code is valid or invalid.
- After static validation, reproduce runtime problems in the smallest relevant app path and use focused type, build, test, or browser checks.
- Keep source/API failures separate from visual CSS issues, accessibility issues, application state bugs, and backend/data problems.
