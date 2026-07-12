---
name: primevue-component-implementation
description: Implement or discover PrimeVue components in Vue code using current PrimeVue MCP component metadata, routed examples, and final usage validation. Use for known components, component discovery, pages, forms, and directives; not for setup, theming, migration, or troubleshooting-only tasks.
---

# PrimeVue Component Implementation

Inspect the nearest `package.json`, lockfile, Vue/Nuxt/Vite configuration, imports, SFC conventions, aliases, state/form pattern, and nearby components. Preserve the project's registration style, Composition or Options API choice, TypeScript usage, data flow, and local naming.

## Efficient MCP Workflow

- Known component: call `get_component` directly. Do not call `search` or `list` first.
- Discovery: call `search` only when the component name is unknown, select a PrimeVue result, then call `get_component`.
- Source-backed behavior: inspect `get_component` or `search` section metadata, exact section IDs, `hasCode`, and valid next-call arguments before calling `get_example`. Skip `get_example` when no source example is needed or available.
- Forms and directives: use `search` or `get_guide` only when current routed docs expose the requested workflow, then retrieve the concrete component or example evidence. Otherwise report it as unsupported.
- Implement the narrowest complete Vue change from returned imports, props, emits, slots, directives, and examples. Do not reproduce documentation or infer missing APIs.
- Call `validate_usage` once on final code. Repeat only after it reports an issue and the code is corrected. An accepted result covers only checked API metadata, not rendering, CSS, accessibility, responsiveness, state, network, or business behavior.
- Do not call `version` routinely.

## Scenario Contracts

- `known-component`: `get_component -> validate_usage`; maximum 2.
- `source-backed-behavior`: `get_component -> get_example -> validate_usage`; maximum 3.
- `discovery`: `search -> get_component -> get_example -> validate_usage`; maximum 4.

Finish with the MCP sources used, the validation result, and any separate project type/build/browser checks. Keep PrimeNG and PrimeReact syntax out of the result.
