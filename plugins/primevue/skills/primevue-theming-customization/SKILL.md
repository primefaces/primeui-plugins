---
name: primevue-theming-customization
description: Customize PrimeVue using current routed theming guidance and component metadata. Use for presets, design tokens, styled or unstyled mode, Tailwind, pass-through, slots, events, and supported style APIs.
---

# PrimeVue Theming And Customization

Inspect the installed theme packages, chosen preset, PrimeVue configuration, styled/unstyled mode, dark-mode selector, CSS layers, Tailwind/global CSS, global `pt`/`ptOptions`, and nearby customization conventions. Preserve that strategy unless changing it is the task.

Use `get_guide` only for a relevant current routed concept such as styled or unstyled theming, Tailwind, pass-through, or configuration. For component-specific tokens, pass-through sections, slots, events, classes, or style APIs, call `get_component`; inspect returned source and section metadata before any `get_example`. Never derive token paths or pass-through keys from rendered CSS, another library, or memory.

Prefer supported component APIs and slots before pass-through or CSS overrides. Keep global preset changes separate from scoped tokens and ordinary app CSS. Use only returned events, slots, styles, and merge behavior. Call `validate_usage` once on final component code, repeating only after a reported issue. Do not call `version` routinely.

## Scenario Contracts

- `theming-customization`: `get_guide -> get_component -> validate_usage`; maximum 3.

Report the guide/component citations, preserved strategy, validation scope, and any visual/theme checks still required.
