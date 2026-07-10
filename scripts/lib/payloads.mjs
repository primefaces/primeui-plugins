function lockByName(lockConfig) {
  return new Map(lockConfig.sources.map((lock) => [lock.name, lock]));
}

export function mcpConfiguration(plugin, lock) {
  return {
    mcpServers: {
      [plugin.mcp.serverName]: {
        args: ['-y', `${lock.mcp.package}@${lock.mcp.version}`],
        command: 'npx'
      }
    }
  };
}

export function provenanceDocument(plugin, lock) {
  const provenance = {
    mcp: {
      package: lock.mcp.package,
      version: lock.mcp.version
    },
    name: plugin.name,
    pluginVersion: lock.pluginVersion,
    schemaVersion: 1,
    source: {
      commit: lock.source.commit,
      repository: lock.source.repository,
      skillHash: lock.source.skillHash,
      skillPath: lock.source.skillPath
    }
  };

  if (plugin.variants.length > 0) {
    provenance.variants = [...plugin.variants];
  }
  return provenance;
}

export function buildPayloadDocuments(pluginsConfig, lockConfig) {
  const locks = lockByName(lockConfig);
  const publisher = pluginsConfig.marketplace.publisher;
  const documents = new Map();

  documents.set('.claude-plugin/marketplace.json', {
    name: pluginsConfig.marketplace.name,
    owner: {
      name: publisher.name,
      url: publisher.url
    },
    plugins: pluginsConfig.plugins.map((plugin) => {
      const lock = locks.get(plugin.name);
      return {
        category: plugin.category,
        description: plugin.description,
        name: plugin.name,
        source: `./plugins/${plugin.name}`,
        version: lock.pluginVersion
      };
    })
  });

  documents.set('.agents/plugins/marketplace.json', {
    interface: {
      displayName: pluginsConfig.marketplace.displayName
    },
    name: pluginsConfig.marketplace.name,
    plugins: pluginsConfig.plugins.map((plugin) => ({
      category: plugin.category,
      name: plugin.name,
      policy: {
        authentication: pluginsConfig.marketplace.codexPolicy.authentication,
        installation: pluginsConfig.marketplace.codexPolicy.installation
      },
      source: {
        path: `./plugins/${plugin.name}`,
        source: 'local'
      }
    }))
  });

  for (const plugin of pluginsConfig.plugins) {
    const lock = locks.get(plugin.name);
    const pluginRoot = plugin.outputs.plugin;
    const geminiRoot = plugin.outputs.gemini;
    const mcp = mcpConfiguration(plugin, lock);
    const provenance = provenanceDocument(plugin, lock);

    documents.set(`${pluginRoot}/.claude-plugin/plugin.json`, {
      author: {
        name: publisher.name,
        url: publisher.url
      },
      description: plugin.description,
      name: plugin.name,
      repository: pluginsConfig.marketplace.repository,
      version: lock.pluginVersion
    });

    documents.set(`${pluginRoot}/.codex-plugin/plugin.json`, {
      author: {
        name: publisher.name,
        url: publisher.url
      },
      description: plugin.description,
      interface: {
        capabilities: [...plugin.installSurface.capabilities],
        category: plugin.category,
        defaultPrompt: [...plugin.installSurface.defaultPrompt],
        developerName: publisher.name,
        displayName: plugin.displayName,
        longDescription: plugin.installSurface.longDescription,
        shortDescription: plugin.installSurface.shortDescription,
        websiteURL: publisher.url
      },
      mcpServers: './.mcp.json',
      name: plugin.name,
      repository: pluginsConfig.marketplace.repository,
      skills: './skills/',
      version: lock.pluginVersion
    });

    documents.set(`${pluginRoot}/.mcp.json`, mcp);
    documents.set(`${pluginRoot}/provenance.json`, provenance);

    documents.set(`${geminiRoot}/gemini-extension.json`, {
      description: plugin.description,
      mcpServers: mcp.mcpServers,
      name: plugin.name,
      version: lock.pluginVersion
    });
    documents.set(`${geminiRoot}/provenance.json`, provenance);
  }

  return documents;
}
