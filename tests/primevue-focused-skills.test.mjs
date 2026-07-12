import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { repositoryRoot } from '../scripts/lib/repository.mjs';

const expectedSkills = [
  'primevue-router',
  'primevue-component-implementation',
  'primevue-setup-installation',
  'primevue-theming-customization',
  'primevue-accessibility-icons',
  'primevue-migration',
  'primevue-audit-troubleshooting'
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
}

async function readSkill(name) {
  return readFile(path.join(repositoryRoot, 'skills', 'primevue', name, 'SKILL.md'), 'utf8');
}

const [config, scenarios] = await Promise.all([
  readJson('config/plugins.json'),
  readJson('tests/fixtures/primevue-scenarios.json')
]);
const primevue = config.plugins.find((plugin) => plugin.name === 'primevue');
const skillContents = new Map(
  await Promise.all(expectedSkills.map(async (name) => [name, await readSkill(name)]))
);

test('PrimeVue declares the exact ordered seven-skill identity set', () => {
  assert.deepEqual(primevue.skills, expectedSkills.map((name, order) => ({
    directory: name,
    id: name,
    name,
    order,
    owner: 'primevue',
    sourcePath: `skills/primevue/${name}`
  })));
});

test('the router maps every scenario to exactly one smallest focused skill', () => {
  const router = skillContents.get('primevue-router');
  const routes = Object.fromEntries(
    [...router.matchAll(/^- `([^`]+)`: `([^`]+)`/gmu)].map((match) => [match[1], match[2]])
  );

  assert.deepEqual(routes, {
    accessibility: 'primevue-accessibility-icons',
    audit: 'primevue-audit-troubleshooting',
    component: 'primevue-component-implementation',
    migration: 'primevue-migration',
    setup: 'primevue-setup-installation',
    theming: 'primevue-theming-customization'
  });
  for (const scenario of scenarios) {
    assert.equal(routes[scenario.route], scenario.expectedSkill, scenario.id);
  }
  assert.match(router, /Select exactly one smallest focused skill/);
  assert.match(router, /Current PrimeVue MCP results and current canonical routed PrimeVue docs\/generated metadata/);
});

test('deterministic PrimeVue scenarios enforce MCP routing and call budgets', () => {
  assert.deepEqual(scenarios.map((scenario) => scenario.workflow), [
    'known-component',
    'source-backed-behavior',
    'discovery',
    'setup',
    'theming-customization',
    'accessibility-icons',
    'migration',
    'audit-invalid-api',
    'missing-mcp',
    'duplicate-mcp-plugin'
  ]);

  for (const scenario of scenarios) {
    const content = skillContents.get(scenario.expectedSkill);
    const sequence = scenario.calls.length === 0 ? 'none' : scenario.calls.join(' -> ');
    assert.ok(
      content.split('\n').includes(
        `- \`${scenario.workflow}\`: \`${sequence}\`; maximum ${scenario.maxCalls}.`
      ),
      `${scenario.id}: prose contract must match the deterministic fixture`
    );
    assert.ok(scenario.calls.length <= scenario.maxCalls, scenario.id);
    for (const call of scenario.calls) {
      assert.ok(scenario.allowedCalls.includes(call), `${scenario.id}: ${call} must be allowed`);
      assert.ok(!scenario.forbiddenCalls.includes(call), `${scenario.id}: ${call} must not be forbidden`);
    }
    assert.ok(scenario.forbiddenCalls.includes('version'), `${scenario.id}: routine version must be forbidden`);
    assert.equal(
      scenario.calls.filter((call) => call === 'validate_usage').length,
      scenario.validationCalls,
      scenario.id
    );
    if (scenario.validationCalls === 1) {
      assert.equal(scenario.calls.at(-1), 'validate_usage', `${scenario.id}: validate final code`);
    }
    if (scenario.validationCalls > 1) {
      assert.equal(scenario.repeatOnlyAfterIssue, true, `${scenario.id}: repeats require an issue`);
      assert.equal(scenario.calls.at(-1), 'validate_usage', `${scenario.id}: revalidate corrected final code`);
      assert.match(content, /After a reported issue/);
    }
    if (scenario.doctor) {
      assert.match(content, /primeui doctor --json --tool <tool> --library primevue/);
    }
  }
});

test('operational PrimeVue tool policy is explicit and does not retain the broad skill', () => {
  const component = skillContents.get('primevue-component-implementation');
  assert.match(component, /call `get_component` directly/);
  assert.match(component, /call `search` only when the component name is unknown/);
  assert.match(component, /section metadata, exact section IDs, `hasCode`, and valid next-call arguments before calling `get_example`/);

  const setup = skillContents.get('primevue-setup-installation');
  assert.match(setup, /Call `get_setup` with the documented environment/);
  assert.match(setup, /Use `get_guide` only for a relevant routed/);

  for (const [name, content] of skillContents) {
    assert.match(content, new RegExp(`^name: ${name}$`, 'mu'));
    assert.doesNotMatch(content, /primeui ai doctor/);
    if (name !== 'primevue-router') {
      assert.match(content, /Do not call `version` routinely|Do not call `version` merely/);
    }
  }
});
