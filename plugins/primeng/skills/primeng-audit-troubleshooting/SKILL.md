---
name: primeng-audit-troubleshooting
description: Audit and troubleshoot PrimeNG code, repair source-confirmed invalid Angular APIs, and diagnose missing or duplicate MCP/plugin configuration using the supported PrimeUI doctor command.
---

# PrimeNG Audit And Troubleshooting

Localize the failure first: selector/import, component metadata, input/output, template/directive, forms, application provider/setup, theme/CSS, accessibility, application state, data/backend, or MCP/plugin tooling. Inspect the narrowest relevant Angular code and local configuration; keep source-confirmed defects separate from optional style suggestions.

For an API audit, call `validate_usage` on the narrowest complete failing usage. After a reported issue, call `get_component` for the rejected selector, import, input, output, template, directive, form contract, or pass-through section, patch minimally, and call `validate_usage` once on corrected final code. Treat `metadata-incomplete` or unavailable Angular API data as a validation limit, not proof. Do not call `version` routinely.

For missing MCP, skill discovery, startup, resources, tools, or validation—and for suspected duplicate direct MCP plus plugin configuration—run:

```text
primeui doctor --json --tool <tool> --library primeng
```

Use no stale or fallback doctor command. Report check identifiers, details, suggestions, and whether the same PrimeNG MCP is configured directly and through the plugin. Retry MCP work only after a passing repair. If MCP remains unavailable, name any current local generated-doc/package-metadata fallback and never call it MCP-validated.

For product, licensing, access, availability, pricing, support, or release claims, use only current official package/license/product sources; otherwise say the claim is unconfirmed. Never expose credentials or license values.

## Scenario Contracts

- `audit-invalid-api`: `validate_usage -> get_component -> validate_usage`; maximum 3.
- `missing-mcp`: `none`; maximum 0.
- `duplicate-mcp-plugin`: `none`; maximum 0.

After static repair, run focused Angular type/build/test/browser checks appropriate to the actual failure and report unverified runtime, visual, accessibility, responsive, forms, and business behavior separately.
