# Customization

Use this reference for component options, slots, events, styles, themes, presets, tokens, pass-through APIs, and accessibility.

## Choose The Official Source

- Use `get_component` for current props, emits, slots, methods, directives, import paths, pass-through sections, CSS classes, and component tokens.
- Use `get_example` for behavior and composition rather than inventing combinations.
- Use `get_guide` or `get_setup` for styled or unstyled mode, presets, semantic or component tokens, dark mode, CSS layers, Tailwind, and global pass-through configuration.
- Preserve the project's current theme and styling strategy unless changing it is the task.

## Component Customization

- Confirm severities, variants, sizes, loading and disabled patterns, icons, labels, templates, selection models, and event names from current PrimeVue sources.
- Prefer slots and supported component APIs before pass-through or CSS overrides when they express the requested behavior.
- For data-heavy components, fetch the exact pagination, filtering, sorting, selection, lazy-loading, or virtual-scrolling example needed.

## Themes, Presets, And Tokens

- Inspect the installed theme packages, selected preset, configuration options, dark-mode selector, CSS-layer choice, global CSS, and any custom preset before editing.
- Fetch current token paths and preset APIs. Do not infer token names from rendered CSS, another PrimeUI library, or an older PrimeVue version.
- Keep global preset changes separate from scoped component-token changes and ordinary application CSS.

## Pass-Through And Unstyled Work

- Fetch the current component metadata before naming pass-through sections or nested PrimeVue component sections.
- Inspect global `pt` and `ptOptions` configuration before adding local pass-through values.
- Preserve merge behavior and styled/unstyled mode. Treat Tailwind classes as project code, not as proof that a pass-through key exists.

## Accessibility And Visual Checks

- Preserve native semantics, accessible names, focus behavior, keyboard interaction, labels, and status information.
- Add an accessible name to icon-only or custom-content controls when current guidance requires it.
- Validate component API usage, then separately browser-check appearance, themes, responsive behavior, focus, keyboard behavior, and screen-reader-relevant states when the task requires them.
