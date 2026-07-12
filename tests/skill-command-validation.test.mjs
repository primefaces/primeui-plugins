import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateSkillDoctorCommands } from '../scripts/lib/skill-command-validation.mjs';

async function createFixture(command) {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'primeui-skill-command-test-'));
  const canonicalRoot = path.join(repositoryRoot, 'skills', 'primevue');
  const generatedRoot = path.join(repositoryRoot, 'plugins', 'primevue', 'skills', 'primevue');

  for (const skillRoot of [canonicalRoot, generatedRoot]) {
    await mkdir(skillRoot, { recursive: true });
    await writeFile(path.join(skillRoot, 'SKILL.md'), `# PrimeVue\n\nUse \`${command}\`.\n`);
  }

  return {
    pluginsConfig: {
      plugins: [
        {
          name: 'primevue',
          outputs: { plugin: 'plugins/primevue' },
          skillSourcePath: 'skills/primevue'
        }
      ]
    },
    repositoryRoot
  };
}

test('skill command validation accepts the supported doctor command', async (context) => {
  const fixture = await createFixture('primeui doctor --json --tool codex --library primevue');
  context.after(() => rm(fixture.repositoryRoot, { force: true, recursive: true }));

  assert.deepEqual(
    await validateSkillDoctorCommands(fixture.repositoryRoot, fixture.pluginsConfig),
    []
  );
});

test('skill command validation rejects stale canonical and generated instructions', async (context) => {
  const fixture = await createFixture('primeui ai doctor --json --tool codex --library primevue');
  context.after(() => rm(fixture.repositoryRoot, { force: true, recursive: true }));

  assert.deepEqual(
    await validateSkillDoctorCommands(fixture.repositoryRoot, fixture.pluginsConfig),
    [
      'canonical/primevue/SKILL.md: stale PrimeUI doctor command is forbidden.',
      'generated/primevue/SKILL.md: stale PrimeUI doctor command is forbidden.'
    ]
  );
});
