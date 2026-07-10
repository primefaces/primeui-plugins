# Workflow

Use this reference for building components and pages, auditing code, and producing source-backed PrimeReact examples.

## Start Every Task

1. Classify the request as setup, build, customize, audit/fix, migrate, explain, troubleshoot, or product/brand work.
2. Inspect the nearest application context. Prefer `primeui info --json`; otherwise inspect `package.json`, the active lockfile, React/Next.js/Vite/TypeScript configuration, `tsconfig` or `jsconfig` paths, Vite aliases, Next.js layouts and client providers, `components.json`, global CSS, Tailwind, theme or preset files, local UI directories, existing imports, and nearby JSX/TSX conventions.
3. Confirm PrimeReact scope from React files, PrimeReact packages/imports, or existing provider setup. Redirect PrimeVue or PrimeNG work to the matching plugin without emitting other-library syntax.
4. Read [variants.md](variants.md), select `styled`, `tailwind`, `primitive`, or `headless`, and record the evidence. When signals conflict, prefer the import and conventions of the file being edited.
5. After mode selection, fetch current official data from PrimeReact MCP. Pass `mode` to discovery, setup, component, guide, example, and validation calls.
6. Implement in the project's existing React style and validate final component usage with the same mode.

## Individual Components

- Use mode-scoped `search` when the current component or behavior name is uncertain.
- Use mode-scoped `get_component` before relying on imports, props, callbacks, hook returns, compound parts, pass-through sections, CSS hooks, or tokens.
- Use `get_component` with example availability before choosing an example section or variant. Then use mode-scoped `get_example` when behavior or composition matters; do not assume names such as `basic`. Keep resulting code narrow and adapt it to the project's state, routing, form, and alias conventions.
- Preserve package imports for package-owned components. Preserve the resolved alias or relative import for copied local components.

## Pages And Application Surfaces

- Identify data flow, state ownership, routing, loading/error states, client/server boundaries, and provider placement before composing components.
- Fetch current metadata for every PrimeReact component whose API materially affects the surface.
- Reuse existing layouts, providers, hooks, form handling, aliases, local UI components, and styling patterns.
- Validate each distinct PrimeReact usage, then run project type, build, test, or browser checks appropriate to the requested change.

## Audit Or Fix Existing Code

1. Locate imports, component usage, relevant state, and provider/theme setup.
2. Confirm the mode from the actual import and local project structure before retrieval.
3. Validate the narrowest complete snippet that reproduces the questioned usage.
4. Fetch current mode-scoped component, example, or guide data for every reported issue.
5. Patch minimally, preserve local conventions, and revalidate in the same mode.
6. Distinguish source-confirmed defects from optional style or architecture suggestions.

## Cross-Library Requests

- Refuse PrimeVue or PrimeNG syntax, examples, and validation in this skill. Refer the request to the matching library plugin and server.
- Do not translate another Prime library's props, events, templates, selectors, or setup by analogy.
- A monorepo containing multiple Prime libraries is not permission to mix them. Use the nearest app and edited file as the boundary.

## Customer-Facing Examples

- Keep examples React- and PrimeReact-specific and trace them to current mode-scoped MCP docs, metadata, guides, or examples.
- Include only the context needed to make imports and behavior understandable.
- Mention validation only when it actually ran.
- Do not add licensing, pricing, access, availability, or compatibility claims unless current official sources confirm them.
