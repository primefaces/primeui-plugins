---
name: primevue-accessibility-icons
description: Apply current PrimeVue accessibility and icon guidance. Use for semantics, names, labels, focus and keyboard behavior, component accessibility, PrimeIcons, custom icons, and icon-bearing controls.
---

# PrimeVue Accessibility And Icons

Inspect existing semantics, labels, error/status messaging, focus handling, keyboard interaction, icon packages, custom icon templates, and nearby component conventions.

Use `get_guide` only for the current routed accessibility, icons, or custom-icons concept relevant to the request. Use `get_component` for component-specific accessibility metadata, supported icon props/slots, and exact event or keyboard contracts. Inspect returned section metadata before requesting an example. Do not generalize behavior between components or invent ARIA, icon names, slots, or keyboard interactions.

Preserve native semantics and accessible names. Treat icon-only and custom-content controls according to returned component and accessibility guidance. Call `validate_usage` once on final component code and repeat only after a reported issue. Then separately test focus order, keyboard operation, visible focus, announced names/states, contrast, and responsive behavior when those outcomes matter. Do not call `version` routinely.

## Scenario Contracts

- `accessibility-icons`: `get_guide -> get_component -> validate_usage`; maximum 3.

Report source citations, static validation, and the runtime or assistive-technology checks actually performed.
