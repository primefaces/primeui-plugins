---
name: primevue-setup-installation
description: Set up PrimeVue in current Vue, Vite, or Nuxt applications from routed PrimeVue setup guidance. Use for installation, plugin or Nuxt module registration, initial theme configuration, and supported environment routing.
---

# PrimeVue Setup And Installation

Inspect package metadata and the lockfile, package manager, app entry point or `nuxt.config`, Vue/Nuxt plugins, current PrimeVue registration, theme preset, global CSS, aliases, and auto-import configuration. Preserve the existing environment and package-management conventions.

Call `get_setup` with the documented environment when setup routing applies. Current metadata, not this skill, decides supported environments and aliases. Use `get_guide` only for a relevant routed installation, configuration, Vite, Nuxt, or initial theming concept that `get_setup` does not fully answer. Never guess a route, alias, package, command, version, public URL, or legacy setup.

Make the smallest additive change. Do not duplicate the PrimeVue plugin or Nuxt module, replace the package manager, overwrite a preset, expose credentials or license values, or mix assistant-plugin installation with application installation. If current metadata returns unsupported, report that honestly.

Do not call `version` routinely. If the setup includes final component code, use `validate_usage` once on that final usage and repeat only after a reported issue; otherwise use the project's focused type/build/runtime check.

## Scenario Contracts

- `setup`: `get_setup -> get_guide`; maximum 3.

Report the returned setup/guide citations, preserved local setup, changed files, and remaining runtime or browser checks.
