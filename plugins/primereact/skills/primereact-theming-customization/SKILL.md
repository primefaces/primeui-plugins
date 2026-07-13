---
name: primereact-theming-customization
description: Customize PrimeReact components and themes within one selected mode using current mode-scoped guides and component metadata. Use for styled presets/tokens, Tailwind project-owned variants, primitive/headless styling, pass-through, sizes, severities, and visual options.
---

# PrimeReact Theming And Customization

Select the project mode before retrieval and preserve it. Inspect providers, presets, Tailwind/global CSS, local component sources and variants, aliases, pass-through usage, and nearby conventions. Use same-mode `get_guide` for the exact theming/customization concept and `get_component` for supported component options or pass-through metadata. Do not name tokens, CSS variables, classes, variants, pass-through keys, compound parts, hook returns, or imports without returned evidence.

Styled presets and tokens, Tailwind project-owned utilities/variants, primitive composition, and headless markup are separate contracts. Never translate or combine them. Call same-mode `validate_usage` once on final component code and repeat only after a reported issue. Treat visual appearance, CSS cascade, responsive behavior, and interaction as separate browser checks. Do not call `version` routinely.

## Scenario Contracts

- `theming-customization`: `get_guide -> get_component -> validate_usage`; maximum 3.

Return only selected-mode PrimeReact citations and explicitly name any unsupported or incomplete metadata.
