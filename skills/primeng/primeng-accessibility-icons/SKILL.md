---
name: primeng-accessibility-icons
description: Apply current PrimeNG accessibility and icon guidance. Use for semantics, names, labels, focus and keyboard behavior, component accessibility, PrimeIcons, custom icons, and icon-bearing controls.
---

# PrimeNG Accessibility And Icons

Inspect existing Angular templates, native semantics, labels and descriptions, error/status messaging, focus handling, keyboard interaction, icon packages, custom icon templates, and nearby component conventions.

Use `get_guide` only for the current routed accessibility, icons, or custom-icons concept relevant to the request. Use `get_component` for component-specific accessibility metadata, supported icon inputs/templates, and exact output or keyboard contracts. Inspect returned section metadata before requesting an example. Do not generalize behavior between components or invent ARIA attributes, PrimeIcons names, templates, inputs, outputs, or keyboard interactions.

Preserve native semantics and accessible names. Treat icon-only and custom-content controls according to returned component and accessibility guidance. Call `validate_usage` once on final component code and repeat only after a reported issue. Then separately test focus order, keyboard operation, visible focus, announced names/states, contrast, and responsive behavior when those outcomes matter. Do not call `version` routinely.

## Scenario Contracts

- `accessibility-icons`: `get_guide -> get_component -> validate_usage`; maximum 3.

Report PrimeNG-only resource/public citations, static validation, and the runtime or assistive-technology checks actually performed.
