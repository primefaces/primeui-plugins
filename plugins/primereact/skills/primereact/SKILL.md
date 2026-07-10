---
name: primereact
description: Build, customize, validate, audit, migrate, or troubleshoot PrimeReact interfaces using the official PrimeReact MCP as the live source of docs, API metadata, examples, setup guidance, and validation. Use for React-specific PrimeUI work in React, Next.js, or Vite applications, including styled, tailwind, primitive, and headless modes, components, providers, themes, local UI aliases, setup, migration, and customer-facing examples. Do not use for PrimeVue or PrimeNG; use that library's matching plugin instead.
---

# PrimeReact

Use this skill as the PrimeReact workflow layer. Keep live component docs, API tables, examples, setup content, inventories, and generated artifacts in `@primereact/mcp`; keep project inspection, mode selection, source routing, implementation sequence, validation, and guardrails here.

## Core Workflow

1. Confirm that the task targets PrimeReact. If it targets PrimeVue or PrimeNG, stop and state that the matching library plugin should handle it. Do not emit Vue or Angular syntax.
2. Inspect the project before writing code. Prefer `primeui info --json` when available. Otherwise inspect the nearest package metadata and lockfile, React/Next.js/Vite/TypeScript configuration, path aliases, `components.json`, providers, theme or preset setup, global CSS, Tailwind configuration, local UI directories, existing PrimeReact imports, and nearby component conventions.
3. Select exactly one mode—`styled`, `tailwind`, `primitive`, or `headless`—from the edited file and project evidence before retrieving MCP docs or examples. Read [variants.md](references/variants.md) for every task.
4. Query only the PrimeReact MCP with the selected value passed as `mode`. Use `version` for server capabilities, `list` and `search` for discovery, `get_setup` for installation and provider/theme setup, `get_component` for current API metadata, `get_guide` for concepts or migrations, and `get_example` for source-backed behavior.
5. Preserve the selected mode and project conventions. Keep package component imports as package imports and local copied components on their resolved local alias or relative path.
6. Validate final component usage with `validate_usage` and the same `mode`. Include imports when mode routing matters, correct failures, and validate again.
7. If MCP startup, tools, resources, configuration, or validation fail, use `primeui ai doctor --json --tool <tool> --library primereact --variant <mode>`. Report failures honestly and do not replace missing official data with guesses.
8. Do not invent props, events, imports, hook returns, compound parts, pass-through keys, tokens, setup steps, package availability, pricing, access, or licensing.

## Reference Map

- Read [workflow.md](references/workflow.md) for component, page, audit/fix, and source-backed example work.
- Read [variants.md](references/variants.md) before any retrieval, implementation, or validation.
- Read [setup.md](references/setup.md) for React, Next.js, Vite, aliases, providers, themes, local UI directories, and installation work.
- Read [customization.md](references/customization.md) for component options, styling, themes, tokens, pass-through APIs, and accessibility.
- Read [migration.md](references/migration.md) before version or mode migrations.
- Read [validation.md](references/validation.md) before validating or reporting validation results.
- Read [troubleshooting.md](references/troubleshooting.md) for MCP, setup, import, mode, theme, validation, or runtime failures.
- Read [brand-and-product-boundaries.md](references/brand-and-product-boundaries.md) for naming, licensing, access, availability, pricing, or customer-facing product claims.

## Final Response

- Name the selected mode, official PrimeReact MCP operations, and local project evidence used.
- State whether `validate_usage` passed, failed, or could not complete and why.
- Separate static validation from runtime, visual, accessibility, responsive, and business-behavior checks.
