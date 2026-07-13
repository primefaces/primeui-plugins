---
name: primereact-component-implementation
description: Implement and discover PrimeReact components or source-backed hooks with mode-scoped MCP metadata, examples, and final validation. Use for known components, discovery, behavior, composition, props, callbacks, and hooks; not setup, theming, migration, or troubleshooting-only work.
---

# PrimeReact Component Implementation

Inspect the local React context and select `styled`, `tailwind`, `primitive`, or `headless` before retrieval. Use `hooks` only for an explicitly requested standalone hook present in current metadata. If evidence is ambiguous, conflicting, dynamic, or wrapper-obscured, ask or return structured ambiguity before any call rather than infer a mode.

## Efficient MCP Workflow

- Known component: call mode-scoped `get_component` directly. Do not call `search` or `list` first.
- Discovery: call mode-scoped `search` only when the component name is unknown, select a result in the same mode, then call `get_component` in that mode.
- Source-backed behavior: inspect section metadata, exact section IDs, `hasCode`, and valid next-call arguments before calling same-mode `get_example`. Skip it when no example is needed or available.
- Hooks: use only the advertised `hooks` mode and current hook metadata/examples. Never reconstruct a hook from headless or component APIs, and never treat hooks as a fallback mode.
- Implement only returned imports, parts, props, callbacks, hook inputs/returns, examples, and source-backed composition. Preserve package imports for package-owned components and resolved local aliases/subpaths for project-owned Tailwind components.
- Call same-mode `validate_usage` once on final code. Repeat only after it reports an issue and the code is repaired. An accepted result covers only checked generated metadata. Metadata-incomplete, dynamic, extensible, or wrapper cases remain validation limits rather than invented errors.
- Do not call `version` routinely.

## Scenario Contracts

- `known-component`: `get_component -> validate_usage`; maximum 2.
- `source-backed-behavior`: `get_component -> get_example -> validate_usage`; maximum 3.
- `discovery`: `search -> get_component -> get_example -> validate_usage`; maximum 4.
- `primitive-component`: `get_component -> get_example -> validate_usage`; maximum 3.
- `headless-component`: `get_component -> get_example -> validate_usage`; maximum 3.
- `source-backed-hook`: `get_component -> get_example -> validate_usage`; maximum 3.
- `ambiguous-mode`: `none`; maximum 0.
- `dynamic-wrapper`: `none`; maximum 0.

Finish with the selected mode, PrimeReact-only resource/public citations, validation result, and separate type/build/test/browser evidence. Never borrow another mode or another Prime library.
