---
name: primeng-router
description: Route PrimeNG and Angular-specific PrimeUI work to exactly one focused PrimeNG skill. Use first for PrimeNG requests involving components, setup, theming, accessibility, icons, migration, audits, or troubleshooting. Never use for PrimeVue or PrimeReact.
---

# PrimeNG Router

Confirm that the project or request uses Angular and PrimeNG. If it uses Vue/PrimeVue or React/PrimeReact, stop and use that library's plugin; never translate APIs by analogy.

Select exactly one smallest focused skill:

- `component`: `primeng-component-implementation` for component discovery or implementation, templates, directives, forms, inputs, outputs, or Table workflows.
- `setup`: `primeng-setup-installation` for installation, standalone `ApplicationConfig` or `app.config.ts`, `providePrimeNG`, or initial theme setup.
- `theming`: `primeng-theming-customization` for presets, tokens, pass-through, styles, styled/unstyled mode, Tailwind, or component customization.
- `accessibility`: `primeng-accessibility-icons` for accessibility, keyboard/focus behavior, accessible names, PrimeIcons, or custom icons.
- `migration`: `primeng-migration` for a current routed PrimeNG migration boundary or source-backed deprecated-API work.
- `audit`: `primeng-audit-troubleshooting` for code audits, invalid API repair, MCP/plugin failure, duplicate MCP configuration, or runtime diagnosis.

Do not run a focused workflow here or load several focused skills preemptively. When a request spans categories, choose the skill that owns the requested outcome; hand off only if a separate outcome remains.

## Shared Source Boundary

Current PrimeNG MCP results, generated metadata, current canonical routed PrimeNG docs, and current canonical Angular documentation are the supported behavior. Component documentation, Angular API tables/resources, examples, setup candidates, and citations remain MCP-owned. Never invent or copy into skills any selector, import, input, output, template, directive, form contract, event payload, token, pass-through key, setup route, environment alias, example, public URL, migration fact, icon behavior, availability, pricing, licensing, or product claim. Omit unsupported material or state that current official sources do not support it; absence is not a blocker.

PrimeNG setup supports only the routed standalone `ApplicationConfig`/`app.config.ts`/`providePrimeNG` path and source-backed aliases returned by `get_setup`. NgModule and every other undocumented setup workflow are explicitly unsupported. Never synthesize legacy guidance or a public URL.
