# Workflow

Use this reference for building components and pages, auditing code, working with forms, templates or directives, implementing Table behavior, and producing source-backed examples.

## Start Every Task

1. Classify the request as setup, build, customize, audit/fix, migrate, explain, troubleshoot, or product/brand work.
2. Inspect the nearest application context. Prefer `primeui info --json`; otherwise inspect `package.json`, the active lockfile, `angular.json` or other workspace configuration, TypeScript configuration, `main.ts`, application config or root module, routes, global styles, PrimeNG imports, `providePrimeNG`, theme configuration, and nearby component conventions.
3. Determine whether the target uses standalone components, NgModules, or a deliberate mix. Inspect the actual file being changed instead of assuming from the Angular version.
4. Confirm PrimeNG scope from Angular files, PrimeNG packages/imports, or existing app setup. Redirect other Prime libraries to their matching plugins without emitting foreign-framework syntax.
5. Fetch current official data from PrimeNG MCP. Use `search` for discovery, `get_setup` for application setup, `get_component` for API metadata, `get_guide` for concepts or migration rules, and `get_example` for source-backed behavior.
6. Implement in the project's existing Angular style and validate final component usage with `validate_usage`.

## Components, Templates, And Directives

- Call `get_component` before relying on a selector, import, input, output, template name or context, directive, method, pass-through section, or form capability.
- Call `get_example` when behavior or composition matters, including loading, selection, filtering, sorting, pagination, overlays, forms, and navigation.
- Preserve Angular binding semantics: property bindings, event bindings, two-way bindings, template reference variables, structural control flow, and projected content must use names confirmed by current PrimeNG sources.
- In standalone files, add the exact documented component, directive, or module to the component `imports`. In NgModule applications, add the documented import to the owning module. Do not convert the project's setup style unless requested.
- Keep patches narrower than full documentation demos. Include only the state, handlers, imports, and template context needed by the application.

## Inputs, Outputs, And Forms

- Treat inputs and outputs as Angular API, not generic props or callbacks. Confirm aliases and event payloads from `get_component` before binding them.
- Inspect whether the app uses template-driven forms, reactive forms, signals around form state, or another established abstraction.
- Preserve `FormsModule` and `ReactiveFormsModule` boundaries. Fetch current component docs or examples before assuming `ngModel`, form-control support, invalid-state inputs, or value shapes.
- Keep labels, error messages, touched/dirty/submitted logic, disabled state, and accessible descriptions consistent with the surrounding form.

## Table Workflows

1. Fetch Table metadata with `get_component`, including API data when inputs, outputs, templates, or directives are material.
2. Fetch source-backed examples separately for `pagination`, `filtering`, `sorting`, and `selection`; do not guess a combined option set.
3. Inspect the row model, identity key, selection model, filter state, lazy/server data flow, and existing table templates before composing features.
4. Preserve the project's state ownership and event-handling pattern. Do not turn client-side examples into server-side behavior by implication.
5. Validate the complete Table usage after composing the required features, then run the project's focused Angular compile, test, and browser checks when applicable.

## Pages And Application Surfaces

- Identify data flow, state ownership, routing, loading/error/empty states, forms, and accessibility before composing components.
- Fetch current metadata for every PrimeNG component whose API materially affects the surface.
- Reuse existing services, stores, signals, observables, layout components, and style conventions.
- Validate each distinct PrimeNG usage; then run project type, build, test, or browser checks appropriate to the requested change.

## Audit Or Fix Existing Code

1. Locate imports, decorator metadata, template usage, component state, forms wiring, and relevant app-level setup.
2. Validate the narrowest complete snippet that reproduces the questioned usage.
3. Fetch current API or guide data for every reported issue.
4. Patch minimally and preserve local conventions.
5. Distinguish source-confirmed defects from optional style or architecture suggestions.
6. Revalidate corrected usage.

## Customer-Facing Examples

- Keep examples Angular- and PrimeNG-specific and trace them to current MCP docs, API metadata, guides, or examples.
- Include only the context needed to make imports, decorator metadata, state, and template behavior understandable.
- Mention validation only when it actually ran.
- Do not add licensing, pricing, access, availability, or compatibility claims unless current official sources confirm them.
