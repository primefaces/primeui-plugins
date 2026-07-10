---
name: primeng
description: Build, customize, validate, audit, migrate, or troubleshoot PrimeNG interfaces using the official PrimeNG MCP as the live source of docs, Angular API metadata, examples, setup guidance, and validation. Use for PrimeNG and Angular-specific PrimeUI work in standalone components or NgModule applications, including components, pages, providePrimeNG, themes, templates, directives, inputs, outputs, forms, Table workflows, pass-through APIs, setup, migration, and customer-facing examples. Do not use for PrimeVue or PrimeReact; use that library's matching plugin instead.
---

# PrimeNG

Use this skill as the PrimeNG workflow layer. Keep live component documentation, API tables, examples, setup content, and generated artifacts in `@primeng/mcp`; keep Angular project inspection, source selection, implementation sequence, validation, and guardrails here.

## Core Workflow

1. Confirm that the task targets PrimeNG. If it targets PrimeVue or PrimeReact, stop and state that the matching library plugin should handle it. Do not produce another library's code.
2. Inspect the Angular project before writing code. Prefer `primeui info --json` when available. Otherwise inspect the nearest package metadata and lockfile, Angular workspace and TypeScript configuration, bootstrap and application configuration, standalone or NgModule structure, PrimeNG imports, `providePrimeNG` and theme setup, forms strategy, global styles, and nearby component conventions.
3. Query the PrimeNG MCP before relying on library-specific details. Use `version` for server capabilities, `list` and `search` for discovery, `get_setup` for installation and provider/theme setup, `get_component` for current inputs, outputs, templates, directives, imports, and API metadata, `get_guide` for concepts and migrations, and `get_example` for source-backed behavior.
4. Write Angular and PrimeNG code that preserves the project's standalone or NgModule pattern, template syntax, forms approach, theme configuration, and style conventions. Ask one short clarification only when local context and official sources cannot resolve a material choice.
5. Validate final component usage with `validate_usage` whenever available. Correct failures and validate again. Follow [validation.md](references/validation.md) when interpreting incomplete metadata or validation limits.
6. If MCP startup, tools, resources, configuration, or validation fail, run or request `primeui ai doctor --json --tool <tool> --library primeng`. Report failures honestly and do not replace missing official data with guesses or web-search analogies.
7. Do not invent inputs, outputs, templates, directives, selectors, imports, form bindings, pass-through keys, token names, setup steps, package availability, pricing, access, or licensing.

## Reference Map

- Read [workflow.md](references/workflow.md) for component, page, audit/fix, forms, templates, directives, inputs/outputs, Table, and customer-example work.
- Read [setup.md](references/setup.md) for standalone and NgModule setup, `providePrimeNG`, themes, forms imports, installation, and MCP setup failures.
- Read [customization.md](references/customization.md) for component options, templates, inputs/outputs, Table behavior, styles, presets, tokens, pass-through, and accessibility work.
- Read [migration.md](references/migration.md) before version migrations or deprecated-API cleanup.
- Read [validation.md](references/validation.md) before validating or reporting validation results.
- Read [troubleshooting.md](references/troubleshooting.md) for MCP, Angular setup, import, provider, theme, example, validation, or runtime failures.
- Read [brand-and-product-boundaries.md](references/brand-and-product-boundaries.md) for naming, licensing, access, availability, pricing, or customer-facing product claims.

## Final Response

- Name the PrimeNG MCP operations and local Angular project evidence used.
- State whether `validate_usage` passed, failed, or could not complete and why.
- Separate static validation from Angular compilation, runtime, visual, accessibility, responsive, forms, and business-behavior checks.
