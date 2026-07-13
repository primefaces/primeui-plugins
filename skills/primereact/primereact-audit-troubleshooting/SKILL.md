---
name: primereact-audit-troubleshooting
description: Audit and troubleshoot PrimeReact code, repair source-confirmed invalid mode-scoped APIs, and diagnose missing or duplicate MCP/plugin configuration with the supported PrimeUI doctor command.
---

# PrimeReact Audit And Troubleshooting

Localize the failure first: mode/import, component or hook API, provider/setup, alias/local source, theme/CSS, accessibility, application state, data/backend, or MCP/plugin tooling. Select the mode from concrete local evidence before calls. Ambiguous, dynamic, extensible, and wrapper cases are validation limits, not automatic hard errors or permission to invent cross-mode repairs.

For an API audit, call same-mode `validate_usage` on the narrowest complete failing usage. After a reported issue, call same-mode `get_component`, patch minimally from returned metadata, and call same-mode `validate_usage` once on corrected final code. Do not call `version` routinely.

For missing MCP, skill discovery, startup, resources, tools, validation, or suspected duplicate direct MCP plus plugin configuration, run exactly:

```text
primeui doctor --json --tool <tool> --library primereact
```

Use no stale alias, variant flag, or fallback direct-MCP instruction. Report check identifiers, details, suggestions, and duplicate status. Retry only after repair. A named current local generated-doc/package-metadata fallback is not MCP validation.

Product, licensing, access, availability, pricing, support, and release claims require current official sources; otherwise report them unconfirmed. Never expose credentials or license values.

## Scenario Contracts

- `audit-invalid-api`: `validate_usage -> get_component -> validate_usage`; maximum 3.
- `missing-mcp`: `none`; maximum 0.
- `duplicate-mcp-plugin`: `none`; maximum 0.

After static repair, run focused React type/build/test/browser checks appropriate to the failure and report unverified runtime, visual, accessibility, responsive, and business behavior separately.
