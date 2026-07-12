---
name: primeng-theming-customization
description: Customize PrimeNG using current routed theming guidance and component metadata. Use for presets, design tokens, styled or unstyled mode, Tailwind, pass-through, CSS layers, and supported component style APIs.
---

# PrimeNG Theming And Customization

Inspect `providePrimeNG`, installed theme packages, chosen preset, styled/unstyled mode, dark-mode selector, CSS layers, Tailwind/global CSS, global `pt`/`ptOptions`, root font assumptions, and nearby customization conventions. Preserve that strategy unless changing it is the task.

Use `get_guide` only for a relevant current routed configuration, styled, unstyled, Tailwind, or pass-through concept. For component-specific tokens, pass-through sections, templates, inputs, outputs, classes, or style APIs, call `get_component`; inspect returned source and section metadata before any `get_example`. Never derive token paths or pass-through keys from rendered CSS, another library, or memory.

Prefer supported component APIs and templates before pass-through or CSS overrides. Keep global preset changes separate from scoped tokens and ordinary application CSS. Use only returned metadata and merge behavior. Call `validate_usage` once on final component code, repeating only after a reported issue. Do not call `version` routinely.

## Scenario Contracts

- `theming-customization`: `get_guide -> get_component -> validate_usage`; maximum 3.

Report the guide/component resource and public citations, preserved strategy, validation scope, and visual/theme checks still required.
