# Workflow

Use this reference for building components and pages, auditing code, working with forms or directives, and producing source-backed examples.

## Start Every Task

1. Classify the request as setup, build, customize, audit/fix, migrate, explain, troubleshoot, or product/brand work.
2. Inspect the nearest application context. Prefer `primeui info --json`; otherwise inspect `package.json`, the active lockfile, Vue/Nuxt/Vite/TypeScript configuration, aliases, Tailwind, app bootstrap or Nuxt modules/plugins, PrimeVue imports, theme configuration, and nearby SFC conventions.
3. Confirm PrimeVue scope from Vue files, PrimeVue packages/imports, or existing app setup. Redirect PrimeNG or PrimeReact work to the matching plugin without emitting other-framework syntax.
4. Resolve material choices from local context first. Ask one short clarification only if the application host, setup style, or intended behavior remains ambiguous.
5. Fetch current official data from PrimeVue MCP. Use `search` for discovery, `get_setup` for application setup, `get_component` for API metadata, `get_guide` for concepts or migration rules, and `get_example` for source-backed behavior.
6. Implement in the project's existing Vue style and validate final component usage with `validate_usage`.

## Individual Components

- Fetch `get_component` before relying on imports, props, emits, slots, directives, template syntax, or pass-through sections.
- Fetch `get_example` when behavior or composition matters, including loading, selection, filtering, sorting, pagination, overlays, forms, and navigation.
- Keep the example or patch narrow enough to match the user's application rather than reproducing an entire documentation demo.

## Pages And Application Surfaces

- Identify data flow, state ownership, routing, validation, and loading/error states before composing components.
- Fetch current metadata for every PrimeVue component whose API materially affects the surface.
- Reuse existing layout, composables, stores, form handling, aliases, and component registration patterns.
- Validate each distinct PrimeVue usage; then run project type, build, test, or browser checks appropriate to the requested change.

## Forms And Directives

- Inspect whether the app uses PrimeVue Forms, another form library, native Vue state, or schema resolvers before changing its pattern.
- Use `search` and `get_guide` for the current form or directive workflow, then use `get_component` or `get_example` for concrete API usage.
- Do not infer directive registration, resolver imports, validation triggers, field slots, or error-state APIs from another version.

## Audit Or Fix Existing Code

1. Locate the imports, template usage, reactive state, and relevant app-level setup.
2. Validate the narrowest complete snippet that reproduces the questioned usage.
3. Fetch current API or guide data for every reported issue.
4. Patch minimally and preserve local conventions.
5. Distinguish source-confirmed defects from optional style or architecture suggestions.
6. Revalidate corrected usage.

## Customer-Facing Examples

- Keep examples Vue- and PrimeVue-specific and trace them to current MCP docs, API metadata, guides, or examples.
- Include only the context needed to make imports and template behavior understandable.
- Mention validation only when it actually ran.
- Do not add licensing, pricing, access, availability, or compatibility claims unless current official sources confirm them.
