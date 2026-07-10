# Setup

Use this reference for PrimeVue installation, application plugin or Nuxt module configuration, themes, presets, providers, and MCP setup failures.

## Application Setup

1. Detect the host and conventions: Vue with Vite or another bundler, Nuxt, JavaScript or TypeScript, local or automatic component registration, styled or unstyled mode, and Tailwind or custom CSS.
2. Inspect the nearest package metadata and lockfile before recommending packages or commands. Inspect the app entry point, `nuxt.config`, Vue/Nuxt plugins, theme or preset files, global CSS, aliases, and existing PrimeVue configuration.
3. Call PrimeVue MCP `get_setup`. Use `get_guide` for the current Vite, Nuxt, configuration, theming, pass-through, or forms procedure when the task needs more detail.
4. Preserve existing plugin/module registration, theme preset, PrimeUI license wiring, locale, ripple, input variant, z-index, CSP, pass-through, auto-import, and CSS strategy unless the user asks to change them.
5. Make the smallest additive change. Do not install duplicate plugins, overwrite a preset, expose a license value, or replace the app's package manager or setup pattern without a source-backed reason.
6. Verify with a current component import or registered component, then run the project's focused type/build/runtime check when the task includes implementation.

## Version And Package Guidance

- Do not hard-code package versions or availability in the skill. Read current `get_setup` output and package metadata at task time.
- Keep framework MCP/plugin installation distinct from PrimeVue application installation.
- Treat package-resolution or plugin-discovery failures as setup problems. Do not fall back to web search before checking official PrimeVue MCP and local package sources.

## MCP And Assistant Recovery

When the PrimeVue MCP, skill, resources, or validator are missing or fail to start, run or request:

```text
primeui ai doctor --json --tool <tool> --library primevue
```

Report failing check identifiers, details, and suggestions. Retry the MCP operation after a passing repair. Use accessible local generated docs or package metadata only as a named fallback, and do not present fallback content as MCP-validated.

## Reporting

- Name the setup source used: `get_setup`, a specific PrimeVue guide, current package metadata, or a named local fallback.
- State which existing setup was preserved and which files changed.
- State what still needs runtime or browser verification.
