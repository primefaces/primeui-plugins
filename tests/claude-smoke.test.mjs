import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectSkillTree } from '../scripts/lib/skill-tree.mjs';
import { configuredPluginFixture, installedPayloadContract } from './helpers/plugin-contract-fixtures.mjs';
import {
  assertInstalledPayload,
  parseClaudeSmokeArguments
} from '../scripts/lib/claude-smoke.mjs';
import { runCommand } from '../scripts/lib/process.mjs';

const processInspectionAvailable =
  process.platform !== 'win32' &&
  spawnSync('ps', ['-axo', 'pid=,ppid='], { stdio: 'ignore' }).status === 0;

test('shared command runner waits for a timed-out child to exit', async () => {
  const startedAt = Date.now();
  await assert.rejects(
    runCommand(
      process.execPath,
      [
        '-e',
        "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 150)); setInterval(() => {}, 1000);"
      ],
      { timeoutMs: 500 }
    ),
    /timed out after 500ms/
  );
  assert.equal(Date.now() - startedAt >= 600, true);
});

test(
  'shared command runner bounds descendants that inherit stdio after timeout',
  { skip: process.platform === 'win32' },
  async () => {
    const startedAt = Date.now();
    await assert.rejects(
      runCommand('/bin/sh', ['-c', "(trap '' TERM; sleep 7) & wait"], {
        forcedTerminationWaitMs: 100,
        terminationGraceMs: 100,
        timeoutMs: 50
      }),
      /timed out after 50ms/
    );
    const elapsedMs = Date.now() - startedAt;
    assert.equal(elapsedMs >= 100, true);
    assert.equal(elapsedMs < 1_000, true);
  }
);

test(
  'shared command runner terminates an escaped descendant after timeout',
  { skip: processInspectionAvailable ? false : 'requires POSIX process-tree inspection' },
  async () => {
    const escapedChild = [
      "const { spawn } = require('node:child_process');",
      "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {",
      "  detached: true, stdio: ['ignore', process.stdout, process.stderr]",
      '});',
      'child.unref();',
      "process.stdout.write(`ESCAPED_PID:${child.pid}\\n`);",
      'setInterval(() => {}, 1000);'
    ].join('\n');
    const startedAt = Date.now();
    let timeoutError;
    try {
      await runCommand(process.execPath, ['-e', escapedChild], {
        forcedTerminationWaitMs: 50,
        terminationGraceMs: 50,
        timeoutMs: 500
      });
    } catch (error) {
      timeoutError = error;
    }
    assert.match(timeoutError?.message ?? '', /timed out after 500ms/);
    const pidMatch = /ESCAPED_PID:(\d+)/.exec(timeoutError.message);
    assert.notEqual(pidMatch, null);
    const escapedPid = Number(pidMatch[1]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      assert.throws(
        () => process.kill(escapedPid, 0),
        (error) => error?.code === 'ESRCH'
      );
    } finally {
      try {
        process.kill(escapedPid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') {
          throw error;
        }
      }
    }
    const elapsedMs = Date.now() - startedAt;
    assert.equal(elapsedMs >= 500, true);
    assert.equal(elapsedMs < 1_250, true);
  }
);

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
  const installPath = path.join(configRoot, 'plugins', 'cache', 'primeui', 'primevue', '1.0.0');
  await mkdir(path.join(installPath, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(installPath, 'skills', 'primevue'), { recursive: true });
  await writeFile(
    path.join(installPath, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'primevue', version: '1.0.0' })
  );
  await writeFile(
    path.join(installPath, '.mcp.json'),
    JSON.stringify(configuredPluginFixture().mcpDocument)
  );
  await writeFile(
    path.join(installPath, 'skills', 'primevue', 'SKILL.md'),
    '---\nname: primevue\ndescription: Test\n---\n'
  );
  const treeHash = (await inspectSkillTree(path.join(installPath, 'skills', 'primevue'))).hash;

  const contract = installedPayloadContract({
    skills: [{ directory: 'primevue', id: 'primevue', name: 'primevue', order: 0, owner: 'primevue', treeHash }]
  });
  await assert.doesNotReject(
    assertInstalledPayload({
      configRoot,
      contract,
      installPath,
      library: 'primevue'
    })
  );
  await mkdir(path.join(installPath, 'skills', 'primeng'), { recursive: true });
  await assert.rejects(
    assertInstalledPayload({
      configRoot,
      contract,
      installPath,
      library: 'primevue'
    }),
    /skill inventory differs/
  );
});
