---
name: primereact-accessibility-icons
description: Apply current mode-scoped PrimeReact accessibility and icon guidance. Use for semantics, names, labels, focus and keyboard behavior, PrimeIcons, custom icons, and icon-bearing controls.
---

# PrimeReact Accessibility And Icons

Select the mode before retrieval. Inspect native semantics, labels/descriptions, status messaging, focus and keyboard handling, icon packages, custom icon rendering, local Tailwind components, and nearby conventions.

Use same-mode `get_guide` only for the current routed accessibility, PrimeIcons, or custom-icons concept. Use same-mode `get_component` for component-specific accessibility metadata and supported icon props/parts. Do not generalize across modes or components, and do not invent ARIA attributes, icon names, callbacks, slots, parts, or keyboard interactions.

Call same-mode `validate_usage` once on final component code and repeat only after a reported issue. Separately test focus order, keyboard operation, visible focus, accessible names/states, contrast, and responsive behavior where required. Do not call `version` routinely.

## Scenario Contracts

- `accessibility-icons`: `get_guide -> get_component -> validate_usage`; maximum 3.

Report selected-mode PrimeReact citations and only the runtime or assistive-technology checks actually performed.
