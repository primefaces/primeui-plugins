import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { repositoryRoot } from '../scripts/lib/repository.mjs';

const expectedSkills = [
  'primeng-router',
  'primeng-component-implementation',
  'primeng-setup-installation',
  'primeng-theming-customization',
  'primeng-accessibility-icons',
  'primeng-migration',
  'primeng-audit-troubleshooting'
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
}

async function readSkill(name) {
  return readFile(path.join(repositoryRoot, 'skills', 'primeng', name, 'SKILL.md'), 'utf8');
}

const [config, scenarios] = await Promise.all([
  readJson('config/plugins.json'),
  readJson('tests/fixtures/primeng-scenarios.json')
]);
const primeng = config.plugins.find((plugin) => plugin.name === 'primeng');
const skillContents = new Map(
  await Promise.all(expectedSkills.map(async (name) => [name, await readSkill(name)]))
);

test('PrimeNG declares the exact ordered seven-skill identity set', () => {
  assert.deepEqual(primeng.skills, expectedSkills.map((name, order) => ({
    directory: name,
    id: name,
    name,
    order,
    owner: 'primeng',
    sourcePath: `skills/primeng/${name}`
  })));
});

test('the PrimeNG router maps every scenario to exactly one smallest focused skill', () => {
  const router = skillContents.get('primeng-router');
  const routes = Object.fromEntries(
    [...router.matchAll(/^- `([^`]+)`: `([^`]+)`/gmu)].map((match) => [match[1], match[2]])
  );

  assert.deepEqual(routes, {
    accessibility: 'primeng-accessibility-icons',
    audit: 'primeng-audit-troubleshooting',
    component: 'primeng-component-implementation',
    migration: 'primeng-migration',
    setup: 'primeng-setup-installation',
    theming: 'primeng-theming-customization'
  });
  for (const scenario of scenarios) {
    assert.equal(routes[scenario.route], scenario.expectedSkill, scenario.id);
  }
  assert.match(router, /Select exactly one smallest focused skill/);
  assert.match(router, /Current PrimeNG MCP results, generated metadata, current canonical routed PrimeNG docs, and current canonical Angular documentation/);
});

test('deterministic PrimeNG scenarios enforce MCP routing and call budgets', () => {
  assert.deepEqual(scenarios.map((scenario) => scenario.workflow), [
    'known-component',
    'source-backed-behavior',
    'discovery',
    'setup',
    'unsupported-ngmodule',
    'table-workflow',
    'forms-workflow',
    'template-workflow',
    'directive-workflow',
    'input-output-workflow',
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
      assert.match(content, /primeui doctor --json --tool <tool> --library primeng/);
    }
  }
});

test('PrimeNG policy is source-backed, Angular-specific, and rejects undocumented NgModule setup', () => {
  const router = skillContents.get('primeng-router');
  assert.match(router, /ApplicationConfig/);
  assert.match(router, /app\.config\.ts/);
  assert.match(router, /providePrimeNG/);
  assert.match(router, /NgModule and every other undocumented setup workflow are explicitly unsupported/);
  assert.doesNotMatch(router, /PrimeVue component|PrimeReact component/);

  const component = skillContents.get('primeng-component-implementation');
  assert.match(component, /call `get_component` directly/);
  assert.match(component, /call `search` only when the component name is unknown/);
  assert.match(component, /section metadata, exact section IDs, `hasCode`, and valid next-call arguments before calling `get_example`/);
  assert.match(component, /Templates, directives, forms, inputs, and outputs/);
  assert.match(component, /Table:/);

  const setup = skillContents.get('primeng-setup-installation');
  assert.match(setup, /Call `get_setup` with the documented environment or source-backed alias/);
  assert.match(setup, /Use `get_guide` only for a relevant routed/);
  assert.match(setup, /Do not call `get_guide` to search for a legacy workaround, synthesize NgModule guidance/);
  assert.match(setup, /no invented URL or fallback path/);

  for (const [name, content] of skillContents) {
    assert.match(content, new RegExp(`^name: ${name}$`, 'mu'));
    assert.doesNotMatch(content, /primeui ai doctor/);
    assert.doesNotMatch(content, /--library primevue|--library primereact/);
    if (name !== 'primeng-router') {
      assert.match(content, /Do not call `version` routinely|Do not call `version` merely/);
    }
  }
});
