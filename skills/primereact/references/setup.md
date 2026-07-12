# Setup

Use this reference for PrimeReact installation, React host configuration, aliases, providers, themes, local UI directories, and MCP setup failures.

## Inspect The Application

1. Identify the host and conventions: React with Vite or another bundler, Next.js App or Pages Router, JavaScript or TypeScript, client/server boundaries, and the current PrimeReact mode.
2. Inspect the nearest package metadata and lockfile, `next.config.*`, `vite.config.*`, `tsconfig.json` or `jsconfig.json`, `components.json`, app entry points, root layouts, client providers, theme or preset files, global CSS, Tailwind configuration, and local component directories.
3. Resolve aliases to real paths. Treat an import such as `@/components/ui/...` as local only after confirming its path mapping and target file.
4. Inspect existing `PrimeReactProvider` placement and configuration before suggesting another provider. Preserve SSR stylesheet handling, theme presets, dark-mode selectors, and license wiring without exposing values.

## Fetch Current Setup

1. Select the mode before retrieval.
2. Call PrimeReact MCP `get_setup` with the selected `mode` and the detected environment.
3. Because host-specific setup can live in a separate guide, use mode-scoped `search` and `get_guide` for the exact Next.js, Vite, provider, configuration, theming, or registry procedure.
4. Read current package metadata before recommending packages or versions. Do not hard-code release availability in the skill.

## Mode Boundaries

- `styled`: preserve package component imports, the existing provider, theme preset, stylesheet/SSR strategy, and token configuration.
- `tailwind`: preserve copied component files, `components.json`, the actual alias or relative import, local utilities, global CSS variables, Tailwind plugins, and the provider's behavior configuration. Do not replace local components with package UI imports.
- `primitive`: preserve the unstyled component approach and fetch the current primitive setup and import from MCP before writing code. Do not add a styled preset unless the user is changing modes.
- `headless`: preserve project-owned markup and styling and fetch the current headless setup and hook contract before writing code. Do not substitute standalone `hooks` mode for `headless`.

## Make Setup Changes

- Prefer the smallest additive change. Do not replace the package manager, overwrite aliases, presets, providers, `components.json`, global CSS, or app bootstrap code without a source-backed reason.
- Keep PrimeReact application installation distinct from assistant/plugin/MCP installation.
- Verify setup with a current mode-scoped component usage, then run the project's focused checks when implementation is in scope.

## MCP Recovery

For a missing skill, MCP configuration, startup, tool surface, resource, or validator, run or request:

```text
primeui doctor --json --tool <tool> --library primereact --variant <styled|tailwind|primitive|headless>
```

Report failed check identifiers, details, and suggestions. Retry MCP after repair. If it remains unavailable, use only accessible generated docs or current package metadata for the selected mode, name that fallback, and do not claim MCP validation.
