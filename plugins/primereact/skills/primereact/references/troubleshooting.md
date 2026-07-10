# Troubleshooting

Use this reference when MCP, setup, imports, mode selection, providers, themes, examples, validation, or runtime behavior fails.

## MCP Or Tool Failures

1. Use `version` to confirm the server identity, package/docs version, compact tool surface, resources, modes, and known metadata gaps.
2. Confirm that the active server is PrimeReact and that the project-selected mode is `styled`, `tailwind`, `primitive`, or `headless`.
3. Run or request `primeui ai doctor --json --tool <tool> --library primereact --variant <mode>` for missing skill discovery, configuration, startup, tools, resources, or validation.
4. Treat failed doctor checks as setup/tooling blockers. Report check identifiers, details, and suggestions; retry after repair.
5. If official MCP access still fails, use accessible generated PrimeReact docs or current package metadata only for the selected mode and only as an explicit fallback. Do not guess or claim MCP validation.

## Missing Components, Guides, Or Examples

- Use mode-scoped `search` before assuming a component or guide name.
- If `get_example` cannot locate a behavior, use `get_component` to discover available sections and examples before retrying. Do not assume a section or variant name; report the source gap instead of fabricating an example.
- If no migration guide exists for the requested boundary, limit work to source-backed setup and component API changes.
- Treat current mode-scoped MCP output and generated metadata as authoritative over stale or conflicting README snippets.

## Import, Mode, Provider, Or Theme Failures

- Reinspect the edited file, alias resolution, local UI target, `components.json`, provider placement, theme preset, global CSS, and Tailwind configuration.
- A styled/local import mismatch or Tailwind/package import mismatch usually indicates wrong mode routing. Reselect the mode, refetch sources, and revalidate before changing props.
- For primitive or headless work, fetch the exact current import and API. Do not manufacture an `@primereact/primitive` path or reconstruct headless hook returns from another version.
- Avoid adding duplicate providers, theme presets, SSR style registries, or global styles.

## Cross-Library Input

- Refuse PrimeVue or PrimeNG imports, bindings, templates, selectors, or validation results in this skill.
- Direct the user to the matching library plugin and MCP server. Do not convert the code by analogy.

## Validation Or Runtime Failures

- Fetch current mode-scoped API metadata for rejected props, imports, hook usage, composition, or pass-through sections; fix and revalidate.
- For headless code, compare validator results with the retrieved hook API and example. Report false positives around project-owned native markup and false negatives around hook inputs or returned parts instead of changing source-backed code to satisfy the validator.
- Treat incomplete metadata as a validation limitation, not proof that code is valid or invalid.
- After static validation, reproduce runtime problems in the smallest relevant app path and use focused type, build, test, or browser checks.
- Keep source/API failures separate from visual CSS issues, accessibility issues, application state bugs, and backend/data problems.
