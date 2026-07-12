---
name: primeng-component-implementation
description: Implement or discover PrimeNG components in Angular code using current PrimeNG MCP component metadata, routed examples, Angular API resources, and final usage validation. Use for known components, discovery, templates, directives, forms, inputs, outputs, and Table; not for setup, theming, migration, or troubleshooting-only tasks.
---

# PrimeNG Component Implementation

Inspect the nearest `package.json`, lockfile, Angular workspace configuration, `main.ts`, `app.config.ts`, component metadata, imports, template/style files, forms approach, aliases, state pattern, and nearby components. Preserve standalone Angular structure, TypeScript conventions, binding style, signals/observables, state ownership, and local naming.

## Efficient MCP Workflow

- Known component: call `get_component` directly. Do not call `search` or `list` first.
- Discovery: call `search` only when the component name is unknown, select a PrimeNG result, then call `get_component`.
- Source-backed behavior: inspect `get_component` or `search` section metadata, exact section IDs, `hasCode`, and valid next-call arguments before calling `get_example`. Skip `get_example` when no source example is needed or available.
- Templates, directives, forms, inputs, and outputs: retrieve the concrete component and exact source-backed example only when current routed docs or generated metadata expose the requested contract. Treat inputs and outputs as Angular APIs, preserve binding syntax and form-module boundaries, and report undocumented material as unsupported.
- Table: retrieve Table metadata first, then only the exact source-backed pagination, filtering, sorting, selection, template, or form example required. Preserve row identity and client/server state ownership; never combine options by inference.
- Implement the narrowest complete Angular change from returned selectors, imports, component metadata, inputs, outputs, templates, directives, form contracts, event payloads, and examples. Do not reproduce documentation or infer missing APIs.
- Call `validate_usage` once on final code. Repeat only after it reports an issue and the code is corrected. An accepted result covers only checked generated API metadata, not Angular compilation, dependency injection, rendering, CSS, accessibility, responsiveness, forms behavior, state, network, or business behavior.
- Do not call `version` routinely.

## Scenario Contracts

- `known-component`: `get_component -> validate_usage`; maximum 2.
- `source-backed-behavior`: `get_component -> get_example -> validate_usage`; maximum 3.
- `discovery`: `search -> get_component -> get_example -> validate_usage`; maximum 4.
- `table-workflow`: `get_component -> get_example -> validate_usage`; maximum 3.
- `forms-workflow`: `get_component -> get_example -> validate_usage`; maximum 3.
- `template-workflow`: `get_component -> get_example -> validate_usage`; maximum 3.
- `directive-workflow`: `get_component -> get_example -> validate_usage`; maximum 3.
- `input-output-workflow`: `get_component -> get_example -> validate_usage`; maximum 3.

Finish with the PrimeNG MCP resource/public citations used, the validation result, and any separate Angular type/build/test/browser checks. Keep PrimeVue and PrimeReact syntax out of the result.
