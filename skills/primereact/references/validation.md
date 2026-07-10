# Validation

Use this reference before running, interpreting, or reporting PrimeReact usage validation.

## When To Validate

- Validate final PrimeReact component usage whenever `validate_usage` is available.
- Validate after changes to imports, props, callbacks, component composition, hook usage, pass-through configuration, setup-sensitive usage, audits, customization, and migrations.
- Validate both a known valid prop and the questioned or intentionally invalid prop when checking validator behavior.

## How To Validate

1. Confirm the selected mode from project evidence before calling the validator.
2. Pass the exact component name, the narrowest complete `code` snippet, and the selected `mode`.
3. Include the import when checking package-versus-local routing. Include surrounding JSX or hook composition when it affects interpretation.
4. Read every issue literally. Use current mode-scoped `get_component`, `get_example`, setup, or guide data to correct the usage.
5. Run `validate_usage` again after correction with the same mode.

Never validate Vue or Angular syntax with the PrimeReact validator. Never validate PrimeReact syntax through another library's server.

Always compare the project import with the selected mode's retrieved component/example source. A clean validator result may omit import-mode or cross-framework diagnostics; absence of an issue is not permission to mix modes or libraries.

## Result Handling

- Treat an accepted result as evidence only for the API metadata and import checks the validator performed.
- For `unknown-prop`, confirm the rejected name against current component metadata. Treat any returned allowed list as a hint, not a replacement for docs.
- For `mode-import-mismatch`, fix the selected mode or import boundary before changing props: styled package imports and Tailwind local imports are not interchangeable.
- For `framework-import-mismatch`, refuse the cross-library usage and route it to the matching library plugin rather than translating syntax.
- If the current server does not emit either import diagnostic, enforce the same boundaries from project inspection and mode-scoped MCP sources and report the validator limitation.
- For primitive or headless usage, confirm imports, composition, hook inputs, and returned parts against mode-scoped API metadata and examples. A passing validator does not prove a headless hook contract, and native attributes on project-owned markup may fall outside component metadata. Do not accept invented hook destructuring or remove valid native attributes merely to obtain a passing result.
- Report `api-unavailable` or `metadata-incomplete` as incomplete validation and name the missing component or metadata.
- If the tool or server is unavailable, run the mode-aware PrimeReact doctor command. Report failed checks and any named fallback source; do not call the usage validated.
- Do not hide a failure or silently remove requested behavior merely to obtain a passing result.

## Validation Limits

Static MCP validation does not prove runtime rendering, CSS appearance, theme correctness, accessibility behavior, responsive layout, state management, network behavior, or business logic. Use project tests, type checks, builds, and browser or assistive-technology checks when those outcomes matter.
