---
name: primevue-router
description: Route PrimeVue and Vue-specific PrimeUI work to exactly one focused PrimeVue skill. Use first for PrimeVue requests involving components, setup, theming, accessibility, icons, migration, audits, or troubleshooting. Never use for PrimeNG or PrimeReact.
---

# PrimeVue Router

Confirm that the project or request uses Vue and PrimeVue. If it uses Angular/PrimeNG or React/PrimeReact, stop and use that library's plugin; never translate APIs by analogy.

Select exactly one smallest focused skill:

- `component`: `primevue-component-implementation` for component discovery, implementation, forms, or directives.
- `setup`: `primevue-setup-installation` for installation, Vue/Vite/Nuxt integration, plugin registration, or initial theme setup.
- `theming`: `primevue-theming-customization` for presets, tokens, pass-through, slots, events, styles, styled/unstyled mode, or Tailwind customization.
- `accessibility`: `primevue-accessibility-icons` for accessibility, keyboard/focus behavior, accessible names, PrimeIcons, or custom icons.
- `migration`: `primevue-migration` for current PrimeVue version migration or deprecated-API work.
- `audit`: `primevue-audit-troubleshooting` for code audits, invalid API repair, MCP/plugin failure, duplicate MCP configuration, or runtime diagnosis.

Do not run a focused workflow here or load several focused skills preemptively. When a request spans categories, choose the skill that owns the requested outcome; hand off only if a separate outcome remains.

## Shared Source Boundary

Current PrimeVue MCP results and current canonical routed PrimeVue docs/generated metadata are the supported behavior. Component documentation, API tables, and examples remain MCP-owned. Never invent or copy into skills any API, event, slot, directive, token, pass-through key, setup route, alias, example, public URL, migration fact, icon behavior, availability, pricing, licensing, or product claim. Omit unsupported material or state that current official sources do not support it; absence is not a blocker.
