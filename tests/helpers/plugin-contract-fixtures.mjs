import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { mcpPackageSpec } from '../../scripts/lib/contracts.mjs';
import { repositoryRoot } from '../../scripts/lib/repository.mjs';

const pluginsConfig = JSON.parse(
  await readFile(path.join(repositoryRoot, 'config', 'plugins.json'), 'utf8')
);

export function configuredPluginFixture(library = 'primevue') {
  const plugin = pluginsConfig.plugins.find((candidate) => candidate.name === library);
  if (plugin === undefined) {
    throw new Error(`Unknown plugin fixture: ${library}.`);
  }
  return {
    library,
    mcpDocument: {
      mcpServers: {
        [plugin.mcp.serverName]: {
          args: ['-y', mcpPackageSpec(plugin.mcp)],
          command: 'npx'
        }
      }
    },
    mcpPackage: plugin.mcp.package,
    mcpPackageSpec: mcpPackageSpec(plugin.mcp),
    mcpVersionRange: plugin.mcp.versionRange,
    plugin: structuredClone(plugin),
    provenanceMcp: {
      package: plugin.mcp.package,
      versionRange: plugin.mcp.versionRange
    }
  };
}

export function installedPayloadContract({
  library = 'primevue',
  lockedSkills,
  pluginVersion = '0.1.0-alpha.0',
  skills
}) {
  const fixture = configuredPluginFixture(library);
  return {
    mcpPackage: fixture.mcpPackage,
    mcpPackageSpec: fixture.mcpPackageSpec,
    mcpVersionRange: fixture.mcpVersionRange,
    pluginVersion,
    skills,
    ...(lockedSkills === undefined ? {} : { lockedSkills })
  };
}
