import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertInstalledPayload,
  parseClaudeSmokeArguments
} from '../scripts/lib/claude-smoke.mjs';

test('Claude smoke arguments use safe explicit matrix selectors', () => {
  assert.deepEqual(parseClaudeSmokeArguments([]), {
    claudeVersion: 'installed',
    keepTemp: false,
    libraries: ['primevue', 'primeng', 'primereact'],
    sources: ['local']
  });
  assert.deepEqual(
    parseClaudeSmokeArguments([
      '--claude-version',
      '2.1.206',
      '--library',
      'primevue',
      '--source',
      'all',
      '--keep-temp'
    ]),
    {
      claudeVersion: '2.1.206',
      keepTemp: true,
      libraries: ['primevue'],
      sources: ['local', 'github']
    }
  );
  assert.throws(() => parseClaudeSmokeArguments(['--claude-version', 'latest']), /exact SemVer/);
  assert.throws(() => parseClaudeSmokeArguments(['--source', 'url']), /all, local, or github/);
  assert.throws(() => parseClaudeSmokeArguments(['--unknown']), /Unknown argument/);
});

test('installed Claude payload inspection enforces skill and MCP isolation', async (context) => {
  const configRoot = await mkdtemp(path.join(os.tmpdir(), 'primeui-claude-payload-test-'));
  context.after(() => rm(configRoot, { force: true, recursive: true }));
  const installPath = path.join(configRoot, 'plugins', 'cache', 'primeui', 'primevue', '0.1.0-alpha.0');
  await mkdir(path.join(installPath, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(installPath, 'skills', 'primevue'), { recursive: true });
  await writeFile(
    path.join(installPath, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'primevue', version: '0.1.0-alpha.0' })
  );
  await writeFile(
    path.join(installPath, '.mcp.json'),
    JSON.stringify({
      mcpServers: {
        primevue: { args: ['-y', '@primevue/mcp@5.0.0-rc.2'], command: 'npx' }
      }
    })
  );
  await writeFile(
    path.join(installPath, 'skills', 'primevue', 'SKILL.md'),
    '---\nname: primevue\ndescription: Test\n---\n'
  );

  await assert.doesNotReject(
    assertInstalledPayload({
      configRoot,
      contract: {
        mcpPackage: '@primevue/mcp',
        mcpVersion: '5.0.0-rc.2',
        pluginVersion: '0.1.0-alpha.0'
      },
      installPath,
      library: 'primevue'
    })
  );
  await mkdir(path.join(installPath, 'skills', 'primeng'), { recursive: true });
  await assert.rejects(
    assertInstalledPayload({
      configRoot,
      contract: {
        mcpPackage: '@primevue/mcp',
        mcpVersion: '5.0.0-rc.2',
        pluginVersion: '0.1.0-alpha.0'
      },
      installPath,
      library: 'primevue'
    }),
    /exactly one physical matching skill directory/
  );
});
