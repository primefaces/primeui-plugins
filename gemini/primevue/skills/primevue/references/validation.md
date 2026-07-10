# Validation

Use this reference before running, interpreting, or reporting PrimeVue usage validation.

## When To Validate

- Validate final PrimeVue component usage whenever `validate_usage` is available.
- Validate after changes to imports, props, emits, slots, templates, directives, pass-through configuration, setup-sensitive usage, data-component behavior, audits, and migrations.

## How To Validate

1. Pass the exact PrimeVue component name and the narrowest complete `code` snippet that contains the usage.
2. Include imports and the relevant Vue template, script setup, reactive bindings, and component context when they affect interpretation.
3. Read every issue literally. Use current `get_component`, `get_example`, or guide data to correct the usage.
4. Run `validate_usage` again after correction.

Never validate Angular or React syntax with the PrimeVue validator.

## Result Handling

- Treat an accepted result as evidence only for the API metadata the validator checked.
- For `unknown-prop` or comparable issues, confirm the rejected name against current component metadata. Treat any returned allowed list as a hint, not a replacement for docs.
- Report `api-unavailable` or `metadata-incomplete` as incomplete validation and name the missing component or metadata.
- If the tool or server is unavailable, run `primeui ai doctor --json --tool <tool> --library primevue`. Report failed checks and any named fallback source; do not call the usage validated.
- Do not hide a failure or silently remove behavior merely to obtain a passing result.

## Validation Limits

Static MCP validation does not prove runtime rendering, CSS appearance, theme correctness, accessibility behavior, responsive layout, state management, network behavior, or business logic. Use project tests, type checks, builds, and browser or assistive-technology checks when those outcomes matter.
