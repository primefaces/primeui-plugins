# PrimeReact Variants

Use this reference for every PrimeReact task. The project-facing variant becomes the `mode` argument for PrimeReact MCP retrieval and validation.

## Select Before Retrieval

1. Prefer `primeui info --json`. Read its PrimeReact variant, variant signals, aliases, local UI directories, package imports, provider, and theme evidence.
2. Inspect the edited file and resolve its imports. Also inspect the nearest `package.json`, `components.json`, TypeScript/JavaScript paths, Vite aliases, Next.js layouts/providers, global CSS, theme preset, and local component directories.
3. Select exactly one of `styled`, `tailwind`, `primitive`, or `headless` before fetching docs, examples, setup, or API metadata.
4. When signals conflict, follow the edited file's resolved import and local conventions. Ask one short clarification if the choice still changes the required code.

## Routing Signals

- `styled`: package-owned UI component imports, a PrimeReact provider with a styled theme or preset, and token-based styling.
- `tailwind`: copied or registry-style components in the project, local UI aliases or relative imports, `components.json`, Tailwind utility variants, and project-owned component source.
- `primitive`: unstyled PrimeReact components and project-supplied styling. Confirm the current package import and composition from MCP; do not invent a primitive package name.
- `headless`: behavior hooks with project-owned markup and styles. Confirm the current headless import and returned contract from MCP before composing JSX.

The MCP may also expose a `hooks` mode for standalone PrimeReact hooks. It is not a substitute for the `headless` component mode and is outside the four-way UI variant selection unless the user explicitly requests a standalone hook.

## Mode-Scoped MCP Calls

- Pass the selected value as `mode` on `list`, `search`, `get_setup`, `get_component`, `get_guide`, `get_example`, and `validate_usage`.
- Use `version` without a mode to confirm server identity and capabilities. Use `list` with `kind: "modes"` only to confirm the server's advertised modes; do not let that replace project inspection.
- For Next.js or Vite setup, call `get_setup` with the selected mode and environment, then use mode-scoped `search` and `get_guide` for the exact host-specific procedure.
- Require returned components, guides, examples, and resource URIs to match the selected mode. Reroute instead of borrowing another mode's source.

## Import Boundaries

- In `styled`, preserve current package component imports returned by MCP and the project's provider/theme setup.
- In `tailwind`, preserve the resolved local alias or relative component path and the project's local utility/variant helpers. Do not replace copied components with package UI imports.
- In `primitive` and `headless`, fetch current setup, component metadata, and an example before naming imports or APIs. These modes are distinct and must not be reconstructed from styled or Tailwind usage.
- Do not assume a local alias has a barrel export. Preserve the concrete component subpath unless the project proves otherwise.

## Validation And Recovery

- Include imports in `validate_usage` to supply routing context, and pass the same selected mode. Independently compare the import with mode-scoped MCP sources because the current validator may not report package-versus-local or cross-framework mismatches.
- If `mode-import-mismatch` appears, recheck project evidence, refetch the correct mode, fix the import boundary, and validate again.
- For primitive/headless routing checks, verify the returned mode and resource source before writing code; do not invent unsupported props, compound parts, or hook returns.
- For headless mode, treat retrieved API metadata and examples as authoritative for hook inputs and returns. Static validation may not cover project-owned native attributes or the complete hook contract, so report that limitation explicitly.
- If mode-scoped MCP calls are missing or fail, run the PrimeReact doctor command with the selected variant and report the failed checks before using a named local fallback.
