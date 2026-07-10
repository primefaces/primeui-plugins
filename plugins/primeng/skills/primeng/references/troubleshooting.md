# Troubleshooting

Use this reference when MCP, Angular setup, imports, providers, themes, examples, validation, forms, Table behavior, or runtime behavior fails.

## MCP Or Tool Failures

1. Use `version` to confirm the server identity, package/docs version, compact tool surface, resources, and known metadata gaps.
2. Confirm that the active server is PrimeNG and exposes `list`, `search`, `get_component`, `get_guide`, `get_example`, `get_setup`, `validate_usage`, and `version`.
3. Run or request `primeui ai doctor --json --tool <tool> --library primeng` for missing skill discovery, configuration, startup, tools, resources, or validation.
4. Treat failed doctor checks as setup/tooling blockers. Report check identifiers, details, and suggestions; retry after repair.
5. If the CLI or doctor command is unavailable, say so. Do not invent doctor output or claim recovery succeeded.
6. If official MCP access still fails, use accessible local generated PrimeNG docs or current package metadata only as an explicit fallback. Do not guess, use web-search analogies, or claim MCP validation.

## Local MCP Development Recovery

- Confirm the target is the local PrimeNG MCP package and that its existing dependencies are installed.
- Build the local package before pointing an MCP client at its absolute `packages/mcp/dist/index.js` entrypoint.
- Check package-manager errors, the configured command and arguments, server stderr, and MCP client logs before changing versions or configuration.
- Retry `version`, a narrow resource or component read, and `validate_usage` after startup recovery.

## Missing Components, Guides, Or Examples

- Use `search` before assuming a component, guide, section, or variant name.
- Search behavior terms such as pagination, filtering, sorting, selection, loading, forms, theming, pass-through, or migration when a section name is unknown.
- If `get_example` cannot locate a requested behavior, use `get_component` for available sections and API metadata, then report the source gap instead of fabricating an example.

## Angular Import, Provider, Or Forms Failures

- Compare selectors, imports, decorator or NgModule metadata, inputs, outputs, and form bindings with current `get_setup` and `get_component` output.
- Inspect whether the target is standalone or NgModule-based before moving imports. Check the actual owning component or module rather than adding duplicates at the root.
- For unknown-element, unknown-input, or unknown-output compiler errors, verify the documented selector or directive placement and the exact import boundary before changing component code.
- For dependency-injection or theme initialization failures, inspect the root `providePrimeNG` boundary and existing application providers.
- For form errors, inspect `FormsModule` or `ReactiveFormsModule`, the bound value/control type, disabled/invalid state, and the component's documented form support.

## Theme, Table, Validation, Or Runtime Failures

- Inspect the selected preset, `providePrimeNG` theme options, global CSS, root font size, dark-mode selector, CSS layers, Tailwind integration, styled/unstyled mode, pass-through configuration, and scoped tokens before overriding styles.
- For Table bugs, isolate pagination, filtering, sorting, selection, row identity, and lazy/server state; compare each behavior with its source-backed example before recombining them.
- Fetch current API metadata for rejected inputs, outputs, templates, directives, selectors, imports, or pass-through sections; fix and revalidate.
- Treat incomplete metadata as a validation limitation, not proof that code is valid or invalid.
- After static validation, reproduce runtime problems in the smallest relevant Angular path and use focused type, build, test, or browser checks.
