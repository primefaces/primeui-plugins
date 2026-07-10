---
name: primevue
description: Build, customize, validate, audit, migrate, or troubleshoot PrimeVue interfaces using the official PrimeVue MCP as the live source of docs, API metadata, examples, setup guidance, and validation. Use for PrimeVue and Vue-specific PrimeUI work in Vue SFCs, Vue applications, Nuxt, or Vite, including components, pages, plugins, themes, presets, design tokens, pass-through APIs, forms, directives, setup, migration, and customer-facing examples. Do not use for PrimeNG or PrimeReact; use that library's matching plugin instead.
---

# PrimeVue

Use this skill as the PrimeVue workflow layer. Keep live component documentation, API tables, examples, setup content, and generated artifacts in `@primevue/mcp`; keep project inspection, source selection, implementation sequence, validation, and guardrails here.

## Core Workflow

1. Confirm that the task targets PrimeVue. If it targets PrimeNG or PrimeReact, stop and state that the matching library plugin should handle it. Do not produce Angular or React code.
2. Inspect the project before writing code. Prefer `primeui info --json` when available. Otherwise inspect the nearest package metadata and lockfile, Vue/Nuxt/Vite/TypeScript configuration, PrimeVue imports and plugin setup, theme or preset configuration, Tailwind and aliases, and nearby Vue conventions.
3. Query the PrimeVue MCP before relying on library-specific details. Use `version` for server capabilities, `list` and `search` for discovery, `get_setup` for installation and plugin/theme setup, `get_component` for current API metadata, `get_guide` for concepts and migrations, and `get_example` for source-backed behavior.
4. Write Vue and PrimeVue code that preserves the project's existing setup and style. Ask one short clarification only when local context and official sources cannot resolve a material choice.
5. Validate final component usage with `validate_usage` whenever available. Correct failures and validate again. Follow [validation.md](references/validation.md) when interpreting incomplete metadata or validation limits.
6. If MCP startup, tools, resources, configuration, or validation fail, use `primeui ai doctor --json --tool <tool> --library primevue`. Report failures honestly and do not replace missing official data with guesses.
7. Do not invent props, events, slots, imports, directives, pass-through keys, token names, setup steps, package availability, pricing, access, or licensing.

## Reference Map

- Read [workflow.md](references/workflow.md) for component, page, multi-component, audit/fix, forms, directives, and customer-example work.
- Read [setup.md](references/setup.md) for Vue, Vite, Nuxt, PrimeVue plugin, theme, provider, and installation work.
- Read [customization.md](references/customization.md) for props, slots, events, styles, presets, tokens, pass-through, and accessibility work.
- Read [migration.md](references/migration.md) before version migrations or deprecated-API cleanup.
- Read [validation.md](references/validation.md) before validating or reporting validation results.
- Read [troubleshooting.md](references/troubleshooting.md) for MCP, setup, import, plugin, theme, example, validation, or runtime failures.
- Read [brand-and-product-boundaries.md](references/brand-and-product-boundaries.md) for naming, licensing, access, availability, pricing, or customer-facing product claims.

## Final Response

- Name the official PrimeVue MCP operations and local project evidence used.
- State whether `validate_usage` passed, failed, or could not complete and why.
- Separate static validation from runtime, visual, accessibility, responsive, and business-behavior checks.
