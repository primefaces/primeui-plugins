# PrimeUI Plugins

Official AI assistant integrations for PrimeVue, PrimeNG, and PrimeReact.

Choose one plugin for the UI library used by your project. Each plugin installs focused workflow skills and connects one matching MCP server for current documentation, APIs, examples, setup guidance, and usage validation.

| Plugin | MCP package | Clients |
| --- | --- | --- |
| `primevue` | `@primevue/mcp` | Claude Code, Codex, GitHub Copilot, Cursor, Gemini CLI |
| `primeng` | `@primeng/mcp` | Claude Code, Codex, GitHub Copilot, Cursor, Gemini CLI |
| `primereact` | `@primereact/mcp` | Claude Code, Codex, GitHub Copilot, Cursor, Gemini CLI |

## Claude Code

```bash
claude plugin marketplace add primefaces/primeui-plugins
claude plugin install primevue@primeui
```

Replace `primevue` with `primeng` or `primereact` when needed.

```bash
claude plugin marketplace update primeui
claude plugin update primevue@primeui
```

## Codex

```bash
codex plugin marketplace add primefaces/primeui-plugins
codex plugin add primevue@primeui
```

Replace `primevue` with `primeng` or `primereact` when needed. Use the `/plugins` browser or the ChatGPT desktop Plugins screen to manage installed plugins.

```bash
codex plugin marketplace upgrade primeui
codex plugin remove primevue@primeui
codex plugin add primevue@primeui
```

## GitHub Copilot

```bash
copilot plugin marketplace add primefaces/primeui-plugins
copilot plugin install primevue@primeui
```

VS Code automatically discovers plugins installed by the Copilot CLI. Replace `primevue` with `primeng` or `primereact` when needed.

```bash
copilot plugin update primevue
copilot plugin uninstall primevue
```

## Cursor

PrimeUI plugins are structured for the Cursor Marketplace. After marketplace approval, install the selected PrimeVue, PrimeNG, or PrimeReact plugin from Cursor and manage its skills and MCP server from **Customize**.

For a local installation from this repository, clone the public `main` branch and link one plugin directory:

```bash
ln -s <checkout>/plugins/primevue ~/.cursor/plugins/local/primevue
```

Restart Cursor or run **Developer: Reload Window** after changing the link.

## Gemini CLI

Gemini installs one extension root at a time. Clone the public `main` branch, then install the selected plugin directory:

```bash
gemini extensions validate <checkout>/plugins/primevue
gemini extensions install <checkout>/plugins/primevue --consent
```

Use the `primeng` or `primereact` directory for the other libraries.

## Repository Contents

The public branch contains only installable marketplace catalogs and plugin payloads. Maintainer source and development tooling live on the [`dev`](https://github.com/primefaces/primeui-plugins/tree/dev) branch.

## License

Use of these plugins with PrimeUI libraries is subject to the [PrimeUI License](https://primeui.dev/licenses).
