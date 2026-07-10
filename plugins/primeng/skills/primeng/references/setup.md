# Setup

Use this reference for PrimeNG installation, standalone or NgModule configuration, `providePrimeNG`, themes, forms imports, and MCP setup failures.

## Inspect The Angular Application

1. Inspect the nearest package metadata and lockfile before recommending packages or commands.
2. Inspect `angular.json` or the active workspace configuration, `main.ts`, `app.config.ts`, root and feature modules, standalone component metadata, routes, TypeScript configuration, global styles, theme or preset files, and existing PrimeNG imports.
3. Determine the package manager, Angular and PrimeNG versions, standalone or NgModule pattern, forms strategy, styled or unstyled mode, Tailwind usage, and server-side rendering or zoneless constraints when relevant.
4. Call PrimeNG MCP `get_setup`. Use `get_guide` for current configuration, styled mode, unstyled mode, Tailwind, pass-through, forms, or migration details.

## Standalone And NgModule Setup

- For standalone applications, preserve the existing bootstrap and application configuration. Add `providePrimeNG` to the application-level provider configuration only when current `get_setup` guidance and project state require it.
- For standalone components, import the exact documented PrimeNG component, directive, or module in the component `imports` array.
- For NgModule applications, preserve the root bootstrap module and add `providePrimeNG` at the root environment/provider boundary supported by the application. Import the exact documented PrimeNG module or standalone declaration in the owning NgModule.
- Do not move an application from NgModules to standalone components, or the reverse, as incidental setup work.
- Avoid duplicate root providers, component imports, modules, styles, or form modules. Verify the nearest owning boundary before editing.

## Provider, Theme, And Forms

- Preserve existing `providePrimeNG` options such as theme, license wiring, locale, ripple, input variant, overlay behavior, z-index, CSP, unstyled mode, and global pass-through configuration unless changing them is the task.
- Fetch current theme/setup guidance before naming a theme package, preset, design-token API, dark-mode selector, CSS layer, or Tailwind integration step.
- Treat design-token presets, global CSS, pass-through, utility classes, and component-scoped styling as different layers; do not replace one with another without a source-backed reason.
- Import `FormsModule` or `ReactiveFormsModule` only at the component or NgModule boundary that owns the documented form binding. Preserve the application's existing form approach.
- Make the smallest additive change. Do not expose a license value, replace a package manager, or overwrite application bootstrap or theme configuration.

## Version And Package Guidance

- Do not hard-code package versions or availability in the skill. Read current `get_setup` output, package metadata, and the lockfile at task time.
- Keep PrimeNG application installation distinct from the PrimeNG MCP/plugin installation.
- Treat package-resolution or plugin-discovery failures as setup problems. Do not use web search as a substitute for official PrimeNG MCP or accessible local package sources.

## MCP And Assistant Recovery

When the PrimeNG MCP, skill, resources, or validator are missing or fail to start, run or request:

```text
primeui ai doctor --json --tool <tool> --library primeng
```

Report failing check identifiers, details, and suggestions. Do not claim the doctor ran if the CLI or command is unavailable. Retry the MCP operation after a passing repair. Use accessible local generated PrimeNG docs or package metadata only as a named fallback, and do not present fallback content as MCP-validated.

## Reporting

- Name the setup source used: `get_setup`, a specific PrimeNG guide, current package metadata, or a named local fallback.
- State whether the project is standalone or NgModule-based, which provider/import boundary was preserved, and which files changed.
- State what still needs Angular compilation, runtime, forms, SSR, visual, or browser verification.
