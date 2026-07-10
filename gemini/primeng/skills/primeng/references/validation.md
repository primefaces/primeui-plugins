# Validation

Use this reference before running, interpreting, or reporting PrimeNG usage validation.

## When To Validate

- Validate final PrimeNG component usage whenever `validate_usage` is available.
- Validate after changes to selectors, imports, inputs, outputs, templates, directives, form bindings, pass-through configuration, setup-sensitive usage, Table behavior, audits, and migrations.

## How To Validate

1. Pass the exact PrimeNG component name and the narrowest complete `code` snippet that contains the usage.
2. Include relevant `primeng/*` imports, component or NgModule metadata, the Angular template, bound state, handlers, template contexts, and forms imports when they affect interpretation.
3. For a composed Table, include all target pagination, filtering, sorting, and selection markup that must work together rather than validating detached attributes.
4. Read every issue literally. Use current `get_component`, `get_example`, or guide data to correct the usage.
5. Run `validate_usage` again after correction.

Never validate another library's syntax with the PrimeNG validator. A foreign import or selector rejection is a scope error, not a signal to rewrite it by analogy.

## Result Handling

- Treat an accepted result as evidence only for the generated API metadata, selector, and import checks the validator performed.
- For `unknown-prop`, compare the rejected Angular input against current component metadata. Treat any returned allowed list as a hint, not a replacement for docs.
- For `framework-import-mismatch` or `selector-mismatch`, fix the library scope, import, component selector, or attribute-directive placement before changing inputs.
- Report `api-unavailable` or incomplete metadata as incomplete validation and name the missing component or metadata.
- If the tool or server is unavailable, run or request `primeui ai doctor --json --tool <tool> --library primeng`. Report failed checks and any named fallback source; do not call the usage validated.
- Do not hide a failure or silently remove behavior merely to obtain a passing result.

## Scenario Evidence

- Validate the final danger/loading Button usage returned from source-backed examples.
- Validate the final Table usage after composing the required pagination, filtering, sorting, and selection features.
- Validate standalone and NgModule snippets with their actual imports and provider boundary when setup is in scope.
- Exercise at least one intentionally invalid input and confirm that validation rejects it with an actionable issue.
- Treat cross-library imports or selectors as a refusal case; do not generate substitute PrimeNG code unless the user explicitly changes scope.

## Validation Limits

Static MCP validation does not prove Angular compilation, dependency injection, runtime rendering, forms behavior, CSS appearance, theme correctness, accessibility behavior, responsive layout, state management, network behavior, or business logic. Use project builds, tests, and browser or assistive-technology checks when those outcomes matter.
