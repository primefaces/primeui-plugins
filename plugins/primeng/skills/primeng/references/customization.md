# Customization

Use this reference for inputs, outputs, templates, directives, component options, Table behavior, styles, themes, presets, tokens, pass-through APIs, and accessibility.

## Choose The Official Source

- Use `get_component` for current selectors, imports, inputs, outputs, methods, templates and contexts, directives, form support, pass-through sections, CSS classes, and component tokens.
- Use `get_example` for behavior and composition rather than inventing combinations.
- Use `get_guide` or `get_setup` for styled or unstyled mode, presets, semantic or component tokens, dark mode, CSS layers, Tailwind, and global pass-through configuration.
- Preserve the project's current theme and styling strategy unless changing it is the task.

## Angular Component APIs

- Confirm input names and types, output names and payloads, two-way binding contracts, template reference names and contexts, selectors, and directive placement before writing Angular markup.
- Keep component selectors and attribute directives in their documented form. Do not translate another library's component or event syntax.
- Prefer documented inputs, outputs, templates, and content projection before pass-through or CSS overrides when they express the requested behavior.
- Inspect the component's documented standalone declaration or module import before changing decorator or NgModule metadata.

## Button And Table Behavior

- For a danger Button, fetch `get_example` with component `button` and variant `danger`, then confirm the final selector, severity input, imports, and any surrounding state with `get_component`.
- For a loading Button, fetch the `loading` source-backed variant and preserve its documented Angular state and binding pattern. Do not infer a loading API from another component.
- For Table work, fetch `pagination`, `filtering`, `sorting`, and `selection` examples independently. Confirm every composed input, output, template, and directive with Table metadata.
- Keep client-side pagination/filtering/sorting separate from lazy or server-driven workflows. Preserve row identity and selection state explicitly.

## Themes, Presets, And Tokens

- Inspect installed theme packages, selected preset, `providePrimeNG` options, dark-mode selector, CSS-layer choice, root font-size expectations, global CSS, and any custom preset before editing.
- Fetch current token paths and preset APIs. Do not infer token names from rendered CSS, another PrimeUI library, or an older PrimeNG version.
- Keep global preset changes separate from scoped component-token changes and ordinary application CSS.
- Prefer current design-token and scoped-token APIs over brittle deep selectors when official guidance supports them.

## Pass-Through, Tailwind, And Unstyled Work

- Fetch current component metadata before naming pass-through sections or nested PrimeNG component sections.
- Inspect global `pt` and `ptOptions` configuration before adding local pass-through values.
- Preserve merge behavior and styled/unstyled mode. Treat Tailwind classes as project code, not as proof that a pass-through key exists.
- Check CSS-layer order and theme/Tailwind dark-mode alignment before adding specificity workarounds.

## Forms And Accessibility

- Confirm whether the component supports template-driven forms, reactive forms, both, or a different binding contract from current docs and examples.
- Preserve native semantics, labels, accessible names, focus behavior, keyboard interaction, error descriptions, and loading or selection status.
- Add an accessible name to icon-only or custom-content controls when current guidance requires it.
- Validate component API usage, then separately browser-check appearance, themes, responsive behavior, focus, keyboard behavior, and screen-reader-relevant states when the task requires them.
