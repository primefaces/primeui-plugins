---
name: primereact-router
description: Route PrimeReact and React-specific PrimeUI work to exactly one focused PrimeReact skill after selecting a source-backed mode. Use first for components, setup, theming, accessibility, icons, migration, audits, or troubleshooting. Never use for PrimeVue or PrimeNG.
---

# PrimeReact Router

Select exactly one smallest focused skill:

- `accessibility`: `primereact-accessibility-icons`
- `audit`: `primereact-audit-troubleshooting`
- `component`: `primereact-component-implementation`
- `migration`: `primereact-migration`
- `setup`: `primereact-setup-installation`
- `theming`: `primereact-theming-customization`

Inspect the edited file, resolved imports, nearest package metadata and lockfile, React/Next.js/Vite configuration, aliases, `components.json`, provider/theme setup, Tailwind/global CSS, local UI directories, and nearby JSX/TSX before routing. Select exactly one source-backed mode—`styled`, `tailwind`, `primitive`, or `headless`—before any MCP call that accepts `mode`. A standalone hook request may select the advertised `hooks` mode only when current generated metadata exposes that hook.

When signals conflict, prefer the resolved import and conventions of the file being edited. If the mode is still ambiguous, ask one short clarification or return structured ambiguity with the conflicting evidence and no MCP call; never silently default. Dynamic imports and wrappers are evidence only when they resolve a concrete mode. They are not hard errors and do not authorize cross-mode guidance.

Current PrimeReact MCP results, current canonical routed PrimeReact docs, and generated metadata are the only behavior source. Keep component docs, API tables, hooks, examples, setup candidates, mode metadata, and citations MCP-owned. Undocumented APIs, imports, routes, aliases, examples, setup, citations, product claims, and mode combinations are omitted or explicitly unsupported, never synthesized.

Do not run a focused workflow here or load several focused skills preemptively. Keep every call, result, resource URI, public citation, import, component, hook, example, setup step, and validation contract in the selected mode. Never mix styled, Tailwind, primitive, headless, or hooks material. Keep PrimeVue and PrimeNG syntax out.
