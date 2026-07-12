---
name: primeng-setup-installation
description: Set up PrimeNG only through current routed standalone Angular ApplicationConfig, app.config.ts, and providePrimeNG guidance. Use for installation, supported environment aliases, provider registration, and initial theme configuration. NgModule setup is explicitly unsupported.
---

# PrimeNG Setup And Installation

Inspect package metadata and the lockfile, package manager, Angular workspace configuration, `main.ts`, `app.config.ts`, current application providers, `providePrimeNG`, theme preset, global styles, aliases, and standalone component imports. Preserve the existing documented standalone structure and package-management conventions.

Call `get_setup` with the documented environment or source-backed alias when setup routing applies. Current generated metadata, not this skill, decides supported aliases and candidates. Use `get_guide` only for a relevant routed installation, configuration, or initial theming concept that `get_setup` does not fully answer. Never guess a route, alias, package, command, version, public URL, provider, or legacy setup.

The only supported setup workflow is current routed standalone Angular configuration through `ApplicationConfig`/`app.config.ts` and `providePrimeNG`. If `get_setup` returns unsupported for NgModule or any other undocumented environment, report the explicit unsupported diagnostic and candidates exactly as returned. Do not call `get_guide` to search for a legacy workaround, synthesize NgModule guidance, convert project architecture, or invent a public URL.

Make the smallest additive change. Do not duplicate application providers or component imports, replace the package manager, overwrite a preset, expose credentials or license values, or mix assistant-plugin installation with application installation.

Do not call `version` routinely. If the setup includes final component code, use `validate_usage` once on that final usage and repeat only after a reported issue; otherwise use the project's focused Angular type/build/runtime check.

## Scenario Contracts

- `setup`: `get_setup -> get_guide`; maximum 3.
- `unsupported-ngmodule`: `get_setup`; maximum 3.

Report returned setup/guide resource and public citations, the preserved standalone provider boundary, changed files, and remaining Angular runtime or browser checks. For unsupported NgModule, report no invented URL or fallback path.
