# Customization

Use this reference for component options, styles, themes, tokens, local Tailwind components, pass-through APIs, and accessibility.

## Choose The Official Source

- Select the mode before retrieval and keep every MCP call mode-scoped.
- Use `get_component` for current props, callbacks, imports, hook returns, compound parts, pass-through sections, CSS hooks, and component tokens.
- Use `get_example` for behavior and composition instead of inventing combinations.
- Use `get_guide` or `get_setup` for providers, presets, semantic or component tokens, dark mode, CSS layers, Tailwind, registry components, and global pass-through configuration.
- Preserve the project's current provider, mode, alias, local UI directory, and styling strategy unless changing one is the task.

## Mode-Specific Customization

- `styled`: inspect the selected preset and provider options. Fetch current token and customization guidance before naming token paths, CSS variables, classes, or preset APIs; prefer supported theme mechanisms over fragile overrides.
- `tailwind`: customize the project-owned component and its existing utility/variant helpers, CSS variables, and global styles. Preserve the concrete local import path and do not treat a registry source as an installed package API.
- `primitive`: fetch current component composition and API metadata before naming subcomponents, state attributes, or imports. Supply styling through the project's existing CSS approach.
- `headless`: fetch current hook metadata and examples before naming returned props or composing markup. Preserve native semantics and project-owned structure.

## Component Options And Pass-Through

- Confirm variants, severities, sizes, loading and disabled patterns, icons, labels, selection models, and callback names from current mode-scoped sources.
- Fetch the exact pass-through metadata before naming DOM-part keys. Do not infer a key from rendered markup, another mode, another Prime library, or an older version.
- For data-heavy components, fetch the exact pagination, filtering, sorting, selection, lazy-loading, or virtualization example needed.

## Accessibility And Visual Checks

- Preserve native semantics, accessible names, focus behavior, keyboard interaction, labels, and status information.
- Add an accessible name to icon-only or custom-content controls when current guidance requires it.
- Validate component API and import usage, then separately browser-check appearance, themes, responsive behavior, focus, keyboard behavior, and screen-reader-relevant states when the task requires them.
